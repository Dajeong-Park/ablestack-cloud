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
import Create from '@/views/storage/CreateBucket'
import { bucketStoreOptions, filterBucketStoreOption, normalizeBucketStoreSearch } from '@/utils/bucketStoreSelection'
jest.mock('@/api', () => ({ getAPI: jest.fn(), postAPI: jest.fn() }))
const row = (id, name = 'Glue Store', capabilities = {}) => ({ id, name, capabilities })
const page = (rows, count = rows.length) => ({ listobjectstoragepoolsresponse: { count, objectstore: rows } })
const state = () => reactive({ state: { user: { token: 'session' } }, getters: { userInfo: { id: 'user', account: 'self', domainid: 'd', roleid: 'role', roletype: 'User' }, project: {}, apis: { listObjectStoragePools: {}, createBucket: {} } } })
const create = s => mount(Create, {
  props: { resource: {} },
  global: {
    mocks: { $store: s, $t: k => k, $notifyError: jest.fn(), $pollJob: jest.fn() },
    stubs: {
      'a-form': { methods: { validate: () => Promise.resolve() }, template: '<form><slot/></form>' },
      'a-form-item': { template: '<div><slot/></div>' },
      'a-spin': { template: '<div><slot/></div>' },
      'a-alert': { props: ['message'], template: '<section>{{ message }}<slot name="description"/></section>' },
      'a-button': { props: ['disabled', 'loading'], template: '<button :disabled="disabled || loading"><slot name="icon"/><slot/></button>' },
      'a-select': { props: ['disabled', 'value'], template: '<select :disabled="disabled"><slot/></select>' },
      'a-select-option': { props: ['value'], template: '<option :value="value"><slot/></option>' },
      'router-link': { props: ['to'], template: '<a :href="to"><slot/></a>' },
      'a-input': true,
      'a-switch': true,
      ReloadOutlined: true,
      OwnershipSelection: true,
      BucketOwnerContext: true,
      BucketQuotaContext: true,
      BucketProtectionCapabilities: true
    }
  }
})
beforeEach(() => { jest.clearAllMocks(); getAPI.mockResolvedValue(page([row('A'), row('B')])); postAPI.mockResolvedValue({ createbucketresponse: { jobid: 'job' } }) })
test.each(['glue', 'GLUE', ' Glue   Store ', 'ＡＢＣ', '한글 저장소', '', null, 123])('normalizes safe search %p', query => {
  const label = query === 'ＡＢＣ' ? 'ABC' : query === '한글 저장소' ? '한글  저장소' : query === 123 ? 123 : 'Glue Store'
  expect(filterBucketStoreOption(query, { label, value: 'uuid' })).toBe(true)
})
it('supports UUID independently of duplicated names and handles absent or numeric values', () => {
  expect(filterBucketStoreOption('uuid-b', { label: 'same name', value: 'UUID-B' })).toBe(true)
  expect(filterBucketStoreOption('none', { label: null, value: 123 })).toBe(false)
  expect(filterBucketStoreOption('123', { label: null, value: 123 })).toBe(true)
  expect(filterBucketStoreOption('x', null)).toBe(false)
  expect(normalizeBucketStoreSearch('  한글\t 저장소  ')).toBe('한글 저장소')
})
it('loads all pages without collapsing equal names or retaining unrelated store details', async () => {
  const first = Array.from({ length: 500 }, (_, n) => row('id-' + n, 'same'))
  const api = jest.fn().mockResolvedValueOnce(page(first, 501)).mockResolvedValueOnce(page([{ ...row('last', 'same'), details: { private: 'example' } }], 501))
  const rows = await bucketStoreOptions(api); expect(rows).toHaveLength(501); expect(rows[500]).toEqual(row('last', 'same')); expect(api.mock.calls[1][1]).toEqual({ page: 2, pagesize: 500, ignoreproject: true })
})
it('treats only a successful empty envelope as no stores', async () => {
  expect(await bucketStoreOptions(jest.fn().mockResolvedValue({ listobjectstoragepoolsresponse: {} }))).toEqual([])
  for (const value of [{}, page([], 2), page([row('A'), row('A')]), page([{ name: 'missing id' }]), page([], null), { listobjectstoragepoolsresponse: { count: 0, objectstore: null } }, { listobjectstoragepoolsresponse: [] }]) await expect(bucketStoreOptions(jest.fn().mockResolvedValue(value))).rejects.toThrow()
})
it('selects a default only after the initial successful lookup and keeps UUID on reorder or rename', async () => {
  const w = create(state()); await flushPromises(); expect(w.vm.form.objectstore).toBe('A'); expect(w.vm.storeReady).toBe(true)
  w.vm.storeChanged('B'); getAPI.mockResolvedValue(page([row('B', 'renamed'), row('A')])); await w.vm.listObjectStores()
  expect(w.vm.form.objectstore).toBe('B'); expect(w.vm.selectedStoreName).toBe('renamed'); w.unmount()
})
it('clears a deleted choice and never replaces it with the first option on later refresh', async () => {
  const w = create(state()); await flushPromises(); w.vm.storeChanged('B'); getAPI.mockResolvedValue(page([row('A')])); await w.vm.listObjectStores()
  expect(w.vm.form.objectstore).toBeUndefined(); expect(w.vm.storeReady).toBe(false); expect(w.vm.storeSelectionRemoved).toBe(true)
  await w.vm.listObjectStores(); expect(w.vm.form.objectstore).toBeUndefined(); w.vm.storeChanged('A'); expect(w.vm.storeSelectionRemoved).toBe(false); w.unmount()
})
it('blocks refresh failure while retaining the draft UUID and restores it only after a complete retry', async () => {
  const w = create(state()); await flushPromises(); w.vm.storeChanged('B'); w.vm.form.name = 'draft'; w.vm.form.quota = '1'
  getAPI.mockRejectedValueOnce(new Error('offline')); await w.vm.listObjectStores(); expect(w.vm.storeStatus).toBe('error'); expect(w.vm.storeReady).toBe(false); expect(w.vm.form.objectstore).toBe('B'); expect(w.text()).toContain('message.bucket.stores.failed')
  await w.vm.handleSubmit(); expect(postAPI).not.toHaveBeenCalled(); await w.vm.listObjectStores(); expect(w.vm.storeReady).toBe(true); expect(w.vm.form.objectstore).toBe('B'); expect(w.vm.form.name).toBe('draft'); w.unmount()
})
it('blocks initial pending lookup, discards an older refresh and preserves the latest selection', async () => {
  let finish; getAPI.mockImplementationOnce(() => new Promise(resolve => { finish = resolve })); const w = create(state()); expect(w.vm.storesLoading).toBe(true); await w.vm.handleSubmit(); expect(postAPI).not.toHaveBeenCalled()
  getAPI.mockResolvedValue(page([row('new')])); await w.vm.listObjectStores(); finish(page([row('old')])); await flushPromises(); expect(w.vm.form.objectstore).toBe('new'); expect(w.vm.objectstores.map(v => v.id)).toEqual(['new']); w.unmount()
})
it('shows empty separately from errors and offers registration only to a permitted administrator', async () => {
  getAPI.mockResolvedValue(page([])); const s = state(); s.getters.apis.addObjectStoragePool = {}; let w = create(s); await flushPromises(); expect(w.text()).toContain('message.bucket.stores.empty'); expect(w.find('a').exists()).toBe(false); expect(w.vm.storeReady).toBe(false); w.unmount()
  s.getters.userInfo.roletype = 'Admin'; w = create(s); await flushPromises(); expect(w.find('a').attributes('href')).toBe('/objectstore'); w.unmount()
  delete s.getters.apis.addObjectStoragePool; w = create(s); await flushPromises(); expect(w.find('a').exists()).toBe(false); w.unmount()
})
it('does not silently select newly registered storage after a previously empty list', async () => {
  getAPI.mockResolvedValue(page([])); const w = create(state()); await flushPromises(); getAPI.mockResolvedValue(page([row('A')])); await w.vm.listObjectStores(); expect(w.vm.form.objectstore).toBeUndefined(); expect(w.vm.storeReady).toBe(false); w.unmount()
})
it('discards delayed lookup after project, permission or session changes', async () => {
  for (const change of [s => { s.getters.project = { id: 'project', state: 'Active' } }, s => { delete s.getters.apis.listObjectStoragePools }, s => { s.state.user.token = 'other' }]) {
    let finish; getAPI.mockImplementationOnce(() => new Promise(resolve => { finish = resolve })); const s = state(); const w = create(s); change(s); await flushPromises(); finish(page([row('old')])); await flushPromises(); expect(w.vm.objectstores).toEqual([]); expect(w.vm.disposed).toBe(true); expect(w.emitted('close-action')).toHaveLength(1); w.unmount()
  }
})
it('cannot submit an unknown UUID and recomputes protection flags when store capability changes', async () => {
  const w = create(state()); await flushPromises(); w.vm.form.name = 'bucket'; w.vm.form.quota = '1'; w.vm.form.objectstore = 'unknown'; await w.vm.handleSubmit(); expect(postAPI).not.toHaveBeenCalled()
  w.vm.form.encryption = true; w.vm.form.versioning = true; w.vm.form.objectlocking = true; getAPI.mockResolvedValue(page([row('A', 'Glue', { encryption: 'Unsupported', versioning: 'Supported', objectlocking: 'Unsupported' })])); w.vm.form.objectstore = 'A'; await w.vm.listObjectStores()
  expect(w.vm.form.encryption).toBe(false); expect(w.vm.form.versioning).toBe(true); expect(w.vm.form.objectlocking).toBe(false); w.unmount()
})
it('does not perform a forbidden lookup when its API capability is absent', async () => {
  const s = state(); delete s.getters.apis.listObjectStoragePools; const w = create(s); await flushPromises(); expect(getAPI).not.toHaveBeenCalled(); expect(w.vm.storeStatus).toBe('error'); expect(w.vm.storeReady).toBe(false); w.unmount()
})
