// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements. See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership. The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License. You may obtain a copy of the License at
// http://www.apache.org/licenses/LICENSE-2.0 . Unless required
// by applicable law or agreed to in writing, software distributed
// under the License is distributed on an "AS IS" BASIS, WITHOUT
// WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
import { asnExact, asnQuery, asnError } from '@/utils/asnSearch'

const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value)
const operations = new Map()
const reasons = ['eligible', 'notallocated', 'requiredbyoffering', 'missingreference', 'unknown']
export function asnReleaseReason (row) {
  if (!row || !reasons.includes(row.releasereason) || typeof row.releasable !== 'boolean') return 'unknown'
  if (row.allocationstate !== 'Allocated') return 'notallocated'
  return row.releasable === true && row.releasereason === 'eligible' ? 'eligible' : row.releasereason === 'eligible' ? 'unknown' : row.releasereason
}
export const asnCanRelease = (row, getters) => getters.userInfo?.roletype === 'Admin' && ['listASNumbers', 'releaseASNumber'].every(k => k in (getters.apis || {})) && asnReleaseReason(row) === 'eligible'
export function asnReleaseTarget (row) {
  const asnumber = asnExact(row?.asnumber)
  if (!uuid(row?.id) || !uuid(row?.zoneid) || asnumber === null) throw Error('missing')
  return Object.freeze({ ...row, asnumber })
}
export const asnReleaseOperation = key => operations.get(key)
export function asnStartRelease (key) {
  if (operations.has(key)) throw Error('busy')
  const operation = { busy: true, accepted: false }
  operations.set(key, operation)
  return operation
}
export const asnClearRelease = key => operations.delete(key)
export async function asnReleaseRead (read, target, current) {
  if (!current()) throw Error('stale')
  const json = await read('listASNumbers', { zoneid: target.zoneid, asnumber: target.asnumber, page: 1, pagesize: 2 }, { preserveOnFailure: true, timeout: 20000 })
  if (!current()) throw Error('stale')
  const body = json?.listasnumbersresponse
  const rows = body?.asnumber
  if (!body || body.errorcode || body.count !== 1 || !Array.isArray(rows) || rows.length !== 1) throw Error('missing')
  const row = rows[0]
  if (row.id !== target.id || row.zoneid !== target.zoneid || String(row.asnumber) !== target.asnumber) throw Error('changed')
  return row
}
export function asnAllocationMatches (target, row) {
  return ['associatednetworkid', 'vpcid', 'accountid', 'domainid', 'allocated'].every(k => (target[k] || null) === (row[k] || null))
}
export function asnZoneLocation (zone, route, getters) {
  if (!uuid(zone?.id) || zone.routedmodeenabled !== true) throw Error('zone')
  // The named zone route is the list; its detail child is unnamed.
  return { path: '/zone/' + zone.id, query: { tab: 'asnumber', asnreturn: JSON.stringify(asnQuery(route.query, 20, getters)) } }
}
export function asnReturnLocation (raw, getters) {
  try {
    const value = JSON.parse(raw)
    if (!value || Array.isArray(value) || typeof value !== 'object') return null
    const query = asnQuery(value, 20, getters)
    return asnError(query, getters) ? null : { name: 'asnumbers', query }
  } catch (_) { return null }
}
export function asnField (row, field, apis) {
  const mapping = {
    associatednetworkname: ['associatednetworkid', 'associatednetworkname', 'guestnetwork', 'listNetworks'],
    vpcname: ['vpcid', 'vpcname', 'vpc', 'listVPCs'],
    account: ['accountid', 'account', 'account', 'listAccounts'],
    domain: ['domainid', 'domain', 'domain', 'listDomains'],
    zonename: ['zoneid', 'zonename', 'zone', 'listZones']
  }[field]
  if (!mapping) return { text: row[field] === null || row[field] === undefined || row[field] === '' ? '—' : String(row[field]) }
  const [id, name, path, api] = mapping
  const label = typeof row[name] === 'string' && !['', 'undefined', 'null'].includes(row[name].trim()) ? row[name] : null
  const text = label || (uuid(row[id]) ? row[id] : '—')
  return { text, path: uuid(row[id]) && label && api in (apis || {}) ? '/' + path + '/' + row[id] : null }
}
