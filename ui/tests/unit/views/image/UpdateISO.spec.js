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
import { Form, Select, Input, Switch } from 'ant-design-vue'
import ISO from '@/views/image/UpdateISO'
import { isoEditValues, isoEditCapability, isoEditParams, isoEditLink, isoOptionFilter } from '@/utils/isoEdit'
import { getAPI, postAPI } from '@/api'
jest.mock('@/api', () => ({ getAPI: jest.fn(), postAPI: jest.fn() }))
const fields = ['name', 'displaytext', 'bootable', 'arch', 'ostypeid', 'forceupdateostype', 'passwordenabled', 'isdynamicallyscalable']
const resource = { id: 'image', format: 'ISO', account: 'owner', domainid: 'domain', isready: true, name: 'image', displaytext: '', bootable: false, arch: 'x86_64', ostypeid: 'none', passwordenabled: false, isdynamicallyscalable: false }
const osTypes = [{ id: 'none', description: 'None' }, { id: 'linux', description: 'Other Linux (64-bit)' }]
const getters = () => ({ userInfo: { id: 'actor', roletype: 'User', account: 'owner', domainid: 'domain' }, project: {}, apis: { updateIso: { params: fields.map(name => ({ name })) }, listIsos: {}, listOsTypes: {}, listUserData: {}, linkUserDataToTemplate: {} } })
let state
function context (change = {}) {
  const c = { resource: { ...resource }, $store: { getters: getters(), state: { user: { token: 'session' } } }, $refs: { editForm: { validate: jest.fn().mockResolvedValue() } }, $emit: jest.fn(), $message: { success: jest.fn() }, $t: k => k }
  Object.assign(c, ISO.data.call(c), { osTypes, userDataSelectionReady: true }, change)
  for (const [key, fn] of Object.entries(ISO.methods)) c[key] = fn.bind(c)
  for (const [key, fn] of Object.entries(ISO.computed)) Object.defineProperty(c, key, { get: () => fn.call(c) })
  return c
}
beforeEach(() => {
  jest.clearAllMocks(); state = { ...resource }
  getAPI.mockImplementation(api => Promise.resolve(api === 'listOsTypes' ? { listostypesresponse: { ostype: osTypes } } : { listisosresponse: { iso: [{ ...state }], count: 1 } }))
  postAPI.mockImplementation((api, params) => {
    if (api === 'updateIso') {
      for (const field of fields.filter(k => k !== 'forceupdateostype')) {
        if (Object.prototype.hasOwnProperty.call(params, field)) state[field] = params[field]
      }
    } else { state.userdataid = params.userdataid; state.userdatapolicy = params.userdatapolicy }
    return Promise.resolve({})
  })
})
test.each(['x86_64', 'aarch64', 's390x'])('current %s and false values initialize and unchanged fields never rewrite metadata', arch => {
  const r = { ...resource, arch, details: { unrelated: 'keep' } }; const v = isoEditValues(r)
  expect(v).toMatchObject({ arch, bootable: false, passwordenabled: false, isdynamicallyscalable: false })
  expect(isoEditParams(v, r, isoEditCapability({ apis: getters().apis }))).toEqual({ id: 'image' })
})
test('null, unknown and unsupported values are preserved without truthiness defaults', () => {
  const r = { ...resource, arch: 'future', passwordenabled: null, bootable: undefined }
  const v = isoEditValues(r); expect(v).toMatchObject({ arch: 'future', passwordenabled: undefined, bootable: undefined })
  const cap = isoEditCapability({ apis: { updateIso: { params: [{ name: 'name' }] } } })
  expect(isoEditParams({ ...v, name: 'new' }, r, cap)).toEqual({ id: 'image', name: 'new' })
  expect(() => isoEditParams({ ...v, arch: 's390x' }, r, cap)).toThrow('unsupported')
})
test('label and value search is independent of vnode child structure', () => {
  expect(isoOptionFilter('ARM', { label: 'ARM 64 bits', value: 'aarch64' })).toBe(true)
  expect(isoOptionFilter('s390', { label: 'IBM Z', value: 's390x' })).toBe(true)
  expect(isoOptionFilter('absent', { label: 'IBM Z', value: 's390x' })).toBe(false)
  expect(isoOptionFilter('x', {})).toBe(false)
})
test('bootable transition requires a real OS and explicit safe force value; data transition retains the OS', () => {
  const cap = isoEditCapability({ apis: getters().apis }); const form = isoEditValues(resource)
  expect(() => isoEditParams({ ...form, bootable: true }, resource, cap, osTypes)).toThrow('os.required')
  expect(isoEditParams({ ...form, bootable: true, ostypeid: 'linux' }, resource, cap, osTypes)).toEqual({ id: 'image', bootable: true, ostypeid: 'linux', forceupdateostype: false })
  expect(isoEditParams({ ...form, bootable: false, ostypeid: 'linux' }, { ...resource, bootable: true, ostypeid: 'linux' }, cap, osTypes)).toEqual({ id: 'image', bootable: false })
  delete cap.parameters.forceupdateostype
  expect(() => isoEditParams({ ...form, ostypeid: 'linux' }, resource, cap, osTypes)).toThrow('unsupported')
})
test('only explicit deltas are written; details, format and VM flags are not cleared', async () => {
  const c = context(); c.form.name = 'renamed'; await c.handleSubmit()
  expect(postAPI).toHaveBeenCalledTimes(1)
  expect(postAPI).toHaveBeenCalledWith('updateIso', { id: 'image', name: 'renamed', ignoreproject: true }, { preserveOnFailure: true })
  expect(c.$emit).toHaveBeenCalledWith('close-action')
})
test('unchanged save performs a read and no mutation; unknown policy is retained', async () => {
  const c = context(); state.userdataid = 'old'; state.userdatapolicy = 'FUTURE'; c.baseline = { ...state }; c.userdataid = 'old'; c.userdatapolicy = 'FUTURE'
  await c.handleSubmit(); expect(postAPI).not.toHaveBeenCalled(); expect(c.$emit).toHaveBeenCalledWith('close-action')
})
test('link-only edits do not send updateIso; detach omits target and policy', async () => {
  const c = context(); c.userdataid = 'data'; c.userdatapolicy = 'APPEND'; await c.handleSubmit()
  expect(postAPI.mock.calls.map(x => x[0])).toEqual(['linkUserDataToTemplate'])
  expect(isoEditLink(state)).toEqual({ id: 'data', policy: 'APPEND' })
  postAPI.mockClear(); const d = context(); state = { ...resource, userdataid: 'old', userdatapolicy: 'APPEND' }; d.baseline = { ...state }; d.userdataid = ''; d.userdatapolicy = 'APPEND'; await d.handleSubmit()
  expect(postAPI.mock.calls[0][1]).toEqual({ templateid: 'image', ignoreproject: true })
})
test('known link failure preserves metadata and target; retry sends only the link once', async () => {
  const c = context(); c.form.name = 'renamed'; c.userdataid = 'data'; c.userdatapolicy = 'DENYOVERRIDE'
  const real = postAPI.getMockImplementation(); let failed = false
  postAPI.mockImplementation((api, params) => { if (api === 'linkUserDataToTemplate' && !failed) { failed = true; return Promise.reject(Object.assign(new Error('link failure'), { response: { status: 503, headers: { 'x-description': 'link failure' } } })) } return real(api, params) })
  await c.handleSubmit(); expect(c.linkPending).toBe(true); expect(c.metadataDone).toBe(true); expect(c.form.name).toBe('renamed'); expect(c.userdataid).toBe('data'); expect(c.$message.success).not.toHaveBeenCalled()
  await c.handleSubmit(); expect(postAPI.mock.calls.filter(x => x[0] === 'updateIso')).toHaveLength(1); expect(postAPI.mock.calls.filter(x => x[0] === 'linkUserDataToTemplate')).toHaveLength(2); expect(c.$emit).toHaveBeenCalledWith('close-action')
})
test('read after applied metadata failure offers GET-only confirmation and does not start a link', async () => {
  const c = context(); c.form.name = 'renamed'; c.userdataid = 'data'; const real = postAPI.getMockImplementation(); let failRead = false
  postAPI.mockImplementation((api, p) => { const result = real(api, p); if (api === 'updateIso') failRead = true; return result })
  const normal = getAPI.getMockImplementation(); getAPI.mockImplementation(api => failRead ? Promise.reject(new Error('offline')) : normal(api))
  await c.handleSubmit(); expect(c.unknownStage).toBe('metadata'); const count = postAPI.mock.calls.length; failRead = false; await c.checkStatus()
  expect(postAPI).toHaveBeenCalledTimes(count); expect(c.linkPending).toBe(true); expect(c.metadataDone).toBe(true)
  await c.handleSubmit(); expect(postAPI.mock.calls.map(x => x[0])).toEqual(['updateIso', 'linkUserDataToTemplate'])
})
test('a lost link response is confirmed by reading, without duplicate mutations', async () => {
  const c = context(); c.userdataid = 'data'; const real = postAPI.getMockImplementation()
  postAPI.mockImplementation((api, p) => { real(api, p); return Promise.reject(new Error('lost response')) })
  await c.handleSubmit(); expect(postAPI).toHaveBeenCalledTimes(1); expect(c.$message.success).toHaveBeenCalled()
})
test('concurrent metadata or linkage changes never overwrite other edits', async () => {
  const c = context(); c.form.name = 'new'; state.name = 'external'; await c.handleSubmit(); expect(c.conflict).toBe(true); expect(postAPI).not.toHaveBeenCalled()
  const d = context(); d.metadataDone = true; d.linkPending = true; d.intent = { params: { id: 'image' }, before: { ...resource } }; state = { ...resource, userdataid: 'external' }; d.userdataid = 'data'; await d.handleSubmit(); expect(d.conflict).toBe(true); expect(postAPI).not.toHaveBeenCalled()
})
test('role and scope changes or duplicate submits do not dispatch extra writes', async () => {
  const c = context(); c.form.name = 'new'; let release; c.$refs.editForm.validate.mockReturnValueOnce(new Promise(resolve => { release = resolve }))
  const pending = c.handleSubmit(); await c.handleSubmit(); expect(c.$refs.editForm.validate).toHaveBeenCalledTimes(1); release(); await pending; expect(postAPI).toHaveBeenCalledTimes(1)
  postAPI.mockClear(); const d = context(); delete d.$store.getters.apis.updateIso; d.form.name = 'new'; await d.handleSubmit(); expect(postAPI).not.toHaveBeenCalled()
})
test('actual form links arch/bootable/OS labels to native controls and preserves false inputs', async () => {
  const slot = { template: '<div><slot/><slot name="footer"/></div>' }
  const w = mount(ISO, { props: { resource }, global: { mocks: { $store: { getters: getters(), state: { user: { token: 'session' } } }, $t: k => k, $message: { success: jest.fn() } }, components: { AForm: Form, AFormItem: Form.Item, ASelect: Select, AInput: Input, ASwitch: Switch }, stubs: { MoldDialog: slot, UserDataSelection: true, ASpin: slot, AAlert: true, AButton: true, TooltipLabel: { props: ['title'], template: '<span>{{ title }}</span>' }, Wave: true } } })
  await flushPromises(); const input = w.get('input[id$="-arch"]').element; expect(Array.from(input.labels).some(x => x.textContent.includes('label.arch'))).toBe(true); expect(w.vm.form.arch).toBe('x86_64'); expect(w.vm.form.passwordenabled).toBe(false); w.unmount()
})
