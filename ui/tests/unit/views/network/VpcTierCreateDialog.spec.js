// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements. See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership. The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License. You may obtain a copy of the License at
//
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied. See the License for the
// specific language governing permissions and limitations
// under the License.

import { shallowMount, flushPromises } from '@vue/test-utils'
import { reactive } from 'vue'
import VpcTierCreateDialog from '@/views/network/VpcTierCreateDialog'
import { getAPI, postAPI } from '@/api'
import { loadVpcTierChoices, vpcTierCompatibility, vpcTierScope } from '@/utils/vpcTierCreation'

jest.mock('@/api', () => ({ getAPI: jest.fn(), postAPI: jest.fn() }))

const svc = (name, ...names) => ({ name, provider: names.map(name => ({ name })) })
const compatible = { id: 'good', name: 'Compatible', state: 'Enabled', service: [svc('SourceNat', 'VpcVirtualRouter'), svc('NetworkACL', 'VpcVirtualRouter')] }
const incompatible = { ...compatible, id: 'bad', service: [...compatible.service, svc('Firewall', 'VpcVirtualRouter')] }
const vpc = { id: 'vpc', zoneid: 'zone', vpcofferingid: 'vpc-offering', projectid: 'project', cidr: '10.1.0.0/24', service: compatible.service }
const context = { ...compatible, id: vpc.vpcofferingid, networkmode: 'NATTED' }
const fields = { name: 'new-tier', gateway: '10.1.0.1', netmask: '255.255.255.240', offering: compatible.id, acl: 'acl', externalid: 'qa-id' }
const network = {
  id: 'tier',
  vpcid: vpc.id,
  projectid: vpc.projectid,
  networkofferingid: compatible.id,
  name: fields.name,
  gateway: fields.gateway,
  netmask: fields.netmask,
  aclid: fields.acl,
  externalid: fields.externalid
}
const discovery = {
  listNetworkOfferings: ['networkoffering', [incompatible, compatible]],
  listVPCOfferings: ['vpcoffering', [context]],
  listNetworkACLLists: ['networkacllist', [{ id: 'acl', name: 'default_allow' }]],
  listNetworks: ['network', []]
}
const ordinary = Object.fromEntries(['createNetwork', 'queryAsyncJobResult', ...Object.keys(discovery)].map(api => [api, {}]))
const response = (api, key, rows) => ({ [api.toLowerCase() + 'response']: { count: rows.length, [key]: rows } })
const load = (api, args) => {
  if (!discovery[api]) throw new Error('unexpected API: ' + api)
  const [key, rows] = discovery[api]
  return Promise.resolve(response(api, key, args.id ? rows.filter(row => row.id === args.id) : rows))
}

function deferred () {
  let finish
  const promise = new Promise(resolve => { finish = resolve })
  return { promise, resolve: finish }
}

async function dialog () {
  const scope = { $route: reactive({ fullPath: '/vpc/vpc?tab=tiers' }), $store: { getters: reactive({ apis: ordinary, project: { id: 'project' } }) }, resource: vpc }
  const wrapper = shallowMount(VpcTierCreateDialog, {
    props: { resource: vpc, scope: vpcTierScope(scope) },
    global: {
      mocks: { $store: scope.$store, $route: scope.$route, $t: key => key },
      directives: { focus: {} },
      stubs: {
        MoldDialog: { template: '<div><slot/><slot name="footer"/></div>' },
        'a-form': { template: '<div><slot/></div>', methods: { validate: () => Promise.resolve(), scrollToField: () => {} } },
        'a-alert': true,
        'a-form-item': true,
        'a-input': true,
        'a-select': true,
        'a-tooltip': true,
        'a-button': true
      }
    }
  })
  await flushPromises()
  Object.assign(wrapper.vm.form, fields)
  return { wrapper, scope }
}

beforeEach(() => {
  jest.resetAllMocks()
  getAPI.mockImplementation(load)
})

test('checks every provider and keeps the rejection reason for Firewall', async () => {
  const choices = (await loadVpcTierChoices(getAPI, ordinary, vpc)).choices
  expect(choices[0]).toMatchObject({ blocked: true, issues: [{ service: 'Firewall', provider: 'VpcVirtualRouter', reason: 'vpc.service' }] })
  expect(choices[1]).toMatchObject({ blocked: false, status: 'unknown' })
  expect(getAPI.mock.calls.map(([api]) => api)).not.toContain('listPhysicalNetworks')
  const multi = { ...compatible, service: [svc('SourceNat', 'VpcVirtualRouter', 'VirtualRouter')] }
  expect(vpcTierCompatibility(vpc, context, multi, new Map()).issues).toContainEqual({ service: 'SourceNat', provider: 'VirtualRouter', reason: 'vpc.service' })
})

test('distinguishes physical failure, empty candidate list and permitted ready candidate', async () => {
  const allowed = { ...ordinary, listPhysicalNetworks: {}, listTrafficTypes: {}, listNetworkServiceProviders: {} }
  const config = {
    listPhysicalNetworks: ['physicalnetwork', [{ id: 'physical', state: 'Enabled' }]],
    listTrafficTypes: ['traffictype', [{ id: 'guest', traffictype: 'Guest' }]],
    listNetworkServiceProviders: ['networkserviceprovider', [{ id: 'provider', name: 'VpcVirtualRouter', state: 'Enabled', servicelist: ['SourceNat', 'NetworkACL'] }]]
  }
  const get = jest.fn((api, args) => config[api] ? Promise.resolve(response(api, ...config[api])) : load(api, args))
  expect((await loadVpcTierChoices(get, allowed, vpc)).choices[1].status).toBe('ready')
  config.listNetworkServiceProviders[1][0].servicelist = ['SourceNat']
  expect((await loadVpcTierChoices(get, allowed, vpc)).choices[1].issues).toContainEqual({ service: 'NetworkACL', provider: 'VpcVirtualRouter', reason: 'missing.service' })
  const empty = api => api === 'listNetworkOfferings' ? Promise.resolve(response(api, 'networkoffering', [])) : load(api, {})
  expect((await loadVpcTierChoices(empty, ordinary, vpc)).choices).toEqual([])
  get.mockRejectedValueOnce(new Error('query failed'))
  await expect(loadVpcTierChoices(get, allowed, vpc)).rejects.toThrow('query failed')
})

test('blocks mode and public LB conflicts and preserves reuse of the same LB offering', () => {
  const lb = { ...compatible, supportsinternallb: false, service: [...compatible.service, svc('Lb', 'VpcVirtualRouter')] }
  const other = { ...lb, id: 'existing' }
  const scoped = { ...vpc, network: [{ networkofferingid: other.id }] }
  const mode = { ...context, service: lb.service }
  expect(vpcTierCompatibility(scoped, mode, { ...lb, networkmode: 'ROUTED' }, new Map([[other.id, other]])).issues.map(i => i.reason))
    .toEqual(['vpc.mode', 'vpc.public.lb'])
  expect(vpcTierCompatibility(scoped, mode, other, new Map([[other.id, other]])).issues).toEqual([])
})

test.each([431, 530])('keeps inputs after HTTP %s and sends one request per deliberate retry', async code => {
  const { wrapper } = await dialog()
  postAPI.mockRejectedValueOnce({ response: { data: { createnetworkresponse: { errorcode: code, errortext: 'backend rejection' } } } })
    .mockResolvedValueOnce({ createnetworkresponse: network })
  await Promise.all([wrapper.vm.submit(), wrapper.vm.submit()])
  expect(postAPI).toHaveBeenCalledTimes(1)
  expect(wrapper.vm.form).toEqual(fields)
  expect(wrapper.vm.error).toBe('backend rejection')
  expect(wrapper.emitted('created')).toBeUndefined()
  await wrapper.vm.submit()
  expect(postAPI).toHaveBeenCalledTimes(2)
  expect(postAPI.mock.calls[0][1]).toEqual(postAPI.mock.calls[1][1])
  expect(postAPI.mock.calls[0][1]).toMatchObject({ projectid: 'project', vpcid: 'vpc', aclid: 'acl' })
  expect(wrapper.emitted('created')).toHaveLength(1)
  wrapper.unmount()
})

test('does not resend an ambiguous POST before checking its result', async () => {
  const { wrapper } = await dialog()
  postAPI.mockRejectedValueOnce(new Error('socket closed')).mockResolvedValueOnce({ createnetworkresponse: network })
  await wrapper.vm.submit()
  expect(wrapper.vm.form).toEqual(fields)
  expect(wrapper.vm.pending.params.name).toBe(fields.name)
  await wrapper.vm.submit()
  expect(postAPI).toHaveBeenCalledTimes(1)
  await wrapper.vm.recheck()
  expect(wrapper.vm.pending).toBeNull()
  await wrapper.vm.submit()
  expect(wrapper.emitted('created')).toHaveLength(1)
  wrapper.unmount()
})

test('recognizes a committed tier after a lost response without issuing a second POST', async () => {
  const { wrapper } = await dialog()
  postAPI.mockRejectedValueOnce(new Error('connection lost after submission'))
  getAPI.mockImplementation((api, args) => api === 'listNetworks' ? Promise.resolve(response(api, 'network', [network])) : load(api, args))
  await wrapper.vm.submit()
  await wrapper.vm.recheck()
  expect(postAPI).toHaveBeenCalledTimes(1)
  expect(wrapper.emitted('created')).toHaveLength(1)
  wrapper.unmount()
})

test('waits for the existing job, preserves inputs on job failure, and retries successfully', async () => {
  const { wrapper } = await dialog()
  postAPI.mockResolvedValueOnce({ createnetworkresponse: { jobid: 'job' } }).mockResolvedValueOnce({ createnetworkresponse: network })
  const result = deferred()
  getAPI.mockImplementation((api, args) => api === 'queryAsyncJobResult' ? result.promise : load(api, args))
  const submission = wrapper.vm.submit()
  await flushPromises()
  expect(wrapper.emitted('created')).toBeUndefined()
  expect(wrapper.vm.pending.jobId).toBe('job')
  result.resolve({ queryasyncjobresultresponse: { jobid: 'job', jobstatus: 2, jobresult: { errortext: 'async error' } } })
  await submission
  expect(wrapper.vm.form).toEqual(fields)
  expect(wrapper.vm.error).toBe('async error')
  await wrapper.vm.submit()
  expect(wrapper.emitted('created')).toHaveLength(1)
  wrapper.unmount()
})

test('ignores the late receipt after switching project', async () => {
  const { wrapper, scope } = await dialog()
  const result = deferred()
  postAPI.mockReturnValueOnce(result.promise)
  const submission = wrapper.vm.submit()
  await flushPromises()
  expect(postAPI).toHaveBeenCalledTimes(1)
  scope.$store.getters.project = { id: 'other-project' }
  result.resolve({ createnetworkresponse: network })
  await submission
  expect(wrapper.emitted('created')).toBeUndefined()
  wrapper.unmount()
})
