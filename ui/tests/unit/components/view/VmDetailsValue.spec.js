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
import { shallowMount } from '@vue/test-utils'
import { h } from 'vue'
import Details from '@/components/view/DetailsTab'
const labels = { 'label.ostypename': 'OS 유형', 'label.yes': '예', 'label.no': '아니요', 'label.unknown': '알 수 없음', 'label.vm.protection.unprotected': '보호 해제' }
const List = { props: ['dataSource'], setup: (props, { slots }) => () => h('div', (props.dataSource || []).map(item => h('div', slots.renderItem({ item })))) }
const Slot = { template: '<div class="detail-row"><slot /></div>' }
function create (name, resource) {
  return shallowMount(Details, { props: { resource }, global: { mocks: { $t: key => labels[key] || key, $route: { path: '/' + name + '/id', meta: { name, details: [name === 'vm' ? 'ostypename' : 'osdisplayname', 'state', 'haenable', 'isdynamicallyscalable', 'deleteprotection', 'zero'] } }, $store: { getters: { apis: {} } } }, stubs: { AList: List, AListItem: Slot, ATag: Slot } } })
}
test.each(['vm', 'vnfapp'])('the %s detail renders canonical OS, false/0 and protection using shared VM components', name => {
  const raw = Object.freeze({ id: 'vm', ostypeid: 'os-uuid', osdisplayname: 'Other Linux (64-bit)', state: 'Stopped', haenable: false, isdynamicallyscalable: 0, deleteprotection: false, zero: 0 })
  const w = create(name, raw)
  expect(w.text()).toContain('OS 유형'); expect(w.text()).toContain('Other Linux (64-bit)'); expect(w.text().match(/아니요/g)).toHaveLength(2); expect(w.text()).toContain('보호 해제')
  expect(w.findComponent({ name: 'Status' }).props()).toMatchObject({ text: 'Stopped', displayText: true })
  expect(w.findAll('.detail-row').some(row => row.text() === 'label.zero0')).toBe(true)
  expect(raw.ostypeid).toBe('os-uuid'); expect(raw).not.toHaveProperty('ostypename'); w.unmount()
})
test('legacy and missing OS values stay visible after target refresh, without executing markup', async () => {
  const w = create('vnfapp', { id: 'a', ostypename: 'Legacy OS' })
  expect(w.text()).toContain('Legacy OS')
  await w.setProps({ resource: { id: 'b', osdisplayname: null, ostypename: null } }); expect(w.text()).toContain('OS 유형'); expect(w.text()).toContain('알 수 없음'); expect(w.text()).not.toContain('Legacy OS')
  await w.setProps({ resource: { id: 'c', osdisplayname: '<img src=x onerror=alert(1)>' } }); expect(w.text()).toContain('<img src=x onerror=alert(1)>'); expect(w.find('img').exists()).toBe(false); w.unmount()
})
