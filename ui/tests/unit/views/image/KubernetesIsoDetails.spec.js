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

import { mount } from '@vue/test-utils'
import { h, reactive } from 'vue'
import Details from '@/views/image/KubernetesIsoDetails'
import Zones from '@/views/image/KubernetesIsoZones'
import Scope from '@/components/widgets/KubernetesIsoScope'
import Status from '@/components/widgets/KubernetesIsoStatus'
import InfoCard from '@/components/view/InfoCard'
import { getAPI } from '@/api'
jest.mock('@/api', () => ({ getAPI: jest.fn() }))
const id = '11111111-1111-4111-8111-111111111111'
const iso = '22222222-2222-4222-8222-222222222222'
const zone = '33333333-3333-4333-8333-333333333333'
const url = 'http://source.example.test/image.iso?signature=example-value&name=original'
const resource = { id, name: 'Version', semanticversion: '1.36.5', isoid: iso, isoname: 'Binaries', isostate: 'Ready', zoneid: zone, state: 'Enabled', arch: 'aarch64', mincpunumber: 0, minmemory: 0, supportsha: false, supportsautoscaling: false, directdownload: false, isourl: url }
const translate = key => ({ 'label.no': 'No', 'label.yes': 'Yes', 'label.unknown': 'Unknown' })[key] || key
const list = { props: ['dataSource'], render () { return h('div', (this.dataSource || []).map(item => this.$slots.renderItem({ item }))) } }
const slot = { render () { return h('div', this.$slots.default?.()) } }
function environment (role = 'Admin') {
  const store = reactive({ getters: { userInfo: { id: 'actor', roletype: role }, apis: { listKubernetesSupportedVersions: {} } }, state: { user: { token: 'runtime-only' } } })
  return { store, global: { mocks: { $store: store, $route: { meta: { name: 'kubernetesiso' }, query: {} }, $router: { resolve: () => ({ matched: [{}] }) }, $t: translate, $toLocaleDate: value => value }, stubs: { 'a-list': list, 'a-list-item': slot, 'a-tooltip': slot, 'a-badge': { props: ['text'], render () { return h('span', this.text) } }, 'a-button': { props: ['disabled'], render () { return h('button', { disabled: this.disabled }, this.$slots.default?.()) } }, TooltipButton: { props: ['copyResource'], render () { return h('button', { 'data-copy': this.copyResource }) } }, 'router-link': slot } } }
}
beforeEach(() => getAPI.mockReset())
test('detail uses every catalog field, preserves false/0 and copies the complete raw identifiers and URL', () => {
  const { global } = environment(); const w = mount(Details, { props: { resource }, global })
  expect(w.vm.fields.map(field => field.key)).toEqual(expect.arrayContaining(['id', 'isoid', 'scope', 'zoneid', 'arch', 'mincpunumber', 'minmemory', 'supportsha', 'supportsautoscaling', 'directdownload', 'availability', 'isostate', 'created', 'isourl']))
  expect(w.text()).toContain('0'); expect(w.text()).toContain('No'); expect(w.text()).not.toContain('true')
  expect(w.findAll('[data-copy]').map(node => node.attributes('data-copy'))).toEqual(expect.arrayContaining([id, iso, zone, url]))
  expect(getAPI).not.toHaveBeenCalled(); w.unmount()
})
test('role changes remove the URL and copy control even with a stale Root record prop', async () => {
  const { global, store } = environment(); const w = mount(Details, { props: { resource }, global })
  expect(w.text()).toContain(url); store.getters.userInfo.roletype = 'User'; await w.vm.$nextTick()
  expect(w.text()).not.toContain(url); expect(w.vm.fields.map(field => field.key)).not.toContain('isourl')
  expect(w.findAll('[data-copy]').map(node => node.attributes('data-copy'))).not.toContain(url); w.unmount()
})
test('global and unknown scopes do not render an undefined Zone link', () => {
  const { global } = environment()
  for (const value of [{ catalog: { zone: { kind: 'all', id: null } } }, {}]) {
    const w = mount(Scope, { props: { resource: value }, global })
    expect(w.find('a').exists()).toBe(false); expect(w.html()).not.toContain('/zone/undefined'); w.unmount()
  }
})
test('reported Ready without a child read is unqueried; version status remains independent', () => {
  const { global } = environment()
  const w = mount(Status, { props: { resource }, global }); expect(w.text()).toContain('label.kubernetes.iso.availability.unqueried'); w.unmount()
  const v = mount(Status, { props: { resource, mode: 'version' }, global }); expect(v.text()).toContain('label.kubernetes.iso.version.enabled'); v.unmount()
})
test('Zone pane has read-only actions and distinct forbidden/empty states', async () => {
  const { global } = environment()
  const w = mount(Zones, { props: { resource, observation: { isoid: iso, status: 'forbidden', rows: [] } }, global: { ...global, stubs: { ...global.stubs, 'a-alert': { props: ['message'], render () { return h('div', this.message) } }, 'a-input-search': true } } })
  expect(w.text()).toContain('message.kubernetes.iso.availability.forbidden')
  expect(w.findAll('button')).toHaveLength(1); expect(w.find('button').attributes('disabled')).toBeDefined()
  expect(w.vm.columns.map(column => column.key)).toEqual(['zonename', 'availability', 'isready', 'reason', 'actions'])
  await w.setProps({ observation: { isoid: iso, status: 'empty', rows: [] } }); expect(w.text()).toContain('message.kubernetes.iso.availability.empty')
  expect(getAPI).not.toHaveBeenCalled(); w.unmount()
})
test('KISO card skips generic link validation while the VM path keeps its existing child read', async () => {
  const ctx = { $route: { meta: { name: 'kubernetesiso' } }, $router: { resolve: () => ({ matched: [{}] }) }, resource, isStatic: false, setData: jest.fn(), updateResourceAdditionalData: jest.fn() }
  await InfoCard.watch.resource.handler.call(ctx, resource, {})
  expect(getAPI).not.toHaveBeenCalled(); expect(ctx.validLinks).toEqual({})
  getAPI.mockResolvedValue({ listisosresponse: { iso: [{ id: iso }] } }); ctx.$route.meta.name = 'vm'
  await InfoCard.watch.resource.handler.call(ctx, resource, {})
  expect(getAPI).toHaveBeenCalledWith('listIsos', expect.objectContaining({ id: iso }))
})

test.each([['Admin', '/zone/'], ['User', '/zones/']])('Zone links choose the available %s read view', (role, prefix) => {
  const { global, store } = environment(role); store.getters.apis.listZones = {}
  const w = mount(Scope, { props: { resource }, global })
  expect(w.vm.path).toBe(prefix + zone); w.unmount()
})
