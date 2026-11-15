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

import { readVmUserData, vmUserDataSupported } from '@/utils/vmUserData'
import Content from '@/views/compute/UserDataContent.vue'
import { getAPI } from '@/api'
jest.mock('@/api', () => ({ getAPI: jest.fn() }))
const vm = { id: '11111111-1111-4111-8111-111111111111', account: 'user', domainid: '22222222-2222-4222-8222-222222222222', userdataid: '33333333-3333-4333-8333-333333333333', userdataname: 'source', userdata: '77u/7ZWc6riA8J+YgA0K' }
const apis = { getVirtualMachineUserData: { params: [{ name: 'virtualmachineid' }] }, listVirtualMachines: {}, listUserData: {} }
let get
const metadata = value => ({ listvirtualmachinesresponse: { count: 1, virtualmachine: [value] } })
beforeEach(() => {
  jest.clearAllMocks()
  get = jest.fn(async api => api === 'getVirtualMachineUserData' ? { getvirtualmachineuserdataresponse: { virtualmachineuserdata: { virtualmachineid: vm.id, userdata: vm.userdata } } } : api === 'listUserData' ? { listuserdataresponse: { count: 1, userdata: [{ id: vm.userdataid, name: vm.userdataname, account: vm.account, domainid: vm.domainid, userdata: vm.userdata }] } } : metadata(vm))
})
test('API schema determines access for any role, malformed metadata never grants access', () => {
  expect(vmUserDataSupported(apis)).toBe(true)
  for (const value of [{}, { getVirtualMachineUserData: {} }, { getVirtualMachineUserData: { params: {} } }, { getVirtualMachineUserData: { params: [] } }]) expect(vmUserDataSupported(value)).toBe(false)
})
test('stored body read is UUID bound, checks revision before and after, compares exact bytes', async () => {
  const value = await readVmUserData(get, vm, apis, () => true)
  expect(value.comparison).toBe('same'); expect(value.content.text).toBe('\ufeff한글😀\r\n')
  expect(get.mock.calls.map(c => c[0])).toEqual(['listVirtualMachines', 'getVirtualMachineUserData', 'listVirtualMachines', 'listUserData', 'listVirtualMachines'])
  expect(get.mock.calls[1][1]).toEqual({ virtualmachineid: vm.id }); expect(get.mock.calls[0][1]).toMatchObject({ id: vm.id, userdata: true })
})
test('source difference is byte-level, never an execution result', async () => {
  const base = get; const call = (api, ...rest) => api === 'listUserData' ? Promise.resolve({ listuserdataresponse: { count: 1, userdata: [{ id: vm.userdataid, name: vm.userdataname, account: vm.account, domainid: vm.domainid, userdata: 'Cg==' }] } }) : base(api, ...rest)
  expect((await readVmUserData(call, vm, apis, () => true)).comparison).toBe('different')
})
test.each(['denied', 'deleted', 'wrong-owner', 'invalid'])('unavailable original %s does not hide the permitted VM body or claim equality', async reason => {
  const base = get; const call = (api, ...rest) => {
    if (api !== 'listUserData') return base(api, ...rest)
    if (reason === 'denied') return Promise.reject(Object.assign(new Error('denied'), { response: { status: 403 } }))
    return Promise.resolve({ listuserdataresponse: { count: reason === 'deleted' ? 0 : 1, userdata: reason === 'deleted' ? [] : [{ id: vm.userdataid, name: vm.userdataname, account: reason === 'wrong-owner' ? 'other' : vm.account, domainid: vm.domainid, userdata: '@@' }] } })
  }
  const result = await readVmUserData(call, vm, apis, () => true); expect(result.comparison).toBe('unavailable'); expect(result.content.encoded).toBe(vm.userdata)
})
test('no library API still reads stored body; absent metadata permits UUID checked body without comparison', async () => {
  expect((await readVmUserData(get, vm, { ...apis, listUserData: undefined }, () => true)).comparison).toBe('unavailable')
  get.mockClear(); const result = await readVmUserData(get, vm, { getVirtualMachineUserData: apis.getVirtualMachineUserData }, () => true); expect(result.comparison).toBe('unavailable'); expect(get).toHaveBeenCalledTimes(1)
})
test.each(['id', 'account', 'domainid', 'projectid'])('wrong VM %s metadata fails closed', async field => {
  get.mockResolvedValue(metadata({ ...vm, [field]: 'other' })); await expect(readVmUserData(get, vm, apis, () => true)).rejects.toMatchObject({ contentState: 'mismatch' })
})
test.each(['userdata', 'userdataid', 'userdatadetails', 'userdatapolicy', 'account'])('revision change of %s during fetch is rejected', async field => {
  const base = get; let n = 0
  const call = (api, ...rest) => api === 'listVirtualMachines' ? Promise.resolve(metadata(++n === 1 ? vm : { ...vm, [field]: 'changed' })) : base(api, ...rest)
  await expect(readVmUserData(call, vm, apis, () => true)).rejects.toMatchObject({ contentState: 'mismatch' })
})
test('VM deletion during optional source comparison clears previously fetched body', async () => {
  const base = get; let n = 0
  const call = (api, ...rest) => api === 'listVirtualMachines' && ++n === 3 ? Promise.resolve({ listvirtualmachinesresponse: {} }) : base(api, ...rest)
  await expect(readVmUserData(call, vm, apis, () => true)).rejects.toMatchObject({ contentState: 'missing' })
})
test('late scope invalidation discards body before any additional request', async () => {
  let active = true
  const call = async (...args) => { const result = await get(...args); active = false; return result }
  expect(await readVmUserData(call, vm, apis, () => active)).toBeUndefined(); expect(get).toHaveBeenCalledTimes(1)
})
test('mismatched stored response ID is never shown', async () => {
  const base = get; const call = (api, ...rest) => api === 'getVirtualMachineUserData' ? Promise.resolve({ getvirtualmachineuserdataresponse: { virtualmachineuserdata: { virtualmachineid: 'other', userdata: vm.userdata } } }) : base(api, ...rest)
  await expect(readVmUserData(call, vm, apis, () => true)).rejects.toMatchObject({ contentState: 'mismatch' })
})
test.each(['', '/wAB'])('empty or binary VM body %s uses the same strict viewer', async encoded => {
  const value = { ...vm, userdata: encoded, userdataid: undefined }
  const call = async api => api === 'getVirtualMachineUserData' ? { getvirtualmachineuserdataresponse: { virtualmachineuserdata: { virtualmachineid: vm.id, userdata: encoded } } } : metadata(value)
  const result = await readVmUserData(call, value, apis, () => true); expect(result.comparison).toBe('unlinked'); expect(result.content.empty).toBe(encoded === ''); if (encoded) expect(result.content.text).toBeNull()
})
test('project scope is explicit on each metadata read', async () => {
  const value = { ...vm, projectid: '44444444-4444-4444-8444-444444444444' }; const base = get
  const call = async (api, params, options) => api === 'listVirtualMachines' ? metadata(value) : base(api, params, options)
  const spy = jest.fn(call); await readVmUserData(spy, value, apis, () => true)
  expect(spy.mock.calls.filter(c => c[0] === 'listVirtualMachines').every(c => c[1].projectid === value.projectid)).toBe(true)
})
test('VM controller retains stale body only for recoverable errors and disables export', async () => {
  const c = { resource: vm, sourceType: 'vm', tab: 'userdata.content', resourceActionReady: () => true, $route: { path: '/vm/' + vm.id }, $store: { getters: { apis, userInfo: { id: 'u' }, project: {} }, state: { user: { token: 's' } } } }
  Object.assign(c, Content.data.call(c)); Object.entries(Content.methods).forEach(([key, fn]) => { c[key] = fn.bind(c) }); Object.entries(Content.computed).forEach(([key, fn]) => { Object.defineProperty(c, key, { get: () => fn.call(c) }) })
  getAPI.mockImplementation(get); await c.fetchData(); expect(c.status).toBe('ready'); expect(c.comparison).toBe('same')
  getAPI.mockRejectedValue({ response: { status: 503 } }); await c.fetchData(); expect(c.content).not.toBeNull(); expect(c.exportable).toBe(false); expect(c.comparison).toBe('unavailable')
  getAPI.mockRejectedValue({ response: { status: 403 } }); await c.fetchData(); expect(c.content).toBeNull(); expect(c.status).toBe('forbidden'); expect(c.vm).toBeNull()
  c.resourceActionReady = () => false; getAPI.mockClear(); await c.fetchData(); expect(getAPI).not.toHaveBeenCalled(); expect(c.exportable).toBe(false)
  c.content = { encoded: 'old-body', text: 'old-body' }; Content.watch.parentReadReady.call(c, false); expect(c.content).toBeNull()
})

test('metadata permission denial does not block independently permitted stored body access', async () => {
  const base = get; const call = (api, ...rest) => api === 'listVirtualMachines' ? Promise.reject(Object.assign(new Error('metadata denied'), { response: { status: 403 } })) : base(api, ...rest)
  const value = await readVmUserData(call, vm, apis, () => true); expect(value.content.encoded).toBe(vm.userdata); expect(value.comparison).toBe('unavailable')
})
