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
import Start from '@/views/compute/StartVirtualMachine'
import { flushPromises } from '@vue/test-utils'
import { getAPI, postAPI } from '@/api'
jest.mock('@/api', () => ({ getAPI: jest.fn(), postAPI: jest.fn() }))
const id = '11111111-1111-4111-8111-111111111111'
const other = '22222222-2222-4222-8222-222222222222'
let c
beforeEach(() => {
  jest.clearAllMocks()
  c = { resource: { id, zoneid: id, state: 'Stopped', displayname: '한글 대상', templatetype: 'VNF' }, action: {}, $route: { path: '/vnfapp/' + id, fullPath: '/vnfapp/' + id, meta: { name: 'vnfapp' } }, $store: { state: { user: { token: 'session' } }, getters: { userInfo: { id: 'actor', roletype: 'Admin' }, apis: { startVirtualMachine: {}, listPods: {}, listClusters: {}, listHosts: {} } } }, $t: key => key, $emit: jest.fn(), $pollJob: jest.fn(), $getApiParams: () => ({ podid: {}, clusterid: {}, hostid: {}, considerlasthost: {}, bootintosetup: {} }), $refs: { startForm: { validate: jest.fn().mockResolvedValue(), scrollToField: jest.fn() } } }
  Object.assign(c, Start.data.call(c)); Object.entries(Start.methods).forEach(([key, fn]) => { c[key] = fn.bind(c) })
  Object.entries(Start.computed).forEach(([key, fn]) => Object.defineProperty(c, key, { get: () => fn.call(c) }))
  c.fetchPlacement = jest.fn(); c.initForm()
  getAPI.mockResolvedValue({ listpodsresponse: { count: 1, pod: [{ id, name: 'Pod', zoneid: id }] } })
  postAPI.mockResolvedValue({ startvirtualmachineresponse: { jobid: 'job' } })
})
test('click and Enter share one pending validation and one POST, preserving false and target UUID', async () => {
  let done; c.$refs.startForm.validate.mockReturnValue(new Promise(resolve => { done = resolve }))
  c.form.considerlasthost = false
  const first = c.handleSubmit(); await c.handleSubmit(); expect(postAPI).not.toHaveBeenCalled()
  done(); await first
  expect(postAPI).toHaveBeenCalledTimes(1); expect(postAPI).toHaveBeenCalledWith('startVirtualMachine', { id, considerlasthost: false })
  expect(c.$pollJob).toHaveBeenCalledWith(expect.objectContaining({ jobId: 'job', resourceId: id, description: '한글 대상' }))
})
test.each(['target', 'login', 'project', 'role', 'permission', 'close'])('%s change during validation prevents a previous-target submission', async kind => {
  let done; c.$refs.startForm.validate.mockReturnValue(new Promise(resolve => { done = resolve })); const pending = c.handleSubmit()
  if (kind === 'target') c.resource = { ...c.resource, id: other }
  if (kind === 'login') c.$store.state.user.token = 'new'
  if (kind === 'project') c.$store.getters.project = { id: other }
  if (kind === 'role') c.$store.getters.userInfo.roletype = 'User'
  if (kind === 'permission') c.$store.getters.apis = {}
  if (kind === 'close') c.invalidate()
  done(); await pending; expect(postAPI).not.toHaveBeenCalled(); expect(c.$emit).not.toHaveBeenCalled()
})
test('an accepted old request cannot close a new target dialog or attach its result to it', async () => {
  let done; postAPI.mockReturnValue(new Promise(resolve => { done = resolve })); const pending = c.handleSubmit(); await flushPromises(); expect(postAPI).toHaveBeenCalledTimes(1)
  c.resource = { ...c.resource, id: other }; c.initForm(); done({ startvirtualmachineresponse: { jobid: 'old-job' } }); await pending
  expect(c.$pollJob).not.toHaveBeenCalled(); expect(c.$emit).not.toHaveBeenCalled(); expect(c.submitting).toBe(false)
})
test('a server state transition after submission does not discard the accepted start job', async () => {
  let done; postAPI.mockReturnValue(new Promise(resolve => { done = resolve })); const pending = c.handleSubmit(); await flushPromises(); expect(postAPI).toHaveBeenCalledTimes(1)
  c.resource.state = 'Starting'; done({ startvirtualmachineresponse: { jobid: 'job' } }); await pending
  expect(c.$pollJob).toHaveBeenCalledTimes(1); expect(c.$emit).toHaveBeenCalledWith('close-action')
})
test('a rejected 4xx request retains field values for correction and retry', async () => {
  c.form.considerlasthost = false; postAPI.mockRejectedValueOnce({ response: { status: 431, data: { startvirtualmachineresponse: { errortext: '<img> rejected' } } } })
  await c.handleSubmit(); expect(c.error).toBe('<img> rejected'); expect(c.form.considerlasthost).toBe(false); expect(c.unknown).toBe(false)
  await c.handleSubmit(); expect(postAPI).toHaveBeenCalledTimes(2)
})
test.each([{}, { response: { status: 503 } }])('uncertain HTTP outcome blocks resubmission without inventing success/job', async failure => {
  postAPI.mockRejectedValue(failure); await c.handleSubmit(); await c.handleSubmit()
  expect(c.unknown).toBe(true); expect(postAPI).toHaveBeenCalledTimes(1); expect(c.$pollJob).not.toHaveBeenCalled(); expect(c.$emit).not.toHaveBeenCalled()
})
test('missing job ID is unknown rather than a successful start', async () => {
  postAPI.mockResolvedValue({ startvirtualmachineresponse: {} }); await c.handleSubmit(); expect(c.unknown).toBe(true); expect(c.$pollJob).not.toHaveBeenCalled()
})
test('slower placement candidates from an earlier owner or Zone cannot replace current options', async () => {
  let done; getAPI.mockReturnValueOnce(new Promise(resolve => { done = resolve })); const pending = c.load('podid')
  c.resource = { ...c.resource, zoneid: other }; c.initForm(); done({ listpodsresponse: { count: 1, pod: [{ id, name: 'old', zoneid: id }] } }); await pending
  expect(c.options.podid).toEqual([])
})
test('changing Pod clears dependent pins and rejects the slower previous Pod host lookup', async () => {
  c.form.podid = id; c.form.clusterid = id; c.form.hostid = id
  let done; getAPI.mockReturnValueOnce(new Promise(resolve => { done = resolve })); const old = c.load('hostid')
  getAPI.mockImplementation(api => Promise.resolve(api === 'listClusters' ? { listclustersresponse: {} } : { listhostsresponse: { count: 1, host: [{ id: other, zoneid: id, podid: other }] } }))
  c.select('podid', other); await Promise.resolve(); done({ listhostsresponse: { count: 1, host: [{ id, zoneid: id, podid: id }] } }); await old
  expect(c.form.clusterid).toBeUndefined(); expect(c.form.hostid).toBeUndefined(); expect(c.options.hostid.map(row => row.id)).toEqual([other])
})
test('failed or incomplete lookup cannot authorize a retained pin; retry can verify it', async () => {
  c.form.podid = id; getAPI.mockResolvedValueOnce({ listpodsresponse: { count: 2, pod: [{ id, zoneid: id }] } }); await c.load('podid')
  expect(c.selectionReady).toBe(false); expect(c.lookup.podid).toBe('error'); expect(c.form.podid).toBe(id)
  await c.load('podid'); expect(c.selectionReady).toBe(true); await c.handleSubmit(); expect(postAPI).toHaveBeenCalledWith('startVirtualMachine', expect.objectContaining({ podid: id }))
})
