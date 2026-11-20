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

import { kmsDetailFailure, kmsHistoryOwner } from './kmsNavigation'
import { kmsProjectScope } from './kmsSearch'

const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value)

export const kmsRelations = {
  kmskey: {
    tab: 'kms.used.volumes',
    api: 'listVolumes',
    target: 'volume',
    filter: 'kmskeyid',
    response: 'listvolumesresponse',
    fields: ['name', 'id', 'vmname', 'state', 'size', 'encryptformat', 'kmskeyversion', 'zonename'],
    usage: ['volumecount', 'wrappedkeycount']
  },
  hsmprofile: {
    tab: 'kms.related.keys',
    api: 'listKMSKeys',
    target: 'kmskey',
    filter: 'hsmprofileid',
    response: 'listkmskeysresponse',
    fields: ['name', 'id', 'enabled', 'version', 'hsmprofile', 'owner', 'zonename'],
    usage: ['kmskeycount', 'versionwrappedkeycount']
  }
}

export function kmsRelatedQuery (query = {}) {
  const page = Number(query.relatedpage)
  const size = Number(query.relatedpagesize)
  return {
    keyword: typeof query.relatedkeyword === 'string' ? query.relatedkeyword.trim().slice(0, 255) : '',
    page: typeof query.relatedpage !== 'object' && Number.isSafeInteger(page) && page >= 1 && page <= 2147483647 ? page : 1,
    pagesize: typeof query.relatedpagesize !== 'object' && [10, 20, 50, 100].includes(size) ? size : 20
  }
}

export function kmsRelatedFilter (kind, resource, getters) {
  const scope = kmsProjectScope(getters)
  const projectid = scope && scope !== '-1' ? scope : resource.projectid || scope
  const filter = { [kmsRelations[kind].filter]: resource.id }
  if (projectid) filter.projectid = projectid
  if (!projectid && resource.ispublic !== true && uuid(resource.domainid)) {
    filter.domainid = resource.domainid
    if (resource.account) filter.account = resource.account
  }
  if (kind === 'kmskey' && uuid(resource.zoneid)) filter.zoneid = resource.zoneid
  return filter
}

export async function readKmsRelatedPage (get, kind, resource, getters, { keyword, page, pagesize }) {
  const relation = kmsRelations[kind]
  if (!uuid(resource.id)) throw new Error('missing')
  if (!(relation.api in (getters.apis || {}))) throw new Error('forbidden')
  const filters = kmsRelatedFilter(kind, resource, getters)
  const params = { ...filters, listall: true, ignoreproject: true, page, pagesize, ...(keyword ? { keyword } : {}) }
  const envelope = (await get(relation.api, params, { preserveOnFailure: true, timeout: 20000 }))?.[relation.response]
  if (envelope?.errorcode) {
    throw Object.assign(new Error('invalid'), { response: { data: { [relation.response]: envelope } } })
  }
  const rows = envelope?.[relation.target] ?? []
  const count = envelope?.count ?? (Array.isArray(rows) && rows.length === 0 ? 0 : NaN)
  if (!envelope || !Array.isArray(rows) || !Number.isSafeInteger(count) || count < rows.length ||
      rows.some(row => !uuid(row?.id) || row[relation.filter] !== resource.id ||
        filters.projectid && (filters.projectid === '-1' ? !row.projectid : row.projectid !== filters.projectid) ||
        ['account', 'domainid', 'zoneid'].some(field => filters[field] && row[field] != null && row[field] !== filters[field])) ||
      new Set(rows.map(row => row.id)).size !== rows.length) throw new Error('invalid')
  return { rows, count }
}

export function kmsUsage (kind, resource) {
  if (!kmsRelations[kind]) return null
  const fields = kmsRelations[kind].usage
  const usage = resource?.usage
  if (!fields.every(key => Number.isSafeInteger(usage?.[key]) && usage[key] >= 0)) return null
  return Object.fromEntries(fields.map(key => [key, usage[key]]))
}

export function kmsRelatedFailure (error, relation, id) {
  const status = Number(error?.response?.status)
  const text = Object.values(error?.response?.data || {}).find(row => typeof row?.errortext === 'string')?.errortext
  if (status === 431 && text?.startsWith('Invalid parameter ' + relation.filter + ' value=' + id + ' due to incorrect long value format, or entity does not exist')) return 'missing'
  return kmsDetailFailure(error)
}

export function kmsRelatedChildLocation (route, row, historyState, getters, token) {
  const kind = route.meta?.name
  const relation = kmsRelations[kind]
  const projectid = uuid(row.projectid) ? row.projectid : undefined
  const location = { path: '/' + relation.target + '/' + row.id, query: projectid ? { projectid } : {} }
  if (!token || !getters.userInfo?.id || !uuid(route.params?.id)) return location
  const { keyword, page, pagesize } = kmsRelatedQuery(route.query)
  const parent = { kind, id: route.params.id, keyword, page, pagesize, projectid: route.query.projectid }
  location.state = { kmsRelatedReturn: { parent, child: row.id, owner: kmsHistoryOwner(getters, token), kmsReturn: historyState?.kmsReturn || null } }
  return location
}

export function kmsRelatedParentLocation (route, historyState, getters, token) {
  const entry = historyState?.kmsRelatedReturn
  if (!token || !getters.userInfo?.id || !entry || !uuid(entry.parent?.id) ||
      entry.child !== route.params?.id || entry.owner !== kmsHistoryOwner(getters, token)) return null
  const parent = entry.parent
  const relation = kmsRelations[parent.kind]
  if (!relation || relation.target !== (route.meta?.name || route.name)) return null
  const { keyword, page, pagesize } = kmsRelatedQuery({ relatedkeyword: parent.keyword, relatedpage: parent.page, relatedpagesize: parent.pagesize })
  const query = { tab: relation.tab, relatedpage: String(page), relatedpagesize: String(pagesize) }
  if (keyword) query.relatedkeyword = keyword
  if (uuid(parent.projectid)) query.projectid = parent.projectid
  return { path: '/' + parent.kind + '/' + parent.id, query, state: { kmsReturn: entry.kmsReturn, kmsRelatedReturn: null } }
}
