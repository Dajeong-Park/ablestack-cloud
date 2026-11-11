// Licensed under the Apache License, Version 2.0. See the NOTICE file.
import { mount, flushPromises } from '@vue/test-utils'
import SharedFSTab from '@/views/storage/SharedFSTab'
import { Tabs, Button } from 'ant-design-vue'
import { postAPI } from '@/api'

jest.mock('@/api', () => ({ getAPI: jest.fn(), postAPI: jest.fn() }))
const container = { template: '<div><slot /></div>' }
const button = { props: ['type', 'disabled', 'loading'], emits: ['click'], template: '<button :data-type="type" :disabled="disabled || loading" @click="$emit(\'click\')"><slot /></button>' }
let w
beforeEach(() => {
  jest.clearAllMocks()
  for (const method of ['fetchData', 'fetchStorageServiceData', 'fetchDiskOfferings', 'fetchStoragePools']) jest.spyOn(SharedFSTab.methods, method).mockResolvedValue()
  jest.spyOn(SharedFSTab.methods, 'openActionModal').mockImplementation(() => {})
})
afterEach(() => { if (w) w.unmount(); jest.restoreAllMocks() })
async function render (volumeStats = false, realButtons = false) {
  const apis = Object.fromEntries(['listStorageServiceInstances', 'listStorageDirectoryPolicies', 'listStorageSmbServiceNames', 'getStorageSmbServiceNameContext', 'manageStorageConfigArtifact', 'listStorageServiceConfigurationOperations', 'getStorageServiceRuntimeUpgradeCapabilities', 'listNics', 'listEvents'].map(x => [x, {}]))
  const View = { ...SharedFSTab, components: { ...SharedFSTab.components, ATabs: Tabs, ATabPane: Tabs.TabPane, AButton: Button } }
  w = mount(View, {
    props: { resource: { id: 'sharedfs', state: 'Ready', zoneid: 'zone', volumeid: 'data', filesystem: 'xfs' } },
    global: {
      provide: { parentFetchData: jest.fn() },
      mocks: { $t: key => key, $route: { query: { tab: 'nfs' }, params: { id: 'sharedfs' }, fullPath: '/sharedfs/sharedfs?tab=nfs' }, $router: { replace: jest.fn(), push: jest.fn() }, $store: { state: { app: { device: 'desktop' } }, getters: { apis, features: { instancesdisksstatsretentionenabled: volumeStats }, userInfo: { id: 'admin' } } } },
      stubs: { ...Object.fromEntries(Object.keys(SharedFSTab.components).filter(name => !['ATabs', 'ATabPane', ...(realButtons ? ['ReloadOutlined', 'LoadingOutlined'] : [])].includes(name)).map(name => [name, true])), ATabs: false, ATabPane: false, 'a-tabs': false, 'a-tab-pane': false, 'a-table': container, AAlert: { props: ['message', 'description', 'type'], template: '<aside :data-type="type">{{ message }}</aside>' }, ASpace: container, AButton: realButtons ? false : button, 'a-button': realButtons ? false : button, MoldDialog: { props: ['visible'], template: '<div v-if="visible" />' } }
    }
  })
  w.vm.storageService.instance = { id: 'instance', configurationrevision: 23, configurationprotection: false }
  await w.setData({ currentTab: 'nfs' })
  await flushPromises()
}
test('actual tab component exposes the requested order and keeps the existing selected deep-link', async () => {
  await render()
  expect(w.findAll('[role="tab"]').map(p => p.text())).toEqual([
    'label.details', 'NFS', 'SMB', 'iSCSI', 'NVMe-oF', 'label.storage.capacity.tab', 'label.storage.directory.tab', 'label.storage.smb.names.tab', 'label.sharedfs.config.backup', 'label.storage.configuration.history', 'label.storage.runtime.tab', 'label.storage.boot.tab', 'label.networks', 'label.metrics', 'label.events'
  ])
  expect(w.vm.currentTab).toBe('nfs')
  expect(w.findAll('.protocol-header')).toHaveLength(0)
})
test('optional volume metrics remain beside metrics and before final events', async () => {
  await render(true)
  expect(w.findAll('[role="tab"]').slice(-3).map(p => p.text())).toEqual(['label.volume.metrics', 'label.metrics', 'label.events'])
})
test.each([
  ['NFS', 'nfsExport', 'label.storage.service.create.nfs.export'],
  ['SMB', 'smbShare', 'label.storage.service.create.smb.share'],
  ['iSCSI', 'iscsiTarget', 'label.storage.service.create.iscsi.target'],
  ['NVMe-oF', 'nvmeSubsystem', 'label.storage.service.create.nvme.subsystem']
])('%s toolbar keeps primary creation first, update with icon and wide last, routing to the unchanged action', async (tab, action, label) => {
  await render()
  await w.setData({ currentTab: { NFS: 'nfs', SMB: 'smb', iSCSI: 'iscsi', 'NVMe-oF': 'nvmeof' }[tab] })
  await flushPromises()
  const toolbar = w.find('.ant-tabs-tabpane-active .protocol-toolbar')
  const buttons = toolbar.findAll('button')
  expect(buttons[0].text()).toContain(label)
  expect(buttons[0].attributes('data-type')).toBe('primary')
  expect(buttons.at(-1).text()).toContain('label.storage.service.wide.view')
  expect(buttons.some(b => b.text().includes('label.refresh'))).toBe(true)
  await buttons[0].trigger('click')
  expect(SharedFSTab.methods.openActionModal).toHaveBeenCalledWith(action)
  expect(postAPI).not.toHaveBeenCalled()
})

test.each([['NFS', 'nfs'], ['SMB', 'smb'], ['iSCSI', 'iscsi'], ['NVMe-oF', 'nvmeof']])('%s refresh swaps exactly one icon/spinner and retains content/protection without a progress ribbon', async (label, key) => {
  await render(false, true)
  await w.setData({ currentTab: key })
  w.vm.storageService.loaded = true
  w.vm.storageService.instance.configurationprotection = true
  await flushPromises()
  const body = w.find('.ant-tabs-tabpane-active .storage-protocol-grid').element
  const refresh = () => w.findAll('.ant-tabs-tabpane-active .protocol-toolbar .ant-btn').find(b => b.text().includes('label.refresh'))
  expect(refresh().findAll('.anticon-reload')).toHaveLength(1)
  expect(refresh().findAll('.anticon-loading')).toHaveLength(0)
  w.vm.storageService.loading = true
  w.vm.storageService.refreshing = true
  await w.setData({ storageReadPending: ['inventory'] })
  expect(refresh().findAll('.anticon-reload')).toHaveLength(0)
  expect(refresh().findAll('.anticon-loading')).toHaveLength(1)
  expect(w.find('.sharedfs-detail > .storage-service__alert').exists()).toBe(false)
  expect(w.find('.ant-tabs-tabpane-active .storage-protocol-grid').element).toBe(body)
  expect(w.vm.configurationProtected).toBeTruthy()
  await w.setData({ storageReadErrors: { inventory: 'timeout' } })
  expect(w.find('.sharedfs-detail > .storage-service__alert').exists()).toBe(true)
  w.vm.storageService.loading = false
  w.vm.storageService.refreshing = false
  await flushPromises()
  expect(refresh().findAll('.anticon-reload')).toHaveLength(1)
  expect(refresh().findAll('.anticon-loading')).toHaveLength(0)
  expect(w.vm.configurationProtected).toBeTruthy()
})
