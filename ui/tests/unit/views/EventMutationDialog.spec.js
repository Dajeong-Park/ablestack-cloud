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
import eventSection from '@/config/section/event'
import EventMutationDialog from '@/views/event/EventMutationDialog'
import { canMutateEvents, eventMutationError } from '@/utils/eventActions'

jest.mock('@/api', () => ({ postAPI: jest.fn() }))
jest.mock('@/store', () => ({ getters: { apis: { downloadEvents: { response: [{ name: 'csv' }] } } } }))

const active = [{ id: 'first', type: 'ACCOUNT.CREATE' }, { id: 'second', type: 'USER.LOGIN' }]
const archived = [{ id: 'old', archived: true }]
const allowed = { apis: { archiveEvents: {}, deleteEvents: {} }, features: { eventdeleteenabled: true } }
const modal = { template: '<section><slot /><footer><slot name="footer" /></footer></section>' }
const button = { props: ['disabled'], template: '<button :disabled="disabled"><slot /></button>' }

function open (api = 'deleteEvents') {
  return mount(EventMutationDialog, {
    props: { api, targets: active, afterClose: jest.fn() },
    global: {
      mocks: { $t: key => key, $message: { success: jest.fn() } },
      stubs: { MoldDialog: modal, 'a-button': button, 'a-alert': true }
    }
  })
}

beforeEach(() => postAPI.mockReset())

test.each(['archiveEvents', 'deleteEvents'])('%s requires an explicit selection of permitted active rows', api => {
  expect(canMutateEvents(api, [], allowed)).toBe(false)
  expect(canMutateEvents(api, active.slice(0, 1), allowed)).toBe(true)
  expect(canMutateEvents(api, active, allowed)).toBe(true)
  expect(canMutateEvents(api, [...active, ...archived], allowed)).toBe(false)
  expect(canMutateEvents(api, archived, allowed)).toBe(false)
  expect(canMutateEvents(api, active, { ...allowed, apis: {} })).toBe(false)
})

test('the deletion capability does not affect archive availability', () => {
  const disabled = { ...allowed, features: { eventdeleteenabled: false } }
  expect(canMutateEvents('archiveEvents', active, disabled)).toBe(true)
  expect(canMutateEvents('deleteEvents', active, disabled)).toBe(false)
})

test.each(['archiveEvents', 'deleteEvents'])('%s submits the frozen IDs only once during a pending request', async api => {
  let complete
  postAPI.mockReturnValue(new Promise(resolve => { complete = resolve }))
  const dialog = open(api)
  const pending = dialog.vm.submit()
  await dialog.vm.submit()
  expect(postAPI).toHaveBeenCalledTimes(1)
  expect(postAPI.mock.calls[0].slice(0, 2)).toEqual([api, { ids: 'first,second' }])
  complete({ [api.toLowerCase() + 'response']: { success: true } })
  await pending
  expect(dialog.emitted('completed')).toHaveLength(1)
  dialog.unmount()
})

test('an archived target requires a fresh read before retry', async () => {
  postAPI.mockRejectedValue({ response: { data: { deleteeventsresponse: { errortext: 'Archived events cannot be deleted.' } } } })
  const dialog = open()
  await dialog.vm.submit()
  await dialog.vm.submit()
  expect(dialog.vm.error).toBe('message.events.action.archived')
  expect(postAPI).toHaveBeenCalledTimes(1)
  expect(dialog.emitted('completed')).toBeUndefined()
  await dialog.findAll('button')[1].trigger('click')
  expect(dialog.emitted('refresh')).toHaveLength(1)
  dialog.unmount()
})

test('cancel sends no request and a late reply cannot report completion on another view', async () => {
  const cancel = open()
  await cancel.findAll('button')[0].trigger('click')
  expect(cancel.emitted('close')).toHaveLength(1)
  expect(postAPI).not.toHaveBeenCalled()
  cancel.unmount()

  let complete
  postAPI.mockReturnValue(new Promise(resolve => { complete = resolve }))
  const dialog = open('archiveEvents')
  const pending = dialog.vm.submit()
  dialog.unmount()
  complete({ archiveeventsresponse: { success: true } })
  await pending
  await flushPromises()
  expect(dialog.emitted('completed')).toBeUndefined()
})

test('notifies a distinct global deletion policy error', () => {
  const error = { response: { data: { errorresponse: { errortext: 'Event deletion is disabled.' } } } }
  expect(eventMutationError(error)).toBe('message.events.action.delete.disabled')
})

test('archive, CSV and delete expose explicit toolbar labels and apply archive policy to details and bulk actions', () => {
  const [archive, csv, remove] = eventSection.actions
  expect(eventSection.actions.map(action => action.toolbarLabel)).toEqual([
    'label.archive.events', 'label.download.csv', 'label.delete.events'
  ])
  expect(archive.groupShow(active, allowed)).toBe(true)
  expect(archive.groupShow(archived, allowed)).toBe(false)
  expect(csv.groupShow(archived, allowed)).toBe(true)
  expect(remove.show(active[0], allowed)).toBe(true)
  expect(remove.show(archived[0], allowed)).toBe(false)
  expect(remove.groupShow([...active, ...archived], allowed)).toBe(false)
})
