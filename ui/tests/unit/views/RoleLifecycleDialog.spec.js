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

/** @jest-environment jsdom */

import { shallowMount } from '@vue/test-utils'
import { getAPI, postAPI } from '@/api'
import RoleLifecycleDialog from '@/views/iam/RoleLifecycleDialog.vue'
import { canRoleAction, roleEditFields, roleUsageParams } from '@/utils/roleActions'

jest.mock('@/api', () => ({ getAPI: jest.fn(), postAPI: jest.fn() }))

const role = { id: 'id', name: 'Role', type: 'User', state: 'enabled', isdefault: false, inuse: false }
const apis = {
  disableRole: {},
  enableRole: {},
  deleteRole: {},
  createRolePermission: {},
  updateRolePermission: {},
  listRoles: { params: [{ name: 'showusage' }] }
}
const response = value => ({ listrolesresponse: { role: [value] } })

function open (api = 'disableRole', target = role) {
  return shallowMount(RoleLifecycleDialog, {
    props: { resource: target, currentAction: { api, label: api } },
    global: {
      renderStubDefaultSlot: true,
      mocks: {
        $t: key => key,
        $message: { success: jest.fn() },
        $route: { path: '/role/id', meta: { name: 'role' }, params: { id: 'id' } },
        $router: { options: { history: { state: {} } }, replace: jest.fn() },
        $store: { getters: { apis } }
      },
      stubs: ['a-alert', 'a-button']
    }
  })
}

beforeEach(() => { getAPI.mockReset(); postAPI.mockReset() })

it('follows default, assignment, state and API conditions separately', () => {
  const attached = { ...role, inuse: true }
  const builtin = { ...role, isdefault: true }
  expect(canRoleAction('deleteRole', attached, apis)).toBe(false)
  expect(canRoleAction('deleteRole', builtin, apis)).toBe(false)
  expect(canRoleAction('deleteRole', { ...role, inuse: undefined }, apis)).toBe(false)
  expect(canRoleAction('deleteRole', role, apis)).toBe(true)
  expect(canRoleAction('disableRole', builtin, apis)).toBe(true)
  expect(canRoleAction('disableRole', attached, apis)).toBe(true)
  expect(canRoleAction('enableRole', attached, apis)).toBe(false)
  expect(canRoleAction('enableRole', { ...attached, state: 'disabled' }, apis)).toBe(true)
  expect(canRoleAction('updateRolePermission', builtin, apis)).toBe(false)
  expect(canRoleAction('createRolePermission', attached, apis)).toBe(true)
  expect(canRoleAction('deleteRolePermission', role, apis)).toBe(false)
  expect(roleEditFields(builtin)).toEqual(['ispublic'])
  expect(roleEditFields(attached)).toEqual(['name', 'description', 'ispublic'])
  expect(roleUsageParams(apis)).toEqual({ showusage: true })
  expect(roleUsageParams({ listRoles: {} })).toEqual({})
})

it('blocks a newly assigned role on deletion before sending the mutation', async () => {
  const view = open('deleteRole')
  getAPI.mockResolvedValue(response({ ...role, inuse: true }))
  await view.vm.confirm()
  expect(getAPI.mock.calls[0].slice(0, 2)).toEqual(['listRoles', { id: 'id', showusage: true }])
  expect(postAPI).not.toHaveBeenCalled()
  expect(view.vm.stale).toBe(true)
  expect(view.vm.error).toBe('message.role.action.changed')
  expect(view.emitted('refresh-data')).toHaveLength(1)
  view.unmount()
})

it('shows a server error in the dialog and allows a one-request retry for the same target', async () => {
  const view = open()
  getAPI.mockResolvedValue(response(role))
  postAPI.mockRejectedValueOnce({ response: { data: { disableroleresponse: { errortext: 'Refused' } } } })
    .mockResolvedValueOnce({ disableroleresponse: { success: true } })
  await view.vm.confirm()
  expect(view.vm.error).toBe('Refused')
  expect(view.emitted('close-action')).toBeUndefined()
  await view.vm.confirm()
  expect(postAPI.mock.calls.map(call => call.slice(0, 2))).toEqual([
    ['disableRole', { id: 'id' }], ['disableRole', { id: 'id' }]
  ])
  expect(view.emitted('close-action')).toHaveLength(1)
  expect(view.emitted('refresh-data')).toHaveLength(1)
  view.unmount()
})
