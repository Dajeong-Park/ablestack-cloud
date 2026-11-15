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

import { mount, shallowMount, flushPromises } from '@vue/test-utils'
import { h } from 'vue'
import { Form, Input, Select } from 'ant-design-vue'
import Search from '@/components/view/SearchView'
import Chips from '@/components/view/SearchFilter'
import List from '@/components/view/ListView'
import Breadcrumb from '@/components/widgets/Breadcrumb'
import ResourceView from '@/components/view/ResourceView'
import { isoDetailLocation, isoListQuery, isoSearchFields } from '@/utils/isoSearch'
jest.mock('@/api', () => ({ getAPI: jest.fn().mockResolvedValue({}), callAPI: jest.fn() }))
const id = '11111111-1111-4111-8111-111111111111'
const getters = { userInfo: { id: 'actor', roletype: 'Admin' }, project: {}, apis: { listIsos: {} } }
function search () {
  const c = { apiName: 'listIsos', form: {}, fields: [], rules: {}, searchFilters: isoSearchFields, $route: { path: '/iso', meta: { name: 'iso', params: { isofilter: 'self' } }, query: { isready: 'false', bootable: 'false', ispublic: 'false', userdataid: id, 'tags[0].key': 'kind', 'tags[0].value': 'qa' } }, $store: { getters }, $t: k => k, $getApiParams: () => Object.fromEntries(isoSearchFields.map(k => [k, {}])), $isValidUuid: v => v === id, volumeOwnerContext: 'a', $fetchCpuArchitectureTypes: () => [] }
  Object.entries(Search.methods).forEach(([k, f]) => { c[k] = f.bind(c) }); return c
}
test('ISO nullable booleans restore explicit false and advanced tags/UUID draft', () => {
  const c = search(); const keys = c.initFields(); c.fetchStaticFieldData(keys); c.fillFormFieldValues()
  expect(c.form).toMatchObject({ bootable: 'false', isready: 'false', ispublic: 'false', userdataid: id }); expect(c.inputKey).toBe('kind')
  expect(c.fields.filter(f => ['bootable', 'isready', 'ispublic'].includes(f.name)).every(f => f.type === 'list' && f.opts.length === 2)).toBe(true)
})
test('unsupported ISO fields are omitted and exact-name/boolean/sharing chips are localized once', () => {
  const c = search(); c.$getApiParams = () => ({ name: {} }); expect(c.initFields()).toEqual(['name', 'tags'])
  expect(c.retrieveFieldLabel('name')).toBe('label.template.name.exact')
  const chip = { apiName: 'listIsos', $t: k => k }
  expect(Chips.methods.getStaticFieldValue.call(chip, 'bootable', 'false')).toBe('label.no')
  expect(Chips.methods.getStaticFieldValue.call(chip, 'isofilter', 'shared')).toBe('label.shared')
  expect(Chips.methods.retrieveFieldLabel.call(chip, 'isofilter')).toBe('label.filterby')
})
test('late ISO option results cannot paint a new owner or overwrite a typed draft', async () => {
  const c = search(); c.fields = [{ name: 'name', opts: [] }, { name: 'zoneid', opts: [] }]; let release
  c.fetchZones = () => new Promise(resolve => { release = resolve }); const pending = c.fetchDynamicFieldData(['zoneid']); c.volumeOwnerContext = 'b'
  release({ type: 'zoneid', data: [{ id, name: 'old' }] }); await pending; await flushPromises(); expect(c.fields[1].opts).toEqual([])
  c.fetchZones = async () => ({ type: 'zoneid', data: [{ id, name: 'current' }] }); c.form.name = 'new draft'; await c.fetchDynamicFieldData(['zoneid']); await flushPromises()
  expect(c.form.name).toBe('new draft'); expect(c.fields[1].opts).toEqual([{ id, name: 'current' }])
})
test.each(['name', 'ostypename', 'arch', 'state'])('ISO %s cell keeps full accessible text without generic duplicate rendering', field => {
  const record = { id, name: 'qa-long-'.repeat(22), ostypename: 'A long operating system name', arch: 'x86_64', isready: true, state: 'Active' }
  const w = shallowMount(List, {
    props: { columns: [{ key: field, dataIndex: field }], items: [record] },
    global: {
      provide: { parentFetchData: jest.fn(), parentToggleLoading: jest.fn() },
      mocks: { $route: { name: 'iso', path: '/iso', params: {}, query: isoListQuery({}, 20, getters), meta: { name: 'iso' } }, $router: { resolve: () => ({ matched: [{}] }) }, $store: { getters }, $t: k => k, $showIcon: () => false },
      stubs: { IsoListCell: false, 'a-table': { render () { return h('div', this.$slots.bodyCell({ column: { key: field }, text: record[field], record })) } }, 'a-tooltip': { props: ['title', 'trigger'], render () { return h('span', { 'data-tooltip': this.title, 'data-trigger': this.trigger?.join(',') }, this.$slots.default()) } }, 'router-link': { props: ['to'], render () { return h('a', { href: this.to.path, 'data-query': JSON.stringify(this.to.query) }, this.$slots.default()) } } }
    }
  })
  if (field === 'name') { expect(w.findAll('a')).toHaveLength(1); expect(w.find('a').text()).toBe(record.name); expect(JSON.parse(w.find('a').attributes('data-query'))).toHaveProperty('isoreturn') } else { expect(w.find('[tabindex="0"]').exists()).toBe(true) }
  expect(w.find('[data-trigger="hover,focus"]').exists()).toBe(true); w.unmount()
})
test('real form labels and inputs restore false without checked-truthiness defaults', async () => {
  const c = search()
  const w = mount(Search, { props: { apiName: 'listIsos', searchFilters: ['bootable', 'isready', 'ispublic', 'userdataid'] }, global: { mocks: { $store: { getters }, $route: c.$route, $t: k => k, $getApiParams: c.$getApiParams, $isValidUuid: c.$isValidUuid }, components: { AForm: Form, AFormItem: Form.Item, ASelect: Select, AInput: Input }, stubs: { AInputSearch: { template: '<div><slot name="addonBefore"/></div>' }, APopover: { template: '<div><slot/><slot name="content"/></div>' }, AButton: { template: '<button><slot/></button>' }, Wave: true } } })
  w.vm.visibleFilter = true; await flushPromises(); expect(w.vm.form.bootable).toBe('false'); expect(w.findAll('input[role="combobox"]')).toHaveLength(3)
  w.unmount()
})
test('ISO breadcrumb and Vue Router tabs retain return context', () => {
  const route = { path: '/iso/' + id, params: { id }, meta: { name: 'iso' }, query: isoDetailLocation({ query: { keyword: 'part', page: 2 } }, { id }, getters).query }
  const c = { $route: route, $store: { getters }, $router: { push: jest.fn() }, $emit: jest.fn() }
  expect(Breadcrumb.methods.breadcrumbLocation.call(c, { path: '/iso' }).query.keyword).toBe('part')
  ResourceView.methods.onTabChange.call(c, 'zones'); expect(c.$router.push).toHaveBeenCalledWith({ path: route.path, query: { ...route.query, tab: 'zones' } })
})
