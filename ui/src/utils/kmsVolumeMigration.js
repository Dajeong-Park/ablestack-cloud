// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements. See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership. The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License. You may obtain a copy of the License at
//
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied. See the License for the
// specific language governing permissions and limitations
// under the License.

export const migrationReasons = ['ELIGIBLE_LEGACY', 'ALREADY_KMS', 'NOT_ENCRYPTED', 'LEGACY_KEY_UNAVAILABLE', 'UNSUPPORTED_STATE']
export function migrationIdentity (key) {
  return JSON.stringify(['id', 'accountid', 'account', 'domainid', 'projectid', 'zoneid', 'hsmprofileid'].map(field => key?.[field] || ''))
}
export function migrationScope (key) {
  if (!key?.id || !key.zoneid || !key.domainid || (!key.projectid && !key.account)) throw new Error('SCOPE_UNKNOWN')
  return key.projectid ? { projectid: key.projectid, zoneid: key.zoneid } : { account: key.account, domainid: key.domainid, zoneid: key.zoneid }
}
export function migrationParams (key, extra = {}) {
  const params = { ...extra }
  for (const field of ['account', 'accountid', 'domainid', 'projectid', 'zoneid']) delete params[field]
  return { ...params, ...migrationScope(key), kmsmigrationkeyid: key.id, listall: true, ignoreproject: true }
}
export function migrationList (json) {
  const result = json?.listvolumesresponse
  if (!result) throw new Error('CONTEXT_UNSUPPORTED')
  const rows = result.volume || []
  // CloudStack serializes an empty ListResponse as {}. No selectable row is inferred.
  const count = result.count === undefined && Array.isArray(rows) && rows.length === 0 ? 0 : result.count
  if (!Number.isInteger(count) || count < 0 || count < rows.length) throw new Error('CONTEXT_UNSUPPORTED')
  if (!Array.isArray(rows) || rows.some(row => !row.id || !migrationReasons.includes(row.kmsmigrationreason) ||
    typeof row.kmsmigrationeligible !== 'boolean' || row.kmsmigrationeligible !== (row.kmsmigrationreason === 'ELIGIBLE_LEGACY'))) throw new Error('CONTEXT_UNSUPPORTED')
  return { rows, count }
}
export function migrationSupported (apis) {
  const fields = apis?.listVolumes?.params?.map(p => p.name) || []
  return ['kmsmigrationkeyid', 'kmsmigrationeligible'].every(p => fields.includes(p)) &&
    ['migrateVolumesToKMS', 'listKMSKeys', 'queryAsyncJobResult'].every(p => p in (apis || {}))
}
export function migrationPreflight (ids, rows, target) {
  const map = new Map(rows.map(row => [row.id, row]))
  return ids.length > 0 && ids.every(id => {
    const row = map.get(id)
    if (row?.kmsmigrationeligible !== true || row.kmsmigrationreason !== 'ELIGIBLE_LEGACY') return false
    if (!target) return true
    if (row.projectid && row.projectid !== target.projectid) return false
    if (!target.projectid && row.account && row.account !== target.account) return false
    return ['domainid', 'zoneid'].every(field => !row[field] || row[field] === target[field])
  })
}
export function migrationOutcome (row, targetId) {
  if (!row) return 'unknown'
  if (row.kmskeyid === targetId && row.kmsmigrationreason === 'ALREADY_KMS') return 'connected'
  if (row.kmsmigrationeligible === true) return 'not_migrated'
  return 'unknown'
}
