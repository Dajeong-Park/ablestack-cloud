// Licensed to the Apache Software Foundation (ASF) under one or more
// contributor license agreements. See the NOTICE file distributed with this
// work for additional information regarding copyright ownership. The ASF
// licenses this file under the Apache License, Version 2.0 (the "License").
// You may obtain a copy at http://www.apache.org/licenses/LICENSE-2.0 .
// Unless required by applicable law or agreed to in writing, software is
// distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND.
import { mount } from '@vue/test-utils'
import { reactive, nextTick } from 'vue'
import Create from '@/views/compute/CreateAffinityGroup'
import Owner from '@/views/compute/AffinityGroupOwner'
import { getAPI, postAPI } from '@/api'
import { clearAffinityOperations } from '@/utils/affinityGroupOperations'
import { affinityNameValid, affinityTypeOptions, affinityOwnerOptions } from '@/utils/affinityGroupCreation'
jest.mock('@/api', () => ({ getAPI: jest.fn(), postAPI: jest.fn() }))
const types = ['host affinity', 'host anti-affinity', 'non-strict host affinity', 'non-strict host anti-affinity']
const typeResponse = { listaffinitygrouptypesresponse: { count: 4, affinityGroupType: types.map(type => ({ type })) } }
const flush = async () => { for (let i = 0; i < 32; i++) { await Promise.resolve(); await nextTick() } }
let wrappers
function render (component = Create, admin = false, props = {}) {
  const store = reactive({ state: { user: { token: 'session' } }, getters: { userInfo: { id: 'user', account: 'owner', domainid: 'domain', roletype: admin ? 'Admin' : 'User' }, project: {} } })
  const success = jest.fn()
  const w = mount(component, { props, global: { mocks: { $store: store, $t: key => key, $message: { success } }, stubs: { MoldDialog: { template: '<section><slot/><slot name="footer"/></section>' }, ...(component === Create ? { AffinityGroupOwner: true } : {}) } } })
  wrappers.push(w); return { w, store, success }
}
function fill (w) { Object.assign(w.vm.form, { name: '  example  ', description: '  description  ', type: types[0] }) }
beforeEach(() => {
  wrappers = []; jest.useFakeTimers(); jest.clearAllMocks(); clearAffinityOperations()
  getAPI.mockImplementation(command => Promise.resolve(command === 'listAffinityGroupTypes' ? typeResponse : command === 'listDomains' ? { listdomainsresponse: { count: 1, domain: [{ id: 'domain', name: 'ROOT' }] } } : command === 'listAccounts' ? { listaccountsresponse: { count: 1, account: [{ id: 'a', name: 'owner', domainid: 'domain' }] } } : command === 'listProjects' ? { listprojectsresponse: { count: 1, project: [{ id: 'project', name: 'Project', domainid: 'domain' }] } } : { queryasyncjobresultresponse: { jobstatus: 1 } }))
  postAPI.mockResolvedValue({ createaffinitygroupresponse: { jobid: 'job' } })
})
afterEach(() => { wrappers.forEach(w => w.unmount()); clearAffinityOperations(); jest.useRealTimers() })

test('types are discovered without a fixed default, raw values remain distinct from labels', async () => {
  const { w } = render(); await flush()
  expect(w.vm.types.map(row => row.id)).toEqual(types); expect(w.vm.form.type).toBeUndefined()
  expect(affinityTypeOptions({ listaffinitygrouptypesresponse: { affinityGroupType: [{ type: 'future type' }] } })[0]).toEqual({ id: 'future type', name: 'future type', labelKey: undefined })
  fill(w); await w.vm.handleSubmit()
  expect(postAPI).toHaveBeenCalledWith('createAffinityGroup', { name: 'example', description: 'description', type: 'host affinity', domainid: 'domain', account: 'owner', ignoreproject: true }, expect.objectContaining({ preserveOnFailure: true, backgroundJob: true }))
})
test('lookup failure and zero types have visible retry and block all submission paths', async () => {
  getAPI.mockRejectedValueOnce(new Error('offline'))
  const { w } = render(); await flush(); fill(w)
  expect(w.vm.typesError).toBe(true); expect(w.text()).toContain('message.affinity.types.failed'); await w.vm.handleSubmit(); expect(postAPI).not.toHaveBeenCalled()
  getAPI.mockResolvedValueOnce({ listaffinitygrouptypesresponse: { count: 0 } }); await w.vm.loadTypes(); await flush()
  expect(w.vm.typesError).toBe(false); expect(w.text()).toContain('message.affinity.types.empty'); expect(w.vm.canSubmit).toBe(false)
  await w.findAll('button').find(button => button.text() === 'label.retry').trigger('click'); await flush(); expect(w.vm.types).toHaveLength(4)
})
test('late type responses cannot replace a newer lookup', async () => {
  let old; getAPI.mockImplementationOnce(() => new Promise(resolve => { old = resolve }))
  const { w } = render(); await flush(); await w.vm.loadTypes(); old({ listaffinitygrouptypesresponse: { count: 0 } }); await flush()
  expect(w.vm.types).toHaveLength(4); expect(w.vm.typesLoading).toBe(false)
})
test('duplicate API error preserves inputs, type, owner, focus target and dialog for correction', async () => {
  const { w, success } = render(); await flush(); fill(w)
  postAPI.mockRejectedValueOnce({ response: { data: { errorresponse: { errorcode: 431, errortext: 'Name already exists' } } } })
  await w.vm.handleSubmit(); await flush()
  expect(w.vm.form).toEqual({ name: '  example  ', description: '  description  ', type: types[0] }); expect(w.vm.owner.account).toBe('owner')
  expect(w.text()).toContain('Name already exists'); expect(w.emitted('close-action')).toBeFalsy(); expect(w.emitted('refresh-data')).toBeFalsy(); expect(success).not.toHaveBeenCalled()
  w.vm.form.name = 'corrected'; await w.vm.handleSubmit(); expect(success).toHaveBeenCalledTimes(1); expect(w.emitted('close-action')).toHaveLength(1)
})
test('receipt and repeated clicks do not close or resubmit before final job success', async () => {
  let done; getAPI.mockImplementation(command => command === 'listAffinityGroupTypes' ? Promise.resolve(typeResponse) : new Promise(resolve => { done = resolve }))
  const { w, success } = render(); await flush(); fill(w)
  const first = w.vm.handleSubmit(); const second = w.vm.handleSubmit(); await flush()
  expect(postAPI).toHaveBeenCalledTimes(1); expect(w.vm.operation.status).toBe('pending'); expect(success).not.toHaveBeenCalled(); expect(w.emitted('close-action')).toBeFalsy()
  done({ queryasyncjobresultresponse: { jobstatus: 1 } }); await Promise.all([first, second]); await flush(); expect(success).toHaveBeenCalledTimes(1)
})
test('final failed job preserves form and never reports success', async () => {
  const { w, success } = render(); await flush(); fill(w)
  getAPI.mockResolvedValue({ queryasyncjobresultresponse: { jobstatus: 2, jobresult: { errortext: 'Create failed' } } })
  await w.vm.handleSubmit(); await flush(); expect(w.text()).toContain('Create failed'); expect(w.vm.form.name).toBe('  example  '); expect(success).not.toHaveBeenCalled(); expect(w.emitted('close-action')).toBeFalsy()
})
test('unknown POST outcome survives closing and reopening with its owner and form', async () => {
  const { w } = render(); await flush(); fill(w); postAPI.mockRejectedValueOnce(new Error('response lost')); await w.vm.handleSubmit(); w.unmount(); wrappers = []
  const reopened = render().w; await flush(); expect(reopened.vm.operation.status).toBe('unknown'); expect(reopened.vm.form.name).toBe('example'); expect(reopened.vm.owner.account).toBe('owner'); expect(reopened.vm.canSubmit).toBe(false)
  await reopened.vm.handleSubmit(); expect(postAPI).toHaveBeenCalledTimes(1)
})
test.each(['', '   ', 'n'.repeat(192)])('invalid name is rejected before POST: %s', async name => {
  const { w } = render(); await flush(); fill(w); w.vm.form.name = name; await w.vm.handleSubmit(); expect(postAPI).not.toHaveBeenCalled()
})
test('description and supplementary Unicode honor both API and DB character limits', async () => {
  expect(affinityNameValid('가'.repeat(191))).toBe(true); expect(affinityNameValid('😀'.repeat(127))).toBe(true); expect(affinityNameValid('😀'.repeat(128))).toBe(false)
  const { w } = render(); await flush(); fill(w); w.vm.form.description = 'd'.repeat(256); await w.vm.handleSubmit(); expect(postAPI).not.toHaveBeenCalled()
})
test('validation cannot submit after owner/session changes or issue duplicate POSTs', async () => {
  const { w, store } = render(); await flush(); fill(w)
  let finish; jest.spyOn(w.vm.$refs.createForm, 'validate').mockImplementation(() => new Promise(resolve => { finish = resolve }))
  const p = w.vm.handleSubmit(); w.vm.ownerChanged({ owner: {}, ready: false }); finish(); await p; expect(postAPI).not.toHaveBeenCalled()
  w.vm.ownerChanged({ owner: { projectid: 'p', domainid: 'domain' }, ready: true }); const second = w.vm.handleSubmit(); store.state.user.token = 'other'; finish(); await second; expect(postAPI).not.toHaveBeenCalled()
})
test('admin ownership begins unresolved and blocks fallback to the admin account', async () => {
  const { w } = render(Create, true); await flush(); fill(w); await w.vm.handleSubmit(); expect(postAPI).not.toHaveBeenCalled()
  w.vm.ownerChanged({ owner: { projectid: 'project', domainid: 'domain' }, ready: true }); await w.vm.handleSubmit(); expect(postAPI.mock.calls[0][1]).toMatchObject({ projectid: 'project', domainid: 'domain', ignoreproject: true }); expect(postAPI.mock.calls[0][1]).not.toHaveProperty('account')
})
test('owner transitions clear readiness immediately and reject a late account response', async () => {
  const { w } = render(Owner, true); await flush(); expect(w.emitted('change').slice(-1)[0][0]).toMatchObject({ ready: true, owner: { account: 'owner' } })
  let finish; getAPI.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const old = w.vm.loadOwners(); w.vm.changeKind('project'); await flush(); expect(w.vm.selection).toBeUndefined(); expect(w.emitted('change').slice(-1)[0][0].ready).toBe(false)
  w.vm.selectOwner('project'); finish({ listaccountsresponse: { count: 1, account: [{ id: 'a', name: 'stale', domainid: 'domain' }] } }); await old
  expect(w.vm.options.map(row => row.id)).toEqual(['project']); expect(w.emitted('change').slice(-1)[0][0]).toMatchObject({ ready: true, owner: { projectid: 'project' } })
})
test('owner lookup failure is retryable and never falls back to another account', async () => {
  getAPI.mockRejectedValueOnce(new Error('offline')); const { w } = render(Owner, true); await flush(); expect(w.vm.error).toBe(true); expect(w.emitted('change').slice(-1)[0][0].ready).toBe(false)
  await w.vm.retry(); await flush(); expect(w.vm.selection).toBe('owner'); expect(w.emitted('change').slice(-1)[0][0].ready).toBe(true)
})
test('owner options traverse all API pages, including an account beyond the first 500', async () => {
  const first = Array.from({ length: 500 }, (_, i) => ({ id: String(i), name: String(i) }))
  const get = jest.fn().mockResolvedValueOnce({ listaccountsresponse: { count: 501, account: first } }).mockResolvedValueOnce({ listaccountsresponse: { count: 501, account: [{ id: 'last', name: 'last' }] } })
  const rows = await affinityOwnerOptions(get, 'account', 'domain'); expect(rows).toHaveLength(501); expect(get.mock.calls[1][1]).toMatchObject({ page: 2, domainid: 'domain', ignoreproject: true })
})
