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
import { mount, flushPromises } from '@vue/test-utils'
import { reactive } from 'vue'
import { getAPI, postAPI } from '@/api'
import Picker from '@/views/compute/wizard/OwnershipSelection'
import Create from '@/views/storage/CreateBucket'
import Summary from '@/components/view/BucketOwnerContext'
import { scopedOwnershipOptions, bucketOwnerParameters } from '@/utils/scopedOwnership'
jest.mock('@/api', () => ({ getAPI: jest.fn(), postAPI: jest.fn() }))
const domain = id => ({ id, name: id, path: 'ROOT/' + id, state: 'Active' })
const account = (name, domainid = 'd', extra = {}) => ({ id: name + '-id', name, domainid, type: 0, state: 'Enabled', ...extra })
const project = (id = 'p', domainid = 'd') => ({ id, name: id, domainid, state: 'Active' })
const page = (envelope, key, rows, count = rows.length) => ({ [envelope]: { count, [key]: rows } })
const state = (role = 'Admin', domainid = 'd') => reactive({ state: { user: { token: 'session' } }, getters: { userInfo: { id: 'caller', roleid: 'role', account: 'self', domainid, domain: domainid, roletype: role }, project: {}, apis: { listAccounts: {}, listDomains: {}, listResourceLimits: {} } } })
const stubSelect = { props: ['value', 'disabled'], emits: ['update:value', 'change'], template: '<select :value="value" :disabled="disabled" @change="$emit(\'update:value\', $event.target.value); $emit(\'change\', $event.target.value)"><slot/></select>' }
const stubButton = { props: ['disabled', 'loading'], template: '<button :disabled="disabled || loading"><slot/></button>' }
const globals = s => ({ mocks: { $store: s, $t: key => key, $notifyError: jest.fn(), $pollJob: jest.fn(), $toLocaleDate: v => v }, stubs: { 'a-form': { methods: { validate: () => Promise.resolve(), scrollToField: () => {} }, template: '<form><slot/></form>' }, 'a-form-item': { template: '<div><slot/></div>' }, 'a-spin': { template: '<div><slot/></div>' }, 'a-alert': { props: ['message'], template: '<div>{{ message }}<slot name="message"/><slot name="description"/></div>' }, 'a-button': stubButton, 'a-select': stubSelect, 'a-select-option': { props: ['value'], template: '<option :value="value"><slot/></option>' }, 'a-input': true, 'a-switch': true, BucketQuotaContext: true, BucketProtectionCapabilities: true, ResourceIcon: true } })
function defaults (api, p = {}) {
  if (api === 'listDomains') return Promise.resolve(page('listdomainsresponse', 'domain', [domain('d'), domain('other')]))
  if (api === 'listAccounts') return Promise.resolve(page('listaccountsresponse', 'account', [account('self', p.domainid), account('target', p.domainid), account('disabled', p.domainid, { state: 'Disabled' })]))
  if (api === 'listProjects') return Promise.resolve(page('listprojectsresponse', 'project', [project('p', p.domainid), { ...project('suspended', p.domainid), state: 'Suspended' }]))
  if (api === 'listObjectStoragePools') return Promise.resolve({ listobjectstoragepoolsresponse: { objectstore: [{ id: 'store', name: 'Glue', capabilities: { encryption: 'Unsupported', versioning: 'Supported', objectlocking: 'Supported' } }] } })
  if (api === 'listResourceLimits') return Promise.resolve(page('listresourcelimitsresponse', 'resourcelimit', [{ account: p.account, domainid: p.domainid, projectid: p.projectid, resourcetype: p.resourcetypename === 'bucket' ? '14' : '15', max: p.account === 'target' ? 3 : 10 }]))
  throw new Error('Unexpected API ' + api)
}
const pick = s => mount(Picker, { props: { embedded: true, safeScope: true }, global: globals(s) })
const create = s => mount(Create, { props: { resource: {} }, global: globals(s) })
const fill = w => { w.vm.form.name = 'qa-bucket'; w.vm.form.quota = '1' }
beforeEach(() => { jest.clearAllMocks(); getAPI.mockImplementation(defaults); postAPI.mockResolvedValue({ createbucketresponse: { jobid: 'job' } }) })
it('reads every options page and excludes disabled and project accounts', async () => {
  const rows = Array.from({ length: 500 }, (_, i) => account('a' + i)); const api = jest.fn().mockResolvedValueOnce(page('listaccountsresponse', 'account', rows, 502)).mockResolvedValueOnce(page('listaccountsresponse', 'account', [account('disabled', 'd', { state: 'Disabled' }), account('project', 'd', { type: 5 })], 502))
  expect(await scopedOwnershipOptions(api, 'accounts', { domainid: 'd' })).toHaveLength(500)
  expect(api.mock.calls[1][1]).toMatchObject({ page: 2, pagesize: 500, domainid: 'd', ignoreproject: true })
})
it('rejects malformed or incomplete option responses', async () => {
  for (const value of [{}, page('listaccountsresponse', 'account', [], 2)]) {
    await expect(scopedOwnershipOptions(jest.fn().mockResolvedValue(value), 'accounts', { domainid: 'd' })).rejects.toThrow()
  }
})
it('filters descendant accounts to an exact domain and retains only safe choice fields', async () => {
  const api = jest.fn().mockResolvedValue(page('listaccountsresponse', 'account', [account('owner', 'd', { user: [{ apikey: 'example', secretkey: 'example' }], accountdetails: { internal: 'example' } }), account('child', 'child-domain'), account('project', 'd', { accounttype: 5 })]))
  const rows = await scopedOwnershipOptions(api, 'accounts', { domainid: 'd' }); expect(rows.map(v => v.name)).toEqual(['owner']); expect(rows[0].user).toBeUndefined(); expect(rows[0].accountdetails).toBeUndefined()
})
it('keeps caller ownership omitted and uses mutually exclusive target parameters', () => {
  const caller = { account: 'self', domainid: 'd' }
  expect(bucketOwnerParameters({ selectedAccountType: 'Account', selectedAccount: 'self', selectedDomain: 'd' }, caller)).toEqual({})
  expect(bucketOwnerParameters({ selectedAccountType: 'Account', selectedAccount: 'target', selectedDomain: 'd' }, caller)).toEqual({ account: 'target', domainid: 'd' })
  expect(bucketOwnerParameters({ selectedAccountType: 'Project', selectedProject: 'p', selectedAccount: 'stale', selectedDomain: 'stale' }, caller)).toEqual({ projectid: 'p' })
  expect(bucketOwnerParameters(null, caller, { id: 'active-project' })).toEqual({ projectid: 'active-project' })
})
it('initializes the permitted current account without selecting a disabled account', async () => {
  const w = pick(state()); await flushPromises(); expect(w.vm.selectedAccount).toBe('self'); expect(w.vm.safeReady).toBe(true); expect(w.vm.accounts.map(v => v.name)).not.toContain('disabled'); w.unmount()
})
it('clears the account immediately on a domain change and requires an explicit new choice', async () => {
  const w = pick(state()); await flushPromises(); await w.findAll('select')[1].setValue('other'); await flushPromises()
  expect(w.vm.selectedAccount).toBeUndefined(); expect(w.vm.safeReady).toBe(false)
  await w.findAll('select')[2].setValue('target'); await flushPromises(); expect(w.vm.safeReady).toBe(true); expect(w.emitted('fetch-owner').slice(-1)[0][0]).toMatchObject({ selectedDomain: 'other', selectedAccount: 'target', ready: true }); w.unmount()
})
it('does not expose an old domain response that arrives after a new selection', async () => {
  let oldResolve; const w = pick(state()); await flushPromises()
  getAPI.mockImplementationOnce(() => new Promise(resolve => { oldResolve = resolve })).mockImplementation(defaults)
  const first = w.vm.fetchAccounts(); w.vm.selectedDomain = 'other'; w.vm.changeAccountTypeOrDomain(); await flushPromises()
  oldResolve(page('listaccountsresponse', 'account', [account('old')])); await first; await flushPromises()
  expect(w.vm.accounts.every(a => a.domainid === 'other')).toBe(true); expect(w.vm.selectedAccount).toBeUndefined(); w.unmount()
})
it('blocks owner submission on failed refresh and restores only the previously selected authorized owner', async () => {
  const w = pick(state()); await flushPromises(); w.vm.selectedAccount = 'target'; w.vm.emitChangeEvent()
  getAPI.mockRejectedValueOnce(new Error('offline')); await w.vm.fetchAccounts(); expect(w.vm.safeReady).toBe(false); expect(w.vm.selectedAccount).toBeNull(); expect(w.text()).toContain('message.bucket.owner.options.failed')
  await w.vm.retrySafe(); expect(w.vm.selectedAccount).toBe('target'); expect(w.vm.safeReady).toBe(true); w.unmount()
})
it('ignores pending options after identity changes and stops requests after losing admin scope', async () => {
  let resolveOld; const s = state(); const w = pick(s); await flushPromises(); getAPI.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve })); const pending = w.vm.fetchAccounts()
  s.getters.userInfo.roletype = 'User'; await flushPromises(); resolveOld(page('listaccountsresponse', 'account', [account('old')])); await pending; await flushPromises()
  expect(w.vm.safeReady).toBe(false); expect(w.vm.accounts).toEqual([]); w.unmount()
})
it('creates for the selected account/domain and preserves its values on write failure', async () => {
  const w = create(state()); await flushPromises(); const owner = w.findComponent(Picker); await owner.findAll('select')[2].setValue('target'); await flushPromises(); fill(w)
  postAPI.mockRejectedValueOnce(new Error('503')); await w.vm.handleSubmit(); expect(w.vm.form.name).toBe('qa-bucket'); expect(w.vm.form.quota).toBe('1'); expect(w.vm.ownerParams).toEqual({ account: 'target', domainid: 'd' }); expect(w.emitted('close-action')).toBeUndefined()
  await w.vm.handleSubmit(); expect(postAPI.mock.calls[1][1]).toMatchObject({ account: 'target', domainid: 'd', ignoreproject: true, quota: 1 }); expect(w.emitted('close-action')).toHaveLength(1); w.unmount()
})
it('keeps normal user ownership fixed and never sends foreign owner parameters', async () => {
  const w = create(state('User')); await flushPromises(); expect(w.findComponent(Picker).exists()).toBe(false); fill(w); await w.vm.handleSubmit()
  const data = postAPI.mock.calls[0][1]; expect(data.account).toBeUndefined(); expect(data.domainid).toBeUndefined(); expect(data.projectid).toBeUndefined(); w.unmount()
})
it('uses only projectid in an active project and closes on a project context change', async () => {
  const s = state('User'); s.getters.project = project(); const w = create(s); await flushPromises(); expect(w.findComponent(Picker).exists()).toBe(false); fill(w); await w.vm.handleSubmit()
  expect(postAPI.mock.calls[0][1]).toMatchObject({ projectid: 'p', ignoreproject: true }); expect(postAPI.mock.calls[0][1].account).toBeUndefined(); expect(postAPI.mock.calls[0][1].domainid).toBeUndefined(); w.unmount()
  const live = create(s); await flushPromises(); s.getters.project = project('new'); await flushPromises(); expect(live.emitted('close-action')).toHaveLength(1); expect(live.vm.ownerReady).toBe(false); live.unmount()
})
it('creates for a chosen project from the shared owner picker without leaking account/domain', async () => {
  const w = create(state()); await flushPromises(); const owner = w.findComponent(Picker); await owner.findAll('select')[0].setValue('Project'); await flushPromises(); expect(owner.vm.projects.map(v => v.id)).toEqual(['p']); await owner.findAll('select')[2].setValue('p'); await flushPromises(); fill(w); await w.vm.handleSubmit()
  const data = postAPI.mock.calls[0][1]; expect(data.projectid).toBe('p'); expect(data.account).toBeUndefined(); expect(data.domainid).toBeUndefined(); w.unmount()
})
it('prevents duplicate submissions during validation and rejects a late old-owner validation', async () => {
  const w = create(state()); await flushPromises(); fill(w); let finish
  w.vm.formRef.value.validate = () => new Promise(resolve => { finish = resolve })
  const pending = w.vm.handleSubmit(); await w.vm.handleSubmit(); expect(postAPI).not.toHaveBeenCalled()
  w.vm.ownerChanged({ ready: true, selectedAccountType: 'Account', selectedAccount: 'target', selectedDomain: 'd' }); finish(); await pending; expect(postAPI).not.toHaveBeenCalled(); expect(w.vm.validating).toBe(false); w.unmount()
})
it('invalidates a pending form validation and store response on a session change', async () => {
  const s = state('User'); let storeResolve
  getAPI.mockImplementation((api, params) => api === 'listObjectStoragePools' ? new Promise(resolve => { storeResolve = resolve }) : defaults(api, params))
  const w = create(s); s.state.user.token = 'new-session'; await flushPromises(); storeResolve({ listobjectstoragepoolsresponse: { objectstore: [{ id: 'old' }] } }); await flushPromises()
  expect(w.vm.objectstores).toEqual([]); expect(w.emitted('close-action')).toHaveLength(1); w.unmount()
})
it('refreshes owner limits with the new target and shows unknown on a failed or partial read', async () => {
  const s = state(); const owner = { selectedAccountType: 'Account', selectedAccount: 'self', selectedDomain: 'd' }; const w = mount(Summary, { props: { owner, scope: 'session', ready: true, storeName: 'Glue', quota: '1' }, global: globals(s) }); await flushPromises(); expect(w.vm.limits.bucket).toBe(10)
  getAPI.mockRejectedValueOnce(new Error('offline')); await w.setProps({ owner: { ...owner, selectedAccount: 'target' } }); await flushPromises(); expect(w.vm.limits).toBeNull(); expect(w.text()).toContain('message.bucket.owner.limits.failed')
  await w.vm.load(); expect(w.vm.limits.bucket).toBe(3); w.unmount()
})
it('ignores old owner limit responses and rejects null or wrong-scope limits', async () => {
  let resolveOld; getAPI.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve })).mockImplementation(defaults)
  const owner = { selectedAccountType: 'Account', selectedAccount: 'self', selectedDomain: 'd' }; const w = mount(Summary, { props: { owner, scope: 'session', ready: true }, global: globals(state()) }); await w.setProps({ owner: { ...owner, selectedAccount: 'target' } }); await flushPromises(); resolveOld(page('listresourcelimitsresponse', 'resourcelimit', [{ account: 'self', domainid: 'd', resourcetype: '14', max: 99 }])); await flushPromises(); expect(w.vm.limits.bucket).toBe(3)
  getAPI.mockResolvedValue(page('listresourcelimitsresponse', 'resourcelimit', [{ account: 'target', domainid: 'd', resourcetype: '14', max: null }])); await w.vm.load(); expect(w.vm.limits).toBeNull(); w.unmount()
})
