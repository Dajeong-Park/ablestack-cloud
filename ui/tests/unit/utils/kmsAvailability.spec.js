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

import { actionAvailability, hsmCandidateReason, loadScopedHsmCandidates, kmsAvailabilityFailure } from '@/utils/kmsAvailability'
import Dialog from '@/views/infra/KmsOperationDialog'
import { getAPI, postAPI } from '@/api'

jest.mock('@/api', () => ({ getAPI: jest.fn(), postAPI: jest.fn() }))
const id = '11111111-1111-4111-8111-111111111111'
const profileId = '22222222-2222-4222-8222-222222222222'
const nextProfileId = '33333333-3333-4333-8333-333333333333'
const apis = {
  createKMSKey: {},
  rotateKMSKey: {},
  updateKMSKey: {},
  deleteHSMProfile: {},
  migrateVolumesToKMS: {},
  listKMSKeys: {},
  listHSMProfiles: {},
  listVolumes: {},
  listZones: {},
  queryAsyncJobResult: {}
}
const owner = { account: 'alice', domainid: 'domain', zoneid: 'zone' }
const key = { id, enabled: true, ...owner, name: 'key', hsmprofileid: profileId, version: 1, keybits: 256 }
const profile = { id: profileId, name: 'HSM Database Provider', enabled: true, ...owner }

test('inactive keys cannot rotate or migrate, but editing can enable them', () => {
  const view = { apis, scope: { role: 'Admin' }, resource: { ...key, enabled: false } }
  expect(actionAvailability('rotateKMSKey', view)).toBe('keyDisabled')
  expect(actionAvailability('migrateVolumesToKMS', view)).toBe('keyDisabled')
  expect(actionAvailability('updateKMSKey', view)).toBe('')
})
test.each(['loading', 'empty', 'error', 'forbidden', 'stale'])('candidate state %s is preserved', candidate => {
  expect(actionAvailability('createKMSKey', { apis, candidate })).toBe(candidate)
})
test('a scoped permission and the system policy are independent of names', () => {
  expect(actionAvailability('createKMSKey', { apis: { createKMSKey: {} } })).toBe('forbidden')
  const view = { apis, scope: { role: 'Admin' }, resource: { ...profile, deleteprotected: false } }
  expect(actionAvailability('deleteHSMProfile', view)).toBe('')
  view.resource = { ...profile, name: 'renamed', deleteprotected: true, deletereason: 'SYSTEM_DATABASE_PROFILE' }
  expect(actionAvailability('deleteHSMProfile', view)).toBe('systemDatabase')
  expect(actionAvailability('deleteHSMProfile', { ...view, scope: { role: 'User' } })).toBe('forbidden')
  expect(actionAvailability('deleteHSMProfile', { ...view, resource: { ...profile } })).toBe('deletePolicy')
})
test('candidate scope admits public, domain, own account and own project only at compatible zones', () => {
  expect(hsmCandidateReason({ ...profile, ispublic: true, account: 'other' }, owner)).toBe('')
  expect(hsmCandidateReason({ id: profileId, enabled: true, domainid: 'domain' }, owner)).toBe('')
  expect(hsmCandidateReason({ ...profile, account: 'other' }, owner)).toBe('profileScope')
  expect(hsmCandidateReason({ ...profile, domainid: 'other' }, owner)).toBe('profileScope')
  expect(hsmCandidateReason({ ...profile, zoneid: 'other' }, owner)).toBe('profileZone')
  expect(hsmCandidateReason({ ...profile, projectid: 'project' }, { ...owner, projectid: 'project' })).toBe('')
  expect(hsmCandidateReason({ ...profile, projectid: 'project' }, { ...owner, projectid: 'other' })).toBe('profileScope')
  expect(hsmCandidateReason({ ...profile, enabled: false }, owner)).toBe('profileDisabled')
  expect(hsmCandidateReason({ ...profile, zoneid: undefined }, owner)).toBe('')
})
test('permission errors remain distinct from transport or server failures', () => {
  expect(kmsAvailabilityFailure({ response: { status: 403 } })).toBe('forbidden')
  expect(kmsAvailabilityFailure({ response: { status: 530 } })).toBe('error')
  expect(kmsAvailabilityFailure(new Error('timeout'))).toBe('error')
})
test('delayed old-scope profile listing cannot resolve candidates', async () => {
  let current = true
  let respond
  const get = () => new Promise(resolve => { respond = resolve })
  const pending = loadScopedHsmCandidates(get, '', () => current)
  current = false
  respond({ listhsmprofilesresponse: { count: 1, hsmprofile: [profile] } })
  await expect(pending).resolves.toEqual([])
})

function model (resource = key) {
  const c = {
    currentAction: { api: 'rotateKMSKey', kmsTarget: resource },
    $route: { fullPath: '/kmskey/' + id },
    $store: { getters: { apis, userInfo: { id: 'user', roletype: 'Admin', ...owner }, project: {} }, state: { user: { token: 'session' } } },
    $emit: jest.fn()
  }
  Object.assign(c, Dialog.data.call(c))
  for (const [name, fn] of Object.entries(Dialog.methods)) c[name] = fn.bind(c)
  for (const [name, fn] of Object.entries(Dialog.computed)) Object.defineProperty(c, name, { get: () => fn.call(c) })
  c.initialScope = c.scope
  c.candidateState = 'ready'
  c.options.profiles = [profile]
  return c
}
beforeEach(() => jest.clearAllMocks())
test.each(['keyDisabled', 'profileDisabled', 'profileMissing'])('latest %s blocks rotation before POST', async reason => {
  const c = model()
  getAPI.mockImplementation(async api => {
    if (api === 'listKMSKeys') return { listkmskeysresponse: { count: 1, kmskey: [{ ...key, enabled: reason !== 'keyDisabled' }] } }
    return { listhsmprofilesresponse: reason === 'profileMissing' ? {} : { count: 1, hsmprofile: [{ ...profile, enabled: false }] } }
  })
  await c.submit()
  expect(c.availabilityError).toBe(reason)
  expect(postAPI).not.toHaveBeenCalled()
})
test('keep uses the current profile, alternate rotation only validates the explicit alternate', async () => {
  const alternate = { ...profile, id: nextProfileId }
  const c = model()
  c.options.profiles = [{ ...profile, enabled: false }, alternate]
  expect(c.blockingAvailability).toBe('profileDisabled')
  c.form.hsmprofileid = nextProfileId
  expect(c.blockingAvailability).toBe('')
  getAPI.mockImplementation(async api => api === 'listKMSKeys'
    ? { listkmskeysresponse: { count: 1, kmskey: [key] } }
    : { listhsmprofilesresponse: { count: 1, hsmprofile: [alternate] } })
  postAPI.mockRejectedValue({ response: { status: 431 } })
  await c.submit()
  expect(postAPI).toHaveBeenCalledTimes(1)
  expect(postAPI).toHaveBeenCalledWith('rotateKMSKey', expect.objectContaining({ id, hsmprofileid: nextProfileId }), expect.any(Object))
  expect(getAPI).toHaveBeenCalledWith('listHSMProfiles', expect.objectContaining({ id: nextProfileId }), expect.any(Object))
  expect(c.form.hsmprofileid).toBe(nextProfileId)
})
test('switching project during revalidation invalidates selection and suppresses POST', async () => {
  const c = model()
  let resolveRead
  getAPI.mockImplementation(() => new Promise(resolve => { resolveRead = resolve }))
  c.form.hsmprofileid = profileId
  const running = c.submit()
  c.$store.getters.project = { id: 'other', domainid: 'other' }
  Dialog.watch.scope.handler.call(c)
  resolveRead({ listkmskeysresponse: { count: 1, kmskey: [key] } })
  await running
  expect(c.form.hsmprofileid).toBeUndefined()
  expect(c.blockingAvailability).toBe('stale')
  expect(postAPI).not.toHaveBeenCalled()
})
