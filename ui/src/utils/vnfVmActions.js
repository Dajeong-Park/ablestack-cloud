// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements. See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership. The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License. You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied. See the License for the
// specific language governing permissions and limitations
// under the License.

import { getAPI } from '@/api'
import { getFastClonePhase } from '@/utils/fastClone'
import { vnfReinstallJobs } from '@/utils/vnfReinstall'

export const isVnfVm = vm => vm?.templatetype === 'VNF'
export const vnfUnmanageJobs = new Map()
export const vnfUnmanageApis = ['unmanageVirtualMachine', 'listVirtualMachines', 'listVnfAppliances', 'listVolumes', 'listHosts', 'listAsyncJobs', 'queryAsyncJobResult', 'listConfigurations']
export const vnfOwner = vm => JSON.stringify(['id', 'account', 'domainid', 'projectid'].map(k => vm?.[k] || ''))
export function vnfUnmanageReason (vm, store) {
  if (!isVnfVm(vm) || !vm.id) return 'message.vnf.action.unavailable'
  if (store?.userInfo?.roletype !== 'Admin' || vnfUnmanageApis.some(api => !store.apis?.[api])) return 'message.vnf.action.permission'
  if (vm.hypervisor !== 'KVM') return 'message.vnf.action.unmanage.kvm'
  if (vm.state !== 'Running') return 'message.vnf.action.unmanage.running'
  if (!vm.hostid || ['Offline', 'Maintenance', 'Disabled'].includes(vm.hostcontrolstate)) return 'message.vnf.action.host'
  if (vm.deleteprotection === true || vm.deleteprotection === 'true') return 'message.vm.delete.protected'
  if (vm.haenable === true || vm.haenable === 'true') return 'message.vnf.action.unmanage.ha'
  if (vm.details?.configDriveLocation) return 'message.vnf.action.unmanage.configdrive'
  if (vm.vbmcport && vm.vbmcport !== 'None' || ['Allocating', 'Removing', 'CleanupRequired'].includes(vm.vbmcstatus)) return 'message.vnf.action.unmanage.bmc'
  if (getFastClonePhase(vm) || ['pending', 'running'].includes(String(vm.clonefaststatus || vm.details?.['clone.fast.status'] || '').toLowerCase()) || String(vm.activebackupstatus || '').toLowerCase() === 'backingup' || vnfReinstallJobs.has(vm.id)) return 'message.vnf.action.busy'
  return ''
}
const options = { preserveOnFailure: true, timeout: 20000 }
const fail = key => { throw new Error(key) }
export async function readVnfActionTarget (source) {
  const json = await getAPI('listVirtualMachines', { id: source.id, listall: true, details: 'all', ...(source.projectid ? { projectid: source.projectid } : {}) }, options)
  const body = json?.listvirtualmachinesresponse
  const rows = body?.virtualmachine
  if (!body || body.errorcode || !Array.isArray(rows) || rows.length !== 1 || vnfOwner(rows[0]) !== vnfOwner(source) || !isVnfVm(rows[0])) fail('message.vnf.action.unavailable')
  return rows[0]
}
export async function readVnfUnmanageJobs (vm) {
  const json = await getAPI('listAsyncJobs', { resourceid: vm.id, resourcetype: 'VirtualMachine', listall: true, includecompleted: true, page: 1, pagesize: 500, ...(vm.projectid ? { projectid: vm.projectid } : {}) }, options)
  const body = json?.listasyncjobsresponse
  if (!body || body.errorcode || body.count && !Array.isArray(body.asyncjobs)) fail('message.vnf.action.lookup.failed')
  const jobs = body.asyncjobs || []
  if (Number(body.count || 0) !== jobs.length) fail('message.vnf.action.lookup.failed')
  return jobs
}
export async function readVnfUnmanagePreview (source, store) {
  const vm = await readVnfActionTarget(source)
  const reason = vnfUnmanageReason(vm, store)
  if (reason) fail(reason)
  const [hostJson, volumeJson, configJson, jobs] = await Promise.all([
    getAPI('listHosts', { id: vm.hostid, listall: true }, options),
    getAPI('listVolumes', { virtualmachineid: vm.id, listall: true, ...(vm.projectid ? { projectid: vm.projectid } : {}) }, options),
    getAPI('listConfigurations', { name: 'unmanage.vm.preserve.nics', zoneid: vm.zoneid }, options),
    readVnfUnmanageJobs(vm)
  ])
  const host = hostJson?.listhostsresponse?.host
  if (host?.length !== 1 || host[0].id !== vm.hostid || host[0].state !== 'Up' || host[0].resourcestate !== 'Enabled' || host[0].zoneid !== vm.zoneid) fail('message.vnf.action.host')
  const volumes = volumeJson?.listvolumesresponse?.volume
  if (!Array.isArray(volumes) || !volumes.length || volumes.filter(v => v.type === 'ROOT').length !== 1 || volumes.some(v => v.virtualmachineid !== vm.id || v.state !== 'Ready')) fail('message.vnf.action.unmanage.volumes')
  const configs = configJson?.listconfigurationsresponse?.configuration?.filter(c => c.name === 'unmanage.vm.preserve.nics')
  if (configs?.length !== 1 || !['true', 'false'].includes(String(configs[0].value))) fail('message.vnf.action.lookup.failed')
  if (jobs.some(j => Number(j.jobstatus) === 0)) fail('message.vnf.action.busy')
  return { vm, host: host[0], volumes, preserveNics: String(configs[0].value) === 'true', jobs }
}
export const vnfUnmanageRevision = p => JSON.stringify([vnfOwner(p.vm), p.vm.state, p.vm.hostid, p.vm.templateid, p.vm.deleteprotection, p.vm.haenable, p.vm.nic, p.vm.vnfnics, p.preserveNics, p.volumes.map(v => [v.id, v.state, v.size, v.storageid]).sort()])

export function vmWallUrl (configs, fallbackHost, id) {
  if (!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(id || '')) return ''
  const value = name => configs.find(c => c.name === 'monitoring.wall.portal.' + name)?.value || ''
  const protocol = value('protocol') || 'http'
  const domain = value('domain') || fallbackHost
  const port = value('port')
  const path = value('vm.uri')
  if (!['http', 'https'].includes(protocol) || !domain || !path.startsWith('/') || path.startsWith('//') || /[\s/@?#\\]/.test(domain) || port && (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535)) return ''
  try {
    const url = new URL(protocol + '://' + domain)
    if (port) url.port = port
    const target = new URL(path, url)
    if (target.origin !== url.origin || target.username || target.password) return ''
    target.searchParams.set('var-vm_uuid', id)
    return target.href
  } catch (_) { return '' }
}
