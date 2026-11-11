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

import { shallowMount, flushPromises } from '@vue/test-utils'
import { reactive } from 'vue'
import Health from '@/views/infra/routers/RouterHealthCheck'
import MoldDialog from '@/components/view/MoldDialog'
import eventBus from '@/config/eventBus'
import { getAPI } from '@/api'
jest.mock('@/api', () => ({ getAPI: jest.fn() }))
const row = name => ({ checkname: name, result: true, status: 'Success', details: 'All checks pass' })
const result = name => ({ getrouterhealthcheckresultsresponse: { routerhealthchecks: { healthchecks: [row(name)] } } })
let wrappers
beforeEach(() => {
  wrappers = []; jest.clearAllMocks()
  getAPI.mockImplementation(async api => api === 'listConfigurations' ? { listconfigurationsresponse: { configuration: [{ name: 'router.health.checks.enabled', value: 'true' }] } } : result('initial'))
})
afterEach(() => wrappers.forEach(w => w.unmount()))
async function mount () {
  const getters = reactive({ project: { id: 'project' }, userInfo: { id: 'root', roleid: 'admin', roletype: 'Admin' }, apis: { listConfigurations: {}, getRouterHealthCheckResults: {} } })
  const route = reactive({ path: '/router/router', query: { tab: 'router.health.checks' } })
  const w = shallowMount(Health, { props: { resource: { id: 'router' } }, global: { mocks: { $t: k => k, $getApiParams: () => ({ performfreshchecks: { description: 'fresh' } }), $notifyError: jest.fn(), $route: route, $store: { getters, state: { user: { token: 'session' } } } }, directives: { focus: {}, 'ctrl-enter': {} }, stubs: { MoldDialog: { name: 'MoldDialog', props: { size: String, formActions: Boolean }, template: '<div><slot/></div>' }, 'a-spin': { template: '<div><slot/></div>' }, 'a-form': { template: '<form><slot/></form>', methods: { validate: () => Promise.resolve(), scrollToField: jest.fn() } }, MoldDialogActions: { template: '<div><slot/></div>' } } } })
  wrappers.push(w); await flushPromises(); return { w, getters, route }
}
test('uses the VM dialog, vertical form and bounded compact table', async () => {
  const { w } = await mount(); w.vm.showGetHelathCheck(); await flushPromises()
  expect(w.findComponent(MoldDialog).props()).toMatchObject({ size: 'md', formActions: true })
  expect(w.findComponent({ name: 'ATable' }).attributes('size')).toBe('small')
  expect(w.find('.detail-tab-toolbar').exists()).toBe(true)
})
test('cached update does not request a fresh run', async () => {
  const { w } = await mount(); getAPI.mockClear(); await w.vm.getHealthChecks()
  expect(getAPI).toHaveBeenCalledWith('getRouterHealthCheckResults', { routerid: 'router' }, { preserveOnFailure: true })
})
test('fresh run keeps dialog busy, prevents duplicates, and closes after success', async () => {
  const { w } = await mount(); w.vm.showGetHelathCheck(); await flushPromises(); w.vm.form.performfreshchecks = true
  let finish; getAPI.mockImplementationOnce(() => new Promise(resolve => { finish = resolve })); const before = getAPI.mock.calls.length
  const pending = w.vm.handleGetHealthChecksSubmit({ preventDefault: jest.fn() }); await flushPromises()
  expect(w.vm.showGetHealthChecksForm).toBe(true); expect(w.vm.healthChecks).toEqual([row('initial')]); w.vm.onCloseGetHealthChecksForm()
  expect(w.vm.showGetHealthChecksForm).toBe(true); await w.vm.handleGetHealthChecksSubmit({ preventDefault: jest.fn() }); expect(getAPI.mock.calls.length).toBe(before + 1)
  finish(result('fresh')); await pending; await flushPromises(); expect(w.vm.healthChecks).toEqual([row('fresh')]); expect(w.vm.showGetHealthChecksForm).toBe(false)
})
test('failed refresh retains rows, draft and dialog and recovers on retry', async () => {
  const { w } = await mount(); w.vm.showGetHelathCheck(); await flushPromises(); w.vm.form.performfreshchecks = true
  getAPI.mockRejectedValueOnce(new Error('controlled 503')); await w.vm.handleGetHealthChecksSubmit({ preventDefault: jest.fn() }); await flushPromises()
  expect(w.vm.healthChecks).toEqual([row('initial')]); expect(w.vm.listRefreshFailed).toBe(true); expect(w.vm.showGetHealthChecksForm).toBe(true); expect(w.vm.form.performfreshchecks).toBe(true)
  await w.vm.handleGetHealthChecksSubmit({ preventDefault: jest.fn() }); await flushPromises(); expect(w.vm.listRefreshFailed).toBe(false); expect(w.vm.showGetHealthChecksForm).toBe(false)
})
test('permission removal clears rows and prevents reads and dialog execution', async () => {
  const { w, getters } = await mount(); delete getters.apis.getRouterHealthCheckResults; await flushPromises(); getAPI.mockClear()
  w.vm.showGetHelathCheck(); await w.vm.getHealthChecks(); expect(w.vm.healthChecks).toEqual([]); expect(w.vm.showGetHealthChecksForm).toBe(false); expect(getAPI).not.toHaveBeenCalled()
})
test('project transition clears immediately and does not revive late results', async () => {
  const { w, getters } = await mount(); let finish
  getAPI.mockImplementationOnce(() => new Promise(resolve => { finish = resolve })); const pending = w.vm.getHealthChecks(); await flushPromises()
  eventBus.emit('project-switch-start'); expect(w.vm.healthChecks).toEqual([]); expect(w.vm.canRead).toBe(false)
  getters.project.id = 'other'; await flushPromises(); finish(result('old')); await pending; expect(w.vm.healthChecks).toEqual([])
  eventBus.emit('project-switch-end'); await flushPromises(); expect(w.vm.canRead).toBe(true); expect(w.vm.healthChecks).toEqual([row('initial')])
})
test('tab navigation discards late data and a return loads immediately', async () => {
  const { w, route } = await mount(); let finish
  getAPI.mockImplementationOnce(() => new Promise(resolve => { finish = resolve })); const pending = w.vm.getHealthChecks(); await flushPromises()
  route.query.tab = 'details'; await flushPromises(); finish(result('old')); await pending; expect(w.vm.healthChecks).toEqual([])
  route.query.tab = 'router.health.checks'; await flushPromises(); expect(w.vm.healthChecks).toEqual([row('initial')])
})
test('late configuration lookup cannot restore a switched context', async () => {
  const { w, getters } = await mount(); w.vm.routerHealthChecksEnabled = false; let finish
  getAPI.mockImplementationOnce(() => new Promise(resolve => { finish = resolve })); const pending = w.vm.checkConfigurationAndGetHealthChecks()
  delete getters.apis.getRouterHealthCheckResults; await flushPromises(); finish({ listconfigurationsresponse: { configuration: [{ value: 'true' }] } }); await pending
  expect(w.vm.routerHealthChecksEnabled).toBe(false); expect(w.vm.healthChecks).toEqual([])
})
