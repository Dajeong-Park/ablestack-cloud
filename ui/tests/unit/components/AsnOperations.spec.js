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

import { asnReleaseTarget, asnReleaseRead, asnReleaseReason, asnCanRelease, asnField, asnReturnLocation, asnZoneLocation } from '@/utils/asnOperations'
const id = n => String(n).padStart(8, '0') + '-1111-4111-8111-111111111111'
const row = { id: id(1), zoneid: id(2), asnumber: 4200000000, allocationstate: 'Allocated', releasable: true, releasereason: 'eligible' }
const getters = { userInfo: { roletype: 'Admin' }, apis: { listASNumbers: {}, releaseASNumber: {}, listZones: {}, listNetworks: {} } }

test('legacy, contradictory state, unknown and missing references cannot enable release', () => {
  expect(asnCanRelease(row, getters)).toBe(true)
  for (const r of [{ ...row, releasable: undefined }, { ...row, releasable: false }, { ...row, releasereason: 'unknown' }, { ...row, releasereason: 'missingreference' }, { ...row, allocationstate: 'Free' }]) expect(asnCanRelease(r, getters)).toBe(false)
  expect(asnCanRelease(row, { ...getters, apis: { listASNumbers: {} } })).toBe(false)
  expect(asnCanRelease(row, { ...getters, userInfo: { roletype: 'User' } })).toBe(false)
  expect(asnReleaseReason({ ...row, releasable: false })).toBe('unknown')
})

test('release target and read preserve Zone, full ASN and row UUID; ambiguous and stale replies fail closed', async () => {
  const target = asnReleaseTarget(row); expect(target.asnumber).toBe('4200000000'); expect(Object.isFrozen(target)).toBe(true)
  const read = jest.fn().mockResolvedValue({ listasnumbersresponse: { count: 1, asnumber: [row] } })
  await expect(asnReleaseRead(read, target, () => true)).resolves.toEqual(row)
  expect(read.mock.calls[0][1]).toEqual({ zoneid: row.zoneid, asnumber: '4200000000', page: 1, pagesize: 2 })
  read.mockResolvedValue({ listasnumbersresponse: { count: 2, asnumber: [row, row] } }); await expect(asnReleaseRead(read, target, () => true)).rejects.toThrow('missing')
  read.mockResolvedValue({ listasnumbersresponse: { count: 1, asnumber: [{ ...row, id: id(9) }] } }); await expect(asnReleaseRead(read, target, () => true)).rejects.toThrow('changed')
  await expect(asnReleaseRead(read, target, () => false)).rejects.toThrow('stale')
})

test('absent references render a dash and links require valid identity, label and permission', () => {
  expect(asnField({}, 'associatednetworkname', getters.apis)).toEqual({ text: '—', path: null })
  expect(asnField({ associatednetworkid: id(3) }, 'associatednetworkname', getters.apis).path).toBeNull()
  expect(asnField({ associatednetworkid: 'undefined', associatednetworkname: 'network' }, 'associatednetworkname', getters.apis).path).toBeNull()
  expect(asnField({ associatednetworkid: id(3), associatednetworkname: 'network' }, 'associatednetworkname', getters.apis).path).toBe('/guestnetwork/' + id(3))
  expect(asnField({ associatednetworkid: id(3), associatednetworkname: 'network' }, 'associatednetworkname', {}).path).toBeNull()
})

test('range management return restores only the ASN route allowlist and rejects non-Routed targets', () => {
  const route = { query: { asnumber: '4200000000', page: '2', pagesize: '10', command: 'deleteASNRange' } }
  const location = asnZoneLocation({ id: row.zoneid, routedmodeenabled: true }, route, getters)
  expect(location.path).toBe('/zone/' + row.zoneid)
  expect(location.name).toBeUndefined()
  expect(location.query.tab).toBe('asnumber')
  const back = asnReturnLocation(location.query.asnreturn, getters)
  expect(back).toMatchObject({ name: 'asnumbers', query: { asnumber: '4200000000', page: '2', pagesize: '10' } }); expect(back.query.command).toBeUndefined()
  expect(asnReturnLocation('[]', getters)).toBeNull(); expect(asnReturnLocation('{', getters)).toBeNull()
  expect(() => asnZoneLocation({ id: row.zoneid, routedmodeenabled: false }, route, getters)).toThrow('zone')
})
