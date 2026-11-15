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
import { Select, Input, Button, Alert, Form, Spin, Tag, Checkbox } from 'ant-design-vue'
import Permissions from '@/views/image/UpdateTemplateIsoPermissions'
import { imagePermissionResponse, permissionTargetOptions, expectedImagePermissions, canManageImagePermissions } from '@/utils/imagePermissions'
import { getAPI, postAPI } from '@/api'
jest.mock('@/api', () => ({ getAPI: jest.fn(), postAPI: jest.fn() }))
const id = 'image'
const resource = { id, account: 'owner', domainid: 'domain', isready: true, format: 'QCOW2', ispublic: false, isextractable: true }
const apis = Object.fromEntries(['listTemplatePermissions', 'updateTemplatePermissions', 'listIsoPermissions', 'updateIsoPermissions', 'listAccounts', 'listProjects'].map(x => [x, {}]))
function context (extra = {}) {
  const c = { ...Permissions.data(), resource, $route: { meta: { name: 'template' } }, $store: { getters: { userInfo: { id: 'actor', account: 'owner', domainid: 'domain', roletype: 'User' }, apis, features: { allowuserviewalldomainaccounts: 'false' }, project: {} }, state: { user: { token: 'fixture' } } }, $t: k => k, $emit: jest.fn(), parentFetchData: jest.fn(), $notification: { success: jest.fn() }, ...extra }
  Object.entries(Permissions.methods).forEach(([key, fn]) => { c[key] = fn.bind(c) })
  Object.entries(Permissions.computed).forEach(([key, fn]) => Object.defineProperty(c, key, { get: () => fn.call(c), configurable: true }))
  c.grants = { id, accounts: [], projects: [], ispublic: false }; c.permissionValid = true
  return c
}
let state
const response = () => ({ id, account: [...state.accounts], projectids: [...state.projects], ispublic: state.ispublic || false })
beforeEach(() => {
  jest.clearAllMocks(); state = { accounts: [], projects: [] }
  getAPI.mockImplementation(async name => name === 'listAccounts' ? { listaccountsresponse: { account: [] } } : name === 'listProjects' ? { listprojectsresponse: { project: [] } } : { [name === 'listIsoPermissions' ? 'listisopermissionsresponse' : 'listtemplatepermissionsresponse']: response() })
  postAPI.mockImplementation(async (name, params) => {
    const key = params.accounts ? 'accounts' : 'projects'; const values = (params.accounts || params.projectids || '').split(',').filter(Boolean)
    if (params.op === 'reset') state = { accounts: [], projects: [], ispublic: false }
    else if (params.op === 'remove') state[key] = state[key].filter(x => !values.includes(x))
    else state[key] = [...new Set([...state[key], ...values])]
    return {}
  })
})
test.each(['iso', 'template'])('actual single response root is normalized for %s and optional empty lists are valid', kind => {
  const root = kind === 'iso' ? 'listisopermissionsresponse' : 'listtemplatepermissionsresponse'
  expect(imagePermissionResponse(kind, { [root]: { id, account: ['recipient'], projectids: ['p'] } }, id)).toMatchObject({ accounts: ['recipient'], projects: ['p'] })
  expect(imagePermissionResponse(kind, { [root]: { id } }, id)).toMatchObject({ accounts: [], projects: [] })
  expect(imagePermissionResponse(kind, { [root]: { templatepermission: { id, account: ['recipient'] } } }, id).accounts).toEqual(['recipient'])
})
test.each([{}, { listisopermissionsresponse: {} }, { listisopermissionsresponse: { id: 'wrong' } }, { listisopermissionsresponse: { id, account: 'recipient' } }, { listisopermissionsresponse: { id, projectids: [null] } }, { listisopermissionsresponse: { id, errorcode: 530 } }])('invalid permission response never becomes an empty success: %j', json => {
  expect(() => imagePermissionResponse('iso', json, id)).toThrow()
})
test('remove targets come from grants even when account/project inventory is restricted or missing', () => {
  const grants = { id, accounts: ['hidden-recipient'], projects: ['hidden-project'] }
  expect(permissionTargetOptions(grants, [], 'remove', 'Account')).toEqual([{ value: 'hidden-recipient', label: 'hidden-recipient' }])
  expect(permissionTargetOptions(grants, [], 'remove', 'Project')).toEqual([{ value: 'hidden-project', label: 'hidden-project' }])
})
test.each(['iso', 'template'])('%s account add/remove preserves other recipients and flags and verifies the final state', async kind => {
  const c = context({ resource: { ...resource, format: kind === 'iso' ? 'ISO' : 'QCOW2' }, selectedTargets: ['b'], selectedOperation: 'remove' })
  state = { accounts: ['a', 'b', 'c'], projects: ['project'] }; c.grants = { id, ...state, ispublic: false }
  await c.submitData(); expect(c.success).toBe(true); expect(c.grants.accounts).toEqual(['a', 'c']); expect(c.grants.projects).toEqual(['project'])
  expect(postAPI).toHaveBeenCalledWith(kind === 'iso' ? 'updateIsoPermissions' : 'updateTemplatePermissions', { id, op: 'remove', accounts: 'b' }, { preserveOnFailure: true })
})
test('project UUID choices keep same-name projects separate and selective revoke preserves another project', async () => {
  const c = context({ selectedOperation: 'remove', selectedShareWith: 'Project', selectedTargets: ['p2'] }); state = { accounts: ['account'], projects: ['p1', 'p2'] }; c.grants = { id, ...state, ispublic: false }
  c.projects = [{ id: 'p1', name: 'same' }, { id: 'p2', name: 'same' }]
  expect(c.targetOptions.map(x => x.value)).toEqual(['p1', 'p2'])
  await c.submitData(); expect(c.grants.projects).toEqual(['p1']); expect(c.grants.accounts).toEqual(['account'])
})
test.each(['add', 'remove'])('empty %s input cannot mutate permissions', async operation => {
  const c = context({ selectedOperation: operation }); await c.submitData(); expect(postAPI).not.toHaveBeenCalled(); expect(c.error).toBe('message.template.permissions.target.required')
})
test('normal owner adds trimmed names without enumerating accounts; string false is respected', async () => {
  const c = context({ manualTargets: ' a, b, a ' }); expect(c.canListAccounts).toBe(false)
  await c.submitData(); expect(c.grants.accounts).toEqual(['a', 'b']); expect(getAPI.mock.calls.some(([name]) => name === 'listAccounts')).toBe(false)
})
test('reset needs explicit confirmation and follows the server private-image reset contract', async () => {
  const c = context({ selectedOperation: 'reset' }); state = { accounts: ['a'], projects: ['p'], ispublic: true }; c.grants = { id, ...state }
  await c.submitData(); expect(postAPI).not.toHaveBeenCalled()
  c.resetConfirmed = true; await c.submitData(); expect(c.success).toBe(true); expect(c.grants.accounts).toEqual([]); expect(c.grants.projects).toEqual([])
  expect(postAPI.mock.calls[0][1]).toEqual({ id, op: 'reset' })
})
test('permission query failure blocks edits/reset and offers a GET-only reload', async () => {
  const c = context(); getAPI.mockRejectedValueOnce(new Error('denied')); await c.fetchData()
  expect(c.permissionValid).toBe(false); expect(c.error).toBe('denied'); c.selectedOperation = 'reset'; c.resetConfirmed = true; await c.submitData(); expect(postAPI).not.toHaveBeenCalled()
  await c.fetchData(); expect(c.permissionValid).toBe(true)
})
test('changed grants are refreshed before any mutation and require review', async () => {
  const c = context({ manualTargets: 'new' }); state.accounts = ['external']
  await c.submitData(); expect(postAPI).not.toHaveBeenCalled(); expect(c.grants.accounts).toEqual(['external']); expect(c.error).toBe('message.image.permissions.changed')
})
test('unknown post outcome is checked without automatically repeating the write', async () => {
  const c = context({ manualTargets: 'a' }); postAPI.mockRejectedValueOnce(new Error('network')); getAPI.mockResolvedValueOnce({ listtemplatepermissionsresponse: response() }).mockRejectedValueOnce(new Error('read failed'))
  await c.submitData(); expect(c.verification).toBeTruthy(); expect(c.success).toBe(false)
  state.accounts = ['a']; await c.checkResult(); expect(c.success).toBe(true); expect(postAPI).toHaveBeenCalledTimes(1)
})
test('unconfirmed update shows actual grants and never reports success', async () => {
  const c = context({ manualTargets: 'a' }); postAPI.mockResolvedValueOnce({})
  await c.submitData(); expect(c.success).toBe(false); expect(c.error).toBe('message.image.permissions.result.unconfirmed'); expect(c.verification).toBeNull()
})
test('old resource or actor responses cannot populate grants or submit', async () => {
  let finish; const c = context(); getAPI.mockReturnValueOnce(new Promise(resolve => { finish = resolve }))
  const pending = c.fetchData(); c.resource = { ...resource, id: 'new' }; c.invalidate(); finish({ listtemplatepermissionsresponse: response() }); await pending
  expect(c.grants).toBeNull(); expect(c.permissionValid).toBe(false); expect(postAPI).not.toHaveBeenCalled()
})
test('simultaneous submits issue only one mutation', async () => {
  const c = context({ manualTargets: 'a' }); await Promise.all([c.submitData(), c.submitData()]); expect(postAPI).toHaveBeenCalledTimes(1)
})
test('ownership, project context, system media and read-only APIs are checked again at submit time', async () => {
  const c = context({ manualTargets: 'a' }); c.$store.getters.apis = { listTemplatePermissions: {} }; await c.submitData(); expect(postAPI).not.toHaveBeenCalled()
  expect(canManageImagePermissions('iso', { ...resource, account: 'system' }, { userInfo: { id: 'a', roletype: 'Admin' }, apis })).toBe(false)
  expect(canManageImagePermissions('template', { ...resource, projectid: 'p' }, { userInfo: { id: 'a', roletype: 'User' }, project: { id: 'p' }, apis })).toBe(false)
  expect(canManageImagePermissions('template', { ...resource, projectid: 'p' }, { userInfo: { id: 'a', roletype: 'User' }, project: { id: 'other' }, apis })).toBe(false)
})
test.each(['DomainAdmin', 'ResourceAdmin'])('%s image management requires ownership or an authorized concrete project', role => {
  const getters = { userInfo: { id: 'a', roletype: role, domainid: 'domain', account: 'owner' }, apis }
  expect(canManageImagePermissions('iso', { ...resource, account: 'other' }, getters)).toBe(false)
  expect(canManageImagePermissions('template', { ...resource, account: 'other' }, getters)).toBe(false)
  expect(canManageImagePermissions('iso', resource, getters)).toBe(true)
  expect(canManageImagePermissions('iso', { ...resource, domainid: 'outside' }, getters)).toBe(false)
  const project = { ...resource, account: 'project-account', projectid: 'project' }
  expect(canManageImagePermissions('iso', project, { ...getters, project: { id: 'project' } })).toBe(true)
  expect(canManageImagePermissions('iso', project, { ...getters, project: { id: 'project' }, listAllProjects: true })).toBe(false)
})
test('removing an ungranted target is rejected rather than silently resetting sharing', () => {
  expect(() => expectedImagePermissions({ id, accounts: ['a'], projects: [] }, 'remove', 'Account', ['b'])).toThrow()
})

test('verified legacy ISO template envelope is accepted and owner access is not a removable grant', () => {
  const json = { listtemplatepermissionsresponse: { templatepermission: { id, account: ['owner', 'recipient'], projectids: ['own-project', 'shared-project'], ispublic: false } } }
  expect(imagePermissionResponse('iso', json, id, { account: 'owner' }).accounts).toEqual(['recipient'])
  expect(imagePermissionResponse('iso', json, id, { projectid: 'own-project' }).projects).toEqual(['shared-project'])
  expect(() => imagePermissionResponse('iso', { ...json, listisopermissionsresponse: { id } }, id)).toThrow()
})

test('the actual dialog exposes current grants and linked labels with no removable owner option', async () => {
  state = { accounts: ['owner', 'recipient'], projects: [] }
  const wrapper = mount(Permissions, { attachTo: document.body, props: { resource }, global: { mocks: { $t: k => k, $route: { meta: { name: 'template' } }, $store: { getters: { userInfo: { id: 'actor', roletype: 'User', domainid: 'domain', account: 'owner' }, apis, features: { allowuserviewalldomainaccounts: 'false' } } }, $notification: { success: jest.fn() } }, components: { ASelect: Select, ASelectOption: Select.Option, AInput: Input, AButton: Button, AAlert: Alert, AForm: Form, AFormItem: Form.Item, ASpin: Spin, ATag: Tag, ACheckbox: Checkbox }, stubs: { MoldDialog: { template: '<div><slot/><slot name="footer"/></div>' }, Wave: true }, directives: { 'ctrl-enter': {} } } })
  await flushPromises()
  expect(wrapper.text()).toContain('recipient')
  const inputs = wrapper.findAll('input[id^="image-permissions-"]')
  expect(inputs).toHaveLength(3)
  for (const input of inputs) expect(Array.from(input.element.labels).some(label => label.textContent.trim())).toBe(true)
  await wrapper.setData({ selectedOperation: 'remove' })
  expect(wrapper.vm.targetOptions).toEqual([{ value: 'recipient', label: 'recipient' }])
  wrapper.unmount()
})

test('a verified rejected update preserves the actual server error and permits a reviewed new selection', async () => {
  const c = context({ manualTargets: 'missing-account' }); postAPI.mockRejectedValueOnce(new Error('account not found'))
  await c.submitData(); expect(c.success).toBe(false); expect(c.verification).toBeNull(); expect(c.error).toBe('account not found')
})
