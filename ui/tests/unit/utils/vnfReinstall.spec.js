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
import { vnfReinstallReason, vnfReinstallTemplateReason, vnfNicIdentity, vnfReinstallPayload, readVnfReinstallTarget, readVnfReinstallTemplates, readVnfReinstallRoot, readVnfReinstallJobs } from '@/utils/vnfReinstall'
jest.mock('@/api', () => ({ getAPI: jest.fn() }))
const apis = Object.fromEntries(['restoreVirtualMachine', 'listVirtualMachines', 'listVnfTemplates', 'listVolumes', 'listAsyncJobs', 'queryAsyncJobResult'].map(k => [k, {}]))
const vm = () => ({ id: 'vm', templateid: 'a', templatetype: 'VNF', state: 'Stopped', zoneid: 'zone', hypervisor: 'KVM', arch: 'x86_64', account: 'owner', domainid: 'domain', nic: [0, 1].map(n => ({ id: 'nic' + n, deviceid: n, networkid: 'net' + n, isdefault: n === 0, macaddress: 'mac' + n, ipaddress: '10.0.0.' + (n + 2) })) })
const template = () => ({ id: 'a', templatetype: 'VNF', format: 'QCOW2', isready: true, zoneid: 'zone', hypervisor: 'KVM', arch: 'x86_64', vnfnics: [0, 1].map(n => ({ deviceid: n, required: true, management: n === 0 })) })
beforeEach(() => getAPI.mockReset())
test.each(Object.keys(apis))('missing %s permission blocks the workflow', name => { const a = { ...apis }; delete a[name]; expect(vnfReinstallReason(vm(), a)).toBe('message.vnf.reinstall.permission') })
test.each([{ state: 'Destroyed' }, { hostcontrolstate: 'Offline' }, { clonefastphase: 'source_preparing' }, { activebackupstatus: 'BackingUp' }])('busy target is blocked: %j', patch => expect(vnfReinstallReason({ ...vm(), ...patch }, apis)).toBe('message.vnf.reinstall.vm.busy'))
test.each(['USER', 'SYSTEM', 'ROUTING'])('non-VNF %s target cannot use this workflow', templatetype => expect(vnfReinstallReason({ ...vm(), templatetype }, apis)).toBeTruthy())
test.each(['USER', 'SYSTEM', 'ROUTING'])('non-VNF %s candidate is rejected', templatetype => expect(vnfReinstallTemplateReason({ ...template(), templatetype }, vm())).toBe('message.vnf.reinstall.template.type'))
test.each([{ format: 'ISO' }, { isready: false }, { zoneid: 'other' }, { hypervisor: 'VMware' }, { arch: 'aarch64' }, { id: null }])('unavailable candidate is rejected: %j', patch => expect(vnfReinstallTemplateReason({ ...template(), ...patch }, vm())).toBeTruthy())
test('required and management deviceids must have enabled NICs', () => {
  const t = template(); t.vnfnics.push({ deviceid: 2, required: true, management: false }); expect(vnfReinstallTemplateReason(t, vm())).toBe('message.vnf.reinstall.nic.missing')
  t.vnfnics[2] = { deviceid: 2, required: false, management: true }; expect(vnfReinstallTemplateReason(t, vm())).toBe('message.vnf.reinstall.nic.missing')
  t.vnfnics[2].management = false; expect(vnfReinstallTemplateReason(t, vm())).toBe('')
  const v = vm(); v.nic[0].enabled = false; expect(vnfReinstallTemplateReason(template(), v)).toBe('message.vnf.reinstall.nic.missing')
})
test('unknown, duplicate and undefined mappings fail closed without adding NICs', () => {
  const v = vm(); v.nic[1].deviceid = 0; expect(vnfReinstallTemplateReason(template(), v)).toBe('message.vnf.reinstall.nic.unknown')
  const t = template(); t.vnfnics.pop(); expect(vnfReinstallTemplateReason(t, vm())).toBe('message.vnf.reinstall.nic.unmapped')
  t.vnfnics.push({ deviceid: 0 }); expect(vnfReinstallTemplateReason(t, vm())).toBe('message.vnf.reinstall.nic.unknown')
})
test('NIC identity is order independent but detects changes to network/IP/MAC/default/UUID', () => {
  const v = vm(); expect(vnfNicIdentity({ ...v, nic: [...v.nic].reverse() })).toBe(vnfNicIdentity(v))
  for (const key of ['id', 'deviceid', 'networkid', 'isdefault', 'ipaddress', 'ip6address', 'macaddress']) {
    const other = vm(); other.nic[0][key] = 'changed'; expect(vnfNicIdentity(other)).not.toBe(vnfNicIdentity(v))
  }
})
test('original omits templateid and all unsupported overrides; replacement sends only two fields', () => {
  expect(vnfReinstallPayload(vm(), template(), 'original')).toEqual({ virtualmachineid: 'vm' })
  expect(vnfReinstallPayload(vm(), { ...template(), id: 'b' }, 'other')).toEqual({ virtualmachineid: 'vm', templateid: 'b' })
  expect(() => vnfReinstallPayload(vm(), { ...template(), id: 'b' }, 'original')).toThrow()
  expect(() => vnfReinstallPayload(vm(), template(), 'unknown')).toThrow()
})
test('fresh VM reads keep explicit owner/project and reject missing or changed ownership', async () => {
  const v = { ...vm(), projectid: 'project' }; getAPI.mockResolvedValue({ listvirtualmachinesresponse: { count: 1, virtualmachine: [v] } }); expect(await readVnfReinstallTarget(v)).toEqual(v)
  expect(getAPI.mock.calls[0][1]).toEqual({ id: 'vm', details: 'all', listall: true, projectid: 'project' })
  getAPI.mockResolvedValue({ listvirtualmachinesresponse: { count: 1, virtualmachine: [{ ...v, account: 'other' }] } }); await expect(readVnfReinstallTarget(v)).rejects.toThrow('context')
  getAPI.mockResolvedValue({ listvirtualmachinesresponse: {} }); await expect(readVnfReinstallTarget(v)).rejects.toThrow('unavailable')
})
test('executable VNF query uses the actual listtemplatesresponse contract and target platform', async () => {
  getAPI.mockResolvedValue({ listtemplatesresponse: { count: 1, template: [template()] } }); expect((await readVnfReinstallTemplates(vm(), { id: 'a' })).rows).toHaveLength(1)
  expect(getAPI.mock.calls[0][1]).toMatchObject({ templatefilter: 'executable', id: 'a', zoneid: 'zone', hypervisor: 'KVM', arch: 'x86_64', details: 'all', ignoreproject: true })
  getAPI.mockResolvedValue({}); await expect(readVnfReinstallTemplates(vm())).rejects.toThrow('lookup.failed')
})
test('one current root is required; mismatched/deleted/unknown roots are not guessed', async () => {
  for (const volume of [[], [{ state: 'Ready', templateid: 'other' }], [{ state: 'Destroyed', templateid: 'a' }]]) {
    getAPI.mockResolvedValue({ listvolumesresponse: { volume } }); await expect(readVnfReinstallRoot(vm())).rejects.toThrow('root.unavailable')
  }
  getAPI.mockResolvedValue({ listvolumesresponse: { volume: [{ id: 'root', state: 'Ready', templateid: 'a' }] } }); expect((await readVnfReinstallRoot(vm())).id).toBe('root')
})
test('job reconciliation is scoped to the exact VM and records incomplete coverage', async () => {
  getAPI.mockResolvedValue({ listasyncjobsresponse: { count: 501, asyncjobs: [{ jobid: 'old', jobstatus: 1 }] } }); expect((await readVnfReinstallJobs(vm())).complete).toBe(false)
  expect(getAPI.mock.calls[0][1]).toMatchObject({ resourceid: 'vm', resourcetype: 'VirtualMachine', includecompleted: true })
})
