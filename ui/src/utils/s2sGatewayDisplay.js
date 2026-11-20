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
  const mode = listLocation.query.fordisplay || 'all'
  return { path: '/s2svpn', query: { ...listLocation.query, fordisplay: mode === 'all' ? 'all' : String(value), page: mode === 'all' && target.id ? listLocation.query.page || '1' : '1' } }
}
