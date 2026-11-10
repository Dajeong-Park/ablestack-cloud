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
import Dialog from '@/components/network/LoadBalancerSslDialog'
import { getAPI, postAPI } from '@/api'
import eventBus from '@/config/eventBus'
jest.mock('@/api', () => ({ getAPI: jest.fn(), postAPI: jest.fn() }))
const certs = [{ id: 'a', name: 'A', fingerprint: 'public', privatekey: 'never-retain' }, { id: 'b', name: 'B' }]
let assigned, wrappers
const job = (api, status) => ({ queryasyncjobresultresponse: { jobid: 'job', cmd: api + 'Cmd', jobstatus: status, ...(status === 2 ? { jobresult: { errorcode: 530, errortext: 'Controlled failure' } } : {}) } })
beforeEach(() => {
  jest.clearAllMocks(); wrappers = []; assigned = certs[0]
  getAPI.mockImplementation(async (api, params) => api === 'listSslCerts' ? { listsslcertsresponse: { count: params.lbruleid ? assigned ? 1 : 0 : 2, sslcert: params.lbruleid ? assigned ? [assigned] : [] : certs } } : job('assignCertToLoadBalancer', 1))
  postAPI.mockImplementation(async api => ({ [api.toLowerCase() + 'response']: { jobid: 'job' } }))
})
afterEach(() => wrappers.forEach(w => w.unmount()))
async function mount (apis = ['listSslCerts', 'assignCertToLoadBalancer', 'removeCertFromLoadBalancer', 'queryAsyncJobResult'], props = {}) {
  const getters = reactive({ userInfo: { id: 'user', roleid: 'role' }, project: { id: 'project' }, apis: Object.fromEntries(apis.map(a => [a, {}])) })
  const route = reactive({ path: '/publicip/ip', query: { tab: 'loadbalancing' } })
  const w = shallowMount(Dialog, { props: { resource: { id: 'ip', projectid: 'project' }, rule: { id: 'lb' }, ...props }, global: { mocks: { $store: { getters, state: { user: { token: 'session' } } }, $route: route, $t: k => k }, stubs: { MoldDialog: { name: 'MoldDialog', props: ['size'], template: '<div><slot/><slot name="footer"/></div>' }, 'a-spin': { template: '<div><slot/></div>' }, 'a-form': { template: '<div><slot/></div>' }, 'a-form-item': { template: '<div><slot/></div>' } } } })
  wrappers.push(w); await flushPromises(); w.vm.selectedId = 'b'; return { w, getters, route }
}
test.each([
  ['read only', ['listSslCerts'], false, false],
  ['assign only', ['listSslCerts', 'assignCertToLoadBalancer', 'queryAsyncJobResult'], true, false],
  ['remove only', ['listSslCerts', 'removeCertFromLoadBalancer', 'queryAsyncJobResult'], false, true],
  ['no read', ['assignCertToLoadBalancer', 'removeCertFromLoadBalancer', 'queryAsyncJobResult'], false, false]
])('%s guards both buttons and direct handlers', async (_, apis, assign, remove) => {
  const { w } = await mount(apis); expect(w.vm.canAssign).toBe(assign); expect(w.vm.canRemove).toBe(remove)
  if (!assign) await w.vm.assign()
  if (!remove) await w.vm.remove()
  expect(postAPI).not.toHaveBeenCalled()
  expect(w.findComponent({ name: 'MoldDialog' }).props('size')).toBe('md')
})
test('project reads and writes keep explicit ownership, only public metadata remains', async () => {
  const { w } = await mount(); assigned = certs[1]; await w.vm.assign()
  expect(getAPI).toHaveBeenCalledWith('listSslCerts', expect.objectContaining({ projectid: 'project', ignoreproject: true }), { preserveOnFailure: true })
  expect(postAPI).toHaveBeenCalledWith('assignCertToLoadBalancer', expect.objectContaining({ lbruleid: 'lb', certid: 'b', projectid: 'project' }), { preserveOnFailure: true })
  expect(w.vm.currentCert.id).toBe('b'); expect(w.vm.certs[0]).not.toHaveProperty('privatekey'); expect(w.emitted('cancel')).toBeUndefined()
})
test.each(['sync', 'job'])('%s failure retains selected certificate and allows successful retry in the same dialog', async kind => {
  const { w } = await mount()
  if (kind === 'sync') postAPI.mockRejectedValueOnce({ response: { data: { errorresponse: { errorcode: 503, errortext: 'Controlled 503' } } } })
  else getAPI.mockResolvedValueOnce(job('assignCertToLoadBalancer', 2))
  await w.vm.assign(); expect(w.vm.networkMutation.status).toBe('failed'); expect(w.vm.selectedId).toBe('b'); expect(w.vm.locked).toBe(false); expect(w.emitted('cancel')).toBeUndefined()
  assigned = certs[1]; await w.vm.assign(); expect(w.vm.networkMutation.status).toBe('success'); expect(w.vm.currentCert.id).toBe('b')
})
test('remove failure restores its own permission and retries without enabling assign', async () => {
  const { w } = await mount(['listSslCerts', 'removeCertFromLoadBalancer', 'queryAsyncJobResult'])
  getAPI.mockResolvedValueOnce(job('removeCertFromLoadBalancer', 2)); await w.vm.remove()
  expect(w.vm.networkMutation.status).toBe('failed'); expect(w.vm.canAssign).toBe(false); expect(w.vm.canRemove).toBe(true)
  assigned = null; getAPI.mockImplementation(async (api, params) => api === 'queryAsyncJobResult' ? job('removeCertFromLoadBalancer', 1) : { listsslcertsresponse: { count: params.lbruleid ? 0 : 2, sslcert: params.lbruleid ? [] : certs } })
  await w.vm.remove(); expect(w.vm.currentCert).toBeNull(); expect(w.vm.networkMutation.status).toBe('success')
})
test('transport uncertainty blocks a duplicate; pending receipt can be rechecked', async () => {
  const { w } = await mount(); postAPI.mockRejectedValueOnce(new Error('Lost response')); await w.vm.assign(); expect(w.vm.networkMutation.status).toBe('unknown'); await w.vm.assign(); expect(postAPI).toHaveBeenCalledTimes(1)
})
test('pending mutation suppresses double submit and closing', async () => {
  const { w } = await mount(); let finish
  postAPI.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const pending = w.vm.assign(); await flushPromises(); await w.vm.assign(); w.vm.close(); expect(postAPI).toHaveBeenCalledTimes(1); expect(w.emitted('cancel')).toBeUndefined()
  finish({ assigncerttoloadbalancerresponse: { jobid: 'job' } }); await pending
})
test.each(['project', 'role', 'navigation'])('%s invalidates drafts and discards late results', async field => {
  const { w, getters, route } = await mount(); let finish
  getAPI.mockImplementationOnce(() => new Promise(resolve => { finish = resolve })); const pending = w.vm.refresh(); await flushPromises()
  if (field === 'project') getters.project.id = 'other'
  if (field === 'role') delete getters.apis.assignCertToLoadBalancer
  if (field === 'navigation') route.query.tab = 'vpn'
  await flushPromises(); finish({ listsslcertsresponse: { count: 2, sslcert: certs } }); await pending
  expect(w.vm.certs).toEqual([]); expect(w.vm.selectedId).toBeUndefined(); expect(w.emitted('cancel')).toBeTruthy(); await w.vm.assign(); expect(postAPI).not.toHaveBeenCalled()
})
test('project transition start clears before new metadata arrives', async () => {
  const { w } = await mount(); eventBus.emit('project-switch-start'); expect(w.vm.selectedId).toBeUndefined(); expect(w.vm.currentCert).toBeNull(); expect(w.vm.canRead).toBe(false)
})
test('read failure preserves draft, disables mutation and can refresh in place', async () => {
  const { w } = await mount(); getAPI.mockRejectedValueOnce(new Error('read unavailable')); await w.vm.refresh(); expect(w.vm.readFailed).toBe(true); await w.vm.assign(); expect(postAPI).not.toHaveBeenCalled(); expect(w.vm.selectedId).toBe('b'); await w.vm.refresh(); expect(w.vm.readFailed).toBe(false)
})
test('create-rule picker selects without sending a mutation', async () => {
  const { w } = await mount(undefined, { rule: null }); await w.vm.assign(); expect(w.emitted('select')[0][0]).toEqual({ id: 'b', name: 'B', fingerprint: undefined }); expect(postAPI).not.toHaveBeenCalled(); expect(w.emitted('cancel')).toBeTruthy()
})
