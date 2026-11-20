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
const gateway = { ...owner, id: id(2), publicip: '192.0.2.1', vpcname: 'VPC' }
const peer = { ...owner, id: id(3), gateway: '192.0.2.2', name: 'Peer', ipsecpsk: 'secret-to-ignore' }
const connection = { ...owner, id: id(4), publicip: gateway.publicip, gateway: peer.gateway, s2svpngatewayid: gateway.id, s2scustomergatewayid: peer.id }
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
    if (op === 'listVpnGateways') return Promise.resolve(getEnvelope(op, 'vpngateway', [gateway]))
    if (op === 'listVpnCustomerGateways') return Promise.resolve(getEnvelope(op, 'vpncustomergateway', [peer]))
    if (op === 'listVpnConnections') return Promise.resolve(getEnvelope(op, 'vpnconnection', removed ? [] : [currentConnection]))
    const jobresult = outcome === 2 ? { errorcode: 530, errortext: 'Controlled VPN failure' } : command === 'deleteVpnConnection' ? { success: true } : { vpnconnection: connection }
    if (outcome === 1 && command === 'deleteVpnConnection') removed = true
    return Promise.resolve({ queryasyncjobresultresponse: { jobid: params.jobid, jobstatus: outcome, cmd: commandClass(command), jobresult } })
  })
  postAPI.mockImplementation((op, params) => Promise.resolve({ [op.toLowerCase() + 'response']: { jobid: params.customjobid } }))
})
afterEach(() => { wrappers.forEach(wrapper => wrapper.unmount()); jest.restoreAllMocks(); jest.useRealTimers() })

async function open (api = 'createVpnConnection') {
  command = api
  const creating = api === 'createVpnConnection'
  const path = '/s2svpnconn' + (creating ? '' : '/' + connection.id)
  const getters = reactive({
    project: {},
    userInfo: { ...owner, id: id(9), roleid: id(8), roletype: 'Admin' },
    apis: Object.fromEntries([api, 'listVpnConnections', 'queryAsyncJobResult', 'listVpnGateways', 'listVpnCustomerGateways'].map(name => [name, {}]))
  })
  const state = reactive({ user: { token: 'valid-session' } })
  const route = reactive({ fullPath: path, meta: { name: 's2svpnconn' }, params: creating ? {} : { id: connection.id } })
  const wrapper = shallowMount(Dialog, {
    props: { resource: creating ? {} : connection, currentAction: { api, label: api } },
    global: {
      mocks: { $store: { getters, state }, $route: route, $message: { success }, $t: key => key },
      stubs: { AForm: { template: '<form><slot /></form>', methods: { validate: jest.fn().mockResolvedValue(null) } } },
      renderStubDefaultSlot: true
    }
  })
  wrappers.push(wrapper)
  await drain()
  if (creating && !wrapper.vm.jobId) wrapper.vm.draft = { ...draft }
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
