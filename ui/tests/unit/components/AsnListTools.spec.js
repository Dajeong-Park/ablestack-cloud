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

import Tools from '@/components/view/AsnListTools.vue'
import { getAPI } from '@/api'
jest.mock('@/api', () => ({ getAPI: jest.fn() }))
const id = n => String(n).padStart(8, '0') + '-1111-4111-8111-111111111111'
let c
beforeEach(() => {
  jest.clearAllMocks()
  c = { selected: [], ready: true, scope: 'list', $route: { fullPath: '/asnumbers', query: {} }, $store: { state: { user: { token: 'session' } }, getters: { userInfo: { roletype: 'Admin' }, project: {}, apis: { listZones: {}, listASNRanges: {}, listASNumbers: {}, releaseASNumber: {} } } }, $router: { push: jest.fn() }, $nextTick: fn => fn(), $refs: {}, $emit: jest.fn() }
  Object.assign(c, Tools.data.call(c)); Object.entries(Tools.methods).forEach(([k, f]) => { c[k] = f.bind(c) }); Object.entries(Tools.computed).forEach(([k, f]) => Object.defineProperty(c, k, { get: () => f.call(c) }))
})

test('single eligible Zone routes to the existing tab with list return context', async () => {
  c.$route.query = { asnumber: '4200000000', page: '2', pagesize: '10' }
  getAPI.mockResolvedValue({ listzonesresponse: { count: 1, zone: [{ id: id(1), name: 'Zone', routedmodeenabled: true }] } })
  await c.openRanges(); expect(c.$router.push).toHaveBeenCalledWith(expect.objectContaining({ path: '/zone/' + id(1), query: expect.objectContaining({ tab: 'asnumber' }) }))
  expect(JSON.parse(c.$router.push.mock.calls[0][0].query.asnreturn)).toMatchObject({ page: '2', asnumber: '4200000000' })
})

test('multiple Zones require a choice; unsupported Zones and failed lookup do not route', async () => {
  getAPI.mockResolvedValueOnce({ listzonesresponse: { count: 3, zone: [{ id: id(1), routedmodeenabled: true }, { id: id(2), routedmodeenabled: true }, { id: id(3), routedmodeenabled: false }] } })
  await c.openRanges(); expect(c.rangeVisible).toBe(true); expect(c.zones).toHaveLength(2); expect(c.$router.push).not.toHaveBeenCalled()
  c.zoneid = id(1); getAPI.mockResolvedValueOnce({ listzonesresponse: { count: 1, zone: [{ id: id(1), routedmodeenabled: false }] } }); await c.chooseZone(); expect(c.error).toBe('lookup'); expect(c.$router.push).not.toHaveBeenCalled()
})

test('management paginates Zone candidates and never drops a selected Zone scope', async () => {
  const rows = Array.from({ length: 500 }, (_, n) => ({ id: id(n + 1), routedmodeenabled: true }))
  getAPI.mockResolvedValueOnce({ listzonesresponse: { count: 501, zone: rows } }).mockResolvedValueOnce({ listzonesresponse: { count: 501, zone: [{ id: id(501), routedmodeenabled: true }] } })
  await c.loadZones(); expect(c.zones).toHaveLength(501); expect(getAPI.mock.calls[1][1].page).toBe(2)
  c.$route.query.zoneid = id(9); getAPI.mockResolvedValueOnce({ listzonesresponse: { count: 0 } }); await c.openRanges(); expect(getAPI.mock.calls[2][1].id).toBe(id(9)); expect(c.zones).toHaveLength(0); expect(c.$router.push).not.toHaveBeenCalled()
})

test('missing permissions, unsupported project, stale context and multiple selection are guarded', async () => {
  c.$store.getters.apis = {}; await c.openRanges(); expect(getAPI).not.toHaveBeenCalled(); expect(c.canRelease).toBe(false)
  c.$store.getters.apis = { listZones: {}, listASNRanges: {}, listASNumbers: {}, releaseASNumber: {} }; c.$store.getters.project = { id: id(1) }; expect(c.rangeAllowed).toBe(false)
  c.$store.getters.project = {}; let finish; getAPI.mockImplementationOnce(() => new Promise(resolve => { finish = resolve })); const pending = c.loadZones(); c.scope = 'other'; finish({ listzonesresponse: { count: 1, zone: [{ id: id(1), routedmodeenabled: true }] } }); await pending; expect(c.zones).toHaveLength(0)
  c.selected = [{}, {}]; c.openRelease(); expect(c.target).toBeNull()
})
