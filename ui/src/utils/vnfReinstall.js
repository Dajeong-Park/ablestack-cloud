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

// Only operation identity is retained across dialog/route changes, never credentials.
export const vnfReinstallJobs = new Map()
const on = v => v === true || v === 'true'
const enabled = v => v !== false && v !== 'false'
const id = v => /^\d+$/.test(String(v)) && Number(v) <= 2147483647 ? Number(v) : null
const project = vm => vm.projectid ? { projectid: vm.projectid } : { ignoreproject: true }
const request = { preserveOnFailure: true, timeout: 15000 }

export function vnfReinstallReason (vm, apis = {}) {
  if (!['restoreVirtualMachine', 'listVirtualMachines', 'listVnfTemplates', 'listVolumes', 'listAsyncJobs', 'queryAsyncJobResult'].every(k => k in apis)) return 'message.vnf.reinstall.permission'
  if (!vm?.id || vm.templatetype !== 'VNF' || !vm.zoneid || !vm.hypervisor || !vm.arch) return 'message.vnf.reinstall.vm.unavailable'
  if (!['Running', 'Stopped'].includes(vm.state) || ['Offline', 'Maintenance'].includes(vm.hostcontrolstate) || getFastClonePhase(vm) || String(vm.activebackupstatus).toLowerCase() === 'backingup') return 'message.vnf.reinstall.vm.busy'
  return ''
}
export function vnfReinstallTemplateReason (template, vm) {
  if (!template?.id) return 'message.vnf.reinstall.template.unavailable'
  if (template.templatetype !== 'VNF' || template.format === 'ISO') return 'message.vnf.reinstall.template.type'
  if (!on(template.isready)) return 'message.vnf.reinstall.template.notready'
  if (template.zoneid !== vm.zoneid || template.hypervisor?.toLowerCase() !== vm.hypervisor?.toLowerCase() || template.arch !== vm.arch) return 'message.vnf.reinstall.template.platform'
  const nics = vm.nic
  if (!Array.isArray(nics) || !nics.length || nics.some(n => !n.id || !n.networkid || id(n.deviceid) === null) || new Set(nics.map(n => id(n.deviceid))).size !== nics.length) return 'message.vnf.reinstall.nic.unknown'
  const definitions = template.vnfnics || []
  if (!Array.isArray(definitions) || definitions.some(n => id(n.deviceid) === null) || new Set(definitions.map(n => id(n.deviceid))).size !== definitions.length) return 'message.vnf.reinstall.nic.unknown'
  if (definitions.some(n => (on(n.required) || on(n.management)) && !nics.some(x => id(x.deviceid) === id(n.deviceid) && enabled(x.enabled)))) return 'message.vnf.reinstall.nic.missing'
  if (definitions.length && nics.some(n => !definitions.some(d => id(d.deviceid) === id(n.deviceid)))) return 'message.vnf.reinstall.nic.unmapped'
  return ''
}
export function vnfNicIdentity (vm) {
  return JSON.stringify((vm.nic || []).map(n => Object.fromEntries(['id', 'deviceid', 'networkid', 'isdefault', 'macaddress', 'ipaddress', 'ip6address'].map(k => [k, n[k] ?? null]))).sort((a, b) => Number(a.deviceid) - Number(b.deviceid)))
}
export async function readVnfReinstallTarget (target) {
  const json = await getAPI('listVirtualMachines', { id: target.id, listall: true, details: 'all', ...project(target) }, request)
  const r = json?.listvirtualmachinesresponse
  if (!Array.isArray(r?.virtualmachine) || r.virtualmachine.length !== 1 || Number(r.count ?? 1) !== 1) throw new Error('message.vnf.reinstall.vm.unavailable')
  const vm = r.virtualmachine[0]
  if (vm.id !== target.id || ['projectid', 'account', 'domainid'].some(k => (target[k] || null) !== (vm[k] || null))) throw new Error('message.vnf.reinstall.context')
  return vm
}
export async function readVnfReinstallTemplates (vm, params = {}) {
  const json = await getAPI('listVnfTemplates', { templatefilter: 'executable', listall: true, zoneid: vm.zoneid, hypervisor: vm.hypervisor, arch: vm.arch, details: 'all', ...project(vm), ...params }, request)
  const r = json?.listtemplatesresponse
  if (!r || r.errorcode || (r.count && !Array.isArray(r.template))) throw new Error('message.vnf.reinstall.template.lookup.failed')
  return { rows: r.template || [], count: Number(r.count || 0) }
}
export async function readVnfReinstallRoot (vm) {
  const json = await getAPI('listVolumes', { virtualmachineid: vm.id, type: 'ROOT', listall: true, ...project(vm) }, request)
  const r = json?.listvolumesresponse
  if (!r || r.volume?.length !== 1 || r.volume[0].templateid !== vm.templateid || !['Ready', 'Allocated'].includes(r.volume[0].state)) throw new Error('message.vnf.reinstall.root.unavailable')
  return r.volume[0]
}
export async function readVnfReinstallJobs (vm) {
  const json = await getAPI('listAsyncJobs', { resourceid: vm.id, resourcetype: 'VirtualMachine', includecompleted: true, listall: true, page: 1, pagesize: 500, ...project(vm) }, request)
  const r = json?.listasyncjobsresponse
  if (!r || r.errorcode || (r.count && !Array.isArray(r.asyncjobs))) throw new Error('message.vnf.reinstall.jobs.failed')
  const jobs = r.asyncjobs || []
  return { jobs, complete: Number(r.count || 0) === jobs.length }
}
export function vnfReinstallPayload (vm, template, mode) {
  if (vnfReinstallTemplateReason(template, vm)) throw new Error(vnfReinstallTemplateReason(template, vm))
  if (!['original', 'other'].includes(mode) || (mode === 'original' && template.id !== vm.templateid)) throw new Error('message.vnf.reinstall.template.unavailable')
  return { virtualmachineid: vm.id, ...(mode === 'other' ? { templateid: template.id } : {}) }
}
