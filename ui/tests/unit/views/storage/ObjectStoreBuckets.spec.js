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
import { mount, flushPromises } from '@vue/test-utils'
import { reactive } from 'vue'
import { getAPI, postAPI } from '@/api'
import Related from '@/views/infra/ObjectStoreBuckets'
import SearchFilter from '@/components/view/SearchFilter'
import Picker from '@/components/view/BucketStoreFilter'
import Delete from '@/views/infra/DeleteObjectStore'
jest.mock('@/api', () => ({ getAPI: jest.fn(), postAPI: jest.fn() }))
const page = (store = 'A', count = 1, id = 'bucket') => ({ listbucketsresponse: { count, bucket: count ? [{ id, name: id, objectstorageid: store, state: 'Created', quota: 1, size: 1 }] : [] } })
const button = { props: ['disabled', 'loading'], template: '<button :disabled="disabled"><slot /></button>' }
const store = () => reactive({ state: { user: { token: 'session' } }, getters: { userInfo: { id: 'user', roleid: 'role', roletype: 'Admin' }, project: {}, apis: { listBuckets: {}, listObjectStoragePools: {}, deleteObjectStoragePool: {} } } })
const globalsFor = s => ({ mocks: { $t: key => key, $store: s, $route: reactive({ query: {} }), $router: { push: jest.fn(), replace: jest.fn() } }, stubs: { 'a-button': button, 'a-alert': { props: ['message'], template: '<div>{{ message }}<slot name="description" /></div>' }, 'a-table': true, 'a-pagination': true, 'a-input-search': true, Status: true, RouterLink: true, 'a-select': { template: '<div><slot /></div>' }, 'a-select-option': { template: '<span><slot /></span>' } } })
const view = (s = store()) => mount(Related, { props: { resource: { id: 'A', name: 'Store A' } }, global: globalsFor(s) })
beforeEach(() => { jest.clearAllMocks() })
it('queries the current Object Store across normal and project owners with scoped server pagination', async () => {
  getAPI.mockResolvedValue(page()); const w = view(); await flushPromises()
  expect(getAPI).toHaveBeenCalledWith('listBuckets', { objectstorageid: 'A', listall: true, projectid: '-1', ignoreproject: true, page: 1, pagesize: 10 }, { preserveOnFailure: true, timeout: 20000 })
  expect(w.emitted('state').slice(-1)[0][0]).toMatchObject({ id: 'A', known: true, total: 1 }); w.unmount()
})
it('preserves the previous successful list on transient refresh failure and recovers on retry', async () => {
  getAPI.mockResolvedValueOnce(page()).mockRejectedValueOnce(new Error('timeout')).mockResolvedValueOnce(page('A', 1, 'new'))
  const w = view(); await flushPromises(); await w.vm.load(); expect(w.vm.rows[0].id).toBe('bucket'); expect(w.vm.total).toBe(1); expect(w.emitted('state').slice(-1)[0][0].known).toBe(false)
  expect(w.text()).toContain('message.objectstore.buckets.stale'); await w.vm.load(); expect(w.vm.rows[0].id).toBe('new'); expect(w.vm.error).toBe(false); w.unmount()
})
it('clears old rows for a different query and does not convert its failure to an empty verified store', async () => {
  getAPI.mockResolvedValueOnce(page()).mockRejectedValueOnce(new Error('offline')); const w = view(); await flushPromises(); w.vm.draft = 'absent'; await w.vm.search(); await flushPromises()
  expect(w.vm.rows).toEqual([]); expect(w.vm.total).toBeNull(); expect(w.emitted('state').slice(-1)[0][0].known).toBe(false); w.unmount()
})
it('never offers deletion from a successful filtered empty list', async () => {
  getAPI.mockResolvedValueOnce(page()).mockResolvedValueOnce({ listbucketsresponse: {} }); const w = view(); await flushPromises(); w.vm.draft = 'missing'; w.vm.search(); await flushPromises()
  expect(w.vm.total).toBe(0); expect(w.emitted('state').slice(-1)[0][0].known).toBe(false); w.unmount()
})
it('accepts the canonical Cloud empty envelope only after a successful complete lookup', async () => {
  getAPI.mockResolvedValue({ listbucketsresponse: {} }); const w = view(); await flushPromises(); expect(w.emitted('state').slice(-1)[0][0]).toMatchObject({ known: true, total: 0 }); w.unmount()
})
it('ignores a late prior-store response after switching Object Store', async () => {
  let resolveA; getAPI.mockImplementationOnce(() => new Promise(resolve => { resolveA = resolve })).mockResolvedValueOnce(page('B', 1, 'B-only'))
  const w = view(); await w.setProps({ resource: { id: 'B' } }); await flushPromises(); resolveA(page('A')); await flushPromises(); expect(w.vm.rows[0].id).toBe('B-only'); expect(w.vm.error).toBe(false); w.unmount()
})
it('clears rows and stops requests after losing root permissions', async () => {
  const s = store(); getAPI.mockResolvedValue(page()); const w = view(s); await flushPromises(); s.getters.userInfo.roletype = 'User'; await flushPromises()
  expect(w.vm.rows).toEqual([]); expect(w.vm.total).toBeNull(); expect(getAPI).toHaveBeenCalledTimes(1); w.unmount()
})
it('clears rows for authorization failure and rejects a mismatched provider response', async () => {
  getAPI.mockResolvedValueOnce(page()).mockRejectedValueOnce({ response: { status: 200, data: { listbucketsresponse: { errorcode: 431 } } } }).mockResolvedValueOnce(page('B'))
  const w = view(); await flushPromises(); await w.vm.load(); expect(w.vm.total).toBeNull(); expect(w.vm.rows).toEqual([]); await w.vm.load(); expect(w.vm.total).toBeNull(); expect(w.vm.error).toBe(true); w.unmount()
})
it('retains total counts across pages and resets the page on page-size changes', async () => {
  getAPI.mockResolvedValue(page('A', 3)); const w = view(); await flushPromises(); w.vm.changePage(1, 2); await flushPromises(); w.vm.changePage(2, 2); await flushPromises()
  expect(getAPI.mock.calls.slice(-1)[0][1]).toMatchObject({ page: 2, pagesize: 2 }); expect(w.vm.total).toBe(3); w.vm.changePage(2, 20); await flushPromises(); expect(w.vm.page).toBe(1); w.unmount()
})
it('does not label a malformed response as an empty store', async () => {
  getAPI.mockResolvedValue({}); const w = view(); await flushPromises(); expect(w.vm.error).toBe(true); expect(w.vm.total).toBeNull(); w.unmount()
})
it('selects by name but retains only the UUID and other query intersections in the URL', async () => {
  const s = store(); getAPI.mockResolvedValue({ listobjectstoragepoolsresponse: { count: 1, objectstore: [{ id: 'uuid', name: 'Glue Alpha' }] } }); const g = globalsFor(s); g.mocks.$route.query = { account: 'owner', domainid: 'domain', q: 'term', page: '3' }
  const w = mount(Picker, { global: g }); await flushPromises(); w.vm.change('uuid'); expect(g.mocks.$router.push).toHaveBeenCalledWith({ query: { account: 'owner', domainid: 'domain', q: 'term', page: '1', objectstorageid: 'uuid' } }); expect(w.text()).toContain('Glue Alpha'); w.unmount()
})
it('preserves the selected UUID on lookup failure and refreshes renamed display names without changing it', async () => {
  getAPI.mockResolvedValueOnce({ listobjectstoragepoolsresponse: { count: 1, objectstore: [{ id: 'uuid', name: 'old' }] } }).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ listobjectstoragepoolsresponse: { count: 1, objectstore: [{ id: 'uuid', name: 'renamed' }] } })
  const g = globalsFor(store()); g.mocks.$route.query = { objectstorageid: 'uuid' }; const w = mount(Picker, { global: g }); await flushPromises(); await w.vm.load(); expect(w.vm.error).toBe(true); expect(g.mocks.$route.query.objectstorageid).toBe('uuid'); expect(g.mocks.$router.push).not.toHaveBeenCalled(); await w.vm.load(); expect(w.vm.options[0].name).toBe('renamed'); w.unmount()
})
it('clears store selection after project scope changes', async () => {
  const s = store(); getAPI.mockResolvedValue({ listobjectstoragepoolsresponse: {} }); const g = globalsFor(s); g.mocks.$route.query = { objectstorageid: 'uuid', q: 'term' }; const w = mount(Picker, { global: g }); await flushPromises(); s.getters.project = { id: 'project' }; await flushPromises(); expect(g.mocks.$router.replace).toHaveBeenCalledWith({ query: { q: 'term', page: '1' } }); w.unmount()
})
const deletion = () => { const g = globalsFor(store()); g.stubs.ObjectStoreBuckets = { name: 'ObjectStoreBuckets', emits: ['state'], template: '<div />' }; return mount(Delete, { props: { resource: { id: 'A', name: 'alpha' } }, global: g }) }
it('requires a verified unfiltered empty lookup for the same Object Store before deletion', async () => {
  const w = deletion(); const child = w.findComponent({ name: 'ObjectStoreBuckets' })
  for (const state of [{ id: 'A', known: false, total: 0 }, { id: 'A', known: true, total: 4 }, { id: 'B', known: true, total: 0 }]) { child.vm.$emit('state', state); await flushPromises(); expect(w.vm.ready).toBe(false); await w.vm.remove() }
  expect(postAPI).not.toHaveBeenCalled(); child.vm.$emit('state', { id: 'A', known: true, total: 0 }); await flushPromises(); expect(w.vm.ready).toBe(true); w.unmount()
})
it('disables retry after a failed delete until a fresh dependency lookup and ignores late completion after navigation', async () => {
  postAPI.mockRejectedValueOnce(new Error('network')); const w = deletion(); w.vm.state = { id: 'A', known: true, total: 0 }; await w.vm.remove(); expect(w.vm.error).toBe(true); expect(w.vm.ready).toBeFalsy(); w.unmount()
  let resolveMutation; postAPI.mockImplementationOnce(() => new Promise(resolve => { resolveMutation = resolve })); const second = deletion(); second.vm.state = { id: 'A', known: true, total: 0 }; const work = second.vm.remove(); await second.setProps({ resource: { id: 'B' } }); resolveMutation({ deleteobjectstoragepoolresponse: { success: true } }); await work; expect(second.emitted('close-action')).toBeUndefined(); second.unmount()
})

it('formats the active Object Store chip by matching UUID without performing unauthorized lookups', async () => {
  getAPI.mockResolvedValue({ listobjectstoragepoolsresponse: { count: 1, objectstore: [{ id: 'uuid', name: 'Glue Alpha' }] } })
  const root = { $store: store() }; expect(await SearchFilter.methods.getDynamicFieldValue.call(root, 'objectstorageid', 'uuid')).toBe('Glue Alpha')
  expect(getAPI).toHaveBeenCalledWith('listObjectStoragePools', { id: 'uuid', ignoreproject: true }, { preserveOnFailure: true, timeout: 20000 })
  const restricted = store(); restricted.getters.userInfo.roletype = 'User'; expect(await SearchFilter.methods.getDynamicFieldValue.call({ $store: restricted }, 'objectstorageid', 'uuid')).toBe('uuid'); expect(getAPI).toHaveBeenCalledTimes(1)
})

it('keeps the Object Store UUID when a bookmarked project URL is handed off to the active project', async () => {
  const s = store(); getAPI.mockResolvedValue({ listobjectstoragepoolsresponse: {} }); const g = globalsFor(s); g.mocks.$route.query = { objectstorageid: 'uuid', projectid: 'project' }
  const w = mount(Picker, { global: g }); await flushPromises(); s.getters.project = { id: 'project' }; await flushPromises(); delete g.mocks.$route.query.projectid; await flushPromises()
  expect(g.mocks.$router.replace).not.toHaveBeenCalled(); expect(g.mocks.$route.query.objectstorageid).toBe('uuid'); w.unmount()
})

it('retains the UUID chip when its display-name lookup fails', async () => {
  getAPI.mockRejectedValue(new Error('offline'))
  expect(await SearchFilter.methods.getDynamicFieldValue.call({ $store: store() }, 'objectstorageid', 'uuid')).toBe('uuid')
})
