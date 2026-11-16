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

import { isoAvailability, isoBoolean, isoContext, isoListResponse, isoState } from '@/utils/isoModel'
import { templateStorePresentation } from '@/utils/templateZoneOperations'

export const isoBooleanFields = new Set(['isready', 'bootable', 'ispublic', 'isfeatured', 'isextractable', 'directdownload', 'passwordenabled', 'sshkeyenabled', 'requireshvm', 'isdynamicallyscalable', 'crosszones', 'crossZones'])
export function presentedIsoValue (key) { return isoBooleanFields.has(key) || ['id', 'checksum', 'url', 'size', 'physicalsize', 'virtualsize'].includes(key) }
export function isoSize (value) {
  if (value == null || value === '' || !Number.isFinite(Number(value)) || Number(value) < 0) return '—'
  const bytes = Number(value); const unit = bytes > 0 ? Math.min(5, Math.floor(Math.log(bytes) / Math.log(1024))) : 0
  return (bytes / (1024 ** Math.max(unit, 0))).toFixed(unit > 0 ? 2 : 0).replace(/\.00$/, '') + ' ' + ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB'][Math.max(unit, 0)]
}
export function isoZoneContext (resource, getters, token) { return JSON.stringify([isoContext(resource, getters), token]) }
export function isoStorePresentation (row) {
  const state = isoState(row.downloadState)
  const alias = { READY: 'DOWNLOADED', UPLOAD_IN_PROGRESS: 'UPLOADING', NOT_UPLOADED: 'NOT_DOWNLOADED' }
  const result = templateStorePresentation({ ...row, downloadState: alias[state] || state })
  return { ...result, label: state === 'ABANDONED' ? 'label.iso.zone.abandoned' : result.label }
}
export function isoZoneSnapshot (row, resource) {
  return { ...row, id: resource.id, name: resource.name, downloaddetails: (row.downloaddetails || []).map(s => ({ ...s })), operationState: 'pending', jobid: '', jobComplete: false, error: '' }
}
export function isoCopyDestinations (zones, source, existing) {
  const occupied = new Set(existing.map(r => r.zoneid)); const seen = new Set()
  return zones.filter(z => z.id && z.id !== source && !occupied.has(z.id) && String(z.allocationstate || '').toLowerCase() !== 'disabled' && !seen.has(z.id) && seen.add(z.id))
}
export function isoCopyResult (rows, id, zoneid) {
  const copies = rows.filter(r => r.id === id && r.zoneid === zoneid)
  if (!copies.length) return 'waitingReady'
  const states = copies.map(row => isoAvailability(row))
  if (copies.every(r => isoBoolean(r.isready) === true) && states.every(s => s.key === 'ready')) return 'success'
  if (states.some(s => s.key === 'failed')) return 'failed'
  return 'waitingReady'
}
// These reads stay in the actor's ownership scope. Keyword UUID permits an
// absent image to be observed without interpreting an API error as absence.
export async function readOwnedIsoZones (request, resource, getters, current = () => true) {
  const projectid = getters.listAllProjects ? '-1' : getters.project?.id
  const admin = ['Admin', 'DomainAdmin', 'ResourceAdmin'].includes(getters.userInfo?.roletype)
  const all = []; let total
  for (let page = 1; page <= 100; page++) {
    const json = await request('listIsos', { keyword: resource.id, isofilter: admin ? 'all' : 'self', listall: true, showunique: false, ignoreproject: true, ...(projectid ? { projectid } : {}), page, pagesize: 500 }, { preserveOnFailure: true, timeout: 10000 })
    if (!current()) return null
    const result = isoListResponse(json)
    if (total !== undefined && result.count !== total) throw new Error('ISO Zone list changed during observation')
    total = result.count; all.push(...result.rows)
    if (all.length >= total) return all.filter(r => r.id === resource.id)
    if (!result.rows.length) break
  }
  throw new Error('Incomplete ISO Zone observation')
}

// Localize known state suffixes without changing a storage name or the raw model.
export function isoStoreReason (reason, translate) {
  const text = String(reason || '')
  const match = text.match(/(^|: )(DOWNLOADED|DOWNLOAD_IN_PROGRESS|NOT_DOWNLOADED|DOWNLOAD_ERROR|UPLOAD_ERROR|UPLOAD_IN_PROGRESS|NOT_UPLOADED|UPLOADING|ABANDONED|LIMIT_REACHED)$/)
  return match ? text.slice(0, match.index) + match[1] + translate(isoStorePresentation({ downloadState: match[2] }).label) : text
}
