// Licensed under the Apache License, Version 2.0. See the NOTICE file.
import { shallowMount, flushPromises } from '@vue/test-utils'
import ResourceView from '@/components/view/ResourceView'
import CatalogRecords from '@/views/tools/RuntimeCatalogRecords'
import SharedFSTab from '@/views/storage/SharedFSTab'
import Deletion from '@/views/storage/SharedFSDeletion'
import InfoCard from '@/components/view/InfoCard'
import Identity from '@/components/view/StorageNfsIdentityPanel'
import Directory from '@/components/storage/StorageDirectoryPolicyPanel'
import Backup from '@/components/storage/StorageConfigBackupTab'
import Operation from '@/components/storage/StorageConfigurationOperationPanel'
import { getAPI, postAPI } from '@/api'

jest.mock('@/api', () => ({ getAPI: jest.fn(), postAPI: jest.fn() }))
const container = { template: '<div><slot /></div>' }
const table = { name: 'ReadTable', props: ['dataSource', 'loading'], template: '<table :data-loading="loading"><tr v-for="row in dataSource" :key="row.id"><td>{{ row.path || row.id }}</td></tr></table>' }
const globalOptions = {
  provide: { parentFetchData: jest.fn() },
  mocks: { $t: key => key, $toLocaleDate: value => new Date(value).toISOString(), $route: { path: '/sharedfs/fs', params: { id: 'fs' }, meta: { name: 'sharedfs' }, query: {} }, $store: { state: { app: { device: 'desktop' } }, getters: { userInfo: {}, apis: {}, features: {} } } },
  stubs: { ResourceLayout: { template: '<div><slot name="left" /><slot name="right" /></div>' }, ATable: table, ADescriptions: container, ADescriptionsItem: container, ASpin: { props: ['spinning'], template: '<section :data-spinning="spinning"><slot /></section>' }, AAlert: { props: ['message'], template: '<aside>{{ message }}</aside>' } }
}
const wire = rows => ({ managestorageconfigartifactresponse: { storageconfigartifact: { result: { artifacts: rows } } } })
beforeEach(() => { jest.clearAllMocks() })

test('SharedFS info card stays mounted during refresh while the existing read-pending guard stays true', () => {
  const w = shallowMount(ResourceView, { props: { resource: { id: 'fs' }, loading: true, quietRefresh: true }, global: globalOptions })
  expect(w.findComponent(InfoCard).props('loading')).toBe(false)
  expect(w.vm.$.provides.resourceReadPending()).toBe(true)
  w.unmount()
})
test('first-load placeholders and ordinary VM behavior are preserved', () => {
  const first = shallowMount(ResourceView, { props: { resource: {}, loading: true, quietRefresh: true }, global: globalOptions })
  expect(first.findComponent(InfoCard).props('loading')).toBe(true)
  first.unmount()
  const vm = shallowMount(ResourceView, { props: { resource: { id: 'vm' }, loading: true }, global: globalOptions })
  expect(vm.findComponent(InfoCard).props('loading')).toBe(true)
  vm.unmount()
})
test('an existing NFS identity observation does not disappear behind a spinner; first read remains distinct', async () => {
  const report = { mode: 'NAME_DOMAIN', policyrevision: 2, effectivemode: 'NAME_DOMAIN', observationstatus: 'APPLIED', endpoints: [] }
  const w = shallowMount(Identity, { props: { report, loading: true }, global: globalOptions })
  expect(w.find('[data-spinning]').attributes('data-spinning')).toBe('false')
  await w.setProps({ report: null })
  expect(w.find('[data-spinning]').attributes('data-spinning')).toBe('true')
  w.unmount()
})
test('directory refresh retains the same row node and does not cover the table', async () => {
  const rows = [{ id: 'policy', path: '/export/preserved', observation: {} }]
  getAPI.mockResolvedValueOnce({ liststoragedirectorypoliciesresponse: { directorypolicy: rows } })
  const w = shallowMount(Directory, { props: { instance: { id: 'instance' }, execute: jest.fn() }, global: globalOptions })
  await flushPromises()
  const row = w.find('tr').element
  let finish
  getAPI.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const pending = w.vm.load()
  await flushPromises()
  expect(w.vm.loading).toBe(true)
  expect(w.findComponent({ name: 'ReadTable' }).props('loading')).toBe(false)
  expect(w.find('tr').element).toBe(row)
  expect(w.text()).toContain('/export/preserved')
  finish({ liststoragedirectorypoliciesresponse: { directorypolicy: rows } })
  await pending
  expect(w.vm.loading).toBe(false)
  w.unmount()
})
test('backup refresh failure retains the previous rows, exposes the error and settles its button', async () => {
  const rows = [{ id: 'archive', kind: 'LKG', created: 1794168980550 }]
  postAPI.mockResolvedValueOnce(wire(rows))
  const w = shallowMount(Backup, { props: { instanceid: 'instance' }, global: globalOptions })
  await flushPromises()
  const row = w.find('tr').element
  let fail
  postAPI.mockImplementationOnce(() => new Promise((resolve, reject) => { fail = reject }))
  const pending = w.vm.load()
  await flushPromises()
  expect(w.vm.busy).toBe(true)
  expect(w.findComponent({ name: 'ReadTable' }).props('loading')).toBe(false)
  expect(w.find('tr').element).toBe(row)
  fail(new Error('READ_TEMPORARILY_UNAVAILABLE'))
  await pending
  expect(w.vm.rows).toEqual(rows)
  expect(w.vm.busy).toBe(false)
  expect(w.vm.error).toContain('READ_TEMPORARILY_UNAVAILABLE')
  w.unmount()
})
test('history refresh keeps its current rows while scope changes still discard them', async () => {
  const rows = [{ id: 'operation', state: 'COMMITTED' }]
  getAPI.mockResolvedValueOnce({ liststorageserviceconfigurationoperationsresponse: { configurationoperation: rows } })
  const w = shallowMount(Operation, { props: { instanceid: 'instance', history: true }, global: globalOptions })
  await flushPromises()
  const row = w.find('tr').element
  let finish
  getAPI.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const pending = w.vm.loadHistory()
  await flushPromises()
  expect(w.vm.loading).toBe(true)
  expect(w.findComponent({ name: 'ReadTable' }).props('loading')).toBe(false)
  expect(w.find('tr').element).toBe(row)
  getAPI.mockResolvedValueOnce({ liststorageserviceconfigurationoperationsresponse: {} })
  await w.setProps({ instanceid: 'other-instance' })
  await flushPromises()
  expect(w.vm.rows).toEqual([])
  finish({ liststorageserviceconfigurationoperationsresponse: { configurationoperation: rows } })
  await pending
  expect(w.vm.rows).toEqual([])
  w.unmount()
})

test('same-target NFS identity refresh retains its observation while a stale response cannot replace a new scope', async () => {
  const old = { mode: 'NAME_DOMAIN', endpoints: [{ port: 2049 }] }
  const context = { storageReadScope: 'scope-a', storageService: { instance: { id: 'instance-a' } }, nfsIdentity: { read: 0, scope: 'scope-a', instanceid: 'instance-a', loading: false, error: false, report: old } }
  let finishOld; let finishNew
  getAPI.mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve }))
    .mockImplementationOnce(() => new Promise(resolve => { finishNew = resolve }))
  const first = SharedFSTab.methods.fetchNfsIdentity.call(context)
  expect(context.nfsIdentity.report).toBe(old)
  expect(context.nfsIdentity.loading).toBe(true)
  context.storageReadScope = 'scope-b'; context.storageService.instance = { id: 'instance-b' }
  const second = SharedFSTab.methods.fetchNfsIdentity.call(context)
  expect(context.nfsIdentity.report).toBeNull()
  finishOld({ getstoragenfsidentitymappingresponse: { nfsidentitymapping: old } })
  await first
  expect(context.nfsIdentity.report).toBeNull()
  expect(context.nfsIdentity.loading).toBe(true)
  const current = { mode: 'NUMERIC', endpoints: [] }
  finishNew({ getstoragenfsidentitymappingresponse: { nfsidentitymapping: current } })
  await second
  expect(context.nfsIdentity.report).toBe(current)
  expect(context.nfsIdentity.loading).toBe(false)
})

test('runtime catalog records retain rows on refresh and discard an old bundle response', async () => {
  const rows = [{ id: 'validation', state: 'VALIDATED' }]
  const response = { liststorageserviceruntimebundlevalidationsresponse: { storageserviceruntimecatalogrecord: rows, count: 1 } }
  getAPI.mockResolvedValueOnce(response)
  const w = shallowMount(CatalogRecords, { props: { resource: { id: 'bundle-a' }, tab: 'runtime.validations' }, global: globalOptions })
  await flushPromises()
  const row = w.find('tr').element
  let finish
  getAPI.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const pending = w.vm.load()
  await flushPromises()
  expect(w.vm.busy).toBe(true)
  expect(w.findComponent({ name: 'ReadTable' }).props('loading')).toBe(false)
  expect(w.find('tr').element).toBe(row)
  getAPI.mockResolvedValueOnce({ liststorageserviceruntimebundlevalidationsresponse: { storageserviceruntimecatalogrecord: [], count: 0 } })
  await w.setProps({ resource: { id: 'bundle-b' } })
  await flushPromises()
  finish(response)
  await pending
  expect(w.vm.rows).toEqual([])
  expect(w.vm.busy).toBe(false)
  w.unmount()
})

test('manual deletion observation settles its own indicator and coalesces repeated UI clicks', async () => {
  let finish
  const context = { observing: false, observe: jest.fn(() => new Promise(resolve => { finish = resolve })) }
  const pending = Deletion.methods.refreshObservation.call(context)
  expect(context.observing).toBe(true)
  await Deletion.methods.refreshObservation.call(context)
  expect(context.observe).toHaveBeenCalledTimes(1)
  finish()
  await pending
  expect(context.observing).toBe(false)
  expect(getAPI).not.toHaveBeenCalled()
  expect(postAPI).not.toHaveBeenCalled()
})

test('boot recovery refresh shows one owner indicator without clearing the current inventory', async () => {
  let finish
  const inventory = [{ id: 'inventory', result: 'last-observation' }]
  const context = { bootRecoveryRefreshing: false, storageService: { inventory }, refreshBootRecovery: jest.fn(() => new Promise(resolve => { finish = resolve })) }
  const pending = SharedFSTab.methods.refreshBootRecoveryWithIndicator.call(context)
  expect(context.bootRecoveryRefreshing).toBe(true)
  expect(context.storageService.inventory).toBe(inventory)
  await SharedFSTab.methods.refreshBootRecoveryWithIndicator.call(context)
  expect(context.refreshBootRecovery).toHaveBeenCalledTimes(1)
  finish()
  await pending
  expect(context.bootRecoveryRefreshing).toBe(false)
  expect(context.storageService.inventory).toBe(inventory)
  expect(getAPI).not.toHaveBeenCalled()
})
