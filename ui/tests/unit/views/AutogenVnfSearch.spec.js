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
import Autogen from '@/views/AutogenView'
import Search from '@/components/view/SearchView'
import SearchFilter from '@/components/view/SearchFilter'
import store from '@/store'
import { getAPI, postAPI } from '@/api'
import { vnfListQuery, vnfSearchKeys } from '@/utils/vnfSearch'
jest.mock('@/api', () => ({ getAPI: jest.fn(), callAPI: jest.fn(), postAPI: jest.fn() }))
jest.mock('@/store', () => ({ getters: {}, state: { user: { token: 'session' } } }))
const id = '11111111-1111-4111-8111-111111111111'
const other = '22222222-2222-4222-8222-222222222222'
const row = { id, name: 'host-a', displayname: 'Display A', templatetype: 'VNF', state: 'Running', zoneid: id, templateid: id, serviceofferingid: id, domainid: id, account: 'owner', nic: [{ networkid: id }] }
let c
function route (query = {}, path = '/vnfapp') {
  const q = vnfListQuery(query, 20, store.getters)
  c.$route = { name: path === '/vnfapp' ? 'vnfapp' : 'vnfapp-detail', path, fullPath: path + '?' + new URLSearchParams(q), params: path === '/vnfapp' ? {} : { id }, query: q, meta: { name: 'vnfapp', permission: ['listVnfAppliances'], columns: ['displayname', 'state'], actions: [{ api: 'destroyVirtualMachine', groupAction: true }], searchFilters: vnfSearchKeys, params: () => ({ details: 'all', isvnf: true }) } }
}
beforeEach(() => {
  jest.clearAllMocks()
  store.getters = { defaultListViewPageSize: 20, userInfo: { id: 'actor', roletype: 'Admin' }, project: {}, apis: Object.fromEntries(['listVnfAppliances', 'listVnfTemplates', 'listServiceOfferings', 'listNetworks', 'listZones', 'listAccounts', 'listDomains', 'listInstanceGroups', 'destroyVirtualMachine', 'recoverVirtualMachine'].map(k => [k, {}])), customColumns: {}, metrics: false, listAllProjects: false }
  store.state.user.token = 'session'
  const supported = Object.fromEntries([...vnfSearchKeys, 'tags', 'page', 'pagesize', 'projectid', 'id'].map(k => [k, {}]))
  c = { $store: store, $router: { replace: jest.fn(), push: jest.fn() }, $refs: { listview: { resetSelection: jest.fn() } }, $emit: jest.fn(), $t: k => k, $showIcon: () => false, $getApiParams: () => supported, $i18n: { locale: 'ko_KR' }, $message: { info: jest.fn(), error: jest.fn() }, $notifyError: jest.fn(), $nextTick: fn => fn() }
  route(); Object.assign(c, Autogen.data.call(c)); Object.entries(Autogen.methods).forEach(([k, fn]) => { c[k] = fn.bind(c) }); c.updateSelectedColumns = jest.fn()
  for (const key of ['storageActionReady', 'vnfSearchAuth']) Object.defineProperty(c, key, { get: () => Autogen.computed[key].call(c) })
  getAPI.mockResolvedValue({ listvnfappliancesresponse: { count: 1, virtualmachine: [row] } })
})
function searchContext () {
  const s = { ...c, apiName: 'listVnfAppliances', searchFilters: [...vnfSearchKeys, 'tags'], searchParams: {}, form: {}, $emit: jest.fn() }
  Object.assign(s, Search.data.call(s)); for (const [key, fn] of Object.entries(Search.methods)) s[key] = fn.bind(s)
  for (const key of ['isVnfSearch', 'vnfScope', 'volumeOwnerContext', 'vnfSearchContext']) Object.defineProperty(s, key, { get: () => Search.computed[key].call(s) })
  return s
}
test('compound state, network, VNF template and offering conditions reach the API without UI-only parameters', async () => {
  route({ state: 'Running', networkid: id, templateid: id, serviceofferingid: id, keyword: 'Display', q: 'Display', page: '1' }); await c.fetchData()
  expect(getAPI).toHaveBeenCalledWith('listVnfAppliances', expect.objectContaining({ state: 'Running', networkid: id, templateid: id, serviceofferingid: id, keyword: 'Display', ignoreproject: true, page: 1, pagesize: 20 }), { preserveOnFailure: true, timeout: 20000 })
  expect(getAPI.mock.calls[0][1]).not.toHaveProperty('q'); expect(c.items).toEqual([row]); expect(c.storageActionReady).toBe(true)
})
test('same-context transport failure retains rows, clears selections and offers a recoverable error', async () => {
  await c.fetchData(); c.onRowSelectionChange([id]); expect(c.selectedRowKeys).toEqual([id])
  getAPI.mockRejectedValueOnce({ response: { status: 503 } }); await c.fetchData()
  expect(c.items).toEqual([row]); expect(c.listRefreshError).toBe(true); expect(c.selectedRowKeys).toEqual([]); expect(c.storageActionReady).toBe(false)
  c.execAction({ api: 'destroyVirtualMachine', groupAction: true }, true); expect(postAPI).not.toHaveBeenCalled(); expect(c.showAction).toBe(false)
  await c.fetchData(); expect(c.storageActionReady).toBe(true)
})
test('different query clears old rows synchronously and ignores the slower original response', async () => {
  let done; getAPI.mockImplementationOnce(() => new Promise(resolve => { done = resolve })); const old = c.fetchData()
  route({ state: 'Stopped' }); getAPI.mockResolvedValueOnce({ listvnfappliancesresponse: {} }); const next = c.fetchData()
  expect(c.items).toEqual([]); await next; done({ listvnfappliancesresponse: { count: 1, virtualmachine: [row] } }); await old
  expect(c.items).toEqual([]); expect(c.itemCount).toBe(0); expect(c.listRefreshError).toBe(false)
})
test.each(['token', 'actor', 'role', 'permission'])('%s change invalidates old rows, selection and delayed response', async kind => {
  await c.fetchData(); c.onRowSelectionChange([id]); const previous = c.vnfSearchAuth
  let done; getAPI.mockImplementationOnce(() => new Promise(resolve => { done = resolve })); const old = c.fetchData()
  if (kind === 'token') store.state.user.token = 'new'
  if (kind === 'actor') store.getters.userInfo.id = 'new'
  if (kind === 'role') store.getters.userInfo.roletype = 'User'
  if (kind === 'permission') store.getters.apis = {}
  Autogen.watch.vnfSearchAuth.handler.call(c, c.vnfSearchAuth, previous)
  done({ listvnfappliancesresponse: { count: 1, virtualmachine: [row] } }); await old
  expect(c.items).toEqual([]); expect(c.selectedRowKeys).toEqual([]); c.execAction({ api: 'destroyVirtualMachine' }, true); expect(postAPI).not.toHaveBeenCalled()
})
test('switching project clears predicates, while a URL-driven project synchronization keeps them', async () => {
  const previous = c.vnfSearchAuth; store.getters.project = { id: other }; Autogen.watch.vnfSearchAuth.handler.call(c, c.vnfSearchAuth, previous)
  expect(c.$router.replace).toHaveBeenCalledWith({ path: '/vnfapp', query: { projectid: other, page: '1', pagesize: '20' } })
  c.$router.replace.mockClear(); c.vnfProjectSync = true; Autogen.watch.vnfSearchAuth.handler.call(c, c.vnfSearchAuth, previous); expect(c.$router.replace).not.toHaveBeenCalled()
})
test('all-project switch does not replay the old default-view URL and reverse the selected scope', () => {
  route({ state: 'Running', templateid: id }); const previous = c.vnfSearchAuth
  store.getters.listAllProjects = true
  Autogen.watch.vnfSearchAuth.handler.call(c, c.vnfSearchAuth, previous)
  Autogen.watch['$store.getters.listAllProjects'].call(c, true)
  expect(c.$router.replace).toHaveBeenCalledWith({ path: '/vnfapp', query: { projectid: '-1', page: '1', pagesize: '20' } })
  expect(getAPI).not.toHaveBeenCalled(); expect(store.getters.listAllProjects).toBe(true)
})
test('canonicalizing predicates while a project lookup is pending does not discard the requested project', async () => {
  store.getters.apis.listProjects = {}; route({ projectid: other })
  let done; getAPI.mockImplementationOnce(() => new Promise(resolve => { done = resolve }))
  store.dispatch = jest.fn((action, value) => { if (action === 'SetProject') store.getters.project = value; if (action === 'SetListAllProjects') store.getters.listAllProjects = value; return Promise.resolve() })
  c.fetchData = jest.fn(); const pending = c.syncSnapshotProject(other)
  route({ projectid: other, keyword: 'Display' }); done({ listprojectsresponse: { project: [{ id: other, name: 'owned project' }] } }); await pending
  expect(store.dispatch).toHaveBeenCalledWith('SetProject', { id: other, name: 'owned project' }); expect(c.fetchData).toHaveBeenCalled(); expect(c.vnfProjectSync).toBe(false)
})
test('a delayed project lookup from a previous role cannot set the current project or display its name', async () => {
  store.getters.apis.listProjects = {}; route({ projectid: other })
  let done; getAPI.mockImplementationOnce(() => new Promise(resolve => { done = resolve }))
  store.dispatch = jest.fn(); c.fetchData = jest.fn(); const pending = c.syncSnapshotProject(other)
  store.getters.userInfo.roletype = 'User'; delete store.getters.apis.listProjects
  done({ listprojectsresponse: { project: [{ id: other, name: 'previous-role-project' }] } }); await pending
  expect(store.dispatch).not.toHaveBeenCalled(); expect(c.fetchData).toHaveBeenCalled(); expect(c.items).toEqual([])
})
test('a search changes page to one and preserves advanced conditions; changing page size also returns to page one', () => {
  route({ state: 'Running', networkid: id, page: '3' }); c.onSearch({ searchQuery: 'Display' })
  expect(c.$router.push.mock.calls[0][0].query).toMatchObject({ state: 'Running', networkid: id, keyword: 'Display', page: '1' })
  c.changePage(3, 50); expect(c.$router.push.mock.calls[1][0].query.page).toBe(1)
  c.removeFilter({ key: 'state' }); expect(c.$router.push.mock.calls[2][0].query.state).toBeUndefined()
})
test('legacy and unsupported URL fields do not silently become an unfiltered request', async () => {
  route({ hostid: id }); await c.fetchData(); expect(getAPI).not.toHaveBeenCalled(); expect(c.vnfSearchFailure).toBe('message.vnf.search.unsupported')
})
test('response scope mismatch is an error, and a genuine empty result is successful', async () => {
  route({ templateid: other }); await c.fetchData(); expect(c.items).toEqual([]); expect(c.listRefreshError).toBe(true)
  getAPI.mockResolvedValueOnce({ listvnfappliancesresponse: {} }); await c.fetchData(); expect(c.listRefreshError).toBe(false); expect(c.itemCount).toBe(0)
})
test('only UUIDs on the current verified page can enter selection or a bulk action', async () => {
  await c.fetchData(); c.onRowSelectionChange([id, other]); expect(c.selectedRowKeys).toEqual([id])
  c.selectedRowKeys = [other]; c.execAction({ api: 'destroyVirtualMachine' }, true); expect(c.showAction).toBe(false)
})
test('search form restores URL values and preserves a keyword when advanced filters submit', async () => {
  route({ state: 'Stopped', templateid: id, keyword: 'Display' }); const s = searchContext(); s.initFields(); s.fillFormFieldValues(); s.fetchStaticFieldData()
  expect(s.form.state).toBe('Stopped'); expect(s.form.templateid).toBe(id); expect(s.fields.find(f => f.name === 'state').opts.map(o => o.id)).toContain('Destroyed')
  s.searchQuery = 'Display'; s.formRef = { value: { validate: () => Promise.resolve() } }; s.handleSubmit(); await Promise.resolve()
  expect(s.$emit).toHaveBeenCalledWith('search', expect.objectContaining({ state: 'Stopped', templateid: id, keyword: 'Display' }))
})
test('basic search does not reset advanced conditions and a reset clears the form in one action', () => {
  const s = searchContext(); s.onSearch('Display'); expect(s.$emit).toHaveBeenCalledWith('search', { searchQuery: 'Display' })
  s.form = { templateid: id }; s.onClear(); expect(s.$emit).toHaveBeenCalledWith('search', {}); expect(s.form).toEqual({})
})
test('unverified resource candidates block submit and owner changes clear dependent UUIDs', () => {
  const s = searchContext(); s.form = { zoneid: id, networkid: id, templateid: id, serviceofferingid: id }; s.vnfBlocked = { templateid: true }; s.handleSubmit(); expect(s.$emit).not.toHaveBeenCalled()
  s.onSelectFieldChange('zoneid'); expect(s.form.networkid).toBeUndefined(); expect(s.form.templateid).toBeUndefined(); expect(s.form.serviceofferingid).toBeUndefined()
})
test('VNF summary uses the actual UUID and localized state without generic unscoped lookups', async () => {
  const s = { apiName: 'listVnfAppliances', filterVersion: 0, lookupScope: 'same', $t: k => k, getSearchFilters: jest.fn() }
  await SearchFilter.methods.resolveFilters.call(s, [{ key: 'templateid', value: id }, { key: 'state', value: 'Running' }])
  expect(s.getSearchFilters).not.toHaveBeenCalled(); expect(s.searchFilters).toEqual([expect.objectContaining({ value: id }), expect.objectContaining({ value: 'state.running' })])
})
