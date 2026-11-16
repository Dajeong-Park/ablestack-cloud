// Licensed to the Apache Software Foundation (ASF) under one or more
// contributor license agreements. See the NOTICE file distributed with this
// work for additional information regarding copyright ownership. The ASF
// licenses this file under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License. You may
// obtain a copy at http://www.apache.org/licenses/LICENSE-2.0 . Unless required
// by applicable law or agreed to in writing, software distributed under the
// License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS.
import { mount, shallowMount, flushPromises } from '@vue/test-utils'
import { h } from 'vue'
import { createRouter, createMemoryHistory } from 'vue-router'
import { getAPI } from '@/api'
import PublicIpNetworkLink from '@/components/widgets/PublicIpNetworkLink'
import ListView from '@/components/view/ListView'

jest.mock('@/api', () => ({ getAPI: jest.fn().mockResolvedValue({}) }))
const id = '4e6e8d47-779b-41f6-a4de-6f9914a92c69'
const named = { id: 'ip', associatednetworkid: id, associatednetworkname: '연결된 게스트망' }
const globals = apis => ({ mocks: { $store: { getters: { apis } } } })
async function render (record, apis = { listNetworks: {} }) {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:pathMatch(.*)*', component: { template: '<div />' } }] })
  await router.push('/')
  await router.isReady()
  return { wrapper: mount(PublicIpNetworkLink, { props: { record }, global: { ...globals(apis), plugins: [router] } }), router }
}
beforeEach(() => getAPI.mockClear())

test.each([undefined, null, '', ' ', 'undefined', 'NULL', 'NaN', 'none', 0, true, {}, [], '../net', 'a/b', 'a?x=1', '#bad', 'a b', '%2F'])('invalid network identity %p produces no link, icon or focus target', async value => {
  const { wrapper } = await render({ ...named, associatednetworkid: value, networkid: id, vpcid: id, issystem: true, issourcenat: true })
  expect(wrapper.text()).toBe(named.associatednetworkname)
  expect(wrapper.find('a, button, [tabindex], .anticon').exists()).toBe(false)
  expect(getAPI).not.toHaveBeenCalled()
  wrapper.unmount()
})
test.each([id, 'network-custom_42'])('name and ID-only references preserve UUID or custom identifier %s', async value => {
  const { wrapper, router } = await render({ ...named, associatednetworkid: value })
  expect(wrapper.get('a').text()).toBe(named.associatednetworkname)
  expect(wrapper.get('a').attributes('href')).toBe('/guestnetwork/' + value)
  await wrapper.setProps({ record: { associatednetworkid: value, networkid: 'public-source' } })
  expect(wrapper.get('a').text()).toBe(value)
  await wrapper.get('a').trigger('click', { button: 0 })
  await flushPromises()
  expect(router.currentRoute.value.path).toBe('/guestnetwork/' + value)
  expect(getAPI).not.toHaveBeenCalled()
  wrapper.unmount()
})
test('unconnected Free/Reserved/system/VPC-only addresses use the VM empty marker without a fabricated network link', async () => {
  const { wrapper } = await render({})
  for (const record of [{ state: 'Free' }, { state: 'Reserved' }, { issystem: true }, { vpcid: id }, { networkid: id, issourcenat: true }, { associatednetworkname: 'undefined' }]) {
    await wrapper.setProps({ record })
    expect(wrapper.text()).toBe('—')
    expect(wrapper.find('a, button, [tabindex], .anticon').exists()).toBe(false)
  }
  expect(getAPI).not.toHaveBeenCalled()
  wrapper.unmount()
})
test('name-only text is escaped, unsupported network API stays plain, and whitespace IDs are normalized', async () => {
  const name = '<img src=x onerror=alert(1)>'
  const { wrapper } = await render({ associatednetworkname: name }, {})
  expect(wrapper.find('img, a').exists()).toBe(false)
  expect(wrapper.text()).toBe(name)
  await wrapper.setProps({ record: named })
  expect(wrapper.find('a').exists()).toBe(false)
  wrapper.unmount()
  const result = await render({ ...named, associatednetworkid: ' ' + id + ' ' })
  expect(result.wrapper.get('a').attributes('href')).toBe('/guestnetwork/' + id)
  result.wrapper.unmount()
})
test('same row reused for partial/late records drops the previous name and focus target immediately', async () => {
  const { wrapper } = await render(named)
  await wrapper.setProps({ record: { id: 'ip' } })
  expect(wrapper.text()).toBe('—')
  expect(wrapper.find('a').exists()).toBe(false)
  await wrapper.setProps({ record: { id: 'ip', associatednetworkname: '이름만' } })
  expect(wrapper.text()).toBe('이름만')
  expect(wrapper.find('a').exists()).toBe(false)
  await wrapper.setProps({ record: { id: 'other-ip', associatednetworkid: 'new-network' } })
  expect(wrapper.get('a').text()).toBe('new-network')
  expect(wrapper.get('a').attributes('href')).toBe('/guestnetwork/new-network')
  expect(getAPI).not.toHaveBeenCalled()
  wrapper.unmount()
})

function table (route, records = [named], keys = ['associatednetworkname']) {
  const columns = keys.map(key => ({ key, dataIndex: key }))
  return shallowMount(ListView, {
    props: { columns, items: records },
    global: {
      provide: { parentFetchData: jest.fn(), parentToggleLoading: jest.fn() },
      mocks: { $route: { path: '/' + route, name: route, meta: { name: route } }, $router: { resolve: () => ({ matched: [{}] }) }, $store: { getters: { apis: { listNetworks: {} }, userInfo: { roletype: 'Admin' } } }, $t: key => key },
      stubs: {
        PublicIpNetworkLink: false,
        'network-ip-vm-link': false,
        'a-table': { props: ['dataSource'], render () { return h('div', this.dataSource.map(record => keys.map(key => h('div', { 'data-cell': key }, this.$slots.bodyCell({ column: { key }, text: record[key], record }))))) } },
        'router-link': { props: ['to'], render () { return h('a', { href: this.to.path }, this.$slots.default()) } }
      }
    }
  })
}
test('Public IP table keeps network/VPC/VM columns separate and updates links on page/filter/project row replacement', async () => {
  const row = { ...named, networkid: 'public-source', vpcid: 'vpc-target', vpcname: 'VPC', virtualmachineid: 'vm-target', virtualmachinename: 'VM', virtualmachinetype: 'User' }
  const wrapper = table('publicip', [row], ['associatednetworkname', 'vpcname', 'virtualmachinename'])
  expect(wrapper.get('[data-cell=associatednetworkname] a').attributes('href')).toBe('/guestnetwork/' + id)
  expect(wrapper.get('[data-cell=vpcname] a[href]').attributes('href')).toBe('/vpc/vpc-target')
  expect(wrapper.get('[data-cell=virtualmachinename] a').attributes('href')).toBe('/vm/vm-target')
  await wrapper.setProps({ items: [{ id: 'ip', networkid: 'public-source', vpcid: 'vpc-only', vpcname: 'VPC only' }] })
  expect(wrapper.get('[data-cell=associatednetworkname]').text()).toBe('—')
  expect(wrapper.get('[data-cell=associatednetworkname]').find('a').exists()).toBe(false)
  expect(wrapper.find('a[href="/guestnetwork/' + id + '"]').exists()).toBe(false)
  expect(wrapper.find('a[href="/vpc/vpc-only"]').exists()).toBe(true)
  await wrapper.setProps({ items: [] })
  expect(wrapper.find('a').exists()).toBe(false)
  expect(getAPI).not.toHaveBeenCalled()
  wrapper.unmount()
})
test('other network-column consumers retain their existing renderer and AutoScale stays dedicated', () => {
  const wrapper = table('iprange')
  expect(wrapper.findComponent(PublicIpNetworkLink).exists()).toBe(false)
  expect(wrapper.get('a').attributes('href')).toBe('/guestnetwork/' + id)
  expect(wrapper.get('a').text()).toBe(named.associatednetworkname)
  wrapper.unmount()
  const auto = table('autoscalevmgroup')
  expect(auto.find('auto-scale-list-cell-stub').exists()).toBe(true)
  expect(auto.findComponent(PublicIpNetworkLink).exists()).toBe(false)
  auto.unmount()
})
