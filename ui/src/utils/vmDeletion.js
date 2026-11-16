// Licensed to the Apache Software Foundation (ASF) under one or more
// contributor license agreements. See the NOTICE file distributed with this
// work for additional information regarding copyright ownership. The ASF
// licenses this file to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance with the License.
// You may obtain a copy at http://www.apache.org/licenses/LICENSE-2.0 .
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
// WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
// License for the specific language governing permissions and limitations.
import { getAPI } from '@/api'
import { getFastClonePhase } from '@/utils/fastClone'

export const isVmDeletion = action => ['destroyVirtualMachine', 'expungeVirtualMachine'].includes(action?.api)
export const vmProtection = record => record?.deleteprotection === true ? 'protected' : record?.deleteprotection === false ? 'unprotected' : 'unknown'
export function vmDeletionScope (route, store) {
  const g = store.getters
  return JSON.stringify([route?.fullPath || route?.path, g.userInfo?.id, g.userInfo?.roletype, g.userInfo?.roleid,
    g.userInfo?.account, g.userInfo?.domainid, g.project?.id, store.state?.user?.token,
    Object.keys(g.apis || {}).sort(), g.features?.allowuserexpungerecovervm])
}
export function vmDeletionReason (record, action, getters, expunge = false) {
  const api = action?.api || 'destroyVirtualMachine'
  if (![api, 'listVirtualMachines'].every(name => name in (getters.apis || {}))) return 'message.vm.delete.permission'
  if (expunge && (!('expungeVirtualMachine' in getters.apis) || !(getters.userInfo?.roletype === 'Admin' || getters.features?.allowuserexpungerecovervm))) return 'message.vm.delete.permission'
  if (!record?.id) return 'message.vm.delete.incomplete'
  if (vmProtection(record) === 'protected') return 'message.vm.delete.protected'
  if (vmProtection(record) === 'unknown') return 'message.vm.delete.unknown'
  if (!(api === 'expungeVirtualMachine' ? ['Destroyed'] : ['Running', 'Stopped', 'Error']).includes(record.state)) return 'message.vm.delete.state'
  if (['Offline', 'Maintenance'].includes(record.hostcontrolstate) && record.state === 'Running') return 'message.vm.delete.host'
  if (getFastClonePhase(record) || String(record.clonefaststatus || record.details?.['clone.fast.status'] || '').toLowerCase() === 'running') return 'message.sharedmountpoint.clone.flatten.in.progress'
  if (String(record.activebackupstatus || '').toLowerCase() === 'backingup') return 'message.backup.in.progress'
  // Preserve section-specific restrictions (managed VMs, Flatten, and future guards).
  if (action?.show && !action.show(record, getters)) return 'message.vm.delete.state'
  if (action?.disabled?.(record, getters, [record])) return 'message.vm.delete.busy'
  return ''
}
export async function readVmDeletionTarget (target, store, current = () => true) {
  if (!current()) throw new Error('message.vm.delete.context')
  const projectid = target.projectid || store.getters.project?.id
  const json = await getAPI('listVirtualMachines', { id: target.id, listall: true, details: 'all', ...(projectid ? { projectid } : {}) }, { preserveOnFailure: true, timeout: 15000 })
  if (!current()) throw new Error('message.vm.delete.context')
  const response = json?.listvirtualmachinesresponse
  const rows = response?.virtualmachine
  if (!Array.isArray(rows) || rows.length !== 1 || Number(response.count ?? 1) !== 1 || rows[0].id !== target.id) throw new Error('message.vm.delete.incomplete')
  const row = rows[0]
  if (['projectid', 'account', 'domainid'].some(key => target[key] && row[key] !== target[key])) throw new Error('message.vm.delete.context')
  return row
}
