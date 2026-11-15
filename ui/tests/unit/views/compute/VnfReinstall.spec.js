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

import { flushPromises, mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import Reinstall from '@/views/compute/VnfReinstall'
import { vnfReinstallJobs } from '@/utils/vnfReinstall'
import { getAPI, postAPI } from '@/api'
jest.mock('@/api', () => ({ getAPI: jest.fn(), postAPI: jest.fn() }))
const clone = v => JSON.parse(JSON.stringify(v))
const base = { id: 'vm', name: 'host', displayname: '<b>VNF</b>', templateid: 'a', templatetype: 'VNF', state: 'Stopped', zoneid: 'zone', hypervisor: 'KVM', arch: 'x86_64', account: 'owner', domainid: 'domain', nic: [0, 1].map(n => ({ id: 'nic' + n, deviceid: n, networkid: 'net' + n, isdefault: n === 0, macaddress: 'mac' + n, ipaddress: '10.0.0.' + (n + 2) })) }
const templates = ['a', 'b'].map(id => ({ id, name: id, templatetype: 'VNF', format: 'QCOW2', isready: true, zoneid: 'zone', hypervisor: 'KVM', arch: 'x86_64', passwordenabled: false, vnfnics: [0, 1].map(n => ({ deviceid: n, required: true, management: n === 0 })) }))
const apis = Object.fromEntries(['restoreVirtualMachine', 'listVirtualMachines', 'listVnfTemplates', 'listVolumes', 'listAsyncJobs', 'queryAsyncJobResult'].map(k => [k, {}]))
const deferred = () => { let done; let failed; const promise = new Promise((resolve, reject) => { done = resolve; failed = reject }); return { promise, resolve: done, reject: failed } }
let serverVm, serverTemplates, jobs, jobResult
function dispatch (cmd, p) {
  if (cmd === 'listVirtualMachines') return Promise.resolve({ listvirtualmachinesresponse: { count: 1, virtualmachine: [clone(serverVm)] } })
  if (cmd === 'listVnfTemplates') { const t = serverTemplates.filter(t => !p.id || t.id === p.id); return Promise.resolve({ listtemplatesresponse: { count: t.length, template: clone(t) } }) }
  if (cmd === 'listVolumes') return Promise.resolve({ listvolumesresponse: { count: 1, volume: [{ id: 'root', templateid: serverVm.templateid, state: 'Ready' }] } })
  if (cmd === 'listAsyncJobs') return Promise.resolve({ listasyncjobsresponse: { count: jobs.length, asyncjobs: clone(jobs) } })
  if (cmd === 'queryAsyncJobResult') return Promise.resolve({ queryasyncjobresultresponse: clone(jobResult) })
  throw new Error('unexpected read ' + cmd)
}
async function context () {
  const c = {
    resource: clone(base),
    action: { currentAction: { vnfReinstallCurrent: () => c.parentOpen } },
    parentOpen: true,
    $route: { fullPath: '/vnfapp/vm' },
    $store: { state: { user: { token: 'session' } }, getters: { apis: { ...apis }, userInfo: { id: 'actor', account: 'owner' }, project: {} } },
    $t: k => k,
    $emit: jest.fn(),
    resourceActionReady: () => true
  }
  Object.assign(c, Reinstall.data.call(c))
  Object.entries(Reinstall.methods).forEach(([k, v]) => { c[k] = v.bind(c) })
  Object.entries(Reinstall.computed).forEach(([k, v]) => Object.defineProperty(c, k, { get: () => v.call(c) }))
  c.origin = c.context; await c.load(); c.acknowledged = true; return c
}
beforeEach(() => { jest.useFakeTimers(); vnfReinstallJobs.clear(); serverVm = clone(base); serverTemplates = clone(templates); jobs = []; jobResult = { jobstatus: 0 }; getAPI.mockReset().mockImplementation(dispatch); postAPI.mockReset().mockResolvedValue({ restorevmresponse: { jobid: 'job' } }) })
afterEach(() => { jest.clearAllTimers(); jest.useRealTimers() })
test.each(['original', 'other'])('%s workflow does not announce success at receipt and sends the exact payload', async mode => {
  const c = await context(); c.mode = mode; c.selectedId = 'b'; await c.submit(); await flushPromises()
  expect(postAPI.mock.calls[0][1]).toEqual({ virtualmachineid: 'vm', ...(mode === 'other' ? { templateid: 'b' } : {}) }); expect(c.succeeded).toBe(false); expect(c.operation.jobid).toBe('job'); expect(c.$emit).not.toHaveBeenCalled()
})
test('acknowledgement and preflight prevent repeated submits', async () => {
  const c = await context(); c.acknowledged = false; await c.submit(); expect(postAPI).not.toHaveBeenCalled(); c.acknowledged = true
  const pending = deferred(); getAPI.mockImplementation((cmd, p) => cmd === 'listVirtualMachines' ? pending.promise : dispatch(cmd, p))
  const first = c.submit(); await c.submit(); pending.resolve({ listvirtualmachinesresponse: { virtualmachine: [clone(base)] } }); await first; expect(postAPI).toHaveBeenCalledTimes(1)
})
test.each(['route', 'target', 'project', 'token', 'actor', 'permission', 'parent-close'])('a %s change during preflight cannot POST or affect a new context', async change => {
  const c = await context(); const d = deferred(); getAPI.mockImplementation((cmd, p) => cmd === 'listVirtualMachines' ? d.promise : dispatch(cmd, p)); const first = c.submit()
  if (change === 'route') c.$route.fullPath = '/vnfapp/other'
  if (change === 'target') c.resource.id = 'other'
  if (change === 'project') c.$store.getters.project = { id: 'other' }
  if (change === 'token') c.$store.state.user.token = 'other'
  if (change === 'actor') c.$store.getters.userInfo.id = 'other'
  if (change === 'permission') c.$store.getters.apis = {}
  if (change === 'parent-close') c.parentOpen = false
  d.resolve({ listvirtualmachinesresponse: { virtualmachine: [clone(base)] } }); await first
  expect(postAPI).not.toHaveBeenCalled(); expect(c.$emit).not.toHaveBeenCalled(); expect(vnfReinstallJobs.size).toBe(0)
})
test.each(['nic', 'template', 'state'])('fresh %s changes block POST and keep the selected input', async change => {
  const c = await context(); c.mode = 'other'; c.selectedId = 'b'
  if (change === 'nic') serverVm.nic[0].ipaddress = '10.0.0.100'
  if (change === 'template') serverVm.templateid = 'changed'
  if (change === 'state') serverVm.state = 'Running'
  await c.submit(); expect(postAPI).not.toHaveBeenCalled(); expect(c.selectedId).toBe('b'); expect(c.error).toBe('message.vnf.reinstall.changed')
})
test('incompatible and unavailable template rechecks cannot POST', async () => {
  const c = await context(); c.mode = 'other'; c.selectedId = 'b'; serverTemplates[1].vnfnics.push({ deviceid: 2, required: true }); await c.submit(); expect(postAPI).not.toHaveBeenCalled(); expect(c.error).toBe('message.vnf.reinstall.nic.missing')
  serverTemplates = []; await c.submit(); expect(postAPI).not.toHaveBeenCalled(); expect(c.error).toBe('message.vnf.reinstall.template.unavailable')
})
test('a removed/inaccessible original blocks original mode but a compatible alternative remains selectable', async () => {
  serverTemplates = serverTemplates.filter(t => t.id === 'b'); const c = await context(); expect(c.canSubmit).toBe(false); c.mode = 'other'; c.selectedId = 'b'; expect(c.canSubmit).toBe(true)
})
test('lookup failure keeps the input and permits a new read', async () => {
  const c = await context(); c.mode = 'other'; c.selectedId = 'b'; getAPI.mockRejectedValue(new Error('network')); await c.load(); expect(c.ready).toBe(false); expect(c.selectedId).toBe('b'); expect(c.canSubmit).toBe(false)
  getAPI.mockImplementation(dispatch); await c.load(); expect(c.ready).toBe(true); expect(c.selectedId).toBe('b')
})
test('synchronous HTTP refusal retains input and allows one deliberate retry', async () => {
  const c = await context(); c.mode = 'other'; c.selectedId = 'b'; postAPI.mockRejectedValueOnce({ response: { status: 431, data: { errorresponse: { errorcode: 431, errortext: 'rejected' } } } }); await c.submit(); expect(c.operation).toBeNull(); expect(c.selectedId).toBe('b'); expect(c.error).toBe('rejected'); expect(c.canSubmit).toBe(true)
  await c.submit(); expect(postAPI).toHaveBeenCalledTimes(2)
})
test('ambiguous POST failure never retries; exact resource job reconciliation can recover its job id', async () => {
  const c = await context(); postAPI.mockRejectedValueOnce(new Error('timeout')); await c.submit(); expect(c.operation.phase).toBe('unknown'); await c.submit(); expect(postAPI).toHaveBeenCalledTimes(1)
  await c.recheck(); expect(c.operation.phase).toBe('unknown'); jobs = [{ jobid: 'recovered', cmd: 'org.apache.cloudstack.api.command.user.vm.RestoreVMCmd', jobstatus: 0 }]; await c.recheck(); expect(c.operation.jobid).toBe('recovered'); expect(postAPI).toHaveBeenCalledTimes(1)
})
test('pending resource work blocks mutation', async () => { const c = await context(); jobs = [{ jobid: 'busy', jobstatus: 0 }]; await c.submit(); expect(postAPI).not.toHaveBeenCalled(); expect(c.error).toBe('message.vnf.reinstall.vm.busy') })
test('accepted job read failure is recoverable without another POST', async () => {
  const c = await context(); getAPI.mockImplementation((cmd, p) => cmd === 'queryAsyncJobResult' ? Promise.reject(new Error('network')) : dispatch(cmd, p)); await c.submit(); await flushPromises(); expect(c.operation.jobid).toBe('job'); expect(c.error).toBe('message.vnf.reinstall.job.lookup.failed'); expect(c.canSubmit).toBe(false)
  getAPI.mockImplementation(dispatch); await c.recheck(); expect(postAPI).toHaveBeenCalledTimes(1)
})
test('terminal job failure preserves input and unlocks a reviewed retry', async () => {
  const c = await context(); c.mode = 'other'; c.selectedId = 'b'; jobResult = { jobstatus: 2, jobresult: { errortext: 'job failed' } }; await c.submit(); await flushPromises(); expect(c.operation).toBeNull(); expect(c.selectedId).toBe('b'); expect(c.error).toBe('job failed'); expect(c.canSubmit).toBe(true)
})
test('closing and reopening only resumes the accepted job, even if receipt arrives after close', async () => {
  const c = await context(); const d = deferred(); postAPI.mockReturnValueOnce(d.promise); const first = c.submit(); await flushPromises(); c.close(); d.resolve({ restorevmresponse: { jobid: 'late' } }); await first
  const reopened = await context(); await flushPromises(); expect(reopened.operation.jobid).toBe('late'); await reopened.submit(); expect(postAPI).toHaveBeenCalledTimes(1); expect(reopened.succeeded).toBe(false)
})
test('successful result verifies UUID/type/template/NIC before displaying scoped finite credentials', async () => {
  const c = await context(); serverTemplates[1].passwordenabled = true; c.mode = 'other'; c.selectedId = 'b'
  jobResult = { jobstatus: 1, jobresult: { virtualmachine: { ...clone(base), templateid: 'b', passwordenabled: true, password: 'synthetic-secret', vnfdetails: { username: '<img onerror=1>', password: 'default-secret', access_methods: 'console' } } } }
  await c.submit(); await flushPromises(); expect(c.succeeded).toBe(true); expect(c.credentialRows).toHaveLength(2); expect(JSON.stringify(c.resultVm)).not.toContain('secret'); expect(c.$emit.mock.calls).toEqual([['refresh-data']]); jest.advanceTimersByTime(10000); expect(c.credentialRows).toEqual([])
})
test.each(['id', 'templateid', 'templatetype', 'nic'])('inconsistent result %s does not announce completion or allow re-execution', async field => {
  const c = await context(); const v = clone(base); v[field] = field === 'nic' ? [] : 'wrong'; jobResult = { jobstatus: 1, jobresult: { virtualmachine: v } }; await c.submit(); await flushPromises(); expect(c.succeeded).toBe(false); expect(c.operation.jobid).toBe('job'); expect(c.credentialRows).toEqual([]); expect(c.error).toBe('message.vnf.reinstall.result.unknown'); expect(c.canSubmit).toBe(false)
})
test('template labels are text, non-VNF/foreign/unready candidates are removed and required mapping reasons remain visible', async () => {
  serverTemplates[1].name = '<img src=x onerror=alert(1)>'; serverTemplates.push({ ...templates[1], id: 'bad', vnfnics: [{ deviceid: 9, required: true }] }, { ...templates[1], id: 'user', templatetype: 'USER' }, { ...templates[1], id: 'unready', isready: false }, { ...templates[1], id: 'foreign', zoneid: 'foreign' })
  const store = createStore({ state: { user: { token: 'session' } }, getters: { userInfo: () => ({ id: 'actor' }), project: () => ({}), apis: () => apis } })
  const wrapper = mount(Reinstall, { props: { resource: clone(base) }, global: { plugins: [store], mocks: { $t: k => k, $route: { fullPath: '/vnfapp/vm' } }, stubs: { AAlert: true, ASpin: { template: '<div><slot /></div>' }, AForm: { template: '<form><slot /></form>' }, AFormItem: { template: '<div><slot /></div>' }, ARadioGroup: { template: '<div><slot /></div>' }, ARadio: { template: '<label><slot /></label>' }, ACheckbox: true, AInputSearch: { inheritAttrs: false, template: '<input />' }, APagination: true, AButton: true, MoldDialogActions: { template: '<div><slot /></div>' } } } })
  await flushPromises(); await wrapper.setData({ mode: 'other' }); expect(wrapper.text()).toContain('<img src=x onerror=alert(1)>'); expect(wrapper.find('img').exists()).toBe(false); expect(wrapper.text()).toContain('message.vnf.reinstall.nic.missing'); expect(wrapper.vm.candidates.map(t => t.id)).toEqual(['a', 'b', 'bad']); wrapper.unmount()
})

test('reopening during Stopping resumes the accepted job without reading an intermediate root or submitting again', async () => {
  const c = await context(); c.mode = 'other'; c.selectedId = 'b'; await c.submit(); await flushPromises(); c.close()
  serverVm.state = 'Stopping'; getAPI.mockClear()
  const reopened = await context(); await flushPromises()
  expect(reopened.operation.jobid).toBe('job'); expect(reopened.mode).toBe('other'); expect(reopened.selectedId).toBe('b')
  expect(getAPI.mock.calls.some(([cmd]) => cmd === 'listVolumes')).toBe(false)
  expect(getAPI.mock.calls.some(([cmd]) => cmd === 'queryAsyncJobResult')).toBe(true)
  await reopened.submit(); expect(postAPI).toHaveBeenCalledTimes(1)
})
