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
import { callAPI } from '@/api'
jest.mock('@/api', () => ({ getAPI: jest.fn(), postAPI: jest.fn(), callAPI: jest.fn() }))
jest.mock('@/store', () => ({ getters: {}, state: { user: { token: 'session' } } }))
const linked = { id: 'ip-linked', ipaddress: '192.0.2.1', associatednetworkid: 'network-old', associatednetworkname: 'Old network' }
const free = { id: 'ip-free', ipaddress: '192.0.2.2', state: 'Free' }
const reply = (record, count = 1) => ({ listpublicipaddressesresponse: { count, publicipaddress: [{ ...record }] } })
const deferred = () => { let finish; const promise = new Promise(resolve => { finish = resolve }); return { promise, resolve: finish } }
let c
function route (query = {}) {
  c.$route = { name: 'publicip', path: '/publicip', fullPath: '/publicip?' + new URLSearchParams(query), params: {}, query, meta: { name: 'publicip', permission: ['listPublicIpAddresses'], columns: ['ipaddress', 'associatednetworkname'], actions: [] } }
}
beforeEach(() => {
  jest.clearAllMocks()
  store.getters = { defaultListViewPageSize: 20, userInfo: { id: 'admin', roletype: 'Admin' }, project: {}, apis: { listPublicIpAddresses: {} }, customColumns: {}, metrics: false, listAllProjects: false }
  c = { $store: store, $router: { replace: jest.fn(), push: jest.fn() }, $refs: { listview: { resetSelection: jest.fn(), closeContextQuickView: jest.fn() } }, $emit: jest.fn(), $t: k => k, $showIcon: () => false, $i18n: { locale: 'ko_KR' }, $message: { info: jest.fn(), error: jest.fn() }, $notifyError: jest.fn(), $nextTick: fn => fn() }
  route(); Object.assign(c, Autogen.data.call(c)); Object.entries(Autogen.methods).forEach(([key, fn]) => { c[key] = fn.bind(c) }); c.dataView = false; c.updateSelectedColumns = jest.fn()
  for (const key of ['publicIpDetail', 'publicIpAuth']) Object.defineProperty(c, key, { get: () => Autogen.computed[key].call(c) })
  callAPI.mockResolvedValue(reply(linked))
})
test('same-scope refresh keeps confirmed rows while pending and on a transient failure', async () => {
  await c.fetchData()
  const pending = deferred(); callAPI.mockReturnValueOnce(pending.promise)
  const read = c.fetchData({ irefresh: true })
  expect(c.items).toMatchObject([linked])
  pending.resolve(reply(linked)); await read
  callAPI.mockRejectedValueOnce({ response: { status: 503 } }); await c.fetchData({ irefresh: true })
  expect(c.items).toMatchObject([linked]); expect(c.listRefreshError).toBe(true)
})
test.each(['filter', 'page', 'project'])('%s transition removes old rows and selection before the next response and rejects a late old link', async change => {
  await c.fetchData()
  c.selectedRowKeys = [linked.id]; c.selectedItems = [linked]
  const old = deferred(); callAPI.mockReturnValueOnce(old.promise); const oldRead = c.fetchData({ irefresh: true })
  if (change === 'filter') route({ filter: 'free', state: 'free' })
  if (change === 'page') route({ page: '2', pagesize: '20' })
  if (change === 'project') store.getters.project = { id: 'new-project' }
  const current = deferred(); callAPI.mockReturnValueOnce(current.promise); const currentRead = c.fetchData()
  expect(c.items).toEqual([]); expect(c.itemCount).toBe(0); expect(c.resource).toEqual({})
  expect(c.selectedRowKeys).toEqual([]); expect(c.selectedItems).toEqual([]); expect(c.$refs.listview.resetSelection).toHaveBeenCalled()
  expect(c.$refs.listview.closeContextQuickView).toHaveBeenCalled()
  current.resolve(reply(free, change === 'page' ? 21 : 1)); await currentRead
  old.resolve(reply({ ...linked, associatednetworkname: 'Late stale link' })); await oldRead
  expect(c.items).toMatchObject([free]); expect(c.items[0].associatednetworkid).toBeUndefined(); expect(c.listRequestPending).toBe(false)
})
test('failed destination-scope read never restores the previous network reference', async () => {
  await c.fetchData(); route({ state: 'free', filter: 'free' })
  const error = new Error('controlled read failure'); error.response = { status: 503, headers: { 'x-description': 'controlled read failure' } }
  callAPI.mockRejectedValueOnce(error); await c.fetchData()
  expect(c.items).toEqual([]); expect(c.itemCount).toBe(0)
})
