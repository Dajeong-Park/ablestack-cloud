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
import { kmsDeletionConfirmed, kmsDetailFailure, kmsDetailKey, kmsDetailLocation, kmsDetailReadScope, kmsListLocation, readKmsDetail } from '@/utils/kmsNavigation'

const id = '11111111-1111-4111-8111-111111111111'
const project = '22222222-2222-4222-8222-222222222222'
const other = '33333333-3333-4333-8333-333333333333'
const token = 'session-for-test'
const getters = {
  apis: { listKMSKeys: {}, listZones: {}, listHSMProfiles: {}, listProjects: {}, listDomains: {}, listAccounts: {} },
  userInfo: { id, roletype: 'Admin', roleid: other }
}
const list = { meta: { name: 'kmskey' }, path: '/kmskey', params: {}, query: {} }
const detail = { ...list, path: '/kmskey/' + id, params: { id } }
const hsm = { ...detail, meta: { name: 'hsmprofile' } }

test('same-tab history uses normalized fields and passes no return data in a copyable URL', () => {
  const query = { keyword: 'qa', enabled: 'true', zoneid: other, hsmprofileid: id, projectid: project, page: '2', pagesize: '50' }
  const link = kmsDetailLocation({ ...list, query: { ...query, id, token, sessionkey: token, action: 'deleteKMSKey', path: '//outside', sortkey: 'name' } }, { id, projectid: project }, getters, token)
  expect(link.path).toBe(detail.path)
  expect(link.query).toEqual({ projectid: project })
  expect(JSON.stringify(link)).not.toContain(token)
  expect(kmsListLocation(detail, link.state, getters, token)).toEqual({ path: '/kmskey', query: { ...query, q: 'qa' }, state: { kmsReturn: null } })
  expect(kmsListLocation(detail, {}, getters, token, 50).query).toEqual({ page: '1', pagesize: '50' })
})

test('changed session, project, resource or permission restores the current defaults', () => {
  const { state } = kmsDetailLocation({ ...list, query: { q: 'original', page: '3' } }, { id }, getters, token)
  expect(kmsListLocation(detail, state, getters, 'different').query).toEqual({ page: '1', pagesize: '20' })
  expect(kmsListLocation(detail, state, { ...getters, project: { id: project } }, token).query).toEqual({ projectid: project, page: '1', pagesize: '20' })
  expect(kmsListLocation(hsm, state, getters, token).path).toBe('/hsmprofile')
  expect(kmsListLocation({ ...detail, params: { id: other } }, state, getters, token).query).not.toHaveProperty('q')
  expect(kmsListLocation(detail, state, { ...getters, apis: {} }, token).query).not.toHaveProperty('q')
})

test('KMS detail scope is independent of the tab and constrains explicit project links', () => {
  const route = { ...detail, query: { projectid: project, tab: 'events', enabled: 'false' } }
  expect(kmsDetailKey(route, getters)).toBe(kmsDetailKey({ ...route, query: { projectid: project, tab: 'details' } }, getters))
  expect(kmsDetailReadScope(route, getters)).toEqual({ projectid: project })
  expect(kmsDetailReadScope(route, { ...getters, project: { id: other } })).toEqual({ projectid: other })
  expect(kmsDetailReadScope(detail, { ...getters, listAllProjects: true })).toEqual({ projectid: '-1' })
})

test('detail reads only the requested UUID and project without forwarding filters or action', async () => {
  const row = { id, projectid: project }
  const get = jest.fn().mockResolvedValue({ listkmskeysresponse: { count: 1, kmskey: [row] } })
  const route = { ...detail, query: { projectid: project, keyword: 'ignored', tab: 'events', action: 'deleteKMSKey' } }
  await expect(readKmsDetail(get, route, getters)).resolves.toBe(row)
  expect(get).toHaveBeenCalledWith('listKMSKeys', { id, projectid: project, listall: true, ignoreproject: true }, expect.objectContaining({ preserveOnFailure: true }))
  await expect(readKmsDetail(get, route, { ...getters, project: { id: other } })).rejects.toThrow('INVALID_TARGET')
  get.mockResolvedValue({ listkmskeysresponse: { count: 1, kmskey: [{ id: other, name: 'same-name', projectid: project }] } })
  await expect(readKmsDetail(get, route, getters)).rejects.toThrow('INVALID_TARGET')
  get.mockResolvedValue({ listkmskeysresponse: {} })
  await expect(readKmsDetail(get, route, getters)).rejects.toThrow('missing')
  await expect(readKmsDetail(get, route, { apis: {} })).rejects.toThrow('forbidden')
})

test.each([[404, 'missing'], [403, 'forbidden'], [531, 'forbidden'], [503, 'failed'], [431, 'failed'], [undefined, 'failed']])('detail failure %s stays %s', (status, reason) => {
  expect(kmsDetailFailure({ response: { status } })).toBe(reason)
})

test('only confirmed removal in the issuing detail can return to its list', () => {
  const action = { api: 'deleteKMSKey', kmsTarget: { id }, kmsNavigationScope: 'issuing-detail' }
  const result = { kmsRemoved: id, kmsNavigationScope: 'issuing-detail' }
  expect(kmsDeletionConfirmed(detail, action, result, 'issuing-detail')).toBe(true)
  expect(kmsDeletionConfirmed(detail, action, result, 'other-tab-or-project')).toBe(false)
  expect(kmsDeletionConfirmed(detail, action, { ...result, kmsNavigationScope: 'old-operation' }, 'issuing-detail')).toBe(false)
  expect(kmsDeletionConfirmed(detail, action, {}, 'issuing-detail')).toBe(false)
  expect(kmsDeletionConfirmed(hsm, action, result, 'issuing-detail')).toBe(false)
})

test('HSM public, zone and owner filters survive history without carrying unrelated detail parameters', () => {
  const query = { ispublic: 'false', zoneid: id, domainid: other, account: 'owner', protocol: 'database', enabled: 'true', page: '2', pagesize: '10' }
  const route = { ...hsm, params: {}, query: { ...query, id, sortorder: 'desc' } }
  const { state } = kmsDetailLocation(route, { id }, getters, token)
  expect(kmsListLocation(hsm, state, getters, token).query).toEqual(query)
})
