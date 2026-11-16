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

import { validKubernetesVersion as version, validKubernetesInteger as integer, validKubernetesChecksum as checksum, validKubernetesIsoUrl as url, kubernetesUrlErrors, kubernetesUrlParams, kubernetesDirectDownloadForced, kubernetesRegistrationName, kubernetesUrlAttempt, rememberKubernetesUrlAttempt, synchronizeKubernetesUrlScope, reconcileKubernetesUrl, observeKubernetesUrl } from '@/utils/kubernetesIsoRegistration'
import { kubernetesIsoCapability } from '@/utils/kubernetesIsoCapabilities'
const zone = '11111111-1111-4111-8111-111111111111'
const id = '22222222-2222-4222-8222-222222222222'
const iso = '33333333-3333-4333-8333-333333333333'
const zones = [{ id: zone, name: 'Zone13', type: 'Advanced' }]
const getters = () => ({ userInfo: { id: 'actor', roletype: 'Admin' }, project: {}, apis: { addKubernetesSupportedVersion: {}, listKubernetesSupportedVersions: {}, listIsos: {} } })
const form = changes => ({ semanticversion: '1.30.0', name: '', zoneid: 'all', url: 'https://example.test/k8s.iso', checksum: '', mincpunumber: 2, minmemory: 2048, directdownload: false, arch: 'x86_64', ...changes })
test.each(['1.11.0', '1.11.0.1', '1.29.10', '2.0.0', '01.011.0'])('server numeric version accepted: %s', value => expect(version(value)).toBe(true))
test.each(['1.10.999', '1.11', 'v1.30.0', '1.30.0-rc1', '1.30..0', '1.30.NaN', '2147483648.0.0', '', '1.3e2.0'])('invalid server version: %s', value => expect(version(value)).toBe(false))
test.each([[1, 2, false], [2, 2, true], [2047, 2048, false], [2048, 2048, true], [2.5, 2, false], ['NaN', 2, false], ['2e3', 2, false], [2147483647, 2, true], [2147483648, 2, false], [null, 2, false], [Infinity, 2, false]])('integer bound %s >= %s', (value, min, result) => expect(integer(value, min)).toBe(result))
test.each(['', 'a'.repeat(32), '{MD5}' + 'a'.repeat(32), '{SHA-1}' + 'a'.repeat(40), '{SHA-224}' + 'a'.repeat(56), '{SHA-256}' + 'a'.repeat(64), '{SHA-384}' + 'a'.repeat(96), '{SHA-512}' + 'A'.repeat(128)])('server checksum wire form passes %s', value => expect(checksum(value)).toBe(true))
test.each(['a'.repeat(64), 'sha256:' + 'a'.repeat(64), '{sha-256}' + 'a'.repeat(64), '{SHA-256}' + 'a'.repeat(63), '{UNKNOWN}abcd', '{SHA-256}' + 'z'.repeat(64), 0, []])('invalid checksum never reaches allocation: %s', value => expect(checksum(value)).toBe(false))
test.each(['https://example.test/a.iso?token=example', 'http://10.10.13.10/a.ISO.gz', 'file:///srv/a.iso', 'https://example.test/a.iso.bz2', 'https://example.test/a.metalink'])('server ISO path syntax accepts %s', value => expect(url(value)).toBe(true))
test.each(['ftp://example.test/a.iso', 'javascript:alert(1)', 'https:///a.iso', 'https://example.test/a.qcow2', 'https://example.test/a.iso withspace', 'https://example.test/a%GG.iso', '', '//example.test/a.iso'])('invalid URL syntax %s', value => expect(url(value)).toBe(false))
test('field errors identify exact input and never normalize invalid zero into absence', () => {
  expect(kubernetesUrlErrors(form({ mincpunumber: 0, minmemory: 2047, checksum: 'a'.repeat(64), semanticversion: '1.10.0' }), zones, kubernetesIsoCapability('url', getters()))).toMatchObject({ mincpunumber: 'message.kubernetes.iso.cpu.invalid', minmemory: 'message.kubernetes.iso.memory.invalid', checksum: 'message.kubernetes.iso.checksum.invalid', semanticversion: 'message.kubernetes.iso.version.invalid' })
  expect(() => kubernetesUrlParams(form({ mincpunumber: 0 }), zones, getters())).toThrow()
})
test('payload preserves explicit false, trims optional name and omits global/owner selectors', () => {
  const g = getters(); g.project = { id: zone }
  const params = kubernetesUrlParams(form({ name: '  ', mincpunumber: '2', minmemory: '2048', projectid: zone, account: 'other' }), zones, g)
  expect(params).toMatchObject({ directdownload: false, mincpunumber: 2, minmemory: 2048, arch: 'x86_64' })
  expect(params.name).toBeUndefined(); expect(params.zoneid).toBeUndefined(); expect(params.projectid).toBeUndefined(); expect(params.account).toBeUndefined()
  expect(kubernetesRegistrationName(params, zones)).toBe('v1.30.0')
  expect(kubernetesRegistrationName({ ...params, zoneid: zone }, zones)).toBe('v1.30.0-Zone13')
})
test('particular Zone resolves by UUID and unknown selection/unsupported architecture is rejected', () => {
  expect(kubernetesUrlParams(form({ zoneid: zone, arch: 'aarch64' }), zones, getters()).zoneid).toBe(zone)
  expect(kubernetesUrlErrors(form({ zoneid: iso, arch: 'unknown' }), zones, kubernetesIsoCapability('url', getters()))).toHaveProperty('zoneid')
  expect(kubernetesUrlErrors(form({ arch: 'unknown' }), zones, kubernetesIsoCapability('url', getters()))).toHaveProperty('arch')
})
test('Edge and all-Zone with Edge require direct download; a non-Edge selection does not', () => {
  const edges = [...zones, { id: iso, name: 'Edge', type: 'Edge' }]
  expect(kubernetesDirectDownloadForced(iso, edges)).toBe(true)
  expect(kubernetesDirectDownloadForced('all', edges)).toBe(true)
  expect(kubernetesDirectDownloadForced(zone, edges)).toBe(false)
  expect(kubernetesUrlErrors(form(), edges, kubernetesIsoCapability('url', getters()))).toHaveProperty('directdownload')
})
test('runtime journal recognizes identical requests across modal reopen but not different identity or payload', () => {
  const first = kubernetesUrlAttempt('owner1', { name: 'Example' }); first.entry.state = 'uncertain'
  expect(kubernetesUrlAttempt('owner1', { name: 'Example' })).toMatchObject({ fresh: false, entry: { state: 'uncertain' } })
  expect(kubernetesUrlAttempt('owner1', { name: 'Other' }).fresh).toBe(true)
  expect(kubernetesUrlAttempt('owner2', { name: 'Example' }).fresh).toBe(true)
})
const parent = extra => ({ id, name: 'Example', semanticversion: '1.30.0', isoid: iso, arch: 'x86_64', mincpunumber: 2, minmemory: 2048, directdownload: false, isourl: 'https://example.test/k8s.iso', ...extra })
const parents = rows => ({ listkubernetessupportedversionsresponse: { count: rows.length, kubernetessupportedversion: rows } })
test('accepted parent Ready is not proof of linked ISO readiness; byte-complete is still progress', async () => {
  const request = jest.fn().mockResolvedValueOnce(parents([parent({ isostate: 'Ready' })])).mockResolvedValueOnce({ listisosresponse: { count: 1, iso: [{ id: iso, zoneid: zone, isready: false, status: 'Download Complete' }] } })
  expect(await observeKubernetesUrl(request, { id }, 'all', getters(), {})).toMatchObject({ key: 'progress' })
})
test('multiple ISO pages are checked and failures remain attached to the accepted parent', async () => {
  const request = jest.fn().mockResolvedValueOnce(parents([parent()])).mockResolvedValueOnce({ listisosresponse: { count: 2, iso: [{ id: iso, zoneid: zone, isready: true }] } }).mockResolvedValueOnce({ listisosresponse: { count: 2, iso: [{ id: iso, zoneid: id, isready: false, status: 'DOWNLOAD_ERROR' }] } })
  const result = await observeKubernetesUrl(request, { id }, 'all', getters(), {})
  expect(result.key).toBe('failed'); expect(result.record.id).toBe(id); expect(request.mock.calls[2][1].page).toBe(2)
})
test('a read limitation cannot trigger registration or require an unrelated VM API', async () => {
  const g = getters(); delete g.apis.listIsos
  const request = jest.fn().mockResolvedValue(parents([parent()]))
  expect(await observeKubernetesUrl(request, { id }, 'all', g, {})).toMatchObject({ key: 'forbidden' })
  expect(request).toHaveBeenCalledTimes(1)
})
test('a stale parent observation cannot request its linked ISO in a new scope', async () => {
  const request = jest.fn().mockResolvedValue(parents([parent()]))
  expect(await observeKubernetesUrl(request, { id }, 'all', getters(), {}, () => false)).toEqual({ key: 'stale' })
  expect(request).toHaveBeenCalledTimes(1)
})
test('uncertain reconciliation presents only bounded exact candidates, never infers from a partial catalog', async () => {
  const params = kubernetesUrlParams(form({ name: 'Example' }), zones, getters())
  const request = jest.fn().mockResolvedValue(parents([parent()]))
  expect(await reconcileKubernetesUrl(request, params, zones, getters(), {})).toMatchObject({ status: 'found', rows: [{ id }] })
  request.mockResolvedValue({ listkubernetessupportedversionsresponse: { count: 2, kubernetessupportedversion: [parent()] } })
  expect(await reconcileKubernetesUrl(request, params, zones, getters(), {})).toMatchObject({ status: 'uncertain' })
})

test('unresolved requests survive reload without persisting any source URL, checksum, or session marker', () => {
  const scope = 'reload-owner-private-session'
  const params = { url: 'https://private.example.test/source.iso', checksum: 'test-private-checksum' }
  const first = kubernetesUrlAttempt(scope, params)
  rememberKubernetesUrlAttempt(first.entry, 'uncertain')
  const stored = sessionStorage.getItem('mold.kubernetesIso.url.unresolved.v1')
  expect(stored).not.toContain(scope); expect(stored).not.toContain(params.url); expect(stored).not.toContain(params.checksum)
  let reloaded
  jest.isolateModules(() => { reloaded = require('@/utils/kubernetesIsoRegistration') })
  expect(reloaded.kubernetesUrlAttempt(scope, params)).toMatchObject({ fresh: false, entry: { state: 'uncertain' } })
  expect(reloaded.kubernetesUrlAttempt('different-login', params).fresh).toBe(true)
})
test('a confirmed acceptance is retained at runtime but not falsely replayed as accepted after reload', () => {
  const scope = 'accepted-owner'; const params = { name: 'Example' }
  const operation = kubernetesUrlAttempt(scope, params)
  rememberKubernetesUrlAttempt(operation.entry, 'accepted', { id })
  expect(JSON.parse(sessionStorage.getItem('mold.kubernetesIso.url.unresolved.v1')).entries).toEqual([])
  expect(kubernetesUrlAttempt(scope, params).fresh).toBe(false)
})

test('a changed login scope discards the previous unresolved journal without allocating a resource', () => {
  const operation = kubernetesUrlAttempt('old-login', { name: 'Old operation' }); rememberKubernetesUrlAttempt(operation.entry, 'uncertain')
  synchronizeKubernetesUrlScope('new-login')
  expect(JSON.parse(sessionStorage.getItem('mold.kubernetesIso.url.unresolved.v1')).entries).toEqual([])
})
