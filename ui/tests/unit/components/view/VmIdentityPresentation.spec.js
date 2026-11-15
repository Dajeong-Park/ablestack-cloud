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

import { shallowMount } from '@vue/test-utils'
import { h } from 'vue'
import ListView from '@/components/view/ListView'
import InfoCard from '@/components/view/InfoCard'
import ActionButton from '@/components/view/ActionButton'
import network from '@/config/section/network'
jest.mock('@/api', () => ({ getAPI: jest.fn().mockResolvedValue({}) }))
function cell (path, row) {
  return shallowMount(ListView, {
    props: { columns: [{ key: 'displayname', dataIndex: 'displayname' }], items: [row] },
    global: {
      provide: { parentFetchData: jest.fn(), parentToggleLoading: jest.fn() },
      mocks: { $route: { path, meta: { name: path.slice(1) } }, $router: { resolve: () => ({ matched: [{}] }) }, $store: { getters: { apis: {}, userInfo: { roletype: 'Admin' } } }, $t: k => k, $showIcon: () => false },
      stubs: {
        'a-table': { render () { return h('div', this.$slots.bodyCell({ column: { key: 'displayname' }, text: row.displayname, record: row })) } },
        'a-tooltip': { props: ['title'], render () { return h('span', { 'data-tooltip': this.title }, this.$slots.default()) } },
        'router-link': { props: ['to'], render () { return h('a', { href: this.to.path }, this.$slots.default()) } }
      }
    }
  })
}
test.each(['/vm', '/vnfapp'].flatMap(path => [undefined, ' ', '한글'.repeat(80), '<img src=x onerror=alert(1)>'].map(displayname => [path, displayname])))('%s renders safe full label %j and keeps UUID links', (path, displayname) => {
  const row = { id: 'uuid-a', name: 'guest-host', displayname }; const expected = displayname?.trim() ? displayname : row.name
  const w = cell(path, row)
  expect(w.find('a').attributes('href')).toBe(path + '/uuid-a'); expect(w.find('a').text()).toBe(expected)
  expect(w.find('[data-tooltip]').attributes('data-tooltip')).toBe(expected); expect(w.find('a img').exists()).toBe(false)
  expect(w.find('a').html()).not.toContain('<img src='); w.unmount()
})
test('missing names use UUID consistently in title, menu and list', () => {
  const resource = { id: 'uuid-a', name: '', displayname: ' ' }; const c = { resource, $route: { path: '/vnfapp' } }
  expect(InfoCard.computed.name.call(c)).toBe('uuid-a'); expect(ActionButton.computed.resourceDisplayName.call(c)).toBe('uuid-a')
  const w = cell('/vnfapp', resource); expect(w.find('a').text()).toBe('uuid-a'); w.unmount()
})
test('non-VM consumers preserve their existing display title', () => {
  const c = { resource: { displayname: ' ', name: 'host', id: 'uuid-a' }, $route: { path: '/template' } }
  expect(InfoCard.computed.name.call(c)).toBe(' '); expect(ActionButton.computed.resourceDisplayName.call(c)).toBe(' ')
})
test('VNF primary column uses the VM displayname contract', () => {
  const vnf = network.children.find(c => c.name === 'vnfapp')
  expect(vnf.columns()[0]).toBe('displayname'); expect(vnf.searchFilters).toContain('name'); expect(vnf.searchFilters).not.toContain('displayname')
})
