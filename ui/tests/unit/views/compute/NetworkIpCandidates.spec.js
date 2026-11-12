// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements. See NOTICE for ownership information.
// Licensed under the Apache License, Version 2.0 (the "License");
// http://www.apache.org/licenses/LICENSE-2.0 . Distributed AS IS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND.
import NetworkConfiguration from '@/views/compute/wizard/NetworkConfiguration.vue'
import { getAPI } from '@/api'
jest.mock('@/api', () => ({ getAPI: jest.fn() }))

const network = { id: 'n', name: 'NAT', type: 'Isolated', projectid: 'p', cidr: '10.1.0.0/24' }
const context = (apis = { listAvailableGuestIps: {} }) => {
  const ctx = {
    ...NetworkConfiguration.data.call({ $t: x => x }),
    $t: x => x,
    $store: { getters: { project: { id: 'p' }, userInfo: { id: 'u', roleid: 'r' }, apis }, state: { user: { token: 'login' } } },
    $route: { path: '/action/deployVnfAppliance' },
    $emit: jest.fn(),
    $notifyError: jest.fn(),
    dataItems: [{ ...network }],
    form: { ipAddressn: '10.1.0.20', macAddressn: '02:01:02:03:04:05' },
    preFillContent: {}
  }
  for (const [k, v] of Object.entries(NetworkConfiguration.methods)) ctx[k] = v.bind(ctx)
  Object.defineProperty(ctx, 'ipLookupScope', { get: () => NetworkConfiguration.computed.ipLookupScope.call(ctx) })
  return ctx
}
const reply = value => ({ listavailableguestipsresponse: { availableguestip: [{ ipaddress: value }] } })
beforeEach(() => jest.clearAllMocks())

test('explicit project lookup preserves inputs and sends only the current project', async () => {
  const ctx = context(); getAPI.mockResolvedValue(reply('10.1.0.3'))
  await ctx.fetchAvailableGuestIps(network)
  expect(getAPI).toHaveBeenCalledWith('listAvailableGuestIps', { networkid: 'n', ignoreproject: true, projectid: 'p', pagesize: -1 }, { preserveOnFailure: true })
  expect(ctx.form).toEqual({ ipAddressn: '10.1.0.20', macAddressn: '02:01:02:03:04:05' })
  expect(ctx.ipOptions.n).toEqual([{ ipaddress: '10.1.0.3' }])
  expect(ctx.ipOptionsStatus.n).toBe('ready')
})

test('personal lookup does not inherit a project from the request interceptor', async () => {
  const ctx = context(); ctx.$store.getters.project = {}; const own = { ...network, projectid: undefined }
  getAPI.mockResolvedValue(reply('10.1.0.3')); await ctx.fetchAvailableGuestIps(own)
  expect(getAPI.mock.calls[0][1]).toEqual({ networkid: 'n', ignoreproject: true, pagesize: -1 })
})

test('unavailable API makes no request, keeps input, and explains automatic/manual assignment', async () => {
  const ctx = context({}); await ctx.fetchAvailableGuestIps(network)
  expect(getAPI).not.toHaveBeenCalled(); expect(ctx.ipOptionsStatus.n).toBe('unavailable')
  expect(ctx.form.ipAddressn).toBe('10.1.0.20'); expect(ctx.canQueryIps(network)).toBe(false)
})

test('failed optional lookup never notifies globally or resets IP/MAC; retry alone recovers', async () => {
  const ctx = context(); getAPI.mockRejectedValueOnce(new Error('531'))
  await ctx.fetchAvailableGuestIps(network)
  expect(ctx.ipOptionsStatus.n).toBe('error'); expect(ctx.ipOptionsLoading.n).toBe(false)
  expect(ctx.form.ipAddressn).toBe('10.1.0.20'); expect(ctx.form.macAddressn).toBe('02:01:02:03:04:05')
  await ctx.fetchAvailableGuestIps(network); expect(getAPI).toHaveBeenCalledTimes(1)
  expect(ctx.$notifyError).not.toHaveBeenCalled()
  getAPI.mockResolvedValueOnce(reply('10.1.0.4')); await ctx.readIpOptions(network, true)
  expect(getAPI).toHaveBeenCalledTimes(2); expect(ctx.ipOptions.n).toEqual([{ ipaddress: '10.1.0.4' }])
})

test('concurrent parent refreshes share one pending query', async () => {
  const ctx = context(); let done
  getAPI.mockImplementation(() => new Promise(resolve => { done = resolve }))
  const a = ctx.readIpOptions(network); const b = ctx.readIpOptions(network)
  expect(getAPI).toHaveBeenCalledTimes(1); expect(ctx.ipOptionsLoading.n).toBe(true)
  done(reply('10.1.0.5')); await Promise.all([a, b]); expect(ctx.ipOptionsLoading.n).toBe(false)
})

test.each(['project', 'user', 'role', 'token', 'api', 'route'])('late IP response cannot cross a changed %s scope', async kind => {
  const ctx = context(); let done
  getAPI.mockImplementation(() => new Promise(resolve => { done = resolve }))
  const pending = ctx.readIpOptions(network)
  if (kind === 'project') ctx.$store.getters.project.id = 'other'
  if (kind === 'user') ctx.$store.getters.userInfo.id = 'other'
  if (kind === 'role') ctx.$store.getters.userInfo.roleid = 'other'
  if (kind === 'token') ctx.$store.state.user.token = 'other'
  if (kind === 'api') ctx.$store.getters.apis = {}
  if (kind === 'route') ctx.$route.path = '/dashboard'
  done(reply('10.1.0.6')); await pending; expect(ctx.ipOptions.n).toEqual([])
})

test('a newer explicit retry wins over an older response', async () => {
  const ctx = context(); const done = []
  getAPI.mockImplementation(() => new Promise(resolve => done.push(resolve)))
  const first = ctx.readIpOptions(network); const second = ctx.readIpOptions(network, true)
  done[1](reply('10.1.0.7')); await second; done[0](reply('10.1.0.8')); await first
  expect(ctx.ipOptions.n).toEqual([{ ipaddress: '10.1.0.7' }])
})

test.each(['removed', 'unmounted'])('late response is ignored after network %s', async kind => {
  const ctx = context(); let done
  getAPI.mockImplementation(() => new Promise(resolve => { done = resolve }))
  const pending = ctx.readIpOptions(network)
  if (kind === 'removed') ctx.dataItems = []
  else NetworkConfiguration.beforeUnmount.call(ctx)
  done(reply('10.1.0.9')); await pending; expect(ctx.ipOptions.n).toEqual([])
})

test('IP/MAC edits to the same network do not reset the form or restart queries', async () => {
  const ctx = context(); getAPI.mockResolvedValue(reply('10.1.0.3')); await ctx.readIpOptions(network)
  const original = ctx.form
  NetworkConfiguration.watch.items.handler.call(ctx, [{ ...network, ipAddress: '10.1.0.20', macAddress: '02:01:02:03:04:05' }])
  expect(ctx.form).toBe(original); expect(getAPI).toHaveBeenCalledTimes(1)
})

test('removing and readding a network does not reuse its old request', async () => {
  const ctx = context(); getAPI.mockResolvedValue(reply('10.1.0.3')); await ctx.readIpOptions(network)
  ctx.dataItems = []; ctx.fetchIpOptions(); ctx.dataItems = [network]
  await ctx.readIpOptions(network); expect(getAPI).toHaveBeenCalledTimes(2)
})

test('adding a different network keeps entered values for the original network', () => {
  const ctx = context(); ctx.dataItems.push({ id: 'n2', type: 'L2' }); ctx.initForm()
  expect(ctx.form.ipAddressn).toBe('10.1.0.20'); expect(ctx.form.macAddressn).toBe('02:01:02:03:04:05')
})

test('shared IP query includes project and keeps only free addresses', async () => {
  const ctx = context({ listPublicIpAddresses: {} })
  getAPI.mockResolvedValue({ listpublicipaddressesresponse: { publicipaddress: [{ ipaddress: '10.1.0.2', state: 'Free' }, { ipaddress: '10.1.0.3', state: 'Allocated' }] } })
  await ctx.fetchPublicIps({ ...network, type: 'Shared' })
  expect(getAPI.mock.calls[0][1]).toEqual({ networkid: 'n', ignoreproject: true, projectid: 'p', allocatedonly: false, forvirtualnetwork: false })
  expect(ctx.ipOptions.n).toEqual([{ ipaddress: '10.1.0.2' }])
})

test.each([{}, { listavailableguestipsresponse: { availableguestip: {} } }])('malformed reply is a recoverable error', async r => {
  const ctx = context(); getAPI.mockResolvedValue(r); await ctx.readIpOptions(network)
  expect(ctx.ipOptionsStatus.n).toBe('error'); expect(ctx.form.ipAddressn).toBe('10.1.0.20')
})

test('a valid empty reply is distinct from failed discovery', async () => {
  const ctx = context(); getAPI.mockResolvedValue({ listavailableguestipsresponse: { count: 0 } }); await ctx.readIpOptions(network)
  expect(ctx.ipOptions.n).toEqual([]); expect(ctx.ipOptionsStatus.n).toBe('ready')
})
