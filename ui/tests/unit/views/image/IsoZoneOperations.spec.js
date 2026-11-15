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

import { mount } from '@vue/test-utils'
import { h } from 'vue'
import Availability from '@/components/widgets/TemplateAvailability'
import Ops from '@/views/image/IsoZoneOperations'
import Zones from '@/views/image/IsoZones'
import Detail from '@/components/widgets/IsoDetailValue'
import { canIsoAction } from '@/utils/isoModel'
import { isoStoreReason, isoSize, isoStorePresentation, isoCopyDestinations, isoCopyResult, readOwnedIsoZones, presentedIsoValue } from '@/utils/isoZoneOperations'
import { getAPI, postAPI } from '@/api'
jest.mock('@/api', () => ({ getAPI: jest.fn(), postAPI: jest.fn() }))
const a = { id: 'iso', format: 'ISO', account: 'admin', domainid: 'root', name: 'image', zoneid: 'a', zonename: 'A', isready: true, bootable: false }
const b = { ...a, zoneid: 'b', zonename: 'B' }
const grants = { userInfo: { id: 'actor', account: 'admin', domainid: 'root', roletype: 'Admin' }, apis: { listIsos: {}, listZones: {}, copyIso: {}, deleteIso: {} }, project: {} }
const reply = rows => ({ listisosresponse: { iso: rows, count: rows.length } })
let c; let copies
beforeEach(() => {
  jest.clearAllMocks(); copies = [a]
  c = { ...Ops.data(), resource: a, context: 'scope', permitted: true, allowed: (action, row) => canIsoAction(action, row, grants), $store: { getters: grants }, $t: k => k, $emit: jest.fn(), $parent: {}, $refs: {}, $nextTick: fn => fn(), $router: { push: jest.fn() }, $route: { query: {} } }
  Object.entries(Ops.methods).forEach(([key, fn]) => { c[key] = fn.bind(c) })
  Object.defineProperty(c, 'canSubmit', { get: () => Ops.computed.canSubmit.call(c) })
  getAPI.mockImplementation(async cmd => cmd === 'listZones' ? { listzonesresponse: { zone: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }] } } : cmd === 'queryAsyncJobResult' ? { queryasyncjobresultresponse: { jobstatus: 1 } } : reply(copies))
  postAPI.mockImplementation(async (cmd, params) => { copies = cmd === 'deleteIso' ? copies.filter(r => r.zoneid !== params.zoneid) : [...copies, { ...a, zoneid: params.destzoneids }]; return { [cmd === 'copyIso' ? 'copytemplateresponse' : 'deleteisoresponse']: { jobid: 'job' } } })
})
test.each([[0, '0 B'], [1, '1 B'], [1525760, '1.46 MiB'], [1073741824, '1 GiB'], [null, '—'], [-1, '—']])('byte size %s uses an appropriate unit', (value, label) => expect(isoSize(value)).toBe(label))
test('ISO booleans include bootable and exact original copy fields', () => {
  for (const field of ['bootable', 'isready', 'id', 'checksum', 'url', 'size']) expect(presentedIsoValue(field)).toBe(true)
  expect(Detail.computed.booleanValue.call({ value: 'false', $t: k => k })).toBe('label.no')
  expect(Detail.computed.booleanValue.call({ value: undefined, $t: k => k })).toBe('label.unknown')
  expect(isoStorePresentation({ downloadState: 'UPLOAD_ABANDONED', downloadPercent: null })).toMatchObject({ label: 'label.iso.zone.abandoned', percent: null })
  expect(isoStorePresentation({ downloadState: 'UPLOAD_IN_PROGRESS', downloadPercent: 12 })).toMatchObject({ badge: 'processing', percent: 12 })
})
test('copy candidates exclude source, every existing copy, disabled and duplicate Zones', () => {
  expect(isoCopyDestinations([{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'c' }, { id: 'd', allocationstate: 'Disabled' }], 'a', [a, b])).toEqual([{ id: 'c' }])
})
test('only the target ISO and destination Ready can complete a copy', () => {
  expect(isoCopyResult([{ ...b, id: 'other' }], 'iso', 'b')).toBe('waitingReady')
  expect(isoCopyResult([{ ...b, isready: false, downloaddetails: [{ downloadState: 'DOWNLOAD_IN_PROGRESS' }] }], 'iso', 'b')).toBe('waitingReady')
  expect(isoCopyResult([b], 'iso', 'b')).toBe('success')
  expect(isoCopyResult([{ ...b, isready: false, downloaddetails: [{ downloadState: 'DOWNLOAD_ERROR' }] }], 'iso', 'b')).toBe('failed')
})
test('owned observation uses actor project instead of the resource owner project', async () => {
  await readOwnedIsoZones(getAPI, { ...a, projectid: 'owner-project' }, { ...grants, userInfo: { ...grants.userInfo, roletype: 'User' }, project: { id: 'actor-project' } })
  expect(getAPI.mock.calls[0][1]).toMatchObject({ keyword: 'iso', isofilter: 'self', projectid: 'actor-project', showunique: false, ignoreproject: true })
})
test('read failure and incomplete pagination are never absence', async () => {
  getAPI.mockResolvedValueOnce({ listisosresponse: { count: 1, iso: [] } })
  await expect(readOwnedIsoZones(getAPI, a, grants)).rejects.toThrow()
  getAPI.mockRejectedValueOnce(new Error('offline'))
  await expect(readOwnedIsoZones(getAPI, a, grants)).rejects.toThrow('offline')
})
test('one Zone explains no target and blocks empty or duplicate submit', async () => {
  getAPI.mockImplementation(async cmd => cmd === 'listZones' ? { listzonesresponse: { zone: [{ id: 'a', name: 'A' }] } } : reply(copies))
  await c.open('copy', [a]); expect(c.destinations).toEqual([]); expect(c.canSubmit).toBe(false)
  await c.submit(); expect(postAPI).not.toHaveBeenCalled()
  c.destinations = [{ id: 'b', name: 'B' }]; c.selectedZones = ['b', 'b']; expect(c.canSubmit).toBe(false)
})
test('real copytemplateresponse contract, per-target Ready and partial failure retain results', async () => {
  await c.open('copy', [a]); c.selectedZones = ['b', 'c']
  const normal = postAPI.getMockImplementation(); postAPI.mockImplementation(async (cmd, p) => { if (p.destzoneids === 'c') throw Object.assign(new Error('denied'), { response: { status: 403 } }); return normal(cmd, p) })
  await c.submit(); expect(c.rows.map(r => r.operationState)).toEqual(['success', 'failed']); expect(c.rows[0].jobComplete).toBe(true); expect(c.visible).toBe(true)
  expect(postAPI.mock.calls[0][1]).toEqual({ id: 'iso', sourcezoneid: 'a', destzoneids: 'b' })
  postAPI.mockImplementation(normal); await c.retryFailed(); expect(c.rows.map(r => r.operationState)).toEqual(['success', 'success']); expect(postAPI.mock.calls.filter(([, p]) => p.destzoneids === 'b')).toHaveLength(1)
})
test('a lost POST reply only offers GET observation and reopening resumes the unknown result', async () => {
  await c.open('copy', [a]); c.selectedZones = ['b']; postAPI.mockRejectedValue(new Error('timeout'))
  await c.submit(); expect(c.rows[0].operationState).toBe('unknown'); await c.observeUnknown(); expect(postAPI).toHaveBeenCalledTimes(1)
  c.close(); await c.open('copy', [a]); expect(c.phase).toBe('result'); expect(c.rows[0].operationState).toBe('waitingReady'); expect(postAPI).toHaveBeenCalledTimes(1)
  copies = [a, b]; await c.observeUnknown(); expect(c.rows[0].operationState).toBe('success'); expect(postAPI).toHaveBeenCalledTimes(1)
})
test('double submit cannot duplicate mutation and late responses cannot cross context', async () => {
  await c.open('delete', [a]); let finish; postAPI.mockImplementation(() => new Promise(resolve => { finish = resolve }))
  const pending = c.submit(); await new Promise(resolve => setTimeout(resolve, 0)); await c.submit(); expect(postAPI).toHaveBeenCalledTimes(1)
  c.context = 'other'; Ops.watch.context.call(c); finish({ deleteisoresponse: { jobid: 'job' } }); await pending; expect(c.rows).toEqual([]); expect(c.busy).toBe(false); expect(getAPI.mock.calls.some(([cmd]) => cmd === 'queryAsyncJobResult')).toBe(false)
})
test('delete only selected Zone, keep partial copies, and return after verified last deletion', async () => {
  copies = [a, b]; await c.open('delete', [b]); await c.submit(); expect(c.rows[0]).toMatchObject({ operationState: 'success', verifiedGone: true }); c.close(); expect(c.$router.push).not.toHaveBeenCalled(); expect(copies).toEqual([a])
  await c.open('delete', [a]); await c.submit(); c.close(); expect(c.$router.push).toHaveBeenCalledWith({ path: '/iso' })
  expect(postAPI.mock.calls.every(([cmd, p]) => cmd === 'deleteIso' && p.id === 'iso' && p.zoneid)).toBe(true)
})
test('failure to observe completed deletion stays unknown and never redirects', async () => {
  await c.open('delete', [a]); const old = getAPI.getMockImplementation(); let mutation = false
  const normal = postAPI.getMockImplementation(); postAPI.mockImplementation(async (...args) => { mutation = true; return normal(...args) })
  getAPI.mockImplementation(async cmd => mutation && cmd === 'listIsos' ? Promise.reject(new Error('offline')) : old(cmd))
  await c.submit(); expect(c.rows[0]).toMatchObject({ operationState: 'unknown', jobComplete: true }); c.close(); expect(c.$router.push).not.toHaveBeenCalled()
})
test('Zone search spans all loaded pages and changing query clears hidden selection', () => {
  const vm = { dataSource: [a, b], keyword: 'b', page: 1, pageSize: 1 }
  expect(Zones.computed.filteredRows.call(vm)).toEqual([b]); vm.filteredRows = [b]; expect(Zones.computed.visibleRows.call(vm)).toEqual([b])
  const search = { searchText: ' A ', page: 3, resetSelection: jest.fn() }; Zones.methods.searchZones.call(search); expect(search.keyword).toBe('A'); expect(search.page).toBe(1); expect(search.resetSelection).toHaveBeenCalled()
})

test('gateway failure after POST is unknown and cannot be retried as a known rejection', async () => {
  await c.open('delete', [a]); postAPI.mockRejectedValue(Object.assign(new Error('gateway'), { response: { status: 503 } }))
  await c.submit(); expect(c.rows[0]).toMatchObject({ operationState: 'unknown', retryable: false }); await c.retryFailed(); expect(postAPI).toHaveBeenCalledTimes(1)
})

test('completed copy job remains waiting until its destination is actually Ready', async () => {
  await c.open('copy', [a]); copies = [a, { ...b, isready: false, downloaddetails: [{ downloadState: 'DOWNLOAD_IN_PROGRESS' }] }]
  const row = { ...b, jobComplete: true }; const time = jest.spyOn(Date, 'now').mockReturnValueOnce(0).mockReturnValueOnce(60001)
  try { await c.observeResult(row, c.epoch); expect(row.operationState).toBe('waitingReady'); expect(postAPI).not.toHaveBeenCalled() } finally { time.mockRestore() }
  copies = [a, b]; await c.observeResult(row, c.epoch); expect(row.operationState).toBe('success')
})
test('owned failed ISO rows use self scope and remain available for safe deletion', async () => {
  copies = [{ ...a, isready: false, downloaddetails: [{ downloadState: 'DOWNLOAD_ERROR' }] }]
  const vm = { resource: a, isoScope: 'scope', $store: { getters: { ...grants, userInfo: { ...grants.userInfo, roletype: 'User' } } }, isListRequestCurrent: () => true }
  const result = await Zones.methods.readAllRows.call(vm, { id: a.id }, {}, 'scope')
  expect(result.listisosresponse.iso[0].isready).toBe(false); expect(getAPI.mock.calls[0][1]).toMatchObject({ keyword: a.id, isofilter: 'self' })
})

test('all-project ownership observation explicitly uses the actor all-project scope', async () => {
  await readOwnedIsoZones(getAPI, a, { ...grants, project: {}, listAllProjects: true })
  expect(getAPI.mock.calls[0][1].projectid).toBe('-1')
})

test('restricted store rows without a role remain visible without inferring type or collapsing duplicate names', () => {
  const stores = [{ datastore: 'Secondary Storage', downloadState: 'DOWNLOAD_ERROR', downloadPercent: 0 }, { datastore: 'Secondary Storage', downloadState: 'DOWNLOADED', downloadPercent: 100 }]
  const row = { downloaddetails: stores }
  expect(Zones.methods.storeRows(row, 'Unknown')).toEqual(stores)
  expect(Zones.methods.storeRows(row, 'Primary')).toEqual([])
  expect(Zones.methods.storeRows(row, 'Image')).toEqual([])
  expect(stores.every(store => store.datastoreRole === undefined)).toBe(true)
})

test('state reason localization preserves storage names and unknown diagnostic text', () => {
  expect(isoStoreReason('Secondary Storage: DOWNLOAD_ERROR', key => key)).toBe('Secondary Storage: label.template.store.failed')
  expect(isoStoreReason('DOWNLOAD_ERROR Store: DOWNLOADED', key => key)).toBe('DOWNLOAD_ERROR Store: label.template.store.ready')
  expect(isoStoreReason('Checksum does not match', key => key)).toBe('Checksum does not match')
})
test.each(['iso', 'template'])('availability renders diagnostics under its own presentation contract (%s)', kind => {
  const wrapper = mount(Availability, { props: { kind, record: { ...a, isready: false, downloaddetails: [{ datastore: 'Secondary Storage', downloadState: 'DOWNLOAD_ERROR' }] }, compact: true, showScope: false }, global: { mocks: { $t: key => key }, stubs: { ABadge: { props: ['text'], render () { return h('span', this.text) } } } } })
  if (kind === 'iso') { expect(wrapper.text()).not.toContain('DOWNLOAD_ERROR'); expect(wrapper.text()).toContain('label.template.store.failed'); expect(wrapper.find('.template-availability__reason').attributes('title')).toContain('DOWNLOAD_ERROR') } else expect(wrapper.text()).toContain('DOWNLOAD_ERROR')
  wrapper.unmount()
})
