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
import Start from '@/views/compute/StartVirtualMachine'
import Scale from '@/views/compute/ScaleVM'
import Migrate from '@/views/compute/MigrateWizard'
import { postAPI } from '@/api'
jest.mock('@/api', () => ({ postAPI: jest.fn(), getAPI: jest.fn() }))
test.each(['scale', 'migrate'])('%s keeps the submitted display label after the resource pointer changes', async kind => {
  let finish
  postAPI.mockReset(); postAPI.mockReturnValue(new Promise(resolve => { finish = resolve }))
  const c = { resource: { id: 'a', name: 'guest-host', displayname: '보낸 대상' }, loading: false, form: {}, formRef: { value: { validate: () => Promise.resolve() } }, $t: k => k, $pollJob: jest.fn(), closeAction: jest.fn(), closeModal: jest.fn(), $emit: jest.fn(), parentFetchData: jest.fn(), $notifyError: jest.fn(), selectedOffering: {}, params: { id: 'a' }, isUserVm: true, selectedHost: { id: 'host' }, requiresStorageMigration: () => false }
  if (kind === 'scale') Scale.methods.handleSubmit.call(c)
  if (kind === 'migrate') Migrate.methods.submitForm.call(c)
  await flushPromises(); expect(postAPI).toHaveBeenCalledTimes(1)
  const [api, params] = postAPI.mock.calls[0]; expect(params.id || params.virtualmachineid).toBe('a')
  c.resource = { id: 'b', name: 'wrong-host', displayname: '다른 대상' }
  finish({ [api.toLowerCase() + 'response']: { jobid: 'job-a' } }); await flushPromises()
  expect(c.$pollJob.mock.calls[0][0].description).toBe('보낸 대상')
  expect(JSON.stringify(c.$pollJob.mock.calls[0][0])).not.toContain('다른 대상')
})

test.each(['refresh', 'target'])('start keeps its submitted identity on %s without leaking an old receipt to a new target', async change => {
  let finish
  postAPI.mockReset(); postAPI.mockReturnValue(new Promise(resolve => { finish = resolve }))
  const c = {
    resource: { id: 'a', name: 'guest-host', displayname: '보낸 대상', state: 'Stopped', zoneid: 'zone' },
    action: {},
    $route: { fullPath: '/vm/a', meta: { name: 'vm' } },
    $store: { state: { user: { token: 'session' } }, getters: { userInfo: { id: 'actor', roletype: 'User' }, apis: { startVirtualMachine: {} } } },
    $getApiParams: () => ({}),
    $refs: { startForm: { validate: () => Promise.resolve() } },
    $t: k => k,
    $pollJob: jest.fn(),
    $emit: jest.fn()
  }
  Object.assign(c, Start.data.call(c))
  Object.entries(Start.methods).forEach(([key, fn]) => { c[key] = fn.bind(c) })
  Object.entries(Start.computed).forEach(([key, fn]) => Object.defineProperty(c, key, { get: () => fn.call(c) }))
  c.fetchPlacement = jest.fn(); c.initForm()
  const pending = c.handleSubmit({ preventDefault: jest.fn() })
  await flushPromises()
  expect(postAPI).toHaveBeenCalledTimes(1)
  expect(postAPI).toHaveBeenCalledWith('startVirtualMachine', { id: 'a' })
  c.resource = { ...c.resource, id: change === 'target' ? 'b' : 'a', displayname: '다른 대상' }
  finish({ startvirtualmachineresponse: { jobid: 'job-a' } }); await pending
  if (change === 'target') {
    expect(c.$pollJob).not.toHaveBeenCalled(); expect(c.$emit).not.toHaveBeenCalled()
  } else {
    expect(c.$pollJob).toHaveBeenCalledWith(expect.objectContaining({ jobId: 'job-a', resourceId: 'a', description: '보낸 대상' }))
    expect(JSON.stringify(c.$pollJob.mock.calls[0][0])).not.toContain('다른 대상')
  }
})
