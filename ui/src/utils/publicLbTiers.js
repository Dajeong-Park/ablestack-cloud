// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements. See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership. The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License. You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied. See the License for the
// specific language governing permissions and limitations
// under the License.

import { networkCollection } from '@/utils/networkLifecycle'

const lb = resource => (resource?.service || []).filter(service => service.name === 'Lb')
const providers = services => services.flatMap(service => (service.provider || []).map(provider => provider.name)).filter(Boolean)

export function hasPublicLbScheme (network) {
  return lb(network).some(service => (service.capability || []).some(capability =>
    capability.name === 'LbSchemes' && String(capability.value).split(',').some(scheme => scheme.trim() === 'Public')))
}

export function publicLbTierEligible (network, offering, vpcId, projectId) {
  if (!network?.id || network.vpcid !== vpcId || (network.projectid || '') !== (projectId || '') || !hasPublicLbScheme(network)) return false
  if (!offering?.id || offering.id !== network.networkofferingid) return false
  const allowed = providers(lb(offering))
  return providers(lb(network)).some(provider => allowed.includes(provider))
}

// Collect before filtering so an Internal-only first page cannot hide later Public tiers.
// The captured scope is also checked before every subsequent page/offering request.
export async function fetchPublicLbTiers (get, vpcId, projectId, current = () => true) {
  const scoped = (api, params, options) => {
    if (!current()) throw new Error('Public LB Tier context changed')
    return get(api, params, options)
  }
  const scope = { ignoreproject: true, ...(projectId ? { projectid: projectId } : {}) }
  const networks = await networkCollection(scoped, 'listNetworks', 'network', { ...scope, supportedservices: 'Lb', isrecursive: true, listall: true, vpcid: vpcId })
  const candidates = networks.filter(network => network.vpcid === vpcId && (network.projectid || '') === (projectId || '') && hasPublicLbScheme(network))
  const offerings = new Map()
  for (const network of candidates) {
    if (!network.networkofferingid) throw new Error('Public LB Tier offering missing')
    if (offerings.has(network.networkofferingid)) continue
    const rows = await networkCollection(scoped, 'listNetworkOfferings', 'networkoffering', { ...scope, id: network.networkofferingid, listall: true })
    if (rows.length !== 1 || rows[0].id !== network.networkofferingid) throw new Error('Public LB Tier offering unavailable')
    offerings.set(network.networkofferingid, rows[0])
  }
  if (!current()) throw new Error('Public LB Tier context changed')
  return candidates.filter(network => publicLbTierEligible(network, offerings.get(network.networkofferingid), vpcId, projectId))
}

export async function validatePublicLbTier (get, networkId, vpcId, projectId, current) {
  const scoped = (api, params, options) => {
    if (!current()) throw new Error('Public LB Tier context changed')
    return get(api, params, options)
  }
  const scope = { ignoreproject: true, ...(projectId ? { projectid: projectId } : {}) }
  const networks = await networkCollection(scoped, 'listNetworks', 'network', { ...scope, id: networkId, listall: true })
  if (networks.length !== 1 || networks[0].id !== networkId || !networks[0].networkofferingid) return false
  const offerings = await networkCollection(scoped, 'listNetworkOfferings', 'networkoffering', { ...scope, id: networks[0].networkofferingid, listall: true })
  return current() && offerings.length === 1 && publicLbTierEligible(networks[0], offerings[0], vpcId, projectId)
}
