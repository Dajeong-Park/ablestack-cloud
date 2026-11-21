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

import { applyRoleSearch, roleDetailLocation, roleListLocation, roleListParams, roleRouteHistory, roleTypes, roleSearchQuery } from '@/utils/roleSearch'

const id = 'ea4647e6-0921-4bdc-a954-7bdc93b2228f'
const query = { name: 'QA Role', type: 'ResourceAdmin', state: 'disabled', id, q: 'sample', page: '2', pagesize: '10', sortkey: 'name', sortorder: 'desc' }

describe('role list search and return state', () => {
  it('uses the same supported types and sends all independent search conditions', () => {
    expect(roleTypes).toContain('ResourceAdmin')
    expect(roleListParams(query, {})).toEqual({
      id, name: 'QA Role', type: 'ResourceAdmin', state: 'disabled', keyword: 'sample', page: '2', pagesize: '10'
    })
    expect(roleSearchQuery({ state: 'ALL', name: ' QA ', keyword: ' test ', sortkey: 'id', token: 'ignored' })).toEqual({ name: 'QA', q: 'test' })
  })

  it('keeps filters while changing keyword, retains the keyword with advanced search, and resets both explicitly', () => {
    expect(applyRoleSearch(query, { searchQuery: 'other' }, 20)).toEqual({ ...query, q: 'other', page: '1' })
    expect(applyRoleSearch(query, { roleFilters: { type: 'User' } }, 20)).toEqual({
      type: 'User', q: 'sample', page: '1', pagesize: '10', sortkey: 'name', sortorder: 'desc'
    })
    expect(applyRoleSearch(query, {}, 20)).toEqual({ page: '1', pagesize: '10', sortkey: 'name', sortorder: 'desc' })
  })

  it('restores only the list state of the same session and detail, including after tab navigation', () => {
    const session = { userInfo: { id: 'admin', roleid: 'root' } }
    const from = { meta: { name: 'role' }, params: {}, query }
    const detail = { meta: { name: 'role' }, params: { id }, query: { tab: 'rules' } }
    const link = roleDetailLocation(from, { id }, session, 'token')
    expect(link.path).toBe('/role/' + id)
    const state = roleRouteHistory(detail, link.state, session, 'token')
    expect(roleListLocation(detail, state, session, 'token')).toEqual({ path: '/role', query, state: { roleReturn: null } })
    expect(roleListLocation(detail, state, session, 'another token').query).toEqual({})
    expect(roleListLocation({ ...detail, params: { id: 'other' } }, state, session, 'token').query).toEqual({})
  })
})
