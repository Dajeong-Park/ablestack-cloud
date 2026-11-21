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

export const canDeleteIpv4Subnet = record => Boolean(record?.id) && record.state === 'Free' && !record.networkid && !record.vpcid

export const ipv4SubnetApi = 'listIpv4SubnetsForGuestNetwork'
export const ipv4SubnetRoute = route => route.meta?.name === 'ipv4subnets'
export const ipv4SubnetFilters = ['zoneid', 'parentid', 'subnet', 'networkid', 'vpcid']
export const ipv4SubnetZoneChoices = ['parentid', 'networkid', 'vpcid']
export const ipv4SubnetFilterLabel = {
  parentid: 'label.parentsubnet',
  subnet: 'label.ipv4.subnet.exact',
  networkid: 'label.guest.network',
  vpcid: 'label.vpc'
}
const fields = (source, keys) => Object.fromEntries(keys.filter(key => typeof source[key] === 'string' && source[key].trim()).map(key => [key, source[key].trim()]))

export function ipv4SubnetListQuery (query = {}) {
  return fields(query, [...ipv4SubnetFilters, 'q', 'keyword', 'page', 'pagesize'])
}

export function ipv4SubnetSearchQuery (current, values, size) {
  const query = ipv4SubnetListQuery(current)
  if (values.ipv4SubnetReset) return { page: '1', pagesize: String(size) }
  if (Object.hasOwn(values, 'searchQuery')) {
    delete query.keyword
    delete query.q
    const keyword = values.searchQuery?.trim()
    if (keyword) query.keyword = query.q = keyword
  } else {
    for (const key of ipv4SubnetFilters) delete query[key]
    Object.assign(query, fields(values, ipv4SubnetFilters))
  }
  return { ...query, page: '1', pagesize: String(size) }
}

export function ipv4SubnetReadParams (query, { id, page, pagesize }) {
  if (id) return { id, page: 1, pagesize: 1, ignoreproject: true }
  return { ...fields(query, ipv4SubnetFilters), keyword: query.q || query.keyword, page, pagesize, ignoreproject: true }
}

export function ipv4SubnetFilterOptions (kind, rows) {
  const entries = new Map()
  for (const row of rows) {
    const id = kind === 'parentid' ? row.id : row[kind]
    const name = kind === 'parentid' ? row.subnet : row[kind.replace('id', 'name')]
    if (id) entries.set(id, { id, name: name || id })
  }
  return [...entries.values()].sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
}
