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

import { acceptedIsoId, isoUploadTicket, uploadTicketExpired, isoRegistrationParams, isoReadiness, validIsoUrl } from '@/utils/isoRegistration'
const id = '11111111-1111-4111-8111-111111111111'; const zone = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const ticket = extra => ({ postuploadisoresponse: { getuploadparams: { id, postURL: 'https://upload.invalid/upload/fixture', metadata: 'test-metadata', signature: 'test-only-signature', expires: '2099-01-01T00:00:00Z', ...extra } } })
const ready = extra => ({ id, zoneid: zone, isready: true, ...extra })
test('local upload uses getuploadparams.id and retains the old signed wire field names', () => {
  expect(acceptedIsoId('Upload', ticket())).toBe(id)
  expect(isoUploadTicket(ticket()).id).toBe(id)
  expect(() => acceptedIsoId('Upload', { postuploadisoresponse: { iso: [{ id }] } })).toThrow()
  expect(() => isoUploadTicket(ticket({ metadata: '' }))).toThrow()
})
test('URL registration accepts repeated Zone rows of the same ISO and rejects ambiguous IDs', () => {
  expect(acceptedIsoId('Create', { registerisoresponse: { iso: [ready(), ready()] } })).toBe(id)
  expect(() => acceptedIsoId('Create', { registerisoresponse: { iso: [ready(), ready({ id: zone })] } })).toThrow()
})
test('expiry accepts ISO timestamps and legacy seconds/milliseconds without extending the ticket', () => {
  expect(uploadTicketExpired({ expires: '2000000000' }, 2000000000000)).toBe(true)
  expect(uploadTicketExpired({ expires: '2000000000001' }, 2000000000000)).toBe(false)
  expect(uploadTicketExpired({ expires: 'invalid' })).toBe(true)
})
test.each(['http://images.invalid/file.iso', 'https://images.invalid/a.iso?version=1', 'file:///images/test.iso'])('supported URL %s remains available', value => expect(validIsoUrl(value)).toBe(true))
test.each(['', 'file.iso', 'ftp://images.invalid/test.iso', 'javascript:alert(1)', 'https:///'])('invalid URL %s does not register', value => expect(validIsoUrl(value)).toBe(false))
test('selected API schema preserves false and checksum, rejects unsupported arch, and scopes projects', () => {
  const params = Object.fromEntries(['format', 'name', 'zoneid', 'bootable', 'checksum', 'isextractable', 'arch', 'projectid'].map(name => [name, {}]))
  const cap = { api: 'getUploadParamsForIso', available: true, schemaKnown: true, parameters: params }
  expect(isoRegistrationParams({ name: 'data', zoneid: zone, bootable: false, isextractable: false, checksum: 'a'.repeat(32), arch: 'aarch64' }, cap, {})).toMatchObject({ bootable: false, isextractable: false, checksum: 'a'.repeat(32), arch: 'aarch64' })
  expect(isoRegistrationParams({ name: 'data', zoneid: zone }, cap, { project: { id } }).projectid).toBe(id)
  expect(() => isoRegistrationParams({ name: 'data', zoneid: zone, arch: 'aarch64' }, { ...cap, parameters: { name: {}, zoneid: {} } })).toThrow('message.iso.parameter.unsupported')
})
test('readiness never treats byte completion, failure, omitted readiness or incomplete multi-Zone observations as success', () => {
  const result = rows => isoReadiness({ listisosresponse: { iso: rows, count: rows.length } }, id, zone)
  expect(result([ready({ isready: false, downloaddetails: [{ downloadPercent: 100, downloadState: 'DOWNLOADED' }] })]).ready).toBe(false)
  expect(result([ready({ isready: false, downloaddetails: [{ downloadState: 'ABANDONED' }] })])).toMatchObject({ ready: false, failed: true })
  expect(result([ready({ isready: undefined })]).ready).toBe(false)
  expect(isoReadiness({ listisosresponse: { iso: [ready()], count: 2 } }, id, '-1').ready).toBe(false)
  expect(isoReadiness({ listisosresponse: { iso: [ready()] } }, id, '-1').ready).toBe(false)
  expect(() => result([ready({ id: zone })])).toThrow()
})

test('local API inherited required format is ISO even if an unrelated form value is supplied', () => {
  const cap = { api: 'getUploadParamsForIso', available: true, schemaKnown: true, parameters: { format: { required: true }, name: {}, zoneid: {} } }
  expect(isoRegistrationParams({ name: 'data', zoneid: zone, format: 'QCOW2' }, cap).format).toBe('ISO')
})
