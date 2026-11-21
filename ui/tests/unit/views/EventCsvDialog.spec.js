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
import { flushPromises, mount } from '@vue/test-utils'
import { postAPI } from '@/api'
import EventCsvDialog from '@/views/event/EventCsvDialog'

jest.mock('@/api', () => ({ postAPI: jest.fn() }))

const modal = { template: '<section><slot /><footer><slot name="footer" /></footer></section>' }
const button = { props: ['disabled'], template: '<button :disabled="disabled"><slot /></button>' }
const ready = {
  downloadeventsresponse: { success: true, count: 2, filename: 'event.csv', csv: 'id\\r\\nfirst\\r\\nsecond\\r\\n' }
}
let click

function open (ids = ['first', 'second']) {
  return mount(EventCsvDialog, {
    props: { ids, afterClose: jest.fn() },
    global: {
      mocks: { $t: key => key, $message: { success: jest.fn() } },
      stubs: { MoldDialog: modal, 'a-button': button, 'a-alert': true }
    }
  })
}

beforeEach(() => {
  jest.useFakeTimers()
  postAPI.mockReset()
  URL.createObjectURL = jest.fn(() => 'blob:csv')
  URL.revokeObjectURL = jest.fn()
  click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
})

afterEach(() => {
  jest.runOnlyPendingTimers()
  jest.useRealTimers()
  click.mockRestore()
  delete URL.createObjectURL
  delete URL.revokeObjectURL
})

test.each(['click', 'keydown'])('%s sends the same selected IDs and starts exactly one download', async event => {
  postAPI.mockResolvedValue(ready)
  const dialog = open()
  await dialog.findAll('button')[1].trigger(event, { key: 'Enter', ctrlKey: true })
  await flushPromises()
  expect(postAPI).toHaveBeenCalledTimes(1)
  expect(postAPI.mock.calls[0].slice(0, 2)).toEqual(['downloadEvents', { ids: 'first,second' }])
  expect(click).toHaveBeenCalledTimes(1)
  expect(click.mock.instances[0].download).toBe('event.csv')
  expect(dialog.emitted('close')).toHaveLength(1)
  dialog.unmount()
})

test.each([
  [undefined, 'message.events.csv.failed'],
  [{ success: true, count: 0, filename: 'event.csv', csv: 'id' }, 'message.events.csv.empty']
])('an unavailable response keeps the dialog open for retry', async (response, error) => {
  postAPI.mockResolvedValue({ downloadeventsresponse: response })
  const dialog = open()
  await dialog.vm.submit()
  expect(dialog.vm.error).toBe(error)
  expect(dialog.vm.loading).toBe(false)
  expect(click).not.toHaveBeenCalled()
  expect(dialog.emitted('close')).toBeUndefined()
  dialog.unmount()
})

test('empty selection and repeat submission send no extra requests and a canceled reply starts no download', async () => {
  const empty = open([])
  await empty.vm.submit()
  expect(postAPI).not.toHaveBeenCalled()
  empty.unmount()

  let resolvePending
  postAPI.mockReturnValue(new Promise(resolve => { resolvePending = resolve }))
  const dialog = open()
  const pending = dialog.vm.submit()
  await dialog.vm.submit()
  await dialog.findAll('button')[0].trigger('click')
  expect(dialog.emitted('close')).toHaveLength(1)
  dialog.unmount()
  resolvePending(ready)
  await pending
  expect(postAPI).toHaveBeenCalledTimes(1)
  expect(click).not.toHaveBeenCalled()
})

test('a failed API request can be retried with the same selected IDs', async () => {
  postAPI.mockRejectedValueOnce(new Error('Request failed')).mockResolvedValueOnce(ready)
  const dialog = open()
  await dialog.vm.submit()
  expect(dialog.vm.error).toBe('message.events.csv.failed')
  expect(dialog.vm.loading).toBe(false)
  expect(click).not.toHaveBeenCalled()
  await dialog.vm.submit()
  expect(dialog.vm.error).toBe('')
  expect(postAPI.mock.calls.map(call => call[1])).toEqual([{ ids: 'first,second' }, { ids: 'first,second' }])
  expect(click).toHaveBeenCalledTimes(1)
  dialog.unmount()
})
