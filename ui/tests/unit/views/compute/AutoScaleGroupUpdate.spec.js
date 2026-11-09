// Licensed to the Apache Software Foundation (ASF) under one or more
// contributor license agreements. See NOTICE for copyright ownership.
// Licensed under the Apache License, Version 2.0 (the "License");
// http://www.apache.org/licenses/LICENSE-2.0 . Distributed AS IS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND.
import { shallowMount } from '@vue/test-utils'
import { h, reactive, nextTick } from 'vue'
import { v4 as uuid } from 'uuid'
import Dialog from '@/views/compute/AutoScaleGroupUpdate.vue'
import { getAPI, postAPI } from '@/api'
jest.mock('@/api', () => ({ getAPI: jest.fn(), postAPI: jest.fn() }))
jest.mock('uuid', () => ({ v4: jest.fn() }))
const group = { id: 'group', name: 'Review', state: 'DISABLED', projectid: 'project', vmprofileid: 'profile', lbruleid: 'lb', minmembers: 1, maxmembers: 2, interval: 60 }
const dialog = { props: ['visible', 'closable'], render () { return this.visible ? h('section', [this.$slots.default?.(), h('footer', this.$slots.footer?.())]) : null } }
const button = { props: ['type', 'disabled', 'loading'], render () { return h('button', { class: this.type, disabled: this.disabled || this.loading }, this.$slots.default?.()) } }
const form = { methods: { validate: () => Promise.resolve(), clearValidate () {} }, render () { return h('form', this.$slots.default?.()) } }
const drain = async () => { for (let i = 0; i < 25; i++) { await Promise.resolve(); await nextTick() } }
let wrappers, outcome, serial
beforeEach(() => {
  jest.clearAllMocks(); sessionStorage.clear(); wrappers = []; serial = 0; outcome = 1
  uuid.mockImplementation(() => '00000000-0000-4000-8000-' + String(++serial).padStart(12, '0'))
  getAPI.mockImplementation((command, params) => Promise.resolve(command === 'listAutoScaleVmGroups'
    ? { listautoscalevmgroupsresponse: { autoscalevmgroup: [{ ...group }] } }
    : { queryasyncjobresultresponse: { jobid: params.jobid, jobstatus: outcome, cmd: 'UpdateAutoScaleVmGroupCmd', jobinstanceid: group.id, jobresult: outcome === 2 ? { errorcode: 431, errortext: 'duration 60 cannot be less than interval 120' } : {} } }))
  postAPI.mockImplementation((_, params) => Promise.resolve({ updateautoscalevmgroupresponse: { jobid: params.customjobid } }))
})
afterEach(() => { wrappers.forEach(w => w.unmount()); jest.useRealTimers(); jest.restoreAllMocks() })
async function open (project = 'project') {
  const getters = reactive({ project: { id: project }, userInfo: { id: 'user', roleid: 'role' }, apis: { updateAutoScaleVmGroup: {}, listAutoScaleVmGroups: {}, queryAsyncJobResult: {} } })
  const route = reactive({ path: '/autoscalevmgroup/group' })
  const w = shallowMount(Dialog, { props: { resource: { ...group } }, global: { mocks: { $t: k => k, $store: { getters, state: { user: { token: 'session' } } }, $route: route }, stubs: { MoldDialog: dialog, AButton: button, AForm: form, ASpin: { render () { return h('div', this.$slots.default?.()) } } } } })
  wrappers.push(w); await drain(); return { w, getters, route }
}

test('async 431 keeps the dialog, 120 draft and error; corrected 60 closes only after success', async () => {
  const { w } = await open(); w.vm.draft.interval = 120; outcome = 2
  await w.vm.submit(); await drain()
  expect(w.vm.closed).toBe(false); expect(w.vm.draft.interval).toBe(120); expect(w.vm.error).toContain('431: duration 60')
  expect(w.emitted('refresh-data')).toBeUndefined(); expect(w.vm.jobId).toBe(''); expect(w.vm.fieldsDisabled).toBe(false)
  outcome = 1; w.vm.draft.interval = 60; await w.vm.submit(); await drain()
  expect(w.vm.closed).toBe(true); expect(w.emitted('refresh-data')).toHaveLength(1); expect(postAPI).toHaveBeenCalledTimes(2)
  expect(postAPI.mock.calls[1][1]).toMatchObject({ projectid: 'project', interval: 60, customjobid: '00000000-0000-4000-8000-000000000002' })
  expect(sessionStorage.length).toBe(0)
})

test('pending submit blocks duplicate Enter/click and cancellation without discarding inputs', async () => {
  const { w } = await open(); let finish
  postAPI.mockImplementationOnce((_, p) => new Promise(resolve => { finish = () => resolve({ updateautoscalevmgroupresponse: { jobid: p.customjobid } }) }))
  w.vm.draft.interval = 120; outcome = 2; const pending = w.vm.submit(); await drain()
  w.vm.close(); await w.vm.submit(); expect(postAPI).toHaveBeenCalledTimes(1); expect(w.vm.closed).toBe(false)
  expect(w.vm.fieldsDisabled).toBe(true); expect(w.get('footer button.primary').attributes('disabled')).toBeDefined()
  finish(); await pending; await drain(); expect(w.vm.draft.interval).toBe(120)
})

test('resource refresh never overwrites an editing draft', async () => {
  const { w } = await open(); w.vm.draft.interval = 120; w.vm.draft.name = 'Draft'
  await w.setProps({ resource: { ...group, name: 'Refreshed', interval: 30 } })
  expect(w.vm.draft).toMatchObject({ interval: 120, name: 'Draft' })
})

test('lost submit response is recovered with the preallocated job ID, without a second post', async () => {
  const { w } = await open(); postAPI.mockRejectedValueOnce(new Error('connection lost'))
  await w.vm.submit(); await drain()
  expect(w.vm.closed).toBe(true); expect(postAPI).toHaveBeenCalledTimes(1)
  expect(getAPI).toHaveBeenCalledWith('queryAsyncJobResult', expect.objectContaining({ jobid: '00000000-0000-4000-8000-000000000001' }), expect.any(Object))
})

test('missing receipt is resolved by querying the retained custom job ID', async () => {
  const { w } = await open(); postAPI.mockResolvedValueOnce({})
  await w.vm.submit(); expect(w.vm.closed).toBe(true); expect(postAPI).toHaveBeenCalledTimes(1)
})

test.each(['offline', 'foreign'])('uncertain %s job lookup keeps the receipt and recheck never resubmits', async failure => {
  const { w } = await open()
  getAPI.mockImplementation((c, p) => c === 'listAutoScaleVmGroups'
    ? Promise.resolve({ listautoscalevmgroupsresponse: { autoscalevmgroup: [{ ...group }] } })
    : failure === 'offline' ? Promise.reject(new Error('503')) : Promise.resolve({ queryasyncjobresultresponse: { jobid: p.jobid, jobinstanceid: 'other-group', jobstatus: 1 } }))
  await w.vm.submit()
  expect(w.vm.closed).toBe(false); expect(w.vm.jobId).toBe('00000000-0000-4000-8000-000000000001'); expect(w.vm.fieldsDisabled).toBe(true)
  expect(w.emitted('refresh-data')).toBeUndefined(); expect(postAPI).toHaveBeenCalledTimes(1)
  getAPI.mockImplementation((c, p) => Promise.resolve({ queryasyncjobresultresponse: { jobid: p.jobid, jobinstanceid: group.id, jobstatus: 1 } }))
  await w.vm.submit(); expect(w.vm.closed).toBe(true); expect(postAPI).toHaveBeenCalledTimes(1)
})

test('lookup failure preserves unknown receipt and draft across closing/reopening in the same owner scope', async () => {
  const id = '00000000-0000-4000-8000-000000000001'
  const { w } = await open(); w.vm.jobId = id; w.vm.draft.interval = 120; w.vm.persist(); w.vm.error = 'uncertain'; w.vm.close(); w.unmount()
  outcome = 2; const { w: restored } = await open(); await drain()
  expect(restored.vm.draft.interval).toBe(120); expect(restored.vm.error).toContain('431:'); expect(postAPI).not.toHaveBeenCalled()
  expect(restored.vm.jobId).toBe(''); expect(sessionStorage.length).toBe(0)
})

test('another project cannot restore or submit the previous project receipt', async () => {
  const { w } = await open(); w.vm.jobId = '00000000-0000-4000-8000-000000000001'; w.vm.draft.name = 'Old project'; w.vm.persist(); w.unmount()
  const { w: other } = await open('other'); expect(other.vm.jobId).toBe(''); expect(other.vm.draft.name).toBe('Review')
  expect(postAPI).not.toHaveBeenCalled()
})

test.each(['project', 'route', 'permission'])('context change discards late submission callbacks: %s', async change => {
  const { w, getters, route } = await open(); let finish
  postAPI.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const pending = w.vm.submit(); await drain()
  if (change === 'project') getters.project = { id: 'other' }
  if (change === 'route') route.path = '/vm'
  if (change === 'permission') delete getters.apis.updateAutoScaleVmGroup
  await drain(); finish({ updateautoscalevmgroupresponse: { jobid: 'old-job' } }); await pending
  expect(w.vm.closed).toBe(true); expect(w.emitted('refresh-data')).toBeUndefined()
  expect(getAPI.mock.calls.filter(([c]) => c === 'queryAsyncJobResult')).toHaveLength(0)
})

test('changed server values preserve the draft and stop before updating', async () => {
  const { w } = await open(); w.vm.draft.interval = 120
  getAPI.mockResolvedValueOnce({ listautoscalevmgroupsresponse: { autoscalevmgroup: [{ ...group, name: 'Changed' }] } })
  await w.vm.submit(); expect(postAPI).not.toHaveBeenCalled(); expect(w.vm.draft.interval).toBe(120); expect(w.vm.error).toBe('message.autoscale.group.update.changed')
})

test('storage failure before dispatch cannot send an untracked mutation', async () => {
  const { w } = await open(); jest.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => { throw Error('full') })
  await w.vm.submit(); expect(postAPI).not.toHaveBeenCalled(); expect(w.vm.jobId).toBe(''); expect(w.vm.closed).toBe(false)
})

test('enabled groups keep interval out of the update payload', async () => {
  getAPI.mockImplementation((c, p) => Promise.resolve(c === 'listAutoScaleVmGroups' ? { listautoscalevmgroupsresponse: { autoscalevmgroup: [{ ...group, state: 'ENABLED' }] } } : { queryasyncjobresultresponse: { jobid: p.jobid, jobstatus: 1 } }))
  const { w } = await open(); await w.vm.submit(); expect(postAPI.mock.calls[0][1].interval).toBeUndefined()
})

test.each([0, -1, 1.5, 2147483648])('invalid integer %s is rejected by the form validator', async value => {
  const { w } = await open(); await expect(w.vm.rules.interval[0].validator({}, value)).rejects.toThrow()
})
