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
import Picker from '@/components/view/VnfSearchSelect'
import { getAPI } from '@/api'
jest.mock('@/api', () => ({ getAPI: jest.fn() }))
const id = '11111111-1111-4111-8111-111111111111'
const other = '22222222-2222-4222-8222-222222222222'
const template = { id, name: '<img src=x onerror=1>', displaytext: 'VNF', templatetype: 'VNF', zoneid: id }
let state, getters, wrapper
function create (props = {}) {
  state = reactive({ user: { token: 'session' } }); getters = reactive({ project: {}, listAllProjects: false, userInfo: { id: 'actor', roletype: 'Admin' }, apis: { listVnfTemplates: {}, listAccounts: {} } })
  const fields = Object.fromEntries(['id', 'zoneid', 'domainid', 'account', 'templatefilter', 'projectid', 'listall', 'isrecursive'].map(k => [k, {}]))
  wrapper = shallowMount(Picker, { props: { kind: 'templateid', scope: { zoneid: id, projectid: '0' }, ...props }, global: { mocks: { $store: { state, getters }, $route: { path: '/vnfapp' }, $getApiParams: () => fields, $t: k => k } } })
  return wrapper
}
beforeEach(() => { jest.clearAllMocks(); getAPI.mockResolvedValue({ listvnftemplatesresponse: { count: 1, template: [template] } }) })
afterEach(() => { if (wrapper) wrapper.unmount() })
test('selected VNF lookup uses the VNF API, explicit owner and Zone, and emits a verified UUID', async () => {
  create(); await flushPromises(); expect(getAPI).toHaveBeenCalledWith('listVnfTemplates', expect.objectContaining({ templatefilter: 'all', zoneid: id, ignoreproject: true, page: 1, pagesize: 20 }), expect.any(Object))
  wrapper.vm.select({ value: id }); expect(wrapper.emitted('update:value')).toEqual([[id]]); expect(wrapper.find('img').exists()).toBe(false)
})
test('an unavailable selected UUID remains blocked until a successful exact lookup', async () => {
  getAPI.mockResolvedValue({ listvnftemplatesresponse: {} }); create({ value: id }); await flushPromises()
  expect(wrapper.vm.blocked).toBe(true); expect(wrapper.vm.selected).toBeNull(); expect(wrapper.vm.options).toEqual([])
  getAPI.mockResolvedValue({ listvnftemplatesresponse: { count: 1, template: [template] } }); await wrapper.vm.load(true); await flushPromises(); expect(wrapper.vm.blocked).toBe(false)
})
test('failed lookup is visibly retryable and never treats an old selection as verified', async () => {
  getAPI.mockRejectedValue(Error('offline')); create({ value: id }); await flushPromises()
  expect(wrapper.vm.error).toBe(true); expect(wrapper.vm.blocked).toBe(true); expect(wrapper.vm.options).toEqual([])
  getAPI.mockResolvedValue({ listvnftemplatesresponse: { count: 1, template: [template] } }); await wrapper.vm.load(true); expect(wrapper.vm.error).toBe(false); expect(wrapper.vm.selected.id).toBe(id)
})
test('a slower previous Zone response cannot restore names or UUIDs after a scope change', async () => {
  let done; getAPI.mockImplementationOnce(() => new Promise(resolve => { done = resolve })); create()
  await wrapper.setProps({ scope: { zoneid: other, projectid: '0' } }); await flushPromises()
  done({ listvnftemplatesresponse: { count: 1, template: [template] } }); await flushPromises()
  expect(wrapper.vm.rows).toEqual([]); expect(wrapper.vm.selected).toBeNull()
})
test.each(['token', 'role', 'project', 'permission'])('%s revocation invalidates an outstanding candidate response', async kind => {
  let done; getAPI.mockImplementationOnce(() => new Promise(resolve => { done = resolve })); create()
  getAPI.mockResolvedValue({ listvnftemplatesresponse: {} })
  if (kind === 'token') state.user.token = ''
  if (kind === 'role') getters.userInfo.roletype = 'User'
  if (kind === 'project') getters.project = { id: other }
  if (kind === 'permission') getters.apis = {}
  expect(wrapper.vm.selected).toBeNull()
  await flushPromises(); done({ listvnftemplatesresponse: { count: 1, template: [template] } }); await flushPromises()
  expect(wrapper.vm.rows).toEqual([]); expect(wrapper.vm.selected).toBeNull()
})
test('an account candidate requires an explicit domain and never performs an unbounded account lookup', async () => {
  create({ kind: 'account' }); await flushPromises(); expect(wrapper.vm.allowed).toBe(false); expect(getAPI).not.toHaveBeenCalled()
})
test('pagination appends distinct pages and rejects a changing count or duplicate page', async () => {
  create(); await flushPromises()
  getAPI.mockResolvedValueOnce({ listvnftemplatesresponse: { count: 2, template: [{ ...template, id: other }] } }); await wrapper.vm.load(false)
  expect(wrapper.vm.error).toBe(true); expect(wrapper.vm.rows).toEqual([])
})
test('selection cannot be fabricated by emitting an arbitrary option absent from current rows', async () => {
  create(); await flushPromises(); wrapper.vm.select({ value: other }); expect(wrapper.emitted('update:value')).toBeUndefined()
})
