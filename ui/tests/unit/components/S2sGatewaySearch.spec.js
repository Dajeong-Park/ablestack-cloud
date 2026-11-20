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

import Select from '@/components/view/S2sGatewaySearchSelect.vue'
import Search from '@/components/view/S2sGatewayFilterChips.vue'
import { getAPI } from '@/api'
jest.mock('@/api', () => ({ getAPI: jest.fn() }))
const id = '11111111-1111-4111-8111-111111111111'
function context () {
  const c = { kind: 'vpcid', value: undefined, scope: { projectid: '0' }, $route: { path: '/s2svpn' }, $store: { state: { user: { token: 'session' } }, getters: { userInfo: { id: 'admin', roletype: 'Admin' }, project: {}, apis: { listVPCs: {} } } }, $getApiParams: () => ({ listall: {}, id: {}, keyword: {}, page: {}, pagesize: {}, domainid: {}, account: {}, projectid: {} }), $emit: jest.fn() }
  Object.assign(c, Select.data.call(c)); Object.entries(Select.methods).forEach(([key, fn]) => { c[key] = fn.bind(c) }); Object.entries(Select.computed).forEach(([key, fn]) => Object.defineProperty(c, key, { get: () => fn.call(c) })); return c
}
const reply = (rows, count = rows.length) => ({ listvpcsresponse: { count, vpc: rows } })
beforeEach(() => jest.clearAllMocks())
test('candidate server paging, duplicate names and selected UUID remain coherent', async () => {
  const c = context(); const second = '22222222-2222-4222-8222-222222222222'
  getAPI.mockResolvedValueOnce(reply([{ id, name: 'same', displaytext: 'description' }], 2)).mockResolvedValueOnce(reply([{ id: second, name: 'same', displaytext: 'description' }], 2))
  await c.load(true); await c.load(false); expect(c.options.map(r => r.value)).toEqual([id, second]); expect(c.options.map(r => r.label)).toEqual(['same', 'same']); expect(getAPI.mock.calls[1][1].page).toBe(2)
  c.select({ value: second }); expect(c.$emit).toHaveBeenCalledWith('update:value', second)
})
test('failed or stale candidates cannot be selected or reused in another project', async () => {
  const c = context(); c.value = id; getAPI.mockRejectedValueOnce(Error('offline')); await c.load(true)
  expect(c.blocked).toBe(true); expect(c.options).toEqual([])
  let complete; getAPI.mockReturnValueOnce(new Promise(resolve => { complete = resolve })); const request = c.load(true)
  c.$store.getters.project = { id }; Select.watch.context.handler.call(c)
  complete(reply([{ id, name: 'old' }])); await request; expect(c.selected).toBeNull(); expect(c.options).toEqual([])
})
test('refresh failure invalidates a previously verified chip without clearing the UUID filter', () => {
  const c = { $route: { query: { vpcid: id } }, labels: { vpcid: 'VPC' }, verification: '', validationError: '', config: () => ({ label: 'label.vpc' }), $t: key => key }
  expect(Search.computed.chips.call(c)[0].value).toBe('VPC'); c.validationError = 'lookup'
  expect(Search.computed.chips.call(c)[0].value).toContain(id); expect(c.$route.query.vpcid).toBe(id)
})

test('removing a domain chip clears dependent owner/VPC filters while retaining display and keyword', () => {
  const c = { $route: { query: { domainid: id, account: 'same-name', vpcid: id, fordisplay: 'false', keyword: 'match' } }, $emit: jest.fn() }
  Search.methods.remove.call(c, 'domainid')
  expect(c.$emit).toHaveBeenCalledWith('search', { s2sGatewaySearch: { fordisplay: 'false', keyword: 'match' } })
  expect(c.$route.query.domainid).toBe(id)
})
