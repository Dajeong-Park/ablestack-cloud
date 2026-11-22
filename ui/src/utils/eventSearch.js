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

export const eventSearchKeys = [
  'keyword', 'type', 'startdate', 'enddate', 'eventuuid', 'resourcetype', 'resourceid',
  'level', 'state', 'domainid', 'account'
]

export function eventSearchQuery (query, filters = {}) {
  const next = { ...query, page: '1' }
  if (Object.prototype.hasOwnProperty.call(filters, 'searchQuery')) {
    delete next.keyword
    const keyword = String(filters.searchQuery ?? '').trim()
    if (keyword) next.keyword = keyword
  } else {
    for (const key of eventSearchKeys) {
      delete next[key]
      const value = String(filters[key] ?? '').trim()
      if (value) next[key] = value
    }
  }
  delete next.q
  if (next.keyword) next.q = next.keyword
  return next
}

export function eventSearchError (filters, isUuid) {
  const { eventuuid, resourceid, resourcetype, startdate, enddate } = filters
  if (eventuuid?.trim() && !isUuid(eventuuid.trim())) return 'message.events.search.eventuuid.invalid'
  if (resourceid?.trim()) {
    if (!isUuid(resourceid.trim())) return 'message.events.search.resourceid.invalid'
    if (!resourcetype?.trim()) return 'message.events.search.resourceid.type.required'
  }
  if (startdate && enddate && startdate > enddate) return 'message.events.search.date.order'
  return ''
}

export function eventCreatedSortQuery (query, order) {
  const next = { ...query, page: '1' }
  delete next.sortkey
  delete next.sortorder
  if (order === 'ascend' || order === 'descend') {
    next.sortkey = 'created'
    next.sortorder = order === 'ascend' ? 'asc' : 'desc'
  }
  return next
}
