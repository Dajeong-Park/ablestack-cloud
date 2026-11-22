// Licensed to the Apache Software Foundation (ASF) under one or more
// contributor license agreements. See NOTICE for copyright ownership.
// Licensed under the Apache License, Version 2.0 (the "License");
// http://www.apache.org/licenses/LICENSE-2.0 . Distributed AS IS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND.
import { shallowMount } from '@vue/test-utils'
import { nextTick, reactive } from 'vue'
import { getAPI, postAPI } from '@/api'
import eventBus from '@/config/eventBus'
import Dialog from '@/views/network/S2sConnectionDialog'

jest.mock('@/api', () => ({ getAPI: jest.fn(), postAPI: jest.fn() }))

const id = n => '00000000-0000-4000-8000-' + String(n).padStart(12, '0')
const owner = { account: 'owner', domainid: id(1) }
const gateway = { ...owner, id: id(2), publicip: '192.0.2.1', vpcname: 'VPC', vpcid: id(5) }
const peer = { ...owner, id: id(3), gateway: '192.0.2.2', name: 'Peer', ipsecpsk: 'secret-to-ignore' }
const connection = { ...owner, id: id(4), fordisplay: true, publicip: gateway.publicip, gateway: peer.gateway, s2svpngatewayid: gateway.id, s2scustomergatewayid: peer.id }
const draft = { s2svpngatewayid: gateway.id, s2scustomergatewayid: peer.id, passive: true }
const commandClass = cmd => cmd[0].toUpperCase() + cmd.slice(1) + 'Cmd'
const success = jest.fn()
const drain = async () => { for (let i = 0; i < 22; i++) { await Promise.resolve(); await nextTick() } }
const getEnvelope = (command, field, rows) => ({ [command.toLowerCase() + 'response']: { [field]: rows } })
let wrappers, command, outcome, removed, currentConnection

beforeEach(() => {
  wrappers = []; outcome = 1; removed = false; currentConnection = connection
  jest.clearAllMocks()
  sessionStorage.clear()
  getAPI.mockImplementation((op, params) => {
    if (op === 'listVPCs') return Promise.resolve(getEnvelope(op, 'vpc', [{ ...owner, id: gateway.vpcid, cidr: '10.0.0.0/24' }]))
    if (op === 'listVpnGateways') return Promise.resolve(getEnvelope(op, 'vpngateway', [gateway]))
    if (op === 'listVpnCustomerGateways') return Promise.resolve(getEnvelope(op, 'vpncustomergateway', [peer]))
    if (op === 'listVpnConnections') return Promise.resolve(getEnvelope(op, 'vpnconnection', removed || params.vpcid ? [] : [currentConnection]))
    const jobresult = outcome === 2 ? { errorcode: 530, errortext: 'Controlled VPN failure' } : command === 'deleteVpnConnection' ? { success: true } : { vpnconnection: currentConnection }
    if (outcome === 1 && command === 'deleteVpnConnection') removed = true
    return Promise.resolve({ queryasyncjobresultresponse: { jobid: params.jobid, jobstatus: outcome, cmd: commandClass(command), jobresult } })
  })
  postAPI.mockImplementation((op, params) => Promise.resolve({ [op.toLowerCase() + 'response']: { jobid: params.customjobid } }))
})
afterEach(() => { wrappers.forEach(wrapper => wrapper.unmount()); jest.restoreAllMocks(); jest.useRealTimers() })

async function open (api = 'createVpnConnection', optionalApis = [], visibility = {}) {
  command = api
  const creating = api === 'createVpnConnection'
  const path = '/s2svpnconn' + (creating ? '' : '/' + connection.id)
  const getters = reactive({
    project: {},
    userInfo: { ...owner, id: id(9), roleid: id(8), roletype: visibility.role || 'Admin' },
    apis: Object.fromEntries([api, 'listVpnConnections', 'queryAsyncJobResult', 'listVpnGateways', 'listVpnCustomerGateways', ...optionalApis].map(name => [name, {}]))
  })
  if (visibility.advertise) {
    getters.apis.listVpnConnections.params = [{ name: 'displayall' }, { name: 'fordisplay' }]
    getters.apis[api].params = [{ name: 'fordisplay' }]
  }
  const state = reactive({ user: { token: 'valid-session' } })
  const route = reactive({ fullPath: path, meta: { name: 's2svpnconn' }, params: creating ? {} : { id: connection.id } })
  const wrapper = shallowMount(Dialog, {
    props: { resource: creating ? {} : connection, currentAction: { api, label: api } },
    global: {
      mocks: { $store: { getters, state }, $route: route, $message: { success, info: jest.fn() }, $t: key => key },
      stubs: { AForm: { template: '<form><slot /></form>', methods: { validate: jest.fn().mockResolvedValue(null) } } },
      renderStubDefaultSlot: true
    }
  })
  wrappers.push(wrapper)
  await drain()
  if (creating && !wrapper.vm.jobId) {
    wrapper.vm.draft.s2svpngatewayid = gateway.id
    await wrapper.vm.chooseLocal()
    Object.assign(wrapper.vm.draft, draft)
  }
  return { wrapper, getters, route, state }
}

test.each(['createVpnConnection', 'resetVpnConnection', 'deleteVpnConnection'])('%s closes after its scoped terminal success', async op => {
  const { wrapper } = await open(op)
  await wrapper.vm.submit()
  expect(wrapper.vm.closed).toBe(true)
  expect(postAPI).toHaveBeenCalledTimes(1)
  expect(wrapper.emitted('close-action')).toHaveLength(1)
  expect(success).toHaveBeenCalledTimes(1)
  expect(sessionStorage.length).toBe(0)
  if (op === 'deleteVpnConnection') {
    expect(wrapper.emitted('close-action')[0][0]).toEqual({ removed: [connection.id] })
    expect(wrapper.emitted('refresh-data')).toBeUndefined()
  } else {
    expect(wrapper.emitted('refresh-data')[0][0]).toEqual({ irefresh: true })
  }
})

test.each(['createVpnConnection', 'resetVpnConnection', 'deleteVpnConnection'])('%s keeps the same target and permits retry after job failure', async op => {
  const { wrapper } = await open(op)
  outcome = 2
  await wrapper.vm.submit()
  expect(wrapper.vm.closed).toBe(false)
  expect(wrapper.vm.error).toContain('Controlled VPN failure')
  expect(wrapper.vm.jobId).toBe('')
  expect(wrapper.emitted('refresh-data')).toBeUndefined()
  if (op === 'createVpnConnection') expect(wrapper.vm.draft).toEqual(draft)
  else expect(wrapper.props('resource').id).toBe(connection.id)
  outcome = 1
  await wrapper.vm.submit()
  expect(postAPI).toHaveBeenCalledTimes(2)
  expect(wrapper.vm.closed).toBe(true)
})

test('delayed dispatch rejects duplicate submit and close; receipt contains only required identifiers', async () => {
  const { wrapper } = await open()
  let acknowledge
  postAPI.mockImplementationOnce((op, params) => new Promise(resolve => {
    acknowledge = () => resolve({ [op.toLowerCase() + 'response']: { jobid: params.customjobid } })
  }))
  const submit = wrapper.vm.submit()
  await drain()
  await wrapper.vm.submit()
  wrapper.vm.close()
  expect(wrapper.vm.closed).toBe(false)
  expect(postAPI).toHaveBeenCalledTimes(1)
  const saved = sessionStorage.getItem(wrapper.vm.entryKey)
  expect(JSON.parse(saved).draft).toEqual(draft)
  expect(saved).not.toMatch(/secret-to-ignore|valid-session/)
  acknowledge()
  await submit
  expect(wrapper.vm.closed).toBe(true)
})

test('lost dispatch response and query timeout retain one job; recheck cannot post again', async () => {
  const { wrapper } = await open()
  postAPI.mockRejectedValueOnce(new Error('Network connection interrupted'))
  wrapper.vm.tracker = {
    track: jest.fn().mockResolvedValueOnce({ jobstatus: null, trackingStatus: 'timeout' })
      .mockResolvedValueOnce({ jobstatus: 1, jobresult: { vpnconnection: connection } }),
    clear: jest.fn()
  }
  await wrapper.vm.submit()
  expect(wrapper.vm.phase).toBe('unknown')
  const jobid = wrapper.vm.jobId
  expect(JSON.parse(sessionStorage.getItem(wrapper.vm.entryKey)).jobId).toBe(jobid)
  await wrapper.vm.submit()
  expect(wrapper.vm.tracker.track.mock.calls.map(call => call[0])).toEqual([jobid, jobid])
  expect(postAPI).toHaveBeenCalledTimes(1)
  expect(wrapper.vm.closed).toBe(true)
})

test('a completed job with failed readback retries the result and never repeats its mutation', async () => {
  const { wrapper } = await open('resetVpnConnection')
  let reads = 0
  const lookup = getAPI.getMockImplementation()
  getAPI.mockImplementation((name, params) => {
    if (name === 'listVpnConnections' && ++reads === 2) return Promise.reject(Error('Readback failed'))
    return lookup(name, params)
  })
  await wrapper.vm.submit()
  expect(wrapper.vm.phase).toBe('unknown')
  await wrapper.vm.checkJob()
  expect(wrapper.vm.closed).toBe(true)
  expect(postAPI).toHaveBeenCalledTimes(1)
})

test('switching project while a write is in flight suppresses its callbacks', async () => {
  const { wrapper, getters } = await open()
  let acknowledge
  postAPI.mockImplementationOnce((op, params) => new Promise(resolve => {
    acknowledge = () => resolve({ [op.toLowerCase() + 'response']: { jobid: params.customjobid } })
  }))
  const submit = wrapper.vm.submit()
  await drain()
  eventBus.emit('project-switch-start')
  getters.project = { id: id(20) }
  acknowledge()
  await submit
  expect(wrapper.vm.closed).toBe(true)
  expect(wrapper.emitted('refresh-data')).toBeUndefined()
  expect(getAPI.mock.calls.filter(([op]) => op === 'queryAsyncJobResult')).toHaveLength(0)
})

test('stale detail read prevents a mutation and keeps the confirmation open', async () => {
  const { wrapper } = await open('deleteVpnConnection')
  currentConnection = { ...connection, gateway: '192.0.2.30' }
  await wrapper.vm.submit()
  expect(postAPI).not.toHaveBeenCalled()
  expect(wrapper.vm.closed).toBe(false)
  expect(wrapper.vm.error).toBe('message.vpc.vpn.changed')
})

test('a foreign job command does not affect the target', async () => {
  const { wrapper } = await open('resetVpnConnection')
  const lookup = getAPI.getMockImplementation()
  getAPI.mockImplementation((op, params) => op !== 'queryAsyncJobResult'
    ? lookup(op, params)
    : Promise.resolve({ queryasyncjobresultresponse: { jobid: params.jobid, cmd: 'DeleteVpnConnectionCmd', jobstatus: 1, jobresult: { vpnconnection: connection } } }))
  jest.useFakeTimers()
  const submit = wrapper.vm.submit()
  await drain()
  for (let i = 0; i < 3; i++) { jest.advanceTimersByTime(2000); await drain() }
  await submit
  expect(wrapper.vm.phase).toBe('unknown')
  expect(wrapper.emitted('refresh-data')).toBeUndefined()
})

test('checks only the selected gateway owner and explains each kind of disabled candidate', async () => {
  const { wrapper } = await open(undefined, ['listVPCs'])
  const duplicate = { ...peer, id: id(6), name: 'Configured', cidrlist: '198.51.100.0/25' }
  const peerOverlap = { ...peer, id: id(7), name: 'Peer overlap', cidrlist: '198.51.100.64/26' }
  const vpcOverlap = { ...peer, id: id(8), name: 'VPC overlap', cidrlist: '10.0.0.128/25' }
  const foreign = { ...peer, id: id(10), domainid: id(11), name: 'Another domain' }
  const lookup = getAPI.getMockImplementation()
  const vm = wrapper.vm
  getAPI.mockImplementation((op, params) => {
    if (op === 'listVpnCustomerGateways') return getEnvelope(op, 'vpncustomergateway', [peer, duplicate, peerOverlap, vpcOverlap, foreign])
    if (op === 'listVpnConnections' && params.vpcid) return getEnvelope(op, 'vpnconnection', [{ ...connection, s2scustomergatewayid: duplicate.id, cidrlist: duplicate.cidrlist }])
    return lookup(op, params)
  })
  await vm.chooseLocal()
  expect(vm.peerOptions.map(option => [option.value, option.reason])).toEqual([
    [peer.id, ''],
    [duplicate.id, 'message.s2s.connection.conflict.duplicate'],
    [peerOverlap.id, 'message.s2s.connection.conflict.peer.overlap'],
    [vpcOverlap.id, 'message.s2s.connection.conflict.vpc.overlap']
  ])
  expect(vm.candidateSet.peers[0]).not.toHaveProperty('ipsecpsk')
  expect(getAPI).toHaveBeenCalledWith('listVpnCustomerGateways', expect.objectContaining(owner), expect.anything())
})

test('rechecks a newly conflicting combination before posting and shows its reason', async () => {
  const { wrapper } = await open()
  const lookup = getAPI.getMockImplementation()
  getAPI.mockImplementation((op, params) => op === 'listVpnConnections' && params.vpcid
    ? getEnvelope(op, 'vpnconnection', [connection])
    : lookup(op, params))
  await wrapper.vm.submit()
  expect(postAPI).not.toHaveBeenCalled()
  expect(wrapper.vm.selectedPeerOption.disabled).toBe(true)
  expect(wrapper.vm.error).toBe('message.s2s.connection.conflict.duplicate')
})

test('clears an edited peer before sending a request with stale gateway information', async () => {
  const { wrapper } = await open()
  const lookup = getAPI.getMockImplementation()
  getAPI.mockImplementation((op, params) => op === 'listVpnCustomerGateways'
    ? getEnvelope(op, 'vpncustomergateway', [{ ...peer, gateway: '192.0.2.35' }])
    : lookup(op, params))
  await wrapper.vm.submit()
  expect(postAPI).not.toHaveBeenCalled()
  expect(wrapper.vm.draft.s2scustomergatewayid).toBeUndefined()
  expect(wrapper.vm.error).toBe('message.s2s.connection.selection.changed')
})

test('ignores candidate responses after a different local gateway was selected', async () => {
  const { wrapper } = await open()
  const vm = wrapper.vm
  const second = { ...gateway, id: id(41), vpcid: id(42), projectid: id(43) }
  const secondPeer = { ...peer, id: id(44), projectid: second.projectid }
  vm.localGateways.push(second)
  let respond
  const lookup = getAPI.getMockImplementation()
  getAPI.mockImplementation((op, params) => {
    if (op !== 'listVpnCustomerGateways') return lookup(op, params)
    if (params.projectid === second.projectid) return getEnvelope(op, 'vpncustomergateway', [secondPeer])
    return new Promise(resolve => { respond = resolve })
  })
  const firstRead = vm.chooseLocal()
  vm.draft.s2svpngatewayid = second.id
  await vm.chooseLocal()
  respond(getEnvelope('listVpnCustomerGateways', 'vpncustomergateway', [peer]))
  await firstRead
  expect(vm.peerOptions.map(option => option.value)).toEqual([secondPeer.id])
  expect(vm.selectionLoading).toBe(false)
})

test('edits connection visibility only when changed, and verifies the hidden response in the same scope', async () => {
  const { wrapper } = await open('updateVpnConnection', [], { advertise: true })
  await wrapper.vm.submit()
  expect(postAPI).not.toHaveBeenCalled()
  wrapper.vm.draft.fordisplay = false
  postAPI.mockImplementationOnce((op, params) => {
    currentConnection = { ...connection, fordisplay: false }
    return { updatevpnconnectionresponse: { jobid: params.customjobid } }
  })
  await wrapper.vm.submit()
  expect(postAPI).toHaveBeenCalledTimes(1)
  expect(postAPI).toHaveBeenCalledWith('updateVpnConnection', expect.objectContaining({ id: connection.id, fordisplay: false }), expect.anything())
  expect(postAPI.mock.calls[0][1]).not.toHaveProperty('customid')
  expect(getAPI).toHaveBeenCalledWith('listVpnConnections', expect.objectContaining({ id: connection.id, displayall: true, ...owner }), expect.anything())
  expect(wrapper.vm.closed).toBe(true)
})

test('does not update a connection whose visibility changed after opening the dialog', async () => {
  const { wrapper } = await open('updateVpnConnection', [], { advertise: true })
  wrapper.vm.draft.fordisplay = false
  currentConnection = { ...connection, fordisplay: false }
  await wrapper.vm.submit()
  expect(postAPI).not.toHaveBeenCalled()
  expect(wrapper.vm.error).toBe('message.s2s.connection.display.changed')
})

test('creates a hidden connection explicitly and uses an all-display read for completion', async () => {
  const { wrapper } = await open('createVpnConnection', [], { advertise: true })
  wrapper.vm.draft.fordisplay = false
  postAPI.mockImplementationOnce((op, params) => {
    currentConnection = { ...connection, fordisplay: false }
    return { createvpnconnectionresponse: { jobid: params.customjobid } }
  })
  await wrapper.vm.submit()
  expect(postAPI).toHaveBeenCalledWith('createVpnConnection', expect.objectContaining({ fordisplay: false }), expect.anything())
  expect(wrapper.vm.closed).toBe(true)
})

test('keeps the create default implicit and restricts display controls to Root', async () => {
  const { wrapper } = await open('createVpnConnection', [], { advertise: true })
  expect(wrapper.vm.canSetCreateDisplay).toBe(true)
  await wrapper.vm.submit()
  expect(postAPI.mock.calls[0][1]).not.toHaveProperty('fordisplay')
  const user = await open('updateVpnConnection', [], { advertise: true, role: 'DomainAdmin' })
  expect(user.wrapper.vm.canEditDisplay).toBe(false)
  expect(user.wrapper.vm.allowed).toBe(false)
})
