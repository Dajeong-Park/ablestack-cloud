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

import { asnExact, asnQuery, asnError, asnParams, asnSearchQuery, asnCandidates, asnSelection, readAsnQuery } from '@/utils/asnSearch'
const id = n => String(n).padStart(8, '0') + '-1111-4111-8111-111111111111'
const zone = id(1); const range = id(2); const domain = id(3); const vpc = id(4); const network = id(5)
const getters = { userInfo: { domainid: domain }, apis: Object.fromEntries(['listASNumbers', 'listASNRanges', 'listZones', 'listDomains', 'listAccounts', 'listVPCs', 'listNetworks'].map(k => [k, {}])), project: {} }
const rangeRow = { id: range, zoneid: zone, startasn: 4200000000, endasn: 4200000002 }
const row = { id: id(6), zoneid: zone, asnrangeid: range, asnumber: 4200000000, allocationstate: 'Allocated', account: 'owner', domainid: domain, vpcid: vpc }
function reader () {
  return jest.fn(async command => {
    if (command === 'listZones') return { listzonesresponse: { count: 1, zone: [{ id: zone, name: 'Zone' }] } }
    if (command === 'listASNRanges') return { listasnrangesresponse: { count: 1, asnumberrange: [rangeRow] } }
    if (command === 'listDomains') return { listdomainsresponse: { count: 1, domain: [{ id: domain }] } }
    if (command === 'listAccounts') return { listaccountsresponse: { count: 1, account: [{ id: id(7), domainid: domain, name: 'owner' }] } }
    if (command === 'listVPCs') return { listvpcsresponse: { count: 1, vpc: [{ id: vpc, zoneid: zone, domainid: domain, account: 'owner', name: 'duplicate' }] } }
    if (command === 'listNetworks') return { listnetworksresponse: { count: 1, network: [{ id: network, zoneid: zone, domainid: domain, account: 'owner', vpcid: vpc, name: 'duplicate' }] } }
    return { listasnumbersresponse: { count: 1, asnumber: [row] } }
  })
}
test.each(['0', '23456', '65535', '2147483648', '4200000000', '4294967295'])('exact %s survives URL and API without narrowing', raw => {
  const q = asnQuery({ asnumber: raw, command: 'deleteASNRange', details: 'secret', page: '2', pagesize: '10' })
  expect(asnError(q, getters)).toBe(''); expect(asnParams(q)).toEqual({ asnumber: raw, page: '2', pagesize: '10' }); expect(q.command).toBeUndefined()
})
test.each(['-1', '+1', '1.5', '1e3', '1.10', '1,000', '\uff11', '4294967296', 'NaN'])('invalid exact %s cannot broaden a query', raw => {
  expect(asnExact(raw)).toBeNull(); expect(asnError(asnQuery({ asnumber: raw }), getters)).toBe('integer')
})
test('normalization is canonical, converts network alias and restores keyword/state/page', () => {
  const q = asnQuery({ associatednetworkid: network, asnumber: ' 004200000000 ', q: '420', isallocated: 'false', page: '3', pagesize: '10' })
  expect(q).toMatchObject({ networkid: network, asnumber: '4200000000', keyword: '420', q: '420', filter: 'free', isallocated: 'false', page: '3' }); expect(asnQuery(q)).toEqual(q)
  expect(asnSearchQuery(q, {}, 10, getters)).toEqual({ filter: 'all', page: '1', pagesize: '10' })
  expect(asnSearchQuery(q, { searchQuery: '12' }, 10, getters)).toMatchObject({ keyword: '12', asnumber: '4200000000', page: '1', networkid: network })
})
test('arrays, contradictory states, wrong UUID and unsupported project are blocked', () => {
  for (const q of [{ zoneid: [zone, zone] }, { zoneid: 'wrong' }, { filter: 'all', isallocated: 'true' }, { filter: 'free', isallocated: 'true' }]) expect(asnError(asnQuery(q), getters)).toBe('invalid')
  expect(asnError(asnQuery({ asnrangeid: range }), getters)).toBe('zone')
  expect(asnError(asnQuery({}), { ...getters, project: { id: id(8) } })).toBe('project')
})
test('selected IDs are scoped before ASN request; tier maps through VPC and exact+keyword is AND', async () => {
  const read = reader(); const params = asnParams(asnQuery({ zoneid: zone, asnrangeid: range, domainid: domain, account: 'owner', vpcid: vpc, networkid: network, asnumber: '4200000000', keyword: '420', filter: 'allocatedonly' }))
  const data = await readAsnQuery(read, params, getters, () => true); expect(data.listasnumbersresponse.count).toBe(1)
  expect(read.mock.calls[read.mock.calls.length - 1].slice(0, 2)).toEqual(['listASNumbers', params]); expect(read.mock.calls.find(c => c[0] === 'listNetworks')[1]).toMatchObject({ id: network, domainid: domain, account: 'owner', zoneid: zone })
})
test('missing or denied selected UUID never falls back to an unfiltered list', async () => {
  const read = reader(); read.mockResolvedValueOnce({ listzonesresponse: { count: 0 } })
  await expect(readAsnQuery(read, { zoneid: zone, page: '1', pagesize: '20' }, getters, () => true)).rejects.toThrow('missing'); expect(read).toHaveBeenCalledTimes(1)
  const denied = { ...getters, apis: { listASNumbers: {} } }; await expect(asnSelection(reader(), asnQuery({ vpcid: vpc }), denied)).rejects.toThrow('permission')
})
test('stale context, foreign candidates, malformed counts and incompatible VPC/network fail closed', async () => {
  const read = reader(); await expect(readAsnQuery(read, { zoneid: zone }, getters, () => false)).rejects.toThrow('stale'); expect(read).not.toHaveBeenCalled()
  expect(() => asnCandidates({ listvpcsresponse: { count: 1, vpc: [{ id: vpc, zoneid: id(9) }] } }, 'vpcid', { zoneid: zone })).toThrow('scope')
  expect(() => asnCandidates({ listasnrangesresponse: {} }, 'asnrangeid', { zoneid: zone })).toThrow('lookup')
  const wrong = reader(); const original = wrong.getMockImplementation(); wrong.mockImplementation(async c => c === 'listNetworks' ? { listnetworksresponse: { count: 1, network: [{ id: network, zoneid: zone }] } } : original(c))
  await expect(asnSelection(wrong, asnQuery({ vpcid: vpc, networkid: network, zoneid: zone }), getters)).rejects.toThrow('combination')
})
test('response zero, total and scope are verified; failure is distinct from zero', async () => {
  const read = jest.fn().mockResolvedValue({ listasnumbersresponse: { count: 0 } }); await expect(readAsnQuery(read, {}, getters, () => true)).resolves.toBeTruthy()
  read.mockResolvedValue({ listasnumbersresponse: {} }); await expect(readAsnQuery(read, {}, getters, () => true)).rejects.toThrow('lookup')
  read.mockResolvedValue({ listasnumbersresponse: { count: 21, asnumber: [row] } }); expect((await readAsnQuery(read, { page: '2', pagesize: '20' }, getters, () => true)).listasnumbersresponse.count).toBe(21)
  await expect(readAsnQuery(read, { asnumber: '64512' }, getters, () => true)).rejects.toThrow('scope')
})
