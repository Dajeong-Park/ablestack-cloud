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

import Select from '@/components/view/AsnSearchSelect.vue'
import Search from '@/components/view/AsnSearch.vue'
import { getAPI } from '@/api'
jest.mock('@/api', () => ({ getAPI: jest.fn() }))
const zone = '11111111-1111-4111-8111-111111111111'; const id = '22222222-2222-4222-8222-222222222222'
function context (kind = 'vpcid') {
  const c = { kind, scope: { zoneid: zone }, $route: { path: '/asnumbers' }, $store: { state: { user: { token: 'session' } }, getters: { userInfo: { id: 'admin' }, project: {}, apis: { listVPCs: {}, listASNRanges: {} } } }, $emit: jest.fn() }
  Object.assign(c, Select.data.call(c)); Object.entries(Select.methods).forEach(([k, f]) => { c[k] = f.bind(c) }); Object.entries(Select.computed).forEach(([k, f]) => Object.defineProperty(c, k, { get: () => f.call(c) })); return c
}
const row = { id, zoneid: zone, name: 'same-name' }
const reply = (rows, count = rows.length) => ({ listvpcsresponse: { count, vpc: rows } })
beforeEach(() => jest.clearAllMocks())
test('server paging, duplicated names and selected ID lookup retain identity', async () => {
  const c = context(); getAPI.mockResolvedValueOnce(reply([row], 21)); await c.load(true)
  getAPI.mockResolvedValueOnce(reply([{ ...row, id: zone }], 21)); await c.load(false)
  expect(c.rows).toHaveLength(2); expect(c.rows[0].id).not.toBe(c.rows[1].id); expect(c.describe(row)).toContain(id)
  expect(getAPI.mock.calls[1][1]).toMatchObject({ page: 2, pagesize: 20, zoneid: zone })
  c.value = id; getAPI.mockResolvedValueOnce(reply([])).mockResolvedValueOnce(reply([row])); await c.load(true, 'other')
  expect(c.selected.id).toBe(id); expect(c.blocked).toBe(false); expect(getAPI.mock.calls[3][1]).toMatchObject({ id, zoneid: zone })
})
test('range list is complete and never receives fake page or keyword', async () => {
  const c = context('asnrangeid'); getAPI.mockResolvedValue({ listasnrangesresponse: { count: 1, asnumberrange: [{ ...row, startasn: 4200000000, endasn: 4200000002 }] } })
  await c.load(true, '4200000000'); expect(getAPI.mock.calls[0][1]).toEqual({ zoneid: zone }); expect(c.options[0].label).toContain('4200000000–4200000002'); expect(c.received).toBe(c.total)
  c.scope = {}; await c.load(true); expect(c.allowed).toBe(false); expect(getAPI).toHaveBeenCalledTimes(1)
})
test('failure, empty and missing selected target differ and never clear the UUID', async () => {
  const c = context(); getAPI.mockResolvedValueOnce({ listvpcsresponse: {} }); await c.load(true); expect(c.error).toBe(false)
  getAPI.mockRejectedValueOnce(Error('offline')); await c.load(true); expect(c.error).toBe(true)
  c.value = id; getAPI.mockResolvedValue(reply([])); await c.load(true); expect(c.blocked).toBe(true); expect(c.value).toBe(id); expect(c.selected).toBeNull()
})
test('late responses after search, context or permission changes cannot add candidates', async () => {
  const c = context(); let finish; getAPI.mockImplementationOnce(() => new Promise(resolve => { finish = resolve })); const old = c.load(true)
  getAPI.mockResolvedValueOnce(reply([{ ...row, name: 'new' }])); await c.load(true, 'new'); finish(reply([{ ...row, name: 'old' }])); await old; expect(c.rows[0].name).toBe('new')
  getAPI.mockImplementationOnce(() => new Promise(resolve => { finish = resolve })); const pending = c.load(true); c.scope.zoneid = id; finish(reply([row])); await pending; expect(c.rows).toEqual([])
  delete c.$store.getters.apis.listVPCs; await c.load(true); expect(c.allowed).toBe(false)
})
test('scope changes and reset remove dependent selections and state', () => {
  const c = { form: { zoneid: zone, domainid: id, account: 'owner', asnrangeid: id, vpcid: id, networkid: id }, blocked: { networkid: true }, $emit: jest.fn(), closeSearch: jest.fn() }
  Search.methods.changed.call(c, 'domainid'); expect(c.form.account).toBeUndefined(); expect(c.form.asnrangeid).toBeUndefined(); expect(c.form.vpcid).toBeUndefined(); expect(c.form.networkid).toBeUndefined(); expect(c.blocked.networkid).toBeUndefined()
  Search.methods.reset.call(c); expect(c.$emit).toHaveBeenCalledWith('search', { asnSearch: {} }); expect(c.form).toEqual({})
})

test('a failed refresh replaces previously verified chip labels with the retained UUID', () => {
  const c = { $route: { query: { zoneid: zone, asnrangeid: id } }, labels: { zoneid: 'Zone', asnrangeid: '4200000000–4200000002' }, verification: '', validationError: '', $t: key => key }
  expect(Search.computed.chips.call(c)[1].value).toBe('4200000000–4200000002')
  c.validationError = 'missing'
  expect(Search.computed.chips.call(c)[1].value).toBe(id + ' · message.asn.search.unverified')
  expect(c.$route.query.asnrangeid).toBe(id)
})
