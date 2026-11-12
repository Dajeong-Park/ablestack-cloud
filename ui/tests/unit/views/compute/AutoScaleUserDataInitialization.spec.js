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
import { h, reactive } from 'vue'
import Wizard from '@/views/compute/CreateAutoScaleVmGroup.vue'
import Picker from '@/views/compute/wizard/UserDataSelection.vue'
import { getAPI, postAPI } from '@/api'
jest.mock('@/api', () => ({ getAPI: jest.fn(), postAPI: jest.fn() }))
jest.mock('@/store', () => ({ getters: { apis: {}, userInfo: {}, project: null } }))

const slot = { render () { return h('div', [this.$slots.default?.(), this.$slots.description?.(), this.$slots.footer?.(), this.$slots['footer-content']?.()]) } }
const alert = { props: ['message'], render () { return h('aside', [this.message, this.$slots.description?.()]) } }
const button = { props: ['disabled', 'loading'], render () { return h('button', { disabled: this.disabled || this.loading }, this.$slots.default?.()) } }
const deploy = { props: ['disabled', 'loading'], render () { return h('button', { class: 'deploy', disabled: this.disabled || this.loading }, 'Create') } }
const component = {
  ...Wizard,
  beforeCreate () {
    for (const name of ['createCondition', 'createAutoScalePolicy', 'createAutoScaleVmGroup', 'createAutoScaleVmProfile']) {
      this[`${name}ApiParams`] = new Proxy({}, { get: () => ({ description: '' }) })
    }
  },
  created () { this.initForm(); this.zoneSelected = true; this.zoneId = 'zone'; this.template = {}; this.userdataDefaultOverridePolicy = undefined },
  mounted () {},
  activated () {},
  deactivated () {},
  beforeUnmount () {},
  computed: { ...Wizard.computed, hasRequiredCreationApis: () => true },
  methods: { ...Wizard.methods, initCreationTracking () {}, stopCreationTracking () {} }
}
let wrappers
beforeEach(() => { jest.clearAllMocks(); wrappers = []; getAPI.mockResolvedValue({ listuserdataresponse: {} }) })
afterEach(() => wrappers.forEach(w => w.unmount()))
async function open (apis = { listUserData: {} }) {
  const getters = reactive({ apis, project: { id: 'project-a' }, userInfo: { id: 'user', account: 'owner', domainid: 'domain' } })
  const w = shallowMount(component, {
    global: {
      mocks: { $t: k => k, $config: {}, $store: { getters }, $route: { query: {}, meta: {}, path: '/action/createAutoScaleVmGroup' }, $router: { back: jest.fn() } },
      stubs: { ARow: slot, ACol: slot, ACard: slot, AForm: slot, AFormItem: slot, ASteps: slot, AStep: slot, AAlert: alert, AButton: button, InfoCard: slot, UserDataSelection: false, DeployButtons: deploy }
    }
  })
  wrappers.push(w); await flushPromises(); return { w, getters }
}
const picker = w => w.findComponent(Picker)

test('collapsed default initializes None and enables Create without mounting SSH or affinity selectors', async () => {
  const { w } = await open()
  expect(w.vm.showDetails).toBe(false); expect(picker(w).exists()).toBe(true)
  expect(w.find('.autoscale-userdata-options').isVisible()).toBe(false)
  expect(w.vm.userDataSelectionReady).toBe(true); expect(w.vm.userDataSelectionBlocked).toBe(false)
  expect(w.vm.form.userdataid).toBeUndefined(); expect(w.get('button.deploy').attributes('disabled')).toBeUndefined()
  expect(w.findComponent({ name: 'SshKeyPairSelection' }).exists()).toBe(false)
  expect(w.findComponent({ name: 'AffinityGroupSelection' }).exists()).toBe(false)
  expect(w.text()).toContain('label.noselect'); expect(postAPI).not.toHaveBeenCalled()
})

test('pending lookup disables Create and explains how to inspect it while collapsed', async () => {
  let finish; getAPI.mockImplementation(() => new Promise(resolve => { finish = resolve }))
  const { w } = await open()
  expect(w.vm.userDataSelectionBlocked).toBe(true); expect(w.get('button.deploy').attributes('disabled')).toBeDefined()
  expect(w.text()).toContain('message.autoscale.userdata.selection.blocked')
  finish({ listuserdataresponse: {} }); await flushPromises()
  expect(w.vm.userDataSelectionBlocked).toBe(false)
})

test('a selected row survives advanced open/close; hidden lookup failure remains blocked and retry recovers', async () => {
  getAPI.mockResolvedValue({ listuserdataresponse: { userdata: [{ id: 'saved', name: 'Saved', params: 'key' }], count: 1 } })
  const { w } = await open(); const instance = picker(w).vm
  await w.setData({ showDetails: true }); instance.selectItem(instance.items[0]); await flushPromises()
  w.vm.userDataValues.key = 'entered'; await w.setData({ showDetails: false })
  expect(picker(w).vm).toBe(instance); expect(w.vm.form.userdataid).toBe('saved'); expect(w.vm.userDataValues.key).toBe('entered')
  getAPI.mockRejectedValueOnce(new Error('offline')); await instance.load(instance.query); await flushPromises()
  expect(w.vm.userDataSelectionBlocked).toBe(true); expect(w.vm.form.userdataid).toBe('saved')
  expect(w.get('button.deploy').attributes('disabled')).toBeDefined(); expect(postAPI).not.toHaveBeenCalled()
  await instance.load(instance.query); await flushPromises(); expect(w.vm.userDataSelectionBlocked).toBe(false)
})

test('project change clears the old selection/variables and ignores an old in-flight owner response', async () => {
  getAPI.mockResolvedValue({ listuserdataresponse: { userdata: [{ id: 'saved', params: 'key' }] } })
  const { w, getters } = await open(); picker(w).vm.selectItem(picker(w).vm.items[0]); await flushPromises(); w.vm.userDataValues.key = 'old'
  let finish; getAPI.mockImplementationOnce(() => new Promise(resolve => { finish = resolve })).mockResolvedValue({ listuserdataresponse: {} })
  const pending = picker(w).vm.load(picker(w).vm.query); getters.project = { id: 'project-b' }; await flushPromises()
  finish({ listuserdataresponse: { userdata: [{ id: 'saved', params: 'old' }] } }); await pending; await flushPromises()
  expect(w.vm.form.userdataid).toBeUndefined(); expect(w.vm.userDataValues).toEqual({}); expect(picker(w).vm.selectedId).toBe('0')
  expect(getAPI).toHaveBeenLastCalledWith('listUserData', expect.objectContaining({ projectid: 'project-b', ignoreproject: true }), expect.any(Object))
  expect(postAPI).not.toHaveBeenCalled()
})

test('missing list permission remains fail-closed without issuing unscoped queries', async () => {
  const { w } = await open({})
  expect(getAPI).not.toHaveBeenCalled(); expect(w.vm.userDataSelectionBlocked).toBe(true)
  expect(w.get('button.deploy').attributes('disabled')).toBeDefined(); expect(postAPI).not.toHaveBeenCalled()
})
