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

/* global BigInt */
import { mount, flushPromises } from '@vue/test-utils'
import { reactive } from 'vue'
import Edit from '@/views/infra/EditObjectStorage'
import Details from '@/views/infra/ObjectStoreDetails'
import { postAPI } from '@/api'
import { exactBytes, initialGiB, capacityError, formatBytes, capacityPercent, validEndpoint } from '@/utils/objectStoreCapacity'
jest.mock('@/api', () => ({ postAPI: jest.fn() }))
const resource = extra => ({ id: 'a', name: 'store-A', url: 'http://glue:3333', connectionrevision: 'r1', storagetotal: 21474836480, storagetotalbytes: '21474836480', storageallocatedbytes: '2147483648', storagereservedbytes: '1073741824', storageusedbytes: '0', storageusedknown: false, capacitytracking: 'Enabled', usagestatus: 'Unknown', ...extra })
let view, store, route, refresh, notification
const open = async (component = Edit, extra = {}) => {
  store = reactive({ getters: { userInfo: { id: 'root', roleid: 'admin', roletype: 'Admin' }, apis: { updateObjectStoragePool: {}, checkObjectStoragePool: {}, listBuckets: {} }, project: {} }, state: { user: { token: 'token' } } })
  route = reactive({ path: '/objectstore/a', query: { tab: 'details' } }); refresh = jest.fn(); notification = { success: jest.fn() }
  view = mount(component, { props: { resource: resource(extra) }, global: { stubs: { DetailsTab: true, RouterLink: true }, provide: { parentFetchData: refresh }, mocks: { $store: store, $route: route, $t: key => key, $toLocaleDate: String, $notification: notification } } })
  await flushPromises()
}
const reply = (status = 'Connected', reason = 'Verified', extra = {}) => ({ checkobjectstoragepoolresponse: { objectstoreconnection: { id: 'a', connectionrevision: 'r1', status, reason, checked: '2026-11-01T12:00:00Z', ...extra } } })
beforeEach(() => { postAPI.mockReset() })
afterEach(() => { if (view) view.unmount(); view = null })
it('initializes 20GiB exactly and submits only a changed name', async () => {
  await open(); expect(view.find('#store-edit-size').element.value).toBe('20')
  await view.find('#store-edit-name').setValue('renamed'); postAPI.mockResolvedValue({})
  await view.findAll('button').find(b => b.text() === 'label.save').trigger('click'); await flushPromises()
  expect(postAPI).toHaveBeenCalledWith('updateObjectStoragePool', { id: 'a', name: 'renamed' }, expect.any(Object)); expect(refresh).toHaveBeenCalledTimes(1)
})
it.each(['-1', '1.5', '1e3', '8589934592', '', '2'])('blocks invalid or undercommitted GiB %s', async size => {
  await open(); await view.find('#store-edit-size').setValue(size); expect(view.vm.canSubmit).toBe(false); await view.vm.submit(); expect(postAPI).not.toHaveBeenCalled()
})
it('permits explicit zero and preserves legacy bytes on a name-only update', async () => {
  await open(Edit, { storagetotalbytes: '536870913' }); expect(view.vm.legacy).toBe(true); expect(view.vm.size).toBe('')
  await view.find('#store-edit-name').setValue('legacy-name'); postAPI.mockResolvedValue({}); await view.vm.submit(); expect(postAPI.mock.calls[0][1]).toEqual({ id: 'a', name: 'legacy-name' })
  await view.find('#store-edit-size').setValue('0'); expect(view.vm.changes.size).toBe('0'); expect(view.vm.sizeError).toBe('')
})
it('retains all draft values on candidate failure and retries without clearing the form', async () => {
  await open(); await view.find('#store-edit-url').setValue('http://candidate:3333'); await view.find('#store-edit-size').setValue('30')
  postAPI.mockRejectedValueOnce(new Error('raw private diagnostics')); await view.vm.submit(); expect(view.vm.failed).toBe(true); expect(view.vm.url).toBe('http://candidate:3333'); expect(view.vm.size).toBe('30'); expect(view.text()).not.toContain('raw private')
  postAPI.mockResolvedValueOnce({}); await view.vm.submit(); expect(refresh).toHaveBeenCalledTimes(1); expect(postAPI.mock.calls[1][1]).toEqual({ id: 'a', url: 'http://candidate:3333', size: '30' })
})
it('blocks unsupported URL input, revoked permissions and stale form completion', async () => {
  await open(); await view.find('#store-edit-url').setValue('http://user:secret@glue'); expect(view.vm.canSubmit).toBe(false)
  await view.find('#store-edit-url').setValue('http://new:3333'); let finish; postAPI.mockImplementation(() => new Promise(resolve => { finish = resolve })); const request = view.vm.submit()
  await view.setProps({ resource: resource({ id: 'b' }) }); finish({}); await request; expect(notification.success).not.toHaveBeenCalled(); expect(refresh).not.toHaveBeenCalled()
  store.getters.apis = {}; await flushPromises(); expect(view.vm.canSubmit).toBe(false)
})
it('keeps unknown usage distinct from a verified zero and displays exact units', async () => {
  await open(Details); expect(view.text()).toContain('20 GiB'); expect(view.text()).toContain('21,474,836,480'); expect(view.vm.capacities.find(v => v.key === 'storageused').bytes).toBeNull(); expect(view.vm.usedPercent).toBeNull()
  await view.setProps({ resource: resource({ storageusedknown: true, usagestatus: 'Fresh' }) }); expect(view.vm.capacities.find(v => v.key === 'storageused').value).toBe('0 B'); expect(view.vm.usedPercent).toBe(0)
})
it('coalesces repeated checks, preserves last success on failure, and recovers', async () => {
  await open(Details); let finish; postAPI.mockImplementationOnce(() => new Promise(resolve => { finish = resolve })); const first = view.vm.check(); await view.vm.check(); expect(postAPI).toHaveBeenCalledTimes(1)
  finish(reply()); await first; expect(view.vm.status).toBe('Connected'); const successful = view.vm.lastSuccess
  postAPI.mockResolvedValueOnce(reply('AuthFailed', 'AuthRejected')); await view.vm.check(); expect(view.vm.status).toBe('AuthFailed'); expect(view.vm.lastSuccess).toBe(successful)
  postAPI.mockResolvedValueOnce(reply()); await view.vm.check(); expect(view.vm.status).toBe('Connected'); expect(view.vm.checking).toBe(false)
})
it.each(['Unreachable', 'AccessDenied', 'Unknown'])('renders %s safely without raw provider text', async status => {
  await open(Details); postAPI.mockResolvedValue(reply(status, status === 'AccessDenied' ? 'PermissionDenied' : 'Unavailable')); await view.vm.check(); expect(view.vm.status).toBe(status); expect(view.vm.checking).toBe(false)
})
it('discards old checks after store, project, credential revision or permission scope changes', async () => {
  await open(Details); let finish; postAPI.mockImplementation(() => new Promise(resolve => { finish = resolve })); const first = view.vm.check()
  await view.setProps({ resource: resource({ connectionrevision: 'r2' }) }); finish(reply()); await first; expect(view.vm.status).toBe('Unknown'); expect(view.vm.lastSuccess).toBeNull()
  store.getters.project.id = 'project'; store.getters.apis = {}; await flushPromises(); expect(view.vm.canCheck).toBe(false); await view.vm.check(); expect(postAPI).toHaveBeenCalledTimes(1)
})
it('refuses mismatched ids/revisions or malformed responses and releases loading', async () => {
  await open(Details); postAPI.mockResolvedValueOnce(reply('Connected', 'Verified', { id: 'other' })); await view.vm.check(); expect(view.vm.status).toBe('Unreachable')
  postAPI.mockResolvedValueOnce(reply('Connected', 'Verified', { connectionrevision: 'r2' })); await view.vm.check(); expect(view.vm.status).toBe('Unknown'); expect(view.vm.reason).toBe('ConfigurationChanged'); expect(refresh).toHaveBeenCalledTimes(1); expect(view.vm.checking).toBe(false)
})
it('preserves precision through large and fractional legacy byte values', () => {
  expect(exactBytes({ storagetotalbytes: '9223372036854775807' }, 'storagetotal').toString()).toBe('9223372036854775807')
  expect(initialGiB({ storagetotalbytes: '9223372036854775807' })).toBe(''); expect(initialGiB({ storagetotalbytes: '9223372035781033984' })).toBe('8589934591')
  expect(exactBytes({ storageused: 0, storageusedknown: false }, 'storageused')).toBeNull()
  expect(exactBytes({ storagetotal: 9223372036854775807 }, 'storagetotal')).toBeNull()
  expect(formatBytes(BigInt('536870912'))).toBe('512 MiB'); expect(capacityPercent(BigInt(1), BigInt(0))).toBeNull()
  expect(capacityError('8589934591', resource())).toBe(''); expect(capacityError('1', resource({ storageallocatedknown: false }))).toContain('unknown')
  expect(validEndpoint('https://glue:443/gateway')).toBe(true); expect(validEndpoint('http://glue/?key=x')).toBe(false)
})
