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

import { flushPromises } from '@vue/test-utils'
import Edit from '@/views/network/EditPublicIpDisplay'
import { getAPI, postAPI } from '@/api'
import { displayEditable, displayWriteSupported, displayFingerprint, displayReceipt, clearDisplayReceiptMemory, readPublicIpDetail, validDisplayJob } from '@/utils/publicIpDisplay'
jest.mock('@/api', () => ({ getAPI: jest.fn(), postAPI: jest.fn() }))
const id = '11111111-1111-4111-8111-111111111111'
let row, desired, storage, values, jobs
const deferred = () => { let complete; const promise = new Promise(resolve => { complete = resolve }); return { promise, resolve: complete } }
function getters () { return { userInfo: { id: 'admin', account: 'admin', domainid: 'root', roleid: 'root-role', roletype: 'Admin' }, project: {}, apis: { listPublicIpAddresses: { params: [{ name: 'fordisplay' }] }, reserveIpAddress: { params: [{ name: 'fordisplay' }] }, updateIpAddress: { params: [{ name: 'id' }, { name: 'fordisplay' }] }, queryAsyncJobResult: {} } } }
function context () {
  const c = { ...Edit.data(), resource: { ...row }, $store: { getters: getters(), state: { user: { token: 'private-session' } } }, open: true, action: { currentAction: { displayCurrent: () => c.open } }, $t: k => k, $emit: jest.fn(), $notification: { success: jest.fn() } }
  Object.entries(Edit.methods).forEach(([k, v]) => { c[k] = v.bind(c) }); Object.entries(Edit.computed).forEach(([k, v]) => Object.defineProperty(c, k, { get: () => v.call(c) }))
  c.storage = () => storage
  return c
}
beforeEach(() => {
  jest.useRealTimers(); clearDisplayReceiptMemory(); getAPI.mockReset(); postAPI.mockReset()
  row = { id, ipaddress: '192.0.2.1', state: 'Reserved', account: 'owner', domainid: 'domain', issystem: false, issourcenat: false, isstaticnat: false, hasrules: false, fordisplay: true }
  desired = true; jobs = 0; values = new Map(); storage = { getItem: k => values.get(k) || null, setItem: (k, v) => values.set(k, v), removeItem: k => values.delete(k) }
  getAPI.mockImplementation(async (api, params) => {
    if (api === 'listPublicIpAddresses') return { listpublicipaddressesresponse: { count: row.fordisplay === (params.fordisplay ?? true) ? 1 : 0, publicipaddress: row.fordisplay === (params.fordisplay ?? true) ? [{ ...row }] : [] } }
    row.fordisplay = desired
    return { queryasyncjobresultresponse: { jobid: params.jobid, cmd: 'org.apache.cloudstack.api.command.user.address.UpdateIPAddrCmd', jobinstanceid: id, jobstatus: 1, jobresult: { ipaddress: { id, fordisplay: desired } } } }
  })
  postAPI.mockImplementation(async (api, params) => { desired = params.fordisplay; return { updateipaddressresponse: { jobid: 'job-' + ++jobs } } })
})
afterEach(() => jest.useRealTimers())

test.each(['User', 'DomainAdmin', 'ResourceAdmin'])('%s never gets administrator settings from API presence alone', role => { const g = getters(); g.userInfo.roletype = role; expect(displayWriteSupported(g)).toBe(false); expect(displayEditable(row, g)).toBe(false) })
test.each(['Free', 'Allocating', 'Releasing', undefined])('state %s is read-only', state => expect(displayEditable({ ...row, state }, getters())).toBe(false))
test.each([undefined, null, 'false', 'true', 0, 1])('an unconfirmed value %p cannot be overwritten', fordisplay => expect(displayEditable({ ...row, fordisplay }, getters())).toBe(false))
test.each([true, undefined])('system/unknown-system %p is read-only', issystem => expect(displayEditable({ ...row, issystem }, getters())).toBe(false))
test.each(['listPublicIpAddresses', 'updateIpAddress'])('missing %s display argument disables writes', api => { const g = getters(); g.apis[api].params = []; expect(displayWriteSupported(g)).toBe(false) })
test('no query permission disables async writes', () => { const g = getters(); delete g.apis.queryAsyncJobResult; expect(displayWriteSupported(g)).toBe(false) })
test('unchanged edits send zero posts', async () => { const c = context(); await c.initialize(); await c.submitData(); expect(postAPI).not.toHaveBeenCalled() })
test.each(['Reserved', 'Allocated'])('a %s edit sends only the flag/ID, confirms job1 and refreshes the exact hidden address', async state => {
  row.state = state; const c = context(); await c.initialize(); c.form.fordisplay = false; await c.submitData()
  expect(postAPI.mock.calls[0].slice(0, 2)).toEqual(['updateIpAddress', { id, fordisplay: false, ignoreproject: true }]); expect(c.operation.status).toBe('verified'); expect(c.row.fordisplay).toBe(false)
  expect(c.$notification.success).toHaveBeenCalledTimes(1); expect(c.$emit.mock.calls).toEqual([['refresh-data'], ['close-action']]); expect(getAPI.mock.calls.some(([api, params]) => api === 'listPublicIpAddresses' && params.fordisplay === false)).toBe(true)
  expect([...values.values()].join('')).not.toContain('private-session')
})
test('false is a known current value and can be changed to true', async () => { row.fordisplay = false; const c = context(); await c.initialize(); expect(c.row.fordisplay).toBe(false); c.form.fordisplay = true; await c.submitData(); expect(c.row.fordisplay).toBe(true); expect(postAPI).toHaveBeenCalledTimes(1) })
test.each(['account', 'associatednetworkid', 'state', 'fordisplay'])('preflight rejects a changed %s without a post', async field => {
  const c = context(); await c.initialize(); c.form.fordisplay = false; row[field] = field === 'fordisplay' ? false : 'different'; await c.submitData(); expect(postAPI).not.toHaveBeenCalled(); expect(c.error).toBe('message.public.ip.display.changed'); expect(c.form.fordisplay).toBe(false)
})
test('submission is locked before the first preflight await', async () => { const c = context(); await c.initialize(); c.form.fordisplay = false; const wait = deferred(); getAPI.mockImplementationOnce(() => wait.promise); const pending = c.submitData(); await c.submitData(); expect(postAPI).not.toHaveBeenCalled(); wait.resolve({ listpublicipaddressesresponse: { count: 1, publicipaddress: [{ ...row }] } }); await pending; expect(postAPI).toHaveBeenCalledTimes(1) })
test('job2 retains the choice and authoritative failure, then reads current data', async () => {
  const c = context(); await c.initialize(); c.form.fordisplay = false
  getAPI.mockImplementation(async (api, params) => api === 'queryAsyncJobResult' ? { queryasyncjobresultresponse: { jobid: params.jobid, jobstatus: 2, jobresult: { errortext: 'synthetic failure' } } } : { listpublicipaddressesresponse: { count: 1, publicipaddress: [{ ...row }] } })
  await c.submitData(); expect(c.operation.status).toBe('failed'); expect(c.operation.error).toBe('synthetic failure'); expect(c.form.fordisplay).toBe(false); expect(c.$notification.success).not.toHaveBeenCalled(); expect(c.canSubmit).toBe(true)
})
test('a job2 read failure never becomes an unknown job outcome', async () => {
  const c = context(); await c.initialize(); c.form.fordisplay = false; let polled = false
  getAPI.mockImplementation(async (api, params) => { if (api === 'queryAsyncJobResult') { polled = true; return { queryasyncjobresultresponse: { jobid: params.jobid, jobstatus: 2, jobresult: { errortext: 'job failed' } } } } if (polled) throw new Error('read failed'); return { listpublicipaddressesresponse: { count: 1, publicipaddress: [{ ...row }] } } })
  await c.submitData(); expect(c.operation.status).toBe('failed'); expect(c.operation.error).toBe('job failed'); expect(c.error).toBe('message.public.ip.display.read')
})
test.each(['transport', 'missing receipt'])('%s remains locked across dialog reopen and reload without a duplicate post', async kind => {
  const c = context(); await c.initialize(); c.form.fordisplay = false
  if (kind === 'transport') postAPI.mockRejectedValueOnce({ response: { status: 503, data: { errorresponse: { errorcode: 530, errortext: 'uncertain' } } } }); else postAPI.mockResolvedValueOnce({ updateipaddressresponse: {} })
  await c.submitData(); expect(c.operation.status).toBe('unknown'); c.closeAction(); clearDisplayReceiptMemory(); const next = context(); await next.initialize(); expect(next.locked).toBe(true); await next.submitData(); await next.recheck(); expect(next.operation.status).toBe('unknown'); expect(postAPI).toHaveBeenCalledTimes(1)
})
test('a definite rejection retains the form and permits an explicit retry', async () => { const c = context(); await c.initialize(); c.form.fordisplay = false; postAPI.mockRejectedValueOnce({ response: { status: 403, data: { errorresponse: { errorcode: 431, errortext: 'denied' } } } }); await c.submitData(); expect(c.operation.status).toBe('failed'); expect(c.form.fordisplay).toBe(false); expect(c.canSubmit).toBe(true) })
test('storage failure blocks submission before any mutation', async () => { const c = context(); await c.initialize(); c.form.fordisplay = false; storage.setItem = () => { throw new Error('storage') }; await c.submitData(); expect(postAPI).not.toHaveBeenCalled(); expect(c.locked).toBe(true) })
test.each(['ip', 'project', 'role', 'session'])('an old preflight cannot submit after %s changes', async kind => {
  const c = context(); await c.initialize(); c.form.fordisplay = false; const wait = deferred(); getAPI.mockImplementationOnce(() => wait.promise); const pending = c.submitData()
  if (kind === 'ip') c.resource.id = 'new-ip'; if (kind === 'project') c.$store.getters.project = { id: 'new-project' }; if (kind === 'role') c.$store.getters.userInfo.roletype = 'User'; if (kind === 'session') c.$store.state.user.token = 'new-session'
  wait.resolve({ listpublicipaddressesresponse: { count: 1, publicipaddress: [{ ...row }] } }); await pending; expect(postAPI).not.toHaveBeenCalled(); expect(c.$notification.success).not.toHaveBeenCalled()
})
test('a completed write is not replayed when verification fails and the dialog is reopened', async () => {
  const c = context(); await c.initialize(); c.form.fordisplay = false; let poll = false
  const normal = getAPI.getMockImplementation(); getAPI.mockImplementation(async (api, params, options) => { if (poll && api === 'listPublicIpAddresses') throw new Error('unavailable'); if (api === 'queryAsyncJobResult') poll = true; return normal(api, params, options) })
  await c.submitData(); expect(c.operation.status).toBe('unknown'); const jobId = c.operation.jobId; c.closeAction(); getAPI.mockImplementation(normal); clearDisplayReceiptMemory(); const next = context(); await next.initialize(); expect(next.operation.jobId).toBe(jobId); expect(next.operation.status).toBe('verified'); expect(postAPI).toHaveBeenCalledTimes(1)
})
test('pending job0 reaches an uncertain deadline, and resume checks only the same job', async () => {
  jest.useFakeTimers(); const c = context(); await c.initialize(); c.form.fordisplay = false; const normal = getAPI.getMockImplementation()
  getAPI.mockImplementation(async (api, params, options) => api === 'queryAsyncJobResult' ? { queryasyncjobresultresponse: { jobid: params.jobid, jobstatus: 0 } } : normal(api, params, options))
  const pending = c.submitData(); await flushPromises(); for (let i = 0; i < 60; i++) { jest.advanceTimersByTime(1000); await flushPromises() } await pending
  expect(c.operation.status).toBe('unknown'); expect(c.operation.jobId).toBe('job-1'); await c.submitData(); expect(postAPI).toHaveBeenCalledTimes(1)
  getAPI.mockImplementation(normal); await c.recheck(); expect(c.operation.status).toBe('verified'); expect(postAPI).toHaveBeenCalledTimes(1)
})
test('leaving during polling stores the old context and never applies its late receipt to another IP', async () => {
  const c = context(); await c.initialize(); c.form.fordisplay = false; const wait = deferred(); const normal = getAPI.getMockImplementation(); getAPI.mockImplementation((api, params, options) => api === 'queryAsyncJobResult' ? wait.promise : normal(api, params, options)); const pending = c.submitData(); await flushPromises(); const oldScope = c.scope; c.resource.id = 'another'; c.invalidate()
  expect(displayReceipt(oldScope, id, storage).status).toBe('unknown'); wait.resolve({ queryasyncjobresultresponse: { jobid: 'job-1', jobstatus: 1, jobresult: { ipaddress: { id } } } }); await pending; expect(c.$notification.success).not.toHaveBeenCalled(); expect(c.$emit).not.toHaveBeenCalled(); expect(displayReceipt(c.scope, 'another', storage).status).toBe('idle')
})
test.each([{ jobid: 'other', jobstatus: 1 }, { jobid: 'job', jobstatus: 3 }, { jobid: 'job', jobstatus: 0, jobinstanceid: 'other' }, { jobid: 'job', jobstatus: 0, cmd: 'DestroyVirtualMachineCmd' }, { jobid: 'job', jobstatus: 1, jobresult: { ipaddress: { id: 'other' } } }])('a mismatched job is never success: %p', job => expect(validDisplayJob(job, { id, jobId: 'job' })).toBe(false))
test('restricted or unsupported readers never issue a privileged hidden-address read', async () => { const g = getters(); g.userInfo.roletype = 'User'; const get = jest.fn().mockResolvedValue({ listpublicipaddressesresponse: { count: 0 } }); await readPublicIpDetail(get, { id }, g); expect(get).toHaveBeenCalledTimes(1); g.userInfo.roletype = 'Admin'; g.apis.listPublicIpAddresses.params = []; await readPublicIpDetail(get, { id }, g); expect(get).toHaveBeenCalledTimes(2) })
test('late visible-to-hidden fallback is stopped when the scope changes', async () => { const get = jest.fn().mockResolvedValue({ listpublicipaddressesresponse: { count: 0 } }); await expect(readPublicIpDetail(get, { id }, getters(), () => false)).rejects.toThrow('scope'); expect(get).toHaveBeenCalledTimes(1) })
test('display changes preserve the owner, UUID, NAT and network fingerprint', () => expect(displayFingerprint({ ...row, fordisplay: false })).toBe(displayFingerprint(row)))
