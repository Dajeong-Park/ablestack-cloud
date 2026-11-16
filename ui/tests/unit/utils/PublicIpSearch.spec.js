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

import { publicIpQuery, publicIpSearchQuery, publicIpSearchError, publicIpParams, readPublicIpPage, publicIpPickerParams, readPublicIpCandidates, publicIpDetailLocation, publicIpListLocation } from '@/utils/publicIpSearch'
const id = '11111111-1111-4111-8111-111111111111'
const other = '22222222-2222-4222-8222-222222222222'
const getters = { userInfo: { roletype: 'Admin', domainid: id }, project: {}, apis: { listPublicIpAddresses: {} } }
const supported = Object.fromEntries(['state', 'allocatedonly', 'zoneid', 'domainid', 'isrecursive', 'account', 'keyword', 'issourcenat', 'isstaticnat', 'fordisplay', 'projectid', 'vpcid', 'networkid', 'associatednetworkid', 'physicalnetworkid', 'vlanid', 'tags', 'listall', 'page', 'pagesize'].map(k => [k, {}]))
test.each(['Allocated', 'Reserved', 'Free', 'Allocating', 'Releasing'])('%s normalizes URL enum, never translated state, and controls allocatedonly', state => {
  const q = publicIpQuery({ state: state.toUpperCase() }, 20, getters)
  expect(q.state).toBe(state); expect(publicIpSearchError(q, getters, supported)).toBe('')
  expect(publicIpParams(q, getters, supported).allocatedonly).toBe(state === 'Allocated')
})
test('Root all explicitly disables allocatedonly, pins the domain, strips UI args and retains false', () => {
  const q = publicIpSearchQuery(publicIpQuery({}, 20, getters), { filter: 'all', issourcenat: false, isstaticnat: 'false', fordisplay: 'false' }, 50, getters)
  const p = publicIpParams(q, getters, supported)
  expect(q.state).toBeUndefined(); expect(p).toMatchObject({ allocatedonly: false, domainid: id, isrecursive: true, issourcenat: 'false', isstaticnat: 'false', fordisplay: 'false', pagesize: '50', page: '1', ignoreproject: true })
  expect(p).not.toHaveProperty('filter'); expect(p).not.toHaveProperty('q'); expect(p).not.toHaveProperty('projectid')
})
test.each([{ state: '할당됨' }, { state: 'wrong' }, { allocatedonly: 'false' }, { vpcid: '1234' }, { issourcenat: '0' }, { dataView: 'true' }, { projectid: other }])('invalid or mismatched URL is blocked without widening: %j', raw => {
  expect(publicIpSearchError(publicIpQuery(raw, 20, getters), getters, supported)).not.toBe('')
})
test('unsupported explicit false is rejected, not omitted', () => { expect(publicIpSearchError(publicIpQuery({ isstaticnat: false }, 20, getters), getters, { ...supported, isstaticnat: undefined })).toBe('message.public.ip.search.unsupported') })
test.each(['all', 'free'])('non-root cannot gain %s through a direct URL', filter => { expect(publicIpSearchError(publicIpQuery({ filter }, 20, getters), { ...getters, userInfo: { roletype: 'User' } }, supported)).toBe('message.public.ip.search.permission') })
test('project/owner/query and page size survive keyword and detail round trips; apply resets page', () => {
  const g = { ...getters, project: { id: other } }; const q = publicIpQuery({ projectid: other, state: 'Reserved', vpcid: id, page: '3', pagesize: '50' }, 20, g)
  const detail = publicIpDetailLocation({ query: q }, { id }); expect(publicIpListLocation({ query: detail.query }, g).query).toEqual(q)
  const next = publicIpSearchQuery(q, { searchQuery: '10.1' }, 50, g); expect(next).toMatchObject({ vpcid: id, projectid: other, state: 'Reserved', keyword: '10.1', page: '1', pagesize: '50' })
  expect(publicIpParams(next, g, supported)).toMatchObject({ projectid: other, domainid: id })
})
test('zero is valid, malformed and cross-project response is failure', () => {
  expect(readPublicIpPage({ listpublicipaddressesresponse: {} }, {})).toEqual({ rows: [], count: 0 })
  for (const body of [{ count: -1 }, { count: 0, publicipaddress: [{ id }] }, { count: 1, publicipaddress: [{ id, projectid: other, state: 'Allocated' }] }]) expect(() => readPublicIpPage({ listpublicipaddressesresponse: body }, { projectid: id })).toThrow()
})
test('candidate requests preserve scope, page server-side, and distinguish public/guest networks', () => {
  const scope = { projectid: other, zoneid: id, vpcid: id, account: 'owner', domainid: id }
  const candidateSupported = { ...supported, traffictype: true, issystem: true }
  expect(publicIpPickerParams('associatednetworkid', scope, candidateSupported)).toMatchObject({ projectid: other, zoneid: id, vpcid: id, traffictype: 'Guest', account: 'owner' })
  expect(publicIpPickerParams('networkid', scope, candidateSupported)).toMatchObject({ traffictype: 'Public', ignoreproject: true, zoneid: id })
  expect(publicIpPickerParams('networkid', scope, candidateSupported)).not.toHaveProperty('projectid')
  const read = readPublicIpCandidates({ listnetworksresponse: { count: 2, network: [{ id, projectid: other, traffictype: 'Guest' }, { id: other, projectid: id, traffictype: 'Guest' }] } }, 'associatednetworkid', { projectid: other, traffictype: 'Guest' })
  expect(read.rows.map(r => r.id)).toEqual([id]); expect(read.received).toBe(2)
})

test('display all requires new metadata and maps to the explicit API flag', () => {
  const q = publicIpQuery({ fordisplay: 'all' }, 20, getters)
  expect(publicIpSearchError(q, getters, supported)).toBe('message.public.ip.search.unsupported')
  expect(publicIpSearchError(q, getters, { ...supported, displayall: {} })).toBe('')
  const params = publicIpParams(q, getters, { ...supported, displayall: {} }); expect(params.displayall).toBe(true); expect(params.fordisplay).toBeUndefined()
})

test('all preserves the server available-pool semantics without treating Free as attached or owned', () => {
 const data = { listpublicipaddressesresponse: { count: 1, publicipaddress: [{ id, state: 'Free' }] } }
 expect(readPublicIpPage(data, { projectid: other, account: 'owner', vpcid: id, associatednetworkid: id }).count).toBe(1)
 expect(() => readPublicIpPage(data, { networkid: id })).toThrow()
})
