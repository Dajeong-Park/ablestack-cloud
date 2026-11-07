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
import { reactive } from 'vue'
import LoadBalancing from '@/views/network/LoadBalancing'
import { networkMutationMixin } from '@/utils/networkMutation'
import { getAPI, postAPI } from '@/api'
jest.mock('@/api', () => ({ getAPI: jest.fn(), postAPI: jest.fn() }))

const row = { id: 'rule', name: 'QA LB', algorithm: 'roundrobin', protocol: null, cidrlist: '192.0.2.0/24', backendssl: false }
const methods = Object.fromEntries(['openEditRuleModal', 'handleSubmitEditForm', 'closeModal'].map(key => [key, LoadBalancing.methods[key]]))
const component = {
  mixins: [networkMutationMixin],
  props: ['resource'],
  data: () => ({ selectedRule: null, newRule: {}, editRuleDetails: { name: '', algorithm: '', protocol: '', cidrlist: '', backendssl: false }, editRuleModalVisible: false, editRuleModalLoading: false, contextLoading: false, listRefreshFailed: false, lbProvider: 'VirtualRouter' }),
  methods: { ...methods, isProtectedRule: () => false, refreshRules: jest.fn() },
  watch: { networkMutationScope: LoadBalancing.watch.networkMutationScope },
  template: '<div />'
}
const job = status => ({ queryasyncjobresultresponse: { jobid: 'job', jobinstanceid: 'rule', cmd: 'org.apache.cloudstack.api.command.user.loadbalancer.UpdateLoadBalancerRuleCmd', jobstatus: status, ...(status === 2 ? { jobresultcode: 530, jobresult: { errorcode: 530, errortext: 'Provider rejected update' } } : {}) } })
let wrappers
beforeEach(() => {
  jest.clearAllMocks(); wrappers = []
  getAPI.mockImplementation(async api => api === 'listNetworks' ? { listnetworksresponse: { network: [{ id: 'net', state: 'Implemented' }], count: 1 } } : api === 'listAsyncJobs' ? { listasyncjobsresponse: { count: 0 } } : job(1))
  postAPI.mockResolvedValue({ updateloadbalancerruleresponse: { jobid: 'job', id: 'rule' } })
})
afterEach(() => wrappers.forEach(w => w.unmount()))
function mount () {
  const getters = reactive({ project: { id: 'project' }, userInfo: { id: 'owner' }, apis: { updateLoadBalancerRule: {}, queryAsyncJobResult: {}, listNetworks: {}, listAsyncJobs: {} } })
  const w = shallowMount(component, { props: { resource: { id: 'ip', associatednetworkid: 'net', projectid: 'project' } }, global: { mocks: { $store: { getters, state: { user: { token: 'session' } } }, $route: reactive({ path: '/publicip/ip', meta: { name: 'publicip' } }), $t: k => k } } })
  wrappers.push(w); w.vm.refreshRules = jest.fn(); w.vm.openEditRuleModal({ ...row }); return { w, getters }
}

test.each([null, '', '   '])('legacy protocol %s opens as TCP', protocol => {
  const { w } = mount(); w.vm.openEditRuleModal({ ...row, protocol, backendssl: true })
  expect(w.vm.editRuleDetails.protocol).toBe('tcp')
  expect(w.vm.editRuleDetails.backendssl).toBe(false)
})
test.each(['tcp', 'http', 'ssl'])('explicit %s protocol is preserved', protocol => {
  const { w } = mount(); w.vm.openEditRuleModal({ ...row, protocol: ' ' + protocol.toUpperCase() + ' ', backendssl: true })
  expect(w.vm.editRuleDetails.protocol).toBe(protocol)
  expect(w.vm.editRuleDetails.backendssl).toBe(protocol === 'ssl')
})
test('success closes only after a verified job and binds the current project', async () => {
  const { w } = mount(); await w.vm.handleSubmitEditForm()
  expect(postAPI).toHaveBeenCalledWith('updateLoadBalancerRule', expect.objectContaining({ id: 'rule', protocol: 'tcp', cidrlist: '192.0.2.0/24', backendssl: false, projectid: 'project', ignoreproject: true }), { preserveOnFailure: true })
  expect(w.vm.editRuleModalVisible).toBe(false)
  expect(w.vm.refreshRules).toHaveBeenCalledTimes(1)
})
test('validation rejection preserves input and permits a corrected retry', async () => {
  const { w } = mount(); w.vm.editRuleDetails.cidrlist = 'invalid/99'
  postAPI.mockRejectedValueOnce({ response: { data: { errorresponse: { errorcode: 431, errortext: 'Invalid source CIDR' } } } })
  await w.vm.handleSubmitEditForm()
  expect(w.vm.editRuleModalVisible).toBe(true)
  expect(w.vm.editRuleDetails.cidrlist).toBe('invalid/99')
  expect(w.vm.editRuleModalLoading).toBe(false)
  expect(w.vm.networkMutation.status).toBe('failed')
  w.vm.editRuleDetails.cidrlist = '192.0.2.1/32'; await w.vm.handleSubmitEditForm()
  expect(postAPI).toHaveBeenCalledTimes(2)
  expect(w.vm.editRuleModalVisible).toBe(false)
})
test('failed async job preserves protocol, draft and dialog', async () => {
  const { w } = mount(); w.vm.editRuleDetails.name = 'Keep this name'
  getAPI.mockImplementation(async api => api === 'queryAsyncJobResult' ? job(2) : api === 'listNetworks' ? { listnetworksresponse: { network: [{ id: 'net', state: 'Implemented' }], count: 1 } } : { listasyncjobsresponse: { count: 0 } })
  await w.vm.handleSubmitEditForm()
  expect(w.vm.editRuleModalVisible).toBe(true)
  expect(w.vm.editRuleDetails.name).toBe('Keep this name')
  expect(w.vm.networkMutation.error).toBe('Provider rejected update')
  expect(w.vm.networkMutation.code).toBe(530)
  expect(w.vm.refreshRules).not.toHaveBeenCalled()
})
test('pending update suppresses duplicate submissions and closing', async () => {
  const { w } = mount(); let finish
  postAPI.mockReturnValue(new Promise(resolve => { finish = resolve }))
  const work = w.vm.handleSubmitEditForm(); await flushPromises()
  await w.vm.handleSubmitEditForm(); w.vm.closeModal()
  expect(postAPI).toHaveBeenCalledTimes(1)
  expect(w.vm.editRuleModalVisible).toBe(true)
  finish({ updateloadbalancerruleresponse: { jobid: 'job', id: 'rule' } }); await work
})
test('project switch closes old draft and suppresses late update callbacks', async () => {
  const { w, getters } = mount(); let finish
  postAPI.mockReturnValue(new Promise(resolve => { finish = resolve }))
  const work = w.vm.handleSubmitEditForm(); await flushPromises()
  getters.project = { id: 'other-project' }; await flushPromises()
  expect(w.vm.editRuleModalVisible).toBe(false)
  w.vm.selectedRule = { id: 'other' }; w.vm.editRuleDetails.name = 'Other project'; w.vm.editRuleModalVisible = true
  finish({ updateloadbalancerruleresponse: { jobid: 'job', id: 'rule' } }); await work
  expect(w.vm.editRuleDetails.name).toBe('Other project')
  expect(w.vm.editRuleModalVisible).toBe(true)
  expect(w.vm.refreshRules).not.toHaveBeenCalled()
})
test('unknown receipt reopens the same draft and cannot resubmit', async () => {
  const { w } = mount(); w.vm.editRuleDetails.name = 'Pending draft'
  w.vm.networkMutation = { api: 'updateLoadBalancerRule', params: { id: 'rule' }, status: 'unknown', jobId: 'job', scope: w.vm.networkMutationScope, version: w.vm.networkMutationVersion }
  w.vm.closeModal(); w.vm.openEditRuleModal({ ...row })
  expect(w.vm.editRuleDetails.name).toBe('Pending draft')
  expect(w.vm.editRuleModalVisible).toBe(true)
  await w.vm.handleSubmitEditForm(); expect(postAPI).not.toHaveBeenCalled()
})
test('role permission and managed rule checks prevent a write', async () => {
  const { w, getters } = mount(); delete getters.apis.updateLoadBalancerRule
  await w.vm.handleSubmitEditForm(); expect(postAPI).not.toHaveBeenCalled()
  expect(w.vm.editRuleModalVisible).toBe(false)
  w.vm.isProtectedRule = () => true; await w.vm.handleSubmitEditForm(); expect(postAPI).not.toHaveBeenCalled()
})
test('Netris name-only edit does not impose VirtualRouter protocol settings', async () => {
  const { w } = mount(); w.vm.lbProvider = 'Netris'; w.vm.openEditRuleModal({ ...row })
  await w.vm.handleSubmitEditForm()
  expect(postAPI.mock.calls[0][1]).toEqual({ id: 'rule', name: 'QA LB', projectid: 'project', ignoreproject: true })
})
