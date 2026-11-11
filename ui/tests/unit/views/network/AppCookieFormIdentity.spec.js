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
import { h, reactive } from 'vue'
import LoadBalancing from '@/views/network/LoadBalancing'
import { getAPI, postAPI } from '@/api'
jest.mock('@/api', () => ({ getAPI: jest.fn(), postAPI: jest.fn() }))
const dialog = { props: ['visible'], render () { return String(this.$attrs.class || '').includes('appcookie-dialog') ? h('section', { style: { display: this.visible ? 'block' : 'none' } }, this.$slots.default?.()) : null } }
const component = { ...LoadBalancing, created () { this.initForm() }, methods: { ...LoadBalancing.methods, fetchData: jest.fn(), fetchListTiers: jest.fn(), fetchVirtualMachines: jest.fn(), fetchNetworks: jest.fn() } }
const wrappers = []
afterEach(() => { wrappers.splice(0).forEach(w => w.unmount()); jest.clearAllMocks() })
async function mount (project, visible) {
  getAPI.mockResolvedValue({}); postAPI.mockResolvedValue({})
  const getters = reactive({ project: { id: project }, userInfo: { id: 'owner' }, apis: { createLBStickinessPolicy: {}, listLBStickinessPolicies: {} } })
  const w = shallowMount(component, {
    attachTo: document.body,
    props: { resource: { id: 'public-ip', associatednetworkid: 'network', projectid: project } },
    global: {
      mocks: { $t: k => k, $getApiParams: () => ({ methodname: {}, name: {} }), $store: { getters, state: { user: { token: 'session' } } }, $route: reactive({ path: '/publicip/public-ip', meta: { name: 'publicip' } }), $pollJob: jest.fn(), $notifyError: jest.fn() },
      provide: { parentFetchData: jest.fn(), parentToggleLoading: jest.fn() },
      stubs: { MoldDialog: dialog, MoldDialogActions: { template: '<footer><slot/></footer>' }, AForm: false, AFormItem: false, AInput: false, ACard: { template: '<div><slot/></div>' }, ATable: true, BulkActionView: true }
    }
  })
  wrappers.push(w); await w.setData({ loading: false, stickinessModalVisible: visible, stickinessPolicyMethod: 'AppCookie', stickinessContract: { available: true, exact: true, params: ['cookie-name', 'length', 'holdtime', 'request-learn'] } }); await flushPromises(); return w
}
test('cached project forms keep every policy label attached to its own input', async () => {
  const old = await mount('old-project', false); const current = await mount('current-project', true)
  const fields = ['cookieName', 'length', 'holdtime']
  for (const field of fields) {
    const inputs = [old, current].map(w => w.find('form.appcookie-form input[id$="_' + field + '"]').element)
    expect(inputs[0]).toBeTruthy(); expect(inputs[1]).toBeTruthy(); expect(inputs[0].id).not.toBe(inputs[1].id)
    for (const [index, w] of [old, current].entries()) {
      const label = w.find('form.appcookie-form label[for="' + inputs[index].id + '"]').element
      expect(label.control).toBe(inputs[index])
    }
  }
})
