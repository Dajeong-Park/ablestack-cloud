// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements. See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership. The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License. You may obtain a copy of the License at
//
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied. See the License for the
// specific language governing permissions and limitations
// under the License.

export const gatewayDisplayAdmin = getters => getters.userInfo?.roletype === 'Admin'
export function gatewayDisplayError (query, getters, supported) {
  if (!Object.prototype.hasOwnProperty.call(query, 'fordisplay')) return ''
  if (!gatewayDisplayAdmin(getters)) return 'permission'
  if (!['all', 'true', 'false'].includes(query.fordisplay)) return 'invalid'
  return (query.fordisplay === 'all' ? supported.displayall : supported.fordisplay) ? '' : 'unsupported'
}
export function gatewayDisplayParams (value) {
  return value === 'all' ? { displayall: true } : value === undefined ? {} : { fordisplay: value }
}
export function gatewayDisplayMatches (row, value) {
  return typeof value !== 'boolean' || row.fordisplay === value
}
export function gatewayDisplayListLocation (route, getters, listLocation, value, id, target = {}) {
  if (!gatewayDisplayAdmin(getters) || typeof value !== 'boolean') return null
  if (String(target.projectid || '0') !== String(getters.project?.id || '0')) return null
  if (!listLocation.query.fordisplay || listLocation.query.fordisplay === 'all') {
    return { path: '/s2svpn', query: { ...listLocation.query, fordisplay: 'all', page: target.id ? listLocation.query.page || '1' : '1' } }
  }
  const query = { ...listLocation.query, fordisplay: listLocation.query.fordisplay === 'all' ? 'all' : String(value), id, page: '1' }
  if (target.vpcid) query.vpcid = target.vpcid
  if (target.projectid) { query.projectid = target.projectid; delete query.account; delete query.domainid } else if (target.account && target.domainid) { query.projectid = '0'; query.account = target.account; query.domainid = target.domainid }
  // A changed display setting must remain findable even if a former keyword
  // excluded it. Keep the validated owner/project/VPC scope from the return URL.
  delete query.keyword; delete query.q
  return { path: '/s2svpn', query }
}
