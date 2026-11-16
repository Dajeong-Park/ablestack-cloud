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

import { templateAvailability } from '@/utils/templateAvailability'

const commands = { url: 'registerIso', local: 'getUploadParamsForIso' }
const actionApis = { edit: 'updateIso', share: 'updateIsoPermissions', permissions: 'updateIsoPermissions', copy: 'copyIso', delete: 'deleteIso', deploy: 'deployVirtualMachine', download: 'extractIso', attach: 'attachIso' }
const booleans = ['isready', 'bootable', 'ispublic', 'isfeatured', 'isextractable', 'directdownload', 'passwordenabled', 'isdynamicallyscalable', 'crosszones']
const own = (object, key) => !!object && Object.prototype.hasOwnProperty.call(object, key)
const object = value => value && typeof value === 'object' && !Array.isArray(value)
const hasApi = (getters, api) => own(getters.apis, api) && !!object(getters.apis[api])
const sameId = (a, b) => typeof a === 'string' && typeof b === 'string' && a.length > 0 && a.toLowerCase() === b.toLowerCase()

export function isoBoolean (value) {
  if (value === true || value === 'true') return true
  if (value === false || value === 'false') return false
  return undefined
}

export function isoState (value) {
  const state = String(value || '').replace(/([a-z])([A-Z])/g, '$1_$2').replace(/[\s-]+/g, '_').toUpperCase()
  return ({ UPLOAD_ABANDONED: 'ABANDONED', UPLOAD_FAILED: 'UPLOAD_ERROR', DOWNLOAD_FAILED: 'DOWNLOAD_ERROR' })[state] || state
}

// Presentation copies never replace the raw API record or infer omitted values.
export function normalizeIso (record = {}) {
  const row = object(record) ? record : {}
  const result = { ...row }
  for (const key of booleans) result[key] = isoBoolean(row[key])
  result.downloaddetails = (Array.isArray(row.downloaddetails) ? row.downloaddetails : [])
    .filter(object).map(store => ({ ...store, downloadState: isoState(store.downloadState) }))
  const state = isoState(row.state)
  if (['ABANDONED', 'UPLOAD_ERROR', 'DOWNLOAD_ERROR', 'FAILED'].includes(state) ||
    (!result.downloaddetails.length && ['NOT_UPLOADED', 'NOT_DOWNLOADED', 'UPLOAD_IN_PROGRESS', 'DOWNLOAD_IN_PROGRESS'].includes(state))) {
    result.downloaddetails = [...result.downloaddetails, { downloadState: state === 'FAILED' ? 'UPLOAD_ERROR' : state }]
  }
  return result
}

export function isoAvailability (record = {}, observation = null) {
  const rows = Array.isArray(observation?.rows) ? observation.rows : []
  const scoped = observation && Array.isArray(observation.rows) && sameId(record?.id, observation.isoid)
    ? { ...observation, templateid: observation.isoid, rows: rows.map(normalizeIso) }
    : null
  return templateAvailability(normalizeIso(record), scoped)
}

// A failed/malformed response is not a successful empty list.
export function isoListResponse (response) {
  const value = response?.listisosresponse
  if (!object(value) || own(value, 'errorcode')) throw new Error('invalid ISO response')
  if (value.iso !== undefined && !Array.isArray(value.iso)) throw new Error('invalid ISO rows')
  const rows = value.iso || []
  if (value.count !== undefined && (!Number.isSafeInteger(Number(value.count)) || Number(value.count) < rows.length)) throw new Error('invalid ISO count')
  if (!rows.length && Number(value.count || 0) !== 0) throw new Error('missing ISO rows')
  if (rows.some(row => !object(row) || typeof row.id !== 'string' || !row.id)) throw new Error('invalid ISO record')
  return { rows: rows.map(normalizeIso), count: value.count === undefined ? rows.length : Number(value.count), countKnown: value.count !== undefined }
}

export function isoRegistrationCapability (mode, getters = {}) {
  const api = commands[mode]
  const available = !!api && hasApi(getters, api)
  const schema = available ? getters.apis[api].params : null
  const parameters = Object.fromEntries((Array.isArray(schema) ? schema : []).filter(param => object(param) && typeof param.name === 'string').map(param => [param.name, param]))
  return { api: api || '', available, schemaKnown: Array.isArray(schema), parameters }
}

// Descriptions are optional, including when only the local-upload API is granted.
export function isoParameterHelp (metadata = {}) {
  const fields = ['url', 'name', 'displaytext', 'checksum', 'zoneid', 'domainid', 'account', 'bootable', 'ostypeid', 'arch', 'isextractable', 'ispublic', 'isfeatured', 'isdynamicallyscalable', 'passwordenabled', 'directdownload', 'userdataid', 'userdatapolicy']
  return Object.fromEntries(fields.map(name => [name, { ...(object(metadata[name]) ? metadata[name] : {}), description: typeof metadata[name]?.description === 'string' ? metadata[name].description : '' }]))
}

export function isSystemIso (record = {}) {
  return String(record.account || '').toLowerCase() === 'system' || ['SYSTEM', 'BUILTIN', 'PERHOST'].includes(String(record.templatetype || '').toUpperCase())
}

export function isoOwner (record = {}, getters = {}) {
  const user = getters.userInfo || {}
  if (!record.id || !user.id || (record.format && record.format !== 'ISO') || isSystemIso(record)) return false
  if (user.roletype === 'Admin') return true
  if (record.projectid) return !getters.listAllProjects && sameId(record.projectid, getters.project?.id)
  return !getters.project?.id && sameId(record.domainid, user.domainid) && !!record.account && record.account === user.account
}

export function canIsoAction (action, record = {}, getters = {}) {
  const api = actionApis[action]
  if (!api || !hasApi(getters, api) || !record.id || (record.format && record.format !== 'ISO')) return false
  const ready = isoBoolean(record.isready) === true
  if (action === 'attach') return hasApi(getters, 'listVirtualMachines') && hasApi(getters, 'listIsos') && ready
  if (action === 'deploy') return hasApi(getters, 'listIsos') && ready && isoBoolean(record.bootable) === true
  if (!isoOwner(record, getters)) return false
  if (['share', 'permissions'].includes(action) && record.projectid && !['Admin', 'DomainAdmin', 'ResourceAdmin'].includes(getters.userInfo?.roletype)) return false
  if (action === 'delete') {
    // Uploads waiting to start cannot be deleted until failure/normal expiry.
    const failed = isoAvailability(record).key === 'failed'
    return failed || (ready && !['NOT_UPLOADED', 'UPLOAD_IN_PROGRESS'].includes(isoState(record.state)))
  }
  if (!ready) return false
  if (action === 'permissions' && !hasApi(getters, 'listIsoPermissions')) return false
  if (action === 'download') return getters.userInfo?.roletype === 'Admin' || isoBoolean(record.isextractable) === true
  return true
}

// Runtime scope only; no credentials or server tokens enter this value.
export function isoContext (record = {}, getters = {}) {
  const user = getters.userInfo || {}
  return JSON.stringify([record.id, user.id, user.roleid, user.roletype, getters.project?.id, !!getters.listAllProjects, Object.keys(getters.apis || {}).sort()])
}

export async function readIsoResource (request, params, getters = {}, current = () => true) {
  const projectid = params.projectid || (getters.project?.id ? (getters.listAllProjects ? '-1' : getters.project.id) : '')
  const admin = ['Admin', 'DomainAdmin', 'ResourceAdmin'].includes(getters.userInfo?.roletype)
  const scoped = { ...params, showunique: false, ...(projectid ? { projectid } : {}), isofilter: admin ? 'all' : 'executable' }
  const options = { preserveOnFailure: true, timeout: 20000 }
  const json = await request('listIsos', scoped, options)
  if (!current()) return null
  const root = json?.listisosresponse
  if (!root || root.errorcode !== undefined || (root.iso !== undefined && !Array.isArray(root.iso))) throw new Error('invalid ISO response')
  if (admin || root.iso?.length) return json
  return request('listIsos', { ...scoped, isofilter: 'shared' }, options)
}
