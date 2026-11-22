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

import { listSessionScope, resourceDetailLocation, resourceListHistory } from './resourceListHistory'

export const roleTypes = ['Admin', 'ResourceAdmin', 'DomainAdmin', 'User']
export const roleStates = ['enabled', 'disabled']
export const roleSortFields = ['name', 'type', 'description', 'state']
export const isRoleDetailRoute = route => route.meta?.name === 'role' && !!route.params?.id

const text = value => typeof value === 'string' ? value.trim() : ''

export function roleSearchQuery (raw = {}) {
  const query = {}
  if (text(raw.id)) query.id = text(raw.id)
  if (text(raw.name)) query.name = text(raw.name)
  if (roleTypes.includes(raw.type)) query.type = raw.type
  const state = text(raw.state).toLowerCase()
  if (roleStates.includes(state)) query.state = state
  const keyword = text(raw.q) || text(raw.keyword)
  if (keyword) query.q = keyword
  for (const key of ['page', 'pagesize']) {
    const count = Number(raw[key])
    if (Number.isSafeInteger(count) && count > 0) query[key] = String(count)
  }
  if (roleSortFields.includes(raw.sortkey) && ['asc', 'desc'].includes(raw.sortorder)) {
    query.sortkey = raw.sortkey
    query.sortorder = raw.sortorder
  }
  return query
}

export function applyRoleSearch (current, options, pageSize) {
  let filters = {}
  if ('searchQuery' in options) {
    filters = { ...current, q: options.searchQuery, keyword: undefined }
  } else if (options.roleFilters) {
    filters = { q: current.q, ...options.roleFilters }
  }
  return roleSearchQuery({
    sortkey: current.sortkey,
    sortorder: current.sortorder,
    ...filters,
    page: '1',
    pagesize: current.pagesize || pageSize
  })
}

export function roleListParams (raw, defaults) {
  const { q, sortkey, sortorder, ...params } = roleSearchQuery(raw)
  return { page: defaults.page, pagesize: defaults.pagesize, ...params, ...(q ? { keyword: q } : {}) }
}

export function roleDetailLocation (route, record, getters, token) {
  return resourceDetailLocation('role', 'roleReturn', route, record.id, listSessionScope(getters, token), roleSearchQuery(route.query))
}

export function roleRouteHistory (route, history, getters, token) {
  return resourceListHistory('role', 'roleReturn', route, history, listSessionScope(getters, token))
}

export function roleListLocation (route, history, getters, token) {
  const saved = roleRouteHistory(route, history, getters, token).roleReturn
  return { path: '/role', query: roleSearchQuery(saved?.query), state: { roleReturn: null } }
}
