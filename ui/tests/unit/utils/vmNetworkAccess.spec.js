// Licensed to the Apache Software Foundation (ASF) under one or more
// contributor license agreements. See NOTICE for ownership information.
// Licensed under the Apache License, Version 2.0 (the "License");
// http://www.apache.org/licenses/LICENSE-2.0 . Distributed AS IS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND.
import { mount, flushPromises } from '@vue/test-utils'
import { reactive } from 'vue'
import { vmNetworkAccessMixin } from '@/utils/vmNetworkAccess'
import { getAPI } from '@/api'
jest.mock('@/api', () => ({ getAPI: jest.fn() }))
const resource = { id: 'vm', zoneid: 'zone', projectid: 'project', nic: [{ id: 'nic', networkid: 'shared', networkname: 'Shared network', isdefault: true }] }
const page = rows => ({ listnetworksresponse: { count: rows.length, network: rows } })
const consumer = autoLoad => ({
  mixins: [vmNetworkAccessMixin({ autoLoad })],
  props: ['resource', 'isStatic'],
  template: '<div><a v-if="vmNetworks.shared" href="/guestnetwork/shared">Shared network</a><span v-else>Shared network</span><span v-if="vmNetworkAccessFailed" role="status">Network lookup failed</span></div>'
})
let wrappers
beforeEach(() => { jest.clearAllMocks(); wrappers = []; getAPI.mockResolvedValue(page([{ id: 'shared' }])) })
afterEach(() => wrappers.forEach(w => w.unmount()))
function setup (autoLoad = true, globals) {
  const store = globals?.store || reactive({ getters: { project: { id: 'project' }, userInfo: { id: 'user', roleid: 'role' }, apis: { listNetworks: {} } }, state: { user: { token: 'session' } } })
  const route = globals?.route || reactive({ path: '/vm/vm', meta: { name: 'vm' } })
  const w = mount(consumer(autoLoad), { props: { resource: { ...resource } }, global: { mocks: { $store: store, $route: route } } })
  wrappers.push(w); return { w, store, route }
}
test('all NICs use one paginated current-project query without a per-network request', async () => {
  const { w } = setup(); await flushPromises()
  expect(w.find('a').exists()).toBe(true)
  expect(getAPI).toHaveBeenCalledTimes(1)
  expect(getAPI).toHaveBeenCalledWith('listNetworks', { zoneid: 'zone', projectid: 'project', listall: true, ignoreproject: true, page: 1, pagesize: 500 }, { preserveOnFailure: true })
})
test('summary and NIC consumers share an in-flight request and authoritative refresh', async () => {
  let finish; getAPI.mockReturnValue(new Promise(resolve => { finish = resolve }))
  const first = setup(); const second = setup(false, first)
  const pending = second.w.vm.fetchVmNetworkAccess(); expect(getAPI).toHaveBeenCalledTimes(1)
  finish(page([{ id: 'shared' }])); await pending; await flushPromises()
  expect(first.w.find('a').exists()).toBe(true); expect(second.w.find('a').exists()).toBe(true)
  getAPI.mockResolvedValue(page([])); await second.w.vm.fetchVmNetworkAccess(); await flushPromises()
  expect(first.w.find('a').exists()).toBe(false); expect(second.w.find('a').exists()).toBe(false)
  expect(first.w.text()).toContain('Shared network'); expect(first.w.vm.vmNetworkAccessStatus).toBe('ready')
})
test('a failed refresh removes old allowed links, distinguishes absence, and can retry', async () => {
  const { w } = setup(); await flushPromises()
  getAPI.mockRejectedValue(new Error('offline')); await w.vm.fetchVmNetworkAccess(); await flushPromises()
  expect(w.find('a').exists()).toBe(false); expect(w.find('[role="status"]').exists()).toBe(true)
  getAPI.mockResolvedValue(page([])); await w.vm.fetchVmNetworkAccess(); await flushPromises()
  expect(w.find('[role="status"]').exists()).toBe(false); expect(w.find('a').exists()).toBe(false)
  getAPI.mockResolvedValue(page([{ id: 'shared' }])); await w.vm.fetchVmNetworkAccess(); await flushPromises()
  expect(w.find('a').exists()).toBe(true)
})
test.each(['project', 'user', 'login', 'role', 'api', 'route', 'vm', 'unmount'])('late result cannot restore links after %s changes', async change => {
  let finish; getAPI.mockReturnValue(new Promise(resolve => { finish = resolve }))
  const { w, store, route } = setup()
  getAPI.mockResolvedValue(page([]))
  if (change === 'project') store.getters.project = { id: 'other' }
  if (change === 'user') store.getters.userInfo.id = 'other'
  if (change === 'login') store.state.user.token = 'next'
  if (change === 'role') store.getters.userInfo.roleid = 'restricted'
  if (change === 'api') store.getters.apis = {}
  if (change === 'route') route.path = '/vm/other'
  if (change === 'vm') await w.setProps({ resource: { ...resource, id: 'other' } })
  if (change === 'unmount') { w.unmount(); wrappers = [] }
  await flushPromises(); finish(page([{ id: 'shared' }])); await flushPromises()
  if (change !== 'unmount') expect(w.find('a').exists()).toBe(false)
})
test('unmount removes cached permission results before a fresh visit', async () => {
  const first = setup(); await flushPromises(); expect(first.w.find('a').exists()).toBe(true)
  first.w.unmount(); wrappers = []
  getAPI.mockResolvedValue(page([])); const next = setup(); await flushPromises()
  expect(getAPI).toHaveBeenCalledTimes(2); expect(next.w.find('a').exists()).toBe(false)
})
test('all pages must succeed before any allowed link is published', async () => {
  getAPI.mockImplementation(async (api, p) => p.page === 1 ? { listnetworksresponse: { count: 2, network: [{ id: 'shared' }] } } : Promise.reject(new Error('second page failed')))
  const { w } = setup(); await flushPromises(); expect(getAPI).toHaveBeenCalledTimes(2)
  expect(w.find('a').exists()).toBe(false); expect(w.vm.vmNetworkAccessFailed).toBe(true)
})
test('static and non-VM summaries never query networks', async () => {
  const { w, route } = setup(false); route.path = '/router/id'; route.meta.name = 'router'; await flushPromises()
  await w.vm.fetchVmNetworkAccess(); expect(getAPI).not.toHaveBeenCalled()
})
