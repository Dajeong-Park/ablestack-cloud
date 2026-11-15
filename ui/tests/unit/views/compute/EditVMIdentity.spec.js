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

import { flushPromises } from '@vue/test-utils'
import EditVM from '@/views/compute/EditVM'
import { postAPI } from '@/api'
import { vmEditScope } from '@/utils/vmIdentity'
jest.mock('@/api', () => ({ postAPI: jest.fn(), getAPI: jest.fn() }))
const deferred = () => { let done; let failed; const promise = new Promise((resolve, reject) => { done = resolve; failed = reject }); return { promise, resolve: done, reject: failed } }
function context () {
  const c = {
    resource: { id: 'a', name: 'guest-host', displayname: 'Old', instancename: 'i-2-1-VM', account: 'owner', domainid: 'domain' },
    $route: { fullPath: '/vnfapp/a' },
    $store: { getters: { apis: { updateVirtualMachine: {} }, userInfo: { id: 'user' }, project: {} }, state: { user: { token: 'session' } } },
    form: { name: 'guest-host', displayname: '새 표시명' },
    initialForm: { displayname: 'Old' },
    formRef: { value: { validate: jest.fn().mockResolvedValue(), scrollToField: jest.fn() } },
    loading: false,
    submitPending: false,
    editActive: true,
    editGeneration: 0,
    metadataGeneration: 0,
    groupLookupReady: true,
    groups: { opts: [] },
    apiParams: {},
    dynamicScalingEditable: false,
    offeringStatus: 'ready',
    combinedExtraConfig: '',
    $t: k => k,
    $message: { success: jest.fn(), error: jest.fn() },
    $emit: jest.fn(),
    $notifyError: jest.fn()
  }
  Object.defineProperty(c, 'resourceContextKey', { get: () => vmEditScope(c.resource, c.$route, c.$store) })
  c.initialResourceContextKey = c.resourceContextKey
  c.invalidateEdit = () => EditVM.methods.invalidateEdit.call(c)
  c.onCloseAction = () => EditVM.methods.onCloseAction.call(c)
  return c
}
beforeEach(() => { postAPI.mockReset(); postAPI.mockResolvedValue({ updatevirtualmachineresponse: { virtualmachine: { id: 'a', displayname: '서버 표시명' } } }) })
test('renames only displayname and announces the saved server label', async () => {
  const c = context(); await EditVM.methods.handleSubmit.call(c)
  expect(postAPI).toHaveBeenCalledWith('updateVirtualMachine', { id: 'a', displayname: '새 표시명', ostypeid: undefined })
  expect(postAPI.mock.calls[0][1]).not.toHaveProperty('name'); expect(postAPI.mock.calls[0][1]).not.toHaveProperty('instancename')
  expect(c.$message.success.mock.calls[0][0].content).toContain('서버 표시명')
  expect(c.$emit.mock.calls).toEqual([['refresh-data'], ['close-action']])
  expect(c.resource.name).toBe('guest-host')
})
test('validation and POST are locked against rapid repeated submits', async () => {
  const c = context(); const pending = deferred(); c.formRef.value.validate.mockReturnValue(pending.promise)
  const first = EditVM.methods.handleSubmit.call(c); EditVM.methods.handleSubmit.call(c)
  pending.resolve(); await first; expect(postAPI).toHaveBeenCalledTimes(1)
})
test.each(['route', 'target', 'project', 'token', 'actor', 'permission'])('does not POST after %s changes during validation', async change => {
  const c = context(); const pending = deferred(); c.formRef.value.validate.mockReturnValue(pending.promise)
  const result = EditVM.methods.handleSubmit.call(c)
  if (change === 'route') c.$route.fullPath = '/vnfapp/b'
  if (change === 'target') c.resource.id = 'b'
  if (change === 'project') c.$store.getters.project = { id: 'other' }
  if (change === 'token') c.$store.state.user.token = 'other'
  if (change === 'actor') c.$store.getters.userInfo.id = 'other'
  if (change === 'permission') c.$store.getters.apis = {}
  pending.resolve(); await result; expect(postAPI).not.toHaveBeenCalled(); expect(c.$emit).not.toHaveBeenCalled()
})
test.each(['route', 'close', 'deactivate'])('late accepted edit after %s cannot close/refresh a new screen', async change => {
  const c = context(); const pending = deferred(); postAPI.mockReturnValue(pending.promise)
  const result = EditVM.methods.handleSubmit.call(c); await flushPromises(); expect(postAPI).toHaveBeenCalledTimes(1)
  if (change === 'route') c.$route.fullPath = '/vnfapp/b'
  if (change === 'close') c.onCloseAction()
  if (change === 'deactivate') EditVM.deactivated.call(c)
  c.$emit.mockClear(); pending.resolve({ updatevirtualmachineresponse: { virtualmachine: { id: 'a', displayname: 'Late A' } } }); await result
  expect(c.$emit).not.toHaveBeenCalled(); expect(c.$message.success).not.toHaveBeenCalled()
})
test('failed update retains the user input and allows explicit retry', async () => {
  const c = context(); postAPI.mockRejectedValueOnce(new Error('denied')); await EditVM.methods.handleSubmit.call(c)
  expect(c.form.displayname).toBe('새 표시명'); expect(c.resource.displayname).toBe('Old')
  expect(c.$emit).not.toHaveBeenCalled(); expect(c.$notifyError).toHaveBeenCalledTimes(1); expect(c.loading || c.submitPending).toBe(false)
  await EditVM.methods.handleSubmit.call(c); expect(postAPI).toHaveBeenCalledTimes(2)
})
test('closing before validation completes sends nothing', async () => {
  const c = context(); const pending = deferred(); c.formRef.value.validate.mockReturnValue(pending.promise)
  const result = EditVM.methods.handleSubmit.call(c); c.onCloseAction(); pending.resolve(); await result
  expect(postAPI).not.toHaveBeenCalled()
})
