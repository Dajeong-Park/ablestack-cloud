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

import { isoBoolean, isoAvailability } from '@/utils/isoModel'
const object = value => !!value && typeof value === 'object' && !Array.isArray(value)
const own = (value, key) => !!value && Object.prototype.hasOwnProperty.call(value, key)
const uuid = value => typeof value === 'string' && /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(value)
const fail = () => { throw new Error('message.kubernetes.iso.read.invalid') }
const rejectApiError = value => {
  if (!object(value) || !own(value, 'errorcode')) return
  const error = new Error(typeof value.errortext === 'string' ? value.errortext : 'API command failed')
  error.errorcode = Number(value.errorcode)
  throw error
}
const versionKey = state => state === 'Enabled' ? 'enabled' : state === 'Disabled' ? 'disabled' : 'unknown'

export function kubernetesIsoZone (record = {}, catalogResponse = false) {
  if (uuid(record.zoneid)) return { kind: 'zone', id: record.zoneid, name: record.zonename || record.zoneid }
  // The server intentionally omits both zone fields for a global version.
  // An arbitrary partial object is not enough evidence for "all Zones".
  if ((own(record, 'zoneid') && (record.zoneid === null || record.zoneid === '')) ||
      (catalogResponse && typeof record.semanticversion === 'string' && !own(record, 'zoneid') && !own(record, 'zonename'))) return { kind: 'all', id: null }
  return { kind: 'unknown', id: null }
}

export function normalizeKubernetesIso (record, getters = {}, catalogResponse = false) {
  if (!object(record) || !uuid(record.id)) return fail()
  const row = { ...record }
  for (const key of ['supportsha', 'supportsautoscaling', 'directdownload']) row[key] = isoBoolean(record[key])
  // Only RootAdmin receives this field from the server. Retain that boundary
  // even when a partial/old response accidentally contains it.
  if (getters.userInfo?.roletype !== 'Admin') delete row.isourl
  return { ...row, catalog: { versionState: versionKey(record.state), zone: kubernetesIsoZone(record, catalogResponse), directDownload: row.directdownload } }
}

export function kubernetesIsoListResponse (json, getters = {}, target = '', options = {}) {
  const root = json?.listkubernetessupportedversionsresponse
  rejectApiError(json?.errorresponse); rejectApiError(root)
  if (!object(root) || own(json, 'errorresponse')) return fail()
  if (own(root, 'kubernetessupportedversion') && !Array.isArray(root.kubernetessupportedversion)) return fail()
  const rows = (root.kubernetessupportedversion || []).map(row => normalizeKubernetesIso(row, getters, true))
  const known = own(root, 'count')
  const count = known ? Number(root.count) : rows.length
  if ((known && (root.count === null || root.count === '' || typeof root.count === 'boolean')) || !Number.isSafeInteger(count) || count < rows.length || (!rows.length && count !== 0 && !options.allowEmptyPage)) return fail()
  if (target && (rows.some(r => r.id.toLowerCase() !== target.toLowerCase()) || rows.length > 1)) return fail()
  return { rows, count, countKnown: known, status: rows.length ? 'ready' : target ? 'missing' : 'empty' }
}

export function kubernetesIsoReadParams (values = {}, target = '') {
  if (target) {
    if (!uuid(target)) return fail()
    return { id: target }
  }
  const fields = ['id', 'keyword', 'zoneid', 'minimumsemanticversion', 'minimumkubernetesversionid', 'arch', 'page', 'pagesize', 'sortkey', 'sortorder']
  return Object.fromEntries(fields.filter(k => values[k] !== undefined && values[k] !== null && values[k] !== '').map(k => [k, values[k]]))
}

export function kubernetesIsoFailure (error) {
  const body = Object.values(error?.response?.data || {}).find(v => object(v) && own(v, 'errorcode'))
  const text = body?.errortext || error?.message || ''
  const status = Number(error?.response?.status)
  const code = Number(body?.errorcode || error?.errorcode || status)
  if (/not available for user/i.test(text) || [403, 432, 531].includes(code) || status === 403) return 'forbidden'
  if (status === 401 || code === 401) return 'expired'
  if (status === 404 || code === 404) return 'missing'
  if (error?.message === 'message.kubernetes.iso.read.invalid') return 'invalid'
  if (error?.__CANCEL__ || error?.code === 'ERR_CANCELED') return 'cancelled'
  if (code > 0) return 'failed'
  if (!error?.response) return 'network'
  return 'failed'
}

// Version Enabled/Disabled never establishes ISO readiness. An unqueried
// reported template state stays separate from a permitted ISO observation.
export function kubernetesIsoAvailability (record = {}, observation = null) {
  const reportedState = record.isostate
  const versionState = versionKey(record.state)
  if (!observation || observation.isoid !== record.isoid) return { key: 'unqueried', versionState, reportedState }
  if (observation.status !== 'ready') return { key: ['loading', 'forbidden', 'expired', 'failed', 'network', 'missing', 'invalid', 'empty'].includes(observation.status) ? observation.status : 'unqueried', versionState, reportedState }
  if (!Array.isArray(observation.rows) || observation.rows.some(row => !object(row) || row.id !== record.isoid || !uuid(row.zoneid))) return { key: 'invalid', versionState, reportedState }
  if (!observation.rows.length) return { key: 'missing', versionState, reportedState }
  const availability = isoAvailability({ id: record.isoid }, { ...observation, isoid: record.isoid })
  return { ...availability, versionState, reportedState }
}

export function kubernetesIsoUploadResponse (json) {
  const root = json?.getuploadparamsforkubernetessupportedversionresponse
  rejectApiError(json?.errorresponse); rejectApiError(root)
  if (!object(root)) return fail()
  const value = root.getuploadparams === undefined ? root : root.getuploadparams
  if (!object(value) || ['id', 'postURL', 'signature', 'expires', 'metadata'].some(k => typeof value[k] !== 'string' || !value[k])) return fail()
  if (!/^https?:\/\//.test(value.postURL)) return fail()
  return { id: value.id, postURL: value.postURL, signature: value.signature, expires: value.expires, metadata: value.metadata }
}

export function kubernetesIsoWriteResponse (json, operation, getters = {}) {
  const key = operation === 'url' ? 'addkubernetessupportedversionresponse' : operation === 'update' ? 'updatekubernetessupportedversionresponse' : ''
  const root = key && json?.[key]
  rejectApiError(json?.errorresponse); rejectApiError(root)
  if (!object(root) || !object(root.kubernetessupportedversion)) return fail()
  return normalizeKubernetesIso(root.kubernetessupportedversion, getters, true)
}
