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

import Download from '@/views/image/IsoDownload'
import Attach from '@/views/image/IsoVmAttach'
import VmIsoManager from '@/views/compute/VmIsoManager'
import Selection from '@/views/compute/wizard/TemplateIsoSelection'
import image from '@/config/section/image'
import { canIsoAction } from '@/utils/isoModel'
import { isoDownloadResult, bootIsoZones, readVmIsoCandidates } from '@/utils/isoConsumption'
import { getAPI, postAPI } from '@/api'
jest.mock('@/api', () => ({ getAPI: jest.fn(), postAPI: jest.fn() }))
jest.mock('@/store', () => ({ getters: { userInfo: { roletype: 'Admin' }, zones: [{}] } }))
const row = { id: 'image', zoneid: 'zone', zonename: 'Zone', name: 'ISO', isready: true, bootable: false, isextractable: true, account: 'admin', domainid: 'domain' }
const getters = () => ({ userInfo: { id: 'admin', account: 'admin', domainid: 'domain', roletype: 'Admin' }, project: {}, apis: { listIsos: {}, extractIso: {}, listVirtualMachines: {}, attachIso: {} } })
function context (component, values = {}) {
  const c = { ...component.data.call({}), resource: { ...row }, $store: { getters: getters(), state: { user: { token: 'session' } } }, $emit: jest.fn(), $t: k => k, ...values }
  Object.entries(component.methods).forEach(([k, fn]) => { c[k] = fn.bind(c) })
  Object.entries(component.computed).forEach(([k, fn]) => { Object.defineProperty(c, k, { get: () => fn.call(c) }) })
  return c
}
const prepare = () => context(Download, { loading: false, zones: [row], zoneid: 'zone' })
const observed = result => ({ queryasyncjobresultresponse: result })
beforeEach(() => { jest.clearAllMocks(); getAPI.mockImplementation(async command => command === 'listIsos' ? { listisosresponse: { iso: [row], count: 1 } } : observed({ jobstatus: 1, jobresult: { iso: { id: 'image', zoneid: 'zone', url: 'https://download.example/file.iso' } } })); postAPI.mockResolvedValue({ extractisoresponse: { jobid: 'job' } }) })

test('ISO download uses its own managed component and removes raw HTML result links', () => {
  const action = image.children.find(s => s.name === 'iso').actions.find(a => a.api === 'extractIso')
  expect(action.selfManagedDialog).toBe(true); expect(action.popup).toBe(true); expect(action.response).toBeUndefined()
  expect(image.children.find(s => s.name === 'template').actions.find(a => a.api === 'extractTemplate').response).toBeDefined()
})
test.each(['javascript:alert(1)', 'data:text/plain,hello', 'https://user:password@example/file.iso', 'not-a-url'])('download rejects unsafe URL %s', url => { expect(isoDownloadResult({ id: 'image', url }, 'image', 'zone')).toBeNull() })
test('download requires exact image and optional Zone identity, retaining private HTTP URLs only in memory', () => {
  expect(isoDownloadResult({ id: 'other', url: 'https://host/file.iso' }, 'image', 'zone')).toBeNull()
  expect(isoDownloadResult({ id: 'image', zoneid: 'other', url: 'https://host/file.iso' }, 'image', 'zone')).toBeNull()
  expect(isoDownloadResult({ id: 'image', url: 'http://host/file.iso?ticket=temporary', physicalsize: 123 }, 'image', 'zone')).toEqual({ url: 'http://host/file.iso?ticket=temporary', size: 123 })
})
test('strict ready and bootable values select boot Zones and deduplicate', () => {
  expect(bootIsoZones([{ zoneid: 'a', isready: true, bootable: 'false' }, { zoneid: 'b', isready: 'true', bootable: 'true' }, { zoneid: 'b', isready: true, bootable: true }, { zoneid: 'c', isready: false, bootable: true }, { zoneid: 'd', isready: true }]).map(z => z.id)).toEqual(['b'])
})
test('prepare distinguishes acceptance from job completion and file receipt', async () => {
  const c = prepare(); await c.prepare(); expect(postAPI).toHaveBeenCalledWith('extractIso', { id: 'image', zoneid: 'zone', mode: 'HTTP_DOWNLOAD' }, expect.anything()); expect(c.phase).toBe('ready'); expect(c.result.url).toBe('https://download.example/file.iso'); expect(c.requested).toBe(false); expect(c.busy).toBe(false)
})
test('preparation validates current source and readiness before any write', async () => {
  const c = prepare(); getAPI.mockResolvedValue({ listisosresponse: {} }); await c.prepare(); expect(c.phase).toBe('failed'); expect(postAPI).not.toHaveBeenCalled()
})
test('busy preparation cannot duplicate POST or close its dialog', async () => {
  let finish; postAPI.mockReturnValue(new Promise(resolve => { finish = resolve })); const c = prepare(); const pending = c.prepare(); await Promise.resolve(); await Promise.resolve(); await c.prepare(); c.close(); expect(c.$emit).not.toHaveBeenCalled(); finish({ extractisoresponse: { jobid: 'job' } }); await pending; expect(postAPI).toHaveBeenCalledTimes(1)
})
test('accepted job observation failures stay unknown and check status only reads', async () => {
  const c = prepare(); getAPI.mockImplementation(async command => { if (command === 'listIsos') return { listisosresponse: { iso: [row], count: 1 } }; throw Object.assign(new Error('private transport URL'), { response: { status: 403 } }) }); await c.prepare(); expect(c.phase).toBe('unknown'); expect(c.error).not.toContain('private'); getAPI.mockResolvedValue(observed({ jobstatus: 1, jobresult: { iso: { id: 'image', url: 'https://host/file.iso' } } })); await c.check(); expect(c.phase).toBe('ready'); expect(postAPI).toHaveBeenCalledTimes(1)
})
test('missing job IDs never become download success or auto-retry', async () => {
  postAPI.mockResolvedValue({ extractisoresponse: {} }); const c = prepare(); await c.prepare(); await c.prepare(); expect(c.phase).toBe('unknown'); expect(c.result).toBeNull(); expect(postAPI).toHaveBeenCalledTimes(1)
})
test('job rejection can explicitly prepare again and discards old URLs', async () => {
  const c = prepare(); getAPI.mockImplementation(async cmd => cmd === 'listIsos' ? { listisosresponse: { iso: [row], count: 1 } } : observed({ jobstatus: 2, jobresult: { errortext: 'private URL' } })); await c.prepare(); expect(c.phase).toBe('failed'); expect(c.error).toBe('message.iso.download.failed'); await c.prepare(); expect(postAPI).toHaveBeenCalledTimes(2)
})
test('session invalidation discards accepted late result without exposing a link', async () => {
  let finish; postAPI.mockReturnValue(new Promise(resolve => { finish = resolve })); const c = prepare(); const pending = c.prepare(); await Promise.resolve(); await Promise.resolve(); c.invalidate(); finish({ extractisoresponse: { jobid: 'job' } }); await pending; expect(c.result).toBeNull(); expect(c.jobid).toBe('')
})
test('ready links are cleared when the dialog closes', () => { const c = prepare(); c.result = { url: 'https://host/file.iso' }; c.close(); expect(c.result).toBeNull(); expect(c.$emit).toHaveBeenCalledWith('close-action') })
test('attach permission does not require deployment or image ownership but requires VM and ISO reads', () => {
  const g = getters(); delete g.apis.extractIso; expect(canIsoAction('attach', { ...row, account: 'shared-owner' }, g)).toBe(true); delete g.apis.listVirtualMachines; expect(canIsoAction('attach', row, g)).toBe(false)
})
test('shared candidates paginate without losing existing or shared media', async () => {
  const request = jest.fn(async (_, p) => p.isofilter === 'selfexecutable' ? { listisosresponse: { iso: [{ ...row, id: p.page === 1 ? 'a' : 'b' }], count: 2 } } : p.isofilter === 'sharedexecutable' ? { listisosresponse: { iso: [row, { ...row, id: 'a' }], count: 2 } } : { listisosresponse: {} }); expect((await readVmIsoCandidates(request, { zoneid: 'zone' })).map(i => i.id)).toEqual(['a', 'b', 'image']); expect(request.mock.calls.filter(c => c[1].isofilter === 'selfexecutable').map(c => c[1].page)).toEqual([1, 2])
})
test('candidate failures or stale boundaries do not become empty success', async () => {
  await expect(readVmIsoCandidates(async () => ({ listisosresponse: { iso: {} } }), { zoneid: 'zone' })).rejects.toThrow()
  expect(await readVmIsoCandidates(async () => ({ listisosresponse: {} }), { zoneid: 'zone' }, () => false)).toBeNull()
})
test('VM picker never chooses attached, full, unavailable or wrong Zone resources', async () => {
  const vms = [{ id: 'ok', name: 'VM', state: 'Stopped', zoneid: 'zone', hypervisor: 'KVM', isomaxcount: 1 }, { id: 'same', state: 'Running', zoneid: 'zone', hypervisor: 'KVM', isos: [{ id: 'image' }] }, { id: 'full', state: 'Running', zoneid: 'zone', hypervisor: 'KVM', isomaxcount: 0 }, { id: 'busy', state: 'Starting', zoneid: 'zone', hypervisor: 'KVM' }, { id: 'other', zoneid: 'elsewhere' }]
  getAPI.mockImplementation(async cmd => cmd === 'listIsos' ? { listisosresponse: { iso: [row], count: 1 } } : { listvirtualmachinesresponse: { virtualmachine: vms, count: vms.length } }); const c = context(Attach); await c.load(); expect(c.vms).toHaveLength(4); expect(c.options.filter(o => !o.disabled).map(o => o.value)).toEqual(['ok']); c.vmid = 'full'; c.choose(); expect(c.selectedVm).toBeNull(); c.vmid = 'ok'; c.choose(); expect(c.selectedVm.id).toBe('ok'); expect(postAPI).not.toHaveBeenCalled()
})
test.each(['templateid', 'isoid'])('classic preselection finds exact %s rather than first row', key => {
  const c = { inputDecorator: key, pagination: false, preFillContent: { [key]: 'target' }, filterOpts: [{ id: 'featured' }, { id: 'selfexecutable' }] }; const list = key.slice(0, -2); Selection.watch.items.handler.call(c, { featured: { [list]: [{ id: 'wrong' }] }, selfexecutable: { [list]: [{ id: 'first' }, { id: 'target' }] } }); expect(c.filterType).toBe('selfexecutable'); expect(c.checkedValue).toBe('target')
})

test('ISO entry preselects its candidate in the shared manager without submitting', async () => {
  const c = { scopeKey: 'scope', initialIso: row, capacity: 1, candidateRequest: 0, vm: { zoneid: 'zone' }, rows: [], $nextTick: async () => {}, fetchData: jest.fn(), reason: () => '', $t: k => k }
  await VmIsoManager.methods.openAttach.call(c); expect(c.attachIds).toEqual(['image']); expect(postAPI).not.toHaveBeenCalled()
})
test('an attachment race reports already attached without offering duplicate submission', async () => {
  const c = { scopeKey: 'scope', initialIso: row, capacity: 1, candidateRequest: 0, vm: { zoneid: 'zone' }, rows: [row], $nextTick: async () => {}, fetchData: jest.fn(), reason: () => '', $t: k => k }
  await VmIsoManager.methods.openAttach.call(c); expect(c.attachIds).toEqual([]); expect(c.candidateError).toBe('message.iso.consume.attached'); expect(postAPI).not.toHaveBeenCalled()
})
