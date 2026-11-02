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

import { mount } from '@vue/test-utils'
import { nextTick, reactive } from 'vue'
import ChangeAffinity from '@/views/compute/ChangeAffinity.vue'
import Selector from '@/views/compute/wizard/AffinityGroupSelection.vue'
import Summary from '@/views/compute/wizard/AffinitySelectionSummary.vue'
import DeployVM from '@/views/compute/DeployVM.vue'
import Backup from '@/components/view/DeployVMFromBackup.vue'
import Vnf from '@/views/compute/DeployVnfAppliance.vue'
import AutoScale from '@/views/compute/CreateAutoScaleVmGroup.vue'
import { getAPI, postAPI } from '@/api'
import { clearAffinityOperations } from '@/utils/affinityGroupOperations'
jest.mock('@/api', () => ({ getAPI: jest.fn(), postAPI: jest.fn() }))
jest.mock('@/store', () => ({ getters: {} }))

const flush = async () => { for (let i = 0; i < 30; i++) { await Promise.resolve(); await nextTick() } }
const groups = Array.from({ length: 14 }, (_, i) => ({ id: `g${i + 1}`, name: `group-${String(i + 1).padStart(2, '0')}`, type: 'host anti-affinity' }))
const resource = { id: 'vm', account: 'owner', domainid: 'domain', state: 'Stopped', affinitygroup: [{ id: 'g14', name: 'group-14' }] }
let wrappers
const store = () => reactive({ state: { user: { token: 'session' } }, getters: { userInfo: { id: 'user' }, project: {} } })
function render (component, props = {}) {
  const s = store()
  const w = mount(component, { props, global: { mocks: { $store: s, $t: key => key, $notification: { success: jest.fn() } }, provide: { parentFetchData: jest.fn() }, stubs: { MoldDialog: { template: '<section><slot/><footer><slot name="footer"/></footer></section>' } } } })
  wrappers.push(w)
  return { w, s }
}
beforeEach(() => {
  wrappers = []; jest.clearAllMocks(); clearAffinityOperations()
  getAPI.mockImplementation((command, query) => {
    if (command === 'listVirtualMachines') return Promise.resolve({ listvirtualmachinesresponse: { virtualmachine: [resource] } })
    if (command === 'queryAsyncJobResult') return Promise.resolve({ queryasyncjobresultresponse: { jobstatus: 1 } })
    const filtered = groups.filter(group => (!query.id || query.id === group.id) && (!query.keyword || group.name.includes(query.keyword)))
    const start = ((query.page || 1) - 1) * (query.pageSize || 10)
    return Promise.resolve({ listaffinitygroupsresponse: { count: filtered.length, affinitygroup: filtered.slice(start, start + (query.pageSize || 10)) } })
  })
  postAPI.mockResolvedValue({ updatevirtualmachineresponse: { jobid: 'job' } })
})
afterEach(() => { wrappers.forEach(w => w.unmount()); clearAffinityOperations() })

test('real table preserves existing off-page and newly checked rows across pages, search, local sort and save', async () => {
  const { w } = render(ChangeAffinity, { resource }); await flush()
  await w.findAll('tbody input[type="checkbox"]')[0].setValue(true); await flush()
  expect(w.vm.selectedRowKeys).toEqual(['g14', 'g1'])
  await w.find('.ant-pagination-next button').trigger('click'); await flush()
  expect(w.vm.options.page).toBe(2)
  await w.findAll('tbody input[type="checkbox"]')[0].setValue(true); await flush()
  expect(w.vm.selectedRowKeys).toEqual(['g14', 'g1', 'g11'])
  await w.find('.ant-pagination-prev button').trigger('click'); await flush()
  expect(w.findAll('tbody input[type="checkbox"]')[0].element.checked).toBe(true)
  const calls = getAPI.mock.calls.length
  await w.find('.ant-table-column-sorters').trigger('click'); await flush()
  expect(getAPI).toHaveBeenCalledTimes(calls)
  await w.vm.handleSearch('group-14'); await flush()
  expect(w.vm.options.page).toBe(1); expect(w.vm.total).toBe(1)
  expect(w.find('tbody input[type="checkbox"]').element.checked).toBe(true)
  expect(w.findComponent(Summary).text()).toContain('group-01')
  await w.vm.handleSubmit(); await flush()
  expect(postAPI).toHaveBeenCalledWith('updateVMAffinityGroup', { id: 'vm', affinitygroupids: 'g14,g1,g11' }, expect.objectContaining({ backgroundJob: true }))
})

test('page header only changes visible rows; explicit summary removal and clear apply to all pages', async () => {
  const { w } = render(ChangeAffinity, { resource }); await flush()
  await w.find('thead input[type="checkbox"]').setValue(true); await flush()
  expect(w.vm.selectedRowKeys).toHaveLength(11); expect(w.vm.selectedRowKeys).toContain('g14')
  await w.find('thead input[type="checkbox"]').setValue(false); await flush()
  expect(w.vm.selectedRowKeys).toEqual(['g14'])
  await w.findComponent(Summary).find('li button').trigger('click'); await flush()
  expect(w.vm.selectedRowKeys).toEqual([])
  await w.find('thead input[type="checkbox"]').setValue(true); await flush()
  await w.findComponent(Summary).find('.selection-heading button').trigger('click'); await flush()
  expect(w.vm.selectedRowKeys).toEqual([])
})

test('controlled search and size reset page one while zero results retain selections', async () => {
  const { w } = render(ChangeAffinity, { resource }); await flush()
  await w.vm.handleTableChange({ current: 2, pageSize: 10 }); await flush()
  await w.vm.handleSearch('group-14'); await flush()
  expect(w.find('.ant-pagination-item-active').text()).toBe('1'); expect(w.vm.total).toBe(1)
  await w.vm.handleSearch('no-match'); await flush()
  expect(w.vm.items).toEqual([]); expect(w.vm.total).toBe(0); expect(w.vm.fetchError).toBe('')
  expect(w.find('[role="status"]').text()).toBe('label.total 0 label.items · 1 label.page')
  expect(w.vm.selectedRowKeys).toEqual(['g14'])
  await w.vm.handleTableChange({ current: 2, pageSize: 20 }); await flush()
  expect(w.vm.options).toMatchObject({ page: 1, pageSize: 20 })
})

test('late success and late failure cannot replace the newest result or its loading/error state', async () => {
  const { w } = render(ChangeAffinity, { resource }); await flush()
  let oldSuccess; let oldFailure; let latest
  getAPI.mockImplementationOnce(() => new Promise(resolve => { oldSuccess = resolve }))
    .mockImplementationOnce(() => new Promise((resolve, reject) => { oldFailure = reject }))
    .mockImplementationOnce(() => new Promise(resolve => { latest = resolve }))
  const a = w.vm.handleSearch('a'); const b = w.vm.handleSearch('b'); w.vm.handleSearch('latest')
  latest({ listaffinitygroupsresponse: { count: 1, affinitygroup: [groups[13]] } }); await flush()
  oldSuccess({ listaffinitygroupsresponse: { count: 14, affinitygroup: groups } }); oldFailure(new Error('old failure')); await Promise.all([a, b]); await flush()
  expect(w.vm.items).toEqual([groups[13]]); expect(w.vm.fetchError).toBe(''); expect(w.vm.fetching).toBe(false)
  expect(w.vm.selectedRowKeys).toEqual(['g14'])
})

test('wizard initializes once, preserves local selection across fetches and supports explicit parent clear', async () => {
  const { w } = render(Selector, { items: groups.slice(0, 10), rowCount: 14, preFillContent: { affinitygroupids: ['g14'] } }); await flush()
  await w.findAll('tbody input[type="checkbox"]')[0].setValue(true); await flush()
  expect(w.vm.selectedRowKeys).toEqual(['g14', 'g1'])
  await w.setProps({ loading: true }); await w.setProps({ items: groups.slice(10), loading: false }); await flush()
  await w.findAll('tbody input[type="checkbox"]')[0].setValue(true); await flush()
  expect(w.emitted('select-affinity-group-item').slice(-1)[0][0]).toEqual(['g14', 'g1', 'g11'])
  w.vm.onChangePage(2, 10); w.vm.handleSearch('group-14'); await flush()
  expect(w.emitted('handle-search-filter').slice(-1)[0][0]).toEqual({ page: 1, pageSize: 10, keyword: 'group-14' })
  w.vm.onChangePage(2, 20); await flush()
  expect(w.emitted('handle-search-filter').slice(-1)[0][0].page).toBe(1)
  await w.setProps({ value: ['g11'] }); await w.setProps({ value: [] }); await flush()
  expect(w.vm.selectedRowKeys).toEqual([])
  await w.setProps({ loading: true }); await w.setProps({ loading: false }); await flush()
  expect(w.vm.selectedRowKeys).toEqual([])
})

test('wizard shows the shared policy labels without changing raw types or selected IDs', async () => {
  const types = ['host affinity', 'host anti-affinity', 'non-strict host affinity', 'non-strict host anti-affinity', 'future-policy']
  const items = types.map((type, i) => ({ id: `policy-${i}`, name: `policy ${i}`, type, description: `description ${i}` }))
  const { w } = render(Selector, { items, rowCount: items.length }); await flush()
  const labels = w.findAll('tbody .affinity-policy-label')
  expect(labels.map(label => label.text())).toEqual(['label.affinity.type.strict.affinity', 'label.affinity.type.strict.anti', 'label.affinity.type.non.strict.affinity', 'label.affinity.type.non.strict.anti', 'future-policy'])
  expect(labels.map(label => label.attributes('title'))).toEqual(types)
  expect(w.findAll('tbody tr').map(row => row.text())).toEqual(expect.arrayContaining([expect.stringContaining('description 0'), expect.stringContaining('policy 4')]))
  await w.findAll('tbody input[type="checkbox"]')[4].setValue(true); await flush()
  expect(w.emitted('select-affinity-group-item').slice(-1)[0][0]).toEqual(['policy-4'])
  expect(items.map(item => item.type)).toEqual(types)
})

test('wizard scope change clears previous selections and filter, resets pagination and requests the new scope', async () => {
  const { w, s } = render(Selector, { value: ['g14'], owner: { account: 'owner', domainid: 'domain' }, zoneId: 'z1' }); await flush()
  w.vm.handleSearch('old'); w.vm.onChangePage(2, 10)
  s.getters.project = { id: 'new-project' }; await flush()
  expect(w.vm.selectedRowKeys).toEqual([])
  expect(w.emitted('select-affinity-group-item').slice(-1)[0][0]).toEqual([])
  expect(w.emitted('handle-search-filter').slice(-1)[0][0]).toEqual({ page: 1, pageSize: 10, keyword: null })
})

test('wizard retains initial prefill while the initial zone resolves, but clears it on a later zone switch', async () => {
  const { w } = render(Selector, { preFillContent: { affinitygroupids: ['g14'] }, zoneId: '' }); await flush()
  await w.setProps({ zoneId: 'first-zone' }); await flush()
  expect(w.vm.selectedRowKeys).toEqual(['g14'])
  await w.setProps({ zoneId: 'other-zone' }); await flush()
  expect(w.vm.selectedRowKeys).toEqual([])
})

test.each([DeployVM, Backup, Vnf, AutoScale])('$name wizard uses the complete form ID set and latest-only affinity lookup with retained failure data', async Wizard => {
  const query = { page: 1, pageSize: 10, listall: false }
  const vm = { $store: store(), zoneId: 'zone', form: { affinitygroupids: ['g1', 'g14'] }, affinityGroups: [groups[0]], loading: {}, options: { affinityGroups: [] }, rowCount: {}, params: { affinityGroups: { options: query } } }
  expect(Wizard.computed.affinityGroupIds.call(vm)).toEqual(['g1', 'g14'])
  Wizard.methods.updateAffinityGroups.call(vm, ['g1', 'g14']); expect(vm.affinityGroups.map(group => group.id)).toEqual(['g1', 'g14'])
  let old
  getAPI.mockImplementationOnce(() => new Promise(resolve => { old = resolve }))
  const a = Wizard.methods.fetchOptions.call(vm, vm.params.affinityGroups, 'affinityGroups')
  vm.params.affinityGroups.options = { ...query, keyword: 'group-14' }
  await Wizard.methods.fetchOptions.call(vm, vm.params.affinityGroups, 'affinityGroups')
  old({ listaffinitygroupsresponse: { count: 14, affinitygroup: groups } }); await a
  expect(vm.options.affinityGroups).toEqual([groups[13]]); expect(vm.rowCount.affinityGroups).toBe(1)
  getAPI.mockRejectedValueOnce(new Error('offline'))
  await Wizard.methods.fetchOptions.call(vm, vm.params.affinityGroups, 'affinityGroups')
  expect(vm.affinityGroupsError).toBe('message.affinity.lookup.failed')
  expect(vm.options.affinityGroups).toEqual([groups[13]]); expect(vm.form.affinitygroupids).toEqual(['g1', 'g14'])
  await Wizard.methods.fetchOptions.call(vm, vm.params.affinityGroups, 'affinityGroups')
  expect(vm.affinityGroupsError).toBe(''); expect(vm.loading.affinityGroups).toBe(false)
  vm.params.affinityGroups.options = { ...query, account: 'new-owner', domainid: 'domain' }
  getAPI.mockRejectedValueOnce(new Error('new owner lookup failed'))
  await Wizard.methods.fetchOptions.call(vm, vm.params.affinityGroups, 'affinityGroups')
  expect(vm.options.affinityGroups).toEqual([]); expect(vm.rowCount.affinityGroups).toBe(0)
  expect(vm.form.affinitygroupids).toEqual([]); expect(vm.affinityGroups).toEqual([])
  expect(vm.affinityGroupsError).toBe('message.affinity.lookup.failed')
})
