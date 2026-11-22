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

/** @jest-environment jsdom */
import { shallowMount } from '@vue/test-utils'
import { postAPI } from '@/api'
import ConfigurationValue from '@/views/setting/ConfigurationValue.vue'

jest.mock('@/api', () => ({ postAPI: jest.fn() }))

const defaultRecord = { name: 'default.ui.page.size', type: 'Number', value: '20', defaultvalue: '20' }
const wrappers = []

function editor (record = defaultRecord, route = { meta: { name: 'globalsetting' } }, resource) {
  const wrapper = shallowMount(ConfigurationValue, {
    props: { configrecord: record, resource },
    global: {
      mocks: {
        $t: key => key,
        $route: route,
        $store: { getters: { apis: { updateConfiguration: {}, resetConfiguration: {} } }, dispatch: jest.fn() },
        $message: { error: jest.fn() },
        $notification: { error: jest.fn() },
        $messageConfigSuccess: jest.fn(),
        $notifyConfigurationValueChange: jest.fn()
      },
      stubs: {
        AList: { template: '<div><slot /></div>' },
        AListItem: { template: '<div><slot /></div>' },
        ATooltip: { template: '<div><slot /></div>' },
        AInputNumber: { template: '<input />' }
      }
    }
  })
  wrappers.push(wrapper)
  return wrapper
}

beforeEach(() => postAPI.mockReset())
afterEach(() => wrappers.splice(0).forEach(wrapper => wrapper.unmount()))

test('restores the baseline on Escape and suppresses the following Enter', async () => {
  const wrapper = editor()
  const input = wrapper.find('input')
  wrapper.vm.editableValue = 21
  await input.trigger('keydown', { key: 'Escape' })
  expect(wrapper.vm.editableValue).toBe(20)
  expect(wrapper.vm.hasChanges).toBe(false)
  await wrapper.vm.updateConfigurationValue(defaultRecord)
  expect(postAPI).not.toHaveBeenCalled()
})

test.each(['Tab', 'ArrowUp', 'ArrowDown', 'Enter', 'Escape'])('keeps %s available in a numeric input', key => {
  const { vm } = editor()
  const preventDefault = jest.fn()
  vm.handleInputNumberKeyDown({ key, preventDefault }, false)
  expect(preventDefault).not.toHaveBeenCalled()
})

test('cancels array edits and recognizes equal ordered lists', () => {
  const { vm } = editor({ ...defaultRecord, type: 'CSV', value: 'one,two' })
  vm.editableValue = ['one', 'two']
  expect(vm.hasChanges).toBe(false)
  vm.editableValue.push('three')
  expect(vm.hasChanges).toBe(true)
  vm.cancelEditConfigurationValue()
  expect(vm.editableValue).toEqual(['one', 'two'])
  expect(vm.hasChanges).toBe(false)
})

test('blocks duplicate writes and updates the baseline from the server', async () => {
  const { vm } = editor()
  let resolve
  postAPI.mockReturnValue(new Promise(done => { resolve = done }))
  vm.editableValue = 21
  const saving = vm.updateConfigurationValue(defaultRecord)
  expect(vm.valueLoading).toBe(true)
  await vm.updateConfigurationValue(defaultRecord)
  expect(postAPI).toHaveBeenCalledTimes(1)
  resolve({ updateconfigurationresponse: { configuration: { ...defaultRecord, value: '21' } } })
  await saving
  expect(vm.actualValue).toBe(21)
  expect(vm.hasChanges).toBe(false)
})

test('restores the confirmed value and reports an error for a rejected update', async () => {
  const { vm } = editor()
  const error = jest.spyOn(console, 'error').mockImplementation(() => {})
  try {
    postAPI.mockRejectedValue({ response: { data: { updateconfigurationresponse: { errortext: 'Rejected' } } } })
    vm.editableValue = 21
    await vm.updateConfigurationValue(defaultRecord)
    expect(vm.editableValue).toBe(20)
    expect(vm.hasChanges).toBe(false)
    expect(vm.$messageConfigSuccess).not.toHaveBeenCalled()
    expect(vm.$notification.error).toHaveBeenCalledWith({ message: 'label.error', description: 'Rejected' })
  } finally {
    error.mockRestore()
  }
})

test('keeps the domain scope for saving and resetting', async () => {
  const record = { ...defaultRecord, value: '25' }
  const { vm } = editor(record, { meta: { name: 'domain' }, params: {} }, { id: 'domain-id' })
  postAPI.mockResolvedValueOnce({ updateconfigurationresponse: { configuration: record } })
  postAPI.mockResolvedValueOnce({ resetconfigurationresponse: { configuration: defaultRecord } })
  vm.editableValue = 26
  await vm.updateConfigurationValue(record)
  expect(postAPI).toHaveBeenNthCalledWith(1, 'updateConfiguration', { domainid: 'domain-id', name: record.name, value: 26 })
  expect(vm.actualValue).toBe(26)
  await vm.resetConfigurationValue(record)
  expect(postAPI).toHaveBeenNthCalledWith(2, 'resetConfiguration', { domainid: 'domain-id', name: record.name })
  expect(vm.actualValue).toBe(20)
})
