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
import { reactive } from 'vue'
import Summary from '@/components/view/KubernetesIsoSummary'
import { getAPI } from '@/api'
jest.mock('@/api', () => ({ getAPI: jest.fn() }))
const id = '11111111-1111-4111-8111-111111111111'
const iso = '22222222-2222-4222-8222-222222222222'
const zone = '33333333-3333-4333-8333-333333333333'
const record = { id, name: 'version', isoid: iso, isoname: 'binaries', zoneid: zone, catalog: { zone: { kind: 'zone', id: zone } } }
const response = child => ({ listisosresponse: { count: 1, iso: [{ id: child, zoneid: zone, isready: true }] } })
let wrappers
beforeEach(() => { jest.useFakeTimers(); getAPI.mockReset(); wrappers = [] })
afterEach(() => { wrappers.forEach(w => w.unmount()); jest.useRealTimers() })
function setup (allowed = true) {
  const store = reactive({ getters: { userInfo: { id: 'actor', roleid: 'role', roletype: 'Admin' }, apis: { listKubernetesSupportedVersions: {}, ...(allowed ? { listIsos: {} } : {}) } }, state: { user: { token: 'runtime-session' } } })
  const route = reactive({ meta: { name: 'kubernetesiso' }, path: '/kubernetesiso/' + id, params: { id }, query: {} })
  const w = mount(Summary, { props: { resource: { ...record }, loading: false }, global: { mocks: { $store: store, $route: route, $t: key => key, $router: { resolve: () => ({ matched: [{}] }) } }, stubs: { KubernetesIsoStatus: true, KubernetesIsoScope: true, 'router-link': true } } })
  wrappers.push(w); return { w, store, route }
}
test('catalog-only view publishes permission state and never calls listIsos', async () => {
  const { w } = setup(false); await flushPromises()
  expect(getAPI).not.toHaveBeenCalled()
  expect(w.vm.observation.status).toBe('forbidden')
  expect(w.vm.isoLink).toBeNull()
  expect(w.html()).not.toContain('runtime-session')
})
test('tab changes share one read; refresh while pending cannot duplicate it', async () => {
  let release; getAPI.mockReturnValue(new Promise(resolve => { release = resolve }))
  const { w, route } = setup(); route.query.tab = 'zones'; await w.vm.$nextTick()
  const first = w.vm.refresh(); const second = w.vm.refresh()
  expect(first).toBe(second); expect(getAPI).toHaveBeenCalledTimes(1)
  release(response(iso)); await first; await flushPromises()
  expect(w.vm.observation.status).toBe('ready')
  expect(w.vm.isoLink).toEqual({ path: '/iso/' + iso })
})
test('revoking child read permission clears rows and ignores an old successful read', async () => {
  let release; getAPI.mockReturnValue(new Promise(resolve => { release = resolve }))
  const { w, store } = setup()
  store.getters.apis = { listKubernetesSupportedVersions: {} }; await flushPromises()
  expect(w.vm.observation.status).toBe('forbidden')
  release(response(iso)); await flushPromises()
  expect(w.vm.observation.status).toBe('forbidden'); expect(w.vm.observation.rows).toEqual([])
  expect(w.vm.pending).toBe(false)
  jest.advanceTimersByTime(30000); await flushPromises(); expect(getAPI).toHaveBeenCalledTimes(1)
})
test('another child and resource cannot receive a delayed prior response', async () => {
  let release; getAPI.mockReturnValueOnce(new Promise(resolve => { release = resolve }))
  getAPI.mockResolvedValue(response(id))
  const { w, route } = setup()
  route.params.id = iso; route.path = '/kubernetesiso/' + iso
  await w.setProps({ resource: { ...record, id: iso, isoid: id } }); await flushPromises()
  expect(w.vm.observation).toMatchObject({ versionid: iso, isoid: id, status: 'ready' })
  release(response(iso)); await flushPromises()
  expect(w.vm.observation).toMatchObject({ versionid: iso, isoid: id, status: 'ready' })
})
test('same-scope refresh failure does not continue presenting Ready', async () => {
  getAPI.mockResolvedValueOnce(response(iso)).mockRejectedValueOnce(new Error('offline'))
  const { w } = setup(); await flushPromises(); expect(w.vm.observation.status).toBe('ready')
  await w.vm.refresh(); await flushPromises()
  expect(w.vm.observation.status).toBe('network'); expect(w.vm.isoLink).toBeNull()
})
test('expired, incomplete and empty responses remain distinct and retry can recover', async () => {
  getAPI.mockRejectedValueOnce({ response: { status: 401 } }).mockResolvedValueOnce({ listisosresponse: { count: 2, iso: [] } }).mockResolvedValueOnce({ listisosresponse: { count: 0 } }).mockResolvedValueOnce(response(iso))
  const { w } = setup(); await flushPromises(); expect(w.vm.observation.status).toBe('expired')
  await w.vm.refresh(); expect(w.vm.observation.status).toBe('invalid')
  await w.vm.refresh(); expect(w.vm.observation.status).toBe('empty')
  await w.vm.refresh(); expect(w.vm.observation.status).toBe('ready')
})
test('quiet polling retains confirmed Zone rows until a new result is available', async () => {
  let release; getAPI.mockImplementationOnce(() => Promise.resolve(response(iso))).mockImplementationOnce(() => new Promise(resolve => { release = resolve }))
  const { w } = setup(); await flushPromises(); expect(w.vm.observation.status).toBe('ready'); expect(getAPI).toHaveBeenCalledTimes(1); expect(w.vm.observation.context).toBe(w.vm.context); const pending = w.vm.refresh()
  expect(w.vm.observation).toMatchObject({ status: 'ready', refreshing: true })
  expect(w.vm.observation.rows).toHaveLength(1)
  release(response(iso)); await pending; expect(w.vm.observation.refreshing).toBe(false)
})
test('unmount cancels publication and stops automatic refresh', async () => {
  let release; getAPI.mockReturnValue(new Promise(resolve => { release = resolve }))
  const { w } = setup(); const publish = jest.spyOn(w.vm, 'publish')
  w.unmount(); wrappers = []
  release(response(iso)); await flushPromises(); jest.advanceTimersByTime(30000); await flushPromises()
  expect(publish).not.toHaveBeenCalled(); expect(getAPI).toHaveBeenCalledTimes(1)
})
