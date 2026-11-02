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
import { mount, flushPromises } from '@vue/test-utils'
import { h, reactive } from 'vue'
import MoldDialog from '@/components/view/MoldDialog'
import EditObjectStorage from '@/views/infra/EditObjectStorage'
import { postAPI } from '@/api'
jest.mock('@/api', () => ({ postAPI: jest.fn() }))

// Keep the real form and footer transport: an in-body button stub cannot catch
// dropped submit handlers or a busy close path after a Teleport.
const modal = { name: 'AModal', props: ['closable', 'keyboard'], emits: ['cancel'], template: '<section><header><slot name="title" /></header><main><slot /></main><footer><slot name="footer" /></footer></section>' }
test('footer submits the real object-store form, retains a failed draft and blocks closing while busy', async () => {
  const store = reactive({ getters: { userInfo: { id: 'admin', roletype: 'Admin' }, apis: { updateObjectStoragePool: {} }, project: {} }, state: { user: { token: 'session' } } })
  const refresh = jest.fn()
  const wrapper = mount(MoldDialog, {
    attachTo: document.body,
    props: { size: 'md', formActions: true, title: 'Object store' },
    slots: { default: () => h(EditObjectStorage, { resource: { id: 'store', name: 'before', url: 'http://glue:3333', storagetotalbytes: '21474836480', storageallocatedbytes: '0', storagereservedbytes: '0' } }) },
    global: { stubs: { AModal: modal }, provide: { parentFetchData: refresh }, mocks: { $store: store, $route: { path: '/objectstore/store' }, $t: key => key, $notification: { success: jest.fn() } } }
  })
  await flushPromises()
  expect(wrapper.find('main button').exists()).toBe(false)
  const save = () => wrapper.findAll('footer button').find(button => button.text() === 'label.save')
  await wrapper.get('#store-edit-name').setValue('draft')
  let rejectRequest
  postAPI.mockImplementationOnce(() => new Promise((resolve, reject) => { rejectRequest = reject }))
  await save().trigger('click'); await flushPromises()
  expect(postAPI).toHaveBeenCalledWith('updateObjectStoragePool', { id: 'store', name: 'draft' }, expect.any(Object))
  expect(wrapper.findComponent(modal).props('closable')).toBe(false)
  expect(wrapper.findComponent(modal).props('keyboard')).toBe(false)
  wrapper.findComponent(modal).vm.$emit('cancel')
  expect(wrapper.emitted('cancel')).toBeUndefined()
  rejectRequest(new Error('offline')); await flushPromises()
  expect(wrapper.get('#store-edit-name').element.value).toBe('draft')
  expect(wrapper.findComponent(modal).props('closable')).toBe(true)
  postAPI.mockResolvedValueOnce({}); await save().trigger('click'); await flushPromises()
  expect(refresh).toHaveBeenCalledTimes(1)
  wrapper.unmount()
  expect(document.querySelector('.mold-dialog-actions')).toBeNull()
})
