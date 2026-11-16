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

import { vmDisplayName, vmEditScope, isVmIdentityRoute } from '@/utils/vmIdentity'

test.each([null, undefined, '', ' \t\u3000', 123, false])('invalid displayname %j falls back without modifying identity', displayname => {
  const record = Object.freeze({ id: 'uuid', displayname, name: 'guest-host', instancename: 'i-2-1-VM' })
  expect(vmDisplayName(record)).toBe('guest-host')
  expect(vmDisplayName({ ...record, name: ' ' })).toBe('uuid')
})
test.each(['한글 표시명', '<img src=x onerror=alert(1)> & "test"', '긴 이름'.repeat(60)])('preserves user text %s', displayname => {
  expect(vmDisplayName({ displayname, name: 'host', id: 'uuid' })).toBe(displayname)
})
test('duplicate display names never become identity keys', () => {
  const a = { id: 'a', displayname: 'Same' }; const b = { id: 'b', displayname: 'Same' }
  expect(vmDisplayName(a)).toBe(vmDisplayName(b)); expect(a.id).not.toBe(b.id)
  expect(vmDisplayName(null)).toBe('')
})
test.each(['/vm', '/vnfapp'])('limits shared formatting to VM consumers %s', path => {
  expect(isVmIdentityRoute({ path })).toBe(true)
  expect(isVmIdentityRoute({ meta: { name: path.slice(1) } })).toBe(true)
  expect(isVmIdentityRoute({ path: '/template' })).toBe(false)
})
test.each(['id', 'projectid', 'account', 'domainid'])('editing owner/target field %s changes scope', key => {
  const resource = { id: 'a', projectid: 'p', account: 'a', domainid: 'd' }; const store = { getters: {} }
  expect(vmEditScope(resource, {}, store)).not.toBe(vmEditScope({ ...resource, [key]: 'changed' }, {}, store))
})
test.each(['project', 'userInfo', 'listAllProjects', 'apis'])('actor/project/permission change %s invalidates scope', key => {
  const getters = { project: { id: 'p' }, userInfo: { id: 'u', roleid: 'r' }, listAllProjects: false, apis: { updateVirtualMachine: {} } }
  const changed = { project: { id: 'other' }, userInfo: { id: 'other', roleid: 'other' }, listAllProjects: true, apis: {} }
  expect(vmEditScope({ id: 'a' }, {}, { getters })).not.toBe(vmEditScope({ id: 'a' }, {}, { getters: { ...getters, [key]: changed[key] } }))
})
test('route and renewed login token invalidate a pending edit', () => {
  const store = { getters: {}, state: { user: { token: 'one' } } }
  const initial = vmEditScope({ id: 'a' }, { fullPath: '/vnfapp/a' }, store)
  expect(vmEditScope({ id: 'a' }, { fullPath: '/vnfapp/b' }, store)).not.toBe(initial)
  store.state.user.token = 'two'
  expect(vmEditScope({ id: 'a' }, { fullPath: '/vnfapp/a' }, store)).not.toBe(initial)
})
