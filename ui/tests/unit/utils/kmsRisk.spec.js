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

import Dialog from '@/views/infra/KmsOperationDialog'
import { getAPI, postAPI } from '@/api'
import { kmsDeleteBlock, kmsReferenceName, kmsRiskTargetChanged } from '@/utils/kmsRisk'
import { migrationPreflight } from '@/utils/kmsVolumeMigration'

jest.mock('@/api', () => ({ getAPI: jest.fn(), postAPI: jest.fn() }))

const id = '11111111-1111-4111-8111-111111111111'
const hsm = '22222222-2222-4222-8222-222222222222'
const owner = { projectid: '33333333-3333-4333-8333-333333333333', domainid: 'domain', zoneid: 'zone' }
const key = { id, ...owner, enabled: true, name: 'same', hsmprofileid: hsm, version: 1, keybits: 256, usage: { volumecount: 0, wrappedkeycount: 0 } }
const profile = { id: hsm, ...owner, enabled: true, name: 'same', protocol: 'database', deleteprotected: false, usage: { kmskeycount: 0, versionwrappedkeycount: 0 } }
const keyReply = row => ({ listkmskeysresponse: row ? { count: 1, kmskey: [row] } : {} })
const profileReply = row => ({ listhsmprofilesresponse: row ? { count: 1, hsmprofile: [row] } : {} })

function model (target = key, api = 'deleteKMSKey') {
  const apis = { [api]: {}, listKMSKeys: {}, listHSMProfiles: {}, queryAsyncJobResult: {} }
  const vm = {
    currentAction: { api, kmsTarget: target, kmsNavigationScope: 'scope' },
    $route: { fullPath: '/kmskey/' + target.id },
    $store: { getters: { apis, userInfo: { id: 'caller', roletype: 'Admin' }, project: { id: owner.projectid } }, state: { user: { token: 'session' } } },
    $emit: jest.fn()
  }
  Object.assign(vm, Dialog.data.call(vm))
  for (const [name, method] of Object.entries(Dialog.methods)) vm[name] = method.bind(vm)
  for (const [name, computed] of Object.entries(Dialog.computed)) Object.defineProperty(vm, name, { get: () => computed.call(vm) })
  vm.initialScope = vm.scope
  return vm
}

beforeEach(() => {
  getAPI.mockReset()
  postAPI.mockReset()
})

test('counts distinguish live volumes, wrapped keys and unknown usage', () => {
  expect(kmsDeleteBlock('kmskey', key)).toBe('')
  expect(kmsDeleteBlock('kmskey', { usage: { volumecount: 2, wrappedkeycount: 2 } })).toBe('usedVolumes')
  expect(kmsDeleteBlock('kmskey', { usage: { volumecount: 0, wrappedkeycount: 2 } })).toBe('wrappedKeys')
  expect(kmsDeleteBlock('kmskey', { usage: { volumecount: 0 } })).toBe('usageUnavailable')
  expect(kmsDeleteBlock('hsmprofile', { usage: { kmskeycount: 0, versionwrappedkeycount: 2 } })).toBe('versionWrappedKeys')
  expect(kmsDeleteBlock('hsmprofile', { usage: { kmskeycount: 1, versionwrappedkeycount: 0 } })).toBe('usedKeys')
  expect(kmsDeleteBlock('hsmprofile', { usage: { kmskeycount: 0, versionwrappedkeycount: -1 } })).toBe('usageUnavailable')
})

test('collection data cannot substitute for a fresh usage read on open', async () => {
  const vm = model()
  expect(vm.blockingAvailability).toBe('loading')
  getAPI.mockResolvedValue(keyReply({ ...key, usage: undefined }))
  await vm.load()
  expect(vm.blockingAvailability).toBe('usageUnavailable')
  await vm.submit()
  expect(postAPI).not.toHaveBeenCalled()
  expect(getAPI).toHaveBeenCalledWith('listKMSKeys', expect.objectContaining({ id, projectid: owner.projectid }), expect.any(Object))
})

test.each([
  [key, 'deleteKMSKey', keyReply, { volumecount: 0, wrappedkeycount: 3 }, 'wrappedKeys'],
  [profile, 'deleteHSMProfile', profileReply, { kmskeycount: 0, versionwrappedkeycount: 5 }, 'versionWrappedKeys']
])('positive refs appearing during submit preflight suppress mutation', async (target, api, reply, usage, reason) => {
  const vm = model(target, api)
  getAPI.mockResolvedValueOnce(reply(target)).mockResolvedValueOnce(reply({ ...target, usage }))
  await vm.load()
  expect(vm.blockingAvailability).toBe('')
  await vm.submit()
  expect(vm.latest.usage).toEqual(usage)
  expect(vm.blockingAvailability).toBe(reason)
  expect(vm.operation.reason).toBe('validation')
  expect(postAPI).not.toHaveBeenCalled()
})

test('system protection takes precedence over zero references', async () => {
  const vm = model(profile, 'deleteHSMProfile')
  getAPI.mockResolvedValue(profileReply({ ...profile, deleteprotected: true, deletereason: 'SYSTEM_DATABASE_PROFILE' }))
  await vm.load()
  expect(vm.blockingAvailability).toBe('systemDatabase')
  await vm.submit()
  expect(postAPI).not.toHaveBeenCalled()
})

test('confirmed owner scope is pinned and re-checked before a verified deletion', async () => {
  const vm = model(profile, 'deleteHSMProfile')
  getAPI.mockResolvedValueOnce(profileReply(profile)).mockResolvedValueOnce(profileReply(profile)).mockResolvedValueOnce(profileReply())
  postAPI.mockResolvedValue({ deletehsmprofileresponse: { success: true } })
  await vm.load()
  await vm.submit()
  expect(postAPI).toHaveBeenCalledTimes(1)
  expect(postAPI).toHaveBeenCalledWith('deleteHSMProfile', { id: hsm, projectid: owner.projectid, ignoreproject: true }, expect.any(Object))
  expect(vm.operation.phase).toBe('succeeded')
  vm.close()
  expect(vm.$emit).toHaveBeenCalledWith('close-action', { kmsRemoved: hsm, kmsNavigationScope: 'scope' })
})

test('same name for a different UUID or project cannot become the delete target', async () => {
  const vm = model()
  getAPI.mockResolvedValueOnce(keyReply(key)).mockResolvedValueOnce(keyReply({ ...key, projectid: 'another-project' }))
  await vm.load()
  await vm.submit()
  expect(postAPI).not.toHaveBeenCalled()
  expect(vm.latest).toBeNull()
  expect(vm.blockingAvailability).toBe('error')
  expect(kmsReferenceName('same', id)).toContain(id)
})

test('scope changes during the pending read invalidate the submission and hide old counts', async () => {
  const vm = model()
  getAPI.mockResolvedValueOnce(keyReply(key))
  await vm.load()
  let finish
  getAPI.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const submission = vm.submit()
  expect(vm.blocksNavigation).toBe(true)
  vm.$store.getters.project = { id: 'other' }
  Dialog.watch.scope.handler.call(vm)
  finish(keyReply(key))
  await submission
  expect(vm.blockingAvailability).toBe('stale')
  expect(vm.latest).toBeNull()
  expect(postAPI).not.toHaveBeenCalled()
})

test('permission failures can be refreshed and a server rejection re-reads references', async () => {
  const vm = model()
  getAPI.mockRejectedValueOnce({ response: { status: 403 } })
  await vm.load()
  expect(vm.blockingAvailability).toBe('forbidden')
  getAPI.mockResolvedValueOnce(keyReply(key)).mockResolvedValueOnce(keyReply(key)).mockResolvedValueOnce(keyReply({ ...key, usage: { volumecount: 1, wrappedkeycount: 0 } }))
  postAPI.mockRejectedValueOnce({ response: { status: 431 } })
  await vm.load()
  await vm.submit()
  expect(postAPI).toHaveBeenCalledTimes(1)
  expect(vm.operation.phase).toBe('failed')
  expect(vm.blockingAvailability).toBe('usedVolumes')
  expect(vm.latest.usage.volumecount).toBe(1)
})

test('rotation requires a fresh review of current version, length or HSM changes', () => {
  expect(kmsRiskTargetChanged(key, { ...key, version: 2 })).toBe(true)
  expect(kmsRiskTargetChanged(key, { ...key, hsmprofileid: id })).toBe(true)
  expect(kmsRiskTargetChanged(key, { ...key, keybits: 128 })).toBe(true)
  expect(kmsRiskTargetChanged(key, { ...key, usage: { volumecount: 1 } })).toBe(false)
})

test('migration preflight rejects a selected UUID returned with another confirmed scope', () => {
  const row = { id, kmsmigrationeligible: true, kmsmigrationreason: 'ELIGIBLE_LEGACY', ...owner }
  expect(migrationPreflight([id], [row], key)).toBe(true)
  expect(migrationPreflight([id], [{ ...row, projectid: 'another' }], key)).toBe(false)
  expect(migrationPreflight([id], [{ ...row, zoneid: 'another' }], key)).toBe(false)
})
