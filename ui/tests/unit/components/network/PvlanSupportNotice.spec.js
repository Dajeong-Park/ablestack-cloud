// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements. See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership. The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License. You may obtain a copy of the License at
//
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied. See the License for the
// specific language governing permissions and limitations
// under the License.
import { shallowMount, flushPromises } from '@vue/test-utils'
import { reactive } from 'vue'
import Notice from '@/components/network/PvlanSupportNotice.vue'
import { diagnosePvlanSupport } from '@/utils/pvlanSupport'
jest.mock('@/utils/pvlanSupport', () => ({ diagnosePvlanSupport: jest.fn(), pvlanDiagnosticApis: ['listHosts'] }))
const defer = () => { let done; const promise = new Promise(resolve => { done = resolve }); return { promise, resolve: done } }
let store
const mount = () => shallowMount(Notice, { props: { zoneId: 'z', physicalNetworkId: 'p' }, global: { mocks: { $t: k => k, $route: { fullPath: '/guestnetwork/n' }, $store: store } } })
beforeEach(() => { store = reactive({ getters: { apis: { listHosts: {} }, project: { id: 'a' }, userInfo: { id: 'u' } }, state: { user: { token: 'current' } } }); diagnosePvlanSupport.mockReset().mockResolvedValue({ status: 'ready', blocked: false }) })
test('lookup failure blocks and retry recovers', async () => {
  diagnosePvlanSupport.mockRejectedValueOnce(new Error('503'))
  const w = mount(); await flushPromises()
  expect(w.vm.report).toEqual({ status: 'failed', blocked: true })
  expect(await w.vm.validate()).toBe(true)
  expect(w.vm.report.status).toBe('ready'); w.unmount()
})
test('a late response from another project cannot replace the new support state', async () => {
  const slow = defer(); diagnosePvlanSupport.mockReturnValueOnce(slow.promise).mockResolvedValueOnce({ status: 'unsupported', blocked: true })
  const w = mount(); store.getters.project.id = 'b'; await flushPromises()
  slow.resolve({ status: 'ready', blocked: false }); await flushPromises()
  expect(w.vm.report.status).toBe('unsupported'); w.unmount()
})
test('unmount discards delayed success without updating the support state', async () => {
  const slow = defer(); diagnosePvlanSupport.mockReturnValueOnce(slow.promise)
  const w = mount(); const vm = w.vm; w.unmount()
  slow.resolve({ status: 'ready', blocked: false }); await flushPromises()
  expect(vm.report.status).toBe('checking')
})
test('changing target VM host invalidates a previous ready result', async () => {
  const w = mount(); await flushPromises()
  diagnosePvlanSupport.mockResolvedValueOnce({ status: 'unsupported', blocked: true })
  await w.setProps({ hostId: 'native-host' }); await flushPromises()
  expect(w.vm.report.status).toBe('unsupported'); w.unmount()
})
