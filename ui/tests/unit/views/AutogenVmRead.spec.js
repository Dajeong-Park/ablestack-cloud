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
import InstanceTab from '@/views/compute/InstanceTab'
import { vmReadApi } from '@/utils/vmRead'
import { hasAccessToRoute } from '@/store/modules/permission'
import store from '@/store'
import { getAPI, callAPI } from '@/api'
jest.mock('@/api', () => ({ getAPI: jest.fn(), postAPI: jest.fn(), callAPI: jest.fn() }))
jest.mock('@/store', () => ({ getters: {}, state: { user: { token: 'session' } } }))
jest.mock('@/config/router', () => ({ asyncRouterMap: () => [], constantRouterMap: [] }))
const id = '12345678-1234-1234-1234-123456789abc'
const caps = { listVirtualMachines: {}, listVirtualMachinesMetrics: {} }
function context (apis, detail = false, metrics = false) {
  store.getters = { apis, metrics, defaultListViewPageSize: 20, userInfo: { id: 'u', roleid: 'r', roletype: 'User' }, project: {}, customColumns: {}, listAllProjects: false }
  const c = { $store: store, $route: { name: 'vm', path: detail ? '/vm/' + id : '/vm', fullPath: detail ? '/vm/' + id : '/vm', params: detail ? { id } : {}, query: {}, meta: { name: 'vm', permission: ['listVirtualMachinesMetrics'], permissionAny: Object.keys(caps), params: { details: 'iso,volume' }, columns: ['displayname', 'state'], details: ['name', 'id'], actions: [], filters: [] } }, $router: { replace: jest.fn(), push: jest.fn() }, $refs: { listview: { resetSelection: jest.fn() } }, $emit: jest.fn(), $t: k => k, $showIcon: () => false, $i18n: { locale: 'ko_KR' }, $nextTick: cb => cb(), $notifyError: jest.fn() }
  Object.assign(c, Autogen.data.call(c)); Object.entries(Autogen.methods).forEach(([k, f]) => { c[k] = f.bind(c) }); c.updateSelectedColumns = jest.fn(); return c
}
function readCalls () { return [...getAPI.mock.calls, ...callAPI.mock.calls] }
beforeEach(() => { jest.clearAllMocks(); const respond = async api => ({ [api.toLowerCase() + 'response']: { virtualmachine: [{ id, name: 'VM', isos: [{ id: 'media' }] }], count: 1 } }); callAPI.mockImplementation(respond); getAPI.mockImplementation(respond) })
test.each([[{}, false], [{ listVirtualMachines: {} }, true], [{ listVirtualMachinesMetrics: {} }, true], [caps, true]])('VM list/detail routes use explicit alternative read grants %o', (apis, allowed) => {
  for (const path of ['/vm', '/vm/' + id])expect(hasAccessToRoute(Object.keys(apis), { path, meta: { permission: ['listVirtualMachinesMetrics'], permissionAny: Object.keys(caps) } })).toBe(allowed)
})
test('other multi-permission routes retain all-required behavior', () => { expect(hasAccessToRoute(['a'], { meta: { permission: ['a', 'b'] } })).toBe(false); expect(hasAccessToRoute(['a', 'b'], { meta: { permission: ['a', 'b'] } })).toBe(true) })
test.each([false, true])('basic-only VM read works with saved metrics preference %s', async metrics => {
  const c = context({ listVirtualMachines: {} }, false, metrics); await c.fetchData(); expect(readCalls()).toHaveLength(1); expect(readCalls()[0][0]).toBe('listVirtualMachines'); expect(readCalls()[0][1]).toEqual(expect.objectContaining({ details: 'iso,volume' })); expect(c.items[0].id).toBe(id)
})
test('basic-only direct detail uses allowed API and preserves ISO metadata', async () => { const c = context({ listVirtualMachines: {} }, true, true); await c.fetchData(); expect(readCalls()).toHaveLength(1); expect(readCalls()[0][0]).toBe('listVirtualMachines'); expect(c.resource.isos).toEqual([{ id: 'media' }]) })
test('neither grant sends no broad/empty command or stale selection', async () => { const c = context({}); c.items = [{ id }]; c.selectedRowKeys = [id]; await c.fetchData(); expect(callAPI).not.toHaveBeenCalled(); expect(getAPI).not.toHaveBeenCalled(); expect(c.items).toEqual([]); expect(c.selectedRowKeys).toEqual([]); expect(c.listRefreshError).toBe(true) })
test('metrics-only roles retain their previous allowed query', () => { expect(vmReadApi({ listVirtualMachinesMetrics: {} }, { metrics: false })).toBe('listVirtualMachinesMetrics'); expect(vmReadApi(caps, { metrics: false })).toBe('listVirtualMachines'); expect(vmReadApi(caps, { dataView: true })).toBe('listVirtualMachinesMetrics') })
test('usage history deep link is not an unauthorized graph request', () => { const c = { $route: { query: { tab: 'stats' }, path: '/vm/' + id }, $store: { getters: { apis: { listVirtualMachines: {} } } } }; expect(InstanceTab.methods.resolveCurrentTabFromRoute.call(c)).toBe('details') })
