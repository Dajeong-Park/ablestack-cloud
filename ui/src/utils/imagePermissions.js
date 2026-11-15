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

import { isoBoolean, isoContext, isSystemIso } from './isoModel'

const object = value => value && typeof value === 'object' && !Array.isArray(value)
const same = (a, b) => typeof a === 'string' && typeof b === 'string' && a.length > 0 && a.toLowerCase() === b.toLowerCase()
const strings = value => {
  if (value === undefined) return []
  if (!Array.isArray(value) || value.some(x => typeof x !== 'string' || !x.trim() || x.includes(','))) throw new Error('message.image.permissions.invalid')
  return [...new Set(value.map(x => x.trim()))].sort()
}
export function imagePermissionResponse (kind, json, id, owner = {}) {
  const keys = kind === 'iso' ? ['listisopermissionsresponse', 'listtemplatepermissionsresponse'] : ['listtemplatepermissionsresponse']
  const present = keys.filter(key => json?.[key] !== undefined)
  if (present.length !== 1) throw new Error('message.image.permissions.invalid')
  const root = json[present[0]]
  if (!object(root) || root.errorcode !== undefined) throw new Error('message.image.permissions.invalid')
  const row = root.templatepermission === undefined ? root : root.templatepermission
  if (!object(row) || row.errorcode !== undefined || !same(row.id, id) || (root.templatepermission !== undefined && root.id !== undefined)) throw new Error('message.image.permissions.invalid')
  return { id: row.id, accounts: strings(row.account).filter(name => owner.projectid || name !== owner.account), projects: strings(row.projectids).filter(project => !same(project, owner.projectid)), ispublic: isoBoolean(row.ispublic) }
}
export function imagePermissionScope (kind, resource, getters) {
  return JSON.stringify([kind, isoContext(resource, getters), resource.account, resource.domainid, resource.projectid])
}
export function canManageImagePermissions (kind, record = {}, getters = {}) {
  const suffix = kind === 'iso' ? 'Iso' : 'Template'
  if (!getters.apis?.['list' + suffix + 'Permissions'] || !getters.apis?.['update' + suffix + 'Permissions'] || !record.id || isSystemIso(record) || isoBoolean(record.isready) !== true) return false
  const user = getters.userInfo || {}
  if (!user.id) return false
  if (user.roletype === 'Admin') return true
  if (record.projectid) return !getters.listAllProjects && same(record.projectid, getters.project?.id)
  return !getters.project?.id && same(user.domainid, record.domainid) && record.account === user.account
}
export function permissionFingerprint (value) {
  return JSON.stringify([value.id.toLowerCase(), [...value.accounts].sort(), [...value.projects].sort(), value.ispublic])
}
export function expectedImagePermissions (before, operation, type, selected) {
  if (!['add', 'remove', 'reset'].includes(operation)) throw new Error('message.image.permissions.invalid')
  const result = { ...before, accounts: [...before.accounts], projects: [...before.projects] }
  if (operation === 'reset') return { ...result, accounts: [], projects: [], ispublic: before.ispublic === undefined ? undefined : false }
  if (!['Account', 'Project'].includes(type) || !selected.length) throw new Error('message.template.permissions.target.required')
  const key = type === 'Account' ? 'accounts' : 'projects'
  if (operation === 'remove' && selected.some(x => !before[key].includes(x))) throw new Error('message.image.permissions.changed')
  result[key] = operation === 'add' ? [...new Set([...before[key], ...selected])].sort() : before[key].filter(x => !selected.includes(x)).sort()
  return result
}
export function permissionTargetOptions (grants, inventory, operation, type, owner) {
  const key = type === 'Account' ? 'accounts' : 'projects'
  const idKey = type === 'Account' ? 'name' : 'id'
  const rows = Array.isArray(inventory) ? inventory : []
  if (operation === 'remove') return grants[key].map(value => ({ value, label: rows.find(x => x[idKey] === value)?.name || value }))
  return rows.filter(x => typeof x[idKey] === 'string' && x[idKey] && x[idKey] !== owner && !grants[key].includes(x[idKey])).map(x => ({ value: x[idKey], label: x.name || x[idKey] }))
}
