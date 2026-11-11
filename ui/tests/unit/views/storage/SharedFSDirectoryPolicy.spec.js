// Licensed to the Apache Software Foundation (ASF) under one or more
// contributor license agreements. See NOTICE. Apache License, Version 2.0.
// http://www.apache.org/licenses/LICENSE-2.0
import { shallowMount, flushPromises } from '@vue/test-utils'
import Panel from '@/components/storage/StorageDirectoryPolicyPanel'
import SharedFSTab from '@/views/storage/SharedFSTab'
import { getAPI, postAPI } from '@/api'
import { directoryChanges, directoryIntent, directoryParameters } from '@/utils/sharedDirectoryPolicy'
import { isConfigurationApi } from '@/utils/storageConfigOperation'
import wire from '../../../fixtures/storage-1452-directory-wire.json'
import ownedWire from '../../../fixtures/storage-1465-owned-policy-wire.json'
jest.mock('@/api', () => ({ getAPI: jest.fn(), postAPI: jest.fn() }))
const clone = value => JSON.parse(JSON.stringify(value))
describe('Shared directory actual serializer and component request contracts', () => {
  let wrapper
  const row = () => clone(wire.list.liststoragedirectorypoliciesresponse.directorypolicy[0])
  const create = props => shallowMount(Panel, { props: { instance: { id: 'instance', configurationrevision: 12 }, execute: jest.fn().mockResolvedValue({ state: 'COMMITTED' }), ...props }, global: { mocks: { $t: k => k } } })
  beforeEach(() => {
    getAPI.mockReset(); postAPI.mockReset()
    getAPI.mockResolvedValue(clone(wire.list))
    const response = clone(wire.preflight)
    response.preflightstorageserviceconfigurationresponse.configurationpreflight.expiresat = new Date(Date.now() + 30000).toISOString()
    postAPI.mockResolvedValue(response)
  })
  afterEach(() => { if (wrapper) wrapper.unmount(); jest.restoreAllMocks() })
  test('list request has page and real serializer values remain typed', async () => {
    wrapper = create(); await flushPromises()
    expect(getAPI).toHaveBeenCalledWith('listStorageDirectoryPolicies', { instanceid: 'instance', page: 1, pagesize: 500 }, expect.anything())
    expect(wrapper.vm.rows[0].observation.owneruid).toBe(1001)
    expect(wrapper.vm.rows[0].policyrevision).toBe(3)
    expect(wrapper.vm.loading).toBe(false)
  })
  test.each(['IMPLICIT_LEGACY', 'MANAGED'])('preflight shows the verified SMB mode %s in the standard dialog', async mode => {
    const response = clone(wire.preflight)
    response.preflightstorageserviceconfigurationresponse.configurationpreflight.directorypreview.smbreadiness = { status: 'READY', mode }
    postAPI.mockResolvedValue(response)
    wrapper = shallowMount(Panel, {
      props: { instance: { id: 'instance', configurationrevision: 12 }, execute: jest.fn() },
      global: {
        mocks: { $t: key => key },
        stubs: {
          MoldDialog: { template: '<div><slot /></div>' },
          'a-form': { template: '<form><slot /></form>' },
          'a-descriptions': { template: '<dl><slot /></dl>' },
          'a-descriptions-item': { props: ['label'], template: '<dd>{{ label }}<slot /></dd>' }
        }
      }
    })
    await flushPromises()
    wrapper.vm.open(wrapper.vm.rows[0]); wrapper.vm.draft.mode = '0775'
    await flushPromises()
    await wrapper.vm.check()
    expect(wrapper.vm.smbReadinessMode).toBe(mode.toLowerCase())
    expect(wrapper.text()).toContain('label.storage.directory.smb.' + mode.toLowerCase())
    expect(wrapper.text()).toContain('label.storage.directory.smb.readiness')
  })
  test('actual guest-to-DAO serialized SMB policy stays selectable with preserved ownership on edit', async () => {
    getAPI.mockResolvedValue(clone(ownedWire))
    wrapper = create()
    await flushPromises()
    const rows = SharedFSTab.computed.registeredDirectoryPolicies.call({ directoryPolicyRows: wrapper.vm.rows })
    expect(rows).toHaveLength(1)
    expect(rows[0].observationstatus).toBe('APPLIED')
    expect(rows[0].posixacl.ownedacl).toEqual({ 'g:65534': 'r-x' })
    expect(rows[0].posixacl.managedEntries.some(e => e.id === '65534' && e.tag === 'group')).toBe(false)
    wrapper.vm.open(rows[0])
    await flushPromises()
    expect(wrapper.vm.dirty).toBe(false)
    expect(directoryChanges(rows[0], wrapper.vm.draft)).toEqual({})
    expect(wrapper.vm.selected.posixacl.ownedacl).toEqual({ 'g:65534': 'r-x' })
  })
  test('unchanged POSIX and recursive false are omitted; adoption sends no POSIX', () => {
    const value = row()
    const draft = { owneruid: 1001, ownergid: 1001, mode: '0770', recursive: false }
    expect(directoryChanges(value, draft)).toEqual({})
    const legacy = { ...value, id: undefined }
    expect(directoryParameters(legacy, draft)).toEqual({ volumeid: 'volume', path: '/export/team' })
    expect(directoryIntent(legacy, draft)).toEqual({ api: 'createStorageDirectoryPolicy', volumeid: 'volume', path: '/export/team' })
  })
  test('mounted preflight and actual update carry the same single changed mode', async () => {
    wrapper = create(); await flushPromises()
    wrapper.vm.open(wrapper.vm.rows[0]); await flushPromises()
    expect(wrapper.vm.dirty).toBe(false)
    wrapper.vm.draft.mode = '0775'; await flushPromises()
    await wrapper.vm.check()
    const args = postAPI.mock.calls[0]
    expect(args[0]).toBe('preflightStorageServiceConfiguration')
    expect(JSON.parse(args[1].intent)).toEqual({ api: 'updateStorageDirectoryPolicy', resourceid: 'policy', expectedpolicyrevision: 3, posixchanges: { mode: '0775' } })
    expect(wrapper.vm.report.directorypreview.after.mode).toBe('0775')
    expect(wrapper.vm.applicable).toBe(false)
    wrapper.vm.ack = true
    await wrapper.vm.$nextTick()
    await wrapper.vm.apply()
    expect(wrapper.props('execute')).toHaveBeenCalledWith('updateStorageDirectoryPolicy', { instanceid: 'instance', id: 'policy', expectedpolicyrevision: 3, mode: '0775' }, expect.anything())
  })
  test('draft changes invalidate the old acknowledgement and protected reentry does not open', async () => {
    wrapper = create(); await flushPromises()
    wrapper.vm.open(wrapper.vm.rows[0]); wrapper.vm.draft.mode = '0775'; await flushPromises()
    await wrapper.vm.check(); wrapper.vm.ack = true
    wrapper.vm.draft.mode = '0777'; await flushPromises()
    expect(wrapper.vm.report).toBe(null); expect(wrapper.vm.ack).toBe(false)
    wrapper.vm.close(); await wrapper.setProps({ guarded: true })
    wrapper.vm.open(row()); expect(wrapper.vm.selected).toBe(null)
  })
  test('late response from another instance cannot replace current rows', async () => {
    let complete
    getAPI.mockReturnValueOnce(new Promise(resolve => { complete = resolve }))
    wrapper = create()
    await wrapper.setProps({ instance: { id: 'other', configurationrevision: 0 } })
    await flushPromises()
    complete({ liststoragedirectorypoliciesresponse: { directorypolicy: [{ id: 'stale' }] } })
    await flushPromises()
    expect(wrapper.vm.rows.some(r => r.id === 'stale')).toBe(false)
  })
  test('bound protocol forms omit independent POSIX but leave anonymous mapping separate', () => {
    const context = { forms: { nfsExport: { directorypolicyid: 'policy', owneruid: 123 } }, nfsPosixBaseline: {}, nfsPosixEdit: true }
    expect(SharedFSTab.computed.nfsPosixParameters.call(context)).toEqual({})
    expect(isConfigurationApi('createStorageDirectoryPolicy')).toBe(true)
    expect(isConfigurationApi('updateStorageDirectoryPolicy')).toBe(true)
  })
  test('explicit drift correction uses current observations without silently retaining an old desired UID', () => {
    const value = row(); value.owneruid = 1002
    expect(directoryChanges(value, { owneruid: 1001, ownergid: 1001, mode: '0770' })).toEqual({ ownerUid: 1001 })
  })
  test('consecutive completed policy actions use different request IDs while unresolved work stays protected', async () => {
    global.crypto = require('crypto').webcrypto
    jest.spyOn(SharedFSTab.methods, 'fetchData').mockResolvedValue()
    jest.spyOn(SharedFSTab.methods, 'fetchStorageServiceData').mockResolvedValue()
    jest.spyOn(SharedFSTab.methods, 'refreshAfterStorageAction').mockResolvedValue()
    let revision = 12
    getAPI.mockImplementation(async (api, params) => api === 'listStorageServiceInstances'
      ? { liststorageserviceinstancesresponse: { storageserviceinstance: [{ id: 'instance', configurationrevision: ++revision, configurationprotection: false }] } }
      : { liststorageserviceconfigurationoperationsresponse: { configurationoperation: [{ id: params.requestid, requestid: params.requestid, instanceid: 'instance', state: 'COMMITTED', result: {} }] } })
    postAPI.mockImplementation(async api => ({ [api.toLowerCase() + 'response']: { jobid: 'job' } }))
    wrapper = shallowMount(SharedFSTab, {
      props: { resource: { id: 'sharedfs' } },
      global: {
        provide: { parentFetchData: jest.fn() },
        mocks: {
          $t: k => k,
          $route: { fullPath: '/sharedfs/sharedfs?tab=directory', query: { tab: 'directory' }, params: { id: 'sharedfs' } },
          $router: { push: jest.fn(), replace: jest.fn() },
          $store: { state: { app: { device: 'desktop' } }, getters: { apis: {}, userInfo: { id: 'user' } } },
          $message: { error: jest.fn(), success: jest.fn() },
          $notifyError: jest.fn()
        }
      }
    })
    wrapper.vm.storageService.instance = { id: 'instance', configurationrevision: 12 }
    await wrapper.vm.executeDirectoryPolicy('createStorageDirectoryPolicy', { volumeid: 'volume', path: '/export/team' }, { fingerprint: 'confirmed' })
    await wrapper.vm.executeDirectoryPolicy('updateStorageDirectoryPolicy', { id: 'policy', expectedpolicyrevision: 1, mode: '0775' }, { fingerprint: 'confirmed-again' })
    const writes = postAPI.mock.calls.filter(([api]) => ['createStorageDirectoryPolicy', 'updateStorageDirectoryPolicy'].includes(api))
    expect(writes).toHaveLength(2)
    expect(writes[0][1].requestid).not.toBe(writes[1][1].requestid)
    wrapper.vm.configurationOperation = { state: 'RECOVERY_REQUIRED', requestid: writes[1][1].requestid }
    await wrapper.vm.executeDirectoryPolicy('updateStorageDirectoryPolicy', { id: 'policy' }, { fingerprint: 'third' })
    expect(postAPI.mock.calls.filter(([api]) => api === 'updateStorageDirectoryPolicy')).toHaveLength(1)
  })
})

describe('directory ACL public and actual request equivalence', () => {
  test('preserves distinct scopes, long numeric owners and omits untouched POSIX', () => {
    const row = {
      id: 'policy',
      policyrevision: 2,
      owneruid: 100001,
      ownergid: 100002,
      mode: '2770',
      observation: { status: 'OBSERVED', owneruid: 100001, ownergid: 100002, mode: '2770' }
    }
    const draft = {
      owneruid: 100001,
      ownergid: 100002,
      mode: '2770',
      aclChanges: {
        version: 1,
        entries: [
          { action: 'UPSERT', scope: 'DEFAULT', principalType: 'UID', principal: '100003', permissions: 'r-x' }
        ]
      }
    }
    const intent = directoryIntent(row, draft)
    const actual = directoryParameters(row, draft)
    expect(intent.posixchanges).toEqual({})
    expect(JSON.parse(actual.aclchanges)).toEqual(intent.aclchanges)
    expect(actual.owneruid).toBeUndefined()
    expect(directoryIntent(row, { ...draft, unregister: true }).api).toBe('deleteStorageDirectoryPolicy')
    expect(isConfigurationApi('deleteStorageDirectoryPolicy')).toBe(true)
  })
})

describe('native NFS ACL enforcement guard in the actual directory component', () => {
  let wrapper
  afterEach(() => { if (wrapper) wrapper.unmount(); jest.restoreAllMocks() })
  test.each(['BLOCKED', 'UNKNOWN'])('preflight %s cannot submit a change', async status => {
    getAPI.mockReset(); postAPI.mockReset()
    getAPI.mockResolvedValue(clone(wire.list))
    const report = clone(wire.preflight)
    const value = report.preflightstorageserviceconfigurationresponse.configurationpreflight
    value.status = status
    value.fingerprint = ''
    value.checks = [{ code: status === 'BLOCKED' ? 'DIRECTORY_NFS_POSIX_ACL_UNSUPPORTED' : 'DIRECTORY_NFS_POSIX_ACL_UNAVAILABLE', blocking: true, severity: 'ERROR' }]
    postAPI.mockResolvedValue(report)
    const execute = jest.fn()
    wrapper = shallowMount(Panel, { props: { instance: { id: 'instance', configurationrevision: 12 }, execute }, global: { mocks: { $t: k => k } } })
    await flushPromises()
    wrapper.vm.open(wrapper.vm.rows[0])
    await flushPromises()
    wrapper.vm.draft.aclChanges = { version: 1, entries: [{ action: 'UPSERT', scope: 'ACCESS', principalType: 'UID', principal: '100001', permissions: 'r-x' }] }
    await flushPromises()
    await wrapper.vm.check()
    wrapper.vm.ack = true
    await wrapper.vm.$nextTick()
    expect(wrapper.vm.applicable).toBe(false)
    expect(wrapper.vm.blockingMessage).toContain('nfs.acl.')
    await wrapper.vm.apply()
    expect(execute).not.toHaveBeenCalled()
  })
  test('incomplete ACL input cannot hide behind a valid POSIX change', async () => {
    getAPI.mockReset(); getAPI.mockResolvedValue(clone(wire.list))
    wrapper = shallowMount(Panel, { props: { instance: { id: 'instance' }, execute: jest.fn() }, global: { mocks: { $t: k => k } } })
    await flushPromises()
    wrapper.vm.open(wrapper.vm.rows[0])
    await flushPromises()
    wrapper.vm.draft.mode = '0775'
    wrapper.vm.draft.aclChanges = { version: 1, entries: [{ action: 'UPSERT', scope: 'ACCESS', principalType: 'UID', principal: '', permissions: 'r-x' }] }
    await flushPromises()
    expect(wrapper.vm.dirty).toBe(false)
  })
})
