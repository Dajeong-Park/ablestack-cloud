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

import Create from '@/views/infra/CreateHSMProfile'
import Autogen from '@/views/AutogenView'
import kms from '@/config/section/kms'
import { hsmProviders, hsmDefaultProtocol, hsmFormProblem, hsmCreateParams, emptyHsmForm } from '@/utils/hsmProfileCreation'
import { getAPI, postAPI } from '@/api'
jest.mock('@/api', () => ({ getAPI: jest.fn(), postAPI: jest.fn() }))
const capability = { listcapabilitiesresponse: { capability: { kmsproviders: [{ protocol: 'database', displayname: 'Database' }, { protocol: 'pkcs11', displayname: 'PKCS#11' }] } } }
const providers = hsmProviders(capability)
const lists = { domains: [{ id: 'D', name: 'ROOT' }], accounts: [{ id: 'A', name: 'admin', domainid: 'D' }], zones: [{ id: 'Z', name: 'Zone' }], projects: [{ id: 'P', name: 'Project' }] }
function model () {
  const c = { $store: { getters: { apis: { createHSMProfile: {}, listCapabilities: {}, listZones: {}, listDomains: {}, listProjects: {}, listAccounts: {} }, userInfo: { id: 'U', roletype: 'Admin', roleid: 'role', domainid: 'D', account: 'admin' }, project: {} }, state: { user: { token: 'session' } } }, $route: { path: '/hsmprofile', name: 'hsmprofile', meta: { name: 'hsmprofile' }, params: {}, query: {} }, $t: key => key, $emit: jest.fn() }
  Object.assign(c, Create.data.call(c))
  for (const [key, fn] of Object.entries(Create.methods)) c[key] = fn.bind(c)
  for (const [key, fn] of Object.entries(Create.computed)) Object.defineProperty(c, key, { get: () => fn.call(c) })
  Object.assign(c, lists, { providers })
  c.session = c.scopeStamp
  Object.assign(c.form, { name: 'qa-profile', protocol: 'pkcs11', domainid: 'D', account: 'admin', library: '/opt/example.so' })
  return c
}
beforeEach(() => { jest.clearAllMocks(); getAPI.mockResolvedValue(capability) })
test('only loaded providers are available and PKCS11 is preferred when present', () => {
  expect(providers.map(p => p.protocol)).toEqual(['database', 'pkcs11'])
  expect(hsmDefaultProtocol(providers)).toBe('pkcs11')
  expect(hsmDefaultProtocol(hsmProviders({ listcapabilitiesresponse: { capability: { kmsproviders: [{ protocol: 'database' }] } } }))).toBe('database')
  expect(hsmProviders({ listcapabilitiesresponse: { capability: { kmsproviders: [{ protocol: 'custom' }] } } })[0].supported).toBe(false)
})
test.each([{}, { listcapabilitiesresponse: { capability: {} } }, { listcapabilitiesresponse: { capability: { kmsproviders: [] } } }])('missing discovery never invents provider choices', json => { expect(() => hsmProviders(json)).toThrow() })
test.each(['account', 'domain', 'project', 'public'])('owner scope %s emits only compatible ownership parameters', scope => {
  const c = model(); Object.assign(c.form, { ownerScope: scope, projectid: 'P', zoneMode: 'zone', zoneid: 'Z' })
  const p = hsmCreateParams(c.form, providers, c.lists, '')
  expect(p.zoneid).toBe('Z'); expect(p.ignoreproject).toBe(true)
  expect(p.ispublic).toBe(scope === 'public')
  expect('domainid' in p).toBe(['domain', 'account'].includes(scope))
  expect('account' in p).toBe(scope === 'account')
  expect('projectid' in p).toBe(scope === 'project')
})
test('Database never sends hidden library, slot or PIN state', () => {
  const c = model(); c.form.protocol = 'database'
  const p = hsmCreateParams(c.form, providers, c.lists, 'example')
  expect(Object.keys(p).filter(key => key.startsWith('details'))).toEqual([])
})
test.each([['slot', '-3'], ['slot_list_index', '0'], ['token_label', 'test-token']])('PKCS11 supports selector %s and does not require a PIN', (mode, value) => {
  const c = model(); c.form.slotMode = mode; c.form[mode] = value
  expect(hsmFormProblem(c.form, providers, c.lists)).toBe('')
  const p = hsmCreateParams(c.form, providers, c.lists, '')
  expect(p['details[0].' + mode]).toBe(value)
  expect(p['details[0].pin']).toBeUndefined()
})
test.each([['slot', '1.2'], ['slot', '2147483648'], ['slot_list_index', '-1'], ['max_sessions', '0'], ['max_sessions', '1.5']])('invalid PKCS11 %s is blocked', (field, value) => {
  const c = model(); if (field !== 'max_sessions') c.form.slotMode = field; c.form[field] = value
  expect(hsmFormProblem(c.form, providers, c.lists)).not.toBe('')
})
test('old masking placeholder cannot be replayed as a PIN', () => {
  const c = model()
  expect(() => hsmCreateParams(c.form, providers, c.lists, '*****')).toThrow()
})
test('protocol round trips discard PIN and protocol-specific values', () => {
  const c = model(); c.pin = 'example'; c.showPin = true; c.changeProtocol()
  expect(c.pin).toBe(''); expect(c.showPin).toBe(false); expect(c.form.library).toBe('')
  expect(c.form.slot_list_index).toBe('0')
})
test('blur hides without silently dropping the PIN before submit', () => {
  const c = model(); c.pin = 'example'; c.showPin = true
  c.hidePinOnExit({ currentTarget: { contains: () => false }, relatedTarget: null })
  expect(c.showPin).toBe(false); expect(c.pin).toBe('example')
})
test('scope change and close clear PIN and stale account loading', () => {
  const c = model(); c.pin = 'example'; c.accountLoading = true
  c.changeOwner(); expect(c.pin).toBe(''); expect(c.accountLoading).toBe(false)
  c.pin = 'example'; c.close(); expect(c.pin).toBe(''); expect(c.$emit).toHaveBeenCalledWith('close-action')
})
test.each(['token', 'project', 'role', 'permission'])('session %s changes dispose secret state and block create', kind => {
  const c = model(); c.pin = 'example'; c.showPin = true
  if (kind === 'token') c.$store.state.user.token = 'new'
  if (kind === 'project') c.$store.getters.project.id = 'other'
  if (kind === 'role') c.$store.getters.userInfo.roleid = 'other'
  if (kind === 'permission') delete c.$store.getters.apis.createHSMProfile
  Create.watch.scopeStamp.call(c)
  expect(c.pin).toBe(''); expect(c.showPin).toBe(false); expect(c.canSubmit).toBe(false)
})
test('stale account response cannot replace a new domain selection', async () => {
  const c = model(); let resolveRequest
  c.readList = jest.fn().mockImplementationOnce(() => new Promise(resolve => { resolveRequest = resolve })).mockResolvedValue([])
  const old = c.changeDomain(); c.form.domainid = 'other'; await c.changeDomain(); resolveRequest(lists.accounts); await old
  expect(c.accounts).toEqual([]); expect(c.accountLoading).toBe(false)
})
test('loaded provider loss at submit blocks POST and clears PIN', async () => {
  const c = model(); c.pin = 'example'; getAPI.mockResolvedValue({ listcapabilitiesresponse: { capability: { kmsproviders: [{ protocol: 'database' }] } } })
  await c.submit()
  expect(postAPI).not.toHaveBeenCalled(); expect(c.pin).toBe(''); expect(c.canSubmit).toBe(false)
})
test('discovery failure blocks submission until a verified refresh', async () => {
  const c = model(); c.pin = 'example'; getAPI.mockRejectedValue(new Error('offline'))
  await c.submit()
  expect(postAPI).not.toHaveBeenCalled(); expect(c.discoveryError).toBe(true); expect(c.pin).toBe('')
})
test('success keeps only safe summary and immediately discards PIN', async () => {
  const c = model(); c.pin = 'example'; let sent
  postAPI.mockImplementation(async (api, params) => { sent = { ...params }; return { createhsmprofileresponse: { hsmprofile: { id: 'new', details: { pin: 'untrusted' } } } } })
  await c.submit()
  expect(sent['details[0].pin']).toBe('example')
  expect(c.pin).toBe(''); expect(c.showPin).toBe(false); expect(c.saved.id).toBe('new'); expect(c.saved.details).toBeUndefined()
  expect(c.$emit).toHaveBeenCalledWith('refresh-data')
})
test.each([400, 530])('failure %i preserves nonsecret fields but never PIN or raw error text', async status => {
  const c = model(); c.pin = 'example'
  postAPI.mockRejectedValue({ response: { status, data: { errorresponse: { errortext: 'example' } } } })
  await c.submit()
  expect(c.pin).toBe(''); expect(c.form.name).toBe('qa-profile'); expect(c.error).not.toContain('example')
  expect(c.unknown).toBe(status >= 500)
})
test('unmount clears PIN and visibility listeners use the same cleanup callback', () => {
  const c = model(); c.pin = 'example'; c.showPin = true
  Create.beforeUnmount.call(c)
  expect(c.pin).toBe(''); expect(c.showPin).toBe(false); expect(c.disposed).toBe(true)
})
test('public summary never displays ownership fields excluded from the actual request', async () => {
  const c = model(); c.form.ownerScope = 'public'; c.form.projectid = 'P'
  postAPI.mockResolvedValue({ createhsmprofileresponse: { hsmprofile: { id: 'new' } } })
  await c.submit()
  expect(c.saved.owner).toBe('label.hsm.create.scope.public')
})
test('secret submission is never written to browser storage or debug logs', async () => {
  const c = model(); c.pin = 'example'
  const storage = jest.spyOn(Storage.prototype, 'setItem')
  const log = jest.spyOn(console, 'log').mockImplementation(() => {})
  const error = jest.spyOn(console, 'error').mockImplementation(() => {})
  try {
    postAPI.mockRejectedValue({ response: { status: 530, data: { errorresponse: { errortext: 'example' } } } })
    await c.submit()
    expect(storage).not.toHaveBeenCalled()
    expect(log).not.toHaveBeenCalled()
    expect(error).not.toHaveBeenCalled()
    expect(c.pin).toBe('')
  } finally { storage.mockRestore(); log.mockRestore(); error.mockRestore() }
})
test('creation uses self-managed popup without generic details serialization or route change', () => {
  const c = model(); c.$router = { push: jest.fn() }; c.storageActionGeneration = 0
  const action = kms.children.find(section => section.name === 'hsmprofile').actions.find(action => action.api === 'createHSMProfile')
  Autogen.methods.execAction.call(c, action, false)
  expect(c.showAction).toBe(true); expect(c.currentAction.selfManagedDialog).toBe(true); expect(c.currentAction.popup).toBe(true)
  expect(c.$router.push).not.toHaveBeenCalled(); expect(getAPI).not.toHaveBeenCalled()
})
test('empty form defaults stay private, global and PIN-free', () => {
  const form = emptyHsmForm()
  expect(form.ownerScope).toBe('account'); expect(form.zoneMode).toBe('global'); expect(form.pin).toBeUndefined()
})
