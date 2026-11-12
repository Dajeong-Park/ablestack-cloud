// Licensed to the Apache Software Foundation (ASF) under one or more
// contributor license agreements. See NOTICE. Apache License, Version 2.0.
import { shallowMount, flushPromises } from '@vue/test-utils'
import Panel from '@/components/storage/StorageSmbServiceNamesTab'
import SharedFSTab from '@/views/storage/SharedFSTab'
import { getAPI, postAPI } from '@/api'
import { isConfigurationApi } from '@/utils/storageConfigOperation'
import { decodeSmbNameContext, decodeSmbNames, smbNameIntent, smbNameParameters } from '@/utils/storageSmbServiceNames'
import wire from '../../../fixtures/storage-1466-service-name-wire.json'
jest.mock('@/api', () => ({ getAPI: jest.fn(), postAPI: jest.fn() }))
const clone = value => JSON.parse(JSON.stringify(value))
const row = () => clone(wire.list.liststoragesmbservicenamesresponse.servicename[0])
const report = () => {
  const value = clone(wire.preflight)
  value.preflightstorageserviceconfigurationresponse.configurationpreflight.expiresat = new Date(Date.now() + 30000).toISOString()
  return value
}
describe('SMB AD names actual API serializer and component contract', () => {
  let wrapper
  const mount = async (props = {}) => {
    wrapper = shallowMount(Panel, { props: { instance: { id: row().instanceid, configurationrevision: 3 }, endpoints: [{ id: row().endpointid, protocol: 'SMB', listenip: row().ip, port: 445, state: 'Ready', enabled: true }], execute: jest.fn().mockResolvedValue({ state: 'COMMITTED' }), ...props }, global: { mocks: { $t: key => key } } })
    await flushPromises()
    return wrapper
  }
  beforeEach(() => {
    getAPI.mockReset(); postAPI.mockReset()
    getAPI.mockImplementation(api => Promise.resolve(clone(api === 'getStorageSmbServiceNameContext' ? wire.context : wire.list)))
    postAPI.mockImplementation(() => Promise.resolve(report()))
  })
  afterEach(() => { if (wrapper) wrapper.unmount(); wrapper = null; jest.useRealTimers() })
  test('real BaseResponse context is read separately from an empty or populated standard list', async () => {
    expect(decodeSmbNameContext(wire.context).guid).toBe('7189b3df-b6d3-4089-83bf-c1ec9d79bf68')
    expect(decodeSmbNameContext(wire.list)).toBe(null)
    expect(decodeSmbNames(wire.emptyList)).toEqual([])
    getAPI.mockImplementation(api => Promise.resolve(clone(api === 'getStorageSmbServiceNameContext' ? wire.context : wire.emptyList)))
    await mount()
    expect(getAPI.mock.calls.map(call => call[0])).toEqual(['getStorageSmbServiceNameContext', 'listStorageSmbServiceNames'])
    expect(wrapper.vm.ready).toBe(true)
    expect(wrapper.vm.rows).toEqual([])
    wrapper.vm.registerBase(); await flushPromises()
    expect(wrapper.vm.draft.fqdn).toBe(decodeSmbNameContext(wire.context).fqdn)
    expect(wrapper.vm.draft.kind).toBe('BASE')
    expect(wrapper.vm.canSubmit).toBe(false)
  })
  test('edit preflight and write have identical public parameters and credentials are write-only', async () => {
    const execute = jest.fn().mockResolvedValue({ state: 'COMMITTED' })
    await mount({ execute })
    wrapper.vm.open(row())
    wrapper.vm.draft.fqdn = wire.preflight.preflightstorageserviceconfigurationresponse.configurationpreflight.namespreview.entry.entry.fqdn
    wrapper.vm.draft.username = 'runtime-operator'; wrapper.vm.draft.password = 'runtime-secret'
    await flushPromises(); await wrapper.vm.check()
    const intent = JSON.parse(postAPI.mock.calls[0][1].intent)
    expect(intent.api).toBe('updateStorageSmbServiceName')
    expect(JSON.stringify(intent)).not.toContain('runtime-')
    expect(wrapper.vm.report.namespreview.entry.ownership).toBeTruthy()
    expect(wrapper.vm.canSubmit).toBe(false)
    wrapper.vm.ack = true
    await wrapper.vm.submit()
    const [api, params] = execute.mock.calls[0]
    const { instanceid, username, password, ...publicFields } = params
    expect(api).toBe(intent.api)
    const { api: ignored, ...publicIntent } = intent
    expect(publicFields).toEqual(publicIntent)
    expect(username).toBe('runtime-operator'); expect(password).toBe('runtime-secret')
    expect(wrapper.vm.selected).toBe(null); expect(wrapper.vm.draft).toEqual({})
  })
  test('blocked conflict remains visible and prevents any write', async () => {
    const execute = jest.fn()
    const denied = report(); const body = denied.preflightstorageserviceconfigurationresponse.configurationpreflight
    body.status = 'BLOCKED'; body.checks = [{ code: 'SMB_NAME_SPN_CONFLICT', blocking: true }]
    postAPI.mockResolvedValueOnce(denied)
    await mount({ execute }); wrapper.vm.open(row())
    wrapper.vm.draft.username = 'operator'; wrapper.vm.draft.password = 'secret'
    await flushPromises(); await wrapper.vm.check(); wrapper.vm.ack = true; await wrapper.vm.submit()
    expect(wrapper.vm.report.checks[0].code).toBe('SMB_NAME_SPN_CONFLICT')
    expect(execute).not.toHaveBeenCalled()
  })
  test('server guard survives modal reentry and old responses cannot repopulate another instance', async () => {
    await mount({ guarded: true })
    wrapper.vm.open(row()); expect(wrapper.vm.selected).toBe(null)
    await wrapper.setProps({ guarded: false }); wrapper.vm.open(row())
    let finish
    postAPI.mockReturnValueOnce(new Promise(resolve => { finish = resolve }))
    const pending = wrapper.vm.check()
    await wrapper.setProps({ instance: { id: 'another-instance', configurationrevision: 8 } })
    finish(report()); await pending
    expect(wrapper.vm.selected).toBe(null); expect(wrapper.vm.report).toBe(null)
  })
  test('missing dedicated context is an explicit response error and disables new actions', async () => {
    getAPI.mockResolvedValueOnce(clone(wire.list))
    await mount()
    expect(wrapper.vm.error).toBe('SMB_NAME_CONTEXT_RESPONSE_INVALID')
    expect(wrapper.vm.ready).toBe(false)
  })
  test('delete intent only selects the registered identity; no extra endpoint or FQDN can be substituted', () => {
    const value = smbNameParameters('delete', row(), { fqdn: 'foreign.local', endpointid: 'foreign' })
    expect(value).toEqual({ id: row().id })
    expect(smbNameIntent('delete', row(), {})).toEqual({ api: 'deleteStorageSmbServiceName', id: row().id })
  })
  test('a rolled-back operation keeps its diagnostic and never closes as committed', async () => {
    await mount({ execute: jest.fn().mockResolvedValue({ state: 'ROLLED_BACK', originalfailure: { code: 'SMB_NAME_DNS_ACCESS_DENIED' } }) })
    wrapper.vm.open(row()); wrapper.vm.draft.username = 'operator'; wrapper.vm.draft.password = 'secret'
    await flushPromises(); await wrapper.vm.check(); wrapper.vm.ack = true; await wrapper.vm.submit()
    expect(wrapper.vm.selected).not.toBe(null)
    expect(wrapper.vm.modalError).toContain('SMB_NAME_DNS_ACCESS_DENIED')
    expect(wrapper.vm.draft.password).toBe('')
  })
  test('explicit recovery uses the same operation, preserves failures and needs no new create', async () => {
    const operation = { id: 'operation', canresume: true, resourcetype: 'SmbAdServiceName', state: 'RECOVERY_REQUIRED' }
    const resume = jest.fn().mockResolvedValue({ ...operation, state: 'RECOVERY_REQUIRED', originalfailure: { code: 'SMB_NAME_CREDENTIALS_REQUIRED' } })
    await mount({ guarded: true, operation, resume })
    wrapper.vm.openRecovery(operation); wrapper.vm.draft.username = 'operator'; wrapper.vm.draft.password = 'secret'
    await flushPromises(); await wrapper.vm.submit()
    expect(resume).toHaveBeenCalledWith(operation, { username: 'operator', password: 'secret' })
    expect(wrapper.vm.selected).not.toBe(null); expect(wrapper.vm.modalError).toContain('SMB_NAME_CREDENTIALS_REQUIRED')
    expect(postAPI).not.toHaveBeenCalled()
  })
  test('all three APIs join the existing guarded coordinator and the parent preserves the names tab key', async () => {
    for (const action of ['create', 'update', 'delete']) expect(isConfigurationApi(action + 'StorageSmbServiceName')).toBe(true)
    const runConfigurationAction = jest.fn()
    const scope = { storageService: { instance: { id: 'instance' } }, configurationProtected: false, configurationOperation: null, storageReadScope: 'scope', runConfigurationAction }
    await SharedFSTab.methods.executeSmbServiceName.call(scope, 'createStorageSmbServiceName', { fqdn: 'files.ablestack.local' }, { fingerprint: 'proof' })
    expect(runConfigurationAction).toHaveBeenCalledWith('smbNames', 'createStorageSmbServiceName', { fqdn: 'files.ablestack.local' })
    expect(scope.configurationAcceptedPreflight).toEqual({ fingerprint: 'proof', scope: 'scope', instanceid: 'instance' })
    const parent = { refreshConfigurationProtection: jest.fn(), isStorageProtocolTab: () => false, fetchStorageServiceData: jest.fn(), updateRouteQuery: jest.fn(), emitWideLayout: jest.fn() }
    SharedFSTab.methods.handleChangeTab.call(parent, 'smbNames')
    expect(parent.currentTab).toBe('smbNames')
    expect(parent.refreshConfigurationProtection).toHaveBeenCalledWith(true)
    expect(parent.updateRouteQuery).toHaveBeenCalledWith('smbNames')
  })
})
