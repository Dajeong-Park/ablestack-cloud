// Licensed to the Apache Software Foundation (ASF) under one or more
// contributor license agreements. See NOTICE. Apache License, Version 2.0.
import { mount, shallowMount, flushPromises } from '@vue/test-utils'
import { h } from 'vue'
import Table from '@/components/storage/StorageNfsListenerTable'
import SharedFSTab from '@/views/storage/SharedFSTab'
import { buildNfsListenerPresentation as build } from '@/utils/storageNfsListenerPresentation'
import ko from '@public/locales/ko_KR.json'
import observed from '../fixtures/storage-1463-observed.json'
import { getAPI, postAPI } from '@/api'
jest.mock('@/api', () => ({ getAPI: jest.fn(), postAPI: jest.fn() }))

const copy = x => JSON.parse(JSON.stringify(x))
const sample = (index = 0) => ({ ...copy(observed[index]), now: Date.parse(observed[index].inventory.generatedAt) + 1000 })
const t = key => ko[key] || key
describe('actual NFS listener table and SharedFSTab integration', () => {
  const wrappers = []
  afterEach(() => { wrappers.splice(0).forEach(w => w.unmount()); jest.restoreAllMocks(); jest.useRealTimers() })
  const render = (data = sample()) => {
    const w = mount(Table, { props: { model: build(data), scope: 'instance', refreshing: false }, global: { mocks: { $t: t } } })
    wrappers.push(w); return w
  }
  test('renders the captured DUAL protocol and read-only details with the complete endpoint', async () => {
    const w = render(sample(2))
    expect(w.text()).toContain('NFSv3')
    expect(w.text()).toContain('NFSv4')
    expect(w.text()).toContain('10.10.13.187')
    await w.findAll('button').find(x => x.text() === '상세').trigger('click'); await flushPromises()
    expect(document.body.textContent).toContain('NFS 리스너 관측 상세')
    expect(document.body.textContent).toContain('10.10.13.187:2049')
    expect(postAPI).not.toHaveBeenCalled()
  })
  test('keeps the same row node during refresh and unavailable observation; changing scope closes details', async () => {
    const raw = sample(); const w = render(raw)
    const row = w.find('tr[data-row-key]').element
    await w.setProps({ refreshing: true })
    expect(w.find('tr[data-row-key]').element).toBe(row)
    await w.setProps({ refreshing: false, model: build({ ...raw, readState: { errors: { health: true, inventory: true } } }) })
    expect(w.find('tr[data-row-key]').element).toBe(row)
    expect(w.text()).toContain('조회 실패')
    w.vm.open(w.props('model').groups[0].key); await flushPromises()
    expect(w.vm.visible).toBe(true)
    await w.setProps({ scope: 'another-instance' })
    expect(w.vm.visible).toBe(false)
  })
  test('never shows an unsupported observed mode as NFSv4', async () => {
    const raw = sample()
    raw.inventory.nfsGaneshaExports[0].protocolMode = 'NEW_MODE'
    raw.health.nfsGanesha.endpoints[0].protocolMode = 'NEW_MODE'
    const w = render(raw)
    expect(w.text()).not.toContain('NFSv4')
    expect(w.text()).toContain('V4_ONLY')
  })
  test('delete emits the original group tuple, not the alias address, and obeys protection', async () => {
    const raw = sample(); raw.exports = []; raw.protocols[0].linkedresourcecount = 0
    raw.protocols[0].effectiveendpoints = [{ ipaddress: '10.10.13.228', port: 2049, role: 'ALIAS' }]
    const w = render(raw)
    const button = w.findAll('button').find(x => x.text().includes('삭제'))
    expect(button.element.disabled).toBe(false)
    await button.trigger('click')
    expect(w.emitted('delete-group')[0][0]).toMatchObject({ listenIp: '0.0.0.0', port: 2049, protocol: 'NFS', raw: raw.protocols[0] })
    await w.setProps({ model: build({ ...raw, readState: { protected: true } }) })
    expect(w.findAll('button').find(x => x.text().includes('삭제')).element.disabled).toBe(true)
  })
  test('the actual AntD table paginates all 100 groups and preserves fixed operation columns', async () => {
    const raw = sample(); const p = raw.protocols[0]; const runtime = raw.inventory.nfsGaneshaExports[0]
    raw.protocols = Array.from({ length: 100 }, (_, n) => ({ ...p, id: 'g-' + n, port: 2100 + n, effectiveendpoints: [{ ipaddress: '10.10.13.227', port: 2100 + n, role: 'PRIMARY' }] }))
    raw.inventory.nfsGaneshaExports = raw.protocols.map(x => ({ ...runtime, port: x.port }))
    raw.health.nfsGanesha.endpoints = copy(raw.inventory.nfsGaneshaExports)
    const w = render(raw)
    expect(w.findAll('tr[data-row-key]')).toHaveLength(20)
    expect(w.vm.columns.find(x => x.key === 'actions').fixed).toBe('right')
    await w.find('.ant-pagination-item-5').trigger('click'); await flushPromises()
    expect(w.findAll('tr[data-row-key]')).toHaveLength(20)
    expect(w.text()).toContain('2199')
  })
  test('actual SharedFSTab child binding enters the existing delete dialog with the original intent', async () => {
    for (const name of ['fetchData', 'fetchStorageServiceData', 'refreshConfigurationProtection']) jest.spyOn(SharedFSTab.methods, name).mockResolvedValue()
    getAPI.mockResolvedValue({}); postAPI.mockReset()
    const w = shallowMount(SharedFSTab, {
      props: { resource: { id: 'sharedfs', zoneid: 'zone', virtualmachineid: 'vm' } },
      data: () => ({ currentTab: 'nfs' }),
      global: {
        stubs: {
          MoldDialog: { template: '<div />' },
          ATabs: { render () { return h('div', this.$slots.default?.()) } },
          ATabPane: { props: ['tab'], render () { return h('section', this.tab === 'NFS' ? this.$slots.default?.() : []) } }
        },
        provide: { parentFetchData: jest.fn() },
        mocks: {
          $t: t,
          $route: { fullPath: '/sharedfs/sharedfs?tab=nfs', query: { tab: 'nfs' }, params: { id: 'sharedfs' } },
          $router: { push: jest.fn(), replace: jest.fn() },
          $store: { state: { app: { device: 'desktop' } }, getters: { features: {}, apis: { listStorageServiceInstances: {} }, userInfo: { id: 'user' } } },
          $message: { error: jest.fn() },
          $notifyError: jest.fn()
        }
      }
    })
    wrappers.push(w)
    const raw = sample(); raw.protocols[0].linkedresourcecount = 0
    await w.setData({ storageService: { ...w.vm.storageService, instance: { id: 'instance', configurationprotection: false }, protocols: raw.protocols, nfsExports: [], inventory: [{ resultjson: JSON.stringify(raw.inventory) }], health: [{ resultjson: JSON.stringify(raw.health) }] }, nfsObservationNow: raw.now })
    await flushPromises()
    const child = w.findComponent(Table)
    expect(child.exists()).toBe(true)
    const group = child.props('model').groups[0]
    child.vm.$emit('delete-group', group.deleteRecord); await flushPromises()
    expect(w.vm.actionModal.type).toBe('deleteConfirm')
    expect(w.vm.forms.deleteConfirm).toMatchObject({ protocol: 'NFS', listenip: '0.0.0.0', port: 2049 })
    expect(w.vm.configurationIntent).toEqual({ api: 'deleteStorageServiceProtocol', protocol: 'NFS' })
    w.vm.forms.deleteConfirm.confirmation = w.vm.actionModal.context.name
    const submit = jest.spyOn(w.vm, 'runStorageAction').mockResolvedValue()
    await w.vm.deleteStorageResource()
    expect(submit).toHaveBeenCalledWith('enableProtocol', 'deleteStorageServiceProtocol', { instanceid: 'instance', protocol: 'NFS', listenip: '0.0.0.0', port: 2049 }, expect.any(String))
    w.vm.closeActionModal(); await flushPromises()
    expect(postAPI).not.toHaveBeenCalled()
  })
  test('the presentation clock expires without adding a network poll and is released on tab exit', () => {
    jest.useFakeTimers()
    let now = 1000
    jest.spyOn(Date, 'now').mockImplementation(() => now)
    const context = { nfsObservationNow: 0 }
    const update = SharedFSTab.methods.syncNfsObservationClock.bind(context)
    getAPI.mockClear()
    update('nfs'); expect(context.nfsObservationNow).toBe(1000)
    now = 6000; jest.advanceTimersByTime(5000)
    expect(context.nfsObservationNow).toBe(6000)
    update('details'); now = 10000; jest.advanceTimersByTime(10000)
    expect(context.nfsObservationNow).toBe(6000)
    expect(getAPI).not.toHaveBeenCalled()
    expect(jest.getTimerCount()).toBe(0)
  })
})
