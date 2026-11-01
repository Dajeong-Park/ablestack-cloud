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
import { h, reactive } from 'vue'
import Browser from '@/components/view/ObjectStoreBrowser.vue'
import Status from '@/components/view/BucketUsageStatus.vue'
import { getAPI } from '@/api'
jest.mock('minio', () => ({ Client: jest.fn() }))
jest.mock('@/api', () => ({ getAPI: jest.fn(), postAPI: jest.fn() }))
const first = '2026-11-01T01:00:00Z'; const second = '2026-11-01T02:00:00Z'
const initial = () => ({ id: 'A', name: 'bucket-a', size: 4, usagelastupdated: first, usagelastattempt: first, usagestatus: 'Fresh', usagesource: 'Bucket' })
const Harness = { ...Browser, created () { this.objectListing = null; this.usageSyncPromise = null; this.objectStoreFetchGeneration = 0 }, render () { return h('div', this.records.map(row => h('span', row.name))) } }
describe('bucket usage collection is independent of files and identity scoped', () => {
  let wrapper, store, route, notifications
  beforeEach(() => {
    getAPI.mockReset()
    store = reactive({ getters: { apis: { syncBucketUsage: {}, listBuckets: {} }, userInfo: { id: 'user', roleid: 'role' }, project: {} }, state: { user: { token: 'session' } } })
    route = reactive({ path: '/buckets/A', params: { id: 'A' }, query: { tab: 'browser' } })
    notifications = { success: jest.fn(), error: jest.fn(), warning: jest.fn() }
    wrapper = mount(Harness, { props: { resource: initial(), resourceType: 'Bucket' }, global: { mocks: { $store: store, $route: route, $router: { replace: jest.fn() }, $t: key => key, $notification: notifications } } })
    wrapper.vm.records = [{ name: 'keep.txt', size: 4096 }]
    wrapper.vm.client = {}
  })
  afterEach(() => wrapper.unmount())
  test('success keeps KiB, adopts server timestamp and updates parent summary without listing again', async () => {
    getAPI.mockResolvedValue({ syncbucketusageresponse: { ...initial(), size: 8, usagelastupdated: second, usagelastattempt: second } })
    expect(await wrapper.vm.syncBucketUsage()).toBe(true)
    expect(wrapper.vm.bucketUsageSize).toBe(8)
    expect(wrapper.vm.usageSnapshot.usagelastupdated).toBe(second)
    expect(wrapper.vm.records).toHaveLength(1)
    expect(wrapper.emitted('change-resource')[0][0].size).toBe(8)
    expect(getAPI).toHaveBeenCalledTimes(1)
    expect(getAPI.mock.calls[0][2]).toMatchObject({ preserveOnFailure: true, timeout: 65000 })
  })
  test('overlapping manual clicks share the same request and do not clear files', async () => {
    let finish
    getAPI.mockImplementation(() => new Promise(resolve => { finish = resolve }))
    const one = wrapper.vm.syncBucketUsage(); const two = wrapper.vm.syncBucketUsage()
    expect(one).toBe(two); expect(getAPI).toHaveBeenCalledTimes(1)
    expect(wrapper.vm.usageSyncing).toBe(true); expect(wrapper.vm.records[0].name).toBe('keep.txt')
    finish({ syncbucketusageresponse: { ...initial(), usagelastupdated: second, usagelastattempt: second } })
    await one; expect(wrapper.vm.usageSyncing).toBe(false)
  })
  test('failed collection preserves value/files and reads persisted Error without a client timestamp', async () => {
    getAPI.mockImplementation(command => command === 'syncBucketUsage' ? Promise.reject(new Error('provider unavailable')) : Promise.resolve({ listbucketsresponse: { bucket: [{ ...initial(), usagestatus: 'Error', usagelastattempt: second }] } }))
    expect(await wrapper.vm.syncBucketUsage()).toBe(false)
    expect(wrapper.vm.bucketUsageSize).toBe(4); expect(wrapper.vm.records).toHaveLength(1)
    expect(wrapper.vm.usageSnapshot.usagelastupdated).toBe(first)
    expect(wrapper.vm.usageSnapshot.usagestatus).toBe('Error')
    expect(wrapper.vm.usageSyncError).toBeTruthy(); expect(wrapper.vm.usageSyncing).toBe(false)
    expect(notifications.error).not.toHaveBeenCalled()
  })
  test('retry recovers after both synchronization and failure-state reads failed', async () => {
    getAPI.mockRejectedValue(new Error('offline'))
    expect(await wrapper.vm.syncBucketUsage()).toBe(false); expect(wrapper.vm.bucketUsageSize).toBe(4)
    getAPI.mockResolvedValue({ syncbucketusageresponse: { ...initial(), size: 0, usagelastupdated: second, usagelastattempt: second } })
    expect(await wrapper.vm.syncBucketUsage()).toBe(true); expect(wrapper.vm.bucketUsageSize).toBe(0)
    expect(wrapper.vm.usageSyncError).toBe(''); expect(wrapper.vm.records).toHaveLength(1)
  })
  test('incomplete or foreign response cannot become zero usage', async () => {
    for (const response of [{ id: 'other', size: 0, usagelastupdated: second }, { id: 'A', size: -1, usagelastupdated: second }, { id: 'A', size: 0 }]) {
      getAPI.mockImplementation(command => Promise.resolve(command === 'syncBucketUsage' ? { syncbucketusageresponse: response } : {}))
      expect(await wrapper.vm.syncBucketUsage()).toBe(false); expect(wrapper.vm.bucketUsageSize).toBe(4)
    }
    expect(wrapper.emitted('change-resource')).toBeUndefined()
  })
  test('project transition discards late result and does not overwrite new scope', async () => {
    let finish
    getAPI.mockImplementation(() => new Promise(resolve => { finish = resolve }))
    const promise = wrapper.vm.syncBucketUsage(); store.getters.project = { id: 'another-project' }
    await flushPromises(); finish({ syncbucketusageresponse: { ...initial(), size: 99, usagelastupdated: second, usagelastattempt: second } })
    expect(await promise).toBe(false); expect(wrapper.emitted('change-resource')).toBeUndefined()
    expect(wrapper.vm.usageSyncing).toBe(false)
  })
  test('revoked permission invalidates an in-flight response and blocks new requests', async () => {
    let finish
    getAPI.mockImplementation(() => new Promise(resolve => { finish = resolve }))
    const promise = wrapper.vm.syncBucketUsage(); store.getters.apis = { listBuckets: {} }
    await flushPromises(); finish({ syncbucketusageresponse: { ...initial(), size: 99, usagelastupdated: second } })
    expect(await promise).toBe(false); expect(await wrapper.vm.syncBucketUsage()).toBe(false)
    expect(getAPI).toHaveBeenCalledTimes(1); expect(wrapper.emitted('change-resource')).toBeUndefined()
  })
  test('object success is not converted into object failure when usage collection fails', async () => {
    getAPI.mockRejectedValue(new Error('offline'))
    expect(await wrapper.vm.syncBucketUsage('mutation')).toBe(false)
    expect(notifications.warning).toHaveBeenCalledWith(expect.objectContaining({ message: 'message.bucket.usage.object.completed' }))
    expect(notifications.error).not.toHaveBeenCalled(); expect(wrapper.vm.records).toHaveLength(1)
  })
  test('older parent response cannot overwrite newer server telemetry', async () => {
    wrapper.vm.adoptUsage({ ...initial(), size: 8, usagelastupdated: second, usagelastattempt: second })
    await wrapper.setProps({ resource: initial() })
    expect(wrapper.vm.bucketUsageSize).toBe(8)
    expect(wrapper.emitted('change-resource').slice(-1)[0][0].usagelastupdated).toBe(second)
    wrapper.vm.adoptUsage({ ...initial(), size: 12, usagelastattemptms: Date.parse(second) + 900, usagelastattempt: second })
    wrapper.vm.adoptUsage({ ...initial(), size: 8, usagelastattemptms: Date.parse(second) + 100, usagelastattempt: second })
    expect(wrapper.vm.bucketUsageSize).toBe(12)
  })
  test('no synchronization permission sends no mutation request', async () => {
    store.getters.apis = {}; await flushPromises()
    expect(await wrapper.vm.syncBucketUsage()).toBe(false); expect(getAPI).not.toHaveBeenCalled()
  })
})
test('usage display marks legacy unknown and renders the server collection timestamp', async () => {
  const wrapper = mount(Status, { props: { resource: { size: 0 } }, global: { mocks: { $t: key => key, $toLocaleDate: value => 'SERVER:' + value } } })
  expect(wrapper.text()).toContain('label.bucket.usage.unknown')
  await wrapper.setProps({ resource: initial() })
  expect(wrapper.text()).toContain('SERVER:' + first)
  wrapper.unmount()
})
