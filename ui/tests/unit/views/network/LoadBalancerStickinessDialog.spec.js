// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements.  See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership.  The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License.  You may obtain a copy of the License at
//
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.

import { shallowMount, flushPromises } from '@vue/test-utils'
import { reactive } from 'vue'
import Dialog from '@/components/network/LoadBalancerStickinessDialog'
import LoadBalancing from '@/views/network/LoadBalancing'
import eventBus from '@/config/eventBus'
import { getAPI, postAPI } from '@/api'

jest.mock('@/api', () => ({ getAPI: jest.fn(), postAPI: jest.fn() }))
const apis = ['createLBStickinessPolicy', 'deleteLBStickinessPolicy', 'listLBStickinessPolicies', 'listLoadBalancerRules', 'listNetworks', 'queryAsyncJobResult', 'listAsyncJobs']
const rule = { id: 'lb', name: 'target-lb', publicipid: 'ip', networkid: 'net' }
const policy = { id: 'old-policy', name: 'old-name', methodname: 'AppCookie', params: { 'cookie-name': 'SESSION', length: '32', holdtime: '3h', 'request-learn': 'false' } }
const capability = { name: 'SupportedStickinessMethods', value: JSON.stringify([{ methodname: 'AppCookie', paramlist: ['cookie-name', 'length', 'holdtime', 'request-learn'].map(paramname => ({ paramname })) }]) }
const formStub = { name: 'AForm', methods: { validate: jest.fn().mockResolvedValue({}), scrollToField: jest.fn() }, template: '<form><slot/></form>' }
const dialogStub = { props: ['visible'], template: '<section><slot name="title"/><slot/></section>' }
let wrappers, currentPolicy

function job (status = 1, extra = {}) {
  const [api, params] = postAPI.mock.calls.at(-1) || ['createLBStickinessPolicy', { lbruleid: 'lb', name: 'draft-name', methodname: 'AppCookie' }]
  return {
    queryasyncjobresultresponse: {
      jobid: 'job',
      jobinstancetype: 'None',
      cmd: 'org.apache.cloudstack.api.command.user.loadbalancer.' + api[0].toUpperCase() + api.slice(1) + 'Cmd',
      jobstatus: status,
      ...(status === 1 ? { jobresult: api === 'deleteLBStickinessPolicy' ? { success: true } : { stickinesspolicies: { lbruleid: params.lbruleid, stickinesspolicy: [{ id: 'new-policy', name: params.name, methodname: params.methodname }] } } } : status === 2 ? { jobresult: { errorcode: 530, errortext: 'Controlled router failure' } } : {}),
      ...extra
    }
  }
}
function reads (api) {
  if (api === 'listNetworks') return { listnetworksresponse: { count: 1, network: [{ id: 'net', state: 'Implemented', service: [{ name: 'Lb', provider: [{ name: 'VirtualRouter' }], capability: [capability] }] }] } }
  if (api === 'listLoadBalancerRules') return { listloadbalancerrulesresponse: { count: 1, loadbalancerrule: [rule] } }
  if (api === 'listLBStickinessPolicies') return { listlbstickinesspoliciesresponse: { stickinesspolicies: currentPolicy ? [{ lbruleid: 'lb', stickinesspolicy: Array.isArray(currentPolicy) ? currentPolicy : [currentPolicy] }] : [] } }
  if (api === 'listAsyncJobs') return { listasyncjobsresponse: { count: 0, asyncjobs: [] } }
  return job()
}
async function mount (allowed = apis) {
  const getters = reactive({ project: { id: 'project' }, userInfo: { id: 'user', roleid: 'role' }, apis: Object.fromEntries(allowed.map(api => [api, {}])) })
  const route = reactive({ path: '/publicip/ip', query: { tab: 'loadbalancing' }, meta: { name: 'publicip' } })
  const w = shallowMount(Dialog, {
    props: { resource: { id: 'ip', associatednetworkid: 'net', projectid: 'project' }, rule },
    global: {
      mocks: { $store: { getters, state: { user: { token: 'session' } } }, $route: route, $t: k => k, $getApiParams: () => ({}), $config: { docBase: '' }, $notification: { success: jest.fn() } },
      stubs: { MoldDialog: dialogStub, MoldDialogActions: { template: '<footer><slot/></footer>' }, AForm: formStub, AAlert: { template: '<aside><slot name="description"/></aside>' } }
    }
  })
  wrappers.push(w); await flushPromises(); return { w, getters, route }
}
beforeEach(() => {
  wrappers = []; currentPolicy = { ...policy }; jest.clearAllMocks(); formStub.methods.validate.mockResolvedValue({})
  getAPI.mockImplementation(async api => reads(api))
  postAPI.mockImplementation(async api => api === 'createLBStickinessPolicy' ? { createLBStickinessPolicy: { id: 'new-policy', jobid: 'job' } } : { deleteLBstickinessrruleresponse: { jobid: 'job' } })
})
afterEach(() => { wrappers.forEach(w => w.unmount()); jest.useRealTimers() })

test('loads the exact rule, project and provider and restores false request learning', async () => {
  const { w } = await mount()
  expect(w.vm.form).toMatchObject({ name: 'old-name', methodname: 'AppCookie', holdtime: '3h', requestLearn: false })
  for (const api of ['listLoadBalancerRules', 'listNetworks', 'listLBStickinessPolicies']) expect(getAPI).toHaveBeenCalledWith(api, expect.objectContaining({ projectid: 'project', ignoreproject: true }), { preserveOnFailure: true })
  expect(w.vm.canSubmit).toBe(true)
})

test.each(['SourceBased', 'LbCookie', 'AppCookie'])('%s closes only on a verified real-format job1 and scopes its POST', async method => {
  const { w } = await mount(); w.vm.handleStickinessMethodSelectChange(method); w.vm.form.name = 'draft-name'
  expect(await w.vm.handleSubmitStickinessForm()).toBe(true)
  expect(w.emitted('cancel')).toHaveLength(1); expect(w.emitted('refresh')).toHaveLength(1)
  expect(postAPI).toHaveBeenCalledTimes(1); expect(postAPI.mock.calls[0]).toEqual(['createLBStickinessPolicy', expect.objectContaining({ lbruleid: 'lb', methodname: method, projectid: 'project', ignoreproject: true }), { preserveOnFailure: true }])
})

test('pending acceptance prevents double click, Ctrl+Enter, field changes and close', async () => {
  let finish; const { w } = await mount(); getAPI.mockImplementation(async api => api === 'queryAsyncJobResult' ? new Promise(resolve => { finish = resolve }) : reads(api))
  const pending = w.vm.handleSubmitStickinessForm(); await flushPromises()
  expect(w.vm.networkMutation.status).toBe('running'); expect(w.vm.locked).toBe(true)
  expect(await w.vm.handleSubmitStickinessForm()).toBe(false); expect(w.vm.close()).toBe(false)
  w.vm.handleStickinessMethodSelectChange('LbCookie'); expect(w.vm.form.methodname).toBe('AppCookie')
  expect(postAPI).toHaveBeenCalledTimes(1); expect(w.emitted('cancel')).toBeUndefined()
  finish(job()); await pending; expect(w.emitted('cancel')).toHaveLength(1)
})

test.each([431, 503, 'job2'])('%s preserves the complete draft and permits a corrected retry', async error => {
  const { w } = await mount(); w.vm.form.name = 'preserved'; const draft = { ...w.vm.form }
  if (error === 'job2') getAPI.mockImplementation(async api => api === 'queryAsyncJobResult' ? job(2) : reads(api))
  else postAPI.mockRejectedValueOnce({ response: { data: { errorresponse: { errorcode: error, errortext: 'Controlled failure' } } } })
  expect(await w.vm.handleSubmitStickinessForm()).toBe(false)
  expect(w.vm.form).toEqual(draft); expect(w.vm.networkMutation.status).toBe('failed'); expect(w.emitted('cancel')).toBeUndefined(); expect(w.vm.canSubmit).toBe(true)
  getAPI.mockImplementation(async api => reads(api)); expect(await w.vm.handleSubmitStickinessForm()).toBe(true)
  expect(postAPI).toHaveBeenCalledTimes(2)
})

test('query failure and hidden reopen recheck the identical job without another POST', async () => {
  jest.useFakeTimers(); const { w } = await mount(); const draft = { ...w.vm.form }
  getAPI.mockImplementation(async api => { if (api === 'queryAsyncJobResult') throw new Error('Lost query'); return reads(api) })
  const pending = w.vm.handleSubmitStickinessForm(); await flushPromises()
  for (let i = 0; i < 3; i++) { jest.advanceTimersByTime(2000); await flushPromises() }
  await pending; expect(w.vm.networkMutation.status).toBe('unknown'); expect(w.vm.form).toEqual(draft)
  expect(w.vm.close()).toBe(true); await w.setProps({ visible: false }); await w.setProps({ visible: true })
  expect(await w.vm.handleSubmitStickinessForm()).toBe(false); expect(w.vm.form).toEqual(draft)
  getAPI.mockImplementation(async api => reads(api)); expect(await w.vm.recheck()).toBe(true)
  expect(postAPI).toHaveBeenCalledTimes(1); expect(getAPI.mock.calls.filter(c => c[0] === 'queryAsyncJobResult').every(c => c[1].jobid === 'job')).toBe(true)
})

test.each(['missing', 'transport'])('ambiguous %s receipt preserves input and never re-dispatches', async type => {
  const { w } = await mount()
  if (type === 'missing') postAPI.mockResolvedValue({})
  else postAPI.mockRejectedValue(new Error('Response lost'))
  await w.vm.handleSubmitStickinessForm(); expect(w.vm.networkMutation.status).toBe('unknown')
  await w.vm.handleSubmitStickinessForm(); await w.vm.recheck(); expect(postAPI).toHaveBeenCalledTimes(1); expect(w.emitted('refresh')).toBeUndefined()
})

test.each(['project', 'tab', 'role', 'user', 'resource', 'rule', 'event', 'unmount'])('late job1 after %s change cannot close, refresh or notify the next context', async change => {
  let finish; const { w, getters, route } = await mount(); getAPI.mockImplementation(async api => api === 'queryAsyncJobResult' ? new Promise(resolve => { finish = resolve }) : reads(api))
  const pending = w.vm.handleSubmitStickinessForm(); await flushPromises()
  if (change === 'project') getters.project = { id: 'elsewhere' }
  if (change === 'tab') route.query.tab = 'details'
  if (change === 'role') delete getters.apis.createLBStickinessPolicy
  if (change === 'user') getters.userInfo.id = 'other'
  if (change === 'resource') await w.setProps({ resource: { id: 'elsewhere' } })
  if (change === 'rule') await w.setProps({ rule: { ...rule, id: 'elsewhere' } })
  if (change === 'event') eventBus.emit('project-switch-start')
  if (change === 'unmount') w.unmount()
  await flushPromises(); finish(job()); await pending
  expect(w.emitted('cancel')).toBeUndefined(); expect(w.emitted('refresh')).toBeUndefined(); expect(w.vm.$notification.success).not.toHaveBeenCalled()
})

test('creation and deletion permissions are independent, including handler guards', async () => {
  const { w } = await mount(apis.filter(api => api !== 'createLBStickinessPolicy'))
  w.vm.form.methodname = 'AppCookie'; expect(await w.vm.handleSubmitStickinessForm()).toBe(false)
  w.vm.form.methodname = 'none'; expect(await w.vm.handleSubmitStickinessForm()).toBe(true)
  expect(postAPI.mock.calls[0][0]).toBe('deleteLBStickinessPolicy'); expect(postAPI.mock.calls[0][1]).toMatchObject({ id: 'old-policy', projectid: 'project' })
  const next = await mount(apis.filter(api => api !== 'deleteLBStickinessPolicy'))
  next.w.vm.form.methodname = 'none'; expect(await next.w.vm.handleSubmitStickinessForm()).toBe(false)
  next.w.vm.form.methodname = 'SourceBased'; expect(await next.w.vm.handleSubmitStickinessForm()).toBe(true)
  expect(postAPI.mock.calls[1][0]).toBe('createLBStickinessPolicy')
})

test('a successful deletion uses the existing misspelled receipt and boolean result', async () => {
  const { w } = await mount(); w.vm.form.methodname = 'none'
  expect(await w.vm.handleSubmitStickinessForm()).toBe(true); expect(w.emitted('cancel')).toHaveLength(1)
})

test.each(['jobid', 'command', 'rule', 'policy'])('a mismatched %s result stays unknown and never claims success', async mismatch => {
  jest.useFakeTimers(); const { w } = await mount()
  getAPI.mockImplementation(async api => {
    if (api !== 'queryAsyncJobResult') return reads(api)
    const r = job(); const j = r.queryasyncjobresultresponse
    if (mismatch === 'jobid') j.jobid = 'different'
    if (mismatch === 'command') j.cmd = 'DeleteNetworkCmd'
    if (mismatch === 'rule') j.jobresult.stickinesspolicies.lbruleid = 'different'
    if (mismatch === 'policy') j.jobresult.stickinesspolicies.stickinesspolicy[0].id = 'different'
    return r
  })
  const pending = w.vm.handleSubmitStickinessForm(); await flushPromises()
  for (let i = 0; i < 3; i++) { jest.advanceTimersByTime(2000); await flushPromises() }
  await pending; expect(w.vm.networkMutation.status).toBe('unknown'); expect(w.emitted('cancel')).toBeUndefined(); expect(postAPI).toHaveBeenCalledTimes(1)
})

test('a changed current policy requires a fresh context and keeps the draft', async () => {
  const { w } = await mount(); w.vm.form.name = 'draft'; currentPolicy = { ...policy, id: 'other-policy' }
  expect(await w.vm.handleSubmitStickinessForm()).toBe(false); expect(postAPI).not.toHaveBeenCalled(); expect(w.vm.form.name).toBe('draft')
  await w.find('aside a-button-stub').trigger('click'); await flushPromises()
  expect(w.vm.form.name).toBe('draft'); expect(await w.vm.handleSubmitStickinessForm()).toBe(true)
})

test('the parent cannot discard an unresolved operation to open another rule', () => {
  const vm = { lbRules: [{ id: 'other' }], canConfigureStickiness: () => true, $refs: { stickinessDialog: { networkMutationBlocked: true } }, stickinessRule: rule, $notification: { warning: jest.fn() }, $t: k => k }
  LoadBalancing.methods.openStickinessModal.call(vm, 'other'); expect(vm.stickinessRule).toBe(rule); expect(vm.$notification.warning).toHaveBeenCalled()
})

test('the validation await also prevents a second dispatch', async () => {
  const { w } = await mount(); let finish
  formStub.methods.validate.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const pending = w.vm.handleSubmitStickinessForm(); await flushPromises()
  expect(w.vm.busy).toBe(true); expect(await w.vm.handleSubmitStickinessForm()).toBe(false); expect(w.vm.close()).toBe(false)
  expect(postAPI).not.toHaveBeenCalled(); finish({}); await pending; expect(postAPI).toHaveBeenCalledTimes(1)
})

test('a failed deletion preserves the selected policy and none draft for retry', async () => {
  const { w } = await mount(); w.vm.form.methodname = 'none'
  getAPI.mockImplementation(async api => api === 'queryAsyncJobResult' ? job(2) : reads(api))
  expect(await w.vm.handleSubmitStickinessForm()).toBe(false); expect(w.vm.selectedStickinessPolicy.id).toBe('old-policy'); expect(w.vm.form.methodname).toBe('none')
  expect(w.emitted('cancel')).toBeUndefined()
})

test('a rule outside the displayed public IP cannot enable any submission', async () => {
  getAPI.mockImplementation(async api => api === 'listLoadBalancerRules' ? { listloadbalancerrulesresponse: { loadbalancerrule: [{ ...rule, publicipid: 'other-ip' }] } } : reads(api))
  const { w } = await mount(); expect(w.vm.stickinessLookupError).toBe(true); expect(w.vm.canSubmit).toBe(false)
  expect(await w.vm.handleSubmitStickinessForm()).toBe(false); expect(postAPI).not.toHaveBeenCalled()
})

test('revoked history returned after a real failure cannot mask the current policy', async () => {
  currentPolicy = [{ ...policy, id: 'history', state: 'Revoked', methodname: 'LbCookie' }, { ...policy, id: 'current' }]
  const { w } = await mount(); expect(w.vm.selectedStickinessPolicy.id).toBe('current'); expect(w.vm.canSubmit).toBe(true)
  expect(LoadBalancing.methods.returnStickinessLabel.call({ stickinessPolicies: [{ lbruleid: 'lb', stickinesspolicy: currentPolicy }] }, 'lb')).toBe('AppCookie')
  expect(await w.vm.handleSubmitStickinessForm()).toBe(true)
})

test('an entirely revoked history is not offered as a deletion target', async () => {
  currentPolicy = [{ ...policy, state: 'Revoked' }]
  const { w } = await mount(); expect(w.vm.selectedStickinessPolicy).toBeNull(); w.vm.form.methodname = 'none'
  expect(w.vm.canSubmit).toBe(false); expect(await w.vm.handleSubmitStickinessForm()).toBe(false); expect(postAPI).not.toHaveBeenCalled()
})

test('multiple current policies remain fail closed instead of choosing an arbitrary target', async () => {
  currentPolicy = [policy, { ...policy, id: 'other' }]
  const { w } = await mount(); expect(w.vm.stickinessLookupError).toBe(true); expect(w.vm.canSubmit).toBe(false)
  expect(await w.vm.handleSubmitStickinessForm()).toBe(false); expect(postAPI).not.toHaveBeenCalled()
})
