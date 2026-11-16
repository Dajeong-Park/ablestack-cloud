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
import { h, markRaw, reactive } from 'vue'
import ResourceView from '@/components/view/ResourceView'
import Details from '@/views/image/KubernetesIsoDetails'
import Zones from '@/views/image/KubernetesIsoZones'
import { getAPI } from '@/api'
jest.mock('@/api', () => ({ getAPI: jest.fn() }))
const id = '11111111-1111-4111-8111-111111111111'
const iso = '22222222-2222-4222-8222-222222222222'
const zone = '33333333-3333-4333-8333-333333333333'
const row = { id, name: 'Version', isoid: iso, zoneid: zone, catalog: { zone: { kind: 'zone', id: zone } } }
const result = { listisosresponse: { count: 1, iso: [{ id: iso, zoneid: zone, isready: true }] } }
const slot = { render () { return h('div', this.$slots.default?.()) } }
let wrappers
beforeEach(() => { jest.useFakeTimers(); getAPI.mockReset(); getAPI.mockResolvedValue(result); wrappers = [] })
afterEach(() => { wrappers.forEach(w => w.unmount()); jest.useRealTimers() })
function setup (tab = 'details') {
  const store = reactive({ state: { user: { token: 'session' }, app: { device: 'desktop' } }, getters: { device: 'desktop', apis: { listKubernetesSupportedVersions: {}, listIsos: {} }, userInfo: { id: 'actor', roleid: 'role', roletype: 'Admin' } } })
  const tabs = [{ name: 'details', component: markRaw(Details) }, { name: 'zones', component: markRaw(Zones) }, { name: 'events', component: markRaw({ render: () => h('div', 'events') }), show: () => false }]
  const route = reactive({ path: '/kubernetesiso/' + id, fullPath: '/kubernetesiso/' + id + '?tab=' + tab, params: { id }, query: { tab }, meta: { name: 'kubernetesiso', tabs } })
  const navigate = jest.fn(location => { route.query = location.query; route.fullPath = route.path + '?tab=' + route.query.tab; return Promise.resolve() })
  const w = mount(ResourceView, {
    props: { resource: row, tabs, loading: false },
    global: {
      mocks: { $store: store, $route: route, $router: { push: navigate, replace: navigate, resolve: () => ({ matched: [{}] }) }, $t: key => key, $toLocaleDate: value => value },
      stubs: {
        ResourceLayout: { render () { return h('div', [this.$slots.left?.(), this.$slots.right?.()]) } },
        InfoCard: { render () { return h('div', this.$slots.details?.()) } },
        'a-card': slot,
        'a-tabs': slot,
        'a-tab-pane': slot,
        'a-list': { props: ['dataSource'], render () { return h('div', (this.dataSource || []).map(item => this.$slots.renderItem({ item }))) } },
        'a-list-item': slot,
        'a-tooltip': slot,
        'a-badge': { props: ['text'], render () { return h('span', this.text) } },
        'a-button': slot,
        'a-input-search': true,
        'a-alert': true,
        'a-table': true,
        'a-pagination': true,
        TooltipButton: true,
        'router-link': slot
      }
    }
  })
  wrappers.push(w); return { w, store, route, navigate }
}
test('one summary observation reaches both tabs and their refresh event reaches the same reader', async () => {
  const { w } = setup(); await flushPromises()
  expect(getAPI).toHaveBeenCalledTimes(1)
  expect(w.findComponent(Details).props('observation')).toMatchObject({ status: 'ready', isoid: iso })
  expect(w.findComponent(Zones).props('observation')).toMatchObject({ status: 'ready', isoid: iso })
  w.findComponent(Zones).vm.$emit('refresh-availability'); await flushPromises()
  expect(getAPI).toHaveBeenCalledTimes(2)
})
test('revoking ISO read clears shared observations before either tab can show old Ready', async () => {
  const { w, store } = setup(); await flushPromises()
  store.getters.apis = { listKubernetesSupportedVersions: {} }; await flushPromises()
  expect(w.findComponent(Details).props('observation').status).toBe('forbidden')
  expect(w.findComponent(Zones).props('observation').status).toBe('forbidden')
  expect(getAPI).toHaveBeenCalledTimes(1)
})
test('unavailable event deep links fall back without dropping the detail route', async () => {
  const { w, route, navigate } = setup('events'); await flushPromises()
  expect(w.vm.activeTab).toBe('details')
  expect(navigate).toHaveBeenCalledWith(expect.objectContaining({ path: route.path, query: { tab: 'details' } }))
})

test('quiet parent refresh does not block the independent ISO availability reader', async () => {
  const { w } = setup(); await flushPromises()
  await w.setProps({ quietRefresh: true, loading: true })
  await w.vm.refreshKubernetesIsoAvailability(); await flushPromises()
  expect(getAPI).toHaveBeenCalledTimes(2)
  expect(w.findComponent(Zones).props('observation').status).toBe('ready')
})
