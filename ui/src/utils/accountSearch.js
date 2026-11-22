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

export const accountSortFields = ['name', 'state', 'rolename', 'roletype', 'domainpath']
const states = ['enabled', 'disabled', 'locked']
const boolKeys = ['isrecursive', 'iscleanuprequired']
const filters = ['id', 'name', 'domainid', 'accounttype', ...boolKeys, 'apikeyaccess']
export const isAccountDetailRoute = route => route.meta?.name === 'account' && !!route.params?.id

export function accountQuery (raw = {}) {
  const query = {}
  for (const key of filters) {
    const value = raw[key]
    if (boolKeys.includes(key)) {
      if (['true', 'false'].includes(String(value))) query[key] = String(value)
    } else if (['string', 'number'].includes(typeof value) && String(value).trim()) {
      query[key] = String(value).trim()
    }
  }
  if (states.includes(raw.state)) query.state = raw.state
  const keyword = raw.q ?? raw.keyword
  if (typeof keyword === 'string' && keyword.trim()) query.q = keyword.trim()
  for (const key of ['page', 'pagesize']) {
    const count = Number(raw[key])
    if (Number.isSafeInteger(count) && count > 0) query[key] = String(count)
  }
  if (accountSortFields.includes(raw.sortkey) && ['asc', 'desc'].includes(raw.sortorder)) {
    query.sortkey = raw.sortkey
    query.sortorder = raw.sortorder
  }
  return query
}

export function applyAccountSearch (query, options, size) {
  const preserved = { ...query }
  if ('searchQuery' in options) {
    preserved.q = options.searchQuery
    delete preserved.keyword
    delete preserved.id
  } else {
    filters.forEach(key => delete preserved[key])
    Object.assign(preserved, options)
  }
  return accountQuery({ ...preserved, page: 1, pagesize: size })
}

export function accountListParams (query, defaults) {
  const { q, sortkey, sortorder, ...filter } = accountQuery(query)
  return { listall: true, page: defaults.page, pagesize: defaults.pagesize, ...filter, ...(q ? { keyword: q } : {}) }
}

export function accountDetailLocation (route, record, getters, token) {
  return resourceDetailLocation('account', 'accountReturn', route, record.id, listSessionScope(getters, token), accountQuery(route.query))
}

export function accountRouteHistory (route, history, getters, token) {
  return resourceListHistory('account', 'accountReturn', route, history, listSessionScope(getters, token))
}

export function accountListLocation (route, history, getters, token) {
  const saved = accountRouteHistory(route, history, getters, token).accountReturn
  return { path: '/account', query: accountQuery(saved?.query), state: { accountReturn: null } }
}
