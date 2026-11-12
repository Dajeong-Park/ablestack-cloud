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

import { diagnosePhysicalNetworkOffering, readDiagnosticList } from './networkOfferingDiagnostics'

const serviceName = value => String(value || '').toLowerCase()
const service = (resource, name) => resource.service?.find(item => serviceName(item.name) === serviceName(name))
const providers = item => (item?.provider || []).map(provider => serviceName(provider.name)).filter(Boolean)

function publicLb (resource) {
  const lb = service(resource, 'Lb')
  if (!lb) return false
  const schemes = lb.capability?.find(cap => serviceName(cap.name) === 'lbschemes')
  if (schemes) return serviceName(schemes.value).split(',').some(value => value.trim() === 'public')
  // Offering responses expose the internal flag; the server makes the
  // internal and public LB modes mutually exclusive.
  return typeof resource.supportsinternallb === 'boolean' ? !resource.supportsinternallb : undefined
}

export function vpcTierScope (vm) {
  const { project, userInfo, token, apis } = vm.$store.getters
  const { id, zoneid, projectid, domainid, account, vpcofferingid } = vm.resource
  return JSON.stringify([vm.$route.fullPath, id, zoneid, projectid, domainid, account, vpcofferingid,
    project?.id, userInfo?.id, userInfo?.roleid, token, Object.keys(apis || {}).sort()])
}

export function vpcTierCompatibility (vpc, vpcOffering, offering, otherOfferings) {
  const issues = []
  const vpcServices = vpcOffering?.service?.length ? vpcOffering.service : vpc.service
  const external = (offering.service || []).some(item => providers(item).some(name => ['nsx', 'netris'].includes(name)))
  const vpcMode = serviceName(vpcOffering?.networkmode || (service({ service: vpcServices }, 'SourceNat') ? 'NATTED' : ''))
  const tierMode = serviceName(offering.networkmode || (service(offering, 'SourceNat') ? 'NATTED' : ''))
  let incomplete = !vpcMode || !tierMode || !vpcServices?.length || !offering.service?.length
  if (vpcMode && tierMode && vpcMode !== tierMode) issues.push({ reason: 'vpc.mode' })
  if (vpc.asnumberid && serviceName(offering.routingmode) !== 'dynamic') issues.push({ reason: 'vpc.routing' })
  // VPC and tier API responses omit the internal Gateway service. Routed
  // offerings may use it in place of SourceNat.
  if (vpcMode === 'natted' && !external && offering.service?.length && !service(offering, 'SourceNat')) issues.push({ reason: 'vpc.sourcenat' })
  for (const entry of offering.service || []) {
    if (serviceName(entry.name) === 'gateway') continue
    const required = providers(entry)
    const available = providers(service({ service: vpcServices }, entry.name))
    if (!required.length) incomplete = true
    for (const provider of entry.provider || []) {
      if (vpcServices?.length && provider.name && !available.includes(serviceName(provider.name))) {
        issues.push({ service: entry.name, provider: provider.name, reason: 'vpc.service' })
      }
    }
  }
  const publicCandidate = publicLb(offering)
  const lb = service(offering, 'Lb')
  const isolation = lb?.capability?.find(cap => serviceName(cap.name) === 'supportedlbisolation')
  if (providers(lb).includes('netscaler') && serviceName(isolation?.value) === 'shared') {
    issues.push({ service: 'Lb', provider: 'Netscaler', reason: 'vpc.lb.dedicated' })
  }
  if (publicCandidate === undefined) incomplete = true
  if (publicCandidate) {
    for (const tier of vpc.network || []) {
      if (tier.networkofferingid === offering.id) continue
      const other = otherOfferings.get(tier.networkofferingid)
      const existing = publicLb(other || tier)
      if (existing) {
        issues.push({ service: 'Lb', reason: 'vpc.public.lb' })
        break
      }
      if (existing === undefined || (!other && !tier.service)) incomplete = true
    }
  }
  return { issues, incomplete }
}

export async function loadVpcTierChoices (get, apis, vpc) {
  const owner = { ignoreproject: true, ...(vpc.projectid ? { projectid: vpc.projectid } : {}) }
  const reads = new Map()
  const cached = (command, args, config) => {
    const key = JSON.stringify([command, args])
    if (!reads.has(key)) reads.set(key, get(command, { ...args }, config))
    return reads.get(key)
  }
  const list = (command, key, params) => readDiagnosticList(cached, command, { ...params, ignoreproject: true }, key)
  const [offerings, vpcOfferings, zones, acls] = await Promise.all([
    list('listNetworkOfferings', 'networkoffering', { zoneid: vpc.zoneid, forvpc: true, guestiptype: 'Isolated', state: 'Enabled' }),
    'listVPCOfferings' in apis ? list('listVPCOfferings', 'vpcoffering', { id: vpc.vpcofferingid }) : [],
    'listZones' in apis ? list('listZones', 'zone', { id: vpc.zoneid }) : [],
    'listNetworkACLLists' in apis ? list('listNetworkACLLists', 'networkacllist', { vpcid: vpc.id, ...owner }) : []
  ])
  const vpcOffering = vpcOfferings.find(item => item.id === vpc.vpcofferingid)
  const byId = new Map(offerings.map(offering => [offering.id, offering]))
  // Existing tiers can use an offering which has since been disabled.
  const missing = new Set((vpc.network || []).filter(tier => service(tier, 'Lb') && !byId.has(tier.networkofferingid)).map(tier => tier.networkofferingid))
  await Promise.all([...missing].filter(Boolean).map(async id => {
    const offering = (await list('listNetworkOfferings', 'networkoffering', { id })).find(item => item.id === id)
    if (offering) byId.set(id, offering)
  }))
  const choices = await Promise.all(offerings.filter(item => item.state === 'Enabled').map(async offering => {
    const { issues, incomplete } = vpcTierCompatibility(vpc, vpcOffering, offering, byId)
    const physical = issues.length ? null : await diagnosePhysicalNetworkOffering(
      (command, args, options) => cached(command, { ...args, ignoreproject: true }, options),
      apis, { zoneId: vpc.zoneid, offering })
    const blocked = !!issues.length || physical?.blocked === true
    return {
      offering,
      issues: [...issues, ...(physical?.issues || [])],
      checks: physical?.checks || [],
      network: physical?.network,
      blocked,
      status: blocked ? 'invalid' : incomplete || physical?.status !== 'ready' ? 'unknown' : 'ready'
    }
  }))
  const asNumbers = choices.some(item => !item.blocked && needsTierAsNumber(item.offering)) && 'listASNumbers' in apis
    ? await list('listASNumbers', 'asnumber', { zoneid: vpc.zoneid, isallocated: false }) : []
  return { choices, acls, zone: zones.find(zone => zone.id === vpc.zoneid), asNumbers }
}

export const tierHasAcl = offering => !!offering && (!!service(offering, 'NetworkACL') ||
  (offering.service || []).some(item => providers(item).includes('nsx')))
export const needsTierAsNumber = offering => !!offering?.specifyasnumber && serviceName(offering.routingmode) === 'dynamic'

export function tierNetworkMatches (network, params) {
  return network?.id && network.vpcid === params.vpcid && network.name === params.name &&
    network.networkofferingid === params.networkofferingid && network.gateway === params.gateway &&
    network.netmask === params.netmask && (!params.aclid || network.aclid === params.aclid) &&
    (!params.projectid || network.projectid === params.projectid) && (!params.externalid || network.externalid === params.externalid)
}
