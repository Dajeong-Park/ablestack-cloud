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

import { mount, flushPromises } from '@vue/test-utils'
import { reactive, h } from 'vue'
import { lbBackendRemovalMixin } from '@/utils/lbBackendRemoval'
import Public from '@/views/network/LoadBalancing'
import Internal from '@/views/network/InternalLBAssignedVmTab'
import Menu from '@/components/header/ProjectMenu'
import eventBus from '@/config/eventBus'
import { getAPI, postAPI } from '@/api'
jest.mock('@/api', () => ({ getAPI: jest.fn(), postAPI: jest.fn() }))

const instance = { loadbalancerruleinstance: { id: 'vm' }, lbvmipaddresses: ['192.0.2.10'] }
const row = () => ({ id: 'rule', publicipid: 'ip', ruleInstances: [instance] })
const backend = () => ({ id: 'vm', nic: [{ networkid: 'net', ipaddress: '192.0.2.10' }] })
const job = status => ({ queryasyncjobresultresponse: { jobid: 'job', cmd: 'org.apache.cloudstack.api.command.user.loadbalancer.RemoveFromLoadBalancerRuleCmd', jobstatus: status, ...(status === 2 ? { jobresult: { errorcode: 530, errortext: 'Provider rejected removal' } } : {}) } })
const deferred = () => { let finish; const promise = new Promise(resolve => { finish = resolve }); return { promise, resolve: finish } }
let wrappers
beforeEach(() => {
  jest.clearAllMocks(); wrappers = []
  postAPI.mockResolvedValue({ removefromloadbalancerruleresponse: { jobid: 'job' } })
  getAPI.mockResolvedValue(job(1))
})
afterEach(() => { wrappers.forEach(w => w.unmount()); jest.useRealTimers() })

function create (kind) {
  const methods = kind === 'public'
    ? Object.fromEntries(['canRemoveRuleBackend', 'handleDeleteInstanceFromRule', 'isProtectedRule'].map(k => [k, Public.methods[k]]))
    : Object.fromEntries(['canRemoveInternalBackend', 'removeVmFromLB'].map(k => [k, Internal.methods[k]]))
  const getters = reactive({ project: { id: 'project' }, userInfo: { id: 'user', roleid: 'role', roletype: 'User' }, apis: { removeFromLoadBalancerRule: {}, queryAsyncJobResult: {} } })
  const route = reactive({ path: kind === 'public' ? '/publicip/ip' : '/ilb/rule', query: { tab: 'backends' } })
  const state = reactive({ user: { token: 'session' } })
  const component = {
    props: ['resource'],
    mixins: [lbBackendRemovalMixin],
    data: () => ({ lbRules: [row()], assignedVms: [backend()], loading: false, fetchLoading: false, contextLoading: false, listRefreshFailed: false, listRefreshing: 0, networkMutationBlocked: false, publicContextSuspended: false, ruleOwners: {} }),
    methods: { ...methods, refreshLbBackends: jest.fn() },
    render () {
      const allowed = kind === 'public' ? this.canRemoveRuleBackend(row(), instance, '192.0.2.10') : this.canRemoveInternalBackend(backend())
      return h('button', { disabled: !allowed, onClick: () => kind === 'public' ? this.handleDeleteInstanceFromRule(instance, row(), '192.0.2.10') : this.removeVmFromLB(backend()) }, 'Remove backend')
    }
  }
  const w = mount(component, { props: { resource: { id: kind === 'public' ? 'ip' : 'rule', networkid: 'net', projectid: 'project' } }, global: { mocks: { $store: { getters, state }, $route: route, $t: k => k, $notifyError: jest.fn() } } })
  w.vm.refreshLbBackends = jest.fn()
  wrappers.push(w)
  const remove = () => kind === 'public' ? w.vm.handleDeleteInstanceFromRule(instance, row(), '192.0.2.10') : w.vm.removeVmFromLB(backend())
  return { w, getters, route, state, remove }
}

describe.each(['public', 'internal'])('%s backend removal', kind => {
  test('read-only button and a previously captured handler cannot issue a mutation', async () => {
    const { w, getters, remove } = create(kind); delete getters.apis.removeFromLoadBalancerRule; await flushPromises()
    expect(w.get('button').element.disabled).toBe(true)
    await w.get('button').trigger('click'); await remove()
    expect(postAPI).not.toHaveBeenCalled(); expect(w.vm.lbBackendOperation).toBeNull(); expect(w.vm.lbBackendBusy).toBe(false)
  })
  test('authorized removal waits for the job, suppresses duplicate submits and refreshes once', async () => {
    const { w, remove } = create(kind); const wait = deferred(); postAPI.mockReturnValueOnce(wait.promise)
    const work = remove(); await remove(); expect(postAPI).toHaveBeenCalledTimes(1); expect(w.vm.lbBackendBusy).toBe(true)
    wait.resolve({ removefromloadbalancerruleresponse: { jobid: 'job' } }); await work
    expect(w.vm.lbBackendOperation.status).toBe('success'); expect(w.vm.lbBackendBusy).toBe(false); expect(w.vm.refreshLbBackends).toHaveBeenCalledTimes(1)
    expect(postAPI.mock.calls[0][1]).toMatchObject({ id: 'rule', projectid: 'project', ignoreproject: true })
    expect(postAPI.mock.calls[0][2]).toEqual({ preserveOnFailure: true })
  })
  test.each([401, 431])('definitive API/local rejection %s preserves rows and ends loading with one inline error', async code => {
    const { w, remove } = create(kind)
    postAPI.mockRejectedValueOnce({ response: { status: code, data: { errorresponse: { errorcode: code, errortext: 'Denied for this user' } } } })
    await remove()
    expect(w.vm.lbBackendOperation).toMatchObject({ status: 'failed', error: 'Denied for this user', code }); expect(w.vm.lbBackendBusy).toBe(false)
    expect(w.vm.lbRules).toHaveLength(1); expect(w.vm.assignedVms).toHaveLength(1); expect(w.vm.$notifyError).not.toHaveBeenCalled(); expect(w.vm.refreshLbBackends).not.toHaveBeenCalled()
  })
  test('async job failure preserves mapping and does not emit a duplicate global error', async () => {
    const { w, remove } = create(kind); getAPI.mockResolvedValueOnce(job(2)); await remove()
    expect(w.vm.lbBackendOperation).toMatchObject({ status: 'failed', error: 'Provider rejected removal', code: 530 }); expect(w.vm.lbBackendBusy).toBe(false)
    expect(w.vm.lbRules).toHaveLength(1); expect(w.vm.assignedVms).toHaveLength(1); expect(w.vm.$notifyError).not.toHaveBeenCalled()
  })
  test('unknown receipt ends the spinner but cannot blindly repeat a mutation', async () => {
    const { w, remove } = create(kind); postAPI.mockRejectedValueOnce(new Error('Connection lost')); await remove(); await remove()
    expect(w.vm.lbBackendOperation.status).toBe('unknown'); expect(w.vm.lbBackendBusy).toBe(false); expect(postAPI).toHaveBeenCalledTimes(1)
  })
  test('job query errors recover the same job without another mutation', async () => {
    jest.useFakeTimers(); const { w, remove } = create(kind); getAPI.mockRejectedValue(new Error('Temporary read failure'))
    const work = remove(); for (let i = 0; i < 3; i++) { await flushPromises(); jest.advanceTimersByTime(2000) } await work
    expect(w.vm.lbBackendOperation.status).toBe('unknown'); expect(w.vm.lbBackendBusy).toBe(false)
    getAPI.mockResolvedValue(job(1)); await w.vm.recheckLbBackendRemoval()
    expect(w.vm.lbBackendOperation.status).toBe('success'); expect(postAPI).toHaveBeenCalledTimes(1)
  })
  test.each(['role', 'project', 'route', 'session'])('late receipt after %s scope change is discarded', async change => {
    const { w, getters, route, state, remove } = create(kind); const wait = deferred(); postAPI.mockReturnValueOnce(wait.promise)
    const work = remove()
    if (change === 'role') delete getters.apis.removeFromLoadBalancerRule
    if (change === 'project') getters.project.id = 'other-project'
    if (change === 'route') route.query.tab = 'details'
    if (change === 'session') state.user.token = 'new-session'
    await flushPromises(); w.vm.refreshLbBackends.mockClear()
    wait.resolve({ removefromloadbalancerruleresponse: { jobid: 'job' } }); await work
    expect(w.vm.lbBackendOperation).toBeNull(); expect(getAPI).not.toHaveBeenCalled(); expect(w.vm.refreshLbBackends).not.toHaveBeenCalled()
  })
  test('project switch start blocks before getters change and a cancelled switch resumes safely', async () => {
    const { w, remove } = create(kind); const wait = deferred(); postAPI.mockReturnValueOnce(wait.promise); const work = remove()
    eventBus.emit('project-switch-start'); await remove(); expect(postAPI).toHaveBeenCalledTimes(1); expect(w.vm.lbBackendBusy).toBe(false)
    eventBus.emit('project-switch-end'); wait.resolve({ removefromloadbalancerruleresponse: { jobid: 'job' } }); await work
    expect(w.vm.lbBackendOperation).toBeNull(); expect(getAPI).not.toHaveBeenCalled(); expect(w.vm.lbBackendAllowed).toBe(true)
  })
  test('list failure, busy refresh, project mismatch and AutoScale prevent removal', async () => {
    const { w, getters, remove } = create(kind)
    w.vm.listRefreshFailed = true; await remove(); w.vm.listRefreshFailed = false
    w.vm.listRefreshing = 1; await remove(); w.vm.listRefreshing = 0
    getters.project.id = 'other-project'; await remove(); getters.project.id = 'project'; await flushPromises()
    if (kind === 'public') w.vm.lbRules[0].autoscalevmgroup = { id: 'group' }
    else await w.setProps({ resource: { ...w.props('resource'), autoscalevmgroup: { id: 'group' } } })
    await remove(); expect(postAPI).not.toHaveBeenCalled()
  })
  test('stale mapping and managed rules are blocked at handler entry', async () => {
    const { w, remove } = create(kind)
    if (kind === 'public') w.vm.lbRules[0].ruleInstances = []
    else w.vm.assignedVms[0].nic[0].networkid = 'other-network'
    await remove()
    if (kind === 'public') { w.vm.lbRules = [row()]; w.vm.ruleOwners = { rule: { kind: 'service' } } } else await w.setProps({ resource: { ...w.props('resource'), tags: [{ key: 'mold.k8s.service', value: 'managed' }] } })
    await remove(); expect(postAPI).not.toHaveBeenCalled()
  })
  test('unmounted views ignore a late receipt', async () => {
    const { w, remove } = create(kind); const wait = deferred(); postAPI.mockReturnValueOnce(wait.promise); const work = remove()
    w.unmount(); wait.resolve({ removefromloadbalancerruleresponse: { jobid: 'job' } }); await work; expect(getAPI).not.toHaveBeenCalled()
  })
})

test('failed project capability lookup still announces the end of the UI transition', async () => {
  const end = jest.fn(); eventBus.on('project-switch-end', end)
  const vm = { loading: false, defaultOption: {}, $store: { getters: { project: { id: 'old' } }, dispatch: jest.fn().mockRejectedValue(new Error('503')) }, $notifyError: jest.fn() }
  try { await Menu.methods.changeProject.call(vm, { id: 'new' }); expect(end).toHaveBeenCalledTimes(1); expect(vm.loading).toBe(false) } finally { eventBus.off('project-switch-end', end) }
})

test('VirtualRouter zone lookup completes without modifying nonexistent legacy columns', async () => {
  getAPI.mockResolvedValueOnce({ listzonesresponse: { zone: [{}] } })
  const vm = { resource: { zoneid: 'zone' }, zoneloading: false, lbProvider: null, isNetrisZone: false }
  await expect(Public.methods.fetchZone.call(vm)).resolves.toBeUndefined()
  expect(vm.zoneloading).toBe(false)
  expect(vm.isNetrisZone).toBe(false)
})
