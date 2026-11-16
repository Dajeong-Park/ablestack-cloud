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

import { mount, flushPromises } from '@vue/test-utils'
import { reactive, nextTick } from 'vue'
import { Table } from 'ant-design-vue'
import Zones from '@/views/image/TemplateZones'
import { getAPI } from '@/api'
jest.mock('@/api', () => ({ getAPI: jest.fn(), postAPI: jest.fn() }))
const resource = { id: 'template', name: 'Image', account: 'owner', domainid: 'domain', domain: 'ROOT', isready: true, templatetype: 'USER' }
const row = { ...resource, zoneid: 'zone', zonename: 'Zone', downloaddetails: [] }
const open = jest.fn()
let wrapper
async function render (apis = {}, change = {}, user = {}) {
  const getters = reactive({ apis, userInfo: { id: 'user', roleid: 'user-role', roletype: 'User', account: 'owner', domainid: 'domain', domain: 'ROOT', ...user }, project: {} })
  getAPI.mockImplementation((api, params) => Promise.resolve(api === 'listZones' ? { listzonesresponse: { zone: [{ id: 'zone', name: 'Zone' }] } } : { listtemplatesresponse: { template: [{ ...row, ...change, id: params.id }], count: 1 } }))
  wrapper = mount(Zones, {
    props: { resource: { ...resource, ...change } },
    global: {
      mocks: { $store: { getters, state: { user: { token: 'session' } } }, $route: { path: '/template/template', meta: { name: 'template' }, query: {} }, $config: {}, $getApiParams: () => ({}), $t: k => k, $toLocaleDate: x => x, $notifyError: jest.fn() },
      components: { 'a-table': Table },
      stubs: { ATable: false, AButton: { template: '<button :disabled="$attrs.disabled"><slot /></button>' }, ATooltip: { template: '<span><slot /></span>' }, APagination: true, AAlert: true, TemplateAvailability: { template: '<span>Ready</span>' }, TooltipButton: true, ResourceIcon: true, TemplateZoneOperations: { template: '<span />', methods: { open (...args) { open(...args) } } } }
    }
  })
  await flushPromises(); await nextTick()
  return getters
}
beforeEach(() => { jest.clearAllMocks() })
afterEach(() => { if (wrapper) wrapper.unmount() })
test('read-only owner retains the actual Zone row but no selection or bulk deletion controls', async () => {
  await render()
  expect(wrapper.findAll('tbody tr[data-row-key]')).toHaveLength(1)
  expect(wrapper.text()).toContain('Zone')
  expect(wrapper.findAll('input[type="checkbox"]')).toHaveLength(0)
  expect(wrapper.text()).not.toContain('label.action.bulk.delete.templates')
})
test('a shared recipient cannot select an owner resource even when the global delete API is granted', async () => {
  await render({ deleteTemplate: {} }, {}, { account: 'recipient' })
  expect(wrapper.findAll('tbody tr[data-row-key]')).toHaveLength(1)
  expect(wrapper.findAll('input[type="checkbox"]')).toHaveLength(0)
})
test('system templates never offer row selection to a root administrator', async () => {
  await render({ deleteTemplate: {} }, { templatetype: 'SYSTEM' }, { roletype: 'Admin' })
  expect(wrapper.findAll('input[type="checkbox"]')).toHaveLength(0)
  wrapper.vm.setSelection(['zone']); wrapper.vm.bulkActionConfirmation(); wrapper.vm.onShowDeleteModal(row)
  expect(open).not.toHaveBeenCalled()
})
test('revoking the delete API clears an existing selection and blocks queued row or bulk actions', async () => {
  const getters = await render({ deleteTemplate: {} })
  await wrapper.get('tbody input[type="checkbox"]').setValue(true)
  expect(wrapper.vm.selectedRowKeys).toEqual(['zone'])
  getters.apis = {}; await flushPromises(); await nextTick()
  expect(wrapper.findAll('input[type="checkbox"]')).toHaveLength(0)
  expect(wrapper.vm.selectedRowKeys).toEqual([])
  expect(wrapper.emitted('selection-change').at(-1)).toEqual([[]])
  wrapper.vm.bulkActionConfirmation(); wrapper.vm.onShowDeleteModal(row)
  expect(open).not.toHaveBeenCalled()
})
test('an ownership scope change clears selected rows and reports the empty selection', async () => {
  await render({ deleteTemplate: {} })
  await wrapper.get('tbody input[type="checkbox"]').setValue(true)
  await wrapper.setProps({ resource: { ...resource, id: 'other-template', account: 'recipient' } }); await flushPromises()
  expect(wrapper.vm.selectedRowKeys).toEqual([])
  expect(wrapper.findAll('input[type="checkbox"]')).toHaveLength(0)
  expect(wrapper.emitted('selection-change').at(-1)).toEqual([[]])
  wrapper.vm.onShowDeleteModal(row); expect(open).not.toHaveBeenCalled()
})
test('retained operations disable selection without moving or losing the selected row', async () => {
  await render({ deleteTemplate: {} })
  await wrapper.get('tbody input[type="checkbox"]').setValue(true)
  wrapper.vm.operationRetained({ active: true }); await nextTick()
  expect(wrapper.get('tbody input[type="checkbox"]').element.disabled).toBe(true)
  wrapper.vm.onSelectChange([]); wrapper.vm.bulkActionConfirmation()
  expect(wrapper.vm.selectedRowKeys).toEqual(['zone']); expect(open).not.toHaveBeenCalled()
})
test('bulk confirmation snapshots only current resource rows and valid Zone identifiers', async () => {
  await render({ deleteTemplate: {} })
  wrapper.vm.dataSource = [row, { ...row, id: 'foreign-template', zoneid: 'foreign' }, { ...row, zoneid: undefined }]
  await nextTick(); wrapper.vm.setSelection(['zone', 'foreign', undefined]); wrapper.vm.bulkActionConfirmation()
  expect(wrapper.vm.selectedRowKeys).toEqual(['zone'])
  expect(open).toHaveBeenCalledWith('delete', [row])
})

test('a missing template identity cannot select or submit a Zone deletion', async () => {
  await render({ deleteTemplate: {} }, { id: undefined })
  expect(wrapper.vm.isTemplateZoneRow(null)).toBe(false)
  expect(wrapper.vm.isTemplateZoneRow({ ...row, id: undefined })).toBe(false)
  wrapper.vm.setSelection(['zone']); wrapper.vm.bulkActionConfirmation(); wrapper.vm.onShowDeleteModal(row)
  expect(wrapper.findAll('input[type="checkbox"]')).toHaveLength(0)
  expect(open).not.toHaveBeenCalled()
})
