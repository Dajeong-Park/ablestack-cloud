// Licensed to the Apache Software Foundation (ASF) under one or more
// contributor license agreements. See the NOTICE file distributed with this
// work for additional information regarding copyright ownership. The ASF
// licenses this file under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License. You may
// obtain a copy at http://www.apache.org/licenses/LICENSE-2.0 . Unless required
// by applicable law or agreed to in writing, software distributed under the
// License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS.
import Autogen from '@/views/AutogenView'
import store from '@/store'
import { asnQuery } from '@/utils/asnSearch'
import { getAPI } from '@/api'
jest.mock('@/api', () => ({ getAPI: jest.fn(), postAPI: jest.fn(), callAPI: jest.fn() }))
jest.mock('@/store', () => ({ getters: {}, state: { user: { token: 'session' } } }))
const linked = { id: 'member', asnumber: 4200000000, allocationstate: 'Free' }
const reply = (record, count = 1) => ({ listasnumbersresponse: { count, asnumber: [{ ...record }] } })
const deferred = () => { let finish; const promise = new Promise(resolve => { finish = resolve }); return { promise, resolve: finish } }
let c
function route (query = {}) {
  c.$route = { name: 'asnumbers', path: '/asnumbers', fullPath: '/asnumbers?' + new URLSearchParams(query), params: {}, query: asnQuery(query, 20, store.getters), meta: { name: 'asnumbers', permission: ['listASNumbers'], columns: ['asnumber', 'allocationstate'], actions: [] } }
}
beforeEach(() => {
  jest.clearAllMocks()
  store.getters = { defaultListViewPageSize: 20, userInfo: { id: 'admin', roletype: 'Admin', domainid: '11111111-1111-4111-8111-111111111111' }, project: {}, apis: { listASNumbers: {} }, customColumns: {}, metrics: false, listAllProjects: false }
  c = { $store: store, $router: { replace: jest.fn(), push: jest.fn() }, $refs: { listview: { resetSelection: jest.fn(), closeContextQuickView: jest.fn() } }, $emit: jest.fn(), $t: k => k, $getApiParams: () => Object.fromEntries(['state', 'allocatedonly', 'domainid', 'isrecursive', 'projectid', 'page', 'pagesize', 'listall'].map(k => [k, {}])), $showIcon: () => false, $i18n: { locale: 'ko_KR' }, $message: { info: jest.fn(), error: jest.fn() }, $notifyError: jest.fn(), $nextTick: fn => fn() }
  route(); Object.assign(c, Autogen.data.call(c)); Object.entries(Autogen.methods).forEach(([key, fn]) => { c[key] = fn.bind(c) }); c.dataView = false; c.updateSelectedColumns = jest.fn()
  for (const key of ['publicIpDetail', 'publicIpAuth', 'asnSearchAuth']) Object.defineProperty(c, key, { get: () => Autogen.computed[key].call(c) })
  getAPI.mockResolvedValue(reply(linked))
})
test('canonical URL strips arbitrary API arguments before any request', async () => {
  c.$route.query.command = 'deleteASNRange'; await c.fetchData(); expect(getAPI).not.toHaveBeenCalled(); expect(c.$router.replace.mock.calls[0][0].query.command).toBeUndefined()
  route(); await c.fetchData(); expect(getAPI.mock.calls[0][0]).toBe('listASNumbers'); expect(getAPI.mock.calls[0][1]).toEqual({ page: '1', pagesize: '20' })
})
test('invalid exact or unsupported project cannot broaden the list', async () => {
  route({ asnumber: '4294967296' }); await c.fetchData(); expect(c.asnSearchFailure).toBe('integer'); expect(getAPI).not.toHaveBeenCalled()
  route(); store.getters.project = { id: '22222222-2222-4222-8222-222222222222' }; await c.fetchData(); expect(c.asnSearchFailure).toBe('project'); expect(getAPI).not.toHaveBeenCalled()
})
test('same-scope failed refresh preserves rows with failure, while a destination query clears them', async () => {
  await c.fetchData(); getAPI.mockRejectedValueOnce(Error('offline')); await c.fetchData(); expect(c.items).toMatchObject([linked]); expect(c.asnSearchFailure).toBe('lookup')
  route({ asnumber: '64512' }); getAPI.mockRejectedValueOnce(Error('offline')); await c.fetchData(); expect(c.items).toEqual([])
})
test('late old query never replaces the current exact result or count', async () => {
  route({ asnumber: '64512' }); const old = deferred(); getAPI.mockReturnValueOnce(old.promise); const first = c.fetchData()
  await Promise.resolve(); route({ asnumber: '4200000000' }); getAPI.mockResolvedValueOnce(reply(linked)); await c.fetchData()
  old.resolve(reply({ ...linked, asnumber: 64512 })); await first; expect(c.items).toMatchObject([linked]); expect(c.itemCount).toBe(1)
})
test('search, state, reset and page-size changes maintain a canonical route contract', () => {
  route({ asnumber: '4200000000', keyword: '420', filter: 'free', page: '2' }); c.pageSize = 20
  c.changeFilter('all'); expect(c.$router.push.mock.calls[0][0].query).toMatchObject({ asnumber: '4200000000', keyword: '420', filter: 'all', page: '1' }); expect(c.$router.push.mock.calls[0][0].query.isallocated).toBeUndefined()
  c.onSearch({ asnSearch: {} }); expect(c.$router.push.mock.calls[1][0].query).toEqual({ filter: 'all', page: '1', pagesize: '20' })
  c.changePage(2, 50); expect(c.$router.push.mock.calls[2][0].query).toMatchObject({ page: 1, pagesize: 50, asnumber: '4200000000', keyword: '420' })
})
