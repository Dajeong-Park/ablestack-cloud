// Licensed to the Apache Software Foundation (ASF) under one or more
// contributor license agreements. See NOTICE. Apache License, Version 2.0.
// http://www.apache.org/licenses/LICENSE-2.0
export function directoryChanges (row, draft) {
  const result = {}; const observed = row.observation || {}
  for (const key of ['owneruid', 'ownergid', 'mode']) {
    const value = draft[key]
    if (key === 'mode') {
      if (!/^0?[0-7]{3,4}$/.test(String(value))) throw new Error('DIRECTORY_POLICY_INVALID')
    } else if (!Number.isInteger(Number(value)) || value === null || Number(value) < 0 || Number(value) > 4294967294) throw new Error('DIRECTORY_POLICY_INVALID')
    const normalized = key === 'mode' ? parseInt(value, 8).toString(8).padStart(4, '0') : Number(value)
    const same = x => key === 'mode' ? parseInt(x, 8) === parseInt(normalized, 8) : Number(x) === normalized
    if (!same(row[key]) || (observed.status === 'OBSERVED' && !same(observed[key]))) {
      result[key === 'owneruid' ? 'ownerUid' : key === 'ownergid' ? 'ownerGid' : 'mode'] = normalized
    }
  }
  if (draft.recursive) result.recursivePermission = true
  return result
}
export function directoryIntent (row, draft) {
  if (!row.id) return { api: 'createStorageDirectoryPolicy', volumeid: row.volumeid, path: row.path }
  if (draft.unregister) return { api: 'deleteStorageDirectoryPolicy', resourceid: row.id, expectedpolicyrevision: row.policyrevision, posixchanges: {} }
  const result = { api: 'updateStorageDirectoryPolicy', resourceid: row.id, expectedpolicyrevision: row.policyrevision, posixchanges: directoryChanges(row, draft) }
  const acl = directoryAclChanges(draft)
  if (acl) result.aclchanges = acl
  return result
}
export function directoryParameters (row, draft) {
  if (!row.id) return { volumeid: row.volumeid, path: row.path }
  if (draft.unregister) return { id: row.id, expectedpolicyrevision: row.policyrevision }
  const change = directoryChanges(row, draft)
  const result = { id: row.id, expectedpolicyrevision: row.policyrevision }
  for (const [key, value] of Object.entries(change)) result[key.toLowerCase()] = value
  const acl = directoryAclChanges(draft)
  if (acl) result.aclchanges = JSON.stringify(acl)
  return result
}

export function directoryAclChanges (draft) {
  const value = draft.aclChanges
  if (!value?.entries?.length && !value?.accessMask && !value?.defaultMask) return null
  if (draft.recursive || (value.entries || []).length > 16) throw new Error('DIRECTORY_ACL_INVALID')
  for (const row of value.entries || []) {
    if (!['UPSERT', 'REMOVE'].includes(row.action) || !['ACCESS', 'DEFAULT', 'BOTH'].includes(row.scope) ||
        !['UID', 'GID', 'LOCAL_USER', 'LOCAL_GROUP', 'AD_USER', 'AD_GROUP'].includes(row.principalType) ||
        !String(row.principal || '').trim() || String(row.principal).length > 255 ||
        (row.action === 'UPSERT' && !/^[r-][w-][x-]$/.test(row.permissions || ''))) throw new Error('DIRECTORY_ACL_INVALID')
  }
  const result = { version: 1, entries: (value.entries || []).map(row => ({ ...row })) }
  for (const key of ['accessMask', 'defaultMask']) {
    if (value[key]) {
      if (!/^[r-][w-][x-]$/.test(value[key])) throw new Error('DIRECTORY_ACL_INVALID')
      result[key] = value[key]
    }
  }
  if (encodeURIComponent(JSON.stringify(result)).replace(/%[0-9A-F]{2}|./g, 'x').length > 3072) throw new Error('DIRECTORY_ACL_INVALID')
  return result
}
