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

import hash from 'hash.js'
import { isoBoolean, isoListResponse } from '@/utils/isoModel'
import { kubernetesIsoContext, kubernetesIsoCapability } from '@/utils/kubernetesIsoCapabilities'
import { kubernetesIsoAvailability, kubernetesIsoFailure, kubernetesIsoZone } from '@/utils/kubernetesIsoModel'
import { safeTemplateReason } from '@/utils/templateAvailability'

export const kubernetesIsoUuid = value => typeof value === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value)
const same = (a, b) => typeof a === 'string' && typeof b === 'string' && a.toLowerCase() === b.toLowerCase()
const object = value => !!value && typeof value === 'object' && !Array.isArray(value)
const invalid = () => { throw new Error('message.kubernetes.iso.read.invalid') }
export function kubernetesIsoScope (record = {}) {
  const scope = record.catalog?.zone
  if (scope?.kind === 'all' && scope.id === null) return scope
  if (scope?.kind === 'zone' && kubernetesIsoUuid(scope.id) && same(scope.id, record.zoneid)) return scope
  return kubernetesIsoZone(record)
}
export function kubernetesIsoDetailContext (route, record, getters, session) {
  return hash.sha256().update(JSON.stringify([route?.path, kubernetesIsoContext(getters, session, record?.id), record?.isoid, kubernetesIsoScope(record), record?.isostate])).digest('hex')
}
export function kubernetesIsoCanReadChild (getters = {}) { return kubernetesIsoCapability('read', getters).available && object(getters.apis?.listIsos) }
export function kubernetesIsoLink (record = {}, getters = {}, observation) {
  return kubernetesIsoCanReadChild(getters) && observation?.status === 'ready' && (!observation.versionid || same(observation.versionid, record.id)) && same(observation.isoid, record.isoid) &&
    observation.rows?.some(row => same(row.id, record.isoid)) ? { path: '/iso/' + record.isoid } : null
}
export function kubernetesIsoBooleanLabel (value) {
  const flag = isoBoolean(value)
  return flag === true ? 'label.yes' : flag === false ? 'label.no' : 'label.unknown'
}
export function kubernetesIsoStatus (record = {}, observation, mode = 'iso') {
  if (mode === 'version') {
    const key = record.state === 'Enabled' ? 'enabled' : record.state === 'Disabled' ? 'disabled' : 'unknown'
    return { key, badge: key === 'enabled' ? 'success' : 'default', labelKey: 'label.kubernetes.iso.version.' + key, reasons: [] }
  }
  const scoped = observation?.versionid && record.id && !same(observation.versionid, record.id) ? null : observation
  const value = kubernetesIsoAvailability(record, scoped)
  const extra = {
    unqueried: ['default', 'label.kubernetes.iso.availability.unqueried'],
    loading: ['processing', 'label.kubernetes.iso.availability.loading'],
    forbidden: ['warning', 'label.kubernetes.iso.availability.forbidden'],
    expired: ['error', 'label.kubernetes.iso.availability.expired'],
    empty: ['default', 'label.kubernetes.iso.availability.empty'],
    missing: ['warning', 'label.kubernetes.iso.availability.missing'],
    invalid: ['error', 'label.kubernetes.iso.availability.invalid'],
    network: ['error', 'label.kubernetes.iso.availability.network']
  }
  if (scoped?.status !== 'ready' && value.key === 'failed') return { ...value, badge: 'error', labelKey: 'label.kubernetes.iso.availability.failed', reasons: [] }
  if (extra[value.key]) return { ...value, badge: extra[value.key][0], labelKey: extra[value.key][1], reasons: [] }
  return value
}
// Only a permitted child ISO read establishes availability. Catalog state is metadata.
export async function readKubernetesIsoZones (request, record, getters = {}, options = {}, current = () => true) {
  const result = { versionid: record.id, isoid: record.isoid, rows: [] }
  if (!kubernetesIsoCanReadChild(getters)) return { ...result, status: 'forbidden' }
  if (!record.isoid) return { ...result, status: 'missing' }
  if (!kubernetesIsoUuid(record.isoid)) return { ...result, status: 'invalid' }
  const scope = kubernetesIsoScope(record)
  if (scope.kind === 'unknown') return { ...result, status: 'invalid' }
  const rows = []; const seen = new Set(); let total
  const root = getters.userInfo?.roletype === 'Admin'
  for (let page = 1; ; page++) {
    const params = { id: record.isoid, isofilter: root ? 'all' : 'executable', showunique: false, page, pagesize: 500, ...(scope.kind === 'zone' ? { zoneid: scope.id } : {}) }
    const response = await request('listIsos', params, options)
    if (!current()) return null
    const body = response?.listisosresponse
    if (response?.errorresponse || body?.errorcode !== undefined) {
      const error = response.errorresponse || body
      throw Object.assign(new Error(error.errortext || 'API read failed'), { errorcode: Number(error.errorcode) })
    }
    if (!object(body) || body.count == null || body.count === '' || !['number', 'string'].includes(typeof body.count)) invalid()
    let parsed
    try { parsed = isoListResponse(response) } catch (_) { invalid() }
    if (!parsed.countKnown || total !== undefined && total !== parsed.count) invalid()
    for (const raw of body.iso || []) {
      if (raw.downloaddetails !== undefined && (!Array.isArray(raw.downloaddetails) || raw.downloaddetails.some(item => !object(item)))) invalid()
    }
    for (const row of parsed.rows) {
      if (!same(row.id, record.isoid) || !kubernetesIsoUuid(row.zoneid) || scope.kind === 'zone' && !same(row.zoneid, scope.id) || seen.has(row.zoneid.toLowerCase())) invalid()
      seen.add(row.zoneid.toLowerCase())
      const value = { ...row }
      if (!root) { delete value.url; delete value.isourl }
      rows.push(value)
    }
    total = parsed.count
    if (rows.length > total || rows.length < total && !parsed.rows.length) invalid()
    if (rows.length === total) return { ...result, rows, count: total, coverage: 'complete', status: rows.length ? 'ready' : 'empty' }
  }
}
export function kubernetesIsoObservationFailure (error) {
  return kubernetesIsoFailure(error)
}
export function kubernetesIsoZoneReason (row = {}) {
  return kubernetesIsoStatus({ isoid: row.id }, { isoid: row.id, status: 'ready', rows: [row], count: 1, coverage: 'complete' }).reasons?.map(safeTemplateReason).join(' · ') || ''
}
export function kubernetesIsoReportedState (value) {
  const key = ({ Ready: 'ready', Allocated: 'allocated', UploadInProgress: 'uploading', UploadError: 'failed', Active: 'active', Inactive: 'inactive' })[value]
  return key ? 'label.kubernetes.iso.reported.' + key : ''
}
