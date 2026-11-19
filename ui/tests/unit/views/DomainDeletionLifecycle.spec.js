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

import { flushPromises } from '@vue/test-utils'
import DomainView from '@/views/iam/DomainView'
import DomainDeleteConfirm from '@/components/view/DomainDeleteConfirm'
import TreeView from '@/components/view/TreeView'
import { getAPI, postAPI } from '@/api'
import store from '@/store'

jest.mock('@/api', () => ({ getAPI: jest.fn(), postAPI: jest.fn(), callAPI: jest.fn() }))
jest.mock('@/store', () => ({ getters: {}, dispatch: jest.fn() }))
jest.mock('@/config/router', () => ({ asyncRouterMap: () => [], constantRouterMap: [] }))
const domain = { id: 'deleted-domain', name: 'qa-domain', key: 'deleted-domain' }
const root = { id: 'root-domain', name: 'ROOT', key: 'root-domain' }
const deferred = () => { let finish; let fail; const promise = new Promise((resolve, reject) => { finish = resolve; fail = reject }); return { promise, resolve: finish, reject: fail } }
function context (component, extra = {}) {
  const c = { ...component.data(), $store: { state: { user: { token: 'session' } }, getters: { userInfo: { id: 'admin', domainid: root.id }, project: {} } }, $t: x => x, $emit: jest.fn(), $notification: { error: jest.fn() }, ...extra }
  for (const [key, value] of Object.entries(component.methods)) c[key] = value.bind(c)
  for (const [key, value] of Object.entries(component.computed || {})) Object.defineProperty(c, key, { get: () => value.call(c), configurable: true })
  return c
}
function parent (path = '/domain/deleted-domain') {
  const c = context(DomainView, { $route: { path, fullPath: path, params: path === '/domain' ? {} : { id: domain.id } }, $router: { replace: jest.fn(), push: jest.fn() }, $pollJob: jest.fn().mockResolvedValue({ jobstatus: 1 }) })
  c.deleteDomainResource = { ...domain }; c.showDeleteConfirm = true
  postAPI.mockResolvedValue({ deletedomainresponse: { jobid: 'deletion-job' } })
  getAPI.mockResolvedValue({ listdomainsresponse: { domain: [{ ...root }] } })
  c.$router.replace.mockImplementation(async () => { const from = { ...c.$route }; Object.assign(c.$route, { path: '/domain', fullPath: '/domain', params: {} }); DomainView.watch.$route.call(c, c.$route, from) })
  return c
}
function impact () { return context(DomainDeleteConfirm, { domain: { ...domain }, deleting: false, deletionError: '' }) }
beforeEach(() => { jest.resetAllMocks() })

test('successful deletion awaits navigation before the only root reload; no deleted ID reread', async () => {
  const c = parent(); const nav = deferred()
  c.$router.replace.mockImplementation(() => nav.promise)
  const task = c.confirmDeleteDomain(); await flushPromises()
  expect(c.$router.replace).toHaveBeenCalledWith({ path: '/domain' })
  expect(getAPI).not.toHaveBeenCalled()
  expect(c.showDeleteConfirm).toBe(false)
  Object.assign(c.$route, { path: '/domain', fullPath: '/domain', params: {} }); nav.resolve(); await task
  expect(getAPI).toHaveBeenCalledTimes(1)
  expect(getAPI.mock.calls[0][1].id).toBe(root.id)
  expect(c.$notification.error).not.toHaveBeenCalled()
})
test('tree deletion clears deleted selection and reloads root exactly once', async () => {
  const c = parent('/domain'); await c.confirmDeleteDomain()
  expect(c.domainStore.treeSelected).toEqual({})
  expect(c.treeViewKey).toBe(1)
  expect(getAPI).toHaveBeenCalledTimes(1)
  expect(store.dispatch).toHaveBeenCalledWith('SetDomainStore', expect.objectContaining({ treeSelected: {} }))
})
test('route watcher does not race the awaited post-delete reload', async () => {
  const c = parent(); await c.confirmDeleteDomain()
  expect(getAPI).toHaveBeenCalledTimes(1)
  expect(c.$pollJob).toHaveBeenCalledTimes(1)
})
test('double confirmation and cancel during a pending job cannot submit another delete', async () => {
  const c = parent(); const job = deferred(); c.$pollJob.mockReturnValue(job.promise)
  const task = c.confirmDeleteDomain(); await flushPromises(); await c.confirmDeleteDomain(); c.closeDeleteConfirm()
  expect(postAPI).toHaveBeenCalledTimes(1); expect(c.showDeleteConfirm).toBe(true)
  job.resolve({ jobstatus: 1 }); await task
})
test('an explicit server delete rejection stays visible and retains the target without redirect', async () => {
  const c = parent(); postAPI.mockRejectedValue({ response: { data: { errorresponse: { errortext: 'Domain still in use' } } } })
  await c.confirmDeleteDomain()
  expect(c.domainDeleteError).toBe('Domain still in use'); expect(c.showDeleteConfirm).toBe(true)
  expect(c.deleteDomainResource.id).toBe(domain.id); expect(c.$router.replace).not.toHaveBeenCalled()
  expect(c.domainDeletePending).toBe(false)
})
test('an async delete failure preserves the domain and its actual error', async () => {
  const c = parent(); c.$pollJob.mockResolvedValue({ jobstatus: 2, jobresult: { errortext: 'cleanup rejected' } })
  await c.confirmDeleteDomain(); expect(c.domainDeleteError).toBe('cleanup rejected')
  expect(c.showDeleteConfirm).toBe(true); expect(getAPI).not.toHaveBeenCalled()
})
test('a late completed job cannot navigate a disposed page', async () => {
  const c = parent(); const job = deferred(); c.$pollJob.mockReturnValue(job.promise)
  const task = c.confirmDeleteDomain(); await flushPromises(); c.domainDisposed = true
  job.resolve({ jobstatus: 1 }); await task; expect(c.$router.replace).not.toHaveBeenCalled()
})
test('a pending detail failure is discarded after route or instance invalidation', async () => {
  const c = parent(); const read = deferred(); getAPI.mockReturnValue(read.promise)
  const task = c.fetchData(); c.invalidateDomainRead(); c.domainDisposed = true
  read.reject({ response: { status: 431, headers: { 'x-description': 'Domain does not exist' } } }); await task
  expect(c.$notification.error).not.toHaveBeenCalled()
})
test('a current detail read failure is still reported', async () => {
  const c = parent(); getAPI.mockRejectedValue({ response: { status: 500, headers: { 'x-description': 'current read failed' } } })
  await c.fetchData(); expect(c.$notification.error).toHaveBeenCalledWith(expect.objectContaining({ description: 'current read failed' }))
})
test('cancel during account impact read aborts and prevents a second VM query', async () => {
  const c = impact(); const read = deferred(); getAPI.mockReturnValue(read.promise)
  const task = c.fetchDomainImpact(); const signal = getAPI.mock.calls[0][2].signal
  c.emitClose(); expect(signal.aborted).toBe(true)
  read.resolve({ listaccountsresponse: { account: [] } }); await task
  expect(getAPI).toHaveBeenCalledTimes(1); expect(c.$notification.error).not.toHaveBeenCalled()
  expect(c.canDelete).toBe(false)
})
test('an unmounted impact dialog cannot publish a late VM error', async () => {
  const c = impact(); const vm = deferred()
  getAPI.mockResolvedValueOnce({ listaccountsresponse: { account: [] } }).mockReturnValueOnce(vm.promise)
  const task = c.fetchDomainImpact(); await flushPromises(); DomainDeleteConfirm.beforeUnmount.call(c)
  vm.reject(new Error('late VM failure')); await task
  expect(c.impactError).toBe(''); expect(c.$notification.error).not.toHaveBeenCalled()
})
test('a current impact failure blocks delete, shows its error and can retry successfully', async () => {
  const c = impact(); c.confirmText = domain.name; getAPI.mockRejectedValueOnce(new Error('network failed'))
  await c.fetchDomainImpact(); expect(c.canDelete).toBe(false); expect(c.impactError).toBe('message.request.failed')
  getAPI.mockResolvedValueOnce({ listaccountsresponse: { account: [{ name: 'empty-account' }] } }).mockResolvedValueOnce({ listvirtualmachinesresponse: { virtualmachine: [] } })
  await c.fetchDomainImpact(); expect(c.canDelete).toBe(true); expect(c.accountVmSummary[0].total).toBe(0)
})
test('changing impact target discards old accounts instead of querying the new target from that old response', async () => {
  const c = impact(); const read = deferred(); getAPI.mockReturnValueOnce(read.promise)
  const task = c.fetchDomainImpact(); c.domain = { id: 'another-domain', name: 'another' }
  read.resolve({ listaccountsresponse: { account: [{ name: 'old' }] } }); await task
  expect(getAPI).toHaveBeenCalledTimes(1); expect(c.accountVmSummary).toEqual([])
})
test('an unmounted domain tree never sends its queued detail lookup', async () => {
  const c = context(TreeView, { metaName: 'domain' }); c.domainTreeDisposed = true
  await c.getDetailResource(domain.id); expect(getAPI).not.toHaveBeenCalled()
})
test('a late domain tree failure is local and silent after disposal', async () => {
  const c = context(TreeView, { metaName: 'domain', $route: { fullPath: '/domain', meta: { permission: ['listDomains'] } } }); const read = deferred()
  getAPI.mockReturnValue(read.promise); const task = c.getDetailResource(domain.id)
  TreeView.beforeUnmount.call(c); read.reject(new Error('deleted domain')); await task
  expect(c.$notification.error).not.toHaveBeenCalled(); expect(getAPI.mock.calls[0][2].preserveOnFailure).toBe(true)
})
test('a current domain tree lookup error remains visible', async () => {
  const c = context(TreeView, { metaName: 'domain', $route: { fullPath: '/domain', meta: { permission: ['listDomains'] } } })
  getAPI.mockRejectedValue({ response: { headers: { 'x-description': 'visible current error' } } }); await c.getDetailResource(domain.id)
  expect(c.$notification.error).toHaveBeenCalledWith(expect.objectContaining({ description: 'visible current error' }))
})
