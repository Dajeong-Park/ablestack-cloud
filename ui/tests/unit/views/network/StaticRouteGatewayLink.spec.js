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

import { mount, flushPromises } from '@vue/test-utils'
import { h } from 'vue'
import { createRouter, createMemoryHistory } from 'vue-router'
import { Table } from 'ant-design-vue'
import Routes from '@/views/network/StaticRoutesTab'
import { getAPI } from '@/api'

jest.mock('@/api', () => ({ getAPI: jest.fn(), postAPI: jest.fn() }))
const wrappers = []
afterEach(() => { wrappers.splice(0).forEach(wrapper => wrapper.unmount()) })

async function renderRoute (gateway, path = '/vpc/vpc-id') {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:pathMatch(.*)*', component: { render: () => null } }] })
  await router.push(path)
  const row = { id: 'route-id', cidr: '172.28.31.0/24', nexthop: '10.227.31.2', ...gateway }
  getAPI.mockResolvedValue({ liststaticroutesresponse: { staticroute: [row] } })
  const wrapper = mount(Routes, {
    props: { resource: { id: 'vpc-id' } },
    global: {
      plugins: [router],
      mocks: { $t: key => key, $store: { getters: { apis: {}, userInfo: {}, project: {} } }, $notifyError: jest.fn() },
      stubs: {
        ATable: Table,
        ASpin: { render () { return h('div', this.$slots.default?.()) } },
        AButton: true,
        AAlert: true,
        MoldDialog: true,
        TooltipButton: true,
        PlusOutlined: true
      }
    }
  })
  wrappers.push(wrapper)
  await flushPromises()
  return { wrapper, cell: wrapper.find('[data-row-key="route-id"] td:nth-child(2)') }
}

test.each([
  {},
  { vpcgatewayip: '10.249.31.2' },
  { vpcgatewayid: 'gateway-id' },
  { vpcgatewayid: null, vpcgatewayip: null },
  { vpcgatewayid: '', vpcgatewayip: '10.249.31.2' },
  { vpcgatewayid: 'gateway-id', vpcgatewayip: '' },
  { vpcgatewayid: '  ', vpcgatewayip: '10.249.31.2' },
  { vpcgatewayid: 'gateway-id', vpcgatewayip: '  ' }
])('gateway cell has readable fallback and no empty keyboard stop for incomplete response %j', async gateway => {
  const { wrapper, cell } = await renderRoute(gateway)
  expect(cell.exists()).toBe(true)
  expect(cell.text()).toBe('-')
  expect(cell.findAll('a, button, [tabindex]')).toHaveLength(0)
  expect(wrapper.find('[data-row-key="route-id"]').text()).toContain('10.227.31.2')
  expect(wrapper.find('a[href*="undefined"]').exists()).toBe(false)
})

test.each(['/vpc/vpc-id', '/privategw/gateway-id'])('complete gateway response keeps the real IP and detail navigation in %s', async path => {
  const { wrapper, cell } = await renderRoute({ vpcgatewayid: 'gateway-id', vpcgatewayip: '10.249.31.2' }, path)
  const link = cell.get('a')
  expect(link.text()).toBe('10.249.31.2')
  expect(link.attributes('href')).toBe('/privategw/gateway-id')
  expect(link.element.tabIndex).toBe(0)
  await link.trigger('click')
  await flushPromises()
  expect(wrapper.vm.$route.path).toBe('/privategw/gateway-id')
  expect(cell.text()).toBe('10.249.31.2')
})
