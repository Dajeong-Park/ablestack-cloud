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
import PublicIp from '@/views/network/PublicIpResource'
import store from '@/store'
import { getAPI, callAPI } from '@/api'
jest.mock('@/api', () => ({ getAPI: jest.fn(), postAPI: jest.fn(), callAPI: jest.fn() }))
jest.mock('@/store', () => ({ getters: {}, state: { user: { token: 'session' } } }))
const id = '11111111-1111-4111-8111-111111111111'
const other = '22222222-2222-4222-8222-222222222222'
let c
const reply = record => ({ listpublicipaddressesresponse: { count: 1, publicipaddress: [record] } })
function route (target = id) { c.$route = { name: 'publicip', path: '/publicip/' + target, fullPath: '/publicip/' + target, params: { id: target }, query: {}, meta: { name: 'publicip', permission: ['listPublicIpAddresses'], columns: ['ipaddress', 'id'], details: ['vlanname', 'vlanid', 'networkid', 'associatednetworkname'], actions: [] } } }
beforeEach(() => {
  jest.clearAllMocks(); store.state.user.token = 'session'
  store.getters = { defaultListViewPageSize: 20, userInfo: { id: 'admin', roletype: 'Admin' }, project: {}, apis: { listPublicIpAddresses: {} }, customColumns: {}, metrics: false, listAllProjects: false }
  c = { $store: store, $router: { replace: jest.fn(), push: jest.fn() }, $refs: {}, $emit: jest.fn(), $t: k => k, $showIcon: () => false, $i18n: { locale: 'ko_KR' }, $message: { info: jest.fn(), error: jest.fn() }, $notifyError: jest.fn(), $nextTick: fn => fn() }
  route(); Object.assign(c, Autogen.data.call(c)); Object.entries(Autogen.methods).forEach(([k, fn]) => { c[k] = fn.bind(c) }); c.dataView = true; c.updateSelectedColumns = jest.fn()
  for (const key of ['publicIpDetail', 'publicIpAuth']) Object.defineProperty(c, key, { get: () => Autogen.computed[key].call(c) })
  getAPI.mockResolvedValue(reply({ id, vlanid: other, vlanname: 'vlan://untagged', networkid: other }))
})
test('the real detail read preserves the request boundary and applies only the IP response', async () => {
  await c.fetchData()
  expect(getAPI.mock.calls[0][0]).toBe('listPublicIpAddresses'); expect(getAPI.mock.calls[0][1].id).toBe(id)
  expect(getAPI.mock.calls[0][2].preserveOnFailure).toBe(true); expect(callAPI).not.toHaveBeenCalled(); expect(c.resource.vlanid).toBe(other)
})
test('same-target refresh failure retains the VLAN with a failed read state; retry clears failure', async () => {
  await c.fetchData(); getAPI.mockRejectedValueOnce({ response: { status: 503 } }); await c.fetchData({ irefresh: true })
  expect(c.resource.vlanname).toBe('vlan://untagged'); expect(c.listRefreshError).toBe(true)
  expect(c.$emit).toHaveBeenCalledWith('public-ip-read-state', { pending: false, failed: true })
  await c.fetchData({ irefresh: true }); expect(c.listRefreshError).toBe(false)
})
test.each([403, 404, 431])('authoritative denial %s clears former data instead of retaining privileged fields', async status => {
  await c.fetchData(); getAPI.mockRejectedValueOnce({ response: { status } }); await c.fetchData({ irefresh: true })
  expect(c.resource).toEqual({}); expect(c.$emit).toHaveBeenCalledWith('change-resource', {}); expect(c.$router.push).not.toHaveBeenCalled()
})
test.each(['ip', 'project', 'role', 'session'])('a late response cannot cross %s', async change => {
  await c.fetchData(); let finish; getAPI.mockImplementationOnce(() => new Promise(resolve => { finish = resolve })); const pending = c.fetchData({ irefresh: true })
  if (change === 'ip') route(other)
  if (change === 'project') store.getters.project = { id: other }
  if (change === 'role') store.getters.userInfo.roletype = 'User'
  if (change === 'session') store.state.user.token = 'new'
  const target = change === 'ip' ? other : id
  getAPI.mockResolvedValueOnce(reply({ id: target, ipaddress: 'current' })); await c.fetchData()
  finish(reply({ id, vlanname: 'old-privileged-value' })); await pending
  expect(c.resource.id).toBe(target); expect(c.resource.vlanname).toBeUndefined()
})
test('role/logout invalidation immediately clears the outer page without another unauthorized read', () => {
  c.resource = { id, vlanname: 'root-only' }; store.state.user.token = ''
  Autogen.watch.publicIpAuth.handler.call(c)
  expect(c.resource).toEqual({}); expect(c.$emit).toHaveBeenCalledWith('change-resource', {}); expect(getAPI).not.toHaveBeenCalled()
})
test('switching outer IP invalidates pending context and names', () => {
  const x = { resource: { id }, tabRequestVersion: 3, contextNetwork: { name: 'old' }, contextVpc: {}, contextCounts: {}, defaultTabs: [], loading: true }
  PublicIp.methods.changeResource.call(x, {})
  expect(x.tabRequestVersion).toBe(4); expect(x.contextNetwork).toBeNull(); expect(x.resource).toEqual({})
})
