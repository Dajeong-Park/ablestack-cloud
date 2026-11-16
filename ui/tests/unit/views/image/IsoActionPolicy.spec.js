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

import RegisterIso from '@/views/image/RegisterOrUploadIso'
import IsoZones from '@/views/image/IsoZones'
import image from '@/config/section/image'
import { isoContext } from '@/utils/isoModel'
import { getAPI, postAPI } from '@/api'
jest.mock('@/api', () => ({ getAPI: jest.fn(), postAPI: jest.fn() }))
jest.mock('@/store', () => ({ getters: { userInfo: { roletype: 'Admin' }, zones: [{}] } }))
const iso = image.children.find(section => section.name === 'iso')
const row = { id: 'image', account: 'owner', domainid: 'root-uuid', zoneid: 'z', isready: true, bootable: false, downloaddetails: [] }
const grants = { userInfo: { id: 'u', account: 'owner', domainid: 'root-uuid', roletype: 'User' }, project: {}, apis: { deleteIso: {}, copyIso: {}, listIsos: {} } }
function context (extra = {}) {
  const c = { $t: k => k, $emit: jest.fn(), $message: { error: jest.fn() }, $store: { getters: grants }, resource: row, dataSource: [row], selectedItems: [], selectedRowKeys: [], listRefreshFailed: false, ...extra }
  Object.entries(IsoZones.methods).forEach(([key, fn]) => { c[key] = fn.bind(c) })
  Object.assign(c, extra)
  Object.defineProperty(c, 'isoScope', { get: () => isoContext(c.resource, c.$store.getters) })
  c.isoDataContext = c.isoScope
  return c
}
beforeEach(() => jest.clearAllMocks())
test('local upload menu requests its own API and normal users never receive featured share flag', () => {
  expect(iso.actions.find(action => action.label === 'label.upload.iso.from.local').api).toBe('getUploadParamsForIso')
  const action = iso.actions.find(action => action.label === 'label.action.iso.share')
  expect(action.args(row, { userInfo: { roletype: 'User' }, features: { userpublictemplateenabled: 'false' } })).toEqual(['isextractable'])
  expect(action.args(row, { userInfo: { roletype: 'Admin' }, features: {} })).toEqual(['ispublic', 'isfeatured', 'isextractable'])
})
test('a stale selected row cannot delete after API permission changes', () => {
  const c = context(); c.setSelection(['z']); expect(c.selectedItems).toHaveLength(1)
  c.$store = { getters: { ...grants, apis: { listIsos: {} } } }
  c.deleteIsos(); expect(c.selectedItems).toEqual([]); expect(postAPI).not.toHaveBeenCalled()
})
test('system rows, stale scope and failed refresh do not enter bulk deletion', () => {
  const c = context({ resource: { ...row, templatetype: 'BUILTIN' } }); c.setSelection(['z']); expect(c.selectedItems).toEqual([])
  const current = context(); current.isoDataContext = 'old'; expect(current.isoAction('delete', row)).toBe(false)
  current.isoDataContext = current.isoScope; current.listRefreshFailed = true; expect(current.isoAction('delete', row)).toBe(false)
})
test('failed/malformed refresh preserves rows and reports error instead of successful empty data', async () => {
  const c = context({ listRequestToken: () => ({ loaded: true }), isListRequestCurrent: () => true, updateImageZones: jest.fn() })
  getAPI.mockResolvedValueOnce({ listisosresponse: { iso: {} } })
  await c.fetchData(); expect(c.dataSource).toEqual([row]); expect(c.listRefreshFailed).toBe(true)
})
test('late response from the previous account cannot replace the current resource data', async () => {
  let finish
  getAPI.mockReturnValueOnce(new Promise(resolve => { finish = resolve }))
  const c = context({ listRequestToken: () => ({ loaded: true }), isListRequestCurrent: () => true, updateImageZones: jest.fn() })
  const request = c.fetchData(); c.resource = { ...row, id: 'new' }; c.dataSource = []
  finish({ listisosresponse: { iso: [row], count: 1 } }); await request
  expect(c.dataSource).toEqual([]); expect(c.updateImageZones).not.toHaveBeenCalled()
})

test('ISO list leaves original server state intact for the availability component', () => {
  expect(iso.columns()).toContain('state')
  expect(iso.columns().some(column => typeof column === 'object' && column.state)).toBe(false)
})
test('registration form tolerates unavailable APIs and malformed metadata before creation', () => {
  const c = { $store: { getters: { apis: { registerIso: { params: {} }, linkUserDataToTemplate: { params: {} } } } } }
  expect(() => RegisterIso.beforeCreate.call(c)).not.toThrow()
  expect(c.apiParams.arch.description).toBe('')
  expect(c.linkUserDataParams.userdataid.description).toBe('')
})

test('project members retain normal image operations but cannot delegate permissions rejected by the server', () => {
  const project = { ...row, projectid: 'p', account: 'project-account', templatetype: 'USER' }
  const getters = { ...grants, project: { id: 'p' }, apis: { ...grants.apis, updateIso: {}, updateIsoPermissions: {}, listIsoPermissions: {} } }
  const { canIsoAction } = require('@/utils/isoModel')
  for (const action of ['edit', 'copy', 'delete']) expect(canIsoAction(action, project, getters)).toBe(true)
  for (const action of ['share', 'permissions']) expect(canIsoAction(action, project, getters)).toBe(false)
  const template = image.children.find(section => section.name === 'template')
  const share = template.actions.find(action => action.label === 'label.action.template.share')
  expect(share.show(project, getters)).toBe(false)
  for (const roletype of ['DomainAdmin', 'ResourceAdmin']) {
    const cloudAdmin = { ...getters, userInfo: { ...getters.userInfo, roletype } }
    expect(canIsoAction('permissions', project, cloudAdmin)).toBe(true)
    expect(share.show(project, cloudAdmin)).toBe(true)
  }
})
