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

export const asnFields = ['zoneid', 'asnrangeid', 'asnumber', 'domainid', 'account', 'vpcid', 'networkid']
export const asnRoute = route => (route.meta?.name || route.name) === 'asnumbers' && !route.params?.id
export const asnAuth = store => JSON.stringify([store.getters.userInfo?.id, store.getters.userInfo?.roleid, store.getters.userInfo?.roletype, store.state?.user?.token, store.getters.project?.id, store.getters.listAllProjects, Object.keys(store.getters.apis || {}).sort()])
export const asnConfig = kind => ({
  zoneid: { api: 'listZones', field: 'zone', label: 'label.zone' },
  asnrangeid: { api: 'listASNRanges', field: 'asnumberrange', label: 'label.asnrange', unpaged: true },
  domainid: { api: 'listDomains', field: 'domain', label: 'label.domain' },
  account: { api: 'listAccounts', field: 'account', label: 'label.account' },
  vpcid: { api: 'listVPCs', field: 'vpc', label: 'label.vpc' },
  networkid: { api: 'listNetworks', field: 'network', label: 'label.network' }
})[kind]
export function asnExact (raw) {
  const text = String(raw ?? '').trim()
  return /^[0-9]+$/.test(text) && Number(text) <= 4294967295 ? String(Number(text)) : null
}
export function asnQuery (raw = {}, size = 20, getters = {}) {
  const query = {}
  for (const key of [...asnFields, 'keyword', 'isallocated', 'filter']) {
    const value = raw[key] ?? (key === 'networkid' ? raw.associatednetworkid : key === 'keyword' ? raw.q : undefined)
    if (value !== undefined && value !== null && value !== '') query[key] = Array.isArray(value) ? value : String(value).trim()
  }
  if (query.asnumber !== undefined && !Array.isArray(query.asnumber)) query.asnumber = asnExact(query.asnumber) ?? query.asnumber
  if (query.account && !query.domainid && getters.userInfo?.domainid) query.domainid = getters.userInfo.domainid
  if (!query.filter) query.filter = query.isallocated === 'true' ? 'allocatedonly' : query.isallocated === 'false' ? 'free' : 'all'
  if (['allocatedonly', 'free'].includes(query.filter) && query.isallocated === undefined) query.isallocated = String(query.filter === 'allocatedonly')
  if (query.keyword) query.q = query.keyword
  const positive = (value, fallback, max) => /^[0-9]+$/.test(String(value)) && Number(value) > 0 && Number(value) <= max ? String(Number(value)) : String(fallback)
  query.page = positive(raw.page, 1, 2147483647); query.pagesize = positive(raw.pagesize, size, 500)
  return query
}
export function asnError (query, getters = {}) {
  if (!('listASNumbers' in (getters.apis || {}))) return 'permission'
  if (getters.listAllProjects || getters.project?.id && getters.project.id !== '0') return 'project'
  if (Object.values(query).some(Array.isArray)) return 'invalid'
  if (query.asnumber !== undefined && asnExact(query.asnumber) === null) return 'integer'
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (asnFields.filter(k => k !== 'account' && k !== 'asnumber').some(k => query[k] && !uuid.test(query[k]))) return 'invalid'
  if (!['all', 'allocatedonly', 'free'].includes(query.filter) || query.isallocated !== undefined && (!['true', 'false'].includes(query.isallocated) || query.filter === 'all' || (query.filter === 'allocatedonly') !== (query.isallocated === 'true'))) return 'invalid'
  if (query.asnrangeid && !query.zoneid) return 'zone'
  if (query.account && !query.domainid) return 'domain'
  return ''
}
export function asnParams (query) {
  return Object.fromEntries([...asnFields, 'keyword', 'isallocated', 'page', 'pagesize'].filter(k => query[k] !== undefined && query[k] !== '').map(k => [k, query[k]]))
}
export function asnSearchQuery (current, values, size, getters) {
  return asnQuery({ ...values, page: 1, pagesize: size, ...(Object.prototype.hasOwnProperty.call(values, 'keyword') ? {} : values.searchQuery !== undefined ? { ...current, keyword: values.searchQuery, q: undefined, page: 1 } : {}) }, size, getters)
}
export const asnLabel = (kind, row) => kind === 'asnrangeid' ? `${row.startasn}–${row.endasn} (${row.zonename || row.zoneid})` : row.path || row.name || row.id
export function asnPickerParams (kind, scope) {
  if (kind === 'asnrangeid') return { zoneid: scope.zoneid }
  if (kind === 'zoneid' || kind === 'domainid') return {}
  if (kind === 'account') return { domainid: scope.domainid, isrecursive: false, listall: true }
  return { listall: true, ...Object.fromEntries(['zoneid', 'domainid', 'account'].filter(k => scope[k]).map(k => [k, scope[k]])), ...(scope.domainid ? { isrecursive: false } : {}), ...(kind === 'networkid' ? { traffictype: 'Guest', ...(scope.vpcid ? { vpcid: scope.vpcid } : {}) } : {}) }
}
export function asnCandidates (json, kind, scope) {
  const config = asnConfig(kind); const body = json?.[config.api.toLowerCase() + 'response']
  if (!body || body.errorcode || body[config.field] !== undefined && !Array.isArray(body[config.field])) throw Error('lookup')
  const rows = body[config.field] || []; const count = body.count ?? (!rows.length && kind !== 'asnrangeid' ? 0 : NaN)
  if (!Number.isSafeInteger(count) || count < rows.length || count > 0 && !rows.length || config.unpaged && count !== rows.length || new Set(rows.map(r => r.id)).size !== rows.length || rows.some(r => !r.id)) throw Error('lookup')
  if (rows.some(r => ['asnrangeid', 'vpcid', 'networkid'].includes(kind) && scope.zoneid && r.zoneid !== scope.zoneid || ['vpcid', 'networkid', 'account'].includes(kind) && scope.domainid && r.domainid !== scope.domainid || ['vpcid', 'networkid'].includes(kind) && scope.account && r.account !== scope.account)) throw Error('scope')
  return { rows, count }
}
export async function asnSelection (read, query, getters, current = () => true) {
  const rows = {}; const labels = {}
  const error = asnError(query, getters); if (error) throw Error(error)
  for (const kind of ['zoneid', 'domainid', 'account', 'asnrangeid', 'vpcid', 'networkid']) {
    if (!query[kind]) continue
    if (!current()) throw Error('stale')
    const config = asnConfig(kind)
    if (!(config.api in (getters.apis || {}))) throw Error('permission')
    const params = { ...asnPickerParams(kind, query), ...(config.unpaged ? {} : { [kind === 'account' ? 'name' : 'id']: query[kind], page: 1, pagesize: 20 }) }
    const result = asnCandidates(await read(config.api, params, { preserveOnFailure: true }), kind, query)
    if (!current()) throw Error('stale')
    const row = result.rows.find(r => (kind === 'account' ? r.name : r.id) === query[kind])
    if (!row) throw Error('missing')
    rows[kind] = row; labels[kind] = asnLabel(kind, row)
  }
  if (query.vpcid && rows.networkid && rows.networkid.vpcid !== query.vpcid) throw Error('combination')
  return { rows, labels }
}
export async function readAsnQuery (read, params, getters, current) {
  const meta = await asnSelection(read, asnQuery(params, 20, getters), getters, current)
  if (!current()) throw Error('stale')
  const json = await read('listASNumbers', params, { preserveOnFailure: true, timeout: 20000 })
  if (!current()) throw Error('stale')
  const body = json?.listasnumbersresponse; const rows = body?.asnumber || []
  if (!body || body.errorcode || !Array.isArray(rows) || !Number.isSafeInteger(body.count) || body.count < rows.length || body.count < 0 || new Set(rows.map(r => r.id)).size !== rows.length) throw Error('lookup')
  if (rows.some(r => !r.id || ['zoneid', 'asnrangeid', 'account', 'domainid', 'vpcid'].some(k => params[k] && r[k] !== params[k]) || params.asnumber !== undefined && String(r.asnumber) !== params.asnumber || params.keyword && !String(r.asnumber).includes(params.keyword) || params.isallocated !== undefined && (r.allocationstate === 'Allocated') !== (params.isallocated === 'true') || params.networkid && (meta.rows.networkid?.vpcid ? r.vpcid !== meta.rows.networkid.vpcid : r.associatednetworkid !== params.networkid))) throw Error('scope')
  return json
}
