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
import { diagnosePvlanSupport, pvlanDiagnosticApis } from '@/utils/pvlanSupport'
const apis = Object.fromEntries(pvlanDiagnosticApis.map(api => [api, {}]))
const physical = { id: 'p', state: 'Enabled', name: 'PVLAN', tags: 'pvlan' }
const host = { id: 'h', hypervisor: 'KVM', state: 'Up', resourcestate: 'Enabled', details: { 'pvlan.guard.version': '1', 'pvlan.supported.bridges': 'qa-pvlan1599', 'pvlan.default.bridge': 'bridge0' } }
let rows, getAPI
beforeEach(() => {
  rows = { listPhysicalNetworks: ['physicalnetwork', [physical]], listTrafficTypes: ['traffictype', [{ id: 'g', traffictype: 'Guest', kvmnetworklabel: 'qa-pvlan1599' }]], listHosts: ['host', [JSON.parse(JSON.stringify(host))]] }
  getAPI = jest.fn(command => { const [key, items] = rows[command]; return Promise.resolve({ [command.toLowerCase() + 'response']: { count: items.length, [key]: items } }) })
})
const run = (extra = {}) => diagnosePvlanSupport(getAPI, apis, { zoneId: 'z', physicalNetworkId: 'p', ...extra })
test('an exact guarded bridge on an available host is ready', async () => { expect(await run()).toMatchObject({ status: 'ready', blocked: false }) })
test('ordinary bridge is unsupported and a name prefix cannot bypass it', async () => {
  rows.listHosts[1][0].details['pvlan.supported.bridges'] = 'qa-pvlan1599-other'
  expect(await run()).toMatchObject({ status: 'unsupported', blocked: true })
})
test('an old agent is unknown and cannot authorize submission', async () => {
  delete rows.listHosts[1][0].details['pvlan.guard.version']
  expect(await run()).toMatchObject({ status: 'unknown', blocked: true })
})
test('a host with no support differs from a disconnected host', async () => {
  rows.listHosts[1][0].state = 'Disconnected'
  expect(await run()).toMatchObject({ status: 'unavailable', blocked: true })
})
test('a running VM must use its own host, not a capable peer', async () => {
  expect(await run({ hostId: 'other-host' })).toMatchObject({ blocked: true })
  expect(getAPI.mock.calls[getAPI.mock.calls.length - 1][1].id).toBe('other-host')
})
test('permission absence produces no forbidden reads and delegates to server enforcement', async () => {
  expect(await diagnosePvlanSupport(getAPI, {}, { zoneId: 'z' })).toMatchObject({ status: 'unknown', blocked: false })
  expect(getAPI).not.toHaveBeenCalled()
})
test('lookup failure is not treated as empty support', async () => {
  getAPI.mockRejectedValueOnce(new Error('503'))
  await expect(run()).rejects.toThrow('503')
})
test('a tagged offering selects its own physical network', async () => {
  rows.listPhysicalNetworks[1] = [physical, { ...physical, id: 'p2', tags: 'other' }]
  expect(await run({ physicalNetworkId: '', offering: { tags: 'pvlan' } })).toMatchObject({ status: 'ready' })
  expect(getAPI.mock.calls[1][1].physicalnetworkid).toBe('p')
})

test('other hypervisors retain server enforcement without claiming KVM support', async () => {
  rows.listHosts[1] = [{ ...host, hypervisor: 'VMware' }]
  expect(await run()).toMatchObject({ status: 'unknown', blocked: false })
})

test('a capable non-KVM peer cannot authorize an unsupported KVM VM host', async () => {
  rows.listHosts[1] = [{ ...host, hypervisor: 'VMware', id: 'peer' }, { ...host, details: { 'pvlan.guard.version': '1' } }]
  expect(await run({ hostId: 'h' })).toMatchObject({ status: 'unsupported', blocked: true })
})
