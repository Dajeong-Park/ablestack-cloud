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

import { isoBoolean, isoState, normalizeIso, isoAvailability, isoListResponse, isoRegistrationCapability, isoParameterHelp, canIsoAction, isoContext } from '@/utils/isoModel'
const id = '11111111-1111-4111-8111-111111111111'
const zone = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const otherZone = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const record = extra => ({ id, format: 'ISO', zoneid: zone, account: 'owner', domainid: 'root-uuid', isready: true, bootable: true, ...extra })
const getters = extra => ({ userInfo: { id: 'owner-id', account: 'owner', domainid: 'root-uuid', roletype: 'User' }, project: {}, apis: Object.fromEntries(['registerIso', 'getUploadParamsForIso', 'updateIso', 'updateIsoPermissions', 'listIsoPermissions', 'copyIso', 'deleteIso', 'deployVirtualMachine', 'listIsos', 'extractIso'].map(api => [api, { params: [] }])), ...extra })
test.each([[false, false], ['false', false], [true, true], ['true', true], [undefined, undefined], [null, undefined], [0, undefined], ['unknown', undefined]])('boolean %s is normalized without truthiness inference', (input, expected) => expect(isoBoolean(input)).toBe(expected))
test.each(['ABANDONED', 'UPLOAD_ERROR', 'DOWNLOAD_ERROR', 'UploadAbandoned'])('%s is a failure without optional datastore metadata', state => {
  const raw = Object.freeze(record({ isready: 'false', state, downloaddetails: undefined, checksum: 'original' }))
  const value = normalizeIso(raw)
  expect(value).not.toBe(raw); expect(value.checksum).toBe('original'); expect(raw.downloaddetails).toBeUndefined()
  expect(isoAvailability(raw)).toMatchObject({ key: 'failed', complete: false })
})
test('non-array/absent stores do not lose ready or fabricate full Zone coverage', () => {
  for (const downloaddetails of [undefined, null, {}, 'invalid', [null]]) expect(isoAvailability(record({ downloaddetails }))).toMatchObject({ key: 'ready', complete: false })
  expect(isoAvailability(record({ isready: 'false', downloaddetails: [{ downloadState: 'DOWNLOADED', downloadPercent: '100' }] })).key).toBe('verifying')
  expect(isoAvailability(record({ isready: undefined })).key).toBe('unknown')
  expect(isoState('NotUploaded')).toBe('NOT_UPLOADED')
})
test('observations are scoped by ISO ID and partial coverage stays partial', () => {
  const a = record(); const b = record({ zoneid: otherZone, isready: false, state: 'ABANDONED' })
  expect(isoAvailability(a, { isoid: id, rows: [a, b], count: 2, coverage: 'complete' })).toMatchObject({ key: 'partial', complete: true, readyCount: 1 })
  expect(isoAvailability(a, { isoid: id, rows: [a], count: 2, coverage: 'partial' }).complete).toBe(false)
  expect(isoAvailability(a, { isoid: otherZone, rows: [b] }).key).toBe('ready')
})
test('URL and local registration have independent API schemas, including old arch omission', () => {
  const local = getters({ apis: { getUploadParamsForIso: { params: [{ name: 'name' }] } } })
  expect(isoRegistrationCapability('url', local).available).toBe(false)
  expect(isoRegistrationCapability('local', local)).toMatchObject({ available: true, schemaKnown: true, parameters: { name: { name: 'name' } } })
  expect(isoRegistrationCapability('local', local).parameters.arch).toBeUndefined()
  expect(isoRegistrationCapability('url', getters({ apis: { registerIso: {} } }))).toMatchObject({ available: true, schemaKnown: false })
  expect(isoRegistrationCapability('url', getters({ apis: { registerIso: null } })).available).toBe(false)
  expect(isoParameterHelp({ arch: { description: 'CPU' } })).toMatchObject({ arch: { description: 'CPU' }, name: { description: '' } })
})
test('real empty responses and malformed/error responses remain distinguishable', () => {
  expect(isoListResponse({ listisosresponse: {} })).toMatchObject({ rows: [], count: 0, countKnown: false })
  expect(isoListResponse({ listisosresponse: { iso: [record({ isready: 'false' })], count: '1' } }).rows[0].isready).toBe(false)
  for (const input of [{}, { listisosresponse: { errorcode: 531 } }, { listisosresponse: { iso: {} } }, { listisosresponse: { count: 2 } }, { listisosresponse: { iso: [record()], count: 0 } }]) expect(() => isoListResponse(input)).toThrow()
})
test.each(['edit', 'share', 'permissions', 'copy', 'delete', 'download'])('%s needs a real API grant and owned non-system ISO', action => {
  expect(canIsoAction(action, record({ isextractable: true }), getters())).toBe(true)
  expect(canIsoAction(action, record(), getters({ apis: { listIsos: {} } }))).toBe(false)
  expect(canIsoAction(action, record({ account: 'other' }), getters())).toBe(false)
  expect(canIsoAction(action, record({ account: 'system' }), getters({ userInfo: { id: 'root', roletype: 'Admin' } }))).toBe(false)
  expect(canIsoAction(action, record({ templatetype: 'BUILTIN' }), getters())).toBe(false)
  expect(canIsoAction(action, record({ domainid: undefined }), getters())).toBe(false)
})
test('UUID root admin, active project owner, foreign project and missing identity are explicit', () => {
  expect(canIsoAction('edit', record({ account: 'other' }), getters({ userInfo: { id: 'admin', roletype: 'Admin', domainid: 'root-uuid' } }))).toBe(true)
  expect(canIsoAction('edit', record({ projectid: 'p' }), getters({ project: { id: 'p' } }))).toBe(true)
  expect(canIsoAction('edit', record({ projectid: 'p' }), getters())).toBe(false)
  expect(canIsoAction('edit', record(), getters({ project: { id: 'p' } }))).toBe(false)
  expect(canIsoAction('edit', record(), getters({ userInfo: {} }))).toBe(false)
})
test('normal owner cannot download false/unknown extractability; shared ready bootable ISO can deploy', () => {
  expect(canIsoAction('download', record({ isextractable: 'false' }), getters())).toBe(false)
  expect(canIsoAction('download', record(), getters())).toBe(false)
  expect(canIsoAction('deploy', record({ account: 'other' }), getters())).toBe(true)
  expect(canIsoAction('deploy', record({ bootable: 'false' }), getters())).toBe(false)
  expect(canIsoAction('deploy', record({ isready: 'false' }), getters())).toBe(false)
})
test('delete rejects unstarted upload but allows terminal failure; other writes need readiness', () => {
  expect(canIsoAction('delete', record({ isready: false, state: 'NotUploaded' }), getters())).toBe(false)
  expect(canIsoAction('delete', record({ isready: false, state: 'ABANDONED' }), getters())).toBe(true)
  expect(canIsoAction('copy', record({ isready: false, state: 'ABANDONED' }), getters())).toBe(false)
  expect(isoContext(record(), getters())).not.toBe(isoContext(record(), getters({ apis: { listIsos: {} } })))
})
