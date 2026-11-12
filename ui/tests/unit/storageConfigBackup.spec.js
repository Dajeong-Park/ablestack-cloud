// Licensed to the Apache Software Foundation (ASF) under one or more contributor license agreements.
import { shallowMount, flushPromises } from '@vue/test-utils'
import { getAPI, postAPI } from '@/api'
import errorWire from '../fixtures/storage-1462-restore-error-wire.json'
import smbReviewWire from '../fixtures/storage-1462-smb-parent-wire.json'
import ko from '@/../public/locales/ko_KR.json'
import StorageConfigBackupTab from '@/components/storage/StorageConfigBackupTab.vue'

jest.mock('@/api', () => ({ getAPI: jest.fn(), postAPI: jest.fn() }))

const artifact = { id: 'backup', metadata: { coverage: { NFS: 'OBSERVED' } } }
const plan = {
  id: 'plan',
  revision: 8,
  sha256: 'b'.repeat(64),
  expires: 4102444800000,
  diff: { additions: [], updates: [], aclRemovals: [{}], credentialSlots: [] },
  nfsBinding: [{ after: { port: 2049, mode: 'SERVICE_WIDE', addresses: ['192.0.2.21'] } }]
}
const op = { id: 'operation', state: 'ROLLED_BACK', originalfailure: { code: 'DRAIN_REQUIRED' } }
const wire = result => ({ managestorageconfigartifactresponse: { storageconfigartifact: { result } } })
const mount = (extraStubs = {}) => shallowMount(StorageConfigBackupTab, {
  props: { instanceid: 'target', canApply: true },
  global: {
    mocks: { $t: key => ko[key] || key },
    stubs: {
      MoldDialog: { template: '<div><slot /><slot name="footer" /></div>' },
      'a-button': { template: '<button><slot /></button>' },
      'a-alert': { props: ['message', 'description'], template: '<div role="alert">{{ message }} {{ description }}</div>' },
      ...extraStubs
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
      instanceid: 'target',
      planid: 'plan',
      sha256: plan.sha256,
      expectedrevision: 8,
      acceptaclremoval: true,
      acceptnfsservicewide: true
    }), expect.anything())
    expect(wrapper.vm.operation.originalfailure.code).toBe('DRAIN_REQUIRED')
    expect(wrapper.vm.secrets).toEqual({})
    wrapper.unmount()
  })
})

describe('actual API rejection reaches the restore UI', () => {
  beforeEach(() => { postAPI.mockReset(); getAPI.mockReset() })

  test('INSPECT keeps the exact blocking reason and listener guidance, with no apply request', async () => {
    postAPI.mockImplementation(async (api, args) => {
      if (args.action === 'LIST') return wire({ artifacts: [artifact] })
      throw Object.assign(new Error('Request failed with status code 431'), {
        response: { status: 431, data: errorWire.manageStorageConfigArtifact }
      })
    })
    const wrapper = mount()
    await flushPromises()
    await wrapper.vm.openReview(artifact)
    await flushPromises()
    expect(postAPI).toHaveBeenLastCalledWith('manageStorageConfigArtifact', expect.objectContaining({
      action: 'INSPECT', artifactid: 'backup', protocols: 'NFS'
    }), expect.objectContaining({ preserveOnFailure: true }))
    expect(wrapper.text()).toContain('RESTORE_EXPLICIT_LISTENER_REQUIRED')
    expect(wrapper.text()).toContain(ko['message.sharedfs.config.explicit.listener.required'])
    expect(wrapper.vm.canPlan).toBe(false)
    expect(wrapper.vm.plan).toBeNull()
    expect(postAPI.mock.calls.some(([api]) => api === 'applyStorageConfigRestore')).toBe(false)
    wrapper.unmount()
  })

  test('apply rejection preserves drain reason, clears secrets and never resubmits', async () => {
    postAPI.mockResolvedValue(wire({ artifacts: [artifact] }))
    const wrapper = mount()
    await flushPromises()
    await wrapper.setData({ mode: 'review', plan, acceptNfs: true, acceptAcl: true, secrets: { transient: 'test-only' } })
    postAPI.mockRejectedValue(Object.assign(new Error('Request failed with status code 431'), {
      response: { status: 431, data: errorWire.applyStorageConfigRestore }
    }))
    await wrapper.vm.apply()
    await flushPromises()
    expect(wrapper.text()).toContain('DRAIN_REQUIRED')
    expect(wrapper.vm.operation.state).toBe('SUBMISSION_UNCONFIRMED')
    expect(wrapper.vm.secrets).toEqual({})
    expect(postAPI.mock.calls.filter(([api]) => api === 'applyStorageConfigRestore')).toHaveLength(1)
    wrapper.unmount()
  })

  test('generic API and transport errors retain their original guidance', async () => {
    postAPI.mockResolvedValue(wire({ artifacts: [] }))
    const wrapper = mount()
    await flushPromises()
    await wrapper.vm.run(async () => { throw Object.assign(new Error('API error'), { response: { data: { errorresponse: { errortext: 'ACCESS_DENIED' } } } }) })
    expect(wrapper.text()).toContain('ACCESS_DENIED')
    await wrapper.vm.run(async () => { throw new Error('Network Error') }, true)
    expect(wrapper.vm.dialogError).toBe('Network Error')
    expect(wrapper.vm.busy).toBe(false)
    wrapper.unmount()
  })
})

describe('native SystemVM traversal evidence through actual API review serialization', () => {
  const smbArtifact = { id: 'native-backup', metadata: { coverage: { SMB: 'OBSERVED' } } }
  const table = {
    props: ['dataSource', 'columns'],
    data: () => ({ column: { key: 'followup' }, verifiedColumn: { key: 'verified' } }),
    template: '<table><tbody><tr v-for="row in dataSource" :key="row.resourceUuid || row.id"><td>{{ row.name }}</td><td><slot name="bodyCell" :column="verifiedColumn" :record="row" /></td><td><slot name="bodyCell" :column="column" :record="row" /></td></tr></tbody></table>'
  }
  beforeEach(() => { postAPI.mockReset(); getAPI.mockReset() })

  test('renders verified share and pending preparation from the real serializer, then sends one approved plan', async () => {
    postAPI.mockImplementation(async (api, args) => {
      if (args.action === 'LIST') return wire({ artifacts: [smbArtifact] })
      if (args.action === 'INSPECT') return wire({ sources: [], targets: ['10.10.13.227'] })
      if (args.action === 'PLAN') return smbReviewWire
      if (api === 'applyStorageConfigRestore') return { applystorageconfigrestoreresponse: { jobid: 'job' } }
      throw new Error('Unexpected API')
    })
    getAPI.mockResolvedValue({ liststorageserviceconfigurationoperationsresponse: { configurationoperation: [op] } })
    const wrapper = mount({ 'a-table': table, 'a-tag': { template: '<span><slot /></span>' } })
    await flushPromises()
    await wrapper.vm.openReview(smbArtifact)
    await wrapper.vm.review()
    await flushPromises()
    expect(wrapper.vm.scope).toEqual(['SMB'])
    expect(wrapper.text()).toContain('psmb1462')
    expect(wrapper.text()).toContain(ko['message.sharedfs.config.smb.pending'])
    expect(wrapper.vm.plan.smbParents[0]).toMatchObject({
      code: 'SMB_PARENT_TRAVERSAL_OK', bindingPending: true, accountPending: true, inode: 4194432
    })
    expect(wrapper.vm.canSubmit).toBe(false)
    const field = wrapper.vm.credentialFields[0]
    await wrapper.setData({ secrets: { [field.key]: 'test-only-secret' } })
    expect(wrapper.vm.canSubmit).toBe(true)
    const approved = wrapper.vm.plan
    await wrapper.vm.apply()
    expect(postAPI.mock.calls.filter(([api]) => api === 'applyStorageConfigRestore')).toHaveLength(1)
    expect(postAPI).toHaveBeenLastCalledWith('applyStorageConfigRestore', expect.objectContaining({
      expectedrevision: 9, planid: approved.id, sha256: approved.sha256
    }), expect.anything())
    expect(wrapper.vm.secrets).toEqual({})
    wrapper.unmount()
  })

  test('a share awaiting its first ACL is shown as unpublished', async () => {
    postAPI.mockResolvedValue(wire({ artifacts: [] }))
    const wrapper = mount({ 'a-table': table, 'a-tag': { template: '<span><slot /></span>' } })
    await flushPromises()
    const value = JSON.parse(JSON.stringify(smbReviewWire.managestorageconfigartifactresponse.storageconfigartifact.result))
    value.smbParents[0].code = 'SMB_PARENT_TRAVERSAL_PENDING_ACL'
    value.smbParents[0].accountPending = false
    value.smbParents[0].bindingPending = false
    await wrapper.setData({ mode: 'review', scope: ['SMB'], plan: value })
    expect(wrapper.text()).toContain(ko['label.sharedfs.config.smb.no.acl'])
    expect(wrapper.findAll('span').map(node => node.text())).not.toContain(ko['label.sharedfs.config.smb.verified'])
    wrapper.unmount()
  })

  test('missing SMB proof disables apply and gives runtime update guidance', async () => {
    postAPI.mockResolvedValue(wire({ artifacts: [] }))
    const wrapper = mount()
    await flushPromises()
    const value = { ...plan, smbParents: undefined }
    await wrapper.setData({ mode: 'review', scope: ['SMB'], plan: value, acceptNfs: true, acceptAcl: true })
    expect(wrapper.vm.canSubmit).toBe(false)
    expect(wrapper.text()).toContain(ko['message.sharedfs.config.smb.review.required'])
    wrapper.unmount()
  })

  test('review denial keeps its exact reason before any apply', async () => {
    postAPI.mockImplementation(async (api, args) => {
      if (args.action === 'LIST') return wire({ artifacts: [smbArtifact] })
      if (args.action === 'INSPECT') return wire({ sources: [], targets: ['10.10.13.227'] })
      throw Object.assign(new Error('API error'), {
        response: {
          data: {
            managestorageconfigartifactresponse: { errorcode: 431, errortext: 'SMB_PARENT_TRAVERSAL_DENIED' }
          }
        }
      })
    })
    const wrapper = mount()
    await flushPromises()
    await wrapper.vm.openReview(smbArtifact)
    await wrapper.vm.review()
    expect(wrapper.text()).toContain('SMB_PARENT_TRAVERSAL_DENIED')
    expect(wrapper.text()).toContain(ko['message.sharedfs.config.smb.denied'])
    expect(wrapper.vm.plan).toBeNull()
    expect(postAPI.mock.calls.some(([api]) => api === 'applyStorageConfigRestore')).toBe(false)
    wrapper.unmount()
  })
})
