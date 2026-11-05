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
import Deletion from '@/views/storage/BucketDeletion'
import Versions from '@/views/storage/BucketVersions'
import { postAPI } from '@/api'
jest.mock('@/api', () => ({ postAPI: jest.fn() }))
let view, store
const impact = (extra = {}) => ({ complete: true, exists: true, externalid: 'external', currentobjects: 0, versioncount: 0, deletemarkers: 0, ...extra })
const reply = (command, data) => ({ [command.toLowerCase() + 'response']: { bucketoperation: data } })
const open = async (purge = false, component = Deletion, attached = false) => {
  store = reactive({ getters: { apis: { manageBucketObjectVersion: {} }, project: { id: 'project' } }, state: { user: { token: 'token' } } })
  view = mount(component, {
    attachTo: attached ? document.body : undefined,
    props: { resource: { id: 'bucket', name: 'qa-bucket' }, purge },
    global: {
      mocks: {
        $store: store, $route: reactive({ path: '/buckets/bucket', query: { tab: component === Versions ? 'versions' : 'details' } }), $t: key => key, $toLocaleDate: String, $notification: { success: jest.fn() }
      }
    }
  })
  await flushPromises()
}
beforeEach(() => { postAPI.mockReset(); postAPI.mockResolvedValue(reply('getBucketDeletionImpact', impact())) })
afterEach(() => { if (view) view.unmount(); view = null; jest.useRealTimers(); jest.restoreAllMocks() })
it('ordinary deletion is enabled only by a complete verified empty impact', async () => {
  postAPI.mockResolvedValueOnce(reply('getBucketDeletionImpact', impact({ versioncount: 1 })))
  await open(); expect(view.vm.canDelete).toBe(false)
  await view.vm.remove(); expect(postAPI).toHaveBeenCalledTimes(1)
  postAPI.mockResolvedValueOnce(reply('getBucketDeletionImpact', impact({ complete: false })))
  await view.vm.load(); expect(view.vm.canDelete).toBe(false)
  postAPI.mockResolvedValueOnce(reply('getBucketDeletionImpact', impact()))
  await view.vm.load(); expect(view.vm.canDelete).toBe(true)
})
it('impact failure does not mean empty and never submits delete', async () => {
  postAPI.mockRejectedValue(new Error('provider failed'))
  await open(); expect(view.vm.canDelete).toBeFalsy(); await view.vm.remove()
  expect(postAPI.mock.calls.some(([name]) => name === 'deleteBucket')).toBe(false)
  expect(view.vm.error).toBe('message.bucket.delete.inspect.failed')
})
it('purge requires exact name, version consent and irreversible acknowledgement', async () => {
  await open(true); expect(view.vm.canPurge).toBeFalsy()
  view.vm.confirmation = 'qa-bucket'; view.vm.includeVersions = true; expect(view.vm.canPurge).toBeFalsy()
  view.vm.acknowledged = true; expect(view.vm.canPurge).toBe(true)
  view.vm.impact.blockedreason = 'OBJECT_LOCK_ENABLED'; expect(view.vm.canPurge).toBe(false)
})
it('normal deletion calls only deleteBucket and never invokes purge', async () => {
  await open(); postAPI.mockResolvedValueOnce({ deletebucketresponse: { success: true } })
  await view.vm.remove(); expect(postAPI).toHaveBeenCalledWith('deleteBucket', { id: 'bucket' }, { preserveOnFailure: true })
  expect(postAPI.mock.calls.some(([name]) => name === 'purgeBucket')).toBe(false)
})
it('DB recovery after external removal keeps the same durable operation ID and requires consent', async () => {
  postAPI.mockResolvedValueOnce(reply('getBucketDeletionImpact', impact({ exists: false, blockedreason: 'PURGE_RUNNING', operationid: 'same-op' })))
  postAPI.mockResolvedValueOnce(reply('getBucketPurgeStatus', { operationid: 'same-op', state: 'NeedsReconcile', deletedcount: 1010, progressknown: false }))
  await open(true); view.vm.confirmation = 'qa-bucket'; view.vm.includeVersions = true; view.vm.acknowledged = true
  expect(view.vm.canPurge).toBe(true)
  postAPI.mockResolvedValueOnce(reply('purgeBucket', { operationid: 'same-op', state: 'Prepared' }))
  postAPI.mockResolvedValueOnce(reply('getBucketPurgeStatus', { operationid: 'same-op', state: 'Succeeded', progressknown: false }))
  await view.vm.start()
  expect(postAPI).toHaveBeenCalledWith('purgeBucket', expect.objectContaining({ id: 'bucket', operationid: 'same-op', confirmname: 'qa-bucket', includeversions: true, retry: true }), { preserveOnFailure: true })
  expect(view.vm.finished).toBe(true); expect(view.vm.acknowledged).toBe(false)
})
it('late impact response cannot revive a dialog after context change', async () => {
  let finish; postAPI.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  await open(); store.state.user.token = 'other'; await flushPromises()
  finish(reply('getBucketDeletionImpact', impact())); await flushPromises()
  expect(view.vm.impact).toBeNull(); expect(view.emitted('close-action')).toBeTruthy()
})
it('version pages use both continuation markers without pretending to know a total', async () => {
  postAPI.mockResolvedValueOnce(reply('listBucketObjectVersions', { versions: [{ key: 'x', versionid: 'v1' }], istruncated: true, nextkeymarker: 'x', nextversionidmarker: 'v1' }))
  await open(false, Versions)
  postAPI.mockResolvedValueOnce(reply('listBucketObjectVersions', { versions: [], istruncated: false }))
  view.vm.next(); await flushPromises()
  expect(postAPI).toHaveBeenLastCalledWith('listBucketObjectVersions', { id: 'bucket', limit: 100, keymarker: 'x', versionidmarker: 'v1' }, { preserveOnFailure: true })
  expect(view.vm.history).toHaveLength(1)
})
it('version mutation always carries the exact version ID and a selected explicit action', async () => {
  postAPI.mockResolvedValueOnce(reply('listBucketObjectVersions', { versions: [] })); await open(false, Versions)
  view.vm.select({ key: 'nested/file', versionid: 'old' }, 'restore')
  postAPI.mockResolvedValueOnce(reply('manageBucketObjectVersion', { state: 'Succeeded' }))
  postAPI.mockResolvedValueOnce(reply('listBucketObjectVersions', { versions: [] }))
  await view.vm.execute()
  expect(postAPI).toHaveBeenCalledWith('manageBucketObjectVersion', { id: 'bucket', key: 'nested/file', versionid: 'old', action: 'restore' }, { preserveOnFailure: true })
  expect(view.vm.selected).toBeNull()
})
it('version mutations are disabled while an explicit purge owns the bucket', async () => {
  postAPI.mockResolvedValueOnce(reply('listBucketObjectVersions', { versions: [] })); await open(false, Versions)
  await view.setProps({ resource: { id: 'bucket', name: 'qa-bucket', quotaoperationtype: 'PURGE', quotaoperationstate: 'Prepared' } })
  expect(view.vm.canManage).toBe(false)
})

it('version menu skips disabled actions, navigates with arrows and restores the trigger on Escape', async () => {
  jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ width: 140, height: 100, top: 0, left: 0, right: 140, bottom: 100 })
  postAPI.mockResolvedValueOnce(reply('listBucketObjectVersions', { versions: [{ key: 'marker.txt', versionid: 'marker-v1', deletemarker: true, islatest: true }] }))
  await open(false, Versions, true); store.getters.apis.getBucketObjectMetadata = {}; await flushPromises()
  const trigger = view.find('.bucket-version-actions'); trigger.element.focus(); await trigger.trigger('click'); await flushPromises()
  await new Promise(resolve => window.requestAnimationFrame(() => window.requestAnimationFrame(() => window.requestAnimationFrame(resolve))))
  await flushPromises()
  expect(document.activeElement.textContent).toBe('label.bucket.marker.remove')
  document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
  expect(document.activeElement.textContent).toBe('label.bucket.version.delete')
  document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
  expect(document.activeElement.textContent).toBe('label.bucket.marker.remove')
  document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await flushPromises()
  expect(trigger.attributes('aria-expanded')).toBe('false'); expect(document.activeElement).toBe(trigger.element)
  expect(postAPI).toHaveBeenCalledTimes(1)
})
it('keyboard menu selection opens confirmation for the exact historical version without mutating it', async () => {
  jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ width: 140, height: 100, top: 0, left: 0, right: 140, bottom: 100 })
  postAPI.mockResolvedValueOnce(reply('listBucketObjectVersions', { versions: [{ key: 'object.txt', versionid: 'old-version', deletemarker: false, islatest: false }] }))
  await open(false, Versions, true); store.getters.apis.getBucketObjectMetadata = {}; await flushPromises()
  const trigger = view.find('.bucket-version-actions'); trigger.element.focus(); await trigger.trigger('click'); await flushPromises()
  await new Promise(resolve => window.requestAnimationFrame(() => window.requestAnimationFrame(() => window.requestAnimationFrame(resolve))))
  await flushPromises()
  expect(document.activeElement.textContent).toBe('label.bucket.object.metadata')
  document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
  expect(document.activeElement.textContent).toBe('label.bucket.version.restore')
  document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true })); await flushPromises()
  expect(view.vm.selected).toMatchObject({ key: 'object.txt', versionid: 'old-version' }); expect(view.vm.action).toBe('restore')
  expect(view.vm.actionMenuKey).toBeNull(); expect(postAPI).toHaveBeenCalledTimes(1)
})
