// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements. See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership. The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License. You may obtain a copy of the License at
//
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied. See the License for the
// specific language governing permissions and limitations
// under the License.

import { h, reactive, nextTick } from 'vue'
import { shallowMount } from '@vue/test-utils'
import Dialog from '@/views/network/S2sGatewayDialog.vue'
import Connections from '@/views/network/S2sVpnConnectionsTab.vue'
import Value from '@/components/view/S2sGatewayValue.vue'
import { getAPI, postAPI } from '@/api'
import { gatewayName, gatewayConnectionRows, readGatewayDetail, gatewayVisibleColumns, gatewayDeletedListLocation } from '@/utils/s2sGateway'
import { vpnJobMatches } from '@/utils/vpcVpn'
import eventBus from '@/config/eventBus'
import ResourceView from '@/components/view/ResourceView'
import AutogenView from '@/views/AutogenView'

jest.mock('@/api', () => ({ getAPI: jest.fn(), postAPI: jest.fn() }))
jest.mock('uuid', () => ({ v4: () => '00000000-0000-4000-8000-000000000001' }))
jest.mock('@/utils/jobTracker', () => ({ createJobTracker: jest.fn(options => ({ clear: jest.fn(), track: jest.fn(async id => { try { return await options.query(id) } catch (_) { return { jobstatus: null, trackingStatus: 'unknown' } } }) })) }))

const vpc = { id: 'vpc', name: 'Target VPC', state: 'Enabled', account: 'owner', domainid: 'domain', domain: 'ROOT' }
const gateway = { id: '00000000-0000-4000-8000-000000000002', vpcid: 'vpc', vpcname: 'Target VPC', publicip: '192.0.2.1', account: 'owner', domainid: 'domain', domain: 'ROOT', fordisplay: true }
const connection = { id: 'connection', publicip: '192.0.2.1', gateway: '198.51.100.1', s2svpngatewayid: gateway.id, account: 'owner', domainid: 'domain', state: 'Disconnected', ipsecpsk: 'never-retain-this' }
const form = { setup (_, { slots, expose }) { expose({ validate: () => Promise.resolve() }); return () => h('form', slots.default?.()) } }
const button = { props: ['disabled'], setup (props, { slots }) { return () => h('button', { disabled: props.disabled }, slots.default?.()) } }
const dialog = { setup (_, { slots }) { return () => h('section', slots.default?.()) } }
let wrappers, mode, outcome, created, readFailure, queryFailure
const drain = async () => { for (let i = 0; i < 15; i++) { await Promise.resolve(); await nextTick() } }
function getters () { return reactive({ project: {}, userInfo: { id: 'user', account: 'owner', domainid: 'domain', roleid: 'role', roletype: 'Admin' }, apis: Object.fromEntries(['listVpnGateways', 'listVPCs', 'listVpnConnections', 'queryAsyncJobResult', 'createVpnGateway', 'deleteVpnGateway'].map(api => [api, {}])) }) }
function lookup (command, params) {
  if (command === 'queryAsyncJobResult') {
    if (queryFailure) return Promise.reject(Error('query unavailable'))
    return Promise.resolve({ queryasyncjobresultresponse: { jobid: params.jobid, cmd: mode === 'create' ? 'CreateVpnGatewayCmd' : 'DeleteVpnGatewayCmd', jobstatus: outcome, jobresult: outcome === 2 ? { errorcode: 431, errortext: 'Duplicate gateway' } : mode === 'create' ? { vpngateway: { ...gateway } } : { success: true } } })
  }
  if (readFailure === command) return Promise.reject(Error('lookup unavailable'))
  const [field, rows] = command === 'listVPCs' ? ['vpc', [vpc]] : command === 'listVpnConnections' ? ['vpnconnection', [connection]] : ['vpngateway', created ? [gateway] : []]
  return Promise.resolve({ [command.toLowerCase() + 'response']: { [field]: rows } })
}
async function open (type = 'create') {
  mode = type; created = type === 'delete'
  const access = getters(); const route = reactive({ path: type === 'create' ? '/s2svpn' : '/s2svpn/' + gateway.id, fullPath: '/s2svpn', meta: { name: 's2svpn' }, params: { id: type === 'delete' ? gateway.id : undefined } }); const state = reactive({ user: { token: 'never-persist-session' } })
  const w = shallowMount(Dialog, { props: { resource: type === 'delete' ? { ...gateway } : {}, currentAction: { api: type === 'create' ? 'createVpnGateway' : 'deleteVpnGateway', label: 'label.' + type } }, global: { mocks: { $t: key => key, $route: route, $store: { getters: access, state } }, stubs: { MoldDialog: dialog, MoldDialogActions: { render () { return h('footer', this.$slots.default?.()) } }, AButton: button, AForm: form } } })
  wrappers.push(w); await drain(); w.vm.draft.vpcid = 'vpc'; return { w, access, route, state }
}
beforeEach(() => {
  wrappers = []; mode = 'create'; outcome = 1; created = false; readFailure = ''; queryFailure = false; jest.clearAllMocks(); sessionStorage.clear()
  getAPI.mockImplementation(lookup)
  postAPI.mockImplementation((command, params) => { if (outcome === 1) created = mode === 'create'; return Promise.resolve({ [command.toLowerCase() + 'response']: { jobid: params.customjobid } }) })
})
afterEach(() => { wrappers.forEach(w => w.unmount()); jest.restoreAllMocks() })

test.each(['create', 'delete'])('%s closes only after final job and gateway requery agree', async type => {
  const { w } = await open(type); await w.vm.submit()
  expect(w.vm.phase).toBe('succeeded'); expect(w.emitted('refresh-data')).toHaveLength(1); expect(w.emitted('close-action')).toHaveLength(1)
  expect(postAPI).toHaveBeenCalledTimes(1); expect(postAPI.mock.calls[0][1]).toMatchObject({ account: 'owner', domainid: 'domain', ignoreproject: true, customjobid: '00000000-0000-4000-8000-000000000001' }); expect(sessionStorage.length).toBe(0)
})
test.each(['create', 'delete'])('%s job 2 preserves input and explicit error, without success', async type => {
  const { w } = await open(type); outcome = 2; await w.vm.submit()
  expect(w.vm.phase).toBe('failed'); expect(w.vm.error).toContain('431: Duplicate'); expect(w.vm.draft.vpcid).toBe('vpc'); expect(w.vm.closed).toBe(false); expect(w.vm.jobId).toBe(''); expect(w.emitted('refresh-data')).toBeUndefined()
})
test.each(['create', 'delete'])('%s duplicate clicks/Ctrl Enter/cancel cannot repeat a pending POST', async type => {
  const { w } = await open(type); let finish
  postAPI.mockImplementationOnce((cmd, params) => new Promise(resolve => { finish = () => { created = type === 'create'; resolve({ [cmd.toLowerCase() + 'response']: { jobid: params.customjobid } }) } }))
  const pending = w.vm.submit(); await drain(); await w.vm.submit(); await w.get('form').trigger('keydown', { ctrlKey: true, key: 'Enter' }); w.vm.close(); await drain()
  expect(postAPI).toHaveBeenCalledTimes(1); expect(w.vm.closed).toBe(false); expect(w.vm.busy).toBe(true); finish(); await pending; expect(w.vm.closed).toBe(true)
})
test.each(['create', 'delete'])('%s unknown receipt can only requery and never replay POST', async type => {
  const { w } = await open(type); queryFailure = true; await w.vm.submit()
  expect(w.vm.phase).toBe('unknown'); const id = w.vm.jobId; await w.vm.submit(); expect(postAPI).toHaveBeenCalledTimes(1); expect(w.vm.jobId).toBe(id)
  expect(sessionStorage.getItem(w.vm.entryKey)).not.toContain('never-persist-session'); queryFailure = false; await w.vm.submit(); expect(w.vm.closed).toBe(true)
})
test.each(['create', 'delete'])('%s lost POST response recovers the preallocated job', async type => {
  const { w } = await open(type)
  postAPI.mockImplementationOnce(() => { created = type === 'create'; return Promise.reject(Error('connection lost')) })
  await w.vm.submit(); expect(w.vm.phase).toBe('succeeded'); expect(postAPI).toHaveBeenCalledTimes(1)
})
test.each(['create', 'delete'])('%s job success with failed readback remains unknown', async type => {
  const { w } = await open(type); readFailure = 'listVpnGateways'; await w.vm.submit()
  if (type === 'delete') { expect(postAPI).not.toHaveBeenCalled(); return }
  expect(w.vm.phase).toBe('unknown'); expect(w.emitted('refresh-data')).toBeUndefined(); expect(w.vm.jobId).not.toBe('')
})
test.each(['role', 'user', 'token', 'project', 'path', 'permission'])('%s context transition discards late POST callback', async change => {
  const { w, access, state, route } = await open(); let finish
  postAPI.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const pending = w.vm.submit(); await drain()
  if (change === 'role') access.userInfo.roleid = 'other'
  if (change === 'user') access.userInfo.id = 'other'
  if (change === 'token') state.user.token = 'new'
  if (change === 'project') access.project = { id: 'other' }
  if (change === 'path') route.fullPath = '/vm'
  if (change === 'permission') delete access.apis.createVpnGateway
  await drain(); finish({ createvpngatewayresponse: { jobid: 'old' } }); await pending
  expect(w.vm.closed).toBe(true); expect(w.vm.candidates).toEqual([]); expect(w.emitted('refresh-data')).toBeUndefined(); expect(getAPI.mock.calls.filter(([api]) => api === 'queryAsyncJobResult')).toHaveLength(0)
})
test('project switch event invalidates before project state mutates', async () => { const { w } = await open(); eventBus.emit('project-switch-start'); expect(w.vm.closed).toBe(true); expect(w.vm.draft.vpcid).toBe('') })
test('storage quota failure stops an untracked mutation', async () => { const { w } = await open(); jest.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => { throw Error('quota') }); await w.vm.submit(); expect(postAPI).not.toHaveBeenCalled(); expect(w.vm.jobId).toBe('') })
test('malformed job target cannot become success', async () => {
  const { w } = await open(); getAPI.mockImplementation((command, params) => command === 'queryAsyncJobResult' ? Promise.resolve({ queryasyncjobresultresponse: { jobid: params.jobid, cmd: 'CreateVpnGatewayCmd', jobstatus: 1, jobresult: { vpngateway: { ...gateway, account: 'foreign' } } } }) : lookup(command, params))
  await w.vm.submit(); expect(w.vm.phase).toBe('unknown'); expect(w.vm.closed).toBe(false); expect(w.emitted('refresh-data')).toBeUndefined()
})
test('known POST rejection clears receipt, retaining selected VPC', async () => { const { w } = await open(); postAPI.mockRejectedValueOnce({ response: { status: 431, data: { errorresponse: { errorcode: 431, errortext: 'Rejected' } } } }); await w.vm.submit(); expect(w.vm.error).toContain('431'); expect(w.vm.jobId).toBe(''); expect(w.vm.draft.vpcid).toBe('vpc') })
test.each([['public', { publicip: 'public', vpcname: 'vpc', id: 'id' }], ['vpc', { vpcname: 'vpc', id: 'id' }], ['id', { id: 'id' }], ['-', {}]])('title resolver returns %s without fake resource names', (name, row) => expect(gatewayName(row)).toBe(name))
test('shared VPC/global job guard validates command and job identity', () => { expect(vpnJobMatches({ jobid: 'id', cmd: 'org.example.CreateVpnGatewayCmd' }, 'id', 'createVpnGateway')).toBe(true); expect(vpnJobMatches({ jobid: 'other' }, 'id', 'createVpnGateway')).toBe(false); expect(vpnJobMatches({ jobid: 'id', cmd: 'DeleteVpnGatewayCmd' }, 'id', 'createVpnGateway')).toBe(false) })
test('connection rows drop PSK and reject other gateway/owner results', () => { expect(JSON.stringify(gatewayConnectionRows([connection], gateway))).not.toContain('never-retain'); expect(() => gatewayConnectionRows([{ ...connection, s2svpngatewayid: 'other' }], gateway)).toThrow(); expect(() => gatewayConnectionRows([{ ...connection, account: 'other' }], gateway)).toThrow() })
test.each(['vpcid', 'vpcname', 'account', 'domain', 'project'])('missing %s never creates an undefined link', field => { const w = shallowMount(Value, { props: { resource: {}, field }, global: { mocks: { $t: key => key } } }); wrappers.push(w); expect(w.find('router-link-stub').exists()).toBe(false); expect(w.text()).toBe('-') })

async function openTab () {
  const access = getters(); const route = reactive({ path: '/s2svpn/' + gateway.id, params: { id: gateway.id }, meta: { name: 's2svpn' } }); const state = reactive({ user: { token: 'token' } })
  const w = shallowMount(Connections, { props: { resource: { ...gateway }, tab: 'vpn.connections' }, global: { mocks: { $t: key => key, $route: route, $store: { getters: access, state } } } }); wrappers.push(w); await drain(); return { w, access, route, state }
}
test('connection tab is scoped and preserves prior rows on refresh failure', async () => { const { w } = await openTab(); expect(w.vm.rows).toHaveLength(1); expect(JSON.stringify(w.vm.rows)).not.toContain('never-retain'); expect(getAPI).toHaveBeenCalledWith('listVpnConnections', expect.objectContaining({ vpcid: 'vpc', account: 'owner', domainid: 'domain', ignoreproject: true }), expect.any(Object)); readFailure = 'listVpnConnections'; await w.vm.load(); expect(w.vm.rows).toHaveLength(1); expect(w.vm.error).toBe('message.s2s.gateway.lookup.failed') })
test('connection tab discards late results after resource/permission change', async () => { const { w, access } = await openTab(); let finish; getAPI.mockImplementationOnce(() => new Promise(resolve => { finish = resolve })); const pending = w.vm.load(); delete access.apis.listVpnConnections; await drain(); finish({ listvpnconnectionsresponse: { vpnconnection: [connection] } }); await pending; expect(w.vm.rows).toEqual([]); expect(w.vm.error).toBe('message.s2s.gateway.permission') })
test('detail read rejects a different project rather than showing the object', async () => { const access = getters(); access.project = { id: 'project' }; getAPI.mockResolvedValueOnce({ listvpngatewaysresponse: { vpngateway: [gateway] } }); await expect(readGatewayDetail(getAPI, { params: { id: gateway.id } }, access, () => true)).rejects.toThrow('scope') })

test('unknown/forbidden tab URL canonicalizes to visible details', () => {
  const tabs = [{ name: 'details' }, { name: 'vpn.connections', hidden: true }]
  const vm = { tabs, historyTab: '', $route: { path: '/s2svpn/gw', params: { id: 'gw' }, meta: { name: 's2svpn', tabs }, query: { tab: 'vpn.connections', s2sreturn: 'kept' } }, showTab: tab => !tab.hidden, $router: { replace: jest.fn() } }
  ResourceView.methods.setActiveTab.call(vm)
  expect(vm.activeTab).toBe('details'); expect(vm.$router.replace).toHaveBeenCalledWith({ path: '/s2svpn/gw', query: { tab: 'details', s2sreturn: 'kept' } })
})
test('tab-only navigation has the same detail read scope; owner changes do not', () => {
  const vm = { $route: { path: '/s2svpn/gw', fullPath: '/s2svpn/gw?tab=details', params: { id: 'gw' }, meta: { name: 's2svpn' }, query: { tab: 'details' } }, $store: { getters: { userInfo: { id: 'user' }, project: {} } }, s2sGatewaySearchAuth: 'auth' }
  const original = AutogenView.methods.listScope.call(vm)
  vm.$route.query.tab = 'vpn.connections'; vm.$route.fullPath = '/s2svpn/gw?tab=vpn.connections'
  expect(AutogenView.methods.listScope.call(vm)).toBe(original)
  vm.$store.getters.project.id = 'project'; expect(AutogenView.methods.listScope.call(vm)).not.toBe(original)
})
test.each(['create', 'delete'])('%s failed readback after a successful POST remains unknown', async type => {
  const { w } = await open(type); let posted = false
  getAPI.mockImplementation((api, params) => posted && api === 'listVpnGateways' ? Promise.reject(Error('readback lost')) : lookup(api, params))
  postAPI.mockImplementation((api, params) => { posted = true; created = type === 'create'; return Promise.resolve({ [api.toLowerCase() + 'response']: { jobid: params.customjobid } }) })
  await w.vm.submit(); expect(w.vm.phase).toBe('unknown'); expect(w.vm.jobId).not.toBe(''); expect(w.emitted('refresh-data')).toBeUndefined(); await w.vm.submit(); expect(postAPI).toHaveBeenCalledTimes(1)
})
test('unknown receipt resumes after reopening without another POST', async () => {
  const { w } = await open(); queryFailure = true; await w.vm.submit(); const key = w.vm.entryKey
  w.vm.close(); w.unmount(); expect(JSON.parse(sessionStorage.getItem(key)).target).toEqual({ vpcid: 'vpc', account: 'owner', domainid: 'domain' })
  queryFailure = false; created = true; mode = 'create'
  getAPI.mockImplementation((api, params) => api === 'listVpnGateways' ? Promise.resolve({ listvpngatewaysresponse: { vpngateway: [gateway] } }) : lookup(api, params))
  const { w: reopened } = await open(); await drain(); expect(reopened.vm.closed).toBe(true); expect(reopened.emitted('refresh-data')).toHaveLength(1); expect(postAPI).toHaveBeenCalledTimes(1)
})

test('connection refresh access denial clears retained rows and has a permission message', async () => {
  const { w } = await openTab(); expect(w.vm.rows).toHaveLength(1)
  getAPI.mockRejectedValueOnce({ response: { status: 403 } }); await w.vm.load()
  expect(w.vm.rows).toEqual([]); expect(w.vm.error).toBe('message.s2s.gateway.permission')
})
test('project ownership value uses the project name rather than an internal project account', () => {
  const w = shallowMount(Value, { props: { resource: { account: 'PrjAcct-internal', projectid: 'project', project: 'Visible Project' }, field: 'account' }, global: { mocks: { $t: key => key }, stubs: { RouterLink: { render () { return h('a', this.$slots.default?.()) } } } } }); wrappers.push(w)
  expect(w.text()).toContain('Visible Project'); expect(w.text()).not.toContain('PrjAcct-internal')
})
test.each(['User', 'DomainAdmin'])('display values are not disclosed to %s by the presentation component', role => {
  const w = shallowMount(Value, { props: { resource: { fordisplay: true }, field: 'fordisplay' }, global: { mocks: { $t: key => key, $store: { getters: { userInfo: { roletype: role } } } } } }); wrappers.push(w); expect(w.text()).toBe('-')
})
test('gateway deletion does not refetch and invalidate the dialog before closing', () => {
  const vm = { $route: { meta: { name: 's2svpn' } }, currentAction: { api: 'deleteVpnGateway' }, dataView: true, resource: { id: 'gateway' }, fetchData: jest.fn() }
  AutogenView.methods.refreshActionData.call(vm, { removed: ['gateway'] }); expect(vm.fetchData).not.toHaveBeenCalled()
  vm.currentAction.api = 'createVpnGateway'; AutogenView.methods.refreshActionData.call(vm, {}); expect(vm.fetchData).toHaveBeenCalledWith({ irefresh: true })
})
test('confirmed deletion clears the old detail and returns to the saved list scope', () => {
  const access = getters()
  const vm = { $route: { path: '/s2svpn/gateway', params: { id: 'gateway' }, meta: { name: 's2svpn' }, query: {} }, $store: { getters: access }, currentAction: { api: 'deleteVpnGateway' }, dataView: true, resource: { id: 'gateway' }, items: [{ id: 'gateway' }], listRequestVersion: 0, listRequestPending: true, listLoadedScope: 'old', resetSelection: jest.fn(), $router: { replace: jest.fn() }, $nextTick: jest.fn(), listScope: () => 'scope', actionOriginPath: '/s2svpn/gateway' }
  AutogenView.methods.closeAction.call(vm, { removed: ['gateway'] })
  expect(vm.resource).toEqual({}); expect(vm.listRequestVersion).toBe(1); expect(vm.listRequestPending).toBe(false); expect(vm.$router.replace).toHaveBeenCalledWith(expect.objectContaining({ path: '/s2svpn', query: expect.objectContaining({ projectid: '0' }) }))
})

test('saved legacy defaults acquire the VPC and project columns without overwriting custom choices', () => {
  const defaults = ['publicip', 'vpcname', 'account', 'domain', 'project']
  expect(gatewayVisibleColumns(['publicip', 'account', 'domain'], defaults)).toEqual(defaults)
  expect(gatewayVisibleColumns(['domain', 'publicip'], defaults)).toEqual(['domain', 'publicip'])
})
test('deleting an exact-ID search target clears only that stale filter', () => {
  const location = { path: '/s2svpn', query: { id: gateway.id, projectid: '0', vpcid: 'vpc', page: '3', pagesize: '20' } }
  expect(gatewayDeletedListLocation(location, gateway.id)).toEqual({ path: '/s2svpn', query: { projectid: '0', vpcid: 'vpc', page: '1', pagesize: '20' } })
  expect(gatewayDeletedListLocation(location, 'other')).toBe(location)
})
