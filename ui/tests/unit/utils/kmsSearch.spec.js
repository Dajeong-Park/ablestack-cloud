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

import { kmsQuery, kmsSearchFields, kmsSearchQuery, kmsParams, readKmsPage, kmsProtocolOptions, kmsDetails, hsmOwnerScope } from '@/utils/kmsSearch'

const id = '11111111-1111-4111-8111-111111111111'
const other = '22222222-2222-4222-8222-222222222222'
const apis = { listKMSKeys: {}, listHSMProfiles: {}, listZones: {}, listProjects: {}, listAccounts: {}, listDomains: {} }
const admin = { apis, userInfo: { roletype: 'Admin' } }
const hsm = 'listHSMProfiles'
const kms = 'listKMSKeys'
const current = () => true

test('false and true survive URL normalization and request projection', () => {
  const query = kmsQuery({ enabled: false, ispublic: true, protocol: '  ExistingVendor  ', keyword: ' test ', page: 3 }, hsm, admin)
  expect(query).toEqual({ enabled: 'false', ispublic: 'true', protocol: 'ExistingVendor', keyword: 'test', q: 'test', page: '3', pagesize: '20' })
  expect(kmsParams(query)).toEqual({ enabled: 'false', ispublic: 'true', protocol: 'ExistingVendor', keyword: 'test', page: '3', pagesize: '20', listall: true, ignoreproject: true })
  expect(kmsQuery({ enabled: 'all' }, kms, admin)).not.toHaveProperty('enabled')
})
test('missing picker permission and non-admin owner inputs cannot reach requests', () => {
  const user = { apis: { listKMSKeys: {} }, userInfo: { roletype: 'User' } }
  expect(kmsSearchFields(kms, user)).toEqual(['enabled'])
  expect(kmsQuery({ account: 'another', domainid: id, projectid: other, hsmprofileid: id }, kms, user)).toEqual({ page: '1', pagesize: '20' })
  expect(kmsSearchFields(kms, { ...admin, userInfo: { roletype: 'DomainAdmin' } })).toContain('domainid')
})
test('project wins over account/domain while unqualified account is removed', () => {
  const project = { ...admin, project: { id: other } }
  expect(kmsQuery({ account: 'admin', domainid: id, projectid: id }, hsm, project)).toEqual({ projectid: other, page: '1', pagesize: '20' })
  expect(kmsQuery({ account: 'admin' }, hsm, admin)).not.toHaveProperty('account')
})
test('keyword and advanced filters compose and reset page while full reset clears both', () => {
  const a = kmsQuery({ protocol: 'database', enabled: false, page: 4 }, hsm, admin)
  const b = kmsSearchQuery(a, { searchQuery: 'wanted' }, hsm, admin, 20)
  expect(b).toMatchObject({ protocol: 'database', enabled: 'false', keyword: 'wanted', q: 'wanted', page: '1' })
  const c = kmsSearchQuery(b, { kmsAdvanced: { ispublic: 'false' } }, hsm, admin, 20)
  expect(c).toMatchObject({ ispublic: 'false', keyword: 'wanted', page: '1' })
  expect(c).not.toHaveProperty('enabled')
  expect(kmsSearchQuery(c, {}, hsm, admin, 20)).toEqual({ page: '1', pagesize: '20' })
})
test('loaded provider display names precede safe fallbacks and saved protocol remains selectable', () => {
  expect(kmsProtocolOptions({ kmsproviders: [{ protocol: 'legacy', displayname: 'Legacy' }] }, 'uninstalled')[0]).toEqual({ id: 'legacy', name: 'Legacy' })
  expect(kmsProtocolOptions({}, 'uninstalled')).toContainEqual({ id: 'uninstalled', name: 'uninstalled' })
})
test('metadata retains role-gated KEK and identifies HSM scope without guessing health', () => {
  expect(kmsDetails('kmskey', 'User')).not.toContain('keklabel')
  expect(kmsDetails('kmskey', 'Admin')).toContain('keklabel')
  expect(kmsDetails('kmskey', 'Admin')).not.toContain('id')
  expect(hsmOwnerScope({ ispublic: true, account: 'system' })).toBe('public')
  expect(hsmOwnerScope({ domainid: id })).toBe('domain')
  expect(hsmOwnerScope({ enabled: true, projectid: id })).toBe('project')
  expect(hsmOwnerScope({ account: 'admin' })).toBe('account')
  expect(hsmOwnerScope({ enabled: true })).toBe('')
})
test('a deleted or no longer accessible HSM candidate cannot result in a broader key search', async () => {
  const get = jest.fn().mockResolvedValue({ listhsmprofilesresponse: {} })
  await expect(readKmsPage(get, kms, { hsmprofileid: id }, current)).rejects.toThrow('profile')
  expect(get).toHaveBeenCalledTimes(1)
  expect(get.mock.calls[0][1]).toMatchObject({ id, ignoreproject: true })
})
test('new filter rejected by a stale response is not displayed as successful data', async () => {
  const get = jest.fn().mockResolvedValue({ listhsmprofilesresponse: { count: 1, hsmprofile: [{ id, enabled: true }] } })
  await expect(readKmsPage(get, hsm, { enabled: 'false' }, current)).rejects.toThrow('response')
  expect(get).toHaveBeenCalledWith(hsm, { enabled: 'false' }, expect.objectContaining({ preserveOnFailure: true }))
})
test('empty envelope has explicit count zero and API errors are distinct', async () => {
  await expect(readKmsPage(async () => ({ listhsmprofilesresponse: {} }), hsm, {}, current))
    .resolves.toEqual({ listhsmprofilesresponse: { count: 0 } })
  await expect(readKmsPage(async () => ({ listhsmprofilesresponse: { errorcode: 431 } }), hsm, {}, current)).rejects.toThrow('response')
  await expect(readKmsPage(jest.fn(), hsm, {}, () => false)).rejects.toThrow('stale')
})
