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
import LoadBalancing from '@/views/network/LoadBalancing'
import { postAPI } from '@/api'
jest.mock('@/api', () => ({ getAPI: jest.fn(), postAPI: jest.fn() }))

const dialog = {
  props: ['visible'],
  render () { return this.visible ? h('section', { class: 'create-dialog' }, [this.$slots.default?.(), h('footer', this.$slots.footer?.())]) : null }
}
const button = {
  props: ['type', 'disabled', 'loading'],
  render () { return h('button', { class: { 'ant-btn-primary': this.type === 'primary' }, disabled: this.disabled || this.loading }, this.$slots.default?.()) }
}
const component = { ...LoadBalancing, created () { this.initForm() }, methods: { ...LoadBalancing.methods, fetchData: jest.fn(), fetchVirtualMachines: jest.fn(), fetchNetworks: jest.fn() } }
let wrappers
beforeEach(() => {
  jest.clearAllMocks(); wrappers = []
  postAPI.mockResolvedValue({ createloadbalancerruleresponse: { id: 'created-rule', jobid: 'create-job' } })
})
afterEach(() => wrappers.forEach(w => w.unmount()))
async function open (autoscale = 'yes', resource = {}) {
  const getters = reactive({ project: { id: 'project' }, userInfo: { id: 'owner' }, apis: { createLoadBalancerRule: {}, assignToLoadBalancerRule: {}, createAutoScaleVmGroup: {} } })
  const poll = jest.fn().mockResolvedValue({ jobstatus: 1 })
  const w = shallowMount(component, {
    props: { resource: { id: 'public-ip', associatednetworkid: 'network', projectid: 'project', ...resource } },
    global: {
      mocks: { $t: k => k, $getApiParams: () => ({ cidrlist: {}, methodname: {} }), $store: { getters, state: { user: { token: 'session' } } }, $route: reactive({ path: '/publicip/public-ip', meta: { name: 'publicip' } }), $pollJob: poll, $notifyError: jest.fn() },
      provide: { parentFetchData: jest.fn(), parentToggleLoading: jest.fn() },
      stubs: { MoldDialog: dialog, AButton: button, ATable: true, BulkActionView: true }
    }
  })
  wrappers.push(w)
  w.vm.openCreateDialog()
  await w.setData({ loading: false, newRule: { ...w.vm.newRule, name: 'AutoScale rule', publicport: '18876', privateport: '22', autoscale } })
  return { w, getters, poll }
}
const submit = w => w.get('.create-dialog footer button.ant-btn-primary')

test('default manual mode blocks empty targets; AutoScale uses the same enabled footer and creates exactly once', async () => {
  const { w } = await open('no')
  expect(submit(w).attributes('disabled')).toBeDefined()
  w.vm.handleAddNewRule(); expect(postAPI).not.toHaveBeenCalled()
  await w.setData({ newRule: { ...w.vm.newRule, autoscale: 'yes' } })
  expect(submit(w).text()).toBe('label.network.rule.add')
  expect(submit(w).attributes('disabled')).toBeUndefined()
  expect(w.get('.create-dialog a-alert-stub').attributes('message')).toBe('message.network.lb.autoscale.create')
  await submit(w).trigger('click'); await flushPromises()
  expect(postAPI).toHaveBeenCalledTimes(1)
  expect(postAPI).toHaveBeenCalledWith('createLoadBalancerRule', expect.objectContaining({ networkid: 'network', publicipid: 'public-ip', publicport: '18876', privateport: '22' }), { preserveOnFailure: true })
  expect(w.vm.createModalVisible).toBe(false)
})

test('AutoScale ignores hidden incomplete or pending manual NIC selections and never assigns them', async () => {
  const { w } = await open()
  await w.setData({ selectedBackends: { stale: { ips: [] } }, addVmModalNicLoading: true })
  expect(submit(w).attributes('disabled')).toBeUndefined()
  await submit(w).trigger('click'); await flushPromises()
  expect(postAPI.mock.calls.map(([api]) => api)).toEqual(['createLoadBalancerRule'])
})

test('mode round trips discard old targets and require a fresh manual selection', async () => {
  const { w } = await open('no')
  await w.setData({ selectedBackends: { vm: { ips: ['10.0.0.2'] } } })
  expect(submit(w).attributes('disabled')).toBeUndefined()
  await w.setData({ newRule: { ...w.vm.newRule, autoscale: 'yes' } })
  expect(w.vm.selectedBackends).toEqual({})
  await w.setData({ newRule: { ...w.vm.newRule, autoscale: 'no' } })
  expect(submit(w).attributes('disabled')).toBeDefined()
  w.vm.handleAddNewRule(); expect(postAPI).not.toHaveBeenCalled()
})

test('manual connect-later creates a rule without selecting all VMs', async () => {
  const { w } = await open('no'); await w.setData({ targetMode: 'later' })
  await submit(w).trigger('click'); await flushPromises()
  expect(postAPI.mock.calls.map(([api]) => api)).toEqual(['createLoadBalancerRule'])
})

test('manual mode still blocks pending NIC lookup and empty NIC addresses', async () => {
  const { w } = await open('no')
  for (const data of [{ selectedBackends: { vm: { ips: [] } } }, { selectedBackends: { vm: { ips: ['10.0.0.2'] } }, addVmModalNicLoading: true }]) {
    await w.setData(data); expect(submit(w).attributes('disabled')).toBeDefined(); w.vm.handleAddNewRule()
  }
  expect(postAPI).not.toHaveBeenCalled()
})

test('duplicate click and Ctrl+Enter remain blocked until the create job completes', async () => {
  const { w, poll } = await open(); let finish
  poll.mockReturnValue(new Promise(resolve => { finish = resolve }))
  await submit(w).trigger('click'); await flushPromises()
  expect(submit(w).attributes('disabled')).toBeDefined()
  w.vm.handleAddNewRule(); w.vm.handleAddNewRule()
  expect(postAPI).toHaveBeenCalledTimes(1)
  expect(w.vm.createModalVisible).toBe(true)
  finish({ jobstatus: 1 }); await flushPromises()
  expect(w.vm.createModalVisible).toBe(false)
})

test('definitive duplicate-port failure keeps AutoScale draft and enables corrected retry', async () => {
  const { w } = await open()
  postAPI.mockRejectedValueOnce({ response: { data: { errorresponse: { errorcode: 537, errortext: 'Port conflict' } } } })
  await submit(w).trigger('click'); await flushPromises()
  expect(w.vm.createModalVisible).toBe(true)
  expect(w.vm.newRule.autoscale).toBe('yes')
  expect(w.vm.newRule.publicport).toBe('18876')
  expect(submit(w).attributes('disabled')).toBeUndefined()
  w.vm.newRule.publicport = '18877'; await submit(w).trigger('click'); await flushPromises()
  expect(postAPI).toHaveBeenCalledTimes(2)
  expect(w.vm.createModalVisible).toBe(false)
})

test('unknown receipt blocks recreation while an unknown job retries the same job only', async () => {
  const { w, poll } = await open()
  postAPI.mockResolvedValueOnce({ createloadbalancerruleresponse: {} })
  await submit(w).trigger('click'); await flushPromises()
  expect(w.vm.creationUncertain).toBe(true); expect(submit(w).attributes('disabled')).toBeDefined()
  w.vm.handleAddNewRule(); expect(postAPI).toHaveBeenCalledTimes(1)
  await w.setData({ creationFailed: false, creationUncertain: false, creationJob: 'saved-job', selectedRule: { id: 'saved-rule' } })
  poll.mockResolvedValueOnce({ jobstatus: 0, trackingStatus: 'unknown' })
  await submit(w).trigger('click'); await flushPromises()
  expect(w.vm.creationJob).toBe('saved-job'); expect(postAPI).toHaveBeenCalledTimes(1)
})

test('VPC AutoScale requires explicit Tier selection before creating a rule', async () => {
  const { w } = await open('yes', { vpcid: 'vpc', associatednetworkid: undefined })
  expect(submit(w).text()).toBe('label.select.tier')
  await submit(w).trigger('click'); await flushPromises()
  expect(w.vm.addNetworkModalVisible).toBe(true); expect(postAPI).not.toHaveBeenCalled()
  w.vm.selectedTierForAutoScaling = 'chosen-tier'; w.vm.handleAddNewRule(); await flushPromises()
  expect(postAPI).toHaveBeenCalledWith('createLoadBalancerRule', expect.objectContaining({ networkid: 'chosen-tier' }), { preserveOnFailure: true })
})

test('project switch closes old creation and discards late receipts without assigning or changing the new draft', async () => {
  const { w, getters } = await open(); let finish
  postAPI.mockReturnValue(new Promise(resolve => { finish = resolve }))
  await submit(w).trigger('click'); await flushPromises()
  getters.project = { id: 'other-project' }; await flushPromises()
  expect(w.vm.createModalVisible).toBe(false); expect(w.vm.loading).toBe(false)
  await w.setData({ createModalVisible: true, newRule: { ...w.vm.newRule, name: 'Other project' } })
  finish({ createloadbalancerruleresponse: { id: 'old-rule', jobid: 'old-job' } }); await flushPromises()
  expect(w.vm.selectedRule).toBe(null); expect(w.vm.newRule.name).toBe('Other project')
  expect(w.vm.createModalVisible).toBe(true); expect(postAPI).toHaveBeenCalledTimes(1)
})

test('losing create permission closes the old dialog and blocks keyboard submission', async () => {
  const { w, getters } = await open(); delete getters.apis.createLoadBalancerRule; await flushPromises()
  expect(w.vm.createModalVisible).toBe(false)
  expect(w.find('.create-dialog').exists()).toBe(false)
  w.vm.handleAddNewRule(); expect(postAPI).not.toHaveBeenCalled()
})
