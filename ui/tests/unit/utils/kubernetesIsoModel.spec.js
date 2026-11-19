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

import { kubernetesIsoApis as apis, kubernetesIsoCapability as cap, canKubernetesIsoAction, kubernetesIsoParameterHelp, kubernetesIsoRegistrationParams as params, kubernetesIsoContext } from '@/utils/kubernetesIsoCapabilities'
import { normalizeKubernetesIso as normalize, kubernetesIsoZone, kubernetesIsoListResponse as page, kubernetesIsoReadParams, kubernetesIsoFailure, kubernetesIsoAvailability, kubernetesIsoUploadResponse, kubernetesIsoWriteResponse } from '@/utils/kubernetesIsoModel'
const id = '11111111-1111-4111-8111-111111111111'
const other = '22222222-2222-4222-8222-222222222222'
const getters = (role = 'Admin', commands = Object.values(apis)) => ({ userInfo: { id: 'actor', roletype: role, roleid: 'role' }, apis: Object.fromEntries(commands.map(api => [api, {}])) })
const response = (rows, count = rows.length) => ({ listkubernetessupportedversionsresponse: { count, kubernetessupportedversion: rows } })
test('local-only capability does not borrow URL metadata, and unrelated ISO/VM grants do not confer catalog access', () => {
  const g = getters('Admin', [apis.local])
  expect(cap('local', g).available).toBe(true); expect(cap('url', g).available).toBe(false); expect(cap('read', g).available).toBe(false)
  expect(cap('local', getters('User')).available).toBe(false)
  expect(canKubernetesIsoAction('delete', { id }, getters('User'))).toBe(false)
  expect(cap('read', getters('User', ['listIsos', 'listVirtualMachinesMetrics'])).available).toBe(false)
  expect(cap('read', getters('User', [apis.read])).available).toBe(true)
  expect(kubernetesIsoParameterHelp({}).arch.description).toBe('')
})
test.each(['url', 'local'])('%s request preserves false and zero, removes inherited ownership and incompatible fields', mode => {
  const p = params(mode, { name: 'Image', directdownload: false, mincpunumber: 0, minmemory: 0, account: 'owner', domainid: id, projectid: other, url: 'http://example.test/image.iso' }, { ...getters(), project: { id: other } })
  expect(p).toMatchObject({ name: 'Image', mincpunumber: 0, minmemory: 0 })
  expect(p.account).toBeUndefined(); expect(p.projectid).toBeUndefined(); expect(p.domainid).toBeUndefined()
  if (mode === 'url') expect(p.directdownload).toBe(false)
  else { expect(p).toMatchObject({ format: 'ISO' }); expect(p.url).toBeUndefined(); expect(p.directdownload).toBeUndefined() }
})
test('schema-known local arch is withheld until the server advertises it', () => {
  const g = getters('Admin', [apis.local]); g.apis[apis.local].params = [{ name: 'name' }]
  expect(params('local', { name: 'Name', arch: 'aarch64' }, g)).toEqual({ name: 'Name', format: 'ISO' })
})
test('minimum and partial records retain unknowns; explicit false/zero are not replaced by defaults', () => {
  const p = normalize({ id, supportsha: false, supportsautoscaling: 'false', directdownload: false, mincpunumber: 0, minmemory: 0, isourl: 'private-url' }, getters('User'))
  expect(p).toMatchObject({ supportsha: false, supportsautoscaling: false, directdownload: false, mincpunumber: 0, minmemory: 0, catalog: { versionState: 'unknown', zone: { kind: 'unknown' } } })
  expect(p.isourl).toBeUndefined(); expect(normalize({ id }).directdownload).toBeUndefined()
  expect(normalize({ id, isourl: 'admin-url' }, getters()).isourl).toBe('admin-url')
})
test('Zone links require a valid UUID; intentional global omission differs from an arbitrary partial record', () => {
  expect(kubernetesIsoZone({ id })).toEqual({ kind: 'unknown', id: null })
  expect(kubernetesIsoZone({ id, zoneid: null })).toEqual({ kind: 'all', id: null })
  expect(page(response([{ id, semanticversion: '1.36.5' }])).rows[0].catalog.zone.kind).toBe('all')
  expect(kubernetesIsoZone({ zoneid: '-1', zonename: 'All' }).kind).toBe('unknown')
  expect(kubernetesIsoZone({ zoneid: id, zonename: 'Zone13' })).toEqual({ kind: 'zone', id, name: 'Zone13' })
})
test.each([{}, { listkubernetessupportedversionsresponse: null }, response(null, 0), response([{ id }], 0), response([], 3), response([{ id: 'broken' }], 1), response([], false)])('malformed payload is never silently a successful empty list: %j', json => {
  expect(() => page(json)).toThrow('message.kubernetes.iso.read.invalid')
})
test('known empty list, missing detail, minimal detail and mismatched UUID have different outcomes', () => {
  expect(page({ listkubernetessupportedversionsresponse: {} }).status).toBe('empty')
  expect(page(response([]), {}, id).status).toBe('missing')
  expect(page(response([{ id }]), {}, id).status).toBe('ready')
  expect(() => page(response([{ id: other }]), {}, id)).toThrow()
  expect(kubernetesIsoReadParams({ projectid: other, isofilter: 'self', listall: true, keyword: 'part', page: 2 })).toEqual({ keyword: 'part', page: 2 })
  expect(kubernetesIsoReadParams({ page: 3, keyword: 'old' }, id)).toEqual({ id })
})
test.each([
  [{ response: { status: 401, data: { errorresponse: { errorcode: 431, errortext: 'command not available for user' } } } }, 'forbidden'],
  [{ response: { status: 531 } }, 'forbidden'], [{ response: { status: 403 } }, 'forbidden'],
  [{ response: { status: 401 } }, 'expired'], [{ response: { status: 404 } }, 'missing'],
  [{ response: { status: 503 } }, 'failed'], [{ message: 'Network Error' }, 'network']
])('denial, expiration and transient failures stay distinct', (error, state) => expect(kubernetesIsoFailure(error)).toBe(state))
test('version Enabled and reported ISO Ready cannot substitute for a current scoped observation', () => {
  const row = { id, isoid: other, state: 'Enabled', isostate: 'Ready' }
  expect(kubernetesIsoAvailability(row)).toMatchObject({ key: 'unqueried', versionState: 'enabled', reportedState: 'Ready' })
  expect(kubernetesIsoAvailability(row, { isoid: id, status: 'ready', rows: [] }).key).toBe('unqueried')
  expect(kubernetesIsoAvailability(row, { isoid: other, status: 'forbidden' }).key).toBe('forbidden')
  expect(kubernetesIsoAvailability(row, { isoid: other, status: 'loading' }).key).toBe('loading')
  expect(kubernetesIsoAvailability(row, { isoid: other, status: 'ready', rows: [{ id: other }] }).key).toBe('invalid')
  expect(kubernetesIsoAvailability(row, { isoid: other, status: 'ready', rows: [{ id: other, zoneid: id, isready: false, status: 'DOWNLOAD_ERROR' }] }).key).toBe('failed')
})
const ticket = { id, postURL: 'https://ssvm.example.test/upload', signature: 'test-signature', expires: 'test-expiry', metadata: 'test-metadata' }
test.each([ticket, { getuploadparams: ticket }])('local ticket supports direct and nested response without treating it as a version record', body => {
  expect(kubernetesIsoUploadResponse({ getuploadparamsforkubernetessupportedversionresponse: body })).toEqual(ticket)
})
test.each([{}, { getuploadparams: {} }, { getuploadparams: { ...ticket, signature: '' } }, { errorcode: 531 }])('incomplete/denied tickets fail before any file transmission', body => {
  expect(() => kubernetesIsoUploadResponse({ getuploadparamsforkubernetessupportedversionresponse: body })).toThrow()
})
test('write receipt requires a real version resource', () => {
  expect(() => kubernetesIsoWriteResponse({}, 'url')).toThrow()
  expect(kubernetesIsoWriteResponse({ updatekubernetessupportedversionresponse: { kubernetessupportedversion: { id, state: 'Disabled' } } }, 'update').catalog.versionState).toBe('disabled')
})
test.each(['account', 'role', 'apis', 'project', 'session', 'target'])('runtime context invalidates stale work when %s changes', change => {
  const g = getters(); const original = kubernetesIsoContext(g, 'session', id)
  if (change === 'account') g.userInfo.id = 'new'
  if (change === 'role') g.userInfo.roleid = 'new'
  if (change === 'apis') delete g.apis[apis.local]
  if (change === 'project') g.project = { id: other }
  expect(kubernetesIsoContext(g, change === 'session' ? 'new' : 'session', change === 'target' ? other : id)).not.toBe(original)
})

test.each([531, 403, 401, 530])('HTTP200 with API errorcode%s retains the API failure rather than becoming empty data', code => {
  let error
  try { page({ listkubernetessupportedversionsresponse: { errorcode: code } }) } catch (failure) { error = failure }
  expect(kubernetesIsoFailure(error)).toBe([531, 403].includes(code) ? 'forbidden' : code === 401 ? 'expired' : 'failed')
})
test('partial capability metadata cannot crash runtime ownership tracking', () => {
  const g = getters(); g.apis[apis.read].params = [null, {}, { name: 'id' }]
  expect(() => kubernetesIsoContext(g, 'session', id)).not.toThrow()
})
