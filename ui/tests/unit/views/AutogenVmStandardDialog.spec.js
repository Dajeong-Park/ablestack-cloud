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
import Autogen from '@/views/AutogenView'
import { flushPromises } from '@vue/test-utils'
jest.mock('@/api', () => ({ getAPI: jest.fn(), callAPI: jest.fn(), postAPI: jest.fn() }))
jest.mock('@/store', () => ({ getters: {}, state: { user: { token: 'session' } } }))
const id = '11111111-1111-4111-8111-111111111111'
let c
beforeEach(() => {
  c = { $route: { name: 'vnfapp-detail', meta: { name: 'vnfapp' }, fullPath: '/vnfapp/' + id, path: '/vnfapp/' + id, params: { id }, query: {} }, $store: { state: { user: { token: 'session' } }, getters: { userInfo: { id: 'actor', roletype: 'Admin' }, apis: { stopVirtualMachine: {} }, project: {} } }, $t: key => key, $notifyError: jest.fn(), $router: { go: jest.fn() }, $message: { info: jest.fn() } }
  Object.assign(c, Autogen.data.call(c)); Object.entries(Autogen.methods).forEach(([key, fn]) => { c[key] = fn.bind(c) })
  c.resource = { id, name: 'host', displayname: '한글 대상', state: 'Running', templatetype: 'VNF' }
  c.formRef = { value: { validate: jest.fn().mockResolvedValue(), scrollToField: jest.fn() } }; c.form = { forced: false }; c.dataView = true; c.showAction = true; c.isSubmitDisabled = false
  c.currentAction = { api: 'stopVirtualMachine', label: 'label.stop', params: [{ name: 'id' }, { name: 'forced', type: 'boolean' }], paramFields: [{ name: 'forced', type: 'boolean' }] }
  Object.defineProperty(c, 'vmStandardDialog', { get: () => Autogen.computed.vmStandardDialog.call(c) })
  c.postSnapshotAwareAction = jest.fn().mockResolvedValue({ stopvirtualmachineresponse: { jobid: 'job' } }); c.handleResponse = jest.fn().mockResolvedValue('job'); c.closeAction = jest.fn(); c.fetchData = jest.fn()
})
test('VM and VNF use the existing shared standard dialog without changing unrelated routes', () => {
  expect(c.vmStandardDialog).toBe(true); c.$route.meta.name = 'vm'; expect(c.vmStandardDialog).toBe(true)
  c.$route.meta.name = 'guestnetwork'; expect(c.vmStandardDialog).toBe(false)
})
test('common confirmation click and Enter do not duplicate a request while validation is pending', async () => {
  let done; c.formRef.value.validate.mockReturnValue(new Promise(resolve => { done = resolve }))
  c.handleSubmit({ preventDefault: jest.fn() }); c.handleSubmit({ preventDefault: jest.fn() }); expect(c.formRef.value.validate).toHaveBeenCalledTimes(1)
  done(); await flushPromises(); expect(c.postSnapshotAwareAction).toHaveBeenCalledTimes(1)
  expect(c.postSnapshotAwareAction).toHaveBeenCalledWith(c.currentAction, { id, forced: false })
})
test.each(['target', 'token', 'project', 'role'])('a %s switch during validation cannot submit a different resource', async kind => {
  let done; c.formRef.value.validate.mockReturnValue(new Promise(resolve => { done = resolve })); c.execSubmit({ preventDefault: jest.fn() })
  if (kind === 'target') c.resource = { ...c.resource, id: 'other' }
  if (kind === 'token') c.$store.state.user.token = 'next'
  if (kind === 'project') c.$store.getters.project = { id: 'other' }
  if (kind === 'role') c.$store.getters.userInfo.roletype = 'User'
  done(); await flushPromises(); expect(c.postSnapshotAwareAction).not.toHaveBeenCalled()
})
test('an old accepted response cannot close or update the next target dialog', async () => {
  let done; c.postSnapshotAwareAction.mockReturnValue(new Promise(resolve => { done = resolve })); c.execSubmit({ preventDefault: jest.fn() }); await flushPromises(); expect(c.postSnapshotAwareAction).toHaveBeenCalledTimes(1)
  c.resource = { ...c.resource, id: 'other' }; c.currentAction = { ...c.currentAction }; done({ stopvirtualmachineresponse: { jobid: 'old' } }); await flushPromises()
  expect(c.handleResponse).not.toHaveBeenCalled(); expect(c.closeAction).not.toHaveBeenCalled()
})
