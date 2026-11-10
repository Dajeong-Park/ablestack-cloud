// Licensed to the Apache Software Foundation (ASF) under one or more
// contributor license agreements. See NOTICE for copyright ownership.
// Licensed under the Apache License, Version 2.0 (the "License");
// http://www.apache.org/licenses/LICENSE-2.0 . Distributed AS IS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND.
import { shallowMount } from '@vue/test-utils'
import { h, reactive, nextTick } from 'vue'
import { v4 as uuid } from 'uuid'
import Dialog from '@/views/network/VpcVpnCreate.vue'
import { vpcVpnApis, vpcVpnIps } from '@/utils/vpcVpn'
import eventBus from '@/config/eventBus'
import { getAPI, postAPI } from '@/api'
jest.mock('@/api', () => ({ getAPI: jest.fn(), postAPI: jest.fn() }))
jest.mock('uuid', () => ({ v4: jest.fn() }))
const vpc = { id: 'vpc', name: 'Review', projectid: 'project', state: 'Enabled' }
const gateway = { id: 'gateway', vpcid: 'vpc', projectid: 'project', publicip: '192.0.2.1' }
const customer = { id: 'customer', projectid: 'project', name: 'Peer', gateway: '192.0.2.2', ipsecpsk: 'never-stored' }
const ip = { id: 'ip', vpcid: 'vpc', issourcenat: true, ipaddress: '192.0.2.1' }
const dialog = { props: ['visible', 'closable'], render () { return this.visible ? h('section', [this.$slots.default?.(), h('footer', this.$slots.footer?.())]) : null } }
const button = { props: ['type', 'disabled', 'loading'], render () { return h('button', { class: this.type, disabled: this.disabled || this.loading }, this.$slots.default?.()) } }
const form = { methods: { validate: () => Promise.resolve() }, render () { return h('form', this.$slots.default?.()) } }
const drain = async () => { for (let i = 0; i < 35; i++) { await Promise.resolve(); await nextTick() } }
let wrappers, outcome, serial, kind, lookupFailure, jobFailure
function lookup (command, params) {
  if (lookupFailure === command) return Promise.reject(Error('503 lookup'))
  if (command === 'queryAsyncJobResult') {
    if (jobFailure) return Promise.reject(Error('503 job lookup'))
    return Promise.resolve({ queryasyncjobresultresponse: { jobid: params.jobid, jobstatus: outcome, cmd: kind === 'gateway' ? 'CreateVpnGatewayCmd' : 'CreateVpnConnectionCmd', jobresult: outcome === 2 ? { errorcode: 431, errortext: 'Peer is unavailable' } : kind === 'gateway' ? { vpngateway: gateway } : { vpnconnection: { id: 'connection', projectid: 'project', s2svpngatewayid: 'gateway', s2scustomergatewayid: 'customer' } } } })
  }
  const rows = { listVPCs: ['vpc', [vpc]], listVpnGateways: ['vpngateway', kind === 'gateway' ? [] : [gateway]], listPublicIpAddresses: ['publicipaddress', [ip]], listVpnCustomerGateways: ['vpncustomergateway', [customer]], listVpnConnections: ['vpnconnection', []] }[command]
  return Promise.resolve({ [command.toLowerCase() + 'response']: { [rows[0]]: rows[1] } })
}
beforeEach(() => {
  jest.clearAllMocks(); sessionStorage.clear(); wrappers = []; outcome = 1; serial = 0; lookupFailure = ''; jobFailure = false; kind = 'gateway'
  uuid.mockImplementation(() => '00000000-0000-4000-8000-' + String(++serial).padStart(12, '0'))
  getAPI.mockImplementation(lookup)
  postAPI.mockImplementation((cmd, params) => Promise.resolve({ [cmd.toLowerCase() + 'response']: { jobid: params.customjobid } }))
})
afterEach(() => { wrappers.forEach(w => w.unmount()); jest.restoreAllMocks(); jest.useRealTimers() })
async function open (type = 'gateway', project = 'project') {
  kind = type
  const getters = reactive({ project: { id: project }, userInfo: { id: 'user', roleid: 'role', roletype: 'Admin' }, apis: Object.fromEntries(vpcVpnApis(type).map(k => [k, {}])) })
  const route = reactive({ path: '/vpc/vpc' }); const state = reactive({ user: { token: 'session' } })
  const w = shallowMount(Dialog, { props: { resource: { ...vpc }, kind: type }, global: { mocks: { $t: k => k, $store: { getters, state }, $route: route }, stubs: { MoldDialog: dialog, AButton: button, AForm: form, ASpin: { render () { return h('div', this.$slots.default?.()) } } } } })
  wrappers.push(w); await drain(); return { w, getters, route, state }
}
test.each(['gateway', 'connection'])('%s closes only after job success and refreshes once', async type => {
  const { w } = await open(type)
  await w.vm.submit(); expect(w.vm.closed).toBe(true); expect(w.emitted('success')).toHaveLength(1); expect(w.emitted('cancel')).toHaveLength(1)
  expect(postAPI).toHaveBeenCalledTimes(1); expect(postAPI.mock.calls[0][1]).toMatchObject({ projectid: 'project', ignoreproject: true, customjobid: '00000000-0000-4000-8000-000000000001' })
  expect(sessionStorage.length).toBe(0)
})
test.each(['gateway', 'connection'])('%s job 2 preserves the dialog and draft; corrected retry succeeds', async type => {
  const { w } = await open(type); w.vm.draft.passive = true; outcome = 2
  await w.vm.submit(); expect(w.vm.closed).toBe(false); expect(w.vm.draft).toMatchObject({ ipaddress: type === 'gateway' ? 'ip' : '', customer: type === 'connection' ? 'customer' : '', passive: true })
  expect(w.vm.error).toContain('431: Peer'); expect(w.vm.jobId).toBe(''); expect(w.emitted('success')).toBeUndefined(); expect(w.vm.fieldsDisabled).toBe(false)
  outcome = 1; w.vm.draft.passive = false; await w.vm.submit(); expect(w.vm.closed).toBe(true); expect(postAPI).toHaveBeenCalledTimes(2)
  if (type === 'connection') expect(postAPI.mock.calls[1][1].passive).toBe(false)
})
test.each(['gateway', 'connection'])('%s locks duplicate click, Ctrl Enter and cancellation throughout dispatch/polling', async type => {
  const { w } = await open(type); let finish
  postAPI.mockImplementationOnce((c, p) => new Promise(resolve => { finish = () => resolve({ [c.toLowerCase() + 'response']: { jobid: p.customjobid } }) }))
  const pending = w.vm.submit(); await drain(); await w.vm.submit(); w.vm.close()
  expect(postAPI).toHaveBeenCalledTimes(1); expect(w.vm.closed).toBe(false); expect(w.vm.fieldsDisabled).toBe(true); expect(w.get('footer button.primary').attributes('disabled')).toBeDefined()
  finish(); await pending; expect(w.vm.closed).toBe(true)
})
test.each(['gateway', 'connection'])('%s missing dispatch receipt recovers the preallocated job without replay', async type => {
  const { w } = await open(type); postAPI.mockRejectedValueOnce(Error('network disconnected'))
  await w.vm.submit(); expect(w.vm.closed).toBe(true); expect(postAPI).toHaveBeenCalledTimes(1)
  expect(getAPI).toHaveBeenCalledWith('queryAsyncJobResult', expect.objectContaining({ jobid: '00000000-0000-4000-8000-000000000001' }), expect.any(Object))
})
test.each(['gateway', 'connection'])('%s lookup outage retains the receipt and recheck never resubmits', async type => {
  const { w } = await open(type); w.vm.tracker = { track: jest.fn().mockResolvedValue({ jobstatus: null, trackingStatus: 'unknown' }), clear: jest.fn() }
  await w.vm.submit(); expect(w.vm.closed).toBe(false); expect(w.vm.jobId).not.toBe(''); expect(w.vm.fieldsDisabled).toBe(true)
  const id = w.vm.jobId; await w.vm.submit(); expect(postAPI).toHaveBeenCalledTimes(1); expect(w.vm.tracker.track).toHaveBeenLastCalledWith(id, {}, true)
  expect(JSON.parse(sessionStorage.getItem(w.vm.entryKey)).draft).toEqual({ ...w.vm.draft })
})
test.each(['gateway', 'connection'])('%s rejected API request keeps editable inputs', async type => {
  const { w } = await open(type); postAPI.mockRejectedValueOnce({ response: { status: 530, data: { errorresponse: { errorcode: 431, errortext: 'Duplicate peer' } } } })
  await w.vm.submit(); expect(w.vm.closed).toBe(false); expect(w.vm.jobId).toBe(''); expect(w.vm.error).toContain('431: Duplicate peer'); expect(w.vm.fieldsDisabled).toBe(false)
})
test.each(['gateway', 'connection'])('%s lookup failure blocks mutation until reload and keeps prior selection', async type => {
  const { w } = await open(type); const draft = { ...w.vm.draft }; lookupFailure = type === 'gateway' ? 'listPublicIpAddresses' : 'listVpnCustomerGateways'
  await w.vm.load(); await w.vm.submit(); expect(postAPI).not.toHaveBeenCalled(); expect(w.vm.loadError).toContain('503'); expect(w.vm.draft).toEqual(draft)
  lookupFailure = ''; await w.vm.load(); await w.vm.submit(); expect(w.vm.closed).toBe(true)
})
test.each(['gateway', 'connection'])('%s stale candidate stops before mutation and preserves input', async type => {
  const { w } = await open(type); const draft = { ...w.vm.draft }
  getAPI.mockImplementation((cmd, p) => cmd === (type === 'gateway' ? 'listPublicIpAddresses' : 'listVpnCustomerGateways') ? Promise.resolve({ [cmd.toLowerCase() + 'response']: {} }) : lookup(cmd, p))
  await w.vm.submit(); expect(postAPI).not.toHaveBeenCalled(); expect(w.vm.closed).toBe(false); expect(w.vm.draft).toEqual(draft); expect(w.vm.error).toBe('message.vpc.vpn.changed')
})
test.each(['project', 'route', 'permission', 'user', 'token', 'role', 'resource'])('context change %s discards late callbacks', async change => {
  const { w, getters, route, state } = await open(); let finish
  postAPI.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const pending = w.vm.submit(); await drain()
  if (change === 'project') getters.project = { id: 'another' }
  if (change === 'route') route.path = '/vm'
  if (change === 'permission') delete getters.apis.createVpnGateway
  if (change === 'user') getters.userInfo.id = 'other'
  if (change === 'token') state.user.token = 'new'
  if (change === 'role') getters.userInfo.roleid = 'new'
  if (change === 'resource') await w.setProps({ resource: { ...vpc, id: 'other-vpc' } })
  await drain(); finish({ createvpngatewayresponse: { jobid: 'old' } }); await pending
  expect(w.vm.closed).toBe(true); expect(w.emitted('success')).toBeUndefined(); expect(getAPI.mock.calls.filter(([c]) => c === 'queryAsyncJobResult')).toHaveLength(0)
})
test('project transition closes immediately before the selected project changes', async () => {
  const { w } = await open(); eventBus.emit('project-switch-start'); expect(w.vm.closed).toBe(true); expect(postAPI).not.toHaveBeenCalled()
})
test('pending receipt resumes after reopening; PSK never enters candidate draft or storage', async () => {
  const { w } = await open('connection'); w.vm.jobId = '00000000-0000-4000-8000-000000000001'; w.vm.target = { gateway: 'gateway', customer: 'customer' }; w.vm.persist(); w.vm.close(); w.unmount()
  expect(JSON.stringify(w.vm.customers)).not.toContain('never-stored'); expect(sessionStorage.getItem(w.vm.entryKey)).not.toContain('never-stored')
  const { w: reopened } = await open('connection'); expect(reopened.vm.closed).toBe(true); expect(reopened.emitted('success')).toHaveLength(1); expect(postAPI).not.toHaveBeenCalled()
})
test('unrelated project cannot load or submit a retained receipt', async () => {
  const { w } = await open(); w.vm.jobId = '00000000-0000-4000-8000-000000000001'; w.vm.persist(); w.unmount()
  const { w: other } = await open('gateway', 'other-project'); expect(other.vm.jobId).toBe(''); await other.vm.submit(); expect(postAPI).not.toHaveBeenCalled()
})
test('storage failure prevents dispatch of an untracked mutation', async () => {
  const { w } = await open(); jest.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => { throw Error('quota') })
  await w.vm.submit(); expect(postAPI).not.toHaveBeenCalled(); expect(w.vm.jobId).toBe(''); expect(w.vm.closed).toBe(false)
})
test('foreign job result cannot close the dialog as a success', async () => {
  const { w } = await open(); const query = w.vm.tracker
  getAPI.mockImplementation((cmd, p) => cmd === 'queryAsyncJobResult' ? Promise.resolve({ queryasyncjobresultresponse: { jobid: p.jobid, cmd: 'CreateVpnConnectionCmd', jobstatus: 1, jobresult: { vpngateway: gateway } } }) : lookup(cmd, p))
  // Exercise query validation with retry timers advanced, without real waiting.
  jest.useFakeTimers(); const pending = w.vm.submit(); await drain(); for (let i = 0; i < 5; i++) { jest.advanceTimersByTime(10000); await drain() } await pending
  expect(w.vm.closed).toBe(false); expect(w.vm.jobId).not.toBe(''); expect(w.emitted('success')).toBeUndefined(); query.clear(); jest.useRealTimers()
})
test('provider IP selection preserves router-first and source-NAT contracts within the target VPC', () => {
  expect(vpcVpnIps([ip, { ...ip, id: 'foreign', vpcid: 'other' }], 'vpc')).toEqual([ip])
  const provider = { ...ip, forprovider: true }; const router = { ...provider, id: 'router', issourcenat: false, virtualmachinetype: 'DomainRouter' }
  expect(vpcVpnIps([provider, router], 'vpc')).toEqual([router])
  expect(vpcVpnIps([provider, { ...router, virtualmachinetype: 'Other' }], 'vpc')).toEqual([{ ...router, virtualmachinetype: 'Other' }])
})

test('Ctrl Enter uses the form handler without requiring the legacy submit ref and dispatches once', async () => {
  const { w } = await open(); let finish
  postAPI.mockImplementationOnce((cmd, p) => new Promise(resolve => { finish = () => resolve({ [cmd.toLowerCase() + 'response']: { jobid: p.customjobid } }) }))
  await w.get('form').trigger('keydown', { key: 'Enter', ctrlKey: true }); await drain()
  await w.get('form').trigger('keydown', { key: 'Enter', ctrlKey: true }); await drain()
  expect(postAPI).toHaveBeenCalledTimes(1); finish(); await drain(); expect(w.vm.closed).toBe(true)
})
