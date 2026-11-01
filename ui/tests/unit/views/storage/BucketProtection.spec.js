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
import { mount, flushPromises } from '@vue/test-utils'
import { reactive } from 'vue'
import { postAPI, getAPI } from '@/api'
import Protection from '@/views/storage/BucketProtection'
import Create from '@/views/storage/CreateBucket'
import Update from '@/views/storage/UpdateBucket'
jest.mock('@/api', () => ({ postAPI: jest.fn(), getAPI: jest.fn() }))
const actual = (extra = {}) => ({ protectionverificationstate: 'Verified', effectiveencryption: false, effectiveversioning: false, effectiveobjectlocking: false, requestedencryption: false, requestedversioning: false, requestedobjectlocking: false, capabilities: { encryption: 'Unsupported', encryptionreason: 'ENCRYPTION_REQUIRES_HTTPS', versioning: 'Supported', objectlocking: 'Supported' }, ...extra })
const response = state => ({ getbucketprotectionresponse: { bucketprotection: state } })
const button = { props: ['disabled'], template: '<button :disabled="disabled"><slot /></button>' }
const globals = { mocks: { $t: key => key, $toLocaleDate: value => value }, stubs: { 'a-alert': { props: ['message'], template: '<div>{{ message }}<slot name="message"/><slot name="description"/></div>' }, 'a-button': button, 'a-table': true, MoldDialog: { props: ['visible'], template: '<div v-if="visible"><slot/><slot name="footer"/></div>' } } }
const view = (resource = { id: 'A', name: 'qa', encryption: true }) => mount(Protection, { props: { resource }, global: globals })
beforeEach(() => { jest.clearAllMocks() })
it('keeps requested true distinct from actual false when mismatched', async () => {
  postAPI.mockResolvedValue(response(actual({ protectionverificationstate: 'Mismatch', requestedencryption: true })))
  const w = view(); await flushPromises()
  expect(w.vm.rows[0].requested).toBe('label.enabled'); expect(w.vm.rows[0].actual).toBe('label.disabled')
  expect(w.text()).toContain('state.bucket.protection.mismatch'); expect(w.text()).toContain('label.bucket.protection.adopt'); w.unmount()
})
it('does not treat a failed actual lookup as disabled or offer adoption', async () => {
  postAPI.mockRejectedValue(new Error('offline')); const w = view(); await flushPromises()
  expect(w.vm.known).toBe(false); expect(w.vm.rows[0].actual).toBe('state.bucket.protection.unknown'); expect(w.text()).toContain('message.bucket.protection.read.failed'); w.unmount()
})
it('ignores an old bucket response after navigation', async () => {
  let resolveA
  postAPI.mockImplementationOnce(() => new Promise(resolve => { resolveA = resolve })).mockResolvedValueOnce(response(actual({ effectiveobjectlocking: true })))
  const w = view(); await w.setProps({ resource: { id: 'B' } }); await flushPromises()
  resolveA(response(actual())); await flushPromises(); expect(w.vm.state.effectiveobjectlocking).toBe(true); expect(w.vm.loading).toBe(false); w.unmount()
})
it('invalidates an old account or project scope', async () => {
  const account = reactive({ getters: { project: { id: 'p1' }, userInfo: { domainid: 'd1' } } }); let resolveFirst
  postAPI.mockImplementationOnce(() => new Promise(resolve => { resolveFirst = resolve })).mockResolvedValueOnce(response(actual({ effectiveversioning: true })))
  const w = mount(Protection, { props: { resource: { id: 'A' } }, global: { ...globals, mocks: { ...globals.mocks, $store: account } } })
  account.getters.project.id = 'p2'; await flushPromises(); resolveFirst(response(actual())); await flushPromises()
  expect(w.vm.state.effectiveversioning).toBe(true); w.unmount()
})
it('retries lookup after Unknown without claiming a prior successful state', async () => {
  postAPI.mockRejectedValueOnce(new Error('timeout')).mockResolvedValueOnce(response(actual()))
  const w = view(); await flushPromises(); expect(w.vm.known).toBe(false); await w.vm.fetchState(); expect(w.vm.state.protectionverificationstate).toBe('Verified'); w.unmount()
})
it('requires a visible confirmation before reconciling the same operation', async () => {
  postAPI.mockResolvedValueOnce(response(actual({ operationid: 'op', operationstate: 'NeedsReconcile' }))).mockResolvedValueOnce({}).mockResolvedValueOnce(response(actual()))
  const w = view(); await flushPromises(); await w.vm.reconcile(); expect(postAPI).toHaveBeenCalledTimes(1)
  w.vm.confirm = 'restore'; await w.vm.reconcile(); expect(postAPI).toHaveBeenNthCalledWith(2, 'reconcileBucketProtection', { id: 'A', operationid: 'op', acceptactual: false }); expect(w.emitted('reconciled')).toHaveLength(1); w.unmount()
})
it('preserves recovery controls when an explicit restoration fails', async () => {
  const pending = actual({ operationid: 'op', operationstate: 'NeedsReconcile' })
  postAPI.mockResolvedValueOnce(response(pending)).mockRejectedValueOnce(new Error('restore failed')).mockResolvedValueOnce(response(pending))
  const w = view(); await flushPromises(); w.vm.confirm = 'restore'; await w.vm.reconcile()
  expect(w.vm.pending).toBe(true); expect(w.vm.state.operationid).toBe('op'); expect(w.vm.errorText).toBe('message.bucket.protection.restore.failed'); expect(w.vm.busy).toBe(false); w.unmount()
})
it('offers unsupported encryption as disabled and requires versioning with a lock in the actual create form', async () => {
  getAPI.mockResolvedValue({ listobjectstoragepoolsresponse: { count: 1, objectstore: [{ id: 'store', capabilities: actual().capabilities }] } })
  const w = mount(Create, { props: { resource: {} }, global: { ...globals, mocks: { ...globals.mocks, $store: { getters: { apis: { listObjectStoragePools: {} } } } }, stubs: { ...globals.stubs, BucketQuotaContext: true, 'a-spin': { template: '<div><slot/></div>' }, 'a-form': { template: '<form><slot/></form>' }, 'a-form-item': { template: '<label><slot/></label>' }, 'a-input': true, 'a-select': { template: '<div><slot/></div>' }, 'a-select-option': true, 'a-switch': { props: ['disabled'], emits: ['change'], template: '<button role="switch" :disabled="disabled" />' } } } })
  await flushPromises(); const switches = w.findAll('[role="switch"]'); expect(switches[0].attributes('disabled')).toBeDefined(); expect(switches[1].attributes('disabled')).toBeUndefined()
  w.vm.form.objectlocking = true; w.vm.form.versioning = true; await w.vm.$nextTick(); expect(switches[1].attributes('disabled')).toBeDefined(); w.unmount()
})

it('blocks the actual update form from a protection operation before the parent resource refresh arrives', async () => {
  const w = mount(Update, { props: { resource: { id: 'A', quota: 1, encryption: false, versioning: false } }, global: { ...globals, mocks: { ...globals.mocks, $getApiParams: () => ({ reconcile: {} }) }, stubs: { ...globals.stubs, BucketQuotaContext: true, BucketProtection: { emits: ['state'], mounted () { this.$emit('state', { operationid: 'op', operationstate: 'NeedsReconcile', protectionverificationstate: 'Unknown' }) }, template: '<div />' }, 'a-form': { props: ['disabled'], template: '<fieldset :disabled="disabled"><slot /></fieldset>' }, 'a-form-item': { template: '<label><slot /></label>' }, 'a-input': true, 'a-select': { template: '<div><slot /></div>' }, 'a-select-option': true, 'a-switch': true } } })
  await flushPromises(); expect(w.find('fieldset').attributes('disabled')).toBeDefined(); expect(w.vm.quotaPending).toBe(false); w.unmount()
})

it('reverifies changed protection metadata for the same bucket without reloading the tab', async () => {
  postAPI.mockResolvedValueOnce(response(actual())).mockResolvedValueOnce(response(actual({ requestedversioning: true, effectiveversioning: true })))
  const w = view({ id: 'A', versioning: false }); await flushPromises()
  await w.setProps({ resource: { id: 'A', versioning: true } }); await flushPromises()
  expect(postAPI).toHaveBeenCalledTimes(2); expect(w.vm.rows[1].requested).toBe('label.enabled'); expect(w.vm.rows[1].actual).toBe('label.enabled')
  await w.setProps({ resource: { id: 'A', versioning: true, protectionverifiedat: 'later' } }); await flushPromises()
  expect(postAPI).toHaveBeenCalledTimes(2); w.unmount()
})
it('replaces a stale Verified panel when the same bucket gains a pending operation', async () => {
  let resolvePending
  postAPI.mockResolvedValueOnce(response(actual())).mockImplementationOnce(() => new Promise(resolve => { resolvePending = resolve }))
  const w = view({ id: 'A' }); await flushPromises()
  await w.setProps({ resource: { id: 'A', quotaoperationid: 'op', quotaoperationstate: 'NeedsReconcile' } })
  expect(w.vm.known).toBe(false); expect(w.vm.state.protectionverificationstate).toBe('Unknown')
  resolvePending(response(actual({ operationid: 'op', operationstate: 'NeedsReconcile' }))); await flushPromises()
  expect(w.vm.pending).toBe(true); expect(w.text()).toContain('label.bucket.protection.restore'); w.unmount()
})
it('refreshes the parent after adopting actual settings and ignores late mutation completion after unmount', async () => {
  postAPI.mockResolvedValueOnce(response(actual({ operationid: 'op', operationstate: 'NeedsReconcile' }))).mockResolvedValueOnce({}).mockResolvedValueOnce(response(actual()))
  const w = view(); await flushPromises(); w.vm.confirm = 'adopt'; await w.vm.reconcile()
  expect(w.emitted('refresh')).toHaveLength(1); w.unmount()
  let resolveMutation
  postAPI.mockResolvedValueOnce(response(actual({ operationid: 'next', operationstate: 'NeedsReconcile' }))).mockImplementationOnce(() => new Promise(resolve => { resolveMutation = resolve }))
  const gone = view(); await flushPromises(); gone.vm.confirm = 'restore'; const work = gone.vm.reconcile(); gone.unmount(); resolveMutation({}); await work
  expect(gone.emitted('reconciled')).toBeUndefined(); expect(gone.emitted('refresh')).toBeUndefined()
})
