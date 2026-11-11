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

import Dialog from '@/components/network/LoadBalancerStickinessDialog'
const capability = { id: 'network', service: [{ name: 'Lb', provider: [{ name: 'VirtualRouter' }], capability: [{ name: 'SupportedStickinessMethods', value: '[{"methodname":"AppCookie","paramlist":[{"paramname":"length"}]}]' }] }] }
const vm = () => ({ readVersion: 0, suspended: false, visible: true, networkMutationDisposed: false, networkMutationScope: 'project-a', canRead: true, initialized: true, readContext: jest.fn(), currentRead: Dialog.methods.currentRead, form: { name: 'draft' } })

test.each(['project', 'close', 'retry'])('ignores late metadata after %s changes', async change => {
  let finish; const target = vm(); target.readContext.mockImplementation(() => new Promise(resolve => { finish = resolve }))
  const request = Dialog.methods.refresh.call(target)
  if (change === 'project') target.networkMutationScope = 'project-b'
  if (change === 'close') target.visible = false
  if (change === 'retry') target.readVersion++
  finish({ network: capability, policy: null }); await request
  expect(target.stickinessContract).toBeUndefined(); expect(target.form.name).toBe('draft')
})

test('lookup failure blocks saving while a retry preserves the draft', async () => {
  const target = vm(); target.readContext.mockRejectedValueOnce(new Error('controlled unavailable'))
  await Dialog.methods.refresh.call(target); expect(target.stickinessLookupError).toBe(true)
  target.readContext.mockResolvedValue({ network: capability, policy: null }); await Dialog.methods.refresh.call(target)
  expect(target.stickinessLookupError).toBe(false); expect(target.stickinessContract.params).toEqual(['length']); expect(target.form.name).toBe('draft')
})
