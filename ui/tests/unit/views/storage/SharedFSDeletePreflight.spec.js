// Licensed to the Apache Software Foundation (ASF) under one or more
// contributor license agreements. See NOTICE. Apache License, Version 2.0.
import { shallowMount, flushPromises } from '@vue/test-utils'
import SharedFSTab from '@/views/storage/SharedFSTab'
import Panel from '@/components/storage/StorageConfigurationPreflightPanel'
import MoldDialogActions from '@/components/view/MoldDialogActions'
import { getAPI, postAPI } from '@/api'
import intentCases from '../../../fixtures/storage-1462-delete-intents.json'
import serializedWire from '../../../fixtures/storage-configuration-preflight-wire.json'
import nvmeUsageWire from '../../../fixtures/storage-1462-nvme-usage-wire.json'

jest.mock('@/api', () => ({ getAPI: jest.fn(), postAPI: jest.fn() }))
const button = { props: ['disabled', 'loading'], template: '<button type="button" :disabled="disabled || loading"><slot /></button>' }
const input = { props: ['value', 'placeholder'], emits: ['update:value'], template: '<input :placeholder="placeholder" :value="value" @input="$emit(\'update:value\', $event.target.value)" />' }
const checkbox = { props: ['checked', 'disabled'], emits: ['change'], template: '<label><input type="checkbox" :checked="checked" :disabled="disabled" @change="$emit(\'change\', $event)" /><slot /></label>' }

describe('actual SharedFSTab deletion dialog admission and submit', () => {
  const wrappers = []
  let status, lastRequest, revision
  const report = () => {
    const wire = JSON.parse(JSON.stringify(serializedWire))
    Object.assign(wire.preflightstorageserviceconfigurationresponse.configurationpreflight, {
      status,
      revision,
      fingerprint: 'current-impact',
      observedat: new Date().toISOString(),
      expiresat: new Date(Date.now() + 30000).toISOString(),
      checks: [{ code: status === 'READY' ? 'DRAIN_REQUIRED' : 'DRAIN_BLOCKED', blocking: status !== 'READY' }],
      impact: { ackrequired: true, connections: 0 }
    })
    return wire
  }
  beforeEach(() => {
    global.crypto = require('crypto').webcrypto
    global.TextEncoder = require('util').TextEncoder
    status = 'READY'; lastRequest = null; revision = 13
    for (const method of ['fetchData', 'fetchStorageServiceData', 'fetchDiskOfferings', 'fetchStoragePools', 'refreshAfterStorageAction']) {
      jest.spyOn(SharedFSTab.methods, method).mockResolvedValue()
    }
    postAPI.mockReset(); getAPI.mockReset()
    postAPI.mockImplementation(async (api, args) => {
      if (api === 'preflightStorageServiceConfiguration') return report()
      if (api !== 'deleteStorageServiceProtocol') throw new Error('Unexpected mutation: ' + api)
      lastRequest = args.requestid
      return { deletestorageserviceprotocolresponse: { jobid: 'job' } }
    })
    getAPI.mockImplementation(async api => api === 'listStorageServiceInstances'
      ? { liststorageserviceinstancesresponse: { storageserviceinstance: [{ id: 'instance', configurationrevision: revision, configurationprotection: false }] } }
      : {
        liststorageserviceconfigurationoperationsresponse: {
          configurationoperation: [
            { id: 'operation', instanceid: 'instance', requestid: lastRequest, state: 'COMMITTED', result: true }
          ]
        }
      })
  })
  afterEach(() => { wrappers.splice(0).forEach(w => w.unmount()); jest.restoreAllMocks(); jest.useRealTimers() })
  const render = async () => {
    const w = shallowMount(SharedFSTab, {
      props: { resource: { id: 'sharedfs', zoneid: 'zone', volumeid: 'data', filesystem: 'xfs' } },
      global: {
        stubs: {
          teleport: false,
          MoldDialog: { props: ['visible'], template: '<section v-if="visible" data-test="delete-dialog"><slot /></section>' },
          MoldDialogActions: false,
          StorageConfigurationPreflightPanel: false,
          AForm: { template: '<form><slot /></form>' },
          AFormItem: { template: '<div><slot /></div>' },
          AInput: input,
          AButton: button,
          ACheckbox: checkbox
        },
        provide: { parentFetchData: jest.fn() },
        mocks: {
          $t: key => key,
          $route: { fullPath: '/sharedfs/sharedfs?tab=iscsi', query: { tab: 'iscsi' }, params: { id: 'sharedfs' } },
          $router: { push: jest.fn(), replace: jest.fn() },
          $store: { state: { app: { device: 'desktop' } }, getters: { apis: { listStorageServiceInstances: {} }, userInfo: { id: 'user' } } },
          $message: { error: jest.fn() },
          $notifyError: jest.fn()
        }
      }
    })
    wrappers.push(w)
    w.vm.storageService.instance = { id: 'instance', configurationrevision: revision, configurationprotection: false }
    await flushPromises()
    return w
  }
  const dialog = w => w.find('[data-test="delete-dialog"]')
  const primary = w => {
    const actions = dialog(w).findComponent(MoldDialogActions)
    const buttons = actions.findAll('button')
    if (!buttons.length) throw new Error(actions.html())
    return buttons.at(-1)
  }
  const open = async (w, sample = intentCases[0]) => {
    w.vm.openDeleteConfirm(sample.type, {
      id: 'listener',
      protocol: sample.form.protocol,
      listenIp: sample.form.listenip,
      port: sample.form.port,
      name: sample.form.protocol
    })
    await flushPromises()
    await dialog(w).find('input:not([type="checkbox"])').setValue(w.vm.actionModal.context.name)
    await flushPromises()
  }
  const acknowledge = async w => {
    await w.findComponent(Panel).find('input[type="checkbox"]').setValue(true)
    await flushPromises()
  }

  test.each(intentCases.map(sample => [sample.type + '/' + sample.form.protocol, sample]))('%s matches the actual server commandIntent before any mutation', async (_name, sample) => {
    const w = await render(); await open(w, sample)
    expect(primary(w).text()).toBe('label.storage.preflight.check')
    await primary(w).trigger('click'); await flushPromises()
    expect(postAPI).toHaveBeenCalledTimes(1)
    expect(postAPI.mock.calls[0][0]).toBe('preflightStorageServiceConfiguration')
    expect(JSON.parse(postAPI.mock.calls[0][1].intent)).toEqual(sample.intent)
    expect(primary(w).element.disabled).toBe(true)
  })

  test('the actual dialog footer submits once only after READY and its impact acknowledgement', async () => {
    const w = await render(); await open(w)
    await primary(w).trigger('click'); await flushPromises()
    expect(primary(w).text()).toBe('label.storage.preflight.apply')
    expect(primary(w).element.disabled).toBe(true)
    await acknowledge(w)
    expect(primary(w).element.disabled).toBe(false)
    await primary(w).trigger('click'); await flushPromises()
    const writes = postAPI.mock.calls.filter(([api]) => api === 'deleteStorageServiceProtocol')
    expect(writes).toHaveLength(1)
    expect(writes[0][1]).toEqual(expect.objectContaining({
      instanceid: 'instance',
      protocol: 'ISCSI',
      listenip: '0.0.0.0',
      port: 3260,
      expectedrevision: 13,
      impactack: 'current-impact',
      requestid: expect.any(String)
    }))
    expect(writes[0][1]).not.toHaveProperty('id')
    expect(w.vm.actionModal.visible).toBe(false)
  })

  test('actual protocol API wire exposes unused NVMe removal and keeps the active listener protected through the real dialog', async () => {
    const w = await render()
    w.vm.storageService.protocols = JSON.parse(JSON.stringify(nvmeUsageWire.liststorageserviceprotocolsresponse.storageserviceprotocol))
    await flushPromises()
    const unused = w.vm.nvmeListenerRows.find(row => row.port === 4420)
    const active = w.vm.nvmeListenerRows.find(row => row.port === 4421)
    expect(unused.linkedResourceCount).toBe(0)
    expect(unused.canDelete).toBe(true)
    expect(active.linkedResourceCount).toBe(1)
    expect(active.canDelete).toBe(false)
    w.vm.openDeleteConfirm('nvmeListener', unused)
    await flushPromises()
    await dialog(w).find('input:not([type="checkbox"])').setValue(w.vm.actionModal.context.name)
    await primary(w).trigger('click'); await flushPromises()
    expect(JSON.parse(postAPI.mock.calls[0][1].intent)).toEqual(intentCases.find(sample => sample.type === 'nvmeListener').intent)
    expect(primary(w).element.disabled).toBe(true)
    await acknowledge(w)
    await primary(w).trigger('click'); await flushPromises()
    const writes = postAPI.mock.calls.filter(([api]) => api === 'deleteStorageServiceProtocol')
    expect(writes).toHaveLength(1)
    expect(writes[0][1]).toEqual(expect.objectContaining({
      protocol: 'NVME_OF', listenip: '0.0.0.0', port: 4420,
      expectedrevision: 13, impactack: 'current-impact'
    }))
    expect(w.vm.actionModal.visible).toBe(false)
  })

  test.each(['BLOCKED', 'UNKNOWN'])('%s cannot be approved or submitted', async value => {
    const w = await render(); await open(w); status = value
    await primary(w).trigger('click'); await flushPromises()
    expect(primary(w).element.disabled).toBe(true)
    expect(w.findComponent(Panel).find('input[type="checkbox"]').element.disabled).toBe(true)
    expect(postAPI.mock.calls.map(([api]) => api)).toEqual(['preflightStorageServiceConfiguration'])
  })

  test('expiry invalidates the approval and requests a new probe, never a delete', async () => {
    const w = await render(); await open(w); jest.useFakeTimers()
    await primary(w).trigger('click'); await flushPromises(); await acknowledge(w)
    jest.advanceTimersByTime(30001); await w.vm.$nextTick()
    expect(w.vm.configurationPreflight).toBeNull()
    expect(primary(w).text()).toBe('label.storage.preflight.check')
    await primary(w).trigger('click'); await flushPromises()
    expect(w.vm.configurationImpactAcknowledged).toBe(false)
    expect(postAPI.mock.calls.map(([api]) => api)).toEqual(['preflightStorageServiceConfiguration', 'preflightStorageServiceConfiguration'])
  })

  test('reentry after a completed action cannot reuse its accepted preflight', async () => {
    const w = await render(); await open(w)
    await primary(w).trigger('click'); await flushPromises(); await acknowledge(w)
    await primary(w).trigger('click'); await flushPromises()
    const oldRequest = lastRequest
    expect(w.vm.configurationAcceptedPreflight).not.toBeNull()
    revision = 14
    await open(w)
    expect(w.vm.configurationAcceptedPreflight).toBeNull()
    expect(primary(w).text()).toBe('label.storage.preflight.check')
    await primary(w).trigger('click'); await flushPromises()
    expect(lastRequest).toBe(oldRequest)
    expect(postAPI.mock.calls.filter(([api]) => api === 'deleteStorageServiceProtocol')).toHaveLength(1)
  })

  test('a late probe from a closed deletion dialog cannot populate the new same-protocol dialog', async () => {
    const w = await render(); await open(w)
    let resolveProbe
    postAPI.mockImplementationOnce(() => new Promise(resolve => { resolveProbe = resolve }))
    await primary(w).trigger('click'); await flushPromises()
    w.vm.closeActionModal(); await flushPromises()
    await open(w)
    resolveProbe(report()); await flushPromises()
    expect(w.vm.configurationPreflight).toBeNull()
    expect(w.vm.configurationPreflightLoading).toBe(false)
    expect(primary(w).text()).toBe('label.storage.preflight.check')
    expect(postAPI.mock.calls.map(([api]) => api)).toEqual(['preflightStorageServiceConfiguration'])
  })
})
