// Licensed to the Apache Software Foundation (ASF) under one or more
// contributor license agreements. See the NOTICE file for ownership information.
// Licensed under the Apache License, Version 2.0; http://www.apache.org/licenses/LICENSE-2.0
// Distributed on an AS IS BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND.
import { mount, flushPromises } from '@vue/test-utils'
import { reactive, nextTick } from 'vue'
import { Button } from 'ant-design-vue'
import Vnf from '@/views/compute/DeployVnfAppliance.vue'
import Picker from '@/views/compute/wizard/UserDataSelection.vue'
import DeployButtons from '@/views/compute/wizard/DeployButtons.vue'
import { userDataSelectionConsumer } from '@/utils/userDataSelection'
import { getAPI, postAPI } from '@/api'
jest.mock('@/api', () => ({ getAPI: jest.fn(), postAPI: jest.fn() }))
jest.mock('@/store', () => ({ getters: { apis: {}, userInfo: {}, project: {} } }))

const reply = (rows = []) => ({ listuserdataresponse: { count: rows.length, userdata: rows } })
const selected = { id: 'uuid', name: 'chosen', params: 'A,B' }
function subject (data = {}) {
  const getters = reactive({ apis: { listUserData: {} }, userInfo: { account: 'admin', domainid: 'root' }, project: { id: 'qa' } })
  const validate = jest.fn(() => new Promise(() => {}))
  const component = {
    mixins: [userDataSelectionConsumer],
    components: { Picker, DeployButtons },
    data: () => ({ form: {}, dataPreFill: {}, zoneId: 'z', userdataTabKey: 'userdataregistered', userdataDefaultOverridePolicy: undefined, doUserdataOverride: false, doUserdataAppend: false, userDataParams: [], userDataValues: {}, open: false, deploymentOwnerScope: null, loading: { deploy: false }, formRef: { value: { validate } }, ...data }),
    computed: { vnfDeploymentBlocked: Vnf.computed.vnfDeploymentBlocked },
    watch: { userDataScopeKey: Vnf.watch.userDataScopeKey, 'form.templateid': Vnf.watch['form.templateid'] },
    created () { this.deploymentOwnerScope = JSON.stringify(this.userDataOwner) },
    methods: Object.fromEntries(['updateUserData', 'selectVnfUserData', 'resetVnfUserData', 'handleSubmit'].map(key => [key, Vnf.methods[key]])),
    template: '<div><Picker v-if="open" :scope="userDataOwner" :zone-id="zoneId" :value="form.userdataid" :pre-fill-content="dataPreFill" @select-user-data-item="selectVnfUserData" @ready="userDataSelectionReady = $event" /><DeployButtons :disabled="vnfDeploymentBlocked" deploy-button-text="Deploy" @handle-deploy="handleSubmit" /></div>'
  }
  const wrapper = mount(component, { global: { mocks: { $store: { getters }, $t: key => key, $notification: { error: jest.fn() } }, stubs: { 'a-button': Button, 'a-table': { template: '<div />' }, 'a-input-search': { template: '<input />' }, 'a-radio': { template: '<label><slot /></label>' }, 'a-alert': { template: '<div />' } } } })
  return { wrapper, getters, validate, button: () => wrapper.get('button') }
}
beforeEach(() => { jest.clearAllMocks(); getAPI.mockResolvedValue(reply()) })

test('closed advanced defaults deploy without mounting or querying the optional library', async () => {
  const { wrapper, button, validate } = subject()
  expect(wrapper.findComponent(Picker).exists()).toBe(false); expect(button().element.disabled).toBe(false)
  await button().trigger('click'); expect(validate).toHaveBeenCalledTimes(1); expect(getAPI).not.toHaveBeenCalled(); wrapper.unmount()
})

test('opening and closing advanced cannot block explicit None while its list is pending or failed', async () => {
  let fail; getAPI.mockImplementation(() => new Promise((resolve, reject) => { fail = reject }))
  const { wrapper, button } = subject(); await wrapper.setData({ open: true })
  expect(button().element.disabled).toBe(false); fail(new Error('offline')); await flushPromises()
  expect(wrapper.findComponent(Picker).vm.ready).toBe(false); expect(button().element.disabled).toBe(false)
  await wrapper.setData({ open: false }); expect(button().element.disabled).toBe(false); wrapper.unmount()
})

test.each(['pending', 'failed', 'deleted'])('prefilled registered UUID stays blocked when %s, even with advanced closed', async state => {
  if (state === 'pending') getAPI.mockImplementation(() => new Promise(() => {}))
  if (state === 'failed') getAPI.mockRejectedValue(new Error('offline'))
  const { wrapper, button, validate } = subject({ dataPreFill: { userdataid: selected.id } })
  expect(button().element.disabled).toBe(true); await wrapper.setData({ open: true }); await flushPromises()
  expect(button().element.disabled).toBe(true); wrapper.vm.handleSubmit({ preventDefault: jest.fn() }); expect(validate).not.toHaveBeenCalled(); wrapper.unmount()
})

test('verified selection deploys, but retry pending/failure remains blocked after advanced unmount', async () => {
  getAPI.mockResolvedValue(reply([selected])); const { wrapper, button } = subject({ open: true }); await flushPromises()
  const picker = wrapper.findComponent(Picker); picker.vm.selectItem(selected); await nextTick()
  expect(wrapper.vm.form.userdataid).toBe(selected.id); expect(button().element.disabled).toBe(false)
  let fail; getAPI.mockImplementation(() => new Promise((resolve, reject) => { fail = reject }))
  const loading = picker.vm.load(picker.vm.query); await nextTick(); expect(button().element.disabled).toBe(true)
  fail(new Error('offline')); await loading; await nextTick(); expect(button().element.disabled).toBe(true)
  await wrapper.setData({ open: false }); expect(button().element.disabled).toBe(true); expect(postAPI).not.toHaveBeenCalled(); wrapper.unmount()
})

test('explicit None removes prefill, UUID and parameters without requiring a library response', async () => {
  const { wrapper, button } = subject({ dataPreFill: { userdataid: selected.id }, form: { userdataid: selected.id }, userDataParams: [{ key: 'OLD' }], userDataValues: { OLD: 'stale' } })
  wrapper.vm.selectVnfUserData('0'); await nextTick()
  expect(wrapper.vm.form.userdataid).toBeUndefined(); expect(wrapper.vm.dataPreFill.userdataid).toBeUndefined()
  expect(wrapper.vm.userDataParams).toEqual([]); expect(wrapper.vm.userDataValues).toEqual({}); expect(button().element.disabled).toBe(false); wrapper.unmount()
})

test('initial Zone selection preserves requested prefill until the picker verifies it', async () => {
  const { wrapper, button } = subject({ zoneId: '', dataPreFill: { userdataid: selected.id } })
  await wrapper.setData({ zoneId: 'z' }); expect(wrapper.vm.dataPreFill.userdataid).toBe(selected.id); expect(button().element.disabled).toBe(true); wrapper.unmount()
})

test.each(['zone', 'template'])('%s transition clears selected/prefilled UUID and stale values', async field => {
  const { wrapper, button } = subject({ form: { templateid: 't', userdataid: selected.id, userdata: 'old' }, dataPreFill: { userdataid: selected.id }, userDataSelectionReady: true, userDataValues: { OLD: 'stale' } })
  if (field === 'zone') await wrapper.setData({ zoneId: 'other' })
  else wrapper.vm.form.templateid = 'other'
  await nextTick(); expect(wrapper.vm.form.userdataid).toBeUndefined(); expect(wrapper.vm.form.userdata).toBeUndefined()
  expect(wrapper.vm.dataPreFill.userdataid).toBeUndefined(); expect(wrapper.vm.userDataValues).toEqual({}); expect(button().element.disabled).toBe(false); wrapper.unmount()
})

test('project switch blocks the old form synchronously and after selection cleanup', async () => {
  const { wrapper, getters, button, validate } = subject({ form: { userdataid: selected.id }, userDataSelectionReady: true })
  getters.project = { id: 'other' }; expect(wrapper.vm.vnfDeploymentBlocked).toBe(true)
  wrapper.vm.handleSubmit({ preventDefault: jest.fn() }); expect(validate).not.toHaveBeenCalled()
  await nextTick(); expect(wrapper.vm.form.userdataid).toBeUndefined(); expect(button().element.disabled).toBe(true); wrapper.unmount()
})

test.each(['project', 'template'])('%s change while validation is pending never sends the previous submission', async field => {
  const { wrapper, getters, validate } = subject({ form: { templateid: 't' } }); let finish
  validate.mockImplementation(() => new Promise(resolve => { finish = resolve }))
  wrapper.vm.handleSubmit({ preventDefault: jest.fn() }); expect(validate).toHaveBeenCalledTimes(1)
  if (field === 'project') getters.project = { id: 'other' }
  else wrapper.vm.form.templateid = 'other'
  finish(); await flushPromises(); expect(postAPI).not.toHaveBeenCalled(); wrapper.unmount()
})
