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

import Select from '@/components/view/PublicIpSearchSelect'
import Search from '@/components/view/PublicIpSearch'
import { getAPI } from '@/api'
jest.mock('@/api', () => ({ getAPI: jest.fn() }))
const id = '11111111-1111-4111-8111-111111111111'
const row = { id, name: 'VPC', zoneid: id }
const reply = rows => ({ listvpcsresponse: { count: rows.length, vpc: rows } })
function context () {
  const c = { kind: 'vpcid', value: undefined, scope: { projectid: '0' }, $route: { path: '/publicip' }, $emit: jest.fn(), $store: { state: { user: { token: 'token' } }, getters: { userInfo: { id: 'admin', roletype: 'Admin' }, project: {}, apis: { listVPCs: {} } } }, $getApiParams: () => ({ projectid: {}, listall: {}, page: {}, pagesize: {} }) }
  Object.assign(c, Select.data.call(c)); Object.entries(Select.methods).forEach(([k, f]) => { c[k] = f.bind(c) }); Object.entries(Select.computed).forEach(([k, f]) => Object.defineProperty(c, k, { get: () => f.call(c) })); return c
}
beforeEach(() => jest.clearAllMocks())
test('empty and failure differ; retry recovers and pagination stays on server', async () => {
  const c = context(); getAPI.mockResolvedValueOnce(reply([])); await c.load(true); expect(c.error).toBe(false); expect(c.total).toBe(0)
  getAPI.mockRejectedValueOnce(Error('failure')); await c.load(true); expect(c.error).toBe(true)
  getAPI.mockResolvedValueOnce(reply([row])); await c.load(true); expect(c.rows).toEqual([row]); expect(c.error).toBe(false); expect(getAPI.mock.calls[2][1]).toMatchObject({ page: 1, pagesize: 20 })
})
test('permission/context changes prevent stale candidates and selection', async () => {
  const c = context(); let finish; getAPI.mockImplementationOnce(() => new Promise(resolve => { finish = resolve })); const pending = c.load(true)
  c.$store.getters.project = { id }; c.scope.projectid = id; c.version++
  finish(reply([row])); await pending; expect(c.rows).toEqual([])
  delete c.$store.getters.apis.listVPCs; await c.load(true); expect(c.allowed).toBe(false); expect(c.rows).toEqual([]); expect(getAPI).toHaveBeenCalledTimes(1)
})
test('search B response wins over A and missing selected resource blocks apply', async () => {
  const c = context(); let finish; getAPI.mockImplementationOnce(() => new Promise(resolve => { finish = resolve })); const old = c.load(true)
  getAPI.mockResolvedValueOnce(reply([{ ...row, name: 'new' }])); await c.load(true, 'new'); finish(reply([{ ...row, name: 'old' }])); await old; expect(c.rows[0].name).toBe('new')
  c.value = id; getAPI.mockResolvedValue(reply([])); await c.load(true); expect(c.blocked).toBe(true)
})
test('parent changes clear dependent UUIDs and stale blocked values', () => {
  const c = { form: { vpcid: id, associatednetworkid: id, vlanid: id, domainid: id, account: 'owner' }, blocked: { vpcid: true, associatednetworkid: true } }
  Search.methods.changed.call(c, 'zoneid'); expect(c.form.vpcid).toBeUndefined(); expect(c.form.associatednetworkid).toBeUndefined(); expect(c.form.vlanid).toBeUndefined(); expect(c.blocked.vpcid).toBeUndefined()
  Search.methods.changed.call(c, 'domainid'); expect(c.form.account).toBeUndefined()
})
