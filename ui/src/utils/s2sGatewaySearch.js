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

export const s2sGatewayFields = ['id', 'vpcid', 'domainid', 'account']
const keys = [...s2sGatewayFields, 'keyword', 'q', 'projectid', 'page', 'pagesize']
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
const present = value => value !== undefined && value !== null && value !== ''
export const s2sGatewayRoute = route => (route?.meta?.name || route?.name) === 's2svpn'
export const s2sGatewayListRoute = route => s2sGatewayRoute(route) && !route?.params?.id
export const s2sGatewayProject = getters => String(getters.project?.id || (getters.listAllProjects ? '-1' : '0'))
export const s2sGatewayAuth = (getters, token) => JSON.stringify([getters.userInfo?.id, getters.userInfo?.roleid, getters.userInfo?.roletype, getters.userInfo?.domainid, token, s2sGatewayProject(getters), Object.keys(getters.apis || {}).sort()])
export function s2sGatewayQuery (raw = {}, size = 20, getters = {}) {
  const query = Object.fromEntries(Object.entries(raw).filter(([, value]) => present(value)).map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value]))
  if (!query.keyword && query.q) query.keyword = query.q
  if (query.keyword) query.q = query.keyword
  else { delete query.keyword; delete query.q }
  for (const key of ['id', 'vpcid', 'domainid']) if (uuid(query[key])) query[key] = query[key].toLowerCase()
  query.projectid = Array.isArray(raw.projectid) ? raw.projectid : String(raw.projectid || s2sGatewayProject(getters))
  if (uuid(query.projectid)) query.projectid = query.projectid.toLowerCase()
  const number = (value, fallback, max) => Array.isArray(value) ? value : /^\d+$/.test(String(value)) && Number(value) > 0 && Number(value) <= max ? String(Number(value)) : String(fallback)
  query.page = number(raw.page, 1, 2147483647)
  query.pagesize = number(raw.pagesize, size, 500)
  return query
}
export function s2sGatewayError (query, getters, supported = {}) {
  if (!getters.userInfo?.id || !('listVpnGateways' in (getters.apis || {}))) return 'permission'
  if (Object.entries(query).some(([key, value]) => !keys.includes(key) || typeof value !== 'string')) return 'invalid'
  if (query.projectid !== s2sGatewayProject(getters)) return 'scope'
  if (['id', 'vpcid', 'domainid'].some(key => query[key] && !uuid(query[key])) || !['0', '-1'].includes(query.projectid) && !uuid(query.projectid)) return 'uuid'
  if (query.account && !query.domainid) return 'account'
  if (query.keyword?.length > 255 || query.account?.length > 255) return 'invalid'
  if ([...s2sGatewayFields, 'keyword'].some(key => query[key] && !supported[key]) || query.projectid !== '0' && !supported.projectid) return 'unsupported'
  if (!['Admin', 'DomainAdmin'].includes(getters.userInfo?.roletype) && (query.domainid && query.domainid !== getters.userInfo.domainid || query.account && query.account !== getters.userInfo.account)) return 'permission'
  return ''
}
export function s2sGatewaySearchQuery (current, values = {}, size, getters) {
  let query
  if (Object.prototype.hasOwnProperty.call(values, 'searchQuery')) {
    query = { ...current }; delete query.keyword; delete query.q
    if (String(values.searchQuery || '').trim()) query.keyword = String(values.searchQuery).trim()
  } else query = { ...(values.s2sGatewaySearch || {}), projectid: s2sGatewayProject(getters) }
  return s2sGatewayQuery({ ...query, page: '1', pagesize: String(size) }, size, getters)
}
export function s2sGatewayParams (query) {
  const params = { ...Object.fromEntries(Object.entries(query).filter(([key]) => [...s2sGatewayFields, 'keyword', 'projectid', 'page', 'pagesize'].includes(key))), listall: true, ignoreproject: true }
  if (params.projectid === '0') delete params.projectid
  return params
}
const pickers = {
  vpcid: { api: 'listVPCs', field: 'vpc', label: 'label.vpc' },
  domainid: { api: 'listDomains', field: 'domain', label: 'label.domain' },
  account: { api: 'listAccounts', field: 'account', label: 'label.account' }
}
export const s2sGatewayPickerConfig = kind => pickers[kind]
export function s2sGatewayPickerParams (kind, scope, supported) {
  const params = { listall: true, ignoreproject: true }
  if (kind !== 'domainid' && scope.domainid) params.domainid = scope.domainid
  if (kind === 'account') { params.listall = false; params.isrecursive = false }
  if (kind === 'vpcid') {
    if (scope.account) params.account = scope.account
    if (scope.projectid && scope.projectid !== '0') params.projectid = scope.projectid
  }
  // A selected scope must never disappear because the API metadata lacks its parameter.
  if (Object.keys(params).some(key => !['ignoreproject', 'listall', 'isrecursive'].includes(key) && !supported[key])) throw Error('unsupported')
  return Object.fromEntries(Object.entries(params).filter(([key]) => key === 'ignoreproject' || supported[key]))
}
export function readS2sGatewayCandidates (json, kind, params) {
  const config = pickers[kind]; const data = json?.[config.api.toLowerCase() + 'response']
  if (!data || data.errorcode || data[config.field] !== undefined && !Array.isArray(data[config.field])) throw Error('response')
  const rows = data[config.field] || []; const count = data.count === undefined && !rows.length ? 0 : Number(data.count)
  if (!Number.isSafeInteger(count) || count < rows.length || count < 0 || rows.some(row => !uuid(row.id)) || new Set(rows.map(row => row.id)).size !== rows.length) throw Error('response')
  if (rows.some(row => params.id && row.id !== params.id || params.name && kind === 'account' && row.name !== params.name || kind === 'account' && row.domainid !== params.domainid || kind === 'vpcid' && (params.domainid && row.domainid !== params.domainid || params.account && row.account !== params.account || params.projectid && params.projectid !== '-1' && row.projectid !== params.projectid || !params.projectid && !!row.projectid))) throw Error('scope')
  return { rows, count, received: rows.length }
}
export async function s2sGatewaySelection (api, query, getters, current = () => true) {
  if (!current()) throw Error('stale')
  const labels = {}
  for (const kind of ['domainid', 'account', 'vpcid']) {
    if (!query[kind]) continue
    const config = pickers[kind]
    if (!(config.api in (getters.apis || {}))) throw Error('permission')
    const scope = { listall: true, ignoreproject: true, page: 1, pagesize: 20 }
    if (kind === 'account') { scope.listall = false; scope.name = query.account; scope.domainid = query.domainid; scope.isrecursive = false } else scope.id = query[kind]
    if (kind === 'vpcid') Object.assign(scope, s2sGatewayParams(query), { id: query.vpcid, page: 1, pagesize: 20 })
    // Gateway-specific filters are not listVPCs parameters.
    if (kind === 'vpcid') { delete scope.keyword; delete scope.vpcid }
    if (!current()) throw Error('stale')
    const json = await api(config.api, scope, { preserveOnFailure: true, timeout: 20000 })
    if (!current()) throw Error('stale')
    const result = readS2sGatewayCandidates(json, kind, scope)
    const row = result.rows.find(row => kind === 'account' ? row.name === query.account : row.id === query[kind])
    if (!row) throw Error('missing')
    labels[kind] = row.path || row.name || row.id
  }
  return labels
}
export function readS2sGatewayPage (json, params) {
  const data = json?.listvpngatewaysresponse
  if (!data || data.errorcode || data.vpngateway !== undefined && !Array.isArray(data.vpngateway)) throw Error('response')
  const rows = data.vpngateway || []; const count = data.count === undefined && !rows.length ? 0 : Number(data.count)
  if (!Number.isSafeInteger(count) || count < rows.length || count < 0 || new Set(rows.map(row => row.id)).size !== rows.length || rows.some(row => !uuid(row.id))) throw Error('response')
  if (rows.some(row => ['id', 'vpcid', 'domainid', 'account'].some(key => params[key] && row[key] !== params[key]) || params.projectid && params.projectid !== '-1' && row.projectid !== params.projectid || !params.projectid && !!row.projectid || row.fordisplay === false)) throw Error('scope')
  return { rows, count }
}
export async function readS2sGatewayQuery (api, params, getters, current) {
  await s2sGatewaySelection(api, { ...params, projectid: params.projectid || '0' }, getters, current)
  if (!current()) throw Error('stale')
  const json = await api('listVpnGateways', params, { preserveOnFailure: true, timeout: 20000 })
  if (!current()) throw Error('stale')
  const page = readS2sGatewayPage(json, params)
  return { ...json, listvpngatewaysresponse: { ...json.listvpngatewaysresponse, vpngateway: page.rows, count: page.count } }
}
const returnOwner = getters => JSON.stringify([getters.userInfo?.id, getters.userInfo?.roleid, getters.userInfo?.roletype, getters.userInfo?.domainid, s2sGatewayProject(getters)])
export function s2sGatewayDetailLocation (route, row, getters) {
  return { path: '/s2svpn/' + row.id, query: { s2sreturn: JSON.stringify({ query: route.query, owner: returnOwner(getters) }) } }
}
export function s2sGatewayListLocation (route, getters) {
  let saved = {}
  try { if (typeof route.query?.s2sreturn === 'string' && route.query.s2sreturn.length < 8192) { const value = JSON.parse(route.query.s2sreturn); if (value?.owner === returnOwner(getters) && value.query && typeof value.query === 'object' && !Array.isArray(value.query)) saved = value.query } } catch (_) {}
  if (saved.projectid !== s2sGatewayProject(getters)) saved = {}
  return { path: '/s2svpn', query: s2sGatewayQuery(saved, 20, getters) }
}
