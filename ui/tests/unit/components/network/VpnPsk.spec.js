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
import { mount, shallowMount, flushPromises } from '@vue/test-utils'
import { h, reactive, nextTick, KeepAlive } from 'vue'
import { Input } from 'ant-design-vue'
import Psk from '@/components/network/VpnPsk'
import ListView from '@/components/view/ListView'
import DetailsTab from '@/components/view/DetailsTab'
import GatewayForm from '@/views/network/VpnCustomerGateway'
import { copyText } from 'vue3-clipboard'
import ProjectMenu from '@/components/header/ProjectMenu'
import eventBus from '@/config/eventBus'
jest.mock('vue3-clipboard', () => ({ copyText: jest.fn() }))
jest.mock('@/api', () => ({ getAPI: jest.fn().mockResolvedValue({ listcapabilitiesresponse: { capability: {} } }) }))
jest.mock('@/utils/request', () => ({ sourceToken: { isCancel: () => false } }))
const SECRET = 'QA-only-Shared-Key-<img src=x onerror=alert(1)>'
const button = { inheritAttrs: false, render () { return h('button', this.$attrs, [this.$slots.icon?.(), this.$slots.default?.()]) } }
const pass = { render () { return h('div', this.$slots.default?.()) } }
function context (name = 'vpncustomergateway') {
  return { $route: reactive({ name, path: '/' + name + '/one', fullPath: '/' + name + '/one?tab=details', meta: { name, details: ['ipsecpsk'] }, query: {} }), $store: reactive({ state: { user: { token: 'session-one' }, app: { device: 'desktop' } }, getters: { project: { id: 'project' }, userInfo: { id: 'reader', roleid: 'role', roletype: 'User' }, apis: { listVpnCustomerGateways: {}, listVpnConnections: {}, listRemoteAccessVpns: {} }, darkMode: false } }), $t: key => key, $message: { success: jest.fn(), error: jest.fn() }, $router: { resolve: () => ({ matched: [] }) }, $config: { theme: {} } }
}
const resource = () => ({ id: 'one', projectid: 'project', ipsecpsk: SECRET })
function mountPsk (props = {}, ctx = context()) {
  return mount(Psk, { props: { value: SECRET, resource: resource(), permission: 'listVpnCustomerGateways', ...props }, global: { mocks: ctx, stubs: { AButton: button } } })
}
const show = w => w.get('button[aria-label="label.public.ip.vpn.show.key"]').trigger('click')
beforeEach(() => { copyText.mockReset(); delete navigator.clipboard })
afterEach(() => { delete navigator.clipboard })

test('modern clipboard writes only after an explicit click and keeps the DOM masked', async () => {
  const writeText = jest.fn().mockResolvedValue(undefined)
  navigator.clipboard = { writeText }
  const ctx = context()
  const w = mountPsk({}, ctx)
  expect(writeText).not.toHaveBeenCalled()
  await w.get('button[aria-label="label.vpn.psk.copy"]').trigger('click')
  await flushPromises()
  expect(writeText).toHaveBeenCalledWith(SECRET)
  expect(copyText).not.toHaveBeenCalled()
  expect(w.html()).not.toContain(SECRET)
  expect(ctx.$message.success).toHaveBeenCalledWith('label.copied.clipboard')
  w.unmount()
})

test('starting a project switch hides a revealed key before capability lookup completes', async () => {
  let resolveLookup
  const lookup = new Promise(resolve => { resolveLookup = resolve })
  const ctx = context()
  ctx.$store.dispatch = jest.fn().mockResolvedValue(undefined).mockReturnValueOnce(lookup)
  ctx.$router.push = jest.fn().mockResolvedValue(undefined)
  const w = mountPsk({}, ctx)
  await show(w)
  const vm = { ...ctx, loading: false, defaultOption: { id: 0 }, $notifyError: jest.fn() }
  const pending = ProjectMenu.methods.changeProject.call(vm, { id: 'other', name: 'Other' })
  await nextTick()
  expect(ctx.$store.getters.project.id).toBe('project')
  expect(w.text()).not.toContain(SECRET)
  expect(w.findAll('button')).toHaveLength(0)
  resolveLookup()
  await pending
  expect(w.text()).not.toContain(SECRET)
  w.unmount()
})

test('unavailable modern clipboard falls back to the existing browser copy operation', async () => {
  navigator.clipboard = { writeText: jest.fn().mockRejectedValue(new Error(SECRET)) }
  copyText.mockImplementation((v, e, callback) => callback(null, { clearSelection: jest.fn() }))
  const ctx = context()
  const w = mountPsk({}, ctx)
  await w.get('button[aria-label="label.vpn.psk.copy"]').trigger('click')
  await flushPromises()
  expect(copyText).toHaveBeenCalledTimes(1)
  expect(copyText.mock.calls[0][0]).toBe(SECRET)
  expect(w.html()).not.toContain(SECRET)
  expect(ctx.$message.success).toHaveBeenCalledWith('label.copied.clipboard')
  w.unmount()
})

test('a rejected clipboard write after a project change cannot copy a stale key through fallback', async () => {
  let rejectWrite
  navigator.clipboard = { writeText: jest.fn(() => new Promise((resolve, reject) => { rejectWrite = reject })) }
  const ctx = context()
  const w = mountPsk({}, ctx)
  await w.get('button[aria-label="label.vpn.psk.copy"]').trigger('click')
  ctx.$store.getters.project.id = 'other'
  await nextTick()
  rejectWrite(new Error(SECRET))
  await flushPromises()
  expect(copyText).not.toHaveBeenCalled()
  expect(ctx.$message.success).not.toHaveBeenCalled()
  expect(ctx.$message.error).not.toHaveBeenCalled()
  w.unmount()
})
test('default text, attributes, ARIA and markup contain only the fixed mask', () => {
  const w = mountPsk(); expect(w.text()).toContain('••••••••'); expect(w.html()).not.toContain(SECRET); expect(w.find('img[src=x]').exists()).toBe(false); expect(copyText).not.toHaveBeenCalled(); w.unmount()
})
test('explicit reveal is escaped text and hide removes the key from the DOM', async () => {
  const w = mountPsk(); await show(w); expect(w.text()).toContain(SECRET); expect(w.find('img[src=x]').exists()).toBe(false); await w.get('button[aria-pressed="true"]').trigger('click'); expect(w.html()).not.toContain(SECRET); w.unmount()
})
test('copy while masked is explicit, uses no bound DOM secret and has a generic notification', async () => {
  const ctx = context(); copyText.mockImplementation((value, el, callback) => callback(null, { clearSelection: jest.fn() })); const w = mountPsk({}, ctx)
  await w.get('button[aria-label="label.vpn.psk.copy"]').trigger('click'); expect(copyText).toHaveBeenCalledTimes(1); expect(copyText.mock.calls[0][0]).toBe(SECRET); expect(w.html()).not.toContain(SECRET); expect(ctx.$message.success).toHaveBeenCalledWith('label.copied.clipboard'); w.unmount()
})
test('clipboard errors never expose error text or the key', async () => {
  const ctx = context(); copyText.mockImplementation((v, e, callback) => callback(new Error(SECRET))); const w = mountPsk({}, ctx); await w.get('button[aria-label="label.vpn.psk.copy"]').trigger('click'); expect(ctx.$message.error).toHaveBeenCalledWith('message.vpn.psk.copy.failed'); expect(w.html()).not.toContain(SECRET); w.unmount()
})
test('a clipboard completion in an old project cannot notify the new context', async () => {
  const ctx = context(); const w = mountPsk({}, ctx); await w.get('button[aria-label="label.vpn.psk.copy"]').trigger('click'); const done = copyText.mock.calls[0][2]; ctx.$store.getters.project.id = 'other'; await nextTick(); done(null, { clearSelection: jest.fn() }); expect(ctx.$message.success).not.toHaveBeenCalled(); expect(w.findAll('button')).toHaveLength(0); w.unmount()
})
test.each(['user', 'role', 'project', 'session', 'permission'])('%s transition hides immediately and cannot revive stale props on return', async kind => {
  const ctx = context(); const w = mountPsk({}, ctx); await show(w)
  const change = value => { if (kind === 'user') ctx.$store.getters.userInfo.id = value; if (kind === 'role') ctx.$store.getters.userInfo.roleid = value; if (kind === 'project') ctx.$store.getters.project.id = value; if (kind === 'session') ctx.$store.state.user.token = value; if (kind === 'permission') ctx.$store.getters.apis = value ? { listVpnCustomerGateways: {} } : {} }
  const original = { user: 'reader', role: 'role', project: 'project', session: 'session-one', permission: true }[kind]; change(kind === 'permission' ? false : 'other'); await nextTick(); expect(w.html()).not.toContain(SECRET); expect(w.findAll('button')).toHaveLength(0); change(original); await nextTick(); expect(w.findAll('button')).toHaveLength(0)
  await w.setProps({ resource: resource() }); expect(w.text()).not.toContain(SECRET); expect(w.findAll('button')).toHaveLength(2); w.unmount()
})
test('tab and target changes reset disclosure, and stale target data cannot be revealed', async () => {
  const ctx = context(); const w = mountPsk({}, ctx); await show(w); ctx.$route.fullPath += '&view=other'; await nextTick(); expect(w.text()).not.toContain(SECRET); await show(w)
  ctx.$route.path = '/vpncustomergateway/two'; ctx.$route.fullPath = ctx.$route.path; await nextTick(); expect(w.text()).not.toContain(SECRET); expect(w.findAll('button')).toHaveLength(0); await w.setProps({ resource: { id: 'two', projectid: 'project' } }); expect(w.findAll('button')).toHaveLength(2); expect(w.text()).not.toContain(SECRET); w.unmount()
})
test('a changed key and a later return to the old key both start masked', async () => {
  const w = mountPsk(); await show(w); await w.setProps({ value: 'replacement' }); expect(w.text()).not.toContain('replacement'); await w.setProps({ value: SECRET }); expect(w.text()).not.toContain(SECRET); w.unmount()
})
test.each([{ permission: 'notAllowed' }, { resource: { id: 'one', projectid: 'other' } }, { maskedOnly: true }])('denied, wrong-owner and list cells have no reveal/copy controls: %j', props => {
  const w = mountPsk(props); expect(w.text()).toBe('••••••••'); expect(w.findAll('button')).toHaveLength(0); expect(copyText).not.toHaveBeenCalled(); w.unmount()
})
test('missing keys use a dash without controls', () => { const w = mountPsk({ value: '' }); expect(w.text()).toBe('—'); expect(w.findAll('button')).toHaveLength(0); w.unmount() })
test('KeepAlive activation never restores a previously disclosed key', async () => {
  const parent = { data: () => ({ visible: true }), render () { return h(KeepAlive, null, { default: () => this.visible ? h(Psk, { value: SECRET, resource: resource(), permission: 'listVpnCustomerGateways' }) : h('div') }) } }
  const w = mount(parent, { global: { mocks: context(), stubs: { AButton: button } } }); await show(w); expect(w.text()).toContain(SECRET); w.vm.visible = false; await nextTick(); w.vm.visible = true; await nextTick(); expect(w.text()).not.toContain(SECRET); w.unmount()
})
test.each(['s2svpnconn', 'vpncustomergateway'])('shared list uses mask-only rendering for %s, including a saved PSK column', name => {
  const ctx = context(name); const r = resource(); const w = shallowMount(ListView, { props: { columns: [{ key: 'ipsecpsk', dataIndex: 'ipsecpsk' }], items: [r] }, global: { mocks: ctx, provide: { parentFetchData: jest.fn(), parentToggleLoading: jest.fn() }, stubs: { VpnPsk: false, AButton: button, ATable: { render () { return h('div', this.$slots.bodyCell({ column: { key: 'ipsecpsk', dataIndex: 'ipsecpsk' }, text: SECRET, record: r })) } } } } }); expect(w.text()).toBe('••••••••'); expect(w.findAll('button')).toHaveLength(0); w.unmount()
})
test.each(['s2svpnconn', 'vpncustomergateway'])('shared details exclude generic text rendering and permit explicit reveal for %s', async name => {
  const w = shallowMount(DetailsTab, { props: { resource: resource() }, global: { mocks: context(name), stubs: { VpnPsk: false, AButton: button, AList: { render () { return h('div', this.$slots.renderItem({ item: 'ipsecpsk' })) } }, AListItem: pass } } }); expect(w.text()).not.toContain(SECRET); await show(w); expect(w.text()).toContain(SECRET); w.unmount()
})
test('customer gateway editing starts with a password input and clears it when the project changes', async () => {
  const ctx = context(); const names = ['name', 'gateway', 'cidrlist', 'ipsecpsk', 'ikepolicy', 'esppolicy', 'ikelifetime', 'esplifetime', 'dpd', 'splitconnections', 'forceencap', 'ikeversion']; const apiParams = Object.fromEntries(names.map(k => [k, { description: k }]))
  const w = mount(GatewayForm, { props: { apiParams, initialValues: resource() }, global: { mocks: ctx, components: { AInputPassword: Input.Password }, stubs: { AInputPassword: false, AInput: false, AForm: pass, AFormItem: pass, ASelect: true, ASelectOption: true, ATooltip: true } } }); await flushPromises(); expect(w.get('.ant-input-password input').attributes('type')).toBe('password'); expect(w.get('.ant-input-password input').element.value).toBe(SECRET); ctx.$store.getters.project.id = 'other'; await nextTick(); expect(w.get('.ant-input-password input').element.value).toBe(''); expect(w.emitted('cancel')).toHaveLength(1); w.unmount()
})

test('an open customer gateway form clears its key at the start of a project switch', async () => {
  const names = ['name', 'gateway', 'cidrlist', 'ipsecpsk', 'ikepolicy', 'esppolicy', 'ikelifetime', 'esplifetime', 'dpd', 'splitconnections', 'forceencap', 'ikeversion']
  const w = shallowMount(GatewayForm, { props: { apiParams: Object.fromEntries(names.map(k => [k, { description: k }])), initialValues: resource() }, global: { mocks: context() } })
  await flushPromises()
  eventBus.emit('project-switch-start')
  expect(w.vm.form.ipsecpsk).toBe('')
  expect(w.emitted('cancel')).toHaveLength(1)
  w.unmount()
})
