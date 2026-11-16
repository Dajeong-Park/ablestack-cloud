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
import { vnfSearchKeys, vnfListQuery, vnfSearchQuery, vnfSearchError, vnfListParams, vnfListLocation, vnfDetailLocation, readVnfPage, readVnfCandidates, vnfPickerParams, vnfAuth } from '@/utils/vnfSearch'
const id = '11111111-1111-4111-8111-111111111111'
const other = '22222222-2222-4222-8222-222222222222'
const apis = Object.fromEntries(['listVnfAppliances', 'listVnfTemplates', 'listNetworks', 'listServiceOfferings', 'listDomains', 'listAccounts', 'listZones', 'listInstanceGroups', 'recoverVirtualMachine'].map(k => [k, {}]))
const getters = { project: {}, apis, userInfo: { id: 'actor', roletype: 'Admin' } }
const supported = Object.fromEntries([...vnfSearchKeys, 'tags'].map(k => [k, {}]))
const row = { id, templatetype: 'VNF', state: 'Running', zoneid: id, templateid: id, serviceofferingid: id, domainid: id, account: 'owner', nic: [{ networkid: id }] }
const response = rows => ({ listvnfappliancesresponse: { count: rows.length, virtualmachine: rows } })
test('keyword submission combines advanced conditions and resets the page without changing API names', () => {
  const q = vnfSearchQuery({ state: 'Stopped', name: 'host', networkid: id, templateid: id, serviceofferingid: id, page: '4', projectid: other }, { searchQuery: ' Display ' }, 50, getters)
  expect(q).toMatchObject({ name: 'host', state: 'Stopped', keyword: 'Display', q: 'Display', projectid: other, page: '1', pagesize: '50' })
  expect(vnfListParams(q)).toMatchObject({ keyword: 'Display', networkid: id, templateid: id, serviceofferingid: id }); expect(vnfListParams(q)).not.toHaveProperty('q')
})
test('all state omits state and default project marker never reaches the server as a project UUID', () => {
  const q = vnfListQuery({ filter: 'all', state: 'all', page: '-1', pagesize: 'invalid' })
  expect(q).toEqual({ projectid: '0', page: '1', pagesize: '20' }); expect(vnfListParams(q)).toEqual({ ignoreproject: true, page: '1', pagesize: '20' })
  expect(vnfListQuery({ filter: 'running' }).state).toBe('Running'); expect(vnfListQuery({}, 20, { project: { id } }).projectid).toBe(id)
})
test('reset removes every predicate but retains the explicit project and page size', () => {
  expect(vnfSearchQuery({ state: 'Running', networkid: id, 'tags[0].key': 'k', keyword: 'x', projectid: '-1' }, {}, 50, getters)).toEqual({ projectid: '-1', page: '1', pagesize: '50' })
})
test.each(['hostid', 'displayname'])('unsupported %s is an explicit error rather than an unfiltered query', key => expect(vnfSearchError(vnfListQuery({ [key]: id }), getters, supported)).toBe('message.vnf.search.unsupported'))
test.each(['networkid', 'templateid', 'serviceofferingid', 'zoneid', 'projectid'])('invalid %s and unsupported schema are blocked', key => {
  expect(vnfSearchError(vnfListQuery({ [key]: 'invalid' }), getters, supported)).toBe('message.vnf.search.uuid')
})
test('API discovery and candidate permissions gate active conditions, including Destroyed', () => {
  expect(vnfSearchError(vnfListQuery({ state: 'Running' }), getters, {})).toBe('message.vnf.search.unsupported')
  expect(vnfSearchError(vnfListQuery({ templateid: id }), { ...getters, apis: { listVnfAppliances: {} } }, supported)).toBe('message.vnf.search.permission')
  expect(vnfSearchError(vnfListQuery({ state: 'Destroyed' }), { ...getters, apis: { listVnfAppliances: {} } }, supported)).toBe('message.vnf.search.state')
})
test('detail and breadcrumb retain combined filters and all-project scope, while request uses the row owner', () => {
  const route = { query: { state: 'Running', networkid: id, keyword: 'Display', projectid: '-1', page: '2', pagesize: '50' } }
  const detail = vnfDetailLocation(route, { id, projectid: other })
  expect(detail.query.projectid).toBe(other)
  expect(vnfListLocation({ query: detail.query }).query).toMatchObject({ state: 'Running', networkid: id, keyword: 'Display', projectid: '-1', page: '2', pagesize: '50' })
  expect(vnfListParams({ ...detail.query, id, state: 'Stopped' }, true)).toEqual({ id, projectid: other })
})
test.each(['invalid JSON', '[]', 'null'])('malformed return context %s cannot supply arbitrary route parameters', value => {
  expect(vnfListLocation({ query: { vnfreturn: value, projectid: id } }).query).toEqual({ projectid: id, page: '1', pagesize: '20' })
})
test.each(['state', 'templateid', 'serviceofferingid', 'zoneid', 'networkid', 'account', 'domainid'])('a response ignoring %s is an error rather than matching rows', field => {
  const params = { [field]: field === 'state' ? 'Stopped' : other }
  expect(() => readVnfPage(response([row]), params)).toThrow()
})
test('empty success differs from malformed and inconsistent counts or a foreign project', () => {
  expect(readVnfPage({ listvnfappliancesresponse: {} }, {})).toEqual({ rows: [], count: 0 })
  expect(() => readVnfPage({}, {})).toThrow(); expect(() => readVnfPage({ listvnfappliancesresponse: { count: 'invalid' } }, {})).toThrow()
  expect(() => readVnfPage(response([{ ...row, projectid: other }]), { ignoreproject: true })).toThrow()
  expect(() => readVnfPage(response([row, row]), {})).toThrow()
  expect(readVnfPage(response([row, { ...row, id: other, projectid: id }]), { projectid: '-1' }).count).toBe(2)
})
test('VNF candidate API scopes remain explicit and only supported parameters are sent', () => {
  const all = Object.fromEntries(['projectid', 'zoneid', 'domainid', 'account', 'templatefilter', 'listall', 'issystem'].map(k => [k, {}]))
  expect(vnfPickerParams('templateid', { projectid: other, zoneid: id }, all)).toMatchObject({ projectid: other, zoneid: id, templatefilter: 'all' })
  expect(vnfPickerParams('serviceofferingid', { projectid: '0', zoneid: id }, { zoneid: {}, issystem: {} })).toEqual({ zoneid: id, issystem: false, ignoreproject: true })
})
test('candidate pages exclude non-VNF, foreign Zone and private foreign-project templates without corrupting pagination', () => {
  const templates = [{ id, templatetype: 'VNF', zoneid: id, name: 'own' }, { id: other, templatetype: 'USER', zoneid: id }, { id: '33333333-3333-4333-8333-333333333333', templatetype: 'VNF', zoneid: id, projectid: other }]
  const page = readVnfCandidates({ listvnftemplatesresponse: { count: 3, template: templates } }, 'templateid', { zoneid: id })
  expect(page.rows.map(r => r.id)).toEqual([id]); expect(page.count).toBe(3); expect(page.received).toBe(3)
})
test('all-project candidate pages can legitimately contain shared default-scope resources', () => {
  expect(readVnfCandidates({ listnetworksresponse: { count: 1, network: [{ id }] } }, 'networkid', { projectid: '-1' }).rows).toHaveLength(1)
  expect(readVnfCandidates({ listnetworksresponse: { count: 1, network: [{ id, projectid: other }] } }, 'networkid', { ignoreproject: true }).rows).toHaveLength(0)
})
test('the inherited template response cannot leak private templates from another project or default view', () => {
  const data = { listtemplatesresponse: { count: 3, template: [{ id, name: 'default-private', templatetype: 'VNF', ispublic: false }, { id: other, name: 'own-project', projectid: other, templatetype: 'VNF', ispublic: false }, { id: '33333333-3333-4333-8333-333333333333', name: 'public', templatetype: 'VNF', ispublic: true }] } }
  const result = readVnfCandidates(data, 'templateid', { projectid: other })
  expect(result.rows.map(r => r.name)).toEqual(['own-project', 'public']); expect(result.received).toBe(3)
})
test('a project can filter a shared network returned by its scoped API, while private foreign networks are excluded', () => {
  const data = { listnetworksresponse: { count: 2, network: [{ id, type: 'Shared' }, { id: other, type: 'Isolated' }] } }
  expect(readVnfCandidates(data, 'networkid', { projectid: other }).rows.map(r => r.id)).toEqual([id])
})
test('role, permissions, actor and token all participate in the read context', () => {
  const context = vnfAuth(getters, 'old')
  expect(vnfAuth(getters, 'new')).not.toBe(context); expect(vnfAuth({ ...getters, userInfo: { ...getters.userInfo, roletype: 'User' } }, 'old')).not.toBe(context)
  expect(vnfAuth({ ...getters, apis: {} }, 'old')).not.toBe(context)
})
