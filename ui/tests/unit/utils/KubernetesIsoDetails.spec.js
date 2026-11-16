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

import { readKubernetesIsoZones, kubernetesIsoStatus, kubernetesIsoScope, kubernetesIsoLink, kubernetesIsoDetailContext, kubernetesIsoBooleanLabel, kubernetesIsoObservationFailure } from '@/utils/kubernetesIsoDetails'
const id = '11111111-1111-4111-8111-111111111111'
const iso = '22222222-2222-4222-8222-222222222222'
const zone = '33333333-3333-4333-8333-333333333333'
const zone2 = '44444444-4444-4444-8444-444444444444'
const record = { id, isoid: iso, state: 'Enabled', isostate: 'Ready', zoneid: zone, catalog: { zone: { kind: 'zone', id: zone } } }
const getters = (role = 'Admin', child = true) => ({ userInfo: { id: 'actor', roletype: role, roleid: 'role' }, apis: { listKubernetesSupportedVersions: {}, ...(child ? { listIsos: {} } : {}) } })
const row = (values = {}) => ({ id: iso, zoneid: zone, zonename: 'Zone', isready: true, status: 'Download Complete', ...values })
const response = (rows, count = rows.length) => ({ listisosresponse: { count, iso: rows } })
const observation = rows => ({ versionid: id, isoid: iso, rows, status: 'ready', count: rows.length, coverage: 'complete' })
test.each(['User', 'Admin'])('catalog-only %s never requests child ISO, write or VM APIs', async role => {
  const request = jest.fn()
  expect(await readKubernetesIsoZones(request, record, getters(role, false))).toMatchObject({ status: 'forbidden', rows: [] })
  expect(request).not.toHaveBeenCalled()
  expect(kubernetesIsoLink(record, getters(role, false), observation([row()]))).toBeNull()
})
test.each([['Admin', 'all'], ['User', 'executable']])('%s child reads keep catalog scope and independent read grants', async (role, filter) => {
  const request = jest.fn().mockResolvedValue(response([row({ url: 'root-only-source' })]))
  const g = { ...getters(role), project: { id: 'unrelated-project' } }
  const opts = { preserveOnFailure: true, readScope: 'runtime-scope' }
  const result = await readKubernetesIsoZones(request, record, g, opts)
  expect(request).toHaveBeenCalledWith('listIsos', { id: iso, isofilter: filter, zoneid: zone, showunique: false, page: 1, pagesize: 500 }, opts)
  expect(result.status).toBe('ready')
  if (role === 'User') expect(result.rows[0]).not.toHaveProperty('url')
})
test('complete global coverage crosses API pages without turning All Zones into the current Zone', async () => {
  const rows = Array.from({ length: 501 }, (_, n) => row({ zoneid: '50000000-0000-4000-8000-' + (n + 1).toString(16).padStart(12, '0') }))
  const request = jest.fn().mockResolvedValueOnce(response(rows.slice(0, 500), 501)).mockResolvedValueOnce(response(rows.slice(500), 501))
  const global = { ...record, zoneid: undefined, catalog: { zone: { kind: 'all', id: null } } }
  const result = await readKubernetesIsoZones(request, global, getters())
  expect(result).toMatchObject({ status: 'ready', coverage: 'complete', count: 501 })
  expect(result.rows).toHaveLength(501)
  expect(request.mock.calls[0][1]).not.toHaveProperty('zoneid')
  expect(request.mock.calls[1][1].page).toBe(2)
})
test.each([
  { listisosresponse: { iso: [row()] } },
  { listisosresponse: { count: null, iso: [] } },
  { listisosresponse: { count: [], iso: [] } },
  response([row({ id })]),
  response([row({ zoneid: 'bad' })]),
  response([row({ zoneid: zone2 })]),
  response([row(), row()]),
  response([row({ downloaddetails: {} })]),
  response([row({ downloaddetails: [null] })]),
  response([], 1)
])('malformed, partial or wrong-target reads cannot establish Ready', async json => {
  const request = jest.fn().mockResolvedValue(json)
  await expect(readKubernetesIsoZones(request, record, getters())).rejects.toThrow('message.kubernetes.iso.read.invalid')
})
test('count changes across pages discard the incomplete observation', async () => {
  const global = { ...record, zoneid: undefined, catalog: { zone: { kind: 'all', id: null } } }
  const request = jest.fn().mockResolvedValueOnce(response([row()], 2)).mockResolvedValueOnce(response([row({ zoneid: zone2 })], 3))
  await expect(readKubernetesIsoZones(request, global, getters())).rejects.toThrow('message.kubernetes.iso.read.invalid')
})
test('a successful empty permitted read stays different from permission or network errors', async () => {
  const result = await readKubernetesIsoZones(jest.fn().mockResolvedValue(response([])), record, getters())
  expect(result.status).toBe('empty')
  expect(kubernetesIsoStatus(record, result).key).toBe('empty')
})
test('an owner transition ends pagination and cannot publish the old observation', async () => {
  let current = true
  const request = jest.fn().mockImplementation(async () => { current = false; return response([row()], 2) })
  expect(await readKubernetesIsoZones(request, record, getters(), {}, () => current)).toBeNull()
  expect(request).toHaveBeenCalledTimes(1)
})
test.each([
  [row(), 'ready'],
  [row({ isready: false, status: 'checksum mismatch' }), 'failed'],
  [row({ isready: false, status: '0% Downloaded', downloaddetails: [{ downloadState: 'DOWNLOAD_IN_PROGRESS', downloadPercent: 0 }] }), 'progress'],
  [row({ isready: false, status: '', downloaddetails: [{ downloadState: 'NOT_DOWNLOADED' }] }), 'queued'],
  [row({ isready: undefined, status: 'Download Complete' }), 'verifying'],
  [row({ isready: undefined, status: '' }), 'unknown']
])('catalog Enabled/Ready does not override observed ISO state %s', (value, key) => {
  expect(kubernetesIsoStatus(record, observation([value])).key).toBe(key)
})
test('partial Zone failure and ready-with-store-error retain warning details', () => {
  const failed = row({ zoneid: zone2, isready: false, status: 'checksum mismatch' })
  expect(kubernetesIsoStatus({ ...record, catalog: { zone: { kind: 'all', id: null } } }, observation([row(), failed]))).toMatchObject({ key: 'partial', readyCount: 1, zoneCount: 2 })
  const degraded = row({ downloaddetails: [{ downloadState: 'DOWNLOAD_ERROR', datastore: 'secondary' }] })
  expect(kubernetesIsoStatus(record, observation([degraded])).key).toBe('readyWarning')
})
test('unqueried metadata and another version observation never claim availability', () => {
  expect(kubernetesIsoStatus(record).key).toBe('unqueried')
  expect(kubernetesIsoStatus(record, { ...observation([row()]), versionid: iso }).key).toBe('unqueried')
  expect(kubernetesIsoStatus(record, observation([row()]), 'version').key).toBe('enabled')
  expect(kubernetesIsoStatus({ state: 'Disabled' }, null, 'version').key).toBe('disabled')
})
test.each([
  [true, 'label.yes'], [false, 'label.no'], ['false', 'label.no'], [undefined, 'label.unknown']
])('booleans preserve false and do not guess omitted values', (value, expected) => expect(kubernetesIsoBooleanLabel(value)).toBe(expected))
test('only authoritative catalog omission establishes global scope', () => {
  expect(kubernetesIsoScope({ id, semanticversion: '1.36.0' }).kind).toBe('unknown')
  expect(kubernetesIsoScope({ catalog: { zone: { kind: 'all', id: null } } }).kind).toBe('all')
})
test('catalog/ISO errors and session expiration remain different', async () => {
  for (const [error, expected] of [
    [{ response: { status: 432 } }, 'forbidden'],
    [{ response: { status: 401 } }, 'expired'],
    [{ message: 'message.kubernetes.iso.read.invalid' }, 'invalid'],
    [{ message: 'offline' }, 'network']
  ]) expect(kubernetesIsoObservationFailure(error)).toBe(expected)
  const request = jest.fn().mockResolvedValue({ errorresponse: { errorcode: 432, errortext: 'Not available for user' } })
  await expect(readKubernetesIsoZones(request, record, getters())).rejects.toMatchObject({ errorcode: 432 })
})
test('tab changes retain observation scope but relogin, project and child changes invalidate it', () => {
  const route = { path: '/kubernetesiso/' + id, query: { tab: 'details' } }; const g = getters()
  const context = kubernetesIsoDetailContext(route, record, g, 'session-a')
  expect(kubernetesIsoDetailContext({ ...route, query: { tab: 'zones' } }, record, g, 'session-a')).toBe(context)
  expect(kubernetesIsoDetailContext(route, record, g, 'session-b')).not.toBe(context)
  expect(kubernetesIsoDetailContext(route, record, { ...g, project: { id: 'project' } }, 'session-a')).not.toBe(context)
  expect(kubernetesIsoDetailContext(route, { ...record, isoid: id }, g, 'session-a')).not.toBe(context)
})

test('download reasons redact URL credentials, query data and named secrets', () => {
  const failed = row({ isready: false, status: 'Download failed http://reader:example-pass@source.test/file.iso?token=example-token password=example-pass' })
  const value = kubernetesIsoStatus(record, observation([failed]))
  expect(value.key).toBe('failed')
  expect(value.reasons.join(' ')).not.toMatch(/reader|example-pass|example-token/)
  expect(value.reasons.join(' ')).toContain('http://source.test/file.iso')
})

test('registration state changes cannot change observation ownership during a download', () => {
  const route = { path: '/kubernetesiso/' + id }
  expect(kubernetesIsoDetailContext(route, { ...record, isostate: 'Allocated' }, getters(), 'session')).toBe(kubernetesIsoDetailContext(route, { ...record, isostate: 'Ready' }, getters(), 'session'))
})
