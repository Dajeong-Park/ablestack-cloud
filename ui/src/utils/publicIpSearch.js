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

export const publicIpRoute = route => route?.meta?.name === 'publicip'
export const publicIpStates = ['Allocated', 'Reserved', 'Free', 'Allocating', 'Releasing']
export const publicIpKeys = ['keyword', 'ipaddress', 'zoneid', 'domainid', 'account', 'vlanid', 'vpcid', 'associatednetworkid', 'networkid', 'physicalnetworkid', 'issourcenat', 'isstaticnat', 'fordisplay']
export const publicIpProject = getters => String(getters.project?.id || (getters.listAllProjects ? '-1' : '0'))
export const publicIpRoot = getters => getters.userInfo?.roletype === 'Admin'
export const publicIpDefaultFilter = getters => publicIpRoot(getters) ? 'all' : 'allocated'
const present = v => v !== undefined && v !== null && v !== ''
const tag = k => /^tags\[\d+\]\.(key|value)$/.test(k)
const uuid = v => typeof v === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v)
export function publicIpQuery (raw = {}, size = 20, getters = {}) {
  const query = Object.fromEntries(Object.entries(raw).filter(([k, v]) => present(v) || tag(k) && k.endsWith('.value') && v === '').map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v]))
  const state = String(query.state || query.filter || publicIpDefaultFilter(getters))
  query.filter = state.toLowerCase()
  query.state = publicIpStates.find(s => s.toLowerCase() === state.toLowerCase()) || state
  if (state.toLowerCase() === 'all') delete query.state
  if (query.q && !query.keyword) query.keyword = query.q
  if (query.keyword) query.q = query.keyword
  else delete query.q
  query.projectid = String(query.projectid || publicIpProject(getters))
  query.page = String(Number.isSafeInteger(Number(raw.page)) && Number(raw.page) > 0 ? Number(raw.page) : 1)
  query.pagesize = String([10, 20, 50, 100, 200].includes(Number(raw.pagesize)) ? Number(raw.pagesize) : Number(size) || 20)
  for (const key of ['issourcenat', 'isstaticnat', 'fordisplay']) if (present(query[key])) query[key] = String(query[key]).toLowerCase()
  return query
}
export function publicIpSearchQuery (current, values = {}, size, getters) {
  let query = { projectid: current.projectid, filter: current.filter, ...(Object.prototype.hasOwnProperty.call(values, 'filter') ? {} : { state: current.state }), ...values }
  if (Object.prototype.hasOwnProperty.call(values, 'searchQuery')) {
    query = { ...current }; delete query.q; delete query.keyword; delete query.ipaddress
    if (String(values.searchQuery || '').trim()) query.q = query.keyword = String(values.searchQuery).trim()
  }
  if (query.ipaddress) { delete query.keyword; delete query.q }
  return publicIpQuery({ ...query, page: '1', pagesize: String(size) }, size, getters)
}
export function publicIpSearchError (query, getters, supported = {}) {
  if (!('listPublicIpAddresses' in (getters.apis || {}))) return 'message.public.ip.search.permission'
  if (Object.values(query).some(value => typeof value !== 'string')) return 'message.public.ip.search.invalid'
  if (query.projectid !== publicIpProject(getters)) return 'message.public.ip.search.scope'
  if (query.state && !publicIpStates.includes(query.state)) return 'message.public.ip.search.invalid'
  if (['all', 'free'].includes(query.filter) && !publicIpRoot(getters)) return 'message.public.ip.search.permission'
  if (Object.keys(query).some(k => !publicIpKeys.includes(k) && !tag(k) && !['state', 'filter', 'q', 'projectid', 'page', 'pagesize'].includes(k))) return 'message.public.ip.search.invalid'
  if (Object.keys(query).some(k => (publicIpKeys.includes(k) || tag(k) || k === 'state') && !(tag(k) ? supported.tags : supported[k]))) return 'message.public.ip.search.unsupported'
  if (['issourcenat', 'isstaticnat', 'fordisplay'].some(k => present(query[k]) && !(k === 'fordisplay' ? ['true', 'false', 'all'] : ['true', 'false']).includes(query[k]))) return 'message.public.ip.search.invalid'
  if (['zoneid', 'domainid', 'vlanid', 'vpcid', 'associatednetworkid', 'networkid', 'physicalnetworkid'].some(k => query[k] && !uuid(query[k])) || !['0', '-1'].includes(query.projectid) && !uuid(query.projectid)) return 'message.public.ip.search.invalid'
  if (query.projectid !== '0' && !supported.projectid) return 'message.public.ip.search.unsupported'
  if (query.ipaddress && query.keyword) return 'message.public.ip.search.invalid'
  if (query.account && query.projectid !== '0') return 'message.public.ip.search.invalid'
  if (query.account && !query.domainid) return 'message.affinity.search.account.domain'
  if (['networkid', 'physicalnetworkid', 'fordisplay'].some(k => present(query[k])) && !publicIpRoot(getters)) return 'message.public.ip.search.permission'
  if (query.fordisplay === 'all' && !supported.displayall) return 'message.public.ip.search.unsupported'
  if (publicIpRoot(getters) && (!supported.domainid || !supported.isrecursive || !getters.userInfo?.domainid)) return 'message.public.ip.search.unsupported'
  if ((!query.state || query.state !== 'Allocated') && !supported.allocatedonly) return 'message.public.ip.search.unsupported'
  return ''
}
export function publicIpParams (query, getters, supported) {
  const params = Object.fromEntries(Object.entries(query).filter(([k]) => publicIpKeys.includes(k) || tag(k) || ['state', 'projectid', 'page', 'pagesize'].includes(k)))
  if (params.fordisplay === 'all') { delete params.fordisplay; params.displayall = true }
  params.listall = true
  params.allocatedonly = query.state === 'Allocated'
  if (params.projectid === '0') { delete params.projectid; params.ignoreproject = true }
  // Root non-allocated searches otherwise skip the server ACL builder, including project scope.
  // Supply the current domain (recursive for the Root view), never another owner/project.
  if (publicIpRoot(getters) && !params.domainid && getters.userInfo?.domainid) { params.domainid = getters.userInfo.domainid; params.isrecursive = true }
  return Object.fromEntries(Object.entries(params).filter(([k]) => k === 'ignoreproject' || tag(k) && supported.tags || supported[k]))
}
export function readPublicIpPage (json, params, getters = {}) {
  const body = json?.listpublicipaddressesresponse
  if (!body || body.errorcode || body.publicipaddress !== undefined && !Array.isArray(body.publicipaddress)) throw Error('Invalid Public IP response')
  const rows = body.publicipaddress || []; const count = body.count === undefined && !rows.length ? 0 : Number(body.count)
  if (!Number.isSafeInteger(count) || count < rows.length || count < 0 || new Set(rows.map(r => r.id)).size !== rows.length || rows.some(r => !r.id)) throw Error('Invalid Public IP page')
  if (rows.some(r => params.state && r.state !== params.state || ['zoneid', 'vpcid', 'associatednetworkid', 'networkid', 'physicalnetworkid', 'vlanid', 'account'].some(k => params[k] && r[k] !== params[k] && !(k === 'vlanid' && r[k] === undefined && !publicIpRoot(getters)) && !(r.state === 'Free' && ['vpcid', 'associatednetworkid', 'account'].includes(k))) || ['issourcenat', 'isstaticnat', 'fordisplay'].some(k => params[k] !== undefined && r[k] !== undefined && String(r[k]) !== String(params[k])) || params.projectid && params.projectid !== '-1' && r.state !== 'Free' && r.projectid !== params.projectid || params.ignoreproject && r.projectid)) throw Error('Public IP scope mismatch')
  return { rows, count }
}
export function publicIpDetailLocation (route, row) { return { path: '/publicip/' + row.id, query: { pipreturn: JSON.stringify(route.query) } } }
export function publicIpListLocation (route, getters) {
  let query = {}
  try { if (typeof route.query?.pipreturn === 'string' && route.query.pipreturn.length < 8192) { const saved = JSON.parse(route.query.pipreturn); if (saved && typeof saved === 'object' && !Array.isArray(saved)) query = saved } } catch (_) {}
  return { path: '/publicip', query: publicIpQuery(query, 20, getters) }
}
const pickers = {
  zoneid: { api: 'listZones', field: 'zone', label: 'label.zone' },
  domainid: { api: 'listDomains', field: 'domain', label: 'label.domain' },
  account: { api: 'listAccounts', field: 'account', label: 'label.account' },
  vpcid: { api: 'listVPCs', field: 'vpc', label: 'label.vpc' },
  associatednetworkid: { api: 'listNetworks', field: 'network', label: 'label.public.ip.network.attached' },
  networkid: { api: 'listNetworks', field: 'network', label: 'label.public.ip.network.source' },
  physicalnetworkid: { api: 'listPhysicalNetworks', field: 'physicalnetwork', label: 'label.physicalnetworkid' },
  vlanid: { api: 'listVlanIpRanges', field: 'vlaniprange', label: 'label.public.ip.vlan.range.id' }
}
export const publicIpPickerConfig = kind => pickers[kind]
export function publicIpPickerParams (kind, scope, supported) {
  const p = { listall: true, ...Object.fromEntries(['zoneid', 'domainid', 'account', 'projectid'].filter(k => scope[k]).map(k => [k, scope[k]])) }
  if (kind === 'zoneid') { delete p.zoneid; delete p.domainid; delete p.account; delete p.projectid }
  if (kind === 'domainid') { delete p.domainid; delete p.account; delete p.projectid }
  if (kind === 'account') { delete p.account; delete p.projectid; p.isrecursive = false }
  if (kind === 'associatednetworkid') { p.traffictype = 'Guest'; p.issystem = false; if (scope.vpcid) p.vpcid = scope.vpcid }
  if (kind === 'networkid') { p.traffictype = 'Public'; p.issystem = true; delete p.account; delete p.domainid; delete p.projectid }
  if (kind === 'physicalnetworkid') { delete p.account; delete p.domainid; delete p.projectid }
  if (kind === 'vlanid') { if (scope.networkid) p.networkid = scope.networkid; if (scope.physicalnetworkid) p.physicalnetworkid = scope.physicalnetworkid }
  if (p.projectid === '0') delete p.projectid
  return { ...Object.fromEntries(Object.entries(p).filter(([k]) => supported[k])), ...(!p.projectid || !supported.projectid ? { ignoreproject: true } : {}) }
}
export function readPublicIpCandidates (json, kind, params) {
  const config = pickers[kind]; const data = json?.[config.api.toLowerCase() + 'response']
  if (!data || data.errorcode || data[config.field] !== undefined && !Array.isArray(data[config.field])) throw Error('Invalid candidates')
  const all = data[config.field] || []; const count = data.count === undefined && !all.length ? 0 : Number(data.count)
  if (!Number.isSafeInteger(count) || count < all.length || count < 0 || all.some(r => !uuid(r.id)) || new Set(all.map(r => r.id)).size !== all.length) throw Error('Invalid candidate page')
  const rows = all.filter(r => !(params.id && r.id !== params.id || params.zoneid && r.zoneid && r.zoneid !== params.zoneid || params.traffictype && r.traffictype !== params.traffictype || params.vpcid && r.vpcid !== params.vpcid || params.account && r.account !== params.account && kind !== 'account' || kind === 'account' && r.domainid !== params.domainid || ['vpcid', 'associatednetworkid'].includes(kind) && (params.projectid && params.projectid !== '-1' ? r.projectid !== params.projectid : params.ignoreproject && r.projectid)))
  return { rows, count, received: all.length }
}
