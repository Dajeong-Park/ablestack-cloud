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

import Zones from '@/views/image/IsoZones'
import { isoContext } from '@/utils/isoModel'
import { getAPI } from '@/api'
jest.mock('@/api', () => ({ getAPI: jest.fn(), postAPI: jest.fn() }))
const resource = { id: 'image', projectid: 'owner-project', isready: true, zoneid: 'zone' }
function context (project = {}) {
  const token = { loaded: false }
  const vm = { resource: Object.freeze({ ...resource }), $store: { getters: { userInfo: { id: 'recipient', roletype: 'User' }, project, apis: { listIsos: {} } } }, page: 1, pageSize: 10, dataSource: [], itemCount: 0, selectedRowKeys: [], $emit: jest.fn(), $notifyError: jest.fn(), fetchZoneData: jest.fn(), fetchOsCategoryId: jest.fn(), updateImageZones: jest.fn(), setSelection: jest.fn(), listRequestToken: () => token, isListRequestCurrent: (_, value) => value === token }
  Object.defineProperty(vm, 'isoScope', { get: () => isoContext(vm.resource, vm.$store.getters) })
  return vm
}
beforeEach(() => { jest.clearAllMocks(); getAPI.mockResolvedValue({ listisosresponse: { iso: [resource], count: 1 } }) })
test('personal recipient of a project-owned ISO reads its row without assuming membership in the owner project', async () => {
  const vm = context(); await Zones.methods.fetchData.call(vm)
  expect(getAPI.mock.calls[0][1]).not.toHaveProperty('projectid')
  expect(vm.dataSource).toHaveLength(1); expect(vm.itemCount).toBe(1)
  expect(vm.dataSource[0].projectid).toBe('owner-project')
  expect(vm.$notifyError).not.toHaveBeenCalled()
})
test('active project identity is preserved independently from image ownership', async () => {
  const vm = context({ id: 'active-project' }); await Zones.methods.fetchData.call(vm)
  expect(getAPI.mock.calls[0][1]).toMatchObject({ projectid: 'active-project', id: 'image', showunique: false })
  expect(vm.resource.projectid).toBe('owner-project')
})
test('a late personal read cannot populate a newly selected project', async () => {
  let finish; getAPI.mockReturnValueOnce(new Promise(resolve => { finish = resolve }))
  const vm = context(); const old = Zones.methods.fetchData.call(vm)
  vm.$store.getters.project = { id: 'next-project' }; finish({ listisosresponse: { iso: [resource], count: 1 } }); await old
  expect(vm.dataSource).toEqual([]); expect(vm.$emit).not.toHaveBeenCalled()
})
