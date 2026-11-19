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

import Dialog from '@/components/view/AsnReleaseDialog.vue'
import { flushPromises } from '@vue/test-utils'
import { asnClearRelease } from '@/utils/asnOperations'
import { getAPI, postAPI } from '@/api'
jest.mock('@/api', () => ({ getAPI: jest.fn(), postAPI: jest.fn() }))
const id = n => String(n).padStart(8, '0') + '-1111-4111-8111-111111111111'
const row = { id: id(1), zoneid: id(2), asnumber: 4200000000, associatednetworkid: id(3), allocated: '2026-11-18T00:00:00Z', allocationstate: 'Allocated', releasable: true, releasereason: 'eligible' }
const reply = r => ({ listasnumbersresponse: { count: 1, asnumber: [r] } })
const deferred = () => { let finish; const promise = new Promise(resolve => { finish = resolve }); return { promise, resolve: finish } }
let c
beforeEach(() => {
  jest.clearAllMocks(); asnClearRelease('test')
  c = { target: Object.freeze({ ...row, asnumber: '4200000000' }), context: '/asnumbers?filter=all', operationKey: 'test', $route: { fullPath: '/asnumbers?filter=all' }, $store: { state: { user: { token: 'session' } }, getters: { userInfo: { id: 'root', roletype: 'Admin' }, apis: { listASNumbers: {}, releaseASNumber: {} } } }, $emit: jest.fn(), $t: k => k }
  Object.assign(c, Dialog.data.call(c)); Object.entries(Dialog.methods).forEach(([k, f]) => { c[k] = f.bind(c) }); Object.entries(Dialog.computed).forEach(([k, f]) => Object.defineProperty(c, k, { get: () => f.call(c) }))
  getAPI.mockResolvedValue(reply(row)); postAPI.mockResolvedValue({ releaseasnumberresponse: { success: true } })
})
afterEach(() => asnClearRelease('test'))

test('one submission uses the frozen target and confirms synchronous success by reading Free', async () => {
  await c.recheck(); expect(c.ready).toBe(true)
  const job = deferred(); postAPI.mockReturnValueOnce(job.promise); const first = c.submit(); await flushPromises(); await c.submit()
  expect(postAPI).toHaveBeenCalledTimes(1); expect(postAPI.mock.calls[0][1]).toEqual({ zoneid: row.zoneid, asnumber: '4200000000' })
  getAPI.mockResolvedValue(reply({ ...row, allocationstate: 'Free', releasable: false, releasereason: 'notallocated' })); job.resolve({ releaseasnumberresponse: { success: true } }); await first
  expect(c.$emit).toHaveBeenCalledWith('complete', { accepted: true })
})

test('offering requirement, old metadata or changed connection blocks release before POST', async () => {
  for (const r of [{ ...row, releasable: false, releasereason: 'requiredbyoffering' }, { ...row, releasable: undefined }, { ...row, associatednetworkid: id(4) }]) {
    c.ready = true; getAPI.mockResolvedValue(reply(r)); await c.submit(); expect(postAPI).not.toHaveBeenCalled()
  }
})

test('timeout remains tracked and a second submit cannot resend; recheck can reconcile Free', async () => {
  c.ready = true; postAPI.mockRejectedValueOnce(Error('timeout')); await c.submit(); expect(c.message).toBe('uncertain'); await c.submit(); expect(postAPI).toHaveBeenCalledTimes(1)
  getAPI.mockResolvedValue(reply({ ...row, allocationstate: 'Free' })); await c.recheck(); expect(c.$emit).toHaveBeenCalledWith('complete', { accepted: false })
})

test('accepted POST with failed refresh is preserved until a successful read', async () => {
  c.ready = true; getAPI.mockResolvedValueOnce(reply(row)).mockRejectedValueOnce(Error('offline')); await c.submit()
  expect(c.message).toBe('refreshfailed'); expect(c.operation.accepted).toBe(true); await c.submit(); expect(postAPI).toHaveBeenCalledTimes(1)
  getAPI.mockResolvedValue(reply({ ...row, allocationstate: 'Free' })); await c.recheck(); expect(c.$emit).toHaveBeenCalledWith('complete', { accepted: true })
})

test('permission or route changes discard late reads and never post to a new context', async () => {
  c.ready = true; const waiting = deferred(); getAPI.mockReturnValueOnce(waiting.promise); const task = c.submit(); c.$route.fullPath = '/asnumbers?filter=free'; waiting.resolve(reply(row)); await task; expect(postAPI).not.toHaveBeenCalled(); expect(c.$emit).not.toHaveBeenCalled()
  c.$route.fullPath = c.context; c.$store.getters.apis = {}; c.ready = true; await c.submit(); expect(postAPI).not.toHaveBeenCalled()
})

test('busy cancellation and stale post completion cannot emit success into another query', async () => {
  c.ready = true; const waiting = deferred(); postAPI.mockReturnValueOnce(waiting.promise); const task = c.submit(); await Promise.resolve(); await Promise.resolve(); c.cancel(); expect(c.$emit).not.toHaveBeenCalled()
  c.$route.fullPath = '/asnumbers?filter=free'; waiting.resolve({ releaseasnumberresponse: { success: true } }); await task; expect(c.$emit).not.toHaveBeenCalled()
})
