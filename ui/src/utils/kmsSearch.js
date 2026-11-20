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

export const kmsApis = ['listKMSKeys', 'listHSMProfiles']
export const kmsRoute = route => ['kmskey', 'hsmprofile'].includes(route?.meta?.name || route?.name)
export const kmsListRoute = route => kmsRoute(route) && !route.params?.id
export const kmsListApi = route => (route.meta?.name || route.name) === 'kmskey' ? 'listKMSKeys' : 'listHSMProfiles'

export const kmsBooleans = ['enabled', 'ispublic']
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value)
const pickerApis = {
  zoneid: ['listZones', 'zone'],
  hsmprofileid: ['listHSMProfiles', 'hsmprofile'],
  domainid: ['listDomains', 'domain'],
  account: ['listAccounts', 'account'],
  projectid: ['listProjects', 'project']
}
const valueOf = value => typeof value === 'string' ? value.trim() : ''
const pageValue = (value, fallback, max) => {
  const number = Number(value)
  return String(!Array.isArray(value) && Number.isInteger(number) && number > 0 && number <= max ? number : fallback)
}
export const kmsProjectScope = getters => getters.project?.id || (getters.listAllProjects ? '-1' : '')
export const kmsAuth = (getters, token) => JSON.stringify([
  getters.userInfo?.id, getters.userInfo?.roleid, getters.userInfo?.roletype,
  getters.userInfo?.domainid, token, kmsProjectScope(getters), Object.keys(getters.apis || {}).sort()
])
export function kmsSearchFields (api, getters) {
  const fields = api === 'listKMSKeys' ? ['enabled', 'zoneid', 'hsmprofileid'] : ['enabled', 'ispublic', 'protocol', 'zoneid']
  if (!kmsProjectScope(getters) && ['Admin', 'DomainAdmin', 'ResourceAdmin'].includes(getters.userInfo?.roletype)) fields.push('domainid', 'account')
  if (!kmsProjectScope(getters)) fields.push('projectid')
  return fields.filter(field => !pickerApis[field] || pickerApis[field][0] in (getters.apis || {}))
}

export function kmsQuery (raw, api, getters, size = 20) {
  const fields = kmsSearchFields(api, getters)
  const query = {}
  for (const field of fields) {
    const value = raw[field]
    if (kmsBooleans.includes(field)) {
      if ([true, false, 'true', 'false'].includes(value)) query[field] = String(value)
    } else if (field.endsWith('id')) {
      if (uuid(value)) query[field] = value.toLowerCase()
    } else if (valueOf(value)) {
      query[field] = valueOf(value)
    }
  }
  const project = kmsProjectScope(getters) || query.projectid
  if (project) {
    query.projectid = project
    delete query.domainid
    delete query.account
  }
  if (!query.domainid) delete query.account
  const keyword = valueOf(raw.keyword) || valueOf(raw.q)
  if (keyword) query.keyword = query.q = keyword
  query.page = pageValue(raw.page, 1, 2147483647)
  query.pagesize = pageValue(raw.pagesize, size, 500)
  return query
}

export function kmsSearchQuery (current, values, api, getters, size) {
  if ('searchQuery' in values) {
    return kmsQuery({ ...current, keyword: values.searchQuery, q: '', page: 1 }, api, getters, size)
  }
  if (!values.kmsAdvanced) return kmsQuery({}, api, getters, size)
  return kmsQuery({ ...values.kmsAdvanced, keyword: current.keyword, page: 1 }, api, getters, size)
}

export function kmsParams (query) {
  const { q, ...params } = query
  return { ...params, ignoreproject: true, listall: true }
}

export function kmsListPage (json, api) {
  const envelope = json?.[api.toLowerCase() + 'response']
  const objectName = api === 'listKMSKeys' ? 'kmskey' : 'hsmprofile'
  const rows = envelope?.[objectName] ?? []
  const count = envelope?.count ?? (Array.isArray(rows) && rows.length === 0 ? 0 : NaN)
  if (!envelope || envelope.errorcode || !Array.isArray(rows) || !Number.isInteger(count) || count < rows.length) throw new Error('response')
  return { rows, count }
}

export async function kmsLookup (getAPI, field, scope, current, keyword) {
  const [api, key] = pickerApis[field]
  const params = { listall: true, ignoreproject: true, pagesize: 100, page: 1 }
  if (keyword) params.keyword = keyword
  if (field === 'account') {
    if (!scope.domainid || scope.projectid) return []
    Object.assign(params, { domainid: scope.domainid, isrecursive: false })
  }
  if (field === 'hsmprofileid' && scope.projectid) params.projectid = scope.projectid
  if (scope.lookupId) params.id = scope.lookupId
  const rows = []
  while (current()) {
    const json = await getAPI(api, { ...params }, { preserveOnFailure: true, timeout: 15000 })
    const result = json?.[api.toLowerCase() + 'response']
    const batch = result?.[key] ?? []
    if (!result || result.errorcode || !Array.isArray(batch)) throw new Error('response')
    rows.push(...batch)
    if (!batch.length || rows.length >= (result.count ?? rows.length)) break
    params.page++
  }
  return current() ? rows.filter(row => row.id && (field !== 'account' || row.domainid === scope.domainid)) : []
}

export async function readKmsPage (getAPI, api, params, current) {
  if (params.hsmprofileid) {
    const rows = await kmsLookup(getAPI, 'hsmprofileid', { ...params, lookupId: params.hsmprofileid }, current)
    if (!current()) throw new Error('stale')
    if (!rows.some(row => row.id === params.hsmprofileid)) throw new Error('profile')
  }
  if (!current()) throw new Error('stale')
  const json = await getAPI(api, params, { preserveOnFailure: true, timeout: 20000 })
  if (!current()) throw new Error('stale')
  const page = kmsListPage(json, api)
  const filters = ['enabled', 'ispublic', 'protocol', 'domainid', 'account', 'zoneid', 'hsmprofileid']
  if (page.rows.some(row => filters.some(key => params[key] !== undefined && String(row[key]).toLowerCase() !== String(params[key]).toLowerCase()) ||
      params.projectid && params.projectid !== '-1' && row.projectid !== params.projectid)) throw new Error('response')
  const responseKey = api.toLowerCase() + 'response'
  return { ...json, [responseKey]: { ...json[responseKey], count: page.count } }
}

export function kmsProtocolOptions (features, selected) {
  const choices = new Map([['database', 'Database'], ['pkcs11', 'PKCS#11']])
  for (const provider of features?.kmsproviders || []) {
    if (typeof provider.protocol === 'string' && provider.protocol) choices.set(provider.protocol, provider.displayname || provider.protocol)
  }
  if (selected && !choices.has(selected)) choices.set(selected, selected)
  const loaded = (features?.kmsproviders || []).map(provider => provider.protocol)
  return [...choices].sort(([a], [b]) => Number(loaded.includes(b)) - Number(loaded.includes(a))).map(([id, name]) => ({ id, name }))
}
export function kmsDetails (kind, role) {
  if (kind === 'kmskey') return ['description', 'algorithm', 'keybits', 'enabled', ...(['Admin', 'ResourceAdmin'].includes(role) ? ['keklabel'] : [])]
  return ['vendorname', 'protocol', 'hsmzonescope', 'hsmownerscope', 'enabled', 'state', 'details']
}
export function hsmOwnerScope (resource) {
  if (resource.ispublic === true) return 'public'
  if (resource.projectid) return 'project'
  if (resource.account) return 'account'
  if (resource.domainid) return 'domain'
  return ''
}
