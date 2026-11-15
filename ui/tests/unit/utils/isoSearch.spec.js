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

import { isoListQuery, isoSearchQuery, isoSearchError, isoRequestParams, isoListOwner, isoDetailLocation, isoListLocation, isoFilterChips, isoColumn } from '@/utils/isoSearch'
const id = '11111111-1111-4111-8111-111111111111'
const fields = ['name', 'bootable', 'isready', 'ispublic', 'hypervisor', 'userdataid', 'tags', 'zoneid', 'oscategoryid', 'storageid', 'imagestoreid', 'arch']
const getters = { userInfo: { id: 'actor', roleid: id, roletype: 'Admin' }, project: {}, defaultListViewPageSize: 20, apis: { listIsos: { params: fields.map(name => ({ name })) } } }
const metadata = Object.fromEntries(fields.map(k => [k, {}]))
test('allowlist, aliases, tags and local sorting never restore action/owner scope into API params', () => {
  const q = isoListQuery({ q: 'part', bootable: false, isready: 'false', ispublic: false, userdataid: id, 'tags[3].key': 'os', 'tags[3].value': 'linux', page: 2, pagesize: 50, sortkey: 'name', sortorder: 'asc', action: 'deleteIso', projectid: 'other' }, 20, getters)
  expect(q).toMatchObject({ q: 'part', keyword: 'part', bootable: 'false', isready: 'false', ispublic: 'false', page: '2', pagesize: '50', sortkey: 'name', 'tags[0].key': 'os' })
  const api = isoRequestParams(q, false, getters)
  for (const key of ['sortkey', 'sortorder', 'q', 'isoowner', 'isoreturn', 'action', 'projectid']) expect(api).not.toHaveProperty(key)
  expect(api).toMatchObject({ showunique: 'true', listall: true, ignoreproject: true, bootable: 'false' })
})
test.each([{ page: '-1', pagesize: '9999' }, { page: ['2'], pagesize: [] }, { page: 'NaN', pagesize: '0' }])('paging and unknown sort are bounded %o', input => {
  const q = isoListQuery({ ...input, sortkey: 'deleteIso', sortorder: 'asc' }, 20, getters)
  expect(q.page).toBe('1'); expect(q.pagesize).toBe('20'); expect(q).not.toHaveProperty('sortkey')
})
test.each([{ isready: 'no' }, { bootable: ['false'] }, { ispublic: '0' }, { userdataid: 'not-uuid' }, { arch: 'future' }, { hypervisor: 'not-real' }, { 'tags[0].value': 'no-key' }])('invalid narrowing never becomes a broad read: %o', input => {
  expect(isoSearchError(isoListQuery(input, 20, getters), metadata, getters)).toBe('message.iso.search.invalid')
})
test('capability and administrator-only storage filters are validated separately', () => {
  expect(isoSearchError(isoListQuery({ userdataid: id }, 20, getters), {}, getters)).toBe('message.iso.search.unsupported')
  const user = { ...getters, userInfo: { ...getters.userInfo, roletype: 'User' } }
  expect(isoSearchError(isoListQuery({ storageid: id }, 20, user), metadata, user)).toBe('message.iso.search.unsupported')
  expect(isoSearchError(isoListQuery({ bootable: false, isready: true, ispublic: false }, 20, getters), metadata, getters)).toBe('')
})
test('basic, advanced and clear replace prior search, retain filter/size/local sort, reset page', () => {
  const before = isoListQuery({ name: 'old', userdataid: id, page: 4, pagesize: 50, filter: 'shared', sortkey: 'name', sortorder: 'asc' }, 20, getters)
  const basic = isoSearchQuery(before, { searchQuery: 'partial' }, 50, getters)
  expect(basic).toMatchObject({ keyword: 'partial', page: '1', pagesize: '50', isofilter: 'shared', sortkey: 'name' }); expect(basic).not.toHaveProperty('name')
  const advanced = isoSearchQuery(basic, { bootable: false }, 50, getters)
  expect(advanced.bootable).toBe('false'); expect(advanced).not.toHaveProperty('keyword')
  expect(isoSearchQuery(advanced, {}, 50, getters)).not.toHaveProperty('bootable')
})
test.each(['user', 'role', 'project', 'allProjects', 'capability'])('owner boundary resets old list and breadcrumb context: %s', boundary => {
  const q = isoListQuery({ keyword: 'private', isready: false, page: 3, pagesize: 50 }, 20, getters)
  const link = isoDetailLocation({ query: q }, { id }, getters, 'zones')
  const next = { ...getters, userInfo: { ...getters.userInfo }, project: {} }
  if (boundary === 'user') next.userInfo.id = 'other'
  if (boundary === 'role') next.userInfo.roleid = 'other'
  if (boundary === 'project') next.project = { id }
  if (boundary === 'allProjects') next.listAllProjects = true
  if (boundary === 'capability') next.apis = { listIsos: { params: [{ name: 'name' }] } }
  expect(isoListOwner(next)).not.toBe(isoListOwner(getters))
  expect(isoListLocation(link, next)).toEqual({ path: '/iso' })
  const restored = isoListQuery(q, 50, next); expect(restored).not.toHaveProperty('keyword'); expect(restored.page).toBe('1'); expect(restored.pagesize).toBe('20')
})
test('same-owner tabs, comments and breadcrumb retain validated state and detail never inherits list conditions', () => {
  const q = isoListQuery({ keyword: 'part', isready: false, page: 2, pagesize: 50, sortkey: 'name', sortorder: 'desc' }, 20, getters)
  const location = isoDetailLocation({ query: q }, { id }, getters, 'comments')
  expect(isoListLocation({ query: { ...location.query, tab: 'zones' } }, getters)).toEqual({ path: '/iso', query: q })
  expect(isoRequestParams({ id, ...q, isoreturn: location.query.isoreturn }, true, getters)).toEqual({ id, listall: true, ignoreproject: true })
  const project = { ...getters, project: { id } }
  expect(isoRequestParams({ projectid: 'forged' }, false, project).projectid).toBe(id)
  expect(isoRequestParams({}, false, { ...getters, listAllProjects: true }).projectid).toBe('-1')
})
test.each(['null', '[]', '{bad', 'https://outside.example'])('malformed return is confined to ISO: %s', isoreturn => {
  expect(isoListLocation({ query: { isoreturn, isoowner: isoListOwner(getters) } }, getters)).toEqual({ path: '/iso' })
})
test('chips omit owner/paging/sort and duplicate sharing aliases', () => {
  const q = isoListQuery({ filter: 'shared', isready: false, page: 3, sortkey: 'name', sortorder: 'asc' }, 20, getters)
  expect(isoFilterChips(q, getters)).toEqual([{ key: 'isready', value: 'false', isTag: false }, { key: 'isofilter', value: 'shared', isTag: false }])
  expect(isoFilterChips(isoListQuery({}, 20, getters), getters)).toEqual([])
})
test('name receives remaining width; auxiliary widths and controlled current-page sort survive restore', () => {
  expect(isoColumn({ key: 'name', width: 20, sorter: () => 0 }, { sortkey: 'name', sortorder: 'desc' })).toMatchObject({ width: undefined, sortOrder: 'descend' })
  expect(isoColumn({ key: 'state' }).width).toBe(120)
  expect(isoColumn({ key: 'ostypename' }).width).toBe(148)
})

test('caller icon flag is preserved without accepting it as arbitrary list URL state', () => {
  expect(isoRequestParams({ showicon: true }, false, getters).showicon).toBe(true)
  expect(isoRequestParams({ id, showicon: false }, true, getters).showicon).toBe(false)
  expect(isoListQuery({ showicon: true }, 20, getters)).not.toHaveProperty('showicon')
})

test('manual order controls are not advertised as a sortable data column', () => {
  expect(isoColumn({ key: 'order', sorter: () => 0 }).sorter).toBe(false)
})

test('non-column sort fields are not restored as a working table sort', () => {
  expect(isoListQuery({ sortkey: 'id', sortorder: 'asc' }, 20, getters)).not.toHaveProperty('sortkey')
})
