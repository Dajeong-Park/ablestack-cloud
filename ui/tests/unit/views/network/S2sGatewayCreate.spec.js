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

import { gatewayVpcPolicy, gatewayCandidateLabel, gatewayCreateCandidates, gatewayCreateIps, gatewayCreateSelection } from '@/utils/s2sGatewayCreate'
import { gatewayRows } from '@/utils/s2sGateway'

const vpc = { id: 'vpc', vpcofferingid: 'offering', state: 'Enabled', name: 'Duplicate name', account: 'owner', domainid: 'domain', zoneid: 'zone', zonename: 'Zone' }
const provider = name => ({ name, provider: [{ name: 'VpcVirtualRouter' }] })
const offering = { id: 'offering', service: [provider('Vpn'), provider('SourceNat')] }
const ip = { id: 'ip', ipaddress: '192.0.2.1', vpcid: 'vpc', account: 'owner', domainid: 'domain', zoneid: 'zone', state: 'Allocated', issourcenat: true, isstaticnat: false, forprovider: false, hasrules: false }
const access = role => ({ project: {}, userInfo: { roletype: role, account: 'owner', domainid: 'domain' } })
const response = (rows = {}) => jest.fn(async (command, field, params) => {
  if (command === 'listVPCs') return rows.vpcs || [vpc]
  if (command === 'listVPCOfferings') return rows.offerings || [offering]
  if (command === 'listVpnGateways') return rows.gateways || []
  if (command === 'listPublicIpAddresses') return rows.ips || [ip]
  throw Error(command)
})
test('Source NAT with the VR provider has a fixed-IP policy', () => expect(gatewayVpcPolicy(vpc, offering)).toEqual({ kind: 'sourcenat', reason: '' }))
test('VPN on VR without Source NAT has a router policy', () => expect(gatewayVpcPolicy(vpc, { ...offering, service: [provider('Vpn')] })).toEqual({ kind: 'router', reason: '' }))
test.each([
  [{ ...vpc, state: 'Disabled' }, offering, 'inactive'],
  [vpc, undefined, 'provider.unknown'],
  [vpc, { ...offering, id: 'other' }, 'provider.unknown'],
  [vpc, { ...offering, service: [provider('SourceNat')] }, 'provider.unsupported'],
  [vpc, { ...offering, service: [{ name: 'Vpn', provider: [{ name: 'NSX' }] }] }, 'provider.unsupported'],
  [vpc, { ...offering, service: [provider('Vpn'), { name: 'SourceNat', provider: [] }] }, 'provider.unknown'],
  [vpc, { ...offering, service: [provider('Vpn'), { name: 'SourceNat', provider: [{ name: 'Netris' }] }] }, 'provider.unsupported']
])('unsupported or unverified provider input blocks creation %#', (v, o, reason) => expect(gatewayVpcPolicy(v, o).reason).toBe(reason))
test('candidate labels disambiguate name by ID, owner and zone', () => expect(gatewayCandidateLabel(vpc)).toBe('Duplicate name · vpc · owner · Zone'))
test('Root checks both display branches and disables a hidden gateway without disclosing its fields', async () => {
  const read = response(); read.mockImplementation(async (command, field, params) => command === 'listVpnGateways' ? params.fordisplay === false ? [{ id: 'hidden-secret-id', vpcid: 'vpc', account: 'owner', domainid: 'domain' }] : [] : command === 'listVPCs' ? [vpc] : [offering])
  const rows = await gatewayCreateCandidates(read, access('Admin'))
  expect(rows[0].reason).toBe('exists'); expect(JSON.stringify(rows)).not.toContain('hidden-secret-id')
  expect(read.mock.calls.filter(([command]) => command === 'listVpnGateways').map(call => call[2].fordisplay)).toEqual([true, false])
})
test.each(['User', 'DomainAdmin'])('%s never receives administrator-only display arguments', async role => {
  const read = response(); await gatewayCreateCandidates(read, access(role)); await gatewayCreateSelection(read, vpc, false)
  expect(read.mock.calls.filter(([command]) => command === 'listVpnGateways').every(call => !('fordisplay' in call[2]))).toBe(true)
})
test('project candidate lookups keep project scope without leaking internal account names into labels', async () => {
  const projectVpc = { ...vpc, projectid: 'project', project: 'Visible project', account: 'PrjAcct-hidden' }
  const read = response({ vpcs: [projectVpc] }); const rows = await gatewayCreateCandidates(read, { ...access('Admin'), project: { id: 'project' } })
  expect(gatewayCandidateLabel(rows[0])).toContain('Visible project'); expect(gatewayCandidateLabel(rows[0])).not.toContain('PrjAcct-hidden')
  expect(read.mock.calls.filter(([command]) => command !== 'listVPCOfferings').every(call => call[2].projectid === 'project')).toBe(true)
})
test('foreign project or owner rows cannot become candidates', async () => {
  await expect(gatewayCreateCandidates(response({ vpcs: [{ ...vpc, projectid: 'other' }] }), access('Admin'))).rejects.toThrow('context')
  await expect(gatewayCreateCandidates(response({ vpcs: [{ ...vpc, account: 'other' }] }), access('User'))).rejects.toThrow('context')
})
test('offering lookup failure rejects the candidate set rather than accepting incomplete candidates', async () => {
  const read = response(); read.mockImplementationOnce(async () => { throw Error('read failed') })
  await expect(gatewayCreateCandidates(read, access('Admin'))).rejects.toThrow('read failed')
})
test('Source NAT selects exactly the required VPC IP', () => expect(gatewayCreateIps([ip, { ...ip, id: 'other', issourcenat: false }], vpc, 'sourcenat')).toEqual({ ips: [ip], fixed: true, defaultId: 'ip' }))
test.each([
  [[], 'ip.missing'],
  [[{ ...ip, state: 'Releasing' }], 'ip.missing'],
  [[ip, { ...ip, id: 'second' }], 'ip.ambiguous'],
  [[ip, { ...ip, id: 'second', state: 'Releasing' }], 'ip.ambiguous'],
  [[{ ...ip, vpcid: 'foreign' }], 'context'],
  [[{ ...ip, account: 'foreign' }], 'context'],
  [[{ ...ip, projectid: 'foreign' }], 'context'],
  [[{ ...ip, zoneid: 'foreign' }], 'context']
])('invalid Source NAT candidate set is rejected %#', (rows, reason) => expect(() => gatewayCreateIps(rows, vpc, 'sourcenat')).toThrow(reason))
test('a known VPC router IP is fixed even when forprovider is false', () => {
  const router = { ...ip, issourcenat: false, isstaticnat: true, virtualmachinetype: 'DomainRouter' }
  expect(gatewayCreateIps([router, { ...ip, id: 'free', issourcenat: false }], vpc, 'router')).toEqual({ ips: [router], fixed: true, defaultId: 'ip' })
})
test('router policy offers only unused non-provider IPs and a clearly defined automatic default', () => {
  const free = { ...ip, issourcenat: false }
  const rows = [free, { ...free, id: 'nat', isstaticnat: true }, { ...free, id: 'vm', virtualmachineid: 'user-vm' }, { ...free, id: 'provider', forprovider: true }, { ...free, id: 'rules', hasrules: true }, { ...free, id: 'unknown', hasrules: undefined }, { ...free, id: 'releasing', state: 'Releasing' }]
  expect(gatewayCreateIps(rows, vpc, 'router')).toEqual({ ips: [free], fixed: false, defaultId: 'auto' })
  expect(gatewayCreateIps([], vpc, 'router')).toEqual({ ips: [], fixed: false, defaultId: 'auto' })
})
test('multiple or invalid router IPs cannot be guessed', () => {
  const router = { ...ip, issourcenat: false, virtualmachinetype: 'DomainRouter' }
  expect(() => gatewayCreateIps([router, { ...router, id: 'second' }], vpc, 'router')).toThrow('ip.ambiguous')
  expect(() => gatewayCreateIps([{ ...router, issourcenat: true }], vpc, 'router')).toThrow('ip.ambiguous')
})
test('selection rechecks VPC, offering, visible and hidden gateways, then owner-scoped IPs', async () => {
  const read = response(); const result = await gatewayCreateSelection(read, vpc, true)
  expect(result.defaultId).toBe('ip'); expect(read.mock.calls.map(call => call[0])).toEqual(['listVPCs', 'listVPCOfferings', 'listVpnGateways', 'listVpnGateways', 'listPublicIpAddresses'])
  expect(read.mock.calls.at(-1)[2]).toEqual({ vpcid: 'vpc', account: 'owner', domainid: 'domain' })
})
test('a concurrently created or hidden gateway prevents the IP phase', async () => {
  const read = response({ gateways: [{ id: 'new', vpcid: 'vpc', account: 'owner', domainid: 'domain' }] })
  await expect(gatewayCreateSelection(read, vpc, true)).rejects.toThrow('exists'); expect(read.mock.calls.some(([command]) => command === 'listPublicIpAddresses')).toBe(false)
})
test('a VPC owner change or a gateway in the wrong VPC cannot be accepted', async () => {
  await expect(gatewayCreateSelection(response({ vpcs: [{ ...vpc, account: 'other' }] }), vpc, true)).rejects.toThrow('context')
  await expect(gatewayCreateSelection(response({ gateways: [{ id: 'other', vpcid: 'other' }] }), vpc, true)).rejects.toThrow('context')
})
test('paged lookup reaches all pages and reports a distinct bounded-limit error', async () => {
  const api = jest.fn(async (command, params) => ({ listvpcsresponse: { vpc: Array.from({ length: params.page === 1 ? 100 : 1 }, (_, index) => ({ id: params.page + '-' + index })) } }))
  expect(await gatewayRows(api, 'listVPCs', 'vpc', {})).toHaveLength(101)
  api.mockImplementation(async (command, params) => ({ listvpcsresponse: { vpc: Array.from({ length: 100 }, (_, index) => ({ id: params.page + '-' + index })) } }))
  await expect(gatewayRows(api, 'listVPCs', 'vpc', {})).rejects.toThrow('lookup.limit')
})
