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

import { s2sGatewayQuery as query, s2sGatewayError as error, s2sGatewayParams as params, s2sGatewaySearchQuery as search, s2sGatewayListLocation, s2sGatewayDetailLocation, readS2sGatewayPage, readS2sGatewayQuery, s2sGatewaySelection, s2sGatewayPickerParams, readS2sGatewayCandidates, vpnConnectionApi, vpnConnectionDetailLocation, readVpnConnectionQuery } from '@/utils/s2sGatewaySearch'
const id = n => String(n).padStart(8, '0') + '-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const gateway = id(1); const vpc = id(2); const domain = id(3); const project = id(4)
const support = Object.fromEntries(['id', 'vpcid', 'domainid', 'account', 'keyword', 'projectid', 'page', 'pagesize', 'listall', 'fordisplay', 'displayall'].map(k => [k, {}]))
const getters = { userInfo: { id: 'admin', roletype: 'Admin', domainid: domain }, project: {}, apis: { listVpnGateways: {}, listVPCs: {}, listDomains: {}, listAccounts: {} } }
const row = { id: gateway, vpcid: vpc, publicip: '192.0.2.10', account: 'owner', domainid: domain, fordisplay: true }
const reply = rows => ({ listvpngatewaysresponse: { count: rows.length, vpngateway: rows } })
test('normalizes case, whitespace, keyword aliases and preserves a canonical paging scope', () => {
  const q = query({ vpcid: vpc.toUpperCase(), keyword: '  서울_%  ', page: '2', pagesize: '1' }, 20, getters)
  expect(q).toEqual({ vpcid: vpc, keyword: '서울_%', q: '서울_%', projectid: '0', fordisplay: 'all', page: '2', pagesize: '1' })
  expect(query(q, 20, getters)).toEqual(q)
  expect(params(q)).toEqual({ vpcid: vpc, keyword: '서울_%', displayall: true, page: '2', pagesize: '1', listall: true, ignoreproject: true })
  expect(search(q, { searchQuery: 'other' }, 20, getters)).toMatchObject({ vpcid: vpc, keyword: 'other', page: '1' })
  expect(search(q, { s2sGatewaySearch: {} }, 20, getters)).toEqual({ projectid: '0', fordisplay: 'all', page: '1', pagesize: '20' })
})
test.each([{ id: 'invalid' }, { vpcid: [vpc] }, { page: ['1'] }, { command: 'deleteVpnGateway' }, { fordisplay: 'invalid' }])('invalid or unsupported URL never becomes an unfiltered request: %j', raw => {
  expect(error(query(raw, 20, getters), getters, support)).not.toBe('')
})
test('project mismatch, unsupported metadata and owner combinations fail before listing', () => {
  expect(error(query({ projectid: project }, 20, getters), getters, support)).toBe('scope')
  expect(error(query({ account: 'owner' }, 20, getters), getters, support)).toBe('account')
  expect(error(query({ vpcid: vpc }, 20, getters), getters, {})).toBe('unsupported')
  expect(error(query({ domainid: id(9) }, 20, getters), { ...getters, userInfo: { ...getters.userInfo, roletype: 'User' } }, support)).toBe('permission')
})
test('detail/breadcrumb keeps list filters and page only in the same selected project', () => {
  const q = query({ keyword: '192', page: '2' }, 20, getters)
  const detail = s2sGatewayDetailLocation({ query: q }, row, getters)
  expect(s2sGatewayListLocation(detail, getters).query).toEqual(q)
  expect(s2sGatewayListLocation(detail, { ...getters, userInfo: { ...getters.userInfo, id: 'other' } }).query.keyword).toBeUndefined()
  expect(s2sGatewayListLocation(detail, { ...getters, userInfo: { ...getters.userInfo, roletype: 'DomainAdmin' } }).query.keyword).toBeUndefined()
  expect(s2sGatewayListLocation(detail, { ...getters, project: { id: project } }).query).toEqual({ projectid: project, fordisplay: 'all', page: '1', pagesize: '20' })
})
test('response count, duplicate identity, exact filters and owner/project scope are verified', () => {
  expect(readS2sGatewayPage(reply([row]), { id: gateway }).count).toBe(1)
  expect(readS2sGatewayPage({ listvpngatewaysresponse: {} }, {}).rows).toEqual([])
  for (const json of [reply([row, row]), { listvpngatewaysresponse: { count: -1 } }, { listvpngatewaysresponse: { vpngateway: row } }]) expect(() => readS2sGatewayPage(json, {})).toThrow('response')
  for (const scope of [{ id: id(9) }, { vpcid: id(9) }, { domainid: id(9) }, { account: 'other' }, { projectid: project }]) expect(() => readS2sGatewayPage(reply([row]), scope)).toThrow('scope')
  expect(() => readS2sGatewayPage(reply([{ ...row, projectid: project }]), {})).toThrow('scope')
})
test('selected target must resolve within scope before a gateway list request', async () => {
  const read = jest.fn().mockResolvedValue({ listvpcsresponse: {} })
  await expect(readS2sGatewayQuery(read, { vpcid: vpc }, getters, () => true)).rejects.toThrow('missing')
  expect(read).toHaveBeenCalledTimes(1)
  read.mockResolvedValue({ listvpcsresponse: { count: 1, vpc: [{ id: vpc, account: 'owner', domainid: domain }] } })
  expect(await s2sGatewaySelection(read, { vpcid: vpc }, getters)).toEqual({ vpcid: vpc })
  const stopped = jest.fn(); await expect(readS2sGatewayQuery(stopped, {}, getters, () => false)).rejects.toThrow('stale'); expect(stopped).not.toHaveBeenCalled()
})
test('paged candidates retain owner scope and metadata cannot silently remove a selected project', () => {
  expect(() => s2sGatewayPickerParams('vpcid', { projectid: project }, {})).toThrow('unsupported')
  expect(() => readS2sGatewayCandidates({ listvpcsresponse: { count: 1, vpc: [{ id: vpc, projectid: project }] } }, 'vpcid', {})).toThrow('scope')
  expect(() => readS2sGatewayCandidates({ listaccountsresponse: { count: 1, account: [{ id: id(8), domainid: id(9), name: 'owner' }] } }, 'account', { domainid: domain })).toThrow('scope')
})

test('account candidates and exact lookup do not enable listall recursive-domain semantics', async () => {
  expect(s2sGatewayPickerParams('account', { domainid: domain }, { domainid: {}, listall: {}, isrecursive: {} })).toMatchObject({ domainid: domain, listall: false, isrecursive: false })
  const read = jest.fn().mockResolvedValueOnce({ listdomainsresponse: { count: 1, domain: [{ id: domain, name: 'ROOT' }] } }).mockResolvedValueOnce({ listaccountsresponse: { count: 1, account: [{ id: id(8), name: 'owner', domainid: domain }] } })
  expect(await s2sGatewaySelection(read, { domainid: domain, account: 'owner' }, getters)).toEqual({ domainid: 'ROOT', account: 'owner' })
  expect(read.mock.calls[1][1]).toMatchObject({ listall: false, isrecursive: false, name: 'owner', domainid: domain })
})

const connectionGetters = { ...getters, apis: { ...getters.apis, [vpnConnectionApi]: {} } }
const connectionFields = { id: {}, vpcid: {}, keyword: {}, projectid: {}, domainid: {}, account: {}, excludeprojectresources: {} }

test('VPN connection query preserves AND filters and resets pagination when searching', () => {
  const initial = query({ id: id(1), vpcid: vpc, keyword: '192.0.2', page: '4' }, 20, connectionGetters, vpnConnectionApi)
  const updated = search(initial, { searchQuery: 'peer' }, 20, connectionGetters, vpnConnectionApi)
  expect(updated).toMatchObject({ keyword: 'peer', id: id(1), vpcid: vpc, page: '1', projectid: '0' })
  expect(error(updated, connectionGetters, connectionFields, vpnConnectionApi)).toBe('')
  expect(params(updated, vpnConnectionApi)).toMatchObject({ id: id(1), vpcid: vpc, keyword: 'peer', excludeprojectresources: true })
  expect(params(updated, vpnConnectionApi)).not.toHaveProperty('fordisplay')
  expect(params(updated, vpnConnectionApi)).not.toHaveProperty('projectid')
  expect(search(updated, { searchQuery: '' }, 20, connectionGetters, vpnConnectionApi)).not.toHaveProperty('keyword')
})

test('VPN connection detail returns to the same filtered page only in the original scope', () => {
  const scoped = { ...connectionGetters, project: { id: project } }
  const source = query({ keyword: 'peer', vpcid: vpc, page: '2' }, 20, scoped, vpnConnectionApi)
  const detail = vpnConnectionDetailLocation({ query: source }, { id: id(1) }, scoped)
  expect(detail).toMatchObject({ path: '/s2svpnconn/' + id(1), query: { projectid: project } })
  expect(s2sGatewayListLocation(detail, scoped, vpnConnectionApi)).toEqual({ path: '/s2svpnconn', query: source })
  expect(s2sGatewayListLocation(detail, connectionGetters, vpnConnectionApi)).toEqual({ path: '/s2svpnconn', query: { projectid: '0', page: '1', pagesize: '20' } })
  expect(error({ ...source, account: 'owner', domainid: domain }, scoped, connectionFields, vpnConnectionApi)).toBe('account.project')
})

test('VPN connection read does not apply a VPC found in another project', async () => {
  const read = jest.fn().mockResolvedValue({ listvpcsresponse: { count: 1, vpc: [{ id: vpc, projectid: project }] } })
  await expect(readVpnConnectionQuery(read, { vpcid: vpc, excludeprojectresources: true }, connectionGetters, () => true)).rejects.toThrow('scope')
  expect(read).toHaveBeenCalledTimes(1)
  expect(read.mock.calls[0][1]).not.toHaveProperty('excludeprojectresources')
})

test('VPN connection UUID bookmarks retain API-authorized access while explicit list scopes stay isolated', async () => {
  const row = { id: id(1), projectid: project }
  const response = { listvpnconnectionsresponse: { count: 1, vpnconnection: [row] } }
  const read = jest.fn().mockResolvedValue(response)
  await expect(readVpnConnectionQuery(read, { id: row.id }, connectionGetters, () => true)).resolves.toEqual(response)
  await expect(readVpnConnectionQuery(read, { id: row.id, excludeprojectresources: true }, connectionGetters, () => true)).rejects.toThrow('scope')
  await expect(readVpnConnectionQuery(read, { id: row.id, projectid: id(9) }, connectionGetters, () => true)).rejects.toThrow('scope')
  await expect(readVpnConnectionQuery(read, { id: id(9) }, connectionGetters, () => true)).rejects.toThrow('scope')
})
