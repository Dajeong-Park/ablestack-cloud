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
import { createStore } from 'vuex'
import { vnfCredentialRows, vnfWebUrl, vnfManagementAccess, vnfDeploymentNotice } from '@/utils/vnfAccess'

const vm = () => ({ templatetype: 'VNF', state: 'Running', passwordenabled: true, vnfnics: [{ deviceid: '0', management: true }, { deviceid: 1, management: false }], nic: [{ deviceid: 0, ipaddress: '10.0.0.2', ip6address: '2001:db8::1' }, { deviceid: 1, ipaddress: '10.0.1.2' }], vnfdetails: { access_methods: 'console,ssh-password,ssh-key,http,https', http_port: '8080', https_path: '/ui?q=a&b=c' } })

test.each([undefined, {}, { username: '' }, { username: '  ', password: null }, { username: {}, ssh_user: ['bad'], web_user: false }])('no empty or malformed credentials: %p', details => {
  expect(vnfCredentialRows({ vnfdetails: details }, true)).toEqual([])
})
test('username-only notices contain no password/change hint; server password wins only when allowed', () => {
  const response = { password: 'generated', vnfdetails: { username: 'name', password: 'default', ssh_password: 'ssh', web_password: 'web' } }
  expect(vnfCredentialRows(response, false).map(r => r.key)).toEqual(['username'])
  const rows = vnfCredentialRows(response, true)
  expect(rows.find(r => r.key === 'password').value).toBe('generated')
  expect(rows.filter(r => r.secret)).toHaveLength(3)
})
test('only enabled management NIC device IDs supply addresses, with distinct IPv4/IPv6 links', () => {
  const access = vnfManagementAccess(vm())
  expect(access.entries.filter(r => r.href).map(r => r.href)).toEqual(['http://10.0.0.2:8080/', 'http://[2001:db8::1]:8080/', 'https://10.0.0.2/ui?q=a&b=c', 'https://[2001:db8::1]/ui?q=a&b=c'])
  expect(JSON.stringify(access)).not.toContain('10.0.1.2')
})
test.each([false, 'false', 0])('disabled management NIC %p cannot generate links', value => {
  const r = vm(); r.nic[0].enabled = value
  expect(vnfManagementAccess(r).entries.filter(r => r.href)).toEqual([])
})
test.each([undefined, null, [], [{ deviceid: 2, ipaddress: '10.0.9.2' }]])('missing/unmatched NICs %p produce unavailable reasons', nics => {
  const r = vm(); r.nic = nics
  expect(vnfManagementAccess(r).entries.filter(r => r.label === 'message.vnf.access.unavailable')).toHaveLength(4)
})
test('blank credentials do not recommend template credentials; unsupported/non-VNF differs from console default', () => {
  expect(vnfManagementAccess(vm()).hasCredentials).toBe(false)
  expect(vnfManagementAccess({ templatetype: 'USER' })).toBeNull()
  expect(vnfManagementAccess({ templatetype: 'VNF' }).entries[0].label).toBe('message.vnf.access.console.stopped')
  expect(vnfManagementAccess({ templatetype: 'VNF', vnfdetails: { access_methods: 'javascript,ftp' } }).entries[0].label).toBe('message.vnf.access.unsupported')
})
test.each([
  ['javascript', '10.0.0.2', 80, '/'], ['https', 'evil.example', 443, '/'], ['http', '10.0.0.2@evil.example', 80, '/'],
  ['http', '010.0.0.2', 80, '/'], ['http', '256.0.0.2', 80, '/'], ['http', '10.0.0.2', 0, '/'],
  ['http', '10.0.0.2', '80@evil', '/'], ['https', '10.0.0.2', 65536, '/'],
  ['http', '10.0.0.2', 80, '//evil.example'], ['https', '10.0.0.2', 443, 'javascript:alert(1)'],
  ['http', '10.0.0.2', 80, '/%0d%0aX:bad'], ['https', '10.0.0.2', 443, '/\\evil'], ['https', '10.0.0.2', 443, {}]
])('rejects invalid URL arguments %p %p %p %p', (...args) => expect(vnfWebUrl(...args)).toBeNull())
test('path metacharacters stay inside the IP origin and are URL encoded', () => {
  const url = vnfWebUrl('https', '10.0.0.2', '443', '/"><img>')
  expect(new URL(url).origin).toBe('https://10.0.0.2')
  expect(url).not.toMatch(/[<>"\\]/)
  expect(vnfWebUrl('https', '10.0.0.2', '', '/한글 경로')).toBe('https://10.0.0.2/%ED%95%9C%EA%B8%80%20%EA%B2%BD%EB%A1%9C')
})

export function noticeStore () {
  return createStore({ state: { user: { token: 'old' }, info: { id: 'user', roleid: 'role' }, project: {}, apis: { deployVnfAppliance: {} } }, getters: { userInfo: s => s.info, project: s => s.project, apis: s => s.apis } })
}
const complete = () => ({ jobstatus: 1, jobinstanceid: 'vm-a', jobresult: { virtualmachine: { id: 'vm-a', templateid: 'template-a', passwordenabled: true, vnfdetails: { username: 'user', password: 'example' } } } })
test('template/password policy is captured, not taken from a later template object', () => {
  const store = noticeStore(); const t = { id: 'template-a', passwordenabled: false }
  const n = vnfDeploymentNotice(store, t, { templateid: 'template-a' }, jest.fn())
  t.passwordenabled = true; t.id = 'template-b'
  expect(n.credentials(complete(), { path: '/vnfapp' }, 'template-b').map(r => r.key)).toEqual(['username'])
  expect(n.credentials(complete(), { path: '/deployVnfAppliance' }, 'template-b')).toEqual([])
  n.release()
})
test.each(['token', 'actor', 'role', 'project', 'permission'])('security %s change and return permanently revokes pending and visible notices', change => {
  const store = noticeStore(); const close = jest.fn(); const n = vnfDeploymentNotice(store, { id: 'template-a', passwordenabled: true }, { templateid: 'template-a' }, close)
  if (change === 'token') { store.state.user.token = 'new'; store.state.user.token = 'old' }
  if (change === 'actor') { store.state.info.id = 'other'; store.state.info.id = 'user' }
  if (change === 'role') { store.state.info.roleid = 'other'; store.state.info.roleid = 'role' }
  if (change === 'project') { store.state.project = { id: 'other' }; store.state.project = {} }
  if (change === 'permission') { store.state.apis = {}; store.state.apis = { deployVnfAppliance: {} } }
  expect(n.current()).toBe(false); expect(close).toHaveBeenCalledTimes(1)
  expect(n.credentials(complete(), { path: '/vnfapp' }, 'template-a')).toEqual([])
})
test('requires a successful, matching VM/template/project/job identity and target context', () => {
  const store = noticeStore(); const n = vnfDeploymentNotice(store, { id: 'template-a', passwordenabled: true }, { templateid: 'template-a' }, jest.fn())
  expect(n.credentials(complete(), { path: '/vnfapp' }, '')).toHaveLength(2)
  for (const field of ['id', 'templateid', 'projectid']) {
    const r = complete(); r.jobresult.virtualmachine[field] = 'other'
    expect(n.credentials(r, { path: '/vnfapp' }, '')).toEqual([])
  }
  expect(n.credentials({ ...complete(), jobstatus: 0 }, { path: '/vnfapp' }, '')).toEqual([])
  expect(n.credentials({ ...complete(), jobinstanceid: 'other' }, { path: '/vnfapp' }, '')).toEqual([])
  expect(n.credentials(complete(), { path: '/vnfapp/another-vm' }, '')).toEqual([])
  const r = complete(); r.jobresult.virtualmachine.passwordenabled = false
  expect(n.credentials(r, { path: '/vnfapp' }, '').map(r => r.key)).toEqual(['username'])
  n.release()
})
