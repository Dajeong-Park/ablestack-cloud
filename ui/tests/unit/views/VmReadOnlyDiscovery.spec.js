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

import { flushPromises } from '@vue/test-utils'
import { validateLinksAsync } from '@/utils/links'
import InstanceTab from '@/views/compute/InstanceTab'
import ActionButton from '@/components/view/ActionButton'
import { getAPI, postAPI } from '@/api'
jest.mock('@/api', () => ({ getAPI: jest.fn(), postAPI: jest.fn() }))
jest.mock('@/store', () => ({ getters: {}, state: { user: { token: 'session' } } }))
jest.mock('@/config/router', () => ({ asyncRouterMap: () => [], constantRouterMap: [] }))
const router = { resolve: () => ({ matched: [{}] }) }
const id = '12345678-1234-1234-1234-123456789abc'
beforeEach(() => { jest.clearAllMocks(); getAPI.mockResolvedValue({ listannotationsresponse: { annotation: [] } }) })

test('a VM reader does not probe template or ISO APIs it cannot read', async () => {
  const result = await validateLinksAsync(router, false, { templateid: 'template', isoid: 'iso' }, () => false)
  expect(result).toMatchObject({ template: false, iso: false })
  expect(getAPI).not.toHaveBeenCalled()
})
test('image validation rechecks the current grant before publishing a late link', async () => {
  let finish; let allowed = true
  getAPI.mockImplementation(() => new Promise(resolve => { finish = resolve }))
  const result = validateLinksAsync(router, false, { templateid: 'template' }, () => allowed)
  allowed = false; finish({ listtemplatesresponse: { template: [{ id: 'template' }] } })
  expect((await result).template).toBe(false)
})
function instance (apis) {
  return { $store: { getters: { apis } }, vm: { id }, dataResource: { id }, resource: { id }, annotations: [], listRefreshDisposed: false, securityGroupNetworkProviderUseThisVM: false }
}
test('basic-only VM detail needs neither annotation nor network discovery grants', async () => {
  const c = instance({ listVirtualMachines: {} })
  await InstanceTab.methods.fetchData.call(c); await flushPromises()
  expect(getAPI).not.toHaveBeenCalled()
  expect(c.annotations).toEqual([])
})
test('allowed annotations remain independent from provider network discovery', async () => {
  const c = instance({ listVirtualMachines: {}, listAnnotations: {} })
  await InstanceTab.methods.fetchData.call(c); await flushPromises()
  expect(getAPI).toHaveBeenCalledTimes(1)
  expect(getAPI.mock.calls[0][0]).toBe('listAnnotations')
})
test('provider discovery keeps both independent read grants and uses the same VM identity', async () => {
  const c = instance({ listVirtualMachines: {}, listNetworks: {} })
  getAPI.mockImplementation(async api => api === 'listNetworks' ? { listnetworksresponse: { network: [{ id: 'network' }] } } : { listvirtualmachinesresponse: { virtualmachine: [{ id }] } })
  await InstanceTab.methods.fetchData.call(c); await flushPromises()
  expect(getAPI).toHaveBeenCalledWith('listVirtualMachines', { id, networkid: 'network', listall: true })
  expect(c.securityGroupNetworkProviderUseThisVM).toBe(true)
})
test.each(['grant', 'resource'])('a late network result cannot query a VM after %s changes', async change => {
  const c = instance({ listVirtualMachines: {}, listNetworks: {} }); let finish
  getAPI.mockImplementation(() => new Promise(resolve => { finish = resolve }))
  await InstanceTab.methods.fetchData.call(c)
  if (change === 'grant') c.$store.getters.apis = { listVirtualMachines: {} }
  else c.dataResource = { id: 'other' }
  finish({ listnetworksresponse: { network: [{ id: 'network' }] } }); await flushPromises()
  expect(getAPI).toHaveBeenCalledTimes(1)
  expect(c.securityGroupNetworkProviderUseThisVM).toBe(false)
})
test.each(['vm', 'vnfapp', 'host', 'cluster'])('a %s detail never requests denied monitoring configuration', routeName => {
  const c = { routeName, resource: { id }, wallRequestVersion: 0, wallScope: 'scope', shouldShowWallLink: true, wallLinkReady: true, wallLinkUrl: 'old', $store: { getters: { apis: { listVirtualMachines: {} } } } }
  ActionButton.methods.updateWallLinkUrl.call(c)
  expect(postAPI).not.toHaveBeenCalled()
  expect(c.wallLinkReady).toBe(false)
  expect(c.wallLinkUrl).toBe('')
})
test('monitoring configuration remains available when its read API is granted', async () => {
  const c = { routeName: 'vm', resource: { id }, wallRequestVersion: 0, wallScope: 'scope', shouldShowWallLink: true, $store: { getters: { apis: { listConfigurations: {} }, features: { host: 'example.invalid' } } } }
  postAPI.mockResolvedValue({ listconfigurationsresponse: { configuration: [{ name: 'monitoring.wall.portal.vm.uri', value: '/dashboard?view=vm' }] } })
  ActionButton.methods.updateWallLinkUrl.call(c); await flushPromises()
  expect(postAPI).toHaveBeenCalledWith('listConfigurations', { keyword: 'monitoring.wall.portal' })
  expect(c.wallLinkReady).toBe(true)
  expect(c.wallLinkUrl).toContain('var-vm_uuid=' + id)
})
