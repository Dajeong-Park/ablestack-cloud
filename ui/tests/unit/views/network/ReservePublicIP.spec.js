// Licensed to the Apache Software Foundation (ASF) under one or more
// contributor license agreements. See the NOTICE file for ownership information.
// The ASF licenses this file under the Apache License, Version 2.0
// (the "License"); you may not use this file except in compliance
// with the License. You may obtain a copy of the License at
// http://www.apache.org/licenses/LICENSE-2.0
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { flushPromises } from '@vue/test-utils'
import Reserve from '@/views/network/ReservePublicIP'
import { getAPI, postAPI } from '@/api'
import { reservationScope, reservationParams, reservationMatches, forgetReservation } from '@/utils/publicIpReservation'
jest.mock('@/api', () => ({ getAPI: jest.fn(), postAPI: jest.fn() }))
const deferred = () => { let complete; const promise = new Promise(resolve => { complete = resolve }); return { promise, resolve: complete } }
let serverIp
function context () {
  const c = {
    ...Reserve.data(),
    resource: { id: 'ip', ipaddress: '192.0.2.1', state: 'Free' },
    $route: { path: '/publicip/ip' },
    $store: { getters: { userInfo: { id: 'actor', account: 'admin', domainid: 'root', roletype: 'Admin' }, project: {}, apis: { reserveIpAddress: {}, listPublicIpAddresses: {}, listDomains: {}, listAccounts: {}, listProjects: {} } }, state: { user: { token: 'test-session' } } },
    $refs: { form: { validate: jest.fn().mockResolvedValue(), clearValidate: jest.fn() } },
    action: { currentAction: { reservationCurrent: () => c.open } },
    open: true,
    $t: key => key,
    $emit: jest.fn(),
    $notification: { success: jest.fn() }
  }
  Object.entries(Reserve.methods).forEach(([name, method]) => { c[name] = method.bind(c) })
  Object.entries(Reserve.computed).forEach(([name, method]) => Object.defineProperty(c, name, { get: () => method.call(c) }))
  c.form = { ownerType: 'account', domainId: 'root', account: 'owner', projectId: null }
  c.accounts = [{ id: 'owner-id', name: 'owner', domainid: 'root' }]
  c.domains = [{ id: 'root', name: 'ROOT' }]; c.candidatesReady = true
  return c
}
beforeEach(() => {
  forgetReservation(context().contextKey); getAPI.mockReset(); postAPI.mockReset()
  serverIp = { id: 'ip', state: 'Free' }
  getAPI.mockImplementation(async api => {
    if (api === 'listPublicIpAddresses') return { listpublicipaddressesresponse: { count: 1, publicipaddress: [{ ...serverIp }] } }
    if (api === 'listDomains') return { listdomainsresponse: { count: 1, domain: [{ id: 'root', name: 'ROOT' }] } }
    if (api === 'listAccounts') return { listaccountsresponse: { count: 1, account: [{ id: 'owner-id', name: 'owner', domainid: 'root' }] } }
    return { listprojectsresponse: { count: 1, project: [{ id: 'project', name: 'Project' }] } }
  })
  postAPI.mockImplementation(async (api, params) => {
    serverIp = { id: params.id, state: 'Reserved', account: params.account, domainid: params.domainid, projectid: params.projectid }
    return { reserveipaddressresponse: { ipaddress: { ...serverIp } } }
  })
})

test('account submission uses explicit account/domain, verifies Reserved, and never polls a job', async () => {
  const c = context(); await c.submitData()
  expect(postAPI).toHaveBeenCalledWith('reserveIpAddress', { id: 'ip', account: 'owner', domainid: 'root', ignoreproject: true }, { preserveOnFailure: true })
  expect(c.$notification.success).toHaveBeenCalledTimes(1)
  expect(c.$emit.mock.calls).toEqual([['refresh-data'], ['close-action']])
  expect(getAPI.mock.calls.map(c => c[0])).toEqual(['listPublicIpAddresses', 'listPublicIpAddresses'])
  expect(getAPI.mock.calls[1][1].state).toContain('Reserved')
})

test('project submission excludes account and domain, even if the old account field remains', async () => {
  const c = context(); c.form.ownerType = 'project'; c.form.projectId = 'project'; c.projects = [{ id: 'project' }]
  await c.submitData()
  expect(postAPI.mock.calls[0][1]).toEqual({ id: 'ip', projectid: 'project', ignoreproject: true })
  expect(c.$notification.success).toHaveBeenCalledTimes(1)
})

test.each(['계정', '프로젝트', 'Account', ''])('translated/invalid internal type %s cannot fall back to the login owner', type => {
  const c = context(); c.form.ownerType = type
  expect(() => reservationParams('ip', c.form, c.user, true, c.accounts, [], '')).toThrow()
})

test('non-admin account ownership comes from the actor, never a forged selector', () => {
  const c = context()
  expect(reservationParams('ip', c.form, { account: 'self', domainid: 'own' }, false, [], [], '')).toEqual({ id: 'ip', account: 'self', domainid: 'own' })
  expect(() => reservationParams('ip', c.form, c.user, true, [{ name: 'owner', domainid: 'other' }], [], '')).toThrow()
  expect(() => reservationParams('ip', c.form, c.user, true, c.accounts, [], 'pinned')).toThrow()
})

test.each(['id', 'state', 'account', 'domainid', 'projectid'])('receipt mismatch in %s is not success', key => {
  const expected = { id: 'ip', account: 'owner', domainid: 'root' }
  const ip = { ...expected, state: 'Reserved', [key]: 'other' }
  expect(reservationMatches(ip, expected)).toBe(false)
})

test('server owner mismatch preserves the actual owner and blocks duplicate writes', async () => {
  postAPI.mockResolvedValue({ reserveipaddressresponse: { ipaddress: { id: 'ip', state: 'Reserved', account: 'admin', domainid: 'root' } } })
  const c = context(); await c.submitData(); await c.submitData()
  expect(c.operation.status).toBe('mismatch'); expect(c.operation.actual.account).toBe('admin')
  expect(postAPI).toHaveBeenCalledTimes(1); expect(c.$notification.success).not.toHaveBeenCalled(); expect(c.$emit).not.toHaveBeenCalled()
})

test('uncertain response survives reopen; reads and ending acknowledged tracking never resend', async () => {
  postAPI.mockRejectedValue(new Error('connection lost'))
  const c = context(); await c.submitData(); c.closeAction()
  const reopened = context(); await reopened.initialize(); await reopened.submitData(); await reopened.recheck()
  expect(reopened.operation.status).toBe('unknown'); expect(reopened.operation.lastRead.state).toBe('Free')
  reopened.endTracking(); expect(reopened.operation).not.toBeNull()
  reopened.acknowledged = true; reopened.endTracking(); expect(reopened.operation).toBeNull()
  expect(postAPI).toHaveBeenCalledTimes(1)
})

test('explicit Cloud rejection retains input and permits an explicit retry', async () => {
  postAPI.mockRejectedValueOnce({ response: { data: { reserveipaddressresponse: { errorcode: 431, errortext: 'Rejected' } } } })
  const c = context(); await c.submitData()
  expect(c.form.account).toBe('owner'); expect(c.error).toBe('Rejected'); expect(c.operation).toBeNull()
  await c.submitData(); expect(postAPI).toHaveBeenCalledTimes(2); expect(c.$notification.success).toHaveBeenCalledTimes(1)
})

test('a changed address or absent reserve API never submits', async () => {
  const c = context(); serverIp.state = 'Allocated'; await c.submitData(); expect(postAPI).not.toHaveBeenCalled()
  delete c.$store.getters.apis.reserveIpAddress; await c.submitData(); expect(postAPI).not.toHaveBeenCalled()
})

test('validation locks repeated submit and stale validation cannot POST', async () => {
  const c = context(); const validation = deferred(); c.$refs.form.validate.mockReturnValue(validation.promise)
  const request = c.submitData(); c.submitData(); c.$route.path = '/publicip/other'; validation.resolve(); await request
  expect(c.$refs.form.validate).toHaveBeenCalledTimes(1); expect(postAPI).not.toHaveBeenCalled()
})

test('a late accepted response cannot close or refresh a new scope', async () => {
  const c = context(); const response = deferred(); postAPI.mockReturnValue(response.promise)
  const request = c.submitData(); await flushPromises(); c.open = false
  response.resolve({ reserveipaddressresponse: { ipaddress: { id: 'ip', state: 'Reserved', account: 'owner', domainid: 'root' } } }); await request
  expect(c.$emit).not.toHaveBeenCalled(); expect(c.$notification.success).not.toHaveBeenCalled()
})

test('late project candidates cannot overwrite a newer domain lookup', async () => {
  const c = context(); const old = deferred(); c.form.ownerType = 'project'
  getAPI.mockReturnValueOnce(old.promise).mockResolvedValueOnce({ listprojectsresponse: { count: 1, project: [{ id: 'new', name: 'New' }] } })
  const first = c.loadOwners(); c.form.domainId = 'new-domain'; c.selectionChanged(); await c.loadOwners()
  old.resolve({ listprojectsresponse: { count: 1, project: [{ id: 'old' }] } }); await first
  expect(c.projects.map(p => p.id)).toEqual(['new']); expect(c.candidatesReady).toBe(true)
})

test('candidate pagination includes owners beyond the first page', async () => {
  const c = context(); const owners = Array.from({ length: 501 }, (_, i) => ({ id: 'a' + i, name: 'account' + i }))
  getAPI.mockImplementation(async (api, params) => ({ listaccountsresponse: { count: 501, account: params.page === 1 ? owners.slice(0, 500) : owners.slice(500) } }))
  await c.loadOwners(); expect(c.accounts).toHaveLength(501); expect(getAPI).toHaveBeenCalledTimes(2)
})

test('empty domains and candidate failures do not crash or become successful empty state', async () => {
  const c = context(); getAPI.mockResolvedValue({ listdomainsresponse: {} }); await c.initialize()
  expect(c.lookupError).toBeTruthy(); expect(c.canSubmit).toBe(false)
  getAPI.mockRejectedValue(new Error('offline')); await c.initialize(); expect(c.lookupError).toBeTruthy()
})

test('actor, project, permission, and token changes are distinct reservation scopes', () => {
  const c = context(); const first = reservationScope(c.resource, c.$route, c.$store)
  c.$store.getters.project = { id: 'project' }; expect(c.contextKey).not.toBe(first)
  c.$store.getters.project = {}; c.$store.state.user.token = 'new-session'; expect(c.contextKey).not.toBe(first)
})
