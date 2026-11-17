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
import { h, reactive } from 'vue'
import Dialog from '@/views/image/UpdateKubernetesSupportedVersion'
import { getAPI, postAPI } from '@/api'
jest.mock('@/api', () => ({ getAPI: jest.fn(), postAPI: jest.fn() }))
const id = '11111111-1111-4111-8111-111111111111'
const iso = '22222222-2222-4222-8222-222222222222'
const jobid = '33333333-3333-4333-8333-333333333333'
const version = { id, isoid: iso, name: 'QA', semanticversion: '1.36.5', state: 'Enabled', referenceschecked: true, isreferenced: false }
const list = row => ({ listkubernetessupportedversionsresponse: { count: row ? 1 : 0, ...(row ? { kubernetessupportedversion: [row] } : {}) } })
let sequence = 0
function setup (deletion = false) {
  const store = reactive({ getters: { userInfo: { id: 'actor', roletype: 'Admin' }, apis: { listKubernetesSupportedVersions: { params: [{ name: 'showreferences' }] }, updateKubernetesSupportedVersion: { params: [{ name: 'expectedstate' }] }, deleteKubernetesSupportedVersion: {}, queryAsyncJobResult: {} } }, state: { user: { token: 'session-' + ++sequence } } })
  const slot = { render () { return h('div', [this.$slots.default?.(), this.$slots.footer?.()]) } }
  const w = mount(Dialog, { props: { resource: version, currentAction: { api: deletion ? 'deleteKubernetesSupportedVersion' : 'updateKubernetesSupportedVersion' } }, global: { mocks: { $store: store, $t: k => k, $message: { success: jest.fn() } }, directives: { 'ctrl-enter': {} }, stubs: { MoldDialog: slot, 'a-spin': slot, 'a-form': slot, 'a-form-item': slot, 'a-select': slot, 'a-select-option': slot, 'a-alert': { props: ['message'], render () { return h('p', this.message) } }, 'a-button': { props: ['disabled'], emits: ['click'], render () { return h('button', { disabled: this.disabled, onClick: e => this.$emit('click', e) }, this.$slots.default?.()) } } } } })
  return { w, store }
}
beforeEach(() => { getAPI.mockReset(); postAPI.mockReset() })
test('a changed preflight state resets selection without sending a write', async () => {
  getAPI.mockResolvedValueOnce(list(version)).mockResolvedValueOnce(list({ ...version, state: 'Disabled' }))
  const { w } = setup(); await flushPromises(); w.vm.nextState = 'Disabled'
  await w.vm.submit(); expect(postAPI).not.toHaveBeenCalled()
  expect(w.vm.snapshot.state).toBe('Disabled'); expect(w.vm.errorKey).toContain('changed'); w.unmount()
})
test('double submit sends one state command with expected state then rereads', async () => {
  let finish
  getAPI.mockResolvedValueOnce(list(version)).mockResolvedValueOnce(list(version)).mockResolvedValueOnce(list({ ...version, state: 'Disabled' }))
  postAPI.mockImplementation(() => new Promise(resolve => { finish = resolve }))
  const { w } = setup(); await flushPromises(); w.vm.nextState = 'Disabled'
  const task = w.vm.submit(); await flushPromises(); await w.vm.submit()
  expect(postAPI).toHaveBeenCalledTimes(1)
  expect(postAPI.mock.calls[0][1]).toEqual({ id, state: 'Disabled', expectedstate: 'Enabled' })
  finish({ updatekubernetessupportedversionresponse: { kubernetessupportedversion: { ...version, state: 'Disabled' } } })
  await task; expect(w.emitted('close-action')).toHaveLength(1); w.unmount()
})
test('a lost response blocks resubmit and resolves only after observing desired state', async () => {
  getAPI.mockResolvedValue(list(version)); postAPI.mockRejectedValue(new Error('Network error'))
  const { w } = setup(); await flushPromises(); w.vm.nextState = 'Disabled'; await w.vm.submit()
  expect(w.vm.receipt.status).toBe('uncertain'); expect(w.vm.canSubmit).toBe(false)
  await w.vm.refresh(); expect(w.vm.canSubmit).toBe(false); expect(w.emitted('close-action')).toBeUndefined()
  getAPI.mockResolvedValue(list({ ...version, state: 'Disabled' })); await w.vm.refresh()
  expect(w.emitted('close-action')).toHaveLength(1); expect(postAPI).toHaveBeenCalledTimes(1); w.unmount()
})
test('reference read failure never enables delete or sends a command', async () => {
  getAPI.mockResolvedValue(list({ ...version, referenceschecked: undefined }))
  const { w } = setup(true); await flushPromises(); expect(w.vm.canSubmit).toBe(false)
  await w.vm.submit(); expect(postAPI).not.toHaveBeenCalled(); expect(w.vm.errorKey).toContain('references.unknown'); w.unmount()
})
test('failed child ISO job rereads preserved version and permits an informed retry', async () => {
  getAPI.mockImplementation(api => Promise.resolve(api === 'queryAsyncJobResult' ? { queryasyncjobresultresponse: { jobid, jobstatus: 2, jobresult: { errortext: 'ISO failure' } } } : list(version)))
  postAPI.mockResolvedValue({ deletekubernetessupportedversionresponse: { jobid } })
  const { w } = setup(true); await flushPromises(); await w.vm.submit()
  expect(w.vm.snapshot.id).toBe(id); expect(w.vm.receipt).toBeNull(); expect(w.vm.canSubmit).toBe(true)
  expect(w.vm.errorKey).toContain('delete.failed'); expect(w.emitted('close-action')).toBeUndefined(); w.unmount()
})
test('successful async receipt still requires an authoritative missing-parent read', async () => {
  getAPI.mockResolvedValueOnce(list(version)).mockResolvedValueOnce(list(version)).mockResolvedValueOnce({ queryasyncjobresultresponse: { jobid, jobstatus: 1, jobresult: { success: true } } }).mockResolvedValueOnce(list(null))
  postAPI.mockResolvedValue({ deletekubernetessupportedversionresponse: { jobid } })
  const { w } = setup(true); await flushPromises(); await w.vm.submit()
  expect(w.emitted('close-action')[0][0]).toEqual({ removed: [id] }); w.unmount()
})
test('late preflight after role revocation cannot submit or restore old data', async () => {
  let complete
  getAPI.mockResolvedValueOnce(list(version)).mockImplementationOnce(() => new Promise(resolve => { complete = resolve }))
  const { w, store } = setup(); await flushPromises(); w.vm.nextState = 'Disabled'
  const task = w.vm.submit(); await flushPromises()
  store.getters.userInfo.roletype = 'User'; await flushPromises()
  complete(list(version)); await task; expect(postAPI).not.toHaveBeenCalled()
  expect(w.vm.snapshot).toBeNull(); expect(w.vm.blocksNavigation).toBe(false); w.unmount()
})
