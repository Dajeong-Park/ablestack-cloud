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

import LoadBalancing from '@/views/network/LoadBalancing'
import { getAPI } from '@/api'
jest.mock('@/api', () => ({ getAPI: jest.fn(), postAPI: jest.fn() }))
const capability = { listnetworksresponse: { network: [{ id: 'network', service: [{ name: 'Lb', provider: [{ name: 'VirtualRouter' }], capability: [{ name: 'SupportedStickinessMethods', value: '[{"methodname":"AppCookie","paramlist":[{"paramname":"length"}]}]' }] }] }] } }
const vm = () => ({ stickinessLookupVersion: 0, networkMutationScope: 'project-a', stickinessModalVisible: true, resource: { projectid: 'project-a' }, lbRules: [{ id: 'lb', networkid: 'network' }] })
beforeEach(() => jest.clearAllMocks())
test('reads capabilities from the selected rule network with explicit project scope', async () => {
  const target = vm(); getAPI.mockResolvedValue(capability)
  await LoadBalancing.methods.fetchStickinessContract.call(target, 'lb')
  expect(getAPI).toHaveBeenCalledWith('listNetworks', expect.objectContaining({ id: 'network', projectid: 'project-a', ignoreproject: true }), { preserveOnFailure: true })
  expect(target.stickinessContract).toEqual({ available: true, exact: true, params: ['length'] })
  expect(target.stickinessLookupLoading).toBe(false)
})
test.each(['project', 'close', 'retry'])('ignores late metadata after %s changes', async change => {
  let finish; getAPI.mockImplementation(() => new Promise(resolve => { finish = resolve }))
  const target = vm(); const request = LoadBalancing.methods.fetchStickinessContract.call(target, 'lb')
  if (change === 'project') target.networkMutationScope = 'project-b'
  if (change === 'close') target.stickinessModalVisible = false
  if (change === 'retry') target.stickinessLookupVersion++
  finish(capability); await request
  expect(target.stickinessContract).toBeNull()
})
test('lookup failure blocks saving and exposes retry state', async () => {
  getAPI.mockRejectedValue(new Error('controlled unavailable')); const target = vm()
  await LoadBalancing.methods.fetchStickinessContract.call(target, 'lb')
  expect(target.stickinessLookupError).toBe(true); expect(target.stickinessContract).toBeNull()
  const submit = { ...target, stickinessModalLoading: false, formRef: { value: { validate: jest.fn() } } }
  LoadBalancing.methods.handleSubmitStickinessForm.call(submit, { preventDefault: jest.fn() })
  expect(submit.formRef.value.validate).not.toHaveBeenCalled()
})
