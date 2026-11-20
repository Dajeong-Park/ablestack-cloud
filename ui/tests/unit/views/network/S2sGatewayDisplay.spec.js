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
import Autogen from '@/views/AutogenView.vue'
import { getAPI, postAPI } from '@/api'
import { readGatewayDetail } from '@/utils/s2sGateway'
import { gatewayDisplayError, gatewayDisplayListLocation } from '@/utils/s2sGatewayDisplay'
import { s2sGatewayQuery, s2sGatewayError, s2sGatewayParams, s2sGatewayDetailLocation, s2sGatewayListLocation, readS2sGatewayPage } from '@/utils/s2sGatewaySearch'
jest.mock('@/api', () => ({ getAPI: jest.fn(), postAPI: jest.fn() }))
jest.mock('uuid', () => ({ v4: () => '00000000-0000-4000-8000-000000000001' }))
jest.mock('@/utils/jobTracker', () => ({ createJobTracker: jest.fn(options => ({ clear: jest.fn(), track: jest.fn(async id => { try { return await options.query(id) } catch (_) { return { jobstatus: null } } }) })) }))
const id = '00000000-0000-4000-8000-000000000002'
const vpcid = '00000000-0000-4000-8000-000000000003'
const domain = '00000000-0000-4000-8000-000000000004'
const project = '00000000-0000-4000-8000-000000000005'
const gateway = { id, vpcid, vpcname: 'VPC', publicip: '192.0.2.1', account: 'owner', domainid: domain, fordisplay: true }
const vpc = { id: vpcid, state: 'Enabled', vpcofferingid: 'offering', zoneid: 'zone', account: 'owner', domainid: domain, name: 'VPC' }
const ip = { id: 'ip', vpcid, zoneid: 'zone', account: 'owner', domainid: domain, state: 'Allocated', issourcenat: true, ipaddress: gateway.publicip }
const offering = { id: 'offering', service: ['Vpn', 'SourceNat'].map(name => ({ name, provider: [{ name: 'VpcVirtualRouter' }] })) }
const form = { setup (_, { slots, expose }) { expose({ validate: () => Promise.resolve() }); return () => h('form', slots.default?.()) } }
const button = { props: ['disabled'], setup (props, { slots }) { return () => h('button', { disabled: props.disabled }, slots.default?.()) } }
let wrappers, display, exists, command, posted, status, queryLost, readLost, malformed
const drain = async () => { for (let i = 0; i < 20; i++) { await Promise.resolve(); await nextTick() } }
const apis = ['listVpnGateways', 'queryAsyncJobResult', 'updateVpnGateway', 'createVpnGateway', 'deleteVpnGateway', 'listVPCs', 'listVPCOfferings', 'listPublicIpAddresses']
const access = role => reactive({ project: {}, userInfo: { id: 'admin', roleid: 'role', roletype: role, domainid: domain, account: 'owner' }, apis: Object.fromEntries(apis.map(name => [name, {}])) })
const supported = { id: {}, vpcid: {}, account: {}, domainid: {}, projectid: {}, keyword: {}, fordisplay: {} }
function lookup (api, params) {
  if (api === 'queryAsyncJobResult') {
    if (queryLost) return Promise.reject(Error('job query lost'))
    return Promise.resolve({ queryasyncjobresultresponse: { jobid: params.jobid, cmd: command + 'Cmd', jobstatus: status, jobresult: status === 2 ? { errorcode: 431, errortext: 'Rejected' } : { vpngateway: { ...gateway, fordisplay: display, ...malformed } } } })
  }
  if (api === 'listVpnGateways') {
    if (posted && readLost) return Promise.reject(Error('readback lost'))
    const rows = exists && String(params.fordisplay ?? true) === String(display) ? [{ ...gateway, fordisplay: display }] : []
    return Promise.resolve({ listvpngatewaysresponse: { count: rows.length, vpngateway: rows } })
  }
  return Promise.resolve({ [api.toLowerCase() + 'response']: api === 'listVPCs' ? { vpc: [vpc] } : api === 'listVPCOfferings' ? { vpcoffering: [offering] } : { publicipaddress: [ip] } })
}
async function open (mode = 'update', role = 'Admin', meta = true, initial = true) {
  command = mode + 'VpnGateway'
  const getters = access(role); const state = reactive({ user: { token: 'session' } })
  const route = reactive({ path: '/s2svpn' + (mode === 'create' ? '' : '/' + id), fullPath: '/s2svpn?context', params: { id: mode === 'create' ? undefined : id }, query: {}, meta: { name: 's2svpn' } })
  const w = shallowMount(Dialog, { props: { resource: mode === 'create' ? {} : { ...gateway, fordisplay: initial }, currentAction: { api: command, label: 'label.s2s.display.edit' } }, global: { mocks: { $route: route, $store: { getters, state }, $t: key => key, $getApiParams: () => meta ? { fordisplay: {} } : {} }, stubs: { AForm: form, AButton: button, MoldDialog: { setup (_, { slots }) { return () => h('section', slots.default?.()) } }, MoldDialogActions: { setup (_, { slots }) { return () => h('footer', slots.default?.()) } } } } })
  wrappers.push(w); await drain()
  if (mode === 'create') { w.vm.draft.vpcid = vpcid; await drain() }
  return { w, getters, state, route }
}
beforeEach(() => {
  wrappers = []; display = true; exists = true; posted = false; status = 1; queryLost = false; readLost = false; malformed = {}; sessionStorage.clear(); jest.clearAllMocks()
  getAPI.mockImplementation(lookup)
  postAPI.mockImplementation((api, params) => { posted = true; if (status === 1) { exists = true; display = params.fordisplay ?? true }; return Promise.resolve({ [api.toLowerCase() + 'response']: { jobid: params.customjobid } }) })
})
afterEach(() => { wrappers.forEach(w => w.unmount()); jest.restoreAllMocks() })
test.each([true, false])('initial %s remains boolean, unchanged save sends zero POSTs', async initial => {
  display = initial; const { w } = await open('update', 'Admin', true, initial)
  expect(w.vm.loaded).toBe(true); expect(w.vm.draft.fordisplay).toBe(initial); await w.vm.submit(); expect(postAPI).not.toHaveBeenCalled(); expect(w.html()).toContain('message.s2s.display.unchanged')
})
test.each([true, false])('update from %s confirms result + explicit readback and emits target filter', async initial => {
  display = initial; const { w } = await open('update', 'Admin', true, initial); w.vm.draft.fordisplay = !initial; await w.vm.submit()
  expect(postAPI).toHaveBeenCalledTimes(1); expect(postAPI.mock.calls[0][1]).toMatchObject({ id, fordisplay: !initial }); expect(w.vm.phase).toBe('succeeded')
  expect(getAPI.mock.calls.filter(([api]) => api === 'listVpnGateways').slice(-1)[0][1].fordisplay).toBe(!initial)
  expect(w.emitted('close-action')[0][0]).toMatchObject({ displayChanged: true, id, fordisplay: !initial }); expect(sessionStorage.length).toBe(0)
})
test('post-success read failure is confirmed-readback, retrying the same job never resubmits', async () => {
  const { w } = await open(); w.vm.draft.fordisplay = false; readLost = true; await w.vm.submit()
  expect(w.vm.phase).toBe('unknown'); expect(w.vm.confirmed).toBe(true); expect(w.vm.error).toContain('readback lost'); expect(w.html()).toContain('message.s2s.display.confirmed.readback'); expect(w.emitted('refresh-data')).toBeUndefined()
  const job = w.vm.jobId; await w.vm.submit(); expect(w.vm.jobId).toBe(job); expect(postAPI).toHaveBeenCalledTimes(1)
  readLost = false; await w.vm.submit(); expect(w.vm.phase).toBe('succeeded')
})
test('lost job responses recover only the same job ID', async () => {
  const { w } = await open(); w.vm.draft.fordisplay = false; queryLost = true; await w.vm.submit(); const job = w.vm.jobId
  expect(w.vm.phase).toBe('unknown'); expect(w.vm.confirmed).toBe(false); await w.vm.submit(); expect(postAPI).toHaveBeenCalledTimes(1); expect(w.vm.jobId).toBe(job)
  queryLost = false; await w.vm.submit(); expect(w.vm.closed).toBe(true)
})
test('lost POST response recovers the preallocated job with one mutation', async () => {
  const { w } = await open(); w.vm.draft.fordisplay = false
  postAPI.mockImplementationOnce(() => { posted = true; display = false; return Promise.reject(Error('response lost')) })
  await w.vm.submit(); expect(w.vm.phase).toBe('succeeded'); expect(postAPI).toHaveBeenCalledTimes(1)
})
test.each(['job', 'http'])('%s rejection retains draft and error', async failure => {
  const { w } = await open(); w.vm.draft.fordisplay = false
  if (failure === 'job') status = 2
  else postAPI.mockRejectedValueOnce({ response: { status: 431, data: { errorresponse: { errorcode: 431, errortext: 'Rejected' } } } })
  await w.vm.submit(); expect(w.vm.closed).toBe(false); expect(w.vm.phase).toBe('failed'); expect(w.vm.draft.fordisplay).toBe(false); expect(w.vm.error).toContain('431'); expect(w.vm.jobId).toBe(''); expect(w.emitted('refresh-data')).toBeUndefined()
})
test.each([{ id: vpcid }, { vpcid: id }, { account: 'foreign' }, { publicip: 'foreign' }, { fordisplay: true }])('mismatched final object cannot be accepted: %j', async changed => {
  const { w } = await open(); w.vm.draft.fordisplay = false; malformed = changed; await w.vm.submit(); expect(w.vm.phase).toBe('unknown'); expect(w.vm.closed).toBe(false); expect(w.emitted('refresh-data')).toBeUndefined()
})
test('a concurrent display change is caught before POST and keeps the intended draft', async () => {
  const { w } = await open(); display = false; w.vm.draft.fordisplay = false; await w.vm.submit()
  expect(postAPI).not.toHaveBeenCalled(); expect(w.vm.error).toContain('unverified'); expect(w.vm.draft.fordisplay).toBe(false)
})
test('initial lookup failure blocks editing until a successful refresh', async () => {
  getAPI.mockRejectedValueOnce(Error('offline')); const { w } = await open()
  expect(w.vm.loaded).toBe(false); expect(w.vm.confirmedDisplay).toBeNull(); await w.vm.submit(); expect(postAPI).not.toHaveBeenCalled()
  await w.vm.loadUpdate(); expect(w.vm.loaded).toBe(true)
})
test.each(['role', 'user', 'token', 'project', 'path', 'permission'])('%s transition discards a late update callback', async change => {
  const { w, getters, state, route } = await open(); w.vm.draft.fordisplay = false; let finish
  postAPI.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const pending = w.vm.submit(); await drain()
  if (change === 'role') getters.userInfo.roleid = 'other'
  if (change === 'user') getters.userInfo.id = 'other'
  if (change === 'token') state.user.token = 'other'
  if (change === 'project') getters.project = { id: project }
  if (change === 'path') route.fullPath = '/vm'
  if (change === 'permission') delete getters.apis.updateVpnGateway
  await drain(); finish({ updatevpngatewayresponse: { jobid: '00000000-0000-4000-8000-000000000001' } }); await pending
  expect(w.vm.closed).toBe(true); expect(w.vm.confirmedDisplay).toBeNull(); expect(w.emitted('refresh-data')).toBeUndefined(); expect(getAPI.mock.calls.filter(([api]) => api === 'queryAsyncJobResult')).toHaveLength(0)
})
test('unknown update resumes after reopen without another mutation', async () => {
  const { w } = await open(); w.vm.draft.fordisplay = false; queryLost = true; await w.vm.submit(); w.vm.close(); w.unmount()
  queryLost = false; const { w: second } = await open(); await drain(); expect(second.vm.phase).toBe('succeeded'); expect(postAPI).toHaveBeenCalledTimes(1)
})
test.each([true, false])('Root create %s confirms request, job, readback and the matching display list', async value => {
  exists = false; const { w, route } = await open('create'); route.query.fordisplay = 'false'; w.vm.draft.fordisplay = value; await w.vm.submit()
  expect(postAPI.mock.calls[0][1]).toMatchObject({ vpcid, ipaddressid: 'ip', fordisplay: value }); expect(w.vm.phase).toBe('succeeded'); expect(w.emitted('close-action')[0][0]).toMatchObject({ displayChanged: true, fordisplay: value, id })
})
test.each(['User', 'DomainAdmin'])('%s never sees or submits administrator display settings', async role => {
  const update = await open('update', role); expect(update.w.vm.allowed).toBe(false); expect(update.w.vm.displayOption).toBe(false); expect(getAPI).not.toHaveBeenCalled()
  exists = false; const create = await open('create', role); create.w.vm.draft.fordisplay = false; await create.w.vm.submit()
  expect(postAPI.mock.calls[0][1].fordisplay).toBeUndefined(); expect(create.w.vm.displayOption).toBe(false)
})
test('missing display API metadata blocks an update', async () => { const { w } = await open('update', 'Admin', false); expect(w.vm.allowed).toBe(false); await w.vm.submit(); expect(postAPI).not.toHaveBeenCalled() })
test.each(['User', 'DomainAdmin'])('%s direct hidden detail/filter URL is rejected before reading', async role => {
  const getters = access(role); expect(gatewayDisplayError({ fordisplay: 'false' }, getters, supported)).toBe('permission')
  await expect(readGatewayDetail(getAPI, { params: { id }, query: { fordisplay: 'false' } }, getters, () => true, supported)).rejects.toThrow('permission'); expect(getAPI).not.toHaveBeenCalled()
  expect(s2sGatewayParams(s2sGatewayQuery({}, 20, getters)).fordisplay).toBeUndefined()
})
test('Root hidden list/detail/breadcrumb preserve one explicit filter and never merge two lists', async () => {
  const getters = access('Admin'); const query = s2sGatewayQuery({ fordisplay: 'false', page: '2' }, 20, getters)
  expect(s2sGatewayError(query, getters, supported)).toBe(''); expect(s2sGatewayParams(query).fordisplay).toBe('false')
  display = false; const detail = s2sGatewayDetailLocation({ query }, { ...gateway, fordisplay: false }, getters)
  expect(detail.query.fordisplay).toBe('false'); expect(s2sGatewayListLocation(detail, getters).query).toEqual(query)
  await readGatewayDetail(getAPI, { ...detail, params: { id } }, getters, () => true, supported); expect(getAPI).toHaveBeenCalledTimes(1); expect(getAPI.mock.calls[0][1].fordisplay).toBe('false')
  expect(readS2sGatewayPage({ listvpngatewaysresponse: { count: 1, vpngateway: [{ ...gateway, fordisplay: false }] } }, { fordisplay: 'false' }).count).toBe(1)
  expect(() => readS2sGatewayPage({ listvpngatewaysresponse: { count: 1, vpngateway: [gateway] } }, { fordisplay: 'false' })).toThrow('scope')
})
test.each(['all', 'FALSE', '0', ''])('invalid display filter %s cannot broaden scope', value => expect(gatewayDisplayError({ fordisplay: value }, access('Admin'), supported)).toBe('invalid'))
test('hidden detail cannot cross the global project or ignore missing display API support', async () => {
  await expect(readGatewayDetail(getAPI, { params: { id }, query: { projectid: project, fordisplay: 'false' } }, access('Admin'), () => true, supported)).rejects.toThrow('scope')
  await expect(readGatewayDetail(getAPI, { params: { id }, query: { fordisplay: 'false' } }, access('Admin'), () => true, {})).rejects.toThrow('unsupported'); expect(getAPI).not.toHaveBeenCalled()
})
test('changed-display location narrows to the actual target owner/ID and clears stale keyword', () => {
  const result = gatewayDisplayListLocation({}, access('Admin'), { query: { keyword: 'old', q: 'old', page: '3', projectid: '0' } }, false, id, { ...gateway })
  expect(result).toEqual({ path: '/s2svpn', query: { page: '1', projectid: '0', fordisplay: 'false', id, vpcid, account: 'owner', domainid: domain } })
})
test('refresh does not invalidate an update dialog before its completed navigation', () => {
  const vm = { $route: { meta: { name: 's2svpn' } }, currentAction: { api: 'updateVpnGateway' }, fetchData: jest.fn() }
  Autogen.methods.refreshActionData.call(vm, { displayChanged: true }); expect(vm.fetchData).not.toHaveBeenCalled()
})

test('shared hidden detail returns to the hidden filter even without a saved list URL', () => {
  const getters = access('Admin')
  expect(s2sGatewayListLocation({ query: { fordisplay: 'false', projectid: '0' } }, getters).query.fordisplay).toBe('false')
  expect(gatewayDisplayListLocation({}, getters, { query: {} }, false, id, { projectid: project })).toBeNull()
})
test.each(['same', 'path', 'project', 'identity'])('completed display navigation is guarded against %s context changes', change => {
  const getters = access('Admin')
  const vm = { $route: { path: '/s2svpn/' + id, fullPath: '/s2svpn/' + id, params: { id }, meta: { name: 's2svpn' }, query: {} }, $store: { getters }, s2sGatewaySearchAuth: 'current-auth', currentAction: { api: 'updateVpnGateway' }, dataView: true, resource: gateway, items: [gateway], listRequestVersion: 0, listRequestPending: false, resetSelection: jest.fn(), $router: { replace: jest.fn() }, $nextTick: jest.fn(), listScope: () => 'scope', actionOriginPath: '/s2svpn/' + id, $message: { success: jest.fn() }, $t: key => key }
  const result = { displayChanged: true, id, fordisplay: false, target: { ...gateway }, originPath: vm.$route.fullPath, auth: vm.s2sGatewaySearchAuth }
  if (change === 'path') vm.$route.fullPath = '/vm'
  if (change === 'project') getters.project = { id: project }
  if (change === 'identity') vm.s2sGatewaySearchAuth = 'other-auth'
  Autogen.methods.closeAction.call(vm, result)
  if (change === 'same') expect(vm.$router.replace).toHaveBeenCalledWith(expect.objectContaining({ path: '/s2svpn', query: expect.objectContaining({ fordisplay: 'false', id }) }))
  else expect(vm.$router.replace).not.toHaveBeenCalled()
})
