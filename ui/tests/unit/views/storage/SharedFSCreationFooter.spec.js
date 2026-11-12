// Licensed under the Apache License, Version 2.0. See the NOTICE file.
import { shallowMount, flushPromises } from '@vue/test-utils'
import Autogen from '@/views/AutogenView'
import Create from '@/views/storage/CreateSharedFS'
import SharedFSFormDialog from '@/components/storage/SharedFSFormDialog'
import MoldDialogActions from '@/components/view/MoldDialogActions'
import storage from '@/config/section/storage'
import store from '@/store'
import { getAPI, postAPI } from '@/api'

jest.mock('@/api', () => ({ getAPI: jest.fn(), postAPI: jest.fn(), callAPI: jest.fn() }))
jest.mock('@/store', () => ({ getters: {}, state: { app: { device: 'desktop' }, user: { token: 'session' } } }))
const section = storage.children.find(s => s.name === 'sharedfs')
const action = section.actions.find(a => a.api === 'createSharedFileSystem')
const container = { template: '<div><slot /></div>' }
const button = { props: ['disabled', 'loading', 'type'], emits: ['click'], template: '<button :data-type="type" :disabled="disabled || loading" @click="$emit(\'click\')"><slot /></button>' }
const modal = { props: ['visible'], template: '<section v-if="visible" data-test="modal"><header><slot name="title" /></header><main><slot /></main><footer><slot name="footer" /></footer></section>' }
let w
beforeEach(() => {
  jest.clearAllMocks()
  sessionStorage.clear()
  global.crypto = require('crypto').webcrypto
  store.getters = { project: {}, userInfo: { id: 'admin', roletype: 'Admin', domainid: 'domain', account: 'admin' }, customColumns: {}, defaultListViewPageSize: 20, apis: { listSharedFileSystems: { params: [], response: [] }, createSharedFileSystem: { params: [] } } }
  jest.spyOn(Create.methods, 'fetchData').mockResolvedValue()
  jest.spyOn(Create.computed, 'computeOfferingReady').mockReturnValue(true)
})
afterEach(() => { if (w) w.unmount(); document.body.innerHTML = ''; jest.restoreAllMocks() })
async function render () {
  const View = { ...Autogen, created () {}, mounted () {}, beforeUnmount () {}, methods: { ...Autogen.methods, fetchData: jest.fn() } }
  w = shallowMount(View, {
    attachTo: document.body,
    global: {
      mocks: { $store: store, $route: { name: 'sharedfs', path: '/sharedfs', fullPath: '/sharedfs', params: {}, query: {}, meta: { ...section, name: 'sharedfs' } }, $router: { push: jest.fn(), replace: jest.fn() }, $t: k => k, $config: { theme: {}, docBase: '' }, $i18n: { locale: 'ko_KR' }, $showIcon: () => false, $applyDocHelpMappings: x => x, $getApiParams: () => new Proxy({}, { get: () => ({ description: '' }) }), $notifyError: jest.fn(), $message: { info: jest.fn(), error: jest.fn() }, $notification: { info: jest.fn(), error: jest.fn() } },
      stubs: { AAffix: container, ACard: container, ARow: container, ACol: container, ATooltip: container, AButton: button, ASpin: container, AForm: { template: '<form><slot /></form>' }, AFormItem: container, ACollapse: container, ACollapsePanel: container, Breadcrumb: { template: '<nav><slot name="end" /></nav>' }, KeepAlive: container, AsyncComponentWrapper: false, CreateSharedFS: false, SharedFSFormDialog: false, MoldDialogActions: false, teleport: false, AModal: modal, ResourceView: true, ListView: true, SearchView: { template: '<div />' } }
    }
  })
  await w.setData({ showAction: true, currentAction: action, resource: {}, actions: section.actions, dataView: false, loading: false })
  await flushPromises()
}
test('production Autogen action keeps legacy width and real CreateSharedFS body while only buttons teleport to its footer', async () => {
  await render()
  expect(action.fixedFormFooter).toBe(true)
  expect(action.standardDialogSize).toBeUndefined()
  const shell = w.findComponent(SharedFSFormDialog)
  expect(shell.exists()).toBe(true)
  expect(shell.attributes('width')).toBe('auto')
  const create = w.findComponent(Create)
  expect(create.exists()).toBe(true)
  expect(shell.find('main .sharedfs-create-layout').exists()).toBe(true)
  expect(shell.find('main .sharedfs-create-summary').exists()).toBe(true)
  expect(shell.find('main .sharedfs-create-config').exists()).toBe(true)
  expect(create.findComponent(MoldDialogActions).exists()).toBe(true)
  expect(shell.findAll('footer button')).toHaveLength(2)
  expect(shell.find('main button[data-type="primary"]').exists()).toBe(false)
  expect(shell.findAll('footer button')[0].text()).toBe('label.cancel')
  expect(shell.findAll('footer button')[1].text()).toBe('label.ok')
  expect(postAPI).not.toHaveBeenCalled()
})
test('loading keeps duplicate-submit protection and retains cancel ownership; reentry has exactly one new footer', async () => {
  await render()
  let create = w.findComponent(Create)
  await create.setData({ loading: true })
  expect(w.findAll('footer button')[1].attributes('disabled')).toBeDefined()
  expect(w.findAll('footer button')[0].attributes('disabled')).toBeUndefined()
  await w.findAll('footer button')[0].trigger('click')
  expect(w.vm.showAction).toBe(false)
  await w.setData({ currentAction: { ...action }, showAction: true })
  await flushPromises()
  create = w.findComponent(Create)
  expect(create.exists()).toBe(true)
  expect(w.findAll('footer button')).toHaveLength(2)
  expect(w.findAll('.sharedfs-create-footer')).toHaveLength(1)
  expect(postAPI).not.toHaveBeenCalled()
})
test('ordinary VM action does not get the SharedFS footer adapter', async () => {
  await render()
  w.vm.currentAction = { api: 'updateVirtualMachine', component: { template: '<div>unchanged VM form</div>' }, label: 'vm update' }
  await flushPromises()
  expect(w.findComponent(SharedFSFormDialog).exists()).toBe(false)
  expect(w.find('[data-test="modal"]').text()).toContain('vm update')
  expect(getAPI).not.toHaveBeenCalled()
})
