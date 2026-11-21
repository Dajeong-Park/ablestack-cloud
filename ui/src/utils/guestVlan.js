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

export function guestVlanNetworkLocation (network, apis) {
  if (!apis?.listNetworks || network.issystem !== false || !network.id) return null
  return { path: '/guestnetwork/' + network.id, query: { projectid: network.projectid || '0' } }
}

export function guestVlanVpcLocation (network, apis) {
  if (!apis?.listVPCs || !network.vpcid) return null
  return { path: '/vpc/' + network.vpcid, query: { projectid: network.projectid || '0' } }
}

const vlanAdvancedFields = ['zoneid', 'physicalnetworkid', 'vnet']
const vlanListFields = [...vlanAdvancedFields, 'keyword', 'q', 'allocatedonly', 'page', 'pagesize']

export function guestVlanRoute (route) {
  return route.meta?.name === 'guestvlans'
}

export function guestVlanListQuery (query = {}) {
  return Object.fromEntries(vlanListFields.filter(key => typeof query[key] === 'string' && query[key]).map(key => [key, query[key]]))
}

export function guestVlanSearchQuery (current, values, size) {
  const query = guestVlanListQuery(current)
  if (Object.prototype.hasOwnProperty.call(values, 'searchQuery')) {
    delete query.q
    delete query.keyword
    const keyword = values.searchQuery?.trim()
    if (keyword) query.keyword = query.q = keyword
  } else if (values.guestVlanReset) {
    for (const key of [...vlanAdvancedFields, 'q', 'keyword', 'allocatedonly']) delete query[key]
  } else {
    for (const key of vlanAdvancedFields) {
      delete query[key]
      const value = values[key]?.trim()
      if (value) query[key] = value
    }
  }
  return { ...query, page: '1', pagesize: String(size) }
}

export function guestVlanReadParams (params) {
  const { page, pagesize, id } = params
  if (id) return { id, page: 1, pagesize: 1, ignoreproject: true }
  const query = guestVlanListQuery(params)
  delete query.q
  return { ...query, page, pagesize, ignoreproject: true }
}
