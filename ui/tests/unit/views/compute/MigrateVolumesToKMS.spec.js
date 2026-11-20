// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements. See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership. The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License. You may obtain a copy of the License at
//
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied. See the License for the
// specific language governing permissions and limitations
// under the License.

import Migration from '@/views/compute/MigrateVolumesToKMS'
import Autogen from '@/views/AutogenView'
import kms from '@/config/section/kms'
import { migrationParams, migrationList, migrationPreflight, migrationOutcome } from '@/utils/kmsVolumeMigration'
import { getAPI, postAPI } from '@/api'
jest.mock('@/api', () => ({ getAPI: jest.fn(), postAPI: jest.fn() }))
const target = { id: 'key', name: 'K', accountid: 'owner', account: 'A', domainid: 'D', zoneid: 'Z', enabled: true }
const volume = { id: 'v1', name: 'V', kmsmigrationeligible: true, kmsmigrationreason: 'ELIGIBLE_LEGACY' }
const response = rows => ({ listvolumesresponse: { count: rows.length, volume: rows } })
function model () {
  const apis = { listVolumes: { params: ['kmsmigrationkeyid', 'kmsmigrationeligible'].map(name => ({ name })) }, listKMSKeys: {}, migrateVolumesToKMS: {}, queryAsyncJobResult: {} }
  const c = { resource: { ...target }, $store: { getters: { apis, userInfo: { id: 'admin', roletype: 'Admin' }, project: {} }, state: { user: { token: 'session' } } }, $route: { path: '/kmskey/key' }, $t: key => key, $emit: jest.fn() }
  Object.assign(c, Migration.data.call(c))
  for (const [key, method] of Object.entries(Migration.methods)) c[key] = method.bind(c)
  for (const [key, getter] of Object.entries(Migration.computed)) Object.defineProperty(c, key, { get: () => getter.call(c) })
  c.originalScope = c.scope()
  return c
}
beforeEach(() => { jest.clearAllMocks(); getAPI.mockImplementation(async api => api === 'listKMSKeys' ? { listkmskeysresponse: { count: 1, kmskey: [target] } } : response([volume])) })
test('account and project scope derive only from target', () => {
  expect(migrationParams(target, { account: 'evil', zoneid: 'other' })).toMatchObject({ account: 'A', zoneid: 'Z', domainid: 'D', kmsmigrationkeyid: 'key' })
  expect(migrationParams(target, { projectid: 'other' }).projectid).toBeUndefined()
  expect(migrationParams({ ...target, projectid: 'P' })).toEqual({ projectid: 'P', zoneid: 'Z', kmsmigrationkeyid: 'key', listall: true, ignoreproject: true })
})
test.each([{}, { listvolumesresponse: { count: 1, volume: [{ id: 'v' }] } }, response([{ ...volume, kmsmigrationreason: 'FUTURE' }])])('old or unknown server fails closed %j', json => { expect(() => migrationList(json)).toThrow() })
test('canonical empty list envelope is zero candidates and never implies eligibility', () => {
  expect(migrationList({ listvolumesresponse: {} })).toEqual({ rows: [], count: 0 })
  expect(migrationPreflight(['v1'], migrationList({ listvolumesresponse: {} }).rows)).toBe(false)
})
test('old API schema blocks even an empty candidate response', async () => {
  const c = model(); c.$store.getters.apis.listVolumes.params = []
  await c.load()
  expect(c.valid).toBe(false)
  expect(getAPI).not.toHaveBeenCalled()
  expect(postAPI).not.toHaveBeenCalled()
})
test('missing selected UUID and changed eligibility block preflight', () => {
  expect(migrationPreflight(['v1', 'gone'], [volume])).toBe(false)
  expect(migrationPreflight(['v1'], [{ ...volume, kmsmigrationeligible: false }])).toBe(false)
})
test('page selection retains only seen eligible UUIDs', () => {
  const c = model()
  c.select(['v1'], [volume]); c.select(['v1', 'v2', 'unseen'], [volume, { ...volume, id: 'v2' }])
  expect(c.selected).toEqual(['v1', 'v2'])
  Migration.watch.scopeStamp.call(c)
  expect(c.selected).toEqual([])
})
test('pagination and search stay on server', async () => {
  const c = model(); c.page = 3; c.keyword = 'disk'; c.filter = 'ineligible'
  await c.load()
  expect(getAPI).toHaveBeenLastCalledWith('listVolumes', expect.objectContaining({ page: 3, pagesize: 10, keyword: 'disk', kmsmigrationeligible: false }), expect.any(Object))
})
test('delayed old page cannot replace newer page', async () => {
  const c = model(); let resolveRequest
  getAPI.mockImplementation(api => api === 'listKMSKeys' ? Promise.resolve({ listkmskeysresponse: { kmskey: [target] } }) : new Promise(resolve => { resolveRequest = resolve }))
  const old = c.load(); await Promise.resolve(); await Promise.resolve()
  getAPI.mockResolvedValue(response([{ ...volume, id: 'new' }]))
  c.targetCheck = jest.fn()
  await c.load()
  resolveRequest(response([volume])); await old
  expect(c.rows[0].id).toBe('new')
})
test.each(['missing', 'ineligible', 'error', 'target'])('pre-submit %s never sends POST', async type => {
  const c = model(); c.select(['v1'], [volume])
  if (type === 'target') getAPI.mockResolvedValue({ listkmskeysresponse: { kmskey: [{ ...target, accountid: 'other' }] } })
  else if (type === 'error') getAPI.mockRejectedValue(new Error('offline'))
  else getAPI.mockImplementation(async api => api === 'listKMSKeys' ? { listkmskeysresponse: { kmskey: [target] } } : response(type === 'missing' ? [] : [{ ...volume, kmsmigrationeligible: false, kmsmigrationreason: 'ALREADY_KMS' }]))
  await c.submit()
  expect(postAPI).not.toHaveBeenCalled()
  expect(c.started).toBe(false)
})
test.each([1, 2])('whole success or partial failure is re-observed and never retried (%i)', async status => {
  const c = model(); c.select(['v1'], [volume])
  let migrated = false
  getAPI.mockImplementation(async api => {
    if (api === 'listKMSKeys') return { listkmskeysresponse: { kmskey: [target] } }
    if (api === 'queryAsyncJobResult') { migrated = true; return { queryasyncjobresultresponse: { jobstatus: status, jobresult: { success: true, requested: 1, migrated: 1, skipped: 0 } } } }
    return response([migrated ? { ...volume, kmskeyid: 'key', kmsmigrationeligible: false, kmsmigrationreason: 'ALREADY_KMS' } : volume])
  })
  postAPI.mockResolvedValue({ migratevolumestokmsresponse: { jobid: 'job' } })
  await c.submit(); await c.submit()
  expect(postAPI).toHaveBeenCalledTimes(1)
  expect(c.results[0].status).toBe('connected')
  expect(c.terminal).toBe(status === 1 ? 'success' : 'failed')
})
test('lost POST response stays unknown even after observing key connection', async () => {
  const c = model(); c.select(['v1'], [volume])
  postAPI.mockRejectedValue(new Error('response lost'))
  await c.submit()
  expect(c.terminal).toBe('unknown'); expect(c.results[0].status).toBe('not_migrated')
  await c.checkResult()
  expect(postAPI).toHaveBeenCalledTimes(1)
})
test('zero migrated receipt has no positive success indication', () => {
  const c = model(); c.terminal = 'success'; c.receipt = { requested: 1, migrated: 0, skipped: 1 }
  expect(c.resultType).toBe('warning')
})
test('other key or missing resource has unknown outcome', () => {
  expect(migrationOutcome({ kmskeyid: 'other' }, 'key')).toBe('unknown')
  expect(migrationOutcome(undefined, 'key')).toBe('unknown')
})

test('detail action keeps the target in a dialog without routing or generic candidate requests', () => {
  const c = model()
  c.$route = { path: '/kmskey/key', name: 'kmskey', meta: { name: 'kmskey' }, params: { id: 'key' }, query: {} }
  c.$router = { push: jest.fn() }
  c.storageActionGeneration = 0
  const action = kms.children.find(section => section.name === 'kmskey').actions.find(action => action.api === 'migrateVolumesToKMS')
  Autogen.methods.execAction.call(c, { ...action, resource: c.resource }, false)
  expect(c.showAction).toBe(true)
  expect(c.resource.id).toBe(target.id)
  expect(c.currentAction.selfManagedDialog).toBe(true)
  expect(c.currentAction.popup).toBe(true)
  expect(c.$router.push).not.toHaveBeenCalled()
  expect(getAPI).not.toHaveBeenCalled()
})
