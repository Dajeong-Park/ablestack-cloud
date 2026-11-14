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
import { Button } from 'ant-design-vue'
import Register from '@/views/image/RegisterOrUploadIso'
import { getAPI, postAPI } from '@/api'
import { axios } from '@/utils/request'
import { probeSsvmCert } from '@/utils/ssvmProbe'
jest.mock('@/api', () => ({ getAPI: jest.fn(), postAPI: jest.fn() }))
jest.mock('@/utils/request', () => ({ axios: { post: jest.fn() } }))
jest.mock('@/utils/ssvmProbe', () => ({ probeSsvmCert: jest.fn() }))
const id = '11111111-1111-4111-8111-111111111111'; const zone = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'; const ud = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const row = extra => ({ id, zoneid: zone, isready: true, ...extra })
const ticket = extra => ({ postuploadisoresponse: { getuploadparams: { id, postURL: 'https://upload.invalid/upload/fixture', metadata: 'test-metadata', signature: 'test-only-signature', expires: '2099-01-01T00:00:00Z', ...extra } } })
let linked
function context (mode = 'Upload', extra = {}) {
  const apis = Object.fromEntries(['getUploadParamsForIso', 'registerIso', 'listIsos', 'listUserData', 'linkUserDataToTemplate'].map(name => [name, { params: ['format', 'name', 'zoneid', 'bootable', 'arch', 'checksum', 'isextractable', 'ispublic', 'isfeatured', 'ostypeid', 'url'].map(name => ({ name })) }]))
  const c = {
    ...Register.data.call({ action: { currentAction: { icon: 'cloud-upload-outlined' } } }),
    currentForm: mode,
    $store: { getters: { userInfo: { id: 'actor', roletype: 'Admin', account: 'admin', domainid: zone }, apis, project: {}, features: {} }, state: { user: { token: 'runtime-only-test-session' } } },
    form: { name: 'disposable-iso', zoneid: zone, bootable: false, arch: 'x86_64', url: 'https://images.invalid/test.iso' },
    formRef: { value: { validate: jest.fn().mockResolvedValue({}), scrollToField: jest.fn() } },
    fileList: [new File(['fixture'], 'fixture.iso')],
    $t: key => key,
    $emit: jest.fn(),
    $notification: { success: jest.fn() },
    $router: { push: jest.fn() },
    ...extra
  }
  Object.entries(Register.methods).forEach(([key, fn]) => { c[key] = fn.bind(c) })
  Object.entries(Register.computed).forEach(([key, fn]) => Object.defineProperty(c, key, { get: () => fn.call(c), configurable: true }))
  c.wait = jest.fn().mockResolvedValue(); return c
}
beforeEach(() => {
  jest.clearAllMocks(); linked = false; probeSsvmCert.mockResolvedValue(true); axios.post.mockResolvedValue({})
  getAPI.mockImplementation(async command => command === 'getUploadParamsForIso' ? ticket() : command === 'listUserData' ? { listuserdataresponse: { userdata: [] } } : { listisosresponse: { iso: [row(linked ? { userdataid: ud, userdatapolicy: 'APPEND' } : {})], count: 1 } })
  postAPI.mockImplementation(async command => { if (command === 'linkUserDataToTemplate') { linked = true; return {} } return { registerisoresponse: { iso: [row()] } } })
})
test('local transfer finishes server readiness before linking selected userdata and policy', async () => {
  const c = context('Upload', { userdataid: ud, userdatapolicy: 'append' }); await c.handleSubmit()
  expect(c.phase).toBe('done'); expect(c.acceptedId).toBe(id)
  expect(postAPI).toHaveBeenCalledWith('linkUserDataToTemplate', { userdataid: ud, templateid: id, userdatapolicy: 'append' }, { preserveOnFailure: true })
  expect(getAPI.mock.calls.filter(([command]) => command === 'getUploadParamsForIso')).toHaveLength(1)
  expect(c.uploadParams).toBeNull()
})
test('userdata partial failure retries only the existing ISO linkage', async () => {
  const c = context('Upload', { userdataid: ud, userdatapolicy: 'append' }); postAPI.mockRejectedValueOnce(new Error('userdata removed'))
  await c.handleSubmit(); expect(c.phase).toBe('linkFailed'); expect(c.acceptedId).toBe(id)
  await c.handleSubmit(); await c.retryUserdataLink(); expect(c.phase).toBe('done')
  expect(getAPI.mock.calls.filter(([command]) => command === 'getUploadParamsForIso')).toHaveLength(1); expect(axios.post).toHaveBeenCalledTimes(1)
})
test('a double submit during asynchronous validation allocates only once', async () => {
  let finish
  const c = context('Create'); c.formRef.value.validate.mockReturnValue(new Promise(resolve => { finish = resolve }))
  const first = c.handleSubmit(); const second = c.handleSubmit(); finish(); await Promise.all([first, second])
  expect(postAPI.mock.calls.filter(([command]) => command === 'registerIso')).toHaveLength(1); expect(c.phase).toBe('done')
})
test('preflight retry uses the same ticket and does not allocate another ISO', async () => {
  const c = context(); probeSsvmCert.mockResolvedValueOnce(false); await c.handleSubmit(); expect(c.phase).toBe('preflight'); expect(axios.post).not.toHaveBeenCalled()
  await c.retryUpload(); expect(c.phase).toBe('done'); expect(axios.post).toHaveBeenCalledTimes(1)
  expect(getAPI.mock.calls.filter(([command]) => command === 'getUploadParamsForIso')).toHaveLength(1)
})
test('expired pre-transfer signature never reaches the uploader or creates a second ISO', async () => {
  const c = context(); getAPI.mockResolvedValueOnce(ticket({ expires: '2000-01-01T00:00:00Z' })); await c.handleSubmit()
  expect(c.phase).toBe('expired'); expect(c.acceptedId).toBe(id); expect(axios.post).not.toHaveBeenCalled(); await c.handleSubmit()
  expect(getAPI.mock.calls.filter(([command]) => command === 'getUploadParamsForIso')).toHaveLength(1)
})
test('once transfer is attempted, a failed request cannot reuse the one-time URL', async () => {
  const c = context(); axios.post.mockRejectedValueOnce(new Error('transfer interrupted')); await c.handleSubmit(); expect(c.phase).toBe('transferFailed'); expect(c.uploadParams).toBeNull()
  await c.retryUpload(); await c.handleSubmit(); expect(axios.post).toHaveBeenCalledTimes(1)
  getAPI.mockResolvedValue({ listisosresponse: { iso: [row({ isready: false, downloaddetails: [{ downloadState: 'DOWNLOAD_ERROR' }] })], count: 1 } }); await c.checkAccepted(); expect(c.phase).toBe('failed')
})
test('byte completion is not Ready; status recheck never allocates again', async () => {
  const c = context(); getAPI.mockImplementation(async command => command === 'getUploadParamsForIso' ? ticket() : { listisosresponse: { iso: [row({ isready: false, downloaddetails: [{ downloadState: 'DOWNLOADED', downloadPercent: 100 }] })], count: 1 } })
  await c.handleSubmit(); expect(c.phase).toBe('pending'); expect(c.$notification.success).not.toHaveBeenCalled()
  getAPI.mockResolvedValue({ listisosresponse: { iso: [row()], count: 1 } }); await c.checkAccepted(); expect(c.phase).toBe('done'); expect(axios.post).toHaveBeenCalledTimes(1)
})
test('an ambiguous allocation response blocks automatic repeated registration', async () => {
  const c = context(); getAPI.mockResolvedValueOnce({ postuploadisoresponse: {} }); await c.handleSubmit(); await c.handleSubmit()
  expect(c.phase).toBe('uncertain'); expect(axios.post).not.toHaveBeenCalled(); expect(getAPI).toHaveBeenCalledTimes(1)
})
test('late response after owner/project changes cannot start a file transfer', async () => {
  let finish
  const c = context(); getAPI.mockReturnValueOnce(new Promise(resolve => { finish = resolve })); const pending = c.handleSubmit(); await Promise.resolve()
  c.$store.getters.project = { id: ud }; Register.watch.registrationScope.call(c); finish(ticket()); await pending
  expect(c.phase).toBe('contextChanged'); expect(c.acceptedId).toBe(''); expect(axios.post).not.toHaveBeenCalled(); expect(c.busy).toBe(false)
})
test('cancel before registration is local and busy close remains blocked', () => {
  const c = context(); c.closeAction(); expect(getAPI).not.toHaveBeenCalled(); expect(postAPI).not.toHaveBeenCalled(); expect(c.$emit).toHaveBeenCalledWith('close-action')
  c.$emit.mockClear(); c.busy = true; c.closeAction(); expect(c.$emit).not.toHaveBeenCalled()
})

test('preflight exposes only the origin and retains certificate verification navigation', async () => {
  const c = context(); probeSsvmCert.mockResolvedValueOnce(false); await c.handleSubmit()
  expect(c.phase).toBe('preflight'); expect(c.uploadOrigin).toBe('https://upload.invalid'); expect(c.uploadOrigin).not.toContain('/upload/')
  expect(getAPI.mock.calls.find(([api]) => api === 'getUploadParamsForIso')[1].format).toBe('ISO')
})
test('interrupting a client transfer preserves the ISO and never issues a server cancel or another upload', () => {
  const c = context(); c.phase = 'uploading'; c.acceptedId = id; c.uploadAbort = { abort: jest.fn() }; c.interruptTransfer(); c.interruptTransfer()
  expect(c.uploadAbort.abort).toHaveBeenCalledTimes(1); expect(c.transferInterrupted).toBe(true); expect(c.acceptedId).toBe(id); expect(postAPI).not.toHaveBeenCalled()
})

test('the interrupt button remains usable while the dialog blocks navigation during a transfer', async () => {
  const c = context()
  const wrapper = mount(Register, { props: { action: { currentAction: { icon: 'cloud-upload-outlined' } } }, data: () => ({ phase: 'uploading', busy: true }), global: { mocks: { $store: c.$store, $t: c.$t, $notification: c.$notification, $fetchCpuArchitectureTypes: () => [] }, components: { 'a-button': Button }, stubs: { MoldDialog: { template: '<div role="dialog"><slot/><footer><slot name="footer"/></footer></div>' }, APopconfirm: { template: '<div><slot/></div>' } }, directives: { focus: {}, 'ctrl-enter': {} } } })
  await flushPromises()
  const interrupt = wrapper.findAll('button').find(button => button.text() === 'label.iso.transfer.stop')
  expect(interrupt).toBeTruthy(); expect(interrupt.element.closest('fieldset[disabled]')).toBeNull(); expect(interrupt.element.disabled).toBe(false)
  wrapper.unmount()
})
