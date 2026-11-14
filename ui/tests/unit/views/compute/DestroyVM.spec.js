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

import { shallowMount, flushPromises } from '@vue/test-utils'
import DestroyVM from '@/views/compute/DestroyVM.vue'
import { getAPI, postAPI } from '@/api'
jest.mock('@/api', () => ({ getAPI: jest.fn(), postAPI: jest.fn() }))

const selectedItems = [{ id: 'vm-a', name: 'A', state: 'Stopped', deleteprotection: false }, { id: 'vm-b', name: 'B', state: 'Stopped', deleteprotection: false }]
let jobs, refresh, notify
function mount (props = {}) {
  return shallowMount(DestroyVM, {
    props: {
      resource: {},
      selectedRowKeys: ['vm-a', 'vm-b'],
      selectedItems,
      chosenColumns: [{ key: 'name' }],
      action: { currentAction: { label: 'Delete', message: 'Confirm deletion' } },
      ...props
    },
    global: {
      provide: { parentFetchData: refresh },
      directives: { focus: {}, 'ctrl-enter': {} },
      mocks: {
        $t: key => key,
        $getApiParams: () => ({ expunge: { description: 'Expunge' } }),
        $store: { getters: { apis: { expungeVirtualMachine: {}, destroyVirtualMachine: {}, listVirtualMachines: {} }, userInfo: { roletype: 'Admin' }, features: {} } },
        $message: { info: jest.fn() },
        $notifyError: notify,
        $pollJob: options => { jobs.push(options) }
      }
    }
  })
}
beforeEach(() => {
  jest.clearAllMocks()
  jobs = []; refresh = jest.fn(); notify = jest.fn()
  getAPI.mockImplementation((api, params) => Promise.resolve(api === 'listVirtualMachines' ? { listvirtualmachinesresponse: { count: 1, virtualmachine: [{ ...selectedItems.find(row => row.id === params.id) }] } } : { listvolumesresponse: { volume: [] } }))
  postAPI.mockImplementation((api, params) => Promise.resolve({ destroyvirtualmachineresponse: { jobid: params.id } }))
})
test('list removal cannot turn a submitted bulk expunge into a single delete form', async () => {
  const wrapper = mount()
  await flushPromises()
  wrapper.vm.expunge = true
  wrapper.vm.handleSubmit({ preventDefault: jest.fn() })
  await flushPromises()
  await wrapper.setProps({ selectedRowKeys: [], selectedItems: [] })
  jobs.forEach(job => job.successMethod())
  await flushPromises()
  expect(wrapper.vm.operationKeys).toEqual(['vm-a', 'vm-b'])
  expect(wrapper.vm.showGroupActionModal).toBe(true)
  expect(wrapper.findAll('a-form-stub')).toHaveLength(0)
  expect(wrapper.vm.selectedItemsProgress.map(item => item.status)).toEqual(['success', 'success'])
  expect(refresh).toHaveBeenCalledTimes(1)
  wrapper.vm.handleSubmit({ preventDefault: jest.fn() })
  wrapper.vm.destroyGroupVMs()
  expect(postAPI.mock.calls).toEqual([
    ['destroyVirtualMachine', { id: 'vm-a', expunge: true }, { preserveOnFailure: true }],
    ['destroyVirtualMachine', { id: 'vm-b', expunge: true }, { preserveOnFailure: true }]
  ])
  wrapper.vm.handleCancel()
  expect(wrapper.emitted('close-action')).toHaveLength(1)
  expect(wrapper.emitted('cancel-bulk-action')).toHaveLength(1)
  expect(wrapper.vm.actionClosed).toBe(true)
  wrapper.unmount()
})
test('partial async failure settles without a form validation exception', async () => {
  const wrapper = mount()
  await flushPromises()
  wrapper.vm.destroyGroupVMs()
  await flushPromises()
  jobs[0].successMethod()
  jobs[1].errorMethod()
  await flushPromises()
  expect(wrapper.vm.loading).toBe(false)
  expect(wrapper.vm.selectedItemsProgress.map(item => item.status)).toEqual(['success', 'failed'])
  expect(refresh).toHaveBeenCalledTimes(1)
  wrapper.unmount()
})
test('API rejection is settled and all other jobs can finish', async () => {
  postAPI.mockRejectedValueOnce({ response: { status: 431, data: { errorresponse: { errorcode: 431, errortext: 'request rejected' } } } })
  const wrapper = mount()
  await flushPromises()
  wrapper.vm.destroyGroupVMs()
  await flushPromises()
  jobs[0].successMethod()
  await flushPromises()
  expect(wrapper.vm.loading).toBe(false)
  expect(wrapper.vm.selectedItemsProgress.map(item => item.status)).toEqual(['failed', 'success'])
  expect(notify).toHaveBeenCalledTimes(1)
  wrapper.unmount()
})
test('closing pending work never refreshes or resubmits the old operation', async () => {
  const wrapper = mount()
  await flushPromises()
  wrapper.vm.destroyGroupVMs()
  await flushPromises()
  wrapper.vm.handleCancel()
  jobs.forEach(job => job.successMethod())
  await flushPromises()
  wrapper.vm.handleSubmit()
  expect(refresh).not.toHaveBeenCalled()
  expect(postAPI).toHaveBeenCalledTimes(2)
  wrapper.unmount()
})
test('a fresh operation starts with expunge disabled and current targets', async () => {
  const wrapper = mount()
  await flushPromises()
  expect(wrapper.vm.expunge).toBe(false)
  expect(wrapper.vm.operationStarted).toBe(false)
  wrapper.vm.destroyGroupVMs()
  await flushPromises()
  expect(postAPI.mock.calls.every(([, params]) => !('expunge' in params))).toBe(true)
  jobs.forEach(job => job.successMethod())
  await flushPromises()
  wrapper.unmount()
})

const vmResponse = row => ({ listvirtualmachinesresponse: { count: 1, virtualmachine: [row] } })
test('a protection race in a mixed batch prevents every POST and requires explicit exclusion', async () => {
  const wrapper = mount()
  await flushPromises()
  getAPI.mockImplementation((api, params) => Promise.resolve(vmResponse({ ...selectedItems.find(row => row.id === params.id), deleteprotection: params.id === 'vm-b' })))
  await wrapper.vm.handleSubmit()
  expect(postAPI).not.toHaveBeenCalled()
  expect(wrapper.vm.guardRows[1].reason).toBe('message.vm.delete.protected')
  expect(wrapper.vm.operationKeys).toEqual(['vm-a', 'vm-b'])
  wrapper.vm.excludeTarget('vm-b')
  wrapper.vm.handleSubmit()
  await flushPromises()
  expect(postAPI).toHaveBeenCalledTimes(1)
  expect(postAPI.mock.calls[0][1].id).toBe('vm-a')
  jobs[0].successMethod()
  await flushPromises()
  wrapper.unmount()
})
test.each(['missing protection', 'wrong UUID', 'read failure'])('%s blocks the entire batch until a successful explicit recheck', async kind => {
  const wrapper = mount()
  await flushPromises()
  getAPI.mockImplementation(() => kind === 'read failure' ? Promise.reject(new Error('offline')) : Promise.resolve(vmResponse(kind === 'wrong UUID' ? { ...selectedItems[0], id: 'other' } : { id: 'vm-a', state: 'Stopped' })))
  await wrapper.vm.handleSubmit()
  expect(postAPI).not.toHaveBeenCalled()
  expect(wrapper.vm.canSubmit).toBe(false)
  wrapper.unmount()
})
test('changing login, project, or route while fresh reads are pending discards all late responses', async () => {
  const wrapper = mount()
  await flushPromises()
  let release
  getAPI.mockImplementation(() => new Promise(resolve => { release = resolve }))
  wrapper.vm.handleSubmit()
  await flushPromises()
  wrapper.vm.originScope = 'expired context'
  release(vmResponse(selectedItems[1]))
  await flushPromises()
  expect(postAPI).not.toHaveBeenCalled()
  wrapper.unmount()
})
test('closing during preflight never sends a deletion after the read resolves', async () => {
  const wrapper = mount()
  await flushPromises()
  const pending = []
  getAPI.mockImplementation(() => new Promise(resolve => pending.push(resolve)))
  wrapper.vm.handleSubmit()
  await flushPromises()
  wrapper.vm.closeAction()
  pending.forEach((resolve, index) => resolve(vmResponse(selectedItems[index])))
  await flushPromises()
  expect(postAPI).not.toHaveBeenCalled()
  wrapper.unmount()
})
test('a server protection rejection refreshes protection without replaying any accepted request', async () => {
  const wrapper = mount()
  await flushPromises()
  wrapper.vm.handleSubmit()
  await flushPromises()
  getAPI.mockImplementation((api, params) => Promise.resolve(vmResponse({ ...selectedItems.find(row => row.id === params.id), deleteprotection: true })))
  jobs[0].errorMethod()
  jobs[1].successMethod()
  await flushPromises()
  expect(wrapper.vm.guardRows[0].record.deleteprotection).toBe(true)
  expect(wrapper.vm.selectedItemsProgress.map(row => row.status)).toEqual(['failed', 'success'])
  wrapper.vm.handleSubmit()
  expect(postAPI).toHaveBeenCalledTimes(2)
  wrapper.unmount()
})
test('an interrupted job remains unknown and cannot be resubmitted', async () => {
  const wrapper = mount()
  await flushPromises()
  wrapper.vm.handleSubmit()
  await flushPromises()
  jobs[0].catchMethod()
  jobs[1].successMethod()
  await flushPromises()
  expect(wrapper.vm.selectedItemsProgress[0].status).toBe('unknown')
  wrapper.vm.handleSubmit()
  expect(postAPI).toHaveBeenCalledTimes(2)
  wrapper.unmount()
})

test('permanent deletion uses the same fresh guard and only the expunge endpoint', async () => {
  const target = { ...selectedItems[0], state: 'Destroyed' }
  getAPI.mockImplementation(() => Promise.resolve(vmResponse(target)))
  postAPI.mockResolvedValue({ expungevirtualmachineresponse: { jobid: 'expunge-job' } })
  const wrapper = mount({ resource: target, selectedRowKeys: [], selectedItems: [], action: { currentAction: { api: 'expungeVirtualMachine', label: 'Expunge' } } })
  await flushPromises()
  wrapper.vm.formRef = { value: { validate: () => Promise.resolve() } }
  wrapper.vm.handleSubmit()
  await flushPromises()
  expect(postAPI.mock.calls).toEqual([['expungeVirtualMachine', { id: target.id }, { preserveOnFailure: true }]])
  jobs[0].successMethod()
  await flushPromises()
  expect(wrapper.emitted('close-action')).toHaveLength(1)
  wrapper.unmount()
})

test('a lost POST response is indeterminate and is never automatically replayed', async () => {
  postAPI.mockRejectedValueOnce(new Error('Network Error'))
  const wrapper = mount()
  await flushPromises()
  wrapper.vm.handleSubmit()
  await flushPromises()
  jobs[0].successMethod()
  await flushPromises()
  expect(wrapper.vm.selectedItemsProgress.map(row => row.status)).toEqual(['unknown', 'success'])
  expect(wrapper.vm.selectedItemsProgress[0].deletionreason).toBe('message.vm.delete.request.failed')
  wrapper.vm.handleSubmit()
  expect(postAPI).toHaveBeenCalledTimes(2)
  wrapper.unmount()
})
