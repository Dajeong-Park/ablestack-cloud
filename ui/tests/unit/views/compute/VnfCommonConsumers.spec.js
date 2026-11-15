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

import { flushPromises } from '@vue/test-utils'
import Bmc from '@/views/compute/VmVbmcManager'
import Action from '@/components/view/ActionButton'
import { runVbmc, vbmcOperations } from '@/utils/vbmc'
import { getAPI, postAPI } from '@/api'
jest.mock('@/api', () => ({ getAPI: jest.fn(), postAPI: jest.fn() }))
jest.mock('@/utils/vbmc', () => ({ ...jest.requireActual('@/utils/vbmc'), runVbmc: jest.fn(async () => {}) }))
const vm = { id: '11111111-1111-4111-8111-111111111111', name: 'vnf', templatetype: 'VNF', state: 'Running', hypervisor: 'KVM', hostid: 'host', account: 'owner', domainid: 'domain', haenable: false }
const deferred = () => { let done; const promise = new Promise(resolve => { done = resolve }); return { promise, resolve: done } }
function bind (component, c) {
  Object.assign(c, component.data.call(c)); Object.entries(component.methods).forEach(([k, f]) => { c[k] = f.bind(c) }); Object.entries(component.computed).forEach(([k, f]) => { Object.defineProperty(c, k, { get: () => f.call(c) }) }); return c
}
const store = () => ({ state: { user: { token: 'session' } }, getters: { apis: { listVirtualMachines: {}, listConfigurations: {}, allocateVbmcToVM: {}, checkVbmcToVM: {}, removeVbmcToVM: {} }, userInfo: { id: 'actor', roletype: 'Admin' }, project: {}, features: { host: '10.10.31.10' } } })
function bmc () {
  const c = bind(Bmc, { resource: { ...vm }, $store: store(), $route: { fullPath: '/vnfapp/' + vm.id }, $emit: jest.fn(), resourceActionReady: () => true }); c.vm = { ...vm }; c.stale = false; c.mode = 'allocate'; c.password = 'synthetic-test'; return c
}
beforeEach(() => { jest.clearAllMocks(); for (const key of Object.keys(vbmcOperations)) delete vbmcOperations[key]; getAPI.mockResolvedValue({ listvirtualmachinesresponse: { virtualmachine: [{ ...vm }] } }) })
test('VNF BMC allocation rechecks the actual owner and platform before reusing the existing engine', async () => {
  const c = bmc(); await c.execute('allocateVbmcToVM'); expect(runVbmc).toHaveBeenCalledWith(c.scope, 'allocateVbmcToVM', expect.objectContaining({ virtualmachineid: vm.id, allowedcidr: '127.0.0.1/32' })); expect(c.password).toBe('')
  expect(getAPI.mock.calls[0][1]).toMatchObject({ id: vm.id, listall: true, details: 'all' })
})
test.each([{ account: 'other' }, { hypervisor: 'VMware' }, { hostcontrolstate: 'Offline' }, { haenable: true }])('a fresh BMC incompatibility %j prevents allocation', async patch => {
  const c = bmc(); getAPI.mockResolvedValue({ listvirtualmachinesresponse: { virtualmachine: [{ ...vm, ...patch }] } }); await c.execute('allocateVbmcToVM'); expect(runVbmc).not.toHaveBeenCalled()
})
test('BMC role/context change during an outstanding read cancels mutation and clears the password', async () => {
  const c = bmc(); const wait = deferred(); getAPI.mockReturnValue(wait.promise); const p = c.execute('allocateVbmcToVM'); c.$store.getters.userInfo.roletype = 'User'; Bmc.watch.context.handler.call(c); wait.resolve({ listvirtualmachinesresponse: { virtualmachine: [{ ...vm }] } }); await p; expect(runVbmc).not.toHaveBeenCalled(); expect(c.password).toBe(''); expect(c.disposed).toBe(true)
})
test('unverified parent context blocks all BMC mutation', async () => { const c = bmc(); c.resourceActionReady = () => false; await c.execute('removeVbmcToVM'); expect(getAPI).not.toHaveBeenCalled(); expect(runVbmc).not.toHaveBeenCalled() })
function wall () {
  const c = bind(Action, { resource: { ...vm }, selectedRowKeys: [], selectedItems: [], actions: [], dataView: true, $route: { name: 'vnfapp', meta: { name: 'vnfapp' } }, $store: store(), $t: k => k, resourceActionReady: () => true }); return c
}
const portal = [{ name: 'monitoring.wall.portal.vm.uri', value: '/d/uservm?kiosk' }, { name: 'monitoring.wall.portal.protocol', value: 'https' }, { name: 'monitoring.wall.portal.port', value: '8081' }]
test('VNF Wall entry is explicit when unconfigured or forbidden instead of disappearing', async () => {
  const c = wall(); postAPI.mockResolvedValue({ listconfigurationsresponse: {} }); c.updateWallLinkUrl(); await flushPromises(); expect(c.wallLinkReady).toBe(false); expect(c.wallLinkReason).toContain('unconfigured'); expect(c.dataViewMenuEntries.find(e => e.key === 'built-in-wall')).toMatchObject({ disabled: true })
  delete c.$store.getters.apis.listConfigurations; c.updateWallLinkUrl(); expect(c.wallLinkReason).toContain('permission')
})
test('late Wall settings from an old target never replace the current target link', async () => {
  const c = wall(); const a = deferred(); postAPI.mockReturnValueOnce(a.promise).mockResolvedValue({ listconfigurationsresponse: { configuration: portal } }); c.updateWallLinkUrl(); c.resource = { ...vm, id: '22222222-2222-4222-8222-222222222222' }; c.updateWallLinkUrl(); await flushPromises(); const current = c.wallLinkUrl; a.resolve({ listconfigurationsresponse: { configuration: portal } }); await flushPromises(); expect(c.wallLinkUrl).toBe(current); expect(current).toContain(c.resource.id); expect(current).not.toContain(vm.id)
})
test('old Wall menu callbacks cannot open another project or a stale target', async () => {
  const c = wall(); postAPI.mockResolvedValue({ listconfigurationsresponse: { configuration: portal } }); c.updateWallLinkUrl(); await flushPromises(); const entry = c.dataViewMenuEntries.find(e => e.key === 'built-in-wall'); const open = jest.spyOn(window, 'open').mockImplementation(() => null); c.$store.getters.project = { id: 'new-project' }; entry.handler(); expect(open).not.toHaveBeenCalled(); open.mockRestore()
})
test('the common VM link is UUID-bound and refuses old project callbacks', () => {
  const c = wall(); c.$router = { push: jest.fn() }; const entry = c.dataViewMenuEntries.find(e => e.key === 'built-in-vm-management'); entry.handler(); expect(c.$router.push).toHaveBeenCalledWith('/vm/' + vm.id)
  c.$router.push.mockClear(); c.$store.getters.project = { id: 'another' }; entry.handler(); expect(c.$router.push).not.toHaveBeenCalled()
})
