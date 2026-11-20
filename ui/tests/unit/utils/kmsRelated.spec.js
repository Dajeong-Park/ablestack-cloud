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

import { getAPI } from '@/api'
import KmsRelatedResources from '@/views/infra/KmsRelatedResources.vue'
import { kmsRelations, kmsRelatedFilter, kmsRelatedQuery, kmsRelatedFailure, kmsRelatedChildLocation, kmsRelatedParentLocation, kmsUsage, readKmsRelatedPage } from '@/utils/kmsRelated'

jest.mock('@/api', () => ({ getAPI: jest.fn() }))
jest.mock('@/components/view/ListView', () => ({ render: () => null }))

const key = '11111111-1111-4111-8111-111111111111'
const hsm = '22222222-2222-4222-8222-222222222222'
const zone = '33333333-3333-4333-8333-333333333333'
const scope = '44444444-4444-4444-8444-444444444444'
const other = '55555555-5555-4555-8555-555555555555'
const getters = { userInfo: { id: key, roletype: 'Admin' }, apis: { listVolumes: {}, listKMSKeys: {} } }
const criteria = { keyword: 'candidate', page: 2, pagesize: 10 }

test('used volumes carry fixed identity, zone and owning account even for another view', async () => {
  const resource = { id: key, zoneid: zone, domainid: scope, account: 'qa' }
  const row = { id: other, kmskeyid: key, zoneid: zone, domainid: scope, account: 'qa' }
  const get = jest.fn().mockResolvedValue({ listvolumesresponse: { count: 13, volume: [row] } })
  await expect(readKmsRelatedPage(get, 'kmskey', resource, getters, criteria)).resolves.toEqual({ rows: [row], count: 13 })
  expect(get).toHaveBeenCalledWith('listVolumes',
    { ...criteria, kmskeyid: key, zoneid: zone, domainid: scope, account: 'qa', listall: true, ignoreproject: true },
    expect.objectContaining({ preserveOnFailure: true }))
})

test('public HSM omits its own account filter, project overrides global owner details', () => {
  const resource = { id: hsm, domainid: scope, account: 'SYSTEM', ispublic: true }
  expect(kmsRelatedFilter('hsmprofile', resource, getters)).toEqual({ hsmprofileid: hsm })
  expect(kmsRelatedFilter('hsmprofile', resource, { ...getters, project: { id: other } })).toEqual({ hsmprofileid: hsm, projectid: other })
})

test('same name, wrong HSM and wrong project cannot pass related list validation', async () => {
  const resource = { id: hsm, projectid: scope }
  const get = jest.fn()
  get.mockResolvedValueOnce({ listkmskeysresponse: { count: 1, kmskey: [{ id: key, name: 'same', hsmprofileid: other, projectid: scope }] } })
  get.mockResolvedValueOnce({ listkmskeysresponse: { count: 1, kmskey: [{ id: key, name: 'same', hsmprofileid: hsm, projectid: other }] } })
  await expect(readKmsRelatedPage(get, 'hsmprofile', resource, getters, criteria)).rejects.toThrow('invalid')
  await expect(readKmsRelatedPage(get, 'hsmprofile', resource, getters, criteria)).rejects.toThrow('invalid')
})

test('a valid empty response is distinct from errors, duplicates or denied access', async () => {
  const resource = { id: hsm }
  const read = get => readKmsRelatedPage(get, 'hsmprofile', resource, getters, criteria)
  const row = { id: key, hsmprofileid: hsm }
  await expect(read(async () => ({ listkmskeysresponse: {} }))).resolves.toEqual({ rows: [], count: 0 })
  await expect(read(async () => ({ listkmskeysresponse: { errorcode: 403 } }))).rejects.toThrow('invalid')
  await expect(read(async () => ({ listkmskeysresponse: { count: 2, kmskey: [row, row] } }))).rejects.toThrow('invalid')
  await expect(readKmsRelatedPage(jest.fn(), 'hsmprofile', resource, { apis: {} }, criteria)).rejects.toThrow('forbidden')
})

test('missing relates only to real 404 or invalid UUID of the parent, and permissions stay distinct', () => {
  const failed = { response: { status: 503 } }
  const notFound = { response: { status: 431, data: { errorresponse: { errortext: 'Invalid parameter hsmprofileid value=' + hsm + ' due to incorrect long value format, or entity does not exist' } } } }
  expect(kmsRelatedFailure(notFound, kmsRelations.hsmprofile, hsm)).toBe('missing')
  expect(kmsRelatedFailure(notFound, kmsRelations.hsmprofile, other)).toBe('failed')
  expect(kmsRelatedFailure(failed, kmsRelations.hsmprofile, hsm)).toBe('failed')
  expect(kmsRelatedFailure(new Error('forbidden'), kmsRelations.hsmprofile, hsm)).toBe('forbidden')
})

test('usage remains separate from visible rows, including zero, historical counts and null', () => {
  expect(kmsUsage('kmskey', { usage: { volumecount: 0, wrappedkeycount: 3 } })).toEqual({ volumecount: 0, wrappedkeycount: 3 })
  expect(kmsUsage('hsmprofile', { usage: { kmskeycount: 0, versionwrappedkeycount: 2 } })).toEqual({ kmskeycount: 0, versionwrappedkeycount: 2 })
  expect(kmsUsage('hsmprofile', {})).toBeNull()
  expect(kmsUsage('hsmprofile', { usage: { kmskeycount: 0 } })).toBeNull()
})

test('related detail returns to a whitelisted tab and exact UUID only for the same session and scope', () => {
  const route = { path: '/hsmprofile/' + hsm, meta: { name: 'hsmprofile' }, params: { id: hsm }, query: { relatedkeyword: 'needle', relatedpage: '2', relatedpagesize: '10', action: 'deleteHSMProfile', projectid: scope } }
  const kmsReturn = { kind: 'hsmprofile', id: hsm }
  const child = kmsRelatedChildLocation(route, { id: key, projectid: scope }, { kmsReturn }, getters, 'test-session')
  expect(child.query).toEqual({ projectid: scope })
  expect(JSON.stringify(child)).not.toContain('test-session')
  const destination = { meta: { name: 'kmskey' }, params: { id: key } }
  expect(kmsRelatedParentLocation(destination, child.state, getters, 'test-session')).toEqual({
    path: route.path, query: { relatedkeyword: 'needle', relatedpage: '2', relatedpagesize: '10', tab: kmsRelations.hsmprofile.tab, projectid: scope }, state: { kmsReturn, kmsRelatedReturn: null }
  })
  expect(kmsRelatedParentLocation(destination, {}, getters, 'test-session')).toBeNull()
  expect(kmsRelatedParentLocation(destination, child.state, { ...getters, project: { id: other } }, 'test-session')).toBeNull()
  expect(kmsRelatedParentLocation({ ...destination, params: { id: other } }, child.state, getters, 'test-session')).toBeNull()
  expect(kmsRelatedQuery({ relatedpage: ['2'], relatedpagesize: '1000', relatedkeyword: ['x'] })).toEqual({ page: 1, pagesize: 20, keyword: '' })
})

test('a late response from the old parent cannot populate the current scope or leave its count', async () => {
  let release
  getAPI.mockReset()
  getAPI.mockImplementationOnce(() => new Promise(resolve => { release = resolve }))
  getAPI.mockResolvedValueOnce({ listkmskeysresponse: {} })
  const vm = {
    active: true,
    hasTarget: true,
    canRead: true,
    resource: { id: hsm },
    kind: 'hsmprofile',
    definition: kmsRelations.hsmprofile,
    criteria: { keyword: '', page: 1, pagesize: 20 },
    generation: 0,
    context: 'old',
    $store: { getters }
  }
  const first = KmsRelatedResources.methods.fetchData.call(vm)
  vm.resource = { id: other }
  vm.context = 'current'
  await KmsRelatedResources.methods.fetchData.call(vm)
  release({ listkmskeysresponse: { count: 1, kmskey: [{ id: key, hsmprofileid: hsm }] } })
  await first
  expect(vm.rows).toEqual([])
  expect(vm.count).toBe(0)
  expect(vm.status).toBe('ready')
})
