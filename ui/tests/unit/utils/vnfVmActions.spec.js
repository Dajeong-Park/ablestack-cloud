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

import { vnfUnmanageApis, vnfUnmanageReason, readVnfActionTarget, readVnfUnmanagePreview, vmWallUrl } from '@/utils/vnfVmActions'
import { vmStoredUserDataAction, vmVbmcAction, vmCloneAction, vmUnmanageAction } from '@/config/section/vmCommonActions'
import { getAPI } from '@/api'
jest.mock('@/api', () => ({ getAPI: jest.fn() }))
const clone = v => JSON.parse(JSON.stringify(v))
const vm = () => ({ id: '11111111-1111-4111-8111-111111111111', templatetype: 'VNF', hypervisor: 'KVM', state: 'Running', hostid: 'host', zoneid: 'zone', account: 'owner', domainid: 'domain', details: {} })
const store = () => ({ userInfo: { roletype: 'Admin' }, apis: Object.fromEntries(vnfUnmanageApis.map(n => [n, {}])) })
let source, host, volumes, configs, jobs
beforeEach(() => {
  jest.clearAllMocks(); source = vm(); host = { id: 'host', zoneid: 'zone', state: 'Up', resourcestate: 'Enabled' }; volumes = [{ id: 'root', type: 'ROOT', virtualmachineid: source.id, state: 'Ready' }]; configs = [{ name: 'unmanage.vm.preserve.nics', value: 'false' }]; jobs = []
  getAPI.mockImplementation(async api => ({ listVirtualMachines: { listvirtualmachinesresponse: { virtualmachine: [clone(source)] } }, listHosts: { listhostsresponse: { host: [host] } }, listVolumes: { listvolumesresponse: { volume: volumes } }, listConfigurations: { listconfigurationsresponse: { configuration: configs } }, listAsyncJobs: { listasyncjobsresponse: { count: jobs.length, asyncjobs: jobs } } })[api])
})
test('shared definitions retain normal VM clone/unmanage visibility while VNF clone is explicitly unavailable', () => {
  const c = vmCloneAction({ disabled: v => v.hostcontrolstate === 'Offline', tooltip: () => 'legacy' })
  expect(c.show(vm())).toBe(true); expect(c.disabled(vm(), store(), [])).toBe(true); expect(c.tooltip(vm())).toContain('clone.unsupported')
  const user = { ...vm(), templatetype: 'USER' }; expect(c.show(user)).toBe(true); expect(c.disabled(user)).toBe(false); expect(c.tooltip(user)).toBe('legacy'); expect(c.disabled({ ...user, hostcontrolstate: 'Offline' })).toBe(true)
  expect(c.show({ ...user, state: 'Starting' })).toBe(false); expect(c.show({ ...user, vmtype: 'sharedfsvm' })).toBe(false)
  const u = vmUnmanageAction(); expect(u.show(user)).toBe(true); expect(u.disabled(user, {})).toBe(false); expect(u.show({ ...user, hypervisor: 'VMware' })).toBe(true)
  expect(vmStoredUserDataAction().show(vm(), { apis: { getVirtualMachineUserData: { params: [{ name: 'virtualmachineid' }] } } })).toBe(true)
  expect(vmStoredUserDataAction().show(vm(), { apis: {} })).toBe(false); expect(vmVbmcAction().selfManagedDialog).toBe(true)
})
test.each([
  [{ state: 'Stopped' }, 'running'], [{ state: 'Stopping' }, 'running'], [{ hypervisor: 'VMware' }, 'kvm'], [{ hostid: null }, 'host'], [{ hostcontrolstate: 'Offline' }, 'host'], [{ hostcontrolstate: 'Maintenance' }, 'host'], [{ deleteprotection: true }, 'protected'], [{ deleteprotection: 'true' }, 'protected'], [{ haenable: true }, 'ha'], [{ details: { configDriveLocation: 'drive' } }, 'configdrive'], [{ vbmcport: '6230' }, 'bmc'], [{ vbmcstatus: 'CleanupRequired' }, 'bmc'], [{ clonefaststatus: 'pending' }, 'busy'], [{ activebackupstatus: 'backingup' }, 'busy']
])('unmanage rejects unsupported combination %j with an explicit reason', (patch, reason) => { expect(vnfUnmanageReason({ ...vm(), ...patch }, store())).toContain(reason) })
test('required APIs and root admin are checked independently of button existence', () => {
  expect(vnfUnmanageReason(vm(), store())).toBe('')
  for (const api of vnfUnmanageApis) { const s = store(); delete s.apis[api]; expect(vnfUnmanageReason(vm(), s)).toContain('permission') }
  const s = store(); s.userInfo.roletype = 'DomainAdmin'; expect(vnfUnmanageReason(vm(), s)).toContain('permission')
})
test('preflight reads current ownership, enabled host, attached ready volumes, preservation policy and resource-scoped jobs', async () => {
  const p = await readVnfUnmanagePreview(vm(), store()); expect(p.preserveNics).toBe(false); expect(p.host.id).toBe('host')
  expect(getAPI.mock.calls.find(([api]) => api === 'listAsyncJobs')[1]).toMatchObject({ resourceid: source.id, resourcetype: 'VirtualMachine', includecompleted: true, page: 1, pagesize: 500 })
  configs[0].value = 'true'; expect((await readVnfUnmanagePreview(vm(), store())).preserveNics).toBe(true)
})
test.each(['account', 'domainid', 'projectid', 'id'])('different target %s is refused before any dependent read', async field => { source[field] = 'foreign'; await expect(readVnfActionTarget(vm())).rejects.toThrow('unavailable'); expect(getAPI).toHaveBeenCalledTimes(1) })
test.each(['host', 'volume', 'config', 'job'])('fresh %s refusal blocks unmanage', async kind => {
  if (kind === 'host') host.state = 'Down'
  if (kind === 'volume') volumes[0].state = 'Allocated'
  if (kind === 'config') configs = []
  if (kind === 'job') jobs = [{ jobid: 'busy', jobstatus: 0 }]
  await expect(readVnfUnmanagePreview(vm(), store())).rejects.toThrow()
})
const wall = patch => Object.entries({ protocol: 'https', domain: 'monitor.example.test', port: '8081', 'vm.uri': '/d/uservm?kiosk', ...patch }).map(([k, value]) => ({ name: 'monitoring.wall.portal.' + k, value }))
test('Wall URL preserves portal configuration and uses one exact VM UUID', () => {
  const url = new URL(vmWallUrl(wall({ 'vm.uri': '/d/uservm?var-vm_uuid=old&orgId=1' }), '', vm().id)); expect(url.origin).toBe('https://monitor.example.test:8081'); expect(url.searchParams.getAll('var-vm_uuid')).toEqual([vm().id]); expect(url.searchParams.get('orgId')).toBe('1')
  expect(vmWallUrl(wall({ domain: '' }), '10.10.31.10', vm().id)).toContain('10.10.31.10:8081')
})
test.each([{ protocol: 'javascript' }, { domain: 'name@host' }, { domain: 'host/path' }, { port: '0' }, { port: '65536' }, { port: '1e3' }, { 'vm.uri': '' }, { 'vm.uri': '//evil.test/path' }])('invalid Wall configuration %j never produces an active link', patch => { expect(vmWallUrl(wall(patch), '', vm().id)).toBe('') })
