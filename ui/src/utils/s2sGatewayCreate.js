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

import { gatewayOwner } from '@/utils/s2sGateway'

export const gatewayCreateApis = ['listVPCOfferings', 'listPublicIpAddresses']
const fail = reason => { throw Error('message.s2s.create.' + reason) }
const ownerMatches = (row, vpc) => vpc.projectid
  ? row.projectid === vpc.projectid
  : !row.projectid && row.account === vpc.account && row.domainid === vpc.domainid
const providers = (offering, name) => {
  const services = offering?.service?.filter(service => service.name?.toLowerCase() === name.toLowerCase()) || []
  return services.flatMap(service => service.provider || []).map(provider => provider.name?.toLowerCase())
}
export function gatewayVpcPolicy (vpc, offering) {
  if (vpc.state !== 'Enabled') return { reason: 'inactive' }
  if (!vpc.vpcofferingid || offering?.id !== vpc.vpcofferingid) return { reason: 'provider.unknown' }
  const vpn = providers(offering, 'Vpn')
  const nat = providers(offering, 'SourceNat')
  if (vpn.length !== 1 || vpn[0] !== 'vpcvirtualrouter') return { reason: 'provider.unsupported' }
  if ((offering.service || []).some(service => service.name?.toLowerCase() === 'sourcenat') && !nat.length) return { reason: 'provider.unknown' }
  if (nat.length && (nat.length !== 1 || nat[0] !== 'vpcvirtualrouter')) return { reason: 'provider.unsupported' }
  return { kind: nat.length ? 'sourcenat' : 'router', reason: '' }
}
export function gatewayCandidateLabel (vpc) {
  return [vpc.name || vpc.id, vpc.id, vpc.project || vpc.projectid || vpc.account, vpc.zonename || vpc.zoneid].filter(Boolean).join(' · ')
}
export async function gatewayExisting (read, params, root) {
  // Omission means true on this API. Only Root may inspect the false branch.
  const pages = await Promise.all((root ? [true, false] : [undefined]).map(display => read('listVpnGateways', 'vpngateway', { ...params, ...(display === undefined ? {} : { fordisplay: display }) })))
  return pages.flat()
}
function scoped (rows, project, user) {
  if (rows.some(row => project ? row.projectid !== project : !!row.projectid || user.roletype === 'User' && !ownerMatches(row, user))) fail('context')
  return rows
}
export async function gatewayCreateCandidates (read, getters) {
  const project = getters.project?.id && String(getters.project.id) !== '0' ? getters.project.id : ''
  const scope = project ? { projectid: project } : {}
  const [vpcs, existing] = await Promise.all([read('listVPCs', 'vpc', scope), gatewayExisting(read, scope, getters.userInfo.roletype === 'Admin')])
  scoped(vpcs, project, getters.userInfo); scoped(existing, project, getters.userInfo)
  const occupied = new Set(existing.map(row => row.vpcid))
  const ids = [...new Set(vpcs.filter(vpc => vpc.state === 'Enabled' && !occupied.has(vpc.id)).map(vpc => vpc.vpcofferingid).filter(Boolean))]
  const offerings = new Map(await Promise.all(ids.map(async id => {
    const rows = await read('listVPCOfferings', 'vpcoffering', { id })
    if (rows.some(row => row.id !== id) || rows.length > 1) fail('context')
    return [id, rows[0]]
  })))
  return vpcs.map(vpc => ({ ...vpc, ...gatewayVpcPolicy(vpc, offerings.get(vpc.vpcofferingid)), ...(occupied.has(vpc.id) ? { reason: 'exists' } : {}) }))
}
export function gatewayCreateIps (rows, vpc, kind) {
  if (rows.some(ip => ip.vpcid !== vpc.id || !ownerMatches(ip, vpc) || ip.zoneid !== vpc.zoneid)) fail('context')
  const allocated = rows.filter(ip => ip.state === 'Allocated' && ip.id && ip.ipaddress)
  if (kind === 'sourcenat') {
    const ips = allocated.filter(ip => ip.issourcenat === true)
    if (ips.length !== 1 || rows.filter(ip => ip.issourcenat === true).length !== 1) fail(ips.length ? 'ip.ambiguous' : 'ip.missing')
    return { ips, fixed: true, defaultId: ips[0].id }
  }
  if (kind !== 'router') fail('provider.unknown')
  // ApiResponseHelper maps isForRouter to virtualmachinetype=DomainRouter.
  // forprovider is a dedicated external-provider range flag, not isForRouter.
  const routers = rows.filter(ip => ip.virtualmachinetype === 'DomainRouter')
  if (routers.length) {
    if (routers.length !== 1 || !allocated.includes(routers[0]) || routers[0].issourcenat !== false) fail('ip.ambiguous')
    return { ips: routers, fixed: true, defaultId: routers[0].id }
  }
  const ips = allocated.filter(ip => ip.issourcenat === false && ip.isstaticnat === false && !ip.virtualmachineid && !ip.virtualmachinetype && ip.hasrules === false && ip.forprovider === false)
  // getIpAddressForVpcVr(null, true) allocates an IP when none is associated.
  return { ips, fixed: false, defaultId: 'auto' }
}
export async function gatewayCreateSelection (read, expected, root) {
  const vpcs = await read('listVPCs', 'vpc', { ...gatewayOwner(expected), id: expected.id })
  if (vpcs.length !== 1 || vpcs[0].id !== expected.id || !ownerMatches(vpcs[0], expected) || vpcs[0].zoneid !== expected.zoneid) fail('context')
  const vpc = vpcs[0]
  if (!vpc.vpcofferingid) fail('provider.unknown')
  const offerings = await read('listVPCOfferings', 'vpcoffering', { id: vpc.vpcofferingid })
  if (offerings.length !== 1) fail('provider.unknown')
  const policy = gatewayVpcPolicy(vpc, offerings[0])
  if (policy.reason) fail(policy.reason)
  const existing = await gatewayExisting(read, { ...gatewayOwner(vpc), vpcid: vpc.id }, root)
  if (existing.some(row => row.vpcid !== vpc.id || !ownerMatches(row, vpc))) fail('context')
  if (existing.length) fail('exists')
  const rows = await read('listPublicIpAddresses', 'publicipaddress', { ...gatewayOwner(vpc), vpcid: vpc.id })
  return { vpc, ...policy, ...gatewayCreateIps(rows, vpc, policy.kind) }
}
