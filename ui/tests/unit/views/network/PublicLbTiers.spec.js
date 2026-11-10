// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements. See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership. The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License. You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied. See the License for the
// specific language governing permissions and limitations
// under the License.

import { shallowMount, flushPromises } from '@vue/test-utils'
import { h, reactive } from 'vue'
import LoadBalancing from '@/views/network/LoadBalancing'
import { fetchPublicLbTiers, publicLbTierEligible, hasPublicLbScheme } from '@/utils/publicLbTiers'
import { getAPI, postAPI } from '@/api'
jest.mock('@/api', () => ({ getAPI: jest.fn(), postAPI: jest.fn() }))

const tier = (id = 'public', scheme = 'Public') => ({
  id,
  name: id,
  displaytext: id,
  vpcid: 'vpc',
  projectid: 'project',
  networkofferingid: scheme,
  service: [{ name: 'Lb', provider: [{ name: scheme === 'Internal' ? 'InternalLbVm' : 'VpcVirtualRouter' }], capability: [{ name: 'LbSchemes', value: scheme }] }]
})
const offer = (id = 'Public', provider = 'VpcVirtualRouter') => ({ id, service: [{ name: 'Lb', provider: [{ name: provider }] }] })
const networks = rows => ({ listnetworksresponse: { network: rows, count: rows.length } })
const offerings = rows => ({ listnetworkofferingsresponse: { networkoffering: rows, count: rows.length } })
const read = (api, params) => Promise.resolve(api === 'listNetworks' ? networks([tier()]) : api === 'listNetworkOfferings' ? offerings([offer()]) : { listvirtualmachinesresponse: { count: 0 } })
let wrappers
beforeEach(() => { jest.clearAllMocks(); wrappers = []; getAPI.mockImplementation(read) })
afterEach(() => wrappers.forEach(w => w.unmount()))

test('Public capability and offering provider decide suitability, including combined schemes', () => {
  expect(publicLbTierEligible(tier(), offer(), 'vpc', 'project')).toBe(true)
  expect(hasPublicLbScheme(tier('both', 'Internal, Public'))).toBe(true)
  expect(publicLbTierEligible(tier('internal', 'Internal'), offer('Internal', 'InternalLbVm'), 'vpc', 'project')).toBe(false)
  expect(publicLbTierEligible(tier(), offer('Public', 'InternalLbVm'), 'vpc', 'project')).toBe(false)
})

test('missing metadata, a different offering, VPC or project cannot become a candidate', () => {
  for (const [network, offering, vpc, project] of [
    [{ ...tier(), service: [] }, offer(), 'vpc', 'project'],
    [tier(), offer('other'), 'vpc', 'project'], [tier(), offer(), 'other', 'project'], [tier(), offer(), 'vpc', 'other'],
    [{ ...tier(), service: [{ name: 'Lb', capability: [{ name: 'LbSchemes', value: 'Public' }] }] }, offer(), 'vpc', 'project']
  ]) expect(publicLbTierEligible(network, offering, vpc, project)).toBe(false)
  expect(hasPublicLbScheme({ ...tier(), supportspublicaccess: true, service: [{ name: 'Lb' }] })).toBe(false)
})

test('collects all pages before filtering and binds every page/offering to the captured project', async () => {
  const get = jest.fn((api, p) => Promise.resolve(api === 'listNetworks'
    ? { listnetworksresponse: { network: p.page === 1 ? [tier('internal', 'Internal')] : [tier()], count: 2 } }
    : offerings([offer()])))
  expect((await fetchPublicLbTiers(get, 'vpc', 'project')).map(n => n.id)).toEqual(['public'])
  expect(get.mock.calls.filter(([api]) => api === 'listNetworks').map(([, p]) => p.page)).toEqual([1, 2])
  expect(get.mock.calls.every(([, p]) => p.projectid === 'project' && p.ignoreproject)).toBe(true)
})

test('an Internal-only VPC is empty without querying unrelated offerings', async () => {
  const get = jest.fn().mockResolvedValue(networks([tier('internal', 'Internal')]))
  expect(await fetchPublicLbTiers(get, 'vpc', 'project')).toEqual([]); expect(get).toHaveBeenCalledTimes(1)
})

test('offering failure, missing offering and incomplete collection fail closed', async () => {
  const get = jest.fn(api => api === 'listNetworks' ? Promise.resolve(networks([tier()])) : Promise.reject(new Error('503')))
  await expect(fetchPublicLbTiers(get, 'vpc', 'project')).rejects.toThrow('503')
  get.mockImplementation(api => Promise.resolve(api === 'listNetworks' ? networks([tier()]) : offerings([])))
  await expect(fetchPublicLbTiers(get, 'vpc', 'project')).rejects.toThrow('unavailable')
  get.mockResolvedValue({ listnetworksresponse: { count: 2 } })
  await expect(fetchPublicLbTiers(get, 'vpc', 'project')).rejects.toThrow('Incomplete')
})

test('a scope change stops later pages/offering calls', async () => {
  let current = true
  const get = jest.fn(async () => { current = false; return networks([tier()]) })
  await expect(fetchPublicLbTiers(get, 'vpc', 'project', () => current)).rejects.toThrow('context changed')
  expect(get).toHaveBeenCalledTimes(1)
})

function mount () {
  const getters = reactive({ project: { id: 'project' }, userInfo: { id: 'owner' }, apis: { createLoadBalancerRule: {}, assignToLoadBalancerRule: {} } })
  const w = shallowMount({ ...LoadBalancing, created () { this.initForm() }, methods: { ...LoadBalancing.methods, fetchData: jest.fn() } }, {
    props: { resource: { id: 'ip', vpcid: 'vpc', projectid: 'project' } },
    global: {
      mocks: { $t: k => k, $getApiParams: () => ({ cidrlist: {}, methodname: {} }), $store: { getters, state: { user: { token: 'session' } } }, $route: reactive({ path: '/publicip/ip', meta: { name: 'publicip' } }), $notifyError: jest.fn(), $pollJob: jest.fn().mockResolvedValue({ jobstatus: 1 }) },
      provide: { parentFetchData: jest.fn(), parentToggleLoading: jest.fn() },
      stubs: { MoldDialog: { props: ['visible'], render () { return this.visible ? h('section', [this.$slots.default?.(), h('footer', this.$slots.footer?.())]) : null } }, BulkActionView: true }
    }
  })
  wrappers.push(w); w.vm.loading = false
  return { w, getters }
}
async function draft (w) {
  w.vm.openCreateDialog(); await flushPromises()
  await w.setData({ loading: false, targetMode: 'later', newRule: { ...w.vm.newRule, name: 'Keep draft', publicport: '18981', privateport: '22' } })
}

test('manual connect-later still requires a verified Public Tier and uses its ID', async () => {
  const { w } = mount(); await draft(w)
  expect(w.vm.selectedTier).toBe('public'); expect(w.vm.ruleSubmissionBlocked).toBe(false)
  postAPI.mockResolvedValue({ createloadbalancerruleresponse: { id: 'rule', jobid: 'job' } })
  await w.vm.handleAddNewRule(); await flushPromises()
  expect(postAPI).toHaveBeenCalledWith('createLoadBalancerRule', expect.objectContaining({ networkid: 'public', projectid: 'project', ignoreproject: true }), { preserveOnFailure: true })
})

test('refresh failure clears candidates and blocks click/keyboard while retaining form inputs', async () => {
  const { w } = mount(); await draft(w)
  getAPI.mockRejectedValue(new Error('503')); await w.vm.fetchListTiers()
  expect(w.vm.tiers.failed).toBe(true); expect(w.vm.tiers.data).toEqual([]); expect(w.vm.selectedTier).toBe(null)
  await w.vm.handleAddNewRule(); expect(postAPI).not.toHaveBeenCalled(); expect(w.vm.newRule.name).toBe('Keep draft')
  getAPI.mockImplementation(read); await w.vm.fetchListTiers(); await flushPromises(); expect(w.vm.ruleSubmissionBlocked).toBe(false)
})

test('fresh preflight rejects a Tier whose scheme changed since candidate lookup', async () => {
  const { w } = mount(); await draft(w)
  getAPI.mockImplementation(api => Promise.resolve(api === 'listNetworks' ? networks([tier('public', 'Internal')]) : offerings([offer('Internal', 'InternalLbVm')])))
  await w.vm.handleAddNewRule(); expect(postAPI).not.toHaveBeenCalled()
  expect(w.vm.createModalVisible).toBe(true); expect(w.vm.newRule.name).toBe('Keep draft'); expect(w.vm.tiers.failed).toBe(true); expect(w.vm.loading).toBe(false)
})

test('a forged or removed Tier cannot be submitted even with complete fields', async () => {
  const { w } = mount(); await draft(w); w.vm.selectedTier = 'internal'
  await w.vm.handleAddNewRule(); expect(postAPI).not.toHaveBeenCalled()
})

test('project change discards late metadata and closes both manual and AutoScale dialogs', async () => {
  const { w, getters } = mount(); await draft(w); let finish
  getAPI.mockReturnValue(new Promise(resolve => { finish = resolve }))
  const pending = w.vm.fetchListTiers(); w.vm.addNetworkModalVisible = true
  getters.project = { id: 'other' }; await flushPromises(); finish(networks([tier()])); await pending
  expect(w.vm.tiers.data).toEqual([]); expect(w.vm.createModalVisible).toBe(false); expect(w.vm.addNetworkModalVisible).toBe(false)
})

test('project change during submit preflight sends no mutation in the new context', async () => {
  const { w, getters } = mount(); await draft(w); let finish
  getAPI.mockReturnValue(new Promise(resolve => { finish = resolve }))
  const pending = w.vm.handleAddNewRule(); getters.project = { id: 'other' }; await flushPromises(); finish(networks([tier()])); await pending
  expect(postAPI).not.toHaveBeenCalled(); expect(w.vm.loading).toBe(false)
})

test('project-switch start discards a late receipt before store getters change', async () => {
  const { w } = mount(); await draft(w); let finish
  postAPI.mockReturnValue(new Promise(resolve => { finish = resolve }))
  await w.vm.handleAddNewRule(); await flushPromises(); expect(postAPI).toHaveBeenCalledTimes(1)
  w.vm.onPublicProjectSwitch()
  finish({ createloadbalancerruleresponse: { id: 'old-rule', jobid: 'old-job' } }); await flushPromises()
  expect(w.vm.selectedRule).toBe(null); expect(w.vm.tiers.data).toEqual([]); expect(w.vm.createModalVisible).toBe(false)
  w.vm.openCreateDialog(); await w.vm.handleAddNewRule(); expect(postAPI).toHaveBeenCalledTimes(1)
})

test('Tier changes discard backend selections and ignore a late NIC response', async () => {
  const { w } = mount(); await draft(w); let finish
  getAPI.mockReturnValue(new Promise(resolve => { finish = resolve }))
  const pending = w.vm.fetchNics({ target: { checked: true } }, 'vm')
  w.vm.selectPublicTier(null); finish({ listnicsresponse: { nic: [{ networkid: 'public', ipaddress: '10.0.0.3' }] } }); await pending
  expect(w.vm.selectedBackends).toEqual({}); expect(w.vm.nicPending).toBe(0); expect(w.vm.addVmModalNicLoading).toBe(false)
})

test('AutoScale search and pagination use the eligible complete collection', async () => {
  const { w } = mount(); await draft(w)
  await w.setData({ tiers: { loading: false, ready: true, failed: false, data: [tier('Public-A'), tier('Public-B'), tier('Public-C')] }, networkPageSize: 2 })
  expect(w.vm.networkCount).toBe(3); expect(w.vm.networks.map(n => n.id)).toEqual(['Public-A', 'Public-B'])
  w.vm.handleChangeNetworkPage(2, 2); expect(w.vm.networks.map(n => n.id)).toEqual(['Public-C'])
  w.vm.onNetworkSearch('Public-B'); expect(w.vm.networkCount).toBe(1); expect(w.vm.networkPage).toBe(1)
})
