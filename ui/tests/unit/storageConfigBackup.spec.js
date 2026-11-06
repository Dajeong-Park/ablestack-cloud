// Licensed to the Apache Software Foundation (ASF) under one or more contributor license agreements.
import { shallowMount, flushPromises } from '@vue/test-utils'
import { getAPI, postAPI } from '@/api'
import StorageConfigBackupTab from '@/components/storage/StorageConfigBackupTab.vue'

jest.mock('@/api', () => ({ getAPI: jest.fn(), postAPI: jest.fn() }))

const artifact = { id: 'backup', metadata: { coverage: { NFS: 'OBSERVED' } } }
const plan = {
  id: 'plan', revision: 8, sha256: 'b'.repeat(64), expires: 4102444800000,
  diff: { additions: [], updates: [], aclRemovals: [{}], credentialSlots: [] },
  nfsBinding: [{ after: { port: 2049, mode: 'SERVICE_WIDE', addresses: ['192.0.2.21'] } }]
}
const op = { id: 'operation', state: 'ROLLED_BACK', originalfailure: { code: 'DRAIN_REQUIRED' } }
const wire = result => ({ managestorageconfigartifactresponse: { storageconfigartifact: { result } } })
const mount = () => shallowMount(StorageConfigBackupTab, {
  props: { instanceid: 'target', canApply: true },
  global: {
    mocks: { $t: key => key },
    stubs: {
      MoldDialog: { template: '<div><slot /><slot name="footer" /></div>' },
      'a-button': { template: '<button><slot /></button>' }
    }
  }
})

describe('SharedFS restore review and apply', () => {
  beforeEach(() => {
    postAPI.mockReset()
    getAPI.mockReset()
  })

  test('requires both approvals and tracks one submission without another write', async () => {
    postAPI.mockImplementation(async (api, args) => {
      if (api === 'applyStorageConfigRestore') return { applystorageconfigrestoreresponse: { jobid: 'job' } }
      if (args.action === 'LIST') return wire({ artifacts: [artifact] })
      if (args.action === 'INSPECT') return wire({ sources: [], targets: ['192.0.2.21'] })
      if (args.action === 'PLAN') return wire(plan)
      throw new Error('Unexpected API')
    })
    getAPI.mockResolvedValue({ liststorageserviceconfigurationoperationsresponse: { configurationoperation: [op] } })
    const wrapper = mount()
    await flushPromises()
    await wrapper.vm.openReview(artifact)
    await wrapper.vm.review()
    expect(wrapper.vm.canSubmit).toBe(false)
    await wrapper.setData({ acceptNfs: true, acceptAcl: true })
    expect(wrapper.vm.canSubmit).toBe(true)
    await wrapper.vm.apply()
    expect(postAPI.mock.calls.filter(([api]) => api === 'applyStorageConfigRestore')).toHaveLength(1)
    expect(postAPI).toHaveBeenLastCalledWith('applyStorageConfigRestore', expect.objectContaining({
      instanceid: 'target', planid: 'plan', sha256: plan.sha256, expectedrevision: 8,
      acceptaclremoval: true, acceptnfsservicewide: true
    }), expect.anything())
    expect(wrapper.vm.operation.originalfailure.code).toBe('DRAIN_REQUIRED')
    expect(wrapper.vm.secrets).toEqual({})
    wrapper.unmount()
  })
})
