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

export const vnfRoute = route => route?.meta?.name === 'vnfapp'
export const vnfSearchKeys = ['name', 'keyword', 'state', 'zoneid', 'domainid', 'account', 'groupid', 'networkid', 'templateid', 'serviceofferingid']
export const vnfPickerKinds = ['zoneid', 'domainid', 'account', 'groupid', 'networkid', 'templateid', 'serviceofferingid']
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
const present = value => value !== undefined && value !== null && value !== ''
const tag = key => /^tags\[\d+\]\.(key|value)$/.test(key)
export const vnfProject = getters => getters.project?.id || (getters.listAllProjects ? '-1' : '0')
export const vnfStates = getters => ['Running', 'Stopped', ...(['recoverVirtualMachine', 'expungeVirtualMachine'].some(k => k in (getters.apis || {})) ? ['Destroyed'] : [])]
export function vnfState (value) { return ['Running', 'Stopped', 'Destroyed'].find(v => v.toLowerCase() === String(value || '').toLowerCase()) || '' }
export function vnfAuth (getters, token) { return JSON.stringify([getters.userInfo?.id, getters.userInfo?.roletype, getters.userInfo?.roleid, getters.userInfo?.domainid, token, getters.project?.id, getters.listAllProjects, Object.keys(getters.apis || {}).sort()]) }

export function vnfListQuery (raw = {}, size = 20, getters = {}) {
  const query = Object.fromEntries(Object.entries(raw).filter(([k, v]) => present(v) && (vnfSearchKeys.includes(k) || tag(k) || ['q', 'projectid', 'hostid', 'displayname'].includes(k))).map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v]))
  const state = raw.state || (raw.filter !== 'all' ? raw.filter : '')
  if (state && String(state).toLowerCase() !== 'all') query.state = vnfState(state) || state
  else delete query.state
  if (query.q && !query.keyword) query.keyword = query.q
  if (query.keyword) query.q = query.keyword
  else delete query.q
  query.projectid = String(raw.projectid || vnfProject(getters))
  query.page = String(Number.isSafeInteger(Number(raw.page)) && Number(raw.page) > 0 ? Number(raw.page) : 1)
  query.pagesize = String([10, 20, 50, 100, 200, Number(size)].includes(Number(raw.pagesize)) && Number(raw.pagesize) > 0 ? Number(raw.pagesize) : size)
  return query
}
export function vnfSearchQuery (current, values, size, getters) {
  let query
  if (Object.prototype.hasOwnProperty.call(values || {}, 'searchQuery')) {
    query = { ...current }; delete query.keyword; delete query.q
    if (String(values.searchQuery || '').trim()) query.keyword = query.q = String(values.searchQuery).trim()
  } else query = { projectid: current.projectid, ...(values || {}) }
  return vnfListQuery({ ...query, page: '1', pagesize: String(size) }, size, getters)
}
export function vnfSearchError (query, getters, params = {}) {
  if (!('listVnfAppliances' in (getters.apis || {}))) return 'message.vnf.search.permission'
  if (query.hostid || query.displayname) return 'message.vnf.search.unsupported'
  if (query.state && (!vnfState(query.state) || !vnfStates(getters).includes(query.state))) return 'message.vnf.search.state'
  if (Object.keys(query).some(k => present(query[k]) && (vnfSearchKeys.includes(k) || tag(k)) && !(tag(k) ? params.tags : params[k]))) return 'message.vnf.search.unsupported'
  if (['zoneid', 'domainid', 'groupid', 'networkid', 'templateid', 'serviceofferingid'].some(k => query[k] && !uuid(query[k]))) return 'message.vnf.search.uuid'
  if (!['0', '-1'].includes(query.projectid) && !uuid(query.projectid)) return 'message.vnf.search.uuid'
  if (query.account && !query.domainid) return 'message.affinity.search.account.domain'
  for (const key of Object.keys(query)) {
    const config = vnfPickerConfig(key)
    if (config && query[key] && !(config.api in (getters.apis || {}))) return 'message.vnf.search.permission'
  }
  return ''
}
export function vnfListParams (params, detail = false) {
  const clean = Object.fromEntries(Object.entries(params).filter(([k]) => (detail ? ['id'] : vnfSearchKeys).includes(k) || tag(k) || ['projectid', 'ignoreproject', 'page', 'pagesize', 'details', 'listall', 'showicon', 'showIcon', 'isvnf'].includes(k)))
  if (clean.projectid === '0') { delete clean.projectid; clean.ignoreproject = true }
  return clean
}
export function vnfDetailLocation (route, row) {
  const saved = vnfListQuery(route.query)
  return { path: '/vnfapp/' + row.id, query: { projectid: row.projectid || '0', vnfreturn: JSON.stringify(saved) } }
}
export function vnfListLocation (route, getters = {}) {
  let saved = { projectid: route.query?.projectid || vnfProject(getters) }
  if (typeof route.query?.vnfreturn === 'string' && route.query.vnfreturn.length < 8192) {
    try { const value = JSON.parse(route.query.vnfreturn); if (value && typeof value === 'object' && !Array.isArray(value)) saved = value } catch (_) {}
  }
  return { path: '/vnfapp', query: vnfListQuery(saved, 20, getters) }
}
export function readVnfPage (json, params) {
  const data = json?.listvnfappliancesresponse
  if (!data || data.errorcode || data.virtualmachine !== undefined && !Array.isArray(data.virtualmachine)) throw Error('message.vnf.search.response')
  const rows = data.virtualmachine || []
  const count = data.count === undefined && !rows.length ? 0 : Number(data.count)
  if (!Number.isSafeInteger(count) || count < rows.length || count < 0 || new Set(rows.map(r => r.id)).size !== rows.length || rows.some(r => !uuid(r.id))) throw Error('message.vnf.search.response')
  if (rows.some(r => r.templatetype !== 'VNF' || params.state && r.state !== params.state || params.zoneid && r.zoneid !== params.zoneid || params.templateid && r.templateid !== params.templateid || params.serviceofferingid && r.serviceofferingid !== params.serviceofferingid || params.networkid && !r.nic?.some(n => n.networkid === params.networkid) || params.projectid && params.projectid !== '-1' && r.projectid !== params.projectid || params.ignoreproject && r.projectid || params.domainid && r.domainid !== params.domainid || params.account && r.account !== params.account)) throw Error('message.vnf.search.response')
  return { rows, count }
}
const pickers = {
  zoneid: { api: 'listZones', field: 'zone', label: 'label.zone' },
  domainid: { api: 'listDomains', field: 'domain', label: 'label.domain' },
  account: { api: 'listAccounts', field: 'account', label: 'label.account' },
  groupid: { api: 'listInstanceGroups', field: 'instancegroup', label: 'label.group' },
  networkid: { api: 'listNetworks', field: 'network', label: 'label.network' },
  templateid: { api: 'listVnfTemplates', field: 'template', label: 'label.template' },
  serviceofferingid: { api: 'listServiceOfferings', field: 'serviceoffering', label: 'label.serviceofferingid' }
}
export const vnfPickerConfig = kind => pickers[kind]
export function vnfPickerParams (kind, scope, supported) {
  const params = { listall: true, ...Object.fromEntries(['zoneid', 'domainid', 'account'].filter(k => scope[k]).map(k => [k, scope[k]])) }
  if (scope.projectid && scope.projectid !== '0') params.projectid = scope.projectid
  if (kind === 'zoneid') { delete params.zoneid; delete params.account }
  if (kind === 'domainid') { delete params.domainid; delete params.account }
  if (kind === 'account') { delete params.account; params.isrecursive = false }
  if (kind === 'templateid') params.templatefilter = 'all'
  if (kind === 'serviceofferingid') params.issystem = false
  if (kind === 'networkid') params.issystem = false
  const clean = Object.fromEntries(Object.entries(params).filter(([k]) => supported[k]))
  if (scope.projectid === '0' || !supported.projectid) clean.ignoreproject = true
  return clean
}
export function readVnfCandidates (json, kind, params) {
  const config = pickers[kind]; const data = json?.[config.api.toLowerCase() + 'response'] || (kind === 'templateid' ? json?.listtemplatesresponse : null)
  if (!data || data.errorcode || data[config.field] !== undefined && !Array.isArray(data[config.field])) throw Error('Invalid candidate response')
  const all = data[config.field] || []; const count = data.count === undefined && !all.length ? 0 : Number(data.count)
  if (!Number.isSafeInteger(count) || count < all.length || count < 0 || all.some(r => !uuid(r.id)) || new Set(all.map(r => r.id)).size !== all.length) throw Error('Invalid candidate page')
  const rows = all.filter(r => {
    if (params.id && r.id !== params.id || params.name && kind === 'account' && r.name !== params.name) return false
    if (kind === 'templateid' && r.templatetype !== 'VNF') return false
    if (params.zoneid && r.zoneid && r.zoneid !== params.zoneid) return false
    if (kind === 'account' && r.domainid !== params.domainid) return false
    if (['networkid', 'groupid'].includes(kind) && (params.projectid && params.projectid !== '-1' ? r.projectid !== params.projectid && !(kind === 'networkid' && r.type === 'Shared' && !r.projectid) : !params.projectid && !!r.projectid)) return false
    if (kind === 'templateid' && r.projectid && params.projectid !== '-1' && r.projectid !== params.projectid) return false
    if (kind === 'templateid' && params.projectid && params.projectid !== '-1' && !r.projectid && r.ispublic !== true) return false
    if (['networkid', 'templateid', 'groupid'].includes(kind) && params.account && !r.ispublic && r.account !== params.account) return false
    return true
  })
  return { rows, count, received: all.length }
}
