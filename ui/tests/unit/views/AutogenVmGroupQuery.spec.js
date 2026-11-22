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
import store from '@/store'
import { getAPI, callAPI } from '@/api'
jest.mock('@/api', () => ({ getAPI: jest.fn(), postAPI: jest.fn(), callAPI: jest.fn() }))
jest.mock('@/store', () => ({ getters: {}, state: { user: { token: 'session' } } }))
const id = '12345678-1234-1234-1234-123456789abc'
const row = { id, name: 'before', account: 'admin', domainid: id }
const reply = (rows = [row], count = rows.length) => ({ listinstancegroupsresponse: { instancegroup: rows, count } })
let ctx
beforeEach(() => {
  jest.clearAllMocks()
  store.getters = { defaultListViewPageSize: 20, userInfo: { id: 'user', roletype: 'Admin' }, project: {}, apis: { listInstanceGroups: {}, deleteInstanceGroup: {}, createInstanceGroup: {} }, customColumns: {}, metrics: false, listAllProjects: false }
  store.state.user.token = 'session'
  ctx = { $store: store, $route: { name: 'vmgroup', path: '/vmgroup', fullPath: '/vmgroup', params: {}, query: {}, meta: { name: 'vmgroup', permission: ['listInstanceGroups'], columns: ['name', 'account', 'domain'], actions: [{ api: 'deleteInstanceGroup', dataView: true }], searchFilters: ['name', 'account', 'domainid'] } }, $router: { replace: jest.fn(), push: jest.fn() }, $refs: { listview: { resetSelection: jest.fn() } }, $emit: jest.fn(), $t: key => key, $showIcon: () => false, $i18n: { locale: 'ko_KR' }, $message: { info: jest.fn() }, $notifyError: jest.fn(), $nextTick: callback => callback() }
  Object.assign(ctx, Autogen.data.call(ctx))
  Object.entries(Autogen.methods).forEach(([key, fn]) => { ctx[key] = fn.bind(ctx) })
  ctx.updateSelectedColumns = jest.fn()
  getAPI.mockResolvedValue(reply())
  callAPI.mockResolvedValue({ listvirtualmachinesresponse: { virtualmachine: [], count: 0 } })
})
function route (query, path = '/vmgroup') { ctx.$route = { ...ctx.$route, path, fullPath: path + '?' + new URLSearchParams(query), params: path === '/vmgroup' ? {} : { id }, query } }
test('unsupported URL fields are replaced before any group request', async () => {
  route({ zoneid: id, name: 'name', page: '-1' })
  await ctx.fetchData()
  expect(getAPI).not.toHaveBeenCalled()
  expect(ctx.$router.replace).toHaveBeenCalledWith({ query: { name: 'name' } })
  expect(ctx.$message.info).toHaveBeenCalledWith('message.vm.group.query.removed')
})
test('only supported query fields reach a preserved/timeout-bounded group request', async () => {
  route({ name: 'name', account: 'admin', domainid: id, keyword: 'kw', q: 'kw', sortkey: 'name', sortorder: 'asc', page: '2', pagesize: '20' })
  getAPI.mockResolvedValue(reply([row], 40))
  await ctx.fetchData()
  expect(getAPI).toHaveBeenCalledWith('listInstanceGroups', { name: 'name', account: 'admin', domainid: id, keyword: 'kw', page: 2, pagesize: 20, listall: true }, { preserveOnFailure: true, timeout: 20000 })
  expect(ctx.page).toBe(2)
  expect(ctx.columns.find(c => c.key === 'name').sortOrder).toBe('ascend')
})
test('same-context refresh retains rows/count/time/selection until completion', async () => {
  await ctx.fetchData(); const old = ctx.items; const time = ctx.listLastUpdated
  ctx.selectedRowKeys = [id]; ctx.selectedItems = [row]
  let complete; getAPI.mockImplementation(() => new Promise(resolve => { complete = resolve }))
  const refresh = ctx.fetchData({ irefresh: true })
  expect(ctx.items).toBe(old); expect(ctx.itemCount).toBe(1); expect(ctx.listLastUpdated).toBe(time)
  expect(ctx.loading).toBe(false); expect(ctx.vmGroupQueryStatus).toBe('refreshing'); expect(ctx.selectedRowKeys).toEqual([id])
  complete(reply([{ ...row, name: 'after' }])); await refresh
  expect(ctx.items[0].name).toBe('after'); expect(ctx.vmGroupQueryStatus).toBe('ready')
})
test('same-context failure retains successful rows and time but clears selection/actions', async () => {
  await ctx.fetchData(); const old = ctx.items; const time = ctx.listLastUpdated
  ctx.selectedRowKeys = [id]; getAPI.mockRejectedValue(new Error('private error'))
  await ctx.fetchData({ irefresh: true })
  expect(ctx.items).toBe(old); expect(ctx.listLastUpdated).toBe(time); expect(ctx.vmGroupQueryStatus).toBe('error')
  expect(ctx.selectedRowKeys).toEqual([]); expect(ctx.$notifyError).not.toHaveBeenCalled()
  ctx.dataView = true; expect(Autogen.computed.visibleDataViewActions.call(ctx)).toEqual([])
})
test('first failure does not become normal zero or redirect', async () => {
  getAPI.mockRejectedValue(new Error('offline')); await ctx.fetchData()
  expect(ctx.listLoadedScope).toBeNull(); expect(ctx.vmGroupQueryStatus).toBe('error')
  expect(ctx.$router.push).not.toHaveBeenCalled()
})
test.each([403, 432, 531])('permission %i removes old data/actions and preserves only last successful time', async code => {
  await ctx.fetchData(); const time = ctx.listLastUpdated
  getAPI.mockRejectedValue({ response: { status: 403, data: { errorresponse: { errorcode: code } } } })
  await ctx.fetchData(); expect(ctx.vmGroupQueryStatus).toBe('forbidden'); expect(ctx.items).toEqual([]); expect(ctx.resource).toEqual({}); expect(ctx.listLoadedScope).toBeNull(); expect(ctx.listLastUpdated).toBe(time)
})
test('empty success updates status and can be retried after a failure', async () => {
  getAPI.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ listinstancegroupsresponse: {} })
  await ctx.fetchData(); await ctx.fetchData()
  expect(ctx.vmGroupQueryStatus).toBe('empty'); expect(ctx.listLoadedScope).toBe(ctx.listScope()); expect(ctx.listLastUpdated).not.toBeNull()
})
test('partial malformed response preserves the prior success time and data', async () => {
  await ctx.fetchData(); const time = ctx.listLastUpdated
  getAPI.mockResolvedValue({ listinstancegroupsresponse: { count: 2, instancegroup: { broken: true } } })
  await ctx.fetchData(); expect(ctx.vmGroupQueryStatus).toBe('error'); expect(ctx.listLastUpdated).toBe(time); expect(ctx.items[0].id).toBe(id)
})
test.each(['account', 'keyword', 'page', 'project', 'session', 'target'])('%s change clears previous data/selection and rejects a late response', async change => {
  await ctx.fetchData(); ctx.selectedRowKeys = [id]
  const resolves = []; getAPI.mockImplementation(() => new Promise(resolve => resolves.push(resolve)))
  const old = ctx.fetchData()
  if (change === 'project') store.getters.project = { id }
  else if (change === 'session') store.state.user.token = 'new'
  else if (change === 'target') route({}, '/vmgroup/' + id)
  else route(change === 'page' ? { page: '2' } : change === 'keyword' ? { keyword: 'new', q: 'new' } : { account: 'other', domainid: id })
  const current = ctx.fetchData()
  expect(ctx.items).toEqual([]); expect(ctx.resource).toEqual({}); expect(ctx.selectedRowKeys).toEqual([]); expect(ctx.listLastUpdated).toBeNull()
  resolves[1](reply([{ ...row, name: 'current' }], 40)); await current
  resolves[0](reply([{ ...row, name: 'late' }], 40)); await old
  expect(ctx.items[0].name).toBe('current'); expect(ctx.vmGroupQueryStatus).toBe('ready'); expect(ctx.listRequestPending).toBe(false)
})
test('late error does not replace success in a different context', async () => {
  let fail; getAPI.mockImplementationOnce(() => new Promise((resolve, reject) => { fail = reject }))
  const old = ctx.fetchData(); route({ account: 'other', domainid: id }); await ctx.fetchData(); fail(new Error('old failure')); await old
  expect(ctx.vmGroupQueryStatus).toBe('ready'); expect(ctx.listRefreshError).toBe(false)
})
test('unnamed detail refresh uses the group contract and preserves its tab/missing state', async () => {
  route({ tab: 'comments' }, '/vmgroup/' + id)
  delete ctx.$route.name
  await ctx.fetchData()
  expect(getAPI).toHaveBeenCalledWith('listInstanceGroups', { id, listall: true, page: 1, pagesize: 20 }, { preserveOnFailure: true, timeout: 20000 })
  getAPI.mockResolvedValue(reply([])); await ctx.fetchData({ irefresh: true })
  expect(ctx.vmGroupQueryStatus).toBe('missing'); expect(ctx.resource).toEqual({}); expect(ctx.$route.query.tab).toBe('comments'); expect(ctx.$router.push).not.toHaveBeenCalled()
})
test('page sort changes preserve paging/search and are excluded from server parameters', () => {
  route({ keyword: 'kw', q: 'kw', page: '2', pagesize: '20' })
  ctx.handleTableChange({}, {}, { field: 'name', order: 'descend' })
  expect(ctx.$router.push).toHaveBeenCalledWith({ query: { keyword: 'kw', q: 'kw', page: '2', pagesize: '20', sortkey: 'name', sortorder: 'desc' } })
})
test('VM reads still use the established generic API', async () => {
  ctx.$route = { name: 'vm', path: '/vm', fullPath: '/vm', params: {}, query: {}, meta: { permission: ['listVirtualMachines'], columns: ['name'] } }
  await ctx.fetchData(); expect(callAPI).toHaveBeenCalledWith('listVirtualMachines', expect.objectContaining({ page: 1, pagesize: 20, listall: true })); expect(getAPI).not.toHaveBeenCalled()
})

test('HTTP 200 permission error is not reported as a successful empty response', async () => {
  getAPI.mockResolvedValue({ listinstancegroupsresponse: { errorcode: 531 } })
  await ctx.fetchData(); expect(ctx.vmGroupQueryStatus).toBe('forbidden'); expect(ctx.listLastUpdated).toBeNull()
})
test('a disposed view never applies its delayed group response', async () => {
  let complete; getAPI.mockImplementation(() => new Promise(resolve => { complete = resolve }))
  const request = ctx.fetchData(); Autogen.beforeUnmount.call(ctx)
  complete(reply()); await request; expect(ctx.items).toEqual([]); expect(ctx.listLastUpdated).toBeNull()
})

test('unnamed group detail refuses forbidden/stale actions through group status', async () => {
  route({ tab: 'comments' }, '/vmgroup/' + id); delete ctx.$route.name
  await ctx.fetchData()
  getAPI.mockRejectedValue({ response: { status: 403 } }); await ctx.fetchData()
  expect(ctx.vmGroupQueryStatus).toBe('forbidden'); expect(ctx.resource).toEqual({}); expect(ctx.items).toEqual([])
  expect(Autogen.computed.visibleDataViewActions.call(ctx)).toEqual([])
})
