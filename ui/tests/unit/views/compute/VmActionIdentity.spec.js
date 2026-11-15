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
test.each(['start', 'scale', 'migrate'])('%s keeps the submitted display label after the resource pointer changes', async kind => {
  let finish
  postAPI.mockReset(); postAPI.mockReturnValue(new Promise(resolve => { finish = resolve }))
  const c = { resource: { id: 'a', name: 'guest-host', displayname: '보낸 대상' }, loading: false, form: {}, formRef: { value: { validate: () => Promise.resolve() } }, $t: k => k, $pollJob: jest.fn(), closeAction: jest.fn(), closeModal: jest.fn(), $emit: jest.fn(), parentFetchData: jest.fn(), $notifyError: jest.fn(), selectedOffering: {}, params: { id: 'a' }, isUserVm: true, selectedHost: { id: 'host' }, requiresStorageMigration: () => false }
  if (kind === 'start') Start.methods.handleSubmit.call(c, { preventDefault: jest.fn() })
  if (kind === 'scale') Scale.methods.handleSubmit.call(c)
  if (kind === 'migrate') Migrate.methods.submitForm.call(c)
  await flushPromises(); expect(postAPI).toHaveBeenCalledTimes(1)
  const [api, params] = postAPI.mock.calls[0]; expect(params.id || params.virtualmachineid).toBe('a')
  c.resource = { id: 'b', name: 'wrong-host', displayname: '다른 대상' }
  finish({ [api.toLowerCase() + 'response']: { jobid: 'job-a' } }); await flushPromises()
  expect(c.$pollJob.mock.calls[0][0].description).toBe('보낸 대상')
  expect(JSON.stringify(c.$pollJob.mock.calls[0][0])).not.toContain('다른 대상')
})
