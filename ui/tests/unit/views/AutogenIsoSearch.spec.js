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

import Autogen from '@/views/AutogenView'
import store from '@/store'
import { isoListQuery, isoSearchFields, isoListOwner } from '@/utils/isoSearch'
import { getAPI, callAPI } from '@/api'
jest.mock('@/api', () => ({ getAPI: jest.fn(), callAPI: jest.fn(), postAPI: jest.fn() }))
jest.mock('@/store', () => ({ getters: {}, state: { user: { token: 'session' } } }))
const id = '11111111-1111-4111-8111-111111111111'
const row = { id, name: 'ISO', format: 'ISO', isready: true, bootable: false, ispublic: false, hypervisor: 'None', account: 'admin' }
const reply = (rows = [row], count = rows.length) => ({ listisosresponse: { count, iso: rows } })
let c
function route (query = {}, detail = false) {
  c.$route = { name: detail ? 'isoDetail' : 'iso', path: '/iso' + (detail ? '/' + id : ''), params: detail ? { id } : {}, query: detail ? query : isoListQuery(query, 20, store.getters), meta: { name: 'iso', permission: ['listIsos'], params: { isofilter: 'self', showunique: true }, columns: ['name', 'state', 'ostypename', 'arch', 'size'], actions: [] } }
  c.$route.fullPath = c.$route.path + '?' + new URLSearchParams(c.$route.query)
}
beforeEach(() => {
  jest.clearAllMocks()
  store.state.user.token = 'session'
  store.getters = { defaultListViewPageSize: 20, userInfo: { id: 'actor', roletype: 'Admin', roleid: 'role' }, project: {}, apis: { listIsos: { params: isoSearchFields.map(name => ({ name })) } }, customColumns: {}, metrics: false, listAllProjects: false }
  c = { $store: store, $router: { replace: jest.fn(), push: jest.fn() }, $refs: {}, $emit: jest.fn(), $t: k => k, $showIcon: () => false, $i18n: { locale: 'ko_KR' }, $message: { info: jest.fn(), error: jest.fn() }, $notifyError: jest.fn(), $nextTick: fn => fn(), $getApiParams: () => Object.fromEntries(isoSearchFields.map(k => [k, {}])) }
  route(); Object.assign(c, Autogen.data.call(c)); Object.entries(Autogen.methods).forEach(([k, fn]) => { c[k] = fn.bind(c) })
  Object.defineProperty(c, 'isIsoList', { get: () => Autogen.computed.isIsoList.call(c) }); c.updateSelectedColumns = jest.fn()
  getAPI.mockResolvedValue(reply())
})
test('actual list read retains server count/page and omits local sort, return and identity fields', async () => {
  route({ bootable: false, isready: true, ispublic: false, page: 2, pagesize: 20, sortkey: 'name', sortorder: 'desc' })
  getAPI.mockResolvedValue(reply([row], 60)); await c.fetchData()
  const params = getAPI.mock.calls[0][1]
  expect(params).toMatchObject({ bootable: 'false', isready: 'true', ispublic: 'false', page: '2', pagesize: '20', isofilter: 'all', ignoreproject: true })
  expect(params).not.toHaveProperty('sortkey'); expect(params).not.toHaveProperty('isoowner'); expect(c.itemCount).toBe(60); expect(c.items).toHaveLength(1)
  expect(c.columns.find(x => x.key === 'name').sortOrder).toBe('descend'); expect(callAPI).not.toHaveBeenCalled()
})
test('detail uses only id and actor project, never list return restrictions', async () => {
  store.getters.project = { id }; route({ isoreturn: '{"isready":"false"}', isoowner: 'owner', isready: false, page: 5 }, true); await c.fetchData()
  expect(getAPI.mock.calls[0][1]).toEqual({ id, listall: true, ignoreproject: true, projectid: id, isofilter: 'all', showunique: false }); expect(c.resource.id).toBe(id)
})
test.each([{ userdataid: 'not-uuid' }, { bootable: 'no' }, { arch: 'future' }])('invalid search sends no broad request %o', async query => {
  route(query); await c.fetchData(); expect(getAPI).not.toHaveBeenCalled(); expect(c.isoListError).toBe('message.iso.search.invalid')
})
test('unsupported and ignored filters are not successful empty/broad results', async () => {
  route({ userdataid: id }); c.$getApiParams = () => ({}); await c.fetchData(); expect(c.isoListError).toBe('message.iso.search.unsupported'); expect(getAPI).not.toHaveBeenCalled()
  c.$getApiParams = () => ({ bootable: {} }); route({ bootable: true }); await c.fetchData(); expect(c.isoListError).toBe('message.iso.search.ignored'); expect(c.items).toEqual([])
})
test('failed GET has retryable ISO error and clearing/reset can recover', async () => {
  getAPI.mockRejectedValueOnce(new Error('offline')); await c.fetchData(); expect(c.isoListError).toBe('message.iso.search.failed'); expect(c.items).toEqual([])
  await c.fetchData(); expect(c.isoListError).toBe(''); expect(c.items[0].id).toBe(id)
})
test.each(['actor', 'role', 'session', 'project'])('late list data cannot cross %s', async change => {
  let release; getAPI.mockImplementationOnce(() => new Promise(resolve => { release = resolve })); const pending = c.fetchData()
  if (change === 'actor') store.getters.userInfo.id = 'other'
  if (change === 'role') store.getters.userInfo.roleid = 'other'
  if (change === 'session') store.state.user.token = 'new'
  if (change === 'project') store.getters.project = { id }
  route(); getAPI.mockResolvedValue(reply([{ ...row, name: 'current' }])); await c.fetchData(); release(reply([{ ...row, name: 'stale' }])); await pending
  expect(c.items[0].name).toBe('current')
})
test('scope watcher clears rows, selection and old filter URL', () => {
  route({ keyword: 'private', page: 3 }); c.items = [row]; c.selectedRowKeys = [id]; store.getters.userInfo.id = 'other'
  Autogen.watch.isoSecurityContext.call(c); expect(c.items).toEqual([]); expect(c.selectedRowKeys).toEqual([])
  expect(c.$router.replace).toHaveBeenCalledWith({ query: isoListQuery({}, 20, store.getters) })
})
test('search/page-size changes reset page while current-page sort preserves it', () => {
  route({ page: 3, pagesize: 20, isready: true }); c.pageSize = 20
  c.onSearch({ searchQuery: 'part' }); expect(c.$router.push.mock.calls[0][0].query).toMatchObject({ keyword: 'part', page: '1' })
  c.changePage(3, 50); expect(c.$router.push.mock.calls[1][0].query.page).toBe(1)
  c.handleTableChange({}, {}, { field: 'name', order: 'ascend' }); expect(c.$router.replace.mock.calls[0][0].query).toMatchObject({ page: '3', sortkey: 'name', sortorder: 'asc' })
  expect(isoListOwner(store.getters)).not.toContain('session')
})

test('ISO saved columns are restored even after another resource enabled metrics', async () => {
  store.getters.metrics = true
  store.getters.customColumns.actor = { '/iso': ['name', 'arch'] }
  await c.fetchData()
  expect(c.selectedColumns).toEqual(['name', 'arch'])
  expect(c.allColumns.find(column => column.key === 'ostypename').width).toBe(148)
})

test('explicit ISO columns remain selected after returning to an all-project list', async () => {
  store.getters.listAllProjects = true
  store.getters.customColumns.actor = { '/iso': ['name', 'state'] }
  route(); c.$route.meta.columns.push('project')
  getAPI.mockResolvedValue(reply([]))
  await c.fetchData()
  expect(c.selectedColumns).toEqual(['name', 'state'])
})
test('hiding the sorted ISO column clears its local sort state', () => {
  route({ sortkey: 'name', sortorder: 'asc' })
  store.dispatch = jest.fn()
  c.selectedColumns = ['name', 'arch']
  c.allColumns = [{ key: 'name', dataIndex: 'name', sorter: () => 0 }, { key: 'arch', dataIndex: 'arch', sorter: () => 0 }]
  Autogen.methods.updateSelectedColumns.call(c, 'name')
  expect(c.$router.replace).toHaveBeenCalledWith({ query: expect.not.objectContaining({ sortkey: expect.anything() }) })
})

test('API-valid legacy filter bookmarks get a dedicated translated selected option', () => {
  expect(Autogen.computed.isoRestoredFilter.call({ isIsoList: true, filterValue: 'sharedexecutable' })).toBe('sharedexecutable')
  expect(Autogen.computed.isoRestoredFilter.call({ isIsoList: false, filterValue: 'sharedexecutable' })).toBe('')
})

test.each([false, true])('unnamed column refresh never rewrites ISO list/detail navigation (detail=%s)', detail => {
  route(detail ? { isoreturn: '{"page":"2","sortkey":"name","sortorder":"asc"}', isoowner: isoListOwner(store.getters), tab: 'zones' } : {}, detail)
  store.dispatch = jest.fn()
  c.selectedColumns = ['name', 'arch']
  c.allColumns = [{ key: 'name', dataIndex: 'name', sorter: () => 0 }, { key: 'arch', dataIndex: 'arch', sorter: () => 0 }]
  Autogen.methods.updateSelectedColumns.call(c)
  expect(c.$router.replace).not.toHaveBeenCalled()
})
