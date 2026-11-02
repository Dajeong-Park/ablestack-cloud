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
import Panel from '@/components/view/BucketObjectMetadata'
import Browser from '@/components/view/ObjectStoreBrowser'
import Versions from '@/views/storage/BucketVersions'
import { postAPI } from '@/api'
jest.mock('@/api', () => ({ getAPI: jest.fn(), postAPI: jest.fn() }))
jest.mock('minio', () => ({ Client: jest.fn() }))
const value = (key = '한글 공백 + %2F.txt', extra = {}) => ({ key, sizebytes: 5, lastmodified: '2026-11-01T01:00:00Z', checked: '2026-11-01T02:00:00Z', etag: 'abcd', contenttype: 'text/plain; charset=utf-8', metadata: { note: '<img src=x onerror=alert(1)>' }, status: 'Available', ...extra })
const reply = data => ({ getbucketobjectmetadataresponse: { objectmetadata: data } })
let wrapper, store, route
const open = async (props = {}) => {
  store = reactive({ getters: { apis: { getBucketObjectMetadata: {} }, userInfo: { id: 'user', roleid: 'role' }, project: {} }, state: { user: { token: 'session' } } })
  route = reactive({ path: '/buckets/A' })
  wrapper = mount(Panel, { props: { resource: { id: 'A', url: 'registered-endpoint', credentialrevision: 1 }, objectKey: '한글 공백 + %2F.txt', active: true, ...props }, global: { mocks: { $store: store, $route: route, $t: key => key, $toLocaleDate: String } } })
  await flushPromises(); return wrapper
}
beforeEach(() => { postAPI.mockReset(); postAPI.mockResolvedValue(reply(value())) })
afterEach(() => { if (wrapper) wrapper.unmount(); wrapper = null; jest.useRealTimers(); jest.restoreAllMocks() })
it('only selected object uses exact POST key; HTML metadata is rendered as text', async () => {
  await open(); expect(postAPI).toHaveBeenCalledTimes(1)
  expect(postAPI.mock.calls[0]).toEqual(['getBucketObjectMetadata', { id: 'A', objectkey: '한글 공백 + %2F.txt' }, { preserveOnFailure: true, timeout: 35000 }])
  expect(wrapper.text()).toContain('<img src=x onerror=alert(1)>'); expect(wrapper.find('img').exists()).toBe(false)
  expect(wrapper.text()).toContain('5 label.bucket.object.metadata.bytes'); expect(wrapper.text()).toContain('abcd'); expect(wrapper.text()).toContain('text/plain; charset=utf-8')
})
it('inactive detail makes no request and does not prefetch row metadata', async () => { await open({ active: false }); expect(postAPI).not.toHaveBeenCalled(); expect(wrapper.vm.status).toBe('Idle') })
it('zero-byte object and genuinely empty metadata are explicit success', async () => {
  postAPI.mockResolvedValue(reply(value(undefined, { sizebytes: 0, metadata: {} }))); await open()
  expect(wrapper.vm.status).toBe('Available'); expect(wrapper.text()).toContain('0 label.bucket.object.metadata.bytes'); expect(wrapper.text()).toContain('message.bucket.object.metadata.empty')
})
it.each(['NotFound', 'Forbidden', 'Timeout', 'Unavailable', 'Unsupported'])('distinguishes %s from empty metadata', async status => {
  postAPI.mockResolvedValue(reply(value(undefined, { status, metadata: undefined }))); await open()
  expect(wrapper.vm.status).toBe(status); expect(wrapper.text()).toContain('message.bucket.object.metadata.' + status.toLowerCase()); expect(wrapper.text()).not.toContain('message.bucket.object.metadata.empty'); expect(wrapper.vm.canRetry).toBe(status !== 'Unsupported')
})
it('failed lookup can retry without any file operation or listing reset', async () => {
  postAPI.mockRejectedValueOnce(new Error('offline')); await open(); expect(wrapper.vm.status).toBe('Unavailable')
  await wrapper.vm.load(true); expect(wrapper.vm.status).toBe('Available'); expect(postAPI.mock.calls.map(([name]) => name)).toEqual(['getBucketObjectMetadata', 'getBucketObjectMetadata'])
})
it('exact selected version and null-version string reach HEAD', async () => {
  postAPI.mockResolvedValue(reply(value(undefined, { versionid: 'null' }))); await open({ versionId: 'null' }); expect(postAPI.mock.calls[0][1].versionid).toBe('null'); expect(wrapper.vm.result.versionid).toBe('null')
})
it('overlapping retry clicks share one request', async () => {
  await open({ active: false }); let finish; postAPI.mockImplementation(() => new Promise(resolve => { finish = resolve }))
  await wrapper.setProps({ active: true }); const one = wrapper.vm.load(true); const two = wrapper.vm.load(true); expect(one).toBe(two); expect(postAPI).toHaveBeenCalledTimes(1)
  finish(reply(value())); await one; expect(wrapper.vm.loading).toBe(false)
})
it('late previous-object result cannot overwrite the newly selected object', async () => {
  let finish; postAPI.mockImplementationOnce(() => new Promise(resolve => { finish = resolve })); await open()
  postAPI.mockResolvedValue(reply(value('second.txt'))); await wrapper.setProps({ objectKey: 'second.txt' }); await flushPromises(); finish(reply(value())); await flushPromises()
  expect(wrapper.vm.result.key).toBe('second.txt'); expect(wrapper.vm.loading).toBe(false)
})
it.each(['project', 'session', 'permission', 'bucket', 'unmount'])('discards late result after %s change', async change => {
  let finish; postAPI.mockImplementation(() => new Promise(resolve => { finish = resolve })); await open(); const first = finish
  if (change === 'project') store.getters.project = { id: 'project-b' }
  if (change === 'session') store.state.user.token = 'other-session'
  if (change === 'permission') delete store.getters.apis.getBucketObjectMetadata
  if (change === 'bucket') await wrapper.setProps({ resource: { id: 'B' } })
  if (change === 'unmount') wrapper.unmount()
  await flushPromises(); first(reply(value())); await flushPromises(); expect(wrapper.vm.result).toBeNull()
})
it('successful cache is short, scope isolated, and invalidated by mutations', async () => {
  const clock = jest.spyOn(Date, 'now').mockReturnValue(100000); await open(); expect(postAPI).toHaveBeenCalledTimes(1)
  await wrapper.setProps({ active: false }); await wrapper.setProps({ active: true }); await flushPromises(); expect(postAPI).toHaveBeenCalledTimes(1)
  clock.mockReturnValue(111000); await wrapper.setProps({ active: false }); await wrapper.setProps({ active: true }); await flushPromises(); expect(postAPI).toHaveBeenCalledTimes(2)
  await wrapper.setProps({ revision: 1 }); await flushPromises(); expect(postAPI).toHaveBeenCalledTimes(3)
  store.getters.project = { id: 'different' }; await flushPromises(); expect(postAPI).toHaveBeenCalledTimes(4)
})
it('cache is bypassed by explicit refresh and errors are not cached', async () => {
  await open(); await wrapper.vm.load(true); expect(postAPI).toHaveBeenCalledTimes(2)
  postAPI.mockResolvedValue(reply(value(undefined, { status: 'NotFound' }))); await wrapper.vm.load(true)
  await wrapper.setProps({ active: false }); await wrapper.setProps({ active: true }); await flushPromises(); expect(wrapper.vm.status).toBe('NotFound')
})
it('mismatched and incomplete responses do not become success or zero', async () => {
  for (const data of [value('other'), value(undefined, { metadata: null }), value(undefined, { sizebytes: -1 }), value(undefined, { sizebytes: undefined }), value(undefined, { metadata: { note: {} } })]) {
    postAPI.mockResolvedValue(reply(data)); await open(); expect(wrapper.vm.status).toBe('Unavailable'); expect(wrapper.vm.result).toBeNull(); wrapper.unmount(); wrapper = null
  }
})
it('folder prefix opens no metadata detail, and versions expose a dedicated metadata action', () => {
  const vm = { clearPresignedUrl: jest.fn(), objectListScopeChanged: false }
  Browser.methods.showObjectDescription.call(vm, { prefix: 'folder/' }); expect(vm.clearPresignedUrl).not.toHaveBeenCalled()
  expect(Versions.components.BucketObjectMetadata).toBe(Panel)
})

it('unsupported provider keeps separately labelled listing basics without claiming user metadata is empty', async () => {
  postAPI.mockResolvedValue(reply(value(undefined, { status: 'Unsupported', metadata: undefined })))
  await open({ listing: { size: 9, lastModified: '2026-11-01' } })
  expect(wrapper.text()).toContain('label.bucket.object.metadata.listingsize')
  expect(wrapper.text()).toContain('9 label.bucket.object.metadata.bytes')
  expect(wrapper.text()).not.toContain('message.bucket.object.metadata.empty')
})

it('switching tabs closes the browser detail without focusing a hidden trigger', async () => {
  const focus = jest.fn()
  const browserRoute = reactive({ path: '/buckets/A', params: { id: 'A' }, query: { tab: 'browser' } })
  const Harness = { ...Browser, created () {}, render () { return h('div') } }
  wrapper = mount(Harness, { props: { resource: { id: 'A', name: 'bucket' }, resourceType: 'Bucket' }, global: { mocks: { $store: { getters: { apis: {}, project: {}, userInfo: {} }, state: { user: {} } }, $route: browserRoute, $t: key => key } } })
  wrapper.vm.showObjectDetails = true; wrapper.vm.objectDetailsTrigger = { isConnected: true, focus }
  browserRoute.query.tab = 'versions'; await flushPromises()
  expect(wrapper.vm.showObjectDetails).toBe(false); expect(focus).not.toHaveBeenCalled()
})
it('switching away from versions clears the selected version metadata', async () => {
  const versionRoute = reactive({ path: '/buckets/A', query: { tab: 'versions' } })
  const Harness = { ...Versions, created () { this.generation = 0 }, render () { return h('div') } }
  wrapper = mount(Harness, { props: { resource: { id: 'A' } }, global: { mocks: { $store: { getters: { apis: {}, project: {} }, state: { user: {} } }, $route: versionRoute, $t: key => key } } })
  wrapper.vm.metadataObject = { key: 'object', versionid: 'old' }
  versionRoute.query.tab = 'browser'; await flushPromises()
  expect(wrapper.vm.metadataObject).toBeNull(); expect(wrapper.vm.metadataRevision).toBeGreaterThan(0)
})

it.each(['NotFound', 'Forbidden', 'Timeout', 'Unavailable'])('renders a usable retry button for %s with the installed Ant Design Vue components', async status => {
  postAPI.mockResolvedValueOnce(reply(value(undefined, { status, metadata: undefined })))
  await open()
  const retry = wrapper.findAll('button').find(button => button.text().trim() === 'label.retry')
  expect(retry).toBeDefined()
  await retry.trigger('click'); await flushPromises()
  expect(wrapper.vm.status).toBe('Available'); expect(postAPI).toHaveBeenCalledTimes(2)
})
