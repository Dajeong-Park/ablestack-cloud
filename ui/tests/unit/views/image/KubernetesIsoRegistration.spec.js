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
import { h } from 'vue'
import { Form, Input, Select, Row, Col } from 'ant-design-vue'
import Register from '@/views/image/RegisterKubernetesIso'
import image from '@/config/section/image'
import store from '@/store'
import { getAPI, postAPI } from '@/api'
jest.mock('@/store', () => ({ getters: {} }))
jest.mock('@/api', () => ({ getAPI: jest.fn(), postAPI: jest.fn() }))
const zone = '11111111-1111-4111-8111-111111111111'
const id = '22222222-2222-4222-8222-222222222222'
const iso = '33333333-3333-4333-8333-333333333333'
let actor = 0
const row = { id, name: 'Example', semanticversion: '1.30.0', isoid: iso, isostate: 'Ready', arch: 'x86_64', mincpunumber: 2, minmemory: 2048, directdownload: false, isourl: 'https://example.test/k8s.iso' }
const parents = { listkubernetessupportedversionsresponse: { count: 1, kubernetessupportedversion: [row] } }
const getters = () => ({ userInfo: { id: 'actor-' + (++actor), roletype: 'Admin' }, project: {}, apis: { addKubernetesSupportedVersion: {}, listKubernetesSupportedVersions: {}, listIsos: {}, listZones: {} } })
function context (shared) {
  const c = { ...Register.data(), $store: shared || { getters: getters(), state: { user: { token: 'session' } } }, $refs: { registrationForm: { validate: jest.fn().mockResolvedValue({}), scrollToField: jest.fn() } }, $t: key => key, $emit: jest.fn(), $router: { push: jest.fn() } }
  Object.entries(Register.methods).forEach(([key, fn]) => { c[key] = fn.bind(c) })
  Object.entries(Register.computed).forEach(([key, fn]) => Object.defineProperty(c, key, { get: () => fn.call(c), configurable: true }))
  Object.assign(c.form, { semanticversion: '1.30.0', name: 'Example', url: 'https://example.test/k8s.iso' })
  c.zones = [{ id: zone, name: 'Zone13', type: 'Advanced' }]
  return c
}
beforeEach(() => {
  jest.clearAllMocks()
  postAPI.mockResolvedValue({ addkubernetessupportedversionresponse: { kubernetessupportedversion: row } })
  getAPI.mockImplementation(async command => command === 'listZones' ? { listzonesresponse: { zone: [{ id: zone, name: 'Zone13', type: 'Advanced' }] } } : command === 'listKubernetesSupportedVersions' ? parents : { listisosresponse: { count: 1, iso: [{ id: iso, zoneid: zone, isready: false, status: 'Download Complete' }] } })
})
test('double-submit during async validation sends one POST and parent Ready is still ISO progress', async () => {
  const c = context(); let validate
  c.$refs.registrationForm.validate.mockImplementation(() => new Promise(resolve => { validate = resolve }))
  const a = c.handleSubmit(); const b = c.handleSubmit(); expect(c.busy).toBe(true)
  validate(); await Promise.all([a, b])
  expect(postAPI).toHaveBeenCalledTimes(1); expect(c.phase).toBe('accepted'); expect(c.availability).toBe('progress')
  expect(postAPI.mock.calls[0][1]).toMatchObject({ directdownload: false, mincpunumber: 2, minmemory: 2048 })
})
test('reopening identical accepted request observes its existing resource without another registration', async () => {
  const c = context(); await c.handleSubmit()
  const reopened = context(c.$store); await reopened.handleSubmit()
  expect(postAPI).toHaveBeenCalledTimes(1); expect(reopened.receipt.id).toBe(id); expect(reopened.phase).toBe('accepted')
})
test('ambiguous POST failure stays uncertain; matching candidates cannot turn it into another POST or a success receipt', async () => {
  const c = context(); postAPI.mockRejectedValueOnce(new Error('Network Error'))
  await c.handleSubmit(); expect(c.phase).toBe('uncertain')
  await c.checkAccepted(); expect(c.candidates.map(r => r.id)).toEqual([id]); expect(c.phase).toBe('uncertain')
  await c.handleSubmit()
  const reopened = context(c.$store); await reopened.handleSubmit(); await reopened.checkAccepted()
  expect(postAPI).toHaveBeenCalledTimes(1); expect(reopened.phase).toBe('uncertain')
})
test('malformed success response locks allocation rather than silently accepting or re-posting', async () => {
  const c = context(); postAPI.mockResolvedValueOnce({})
  await c.handleSubmit(); await c.handleSubmit()
  expect(c.phase).toBe('uncertain'); expect(postAPI).toHaveBeenCalledTimes(1); expect(c.receipt).toEqual({})
})
test('read-only observation retry cannot allocate a second version after ISO download failure', async () => {
  const c = context(); await c.handleSubmit()
  getAPI.mockImplementation(async command => command === 'listKubernetesSupportedVersions' ? parents : { listisosresponse: { count: 1, iso: [{ id: iso, zoneid: zone, isready: false, status: 'Checksum failed' }] } })
  await c.checkAccepted(); await c.handleSubmit()
  expect(c.availability).toBe('failed'); expect(c.receipt.id).toBe(id); expect(postAPI).toHaveBeenCalledTimes(1)
})
test('Zone transitions resolve UUIDs and restore true and false user choices after Edge forcing', () => {
  const c = context(); c.zones.push({ id: iso, name: 'Edge', type: 'Edge' })
  for (const preference of [true, false]) {
    c.form.zoneid = zone; c.form.directdownload = preference; c.handleDirectChange(preference)
    c.form.zoneid = iso; c.handleZoneChange(); expect(c.form.directdownload).toBe(true); expect(c.forcedDirect).toBe(true)
    c.form.zoneid = zone; c.handleZoneChange(); expect(c.form.directdownload).toBe(preference); expect(c.forcedDirect).toBe(false)
    c.form.zoneid = 'all'; c.handleZoneChange(); expect(c.form.directdownload).toBe(true)
  }
})
test('late validation/receipt after identity change cannot update the next owner or navigate', async () => {
  const c = context(); let finish
  postAPI.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const pending = c.handleSubmit(); await flushPromises()
  c.$store.getters.userInfo.id = 'next-owner'; Register.watch.registrationScope.handler.call(c)
  finish({ addkubernetessupportedversionresponse: { kubernetessupportedversion: row } }); await pending
  expect(c.phase).toBe('contextChanged'); expect(c.receipt).toEqual({}); expect(c.$emit).not.toHaveBeenCalledWith('refresh-data')
  expect(c.$router.push).not.toHaveBeenCalled()
})
test('denied mutation is blocked even if component is invoked without its toolbar', async () => {
  const c = context(); c.$store.getters.userInfo.roletype = 'User'
  await c.handleSubmit(); expect(postAPI).not.toHaveBeenCalled(); expect(c.$refs.registrationForm.validate).not.toHaveBeenCalled()
})
test('a URL-only grant does not force a Zone request or a URL-description dependency', async () => {
  const c = context(); delete c.$store.getters.apis.listZones
  await c.fetchZones(); expect(getAPI).not.toHaveBeenCalled(); expect(c.zoneError).toBe(true)
  await c.handleSubmit(); expect(postAPI).toHaveBeenCalledTimes(1)
})
test('cancel and navigation locks do not mutate the catalog', () => {
  const c = context(); c.closeAction(); expect(c.$emit).toHaveBeenCalledWith('close-action')
  c.$emit.mockClear(); c.busy = true; c.closeAction(); c.openResource(row, 'parent')
  expect(c.$emit).not.toHaveBeenCalled(); expect(c.$router.push).not.toHaveBeenCalled()
})

test('real Ant form places CPU, RAM and checksum errors on their own fields before any request', async () => {
  const shared = { getters: getters(), state: { user: { token: 'session' } } }
  const w = mount(Register, {
    global: {
      mocks: { $store: shared, $t: key => key, $router: { push: jest.fn() }, $fetchCpuArchitectureTypes: () => [] },
      components: { AForm: Form, AFormItem: Form.Item, AInput: Input, ASelect: Select, ASelectOption: Select.Option, ARow: Row, ACol: Col },
      directives: { focus: {}, 'ctrl-enter': {} },
      stubs: { MoldDialog: { render () { return h('div', [this.$slots.default?.(), this.$slots.footer?.()]) } }, AButton: { template: '<button><slot/></button>' }, AAlert: { props: ['message'], template: '<div role="alert">{{message}}</div>' }, ASwitch: true }
    }
  })
  await flushPromises()
  await w.find('input[id$="semanticversion"]').setValue('1.30.0')
  await w.find('input[id$="url"]').setValue('https://example.test/k8s.iso')
  await w.find('input[id$="mincpunumber"]').setValue('1')
  await w.find('input[id$="minmemory"]').setValue('2047')
  await w.find('input[id$="checksum"]').setValue('a'.repeat(64))
  await w.vm.handleSubmit(); await flushPromises()
  for (const [field, message] of [['mincpunumber', 'message.kubernetes.iso.cpu.invalid'], ['minmemory', 'message.kubernetes.iso.memory.invalid'], ['checksum', 'message.kubernetes.iso.checksum.invalid']]) {
    expect(w.find('input[id$="' + field + '"]').element.closest('.ant-form-item').textContent).toContain(message)
  }
  expect(postAPI).not.toHaveBeenCalled()
  expect(w.vm.phase).toBe('draft'); expect(w.vm.busy).toBe(false); w.unmount()
})

test('a read-only readiness check may be closed without another allocation', () => {
  const c = context(); c.phase = 'accepted'; c.checking = true; c.closeAction()
  expect(c.blocksNavigation).toBe(false); expect(c.$emit).toHaveBeenCalledWith('close-action'); expect(postAPI).not.toHaveBeenCalled()
})

test('URL registration remains visible without a Zone-list grant, and uses its own standard dialog', () => {
  store.getters = { ...getters(), zones: [] }
  const action = image.children.find(section => section.name === 'kubernetesiso').actions.find(item => item.api === 'addKubernetesSupportedVersion')
  expect(action.show({}, store.getters)).toBe(true); expect(action.selfManagedDialog).toBe(true)
})

test('receipt scope uses the observed record and never the requested Zone as a substitute', () => {
  const c = context(); c.form.zoneid = zone
  expect(c.selectedScopeName).toBe('label.unknown')
  c.receipt = { catalog: { zone: { kind: 'all' } } }; expect(c.selectedScopeName).toBe('label.all.zone')
  c.receipt = { catalog: { zone: { kind: 'zone', id: iso, name: 'Other observed Zone' } } }; expect(c.selectedScopeName).toBe('Other observed Zone')
})

test('request uncertainty and read errors have one meaningful alert instead of duplicate explanations', () => {
  const c = context(); c.phase = 'uncertain'; c.submitError = 'message.kubernetes.iso.request.uncertain'
  expect(c.showSubmitError).toBe(false)
  c.phase = 'accepted'; c.availability = 'network'; c.submitError = 'message.kubernetes.iso.read.network'
  expect(c.showSubmitError).toBe(false); expect(c.availabilityType).toBe('error')
})
