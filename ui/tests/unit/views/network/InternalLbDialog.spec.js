// Licensed to the Apache Software Foundation (ASF) under one or more
// contributor license agreements. See NOTICE for copyright ownership.
// Licensed under the Apache License, Version 2.0 (the "License");
// http://www.apache.org/licenses/LICENSE-2.0 . Distributed AS IS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND.
import { shallowMount } from '@vue/test-utils'
import { h, reactive, nextTick } from 'vue'
import Dialog from '@/views/network/InternalLbDialog.vue'
import Picker from '@/views/network/InternalLbCreateForm.vue'
import { internalLbApis, internalLbIp, internalLbSuitable } from '@/utils/internalLb'
import { getAPI, postAPI } from '@/api'
import eventBus from '@/config/eventBus'
jest.mock('@/api', () => ({ getAPI: jest.fn(), postAPI: jest.fn() }))
jest.mock('uuid', () => ({ v4: () => '00000000-0000-4000-8000-000000000001' }))
const vpc = { id: 'vpc', projectid: 'project', name: 'VPC', state: 'Enabled' }
const network = { id: 'net', projectid: 'project', vpcid: 'vpc', networkofferingid: 'offering', cidr: '10.0.0.0/24', gateway: '10.0.0.1', service: [{ name: 'Lb', capability: [{ name: 'LbSchemes', value: 'Internal' }], provider: [{ name: 'InternalLbVm' }] }] }
const offering = { id: 'offering', state: 'Enabled', supportsinternallb: true, service: network.service }
const rule = { id: 'lb', projectid: 'project', networkid: 'net', sourceipaddressnetworkid: 'net', name: 'Review' }
const vm = { id: 'vm', name: 'VM', state: 'Running', projectid: 'project', nic: [{ networkid: 'net', ipaddress: '10.0.0.5', secondaryip: [{ ipaddress: '10.0.0.6' }] }] }
const drain = async () => { for (let i = 0; i < 30; i++) { await Promise.resolve(); await nextTick() } }
const slot = { render () { return h('div', this.$slots.default?.()) } }
const mold = { props: ['visible'], render () { return this.visible ? h('section', [this.$slots.default?.(), h('footer', this.$slots.footer?.())]) : null } }
let wrappers, outcome, bound, mode, fail
function lookup (cmd, p) {
  if (cmd === fail) return Promise.reject(Error('503 unavailable'))
  if (cmd === 'queryAsyncJobResult') return Promise.resolve({ queryasyncjobresultresponse: { jobid: p.jobid, cmd: mode === 'create' ? 'CreateApplicationLoadBalancerCmd' : 'AssignToLoadBalancerRuleCmd', jobstatus: outcome, jobresult: outcome === 2 ? { errorcode: 431, errortext: 'No available address' } : { loadbalancer: { ...rule, name: 'Review' } } } })
  const rows = { listNetworks: ['network', [network]], listVPCs: ['vpc', [vpc]], listNetworkOfferings: ['networkoffering', [offering]], listVirtualMachines: ['virtualmachine', [vm]], listLoadBalancers: ['loadbalancer', [rule]], listNics: ['nic', vm.nic], listLoadBalancerRuleInstances: ['lbrulevmidip', bound ? [{ loadbalancerruleinstance: vm, lbvmipaddresses: ['10.0.0.5'] }] : []] }[cmd]
  return Promise.resolve({ [cmd.toLowerCase() + 'response']: { [rows[0]]: rows[1] } })
}
beforeEach(() => { jest.clearAllMocks(); sessionStorage.clear(); wrappers = []; outcome = 1; bound = false; fail = ''; getAPI.mockImplementation(lookup); postAPI.mockImplementation((cmd, p) => { if (cmd === 'assignToLoadBalancerRule') bound = true; return Promise.resolve({ [cmd.toLowerCase() + 'response']: { jobid: p.customjobid, id: 'lb' } }) }) })
afterEach(() => { wrappers.forEach(w => w.unmount()); jest.restoreAllMocks(); jest.useRealTimers() })
async function open (type = 'create', project = 'project') {
  mode = type
  const getters = reactive({ project: { id: project }, userInfo: { id: 'user', roleid: 'role', roletype: 'Admin' }, apis: Object.fromEntries(internalLbApis(type).map(k => [k, {}])) }); const route = reactive({ path: '/vpc/vpc' }); const state = reactive({ user: { token: 'session' } })
  const w = shallowMount(Dialog, { props: { resource: type === 'create' ? { ...vpc } : { ...rule }, mode: type, tierId: type === 'create' ? 'net' : '' }, global: { mocks: { $t: k => k, $store: { getters, state }, $route: route }, stubs: { MoldDialog: mold, ASpin: slot, AForm: { methods: { validate: () => Promise.resolve() }, render () { return h('form', this.$slots.default?.()) } } } } }); wrappers.push(w); await drain()
  w.vm.draft = { name: 'Review', description: 'retained', sourceIP: '', sourcePort: 19012, instancePort: 22, algorithm: 'source' }; if (type === 'assign') w.vm.selectVm(vm, true)
  return { w, getters, route, state }
}
test.each(['create', 'assign'])('%s closes only on verified success', async type => { const { w } = await open(type); await w.vm.submit(); expect(w.vm.closed).toBe(true); expect(w.emitted('success')).toHaveLength(1); expect(postAPI).toHaveBeenCalledTimes(1); expect(sessionStorage.length).toBe(0) })
test.each(['create', 'assign'])('%s rejected request retains inputs and selection', async type => { const { w } = await open(type); const draft = { ...w.vm.draft }; const selected = { ...w.vm.selected }; postAPI.mockRejectedValueOnce({ response: { status: 431, data: { errorresponse: { errorcode: 431, errortext: 'Rejected' } } } }); await w.vm.submit(); expect(w.vm.closed).toBe(false); expect(w.vm.jobId).toBe(''); expect(w.vm.draft).toEqual(draft); expect(w.vm.selected).toEqual(selected); expect(w.vm.error).toContain('431: Rejected'); await w.vm.submit(); expect(w.vm.closed).toBe(true) })
test.each(['create', 'assign'])('%s asynchronous failure retains editable draft', async type => { const { w } = await open(type); outcome = 2; await w.vm.submit(); expect(w.vm.closed).toBe(false); expect(w.vm.jobId).toBe(''); expect(w.vm.error).toContain('No available'); expect(w.vm.draft.description).toBe('retained'); expect(w.vm.fieldsDisabled).toBe(false) })
test.each(['create', 'assign'])('%s blocks duplicate click, Ctrl Enter and close while dispatching', async type => { const { w } = await open(type); let finish; postAPI.mockImplementationOnce((cmd, p) => new Promise(resolve => { finish = () => { bound = true; resolve({ [cmd.toLowerCase() + 'response']: { jobid: p.customjobid } }) } })); const pending = w.vm.submit(); await drain(); await w.vm.submit(); w.vm.close(); expect(postAPI).toHaveBeenCalledTimes(1); expect(w.vm.closed).toBe(false); expect(w.vm.blocksNavigation).toBe(true); finish(); await pending; expect(w.vm.closed).toBe(true) })
test.each(['create', 'assign'])('%s unknown job rechecks without a second POST and persists receipt', async type => { const { w } = await open(type); w.vm.tracker = { track: jest.fn().mockResolvedValue({ jobstatus: null }), clear: jest.fn() }; await w.vm.submit(); const id = w.vm.jobId; expect(id).not.toBe(''); expect(w.vm.fieldsDisabled).toBe(true); await w.vm.submit(); expect(postAPI).toHaveBeenCalledTimes(1); expect(w.vm.tracker.track).toHaveBeenLastCalledWith(id, {}, true); expect(JSON.parse(sessionStorage.getItem(w.vm.entryKey)).draft.description).toBe('retained') })
test('lost dispatch receipt recovers custom job without replay', async () => { const { w } = await open(); postAPI.mockRejectedValueOnce(Error('connection lost')); await w.vm.submit(); expect(w.vm.closed).toBe(true); expect(postAPI).toHaveBeenCalledTimes(1) })
test.each(['project', 'route', 'user', 'role', 'token', 'permission'])('%s transition ignores a late receipt', async change => { const { w, getters, route, state } = await open(); let finish; postAPI.mockImplementationOnce(() => new Promise(resolve => { finish = resolve })); const pending = w.vm.submit(); await drain(); if (change === 'project') getters.project.id = 'other'; if (change === 'route') route.path = '/vm'; if (change === 'user') getters.userInfo.id = 'other'; if (change === 'role') getters.userInfo.roleid = 'other'; if (change === 'token') state.user.token = 'other'; if (change === 'permission') delete getters.apis.createLoadBalancer; await drain(); finish({ createloadbalancerresponse: { jobid: 'late' } }); await pending; expect(w.vm.closed).toBe(true); expect(w.emitted('success')).toBeUndefined(); expect(getAPI.mock.calls.filter(([c]) => c === 'queryAsyncJobResult')).toHaveLength(0) })
test('project switch closes before metadata changes', async () => { const { w } = await open(); eventBus.emit('project-switch-start'); expect(w.vm.closed).toBe(true) })
test('foreign project cannot submit', async () => { const { w } = await open('create', 'foreign'); await w.vm.submit(); expect(postAPI).not.toHaveBeenCalled() })
test('candidate lookup failure blocks mutation until reload', async () => { const { w } = await open(); fail = 'listNetworks'; await w.vm.load(); await w.vm.submit(); expect(postAPI).not.toHaveBeenCalled(); expect(w.vm.loadError).not.toBe(''); fail = ''; await w.vm.load(); await w.vm.submit(); expect(w.vm.closed).toBe(true) })
test('fresh missing NIC keeps selection and prevents assign', async () => { const { w } = await open('assign'); getAPI.mockImplementation((c, p) => c === 'listNics' ? Promise.resolve({ listnicsresponse: {} }) : lookup(c, p)); await w.vm.submit(); expect(postAPI).not.toHaveBeenCalled(); expect(w.vm.selected.vm).toEqual(['10.0.0.5']); expect(w.vm.closed).toBe(false) })
test('VM identity selection survives filtering and refresh', async () => { const { w } = await open('assign'); w.vm.search = 'missing'; expect(w.vm.filteredVms).toEqual([]); await w.vm.load(); expect(w.vm.selected.vm).toEqual(['10.0.0.5']); w.vm.search = 'vm'; expect(w.vm.filteredVms).toHaveLength(1) })
test('already bound primary is excluded but secondary remains eligible', async () => { bound = true; const { w } = await open('assign'); expect(w.vm.options(w.vm.vms[0])).toEqual(['10.0.0.6']) })
test('storage failure blocks dispatch', async () => { const { w } = await open(); jest.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => { throw Error('quota') }); await w.vm.submit(); expect(postAPI).not.toHaveBeenCalled(); expect(w.vm.jobId).toBe('') })
test.each(['10.0.1.5', '10.0.0.0', '10.0.0.255', '10.0.0.1', '10.0.0.256', '10.00.0.5'])('invalid source %s is rejected locally', ip => expect(internalLbIp(ip, network)).toBe(false))
test('automatic or CIDR host source permitted; provider mismatch rejected', () => { expect(internalLbIp('', network)).toBe(true); expect(internalLbIp('10.0.0.5', network)).toBe(true); expect(internalLbSuitable(network, offering)).toBe(true); expect(internalLbSuitable(network, { ...offering, service: [{ name: 'Lb', provider: [{ name: 'Other' }] }] })).toBe(false) })

test.each(['create', 'assign'])('%s command-specific API error preserves editable inputs', async type => { const { w } = await open(type); postAPI.mockImplementationOnce(cmd => Promise.reject(Object.assign(new Error('Rejected'), { response: { status: 533, data: { [cmd.toLowerCase() + 'response']: { errorcode: 533, errortext: 'IP already allocated' } } } }))); await w.vm.submit(); expect(w.vm.jobId).toBe(''); expect(w.vm.closed).toBe(false); expect(w.vm.fieldsDisabled).toBe(false); expect(w.vm.error).toContain('533: IP already allocated') })

async function picker () {
  const getters = reactive({ userInfo: { id: 'user' }, project: { id: 'project' }, apis: Object.fromEntries(internalLbApis('create').map(k => [k, {}])) }); const route = reactive({ path: '/ilb' })
  const w = shallowMount(Picker, { global: { mocks: { $t: k => k, $store: { getters }, $route: route }, stubs: { MoldDialog: mold, AForm: slot } } }); wrappers.push(w); await drain(); return { w, getters }
}
test('list-route picker selects an Internal Tier and reuses the same create dialog', async () => { const { w } = await picker(); expect(w.vm.networks).toHaveLength(1); w.vm.selected = 'net'; await w.vm.choose(); expect(w.vm.target).toEqual({ vpc, network }); expect(postAPI).not.toHaveBeenCalled() })
test('picker excludes Public-only and foreign-project networks', async () => { getAPI.mockImplementation((c, p) => c === 'listNetworks' ? Promise.resolve({ listnetworksresponse: { network: [{ ...network, service: [] }, { ...network, id: 'foreign', projectid: 'foreign' }] } }) : lookup(c, p)); const { w } = await picker(); expect(w.vm.networks).toEqual([]) })
test('picker cancels pending lookup on project switch', async () => { const { w, getters } = await picker(); let finish; getAPI.mockImplementationOnce(() => new Promise(resolve => { finish = resolve })); const pending = w.vm.load(); getters.project.id = 'other'; await drain(); finish({ listnetworksresponse: { network: [network] } }); await pending; expect(w.vm.closed).toBe(true); expect(w.vm.target).toBe(null); expect(w.emitted('close-action')).toHaveLength(1) })
