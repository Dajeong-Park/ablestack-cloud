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
import { h, ref, provide } from 'vue'
import Start from '@/views/compute/StartVirtualMachine'
import Edit from '@/views/compute/EditVM'
import directives from '@/utils/directives'
jest.mock('@/api', () => ({ getAPI: jest.fn(), postAPI: jest.fn() }))
const slot = { template: '<div><slot /><slot name="label" /><slot name="message" /></div>' }
const form = { template: '<form><input data-proof="keyboard" /><slot /></form>', methods: { validate: () => Promise.resolve() } }
const input = { template: '<input />' }
const resource = { id: '11111111-1111-4111-8111-111111111111', displayname: '키보드 대상', state: 'Stopped', zoneid: 'zone', templateid: 'template', serviceofferingid: 'offering' }

test.each([['Start', Start], ['Edit', Edit]])('%s submits Ctrl+Enter once when its footer is teleported outside the form', async (name, component) => {
  const submit = jest.fn()
  const tested = { ...component, methods: { ...component.methods, handleSubmit: submit, fetchData: () => {}, fetchPlacement: () => {} }, ...(name === 'Edit' ? { created () { this.groupLookup = { dispose: () => {} }; this.initForm() } } : {}) }
  const host = { setup () { const footer = ref(null); provide('moldDialogFooterTarget', footer); return { footer } }, render () { return h('div', [h(tested, { resource, action: {} }), h('div', { ref: 'footer', class: 'proof-footer' })]) } }
  const wrapper = mount(host, { attachTo: document.body, global: { plugins: [directives], mocks: { $t: k => k, $route: { fullPath: '/vnfapp/' + resource.id, meta: { name: 'vnfapp' } }, $store: { state: { user: { token: 'session' } }, getters: { apis: { startVirtualMachine: {} }, userInfo: { roletype: 'User' }, features: {}, project: {} } }, $getApiParams: () => Object.fromEntries(['displayname', 'ostypeid', 'isdynamicallyscalable', 'haenable', 'group', 'deleteprotection', 'considerlasthost'].map(k => [k, { description: '' }])) }, stubs: { ASpin: slot, AAlert: slot, AForm: form, AFormItem: slot, AInput: input, ASwitch: true, ASelect: slot, AAutoComplete: slot, AButton: { template: '<button><slot /></button>' }, TooltipLabel: true } } })
  await flushPromises()
  expect(wrapper.find('.proof-footer button').exists()).toBe(true)
  const field = wrapper.find('input[data-proof="keyboard"]'); field.element.focus()
  await field.trigger('keydown', { key: 'Enter', keyCode: 13, ctrlKey: true })
  wrapper.find('.proof-footer button').element.focus()
  await wrapper.find('.proof-footer button').trigger('keyup', { key: 'Enter', keyCode: 13, ctrlKey: true })
  expect(submit).toHaveBeenCalledTimes(1)
  await field.trigger('keydown', { key: 'Enter', keyCode: 13, ctrlKey: true, repeat: true })
  await field.trigger('keydown', { key: 'a', keyCode: 65 })
  expect(submit).toHaveBeenCalledTimes(1)
  wrapper.unmount()
})
