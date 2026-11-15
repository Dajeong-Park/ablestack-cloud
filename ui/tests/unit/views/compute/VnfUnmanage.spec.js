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

import { flushPromises, shallowMount } from '@vue/test-utils'
import { reactive } from 'vue'
import Unmanage from '@/views/compute/VnfUnmanage'
import { vnfUnmanageApis, vnfUnmanageJobs } from '@/utils/vnfVmActions'
import { getAPI, postAPI } from '@/api'
jest.mock('@/api', () => ({ getAPI: jest.fn(), postAPI: jest.fn() }))
const clone = v => JSON.parse(JSON.stringify(v))
const base = { id: '11111111-1111-4111-8111-111111111111', name: 'vnf', templateid: 't', templatetype: 'VNF', hypervisor: 'KVM', state: 'Running', hostid: 'host', zoneid: 'zone', account: 'owner', domainid: 'domain', nic: [{ id: 'nic', networkid: 'net', macaddress: 'mac', deviceid: 0 }] }
const apis = () => Object.fromEntries(vnfUnmanageApis.map(a => [a, {}]))
const deferred = () => { let done; const promise = new Promise(resolve => { done = resolve }); return { promise, resolve: done } }
let vm, jobs, job, removed
function dispatch (cmd) {
  if (cmd === 'listVirtualMachines') return Promise.resolve({ listvirtualmachinesresponse: removed ? {} : { count: 1, virtualmachine: [clone(vm)] } })
  if (cmd === 'listVnfAppliances') return Promise.resolve({ listvnfappliancesresponse: removed ? {} : { count: 1, virtualmachine: [clone(vm)] } })
  if (cmd === 'listHosts') return Promise.resolve({ listhostsresponse: { host: [{ id: 'host', zoneid: 'zone', state: 'Up', resourcestate: 'Enabled' }] } })
  if (cmd === 'listVolumes') return Promise.resolve({ listvolumesresponse: { volume: [{ id: 'root', type: 'ROOT', state: 'Ready', virtualmachineid: base.id, size: 1 }] } })
  if (cmd === 'listConfigurations') return Promise.resolve({ listconfigurationsresponse: { configuration: [{ name: 'unmanage.vm.preserve.nics', value: 'false' }] } })
  if (cmd === 'listAsyncJobs') return Promise.resolve({ listasyncjobsresponse: { count: jobs.length, asyncjobs: clone(jobs) } })
  if (cmd === 'queryAsyncJobResult') return Promise.resolve({ queryasyncjobresultresponse: clone(job) })
  throw Error(cmd)
}
async function context () {
  const c = { resource: clone(base), action: {}, $route: { fullPath: '/vnfapp/' + base.id }, $store: { state: { user: { token: 'session' } }, getters: { apis: apis(), userInfo: { id: 'actor', roletype: 'Admin' }, project: {} } }, $t: k => k, $router: { replace: jest.fn() }, $emit: jest.fn(), resourceActionReady: () => true }
  Object.assign(c, Unmanage.data.call(c)); for (const [k, f] of Object.entries(Unmanage.methods)) c[k] = f.bind(c)
  for (const [k, f] of Object.entries(Unmanage.computed)) Object.defineProperty(c, k, { get: () => f.call(c) })
  c.origin = c.context; await c.load(); c.acknowledged = true; return c
}
beforeEach(() => { jest.useFakeTimers(); jest.clearAllMocks(); vnfUnmanageJobs.clear(); vm = clone(base); jobs = []; job = { jobstatus: 0 }; removed = false; getAPI.mockImplementation(dispatch); postAPI.mockResolvedValue({ unmanagevirtualmachineresponse: { jobid: 'job' } }) })
afterEach(() => { jest.clearAllTimers(); jest.useRealTimers() })
test('current VNF is revalidated and mutation sends the exact UUID only', async () => {
  const c = await context(); await c.submit(); await flushPromises(); expect(postAPI).toHaveBeenCalledWith('unmanageVirtualMachine', { id: base.id }, expect.any(Object)); await c.submit(); expect(postAPI).toHaveBeenCalledTimes(1)
  expect(JSON.stringify([...vnfUnmanageJobs.values()])).not.toContain('session')
})
test.each(['hostid', 'templateid', 'nic'])('changed %s during confirmation prevents mutation', async field => {
  const c = await context(); vm[field] = field === 'nic' ? [] : 'different'; await c.submit(); expect(postAPI).not.toHaveBeenCalled(); expect(c.error).toBeTruthy()
})
test.each(['deleteprotection', 'haenable'])('fresh %s restriction overrides an earlier eligible screen', async field => { const c = await context(); vm[field] = true; await c.submit(); expect(postAPI).not.toHaveBeenCalled() })
test('synchronous API refusal preserves acknowledgement and permits a deliberate retry', async () => {
  const c = await context(); postAPI.mockRejectedValueOnce({ response: { data: { errorresponse: { errorcode: 431, errortext: 'denied' } } } }); await c.submit(); expect(c.error).toBe('denied'); expect(c.acknowledged).toBe(true); expect(c.canSubmit).toBe(true); await c.submit(); expect(postAPI).toHaveBeenCalledTimes(2)
})
test('lost receipt does not repeat a mutation and reconciles one new unmanage job only', async () => {
  const c = await context(); postAPI.mockRejectedValueOnce(new Error('timeout')); await c.submit(); await c.submit(); expect(postAPI).toHaveBeenCalledTimes(1); expect(c.operation.phase).toBe('unknown')
  jobs = [{ jobid: 'found', cmd: 'org.apache.cloudstack.api.command.admin.vm.UnmanageVMInstanceCmd', jobstatus: 0 }]; await c.recheck(); await flushPromises(); expect(c.operation.jobid).toBe('found'); expect(postAPI).toHaveBeenCalledTimes(1)
})
test('accepted-job query failure survives close/reopen and resumes reads without a second POST', async () => {
  const c = await context(); getAPI.mockImplementation(cmd => cmd === 'queryAsyncJobResult' ? Promise.reject(Error('503')) : dispatch(cmd)); await c.submit(); await flushPromises(); expect(c.operation.jobid).toBe('job'); c.close(); getAPI.mockImplementation(dispatch)
  const reopened = await context(); await reopened.submit(); expect(reopened.operation.jobid).toBe('job'); expect(postAPI).toHaveBeenCalledTimes(1)
})
test('failed job unlocks reviewed retry and retains the original target', async () => { const c = await context(); job = { jobstatus: 2, jobresult: { errortext: 'server refused' } }; await c.submit(); await flushPromises(); expect(c.operation).toBeNull(); expect(c.error).toBe('server refused'); expect(c.target.id).toBe(base.id); expect(c.canSubmit).toBe(true) })
test('success requires explicit result, original host UUID and absence from both Cloud lists', async () => {
  const c = await context(); removed = true; job = { jobstatus: 1, jobinstanceid: base.id, jobresult: { unmanagevirtualmachineresponse: { result: true, hostid: 'host' } } }; await c.submit()
  // Fresh preflight must run while the VM exists; make removal occur on query.
  expect(postAPI).not.toHaveBeenCalled(); removed = false; c.preview = await (await import('@/utils/vnfVmActions')).readVnfUnmanagePreview(base, c.$store.getters)
  getAPI.mockImplementation(cmd => { if (cmd === 'queryAsyncJobResult') removed = true; return dispatch(cmd) }); await c.submit(); await flushPromises(); expect(c.succeeded).toBe(true); c.close(); expect(c.$router.replace).toHaveBeenCalledWith('/vnfapp')
})
test.each(['result', 'host', 'vm', 'list'])('unconfirmed %s completion never announces success or permits another mutation', async kind => {
  const c = await context(); job = { jobstatus: 1, jobinstanceid: kind === 'vm' ? 'other' : base.id, jobresult: { result: kind !== 'result', hostid: kind === 'host' ? 'other' : 'host' } }
  getAPI.mockImplementation(cmd => { if (cmd === 'queryAsyncJobResult') removed = kind !== 'list'; return dispatch(cmd) }); await c.submit(); await flushPromises(); expect(c.succeeded).toBe(false); expect(c.operation.jobid).toBe('job'); await c.submit(); expect(postAPI).toHaveBeenCalledTimes(1)
})
test('closing during delayed preflight cancels the POST', async () => { const c = await context(); const wait = deferred(); getAPI.mockImplementation(cmd => cmd === 'listVirtualMachines' ? wait.promise : dispatch(cmd)); const pending = c.submit(); c.close(); wait.resolve({ listvirtualmachinesresponse: { virtualmachine: [clone(base)] } }); await pending; expect(postAPI).not.toHaveBeenCalled() })
test('role/context changes clear the preview synchronously and discard late preflight', async () => {
  const state = reactive({ user: { token: 'session' } }); const getters = reactive({ apis: apis(), userInfo: { id: 'actor', roletype: 'Admin' }, project: {} })
  const wrapper = shallowMount(Unmanage, { props: { resource: clone(base) }, global: { mocks: { $store: { state, getters }, $route: { fullPath: '/vnfapp/' + base.id }, $t: k => k }, stubs: { ASpin: { template: '<div><slot /></div>' }, MoldDialogActions: { template: '<div><slot /></div>' } } } })
  await flushPromises(); expect(wrapper.vm.preview).toBeTruthy(); getters.userInfo.roletype = 'User'; expect(wrapper.vm.preview).toBeNull(); expect(wrapper.vm.disposed).toBe(true); await wrapper.vm.submit(); expect(postAPI).not.toHaveBeenCalled(); wrapper.unmount()
})
