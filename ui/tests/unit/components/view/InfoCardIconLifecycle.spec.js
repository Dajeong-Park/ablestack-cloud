// Licensed to the Apache Software Foundation (ASF) under one or more
// contributor license agreements. See NOTICE for ownership information.
// Licensed under the Apache License, Version 2.0 (the "License");
// http://www.apache.org/licenses/LICENSE-2.0 . Distributed AS IS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND.
import { shallowMount } from '@vue/test-utils'
import { h } from 'vue'
import InfoCard from '@/components/view/InfoCard'
import { getAPI } from '@/api'
jest.mock('@/api', () => ({ getAPI: jest.fn() }))
let vm
beforeEach(() => {
  getAPI.mockReset()
  vm = {
    iconActive: true,
    images: {},
    resource: { id: 'snapshot-a', account: 'owner', domainid: 'domain' },
    $route: { fullPath: '/snapshot/a' },
    $store: { getters: { apis: { listAccounts: {}, listResourceIcon: {} }, userInfo: { id: 'user' } }, state: { user: { token: 'session' } } }
  }
  for (const method of ['iconScope', 'readIcon', 'fetchAccount', 'fetchResourceIcon']) vm[method] = InfoCard.methods[method].bind(vm)
})
test('canceled account and icon reads settle without unhandled rejections', async () => {
  getAPI.mockRejectedValue(Object.assign(new Error('canceled'), { code: 'ERR_CANCELED' }))
  await expect(vm.fetchAccount()).resolves.toBeUndefined()
  await expect(vm.fetchResourceIcon('zone', 'zone')).resolves.toBeUndefined()
  expect(vm.images).toEqual({})
})
test.each(['route', 'resource', 'login', 'project', 'unmount'])('late icon response cannot populate another %s', async changed => {
  let release; getAPI.mockReturnValue(new Promise(resolve => { release = resolve }))
  const pending = vm.fetchResourceIcon('zone-a', 'zone')
  if (changed === 'route') vm.$route.fullPath = '/snapshotpolicy'
  if (changed === 'resource') vm.resource.id = 'snapshot-b'
  if (changed === 'login') vm.$store.state.user.token = 'next-session'
  if (changed === 'project') vm.$store.getters.project = { id: 'project' }
  if (changed === 'unmount') InfoCard.beforeUnmount.call(vm)
  release({ listresourceiconresponse: { icon: [{ base64image: 'old-private-icon' }] } }); await pending
  expect(vm.images).toEqual({})
})
test('a current account icon resolves and denied lookups make no request', async () => {
  getAPI.mockResolvedValue({ listaccountsresponse: { account: [{ icon: { base64image: 'current' } }] } })
  await vm.fetchAccount(); expect(vm.images.account).toBe('current')
  vm.$store.getters.apis = {}; await vm.fetchResourceIcon('zone', 'zone')
  expect(getAPI).toHaveBeenCalledTimes(1)
})

test.each([
  [{ base64image: 'own-image', resourcetype: 'Template' }, 'parent-image', 'parent-image'],
  [{ base64image: 'own-image', resourcetype: 'Template' }, undefined, 'own-image'],
  [undefined, 'parent-image', 'parent-image']
])('a template card renders its own or inherited OS icon without losing the card', (icon, parent, expected) => {
  const subject = { ...InfoCard, methods: { ...InfoCard.methods, updateResourceAdditionalData: jest.fn() } }
  const wrapper = shallowMount(subject, {
    props: { resource: { id: 'template', name: 'Ubuntu template', ostypeid: 'os', ostypename: 'Ubuntu 24.04 LTS', templatetype: 'SYSTEM', icon } },
    data: () => ({ images: { template: parent } }),
    global: {
      mocks: {
        $route: { name: 'template', path: '/template/template', fullPath: '/template/template', query: {}, meta: { name: 'template', resourceType: 'Template' } },
        $router: { resolve: () => ({ matched: [{}] }) },
        $store: { getters: { apis: {}, userInfo: { id: 'user' } }, state: { user: {} } },
        $config: { theme: {} },
        $t: key => key,
        $showIcon: () => true,
        $getResourceType: () => 'Template'
      },
      stubs: {
        'a-spin': { render () { return h('div', this.$slots.default?.()) } },
        'a-card': { render () { return h('div', this.$slots.default?.()) } },
        'router-link': { render () { return h('a', this.$slots.default?.()) } },
        ResourceIcon: { props: ['image'], render () { return h('img', { 'data-icon': this.image }) } }
      }
    }
  })
  expect(wrapper.find('h4').text()).toBe('Ubuntu template')
  expect(wrapper.findAll('[data-icon]').map(node => node.attributes('data-icon'))).toContain(expected)
  expect(wrapper.find('.resource-detail-item__details [data-icon]').attributes('data-icon')).toBe(expected)
  wrapper.unmount()
})
