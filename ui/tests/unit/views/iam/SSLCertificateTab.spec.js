// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements. See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership. The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License. You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied. See the License for the
// specific language governing permissions and limitations
// under the License.

import { shallowMount, flushPromises } from '@vue/test-utils'
import { reactive } from 'vue'
import Tab from '@/views/iam/SSLCertificateTab'
import { getAPI, postAPI } from '@/api'
import eventBus from '@/config/eventBus'
jest.mock('@/api', () => ({ getAPI: jest.fn(), postAPI: jest.fn() }))
let wrappers, validate
beforeEach(() => {
  jest.clearAllMocks(); wrappers = []; validate = jest.fn().mockResolvedValue({})
  getAPI.mockResolvedValue({ listsslcertsresponse: { sslcert: [{ id: 'cert', name: 'existing' }] } })
  postAPI.mockResolvedValue({ uploadsslcertresponse: { sslcert: { id: 'new' } } })
})
afterEach(() => wrappers.forEach(w => w.unmount()))
async function mount (apis = ['listSslCerts', 'uploadSslCert', 'deleteSslCert'], type = 'project') {
  const getters = reactive({ project: { id: 'project' }, userInfo: { id: 'user', roleid: 'role' }, apis: Object.fromEntries(apis.map(a => [a, {}])) })
  const route = reactive({ path: '/' + type + '/project', query: { tab: 'certificates' }, meta: { name: type } })
  const notify = jest.fn(); const success = jest.fn()
  const w = shallowMount(Tab, {
    props: { resource: { id: 'project', name: 'owner', domainid: 'domain' }, tab: 'certificates' },
    global: {
      mocks: { $store: { getters }, $route: route, $t: k => k, $getApiParams: () => Object.fromEntries(['name', 'certificate', 'privatekey', 'certchain', 'password', 'enabledrevocationcheck'].map(k => [k, { description: k }])), $notifyError: notify, $notification: { success } },
      stubs: {
        MoldDialog: { name: 'MoldDialog', props: ['size', 'closable', 'keyboard'], template: '<div><slot/><slot name="footer"/></div>' },
        'a-button': { props: ['disabled', 'loading'], template: '<button :disabled="disabled"><slot/></button>' },
        'a-form': { methods: { validate: () => validate() }, template: '<div><slot/></div>' },
        'a-form-item': { template: '<div><slot name="label"/><slot/></div>' },
        'a-spin': { template: '<div><slot/></div>' },
        'a-row': { template: '<div><slot/></div>' },
        'a-col': { template: '<div><slot/></div>' }
      }
    }
  }); wrappers.push(w); await flushPromises(); return { w, getters, route, notify, success }
}
async function open (w) {
  w.vm.openUpload(); await flushPromises()
  Object.assign(w.vm.form, { name: 'test', certificate: 'certificate', privatekey: 'secret', certchain: 'chain' })
}
test('new upload uses VM-standard dialog and enables revocation by default', async () => {
  const { w } = await mount(); await open(w)
  expect(w.vm.form.enabledrevocationcheck).toBe(true)
  expect(w.findComponent({ name: 'MoldDialog' }).props('size')).toBe('md')
})
test('default upload sends true and explicit project, then clears credentials only on success', async () => {
  const { w } = await mount(); await open(w); await w.vm.uploadSslCert()
  expect(postAPI).toHaveBeenCalledWith('uploadSslCert', expect.objectContaining({ projectid: 'project', enabledrevocationcheck: true, privatekey: 'secret' }), { preserveOnFailure: true })
  expect(w.vm.showUploadForm).toBe(false); expect(w.vm.form.privatekey).toBeUndefined(); expect(w.vm.uploading).toBe(false)
})
test('explicit unchecked state remains an intentional false', async () => {
  const { w } = await mount(); await open(w); w.vm.form.enabledrevocationcheck = false; await w.vm.uploadSslCert()
  expect(postAPI.mock.calls[0][1].enabledrevocationcheck).toBe(false)
})
test('530 retains all inputs and dialog, and a corrected retry succeeds', async () => {
  const { w, notify } = await mount(); await open(w); const original = { ...w.vm.form }
  postAPI.mockRejectedValueOnce({ response: { data: { errorresponse: { errorcode: 530, errortext: 'revocation REVOKED' } } } })
  expect(await w.vm.uploadSslCert()).toBe(false); expect(w.vm.form).toEqual(original); expect(w.vm.showUploadForm).toBe(true); expect(w.vm.uploading).toBe(false); expect(notify).toHaveBeenCalledTimes(1)
  expect(await w.vm.uploadSslCert()).toBe(true); expect(w.vm.showUploadForm).toBe(false)
})
test('pending validation blocks duplicates and closing before a request exists', async () => {
  const { w } = await mount(); await open(w); let finish; validate.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const pending = w.vm.uploadSslCert(); await w.vm.uploadSslCert(); w.vm.closeUpload(); expect(w.vm.showUploadForm).toBe(true); expect(postAPI).not.toHaveBeenCalled()
  finish({}); await pending; expect(postAPI).toHaveBeenCalledTimes(1)
})
test('invalid form sends no request and retains its draft', async () => {
  const { w, notify } = await mount(); await open(w); validate.mockRejectedValueOnce(new Error('required'))
  await w.vm.uploadSslCert(); expect(postAPI).not.toHaveBeenCalled(); expect(notify).not.toHaveBeenCalled(); expect(w.vm.form.privatekey).toBe('secret'); expect(w.vm.uploading).toBe(false)
})
test('pending request does not update another project or retain its private draft', async () => {
  const { w, success } = await mount(); await open(w); let finish
  postAPI.mockImplementationOnce(() => new Promise(resolve => { finish = resolve })); const pending = w.vm.uploadSslCert(); await flushPromises()
  eventBus.emit('project-switch-start'); expect(w.vm.showUploadForm).toBe(false); expect(w.vm.form.privatekey).toBeUndefined(); expect(w.vm.dataSource).toEqual([])
  finish({ uploadsslcertresponse: { sslcert: { id: 'new' } } }); await pending; expect(success).not.toHaveBeenCalled(); expect(w.vm.uploading).toBe(false)
})
test.each([['read only', ['listSslCerts']], ['no read', ['uploadSslCert', 'deleteSslCert']]])('%s has no upload or delete handlers', async (_, apis) => {
  const { w } = await mount(apis); w.vm.openUpload(); await w.vm.uploadSslCert(); w.vm.onDelete({ id: 'cert' })
  expect(w.vm.canUpload).toBe(false); expect(w.vm.canDelete).toBe(false); expect(w.vm.showUploadForm).toBe(false); expect(postAPI).not.toHaveBeenCalled()
  expect(w.findAll('button').some(b => b.text().includes('label.upload.ssl.certificate'))).toBe(false)
})
test('account ownership stays explicit', async () => {
  const { w } = await mount(undefined, 'account'); await open(w); await w.vm.uploadSslCert()
  expect(postAPI.mock.calls[0][1]).toMatchObject({ account: 'owner', domainid: 'domain' }); expect(postAPI.mock.calls[0][1]).not.toHaveProperty('projectid')
})
test('cancel clears private input and restores the safe default', async () => {
  const { w } = await mount(); await open(w); w.vm.form.enabledrevocationcheck = false; w.vm.closeUpload()
  expect(w.vm.form).toEqual({ enabledrevocationcheck: true }); expect(w.vm.showUploadForm).toBe(false)
})
test('role scope changes discard private drafts and stale rows', async () => {
  const { w, getters } = await mount(); await open(w); delete getters.apis.uploadSslCert; await flushPromises()
  expect(w.vm.form.privatekey).toBeUndefined(); expect(w.vm.dataSource).toEqual([]); expect(w.vm.showUploadForm).toBe(false); expect(w.vm.canUpload).toBe(false)
})
