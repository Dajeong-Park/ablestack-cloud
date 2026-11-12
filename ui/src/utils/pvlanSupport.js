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

import { readDiagnosticList } from '@/utils/networkOfferingDiagnostics'

export const pvlanDiagnosticApis = ['listHosts', 'listPhysicalNetworks', 'listTrafficTypes']
const tags = v => (Array.isArray(v) ? v : String(v || '').split(',')).map(s => s.trim()).filter(Boolean)

export async function diagnosePvlanSupport (getAPI, apis, { zoneId, physicalNetworkId, offering, hostId }) {
  const unknown = { status: 'unknown', blocked: false }
  if (!zoneId) return { status: 'empty', blocked: true }
  if (!pvlanDiagnosticApis.every(api => api in (apis || {}))) return unknown
  const physical = await readDiagnosticList(getAPI, 'listPhysicalNetworks', { zoneid: zoneId }, 'physicalnetwork')
  let matching = physical.filter(n => n.state === 'Enabled' && (!physicalNetworkId || n.id === physicalNetworkId))
  if (!physicalNetworkId) {
    const requested = tags(offering?.tags)
    matching = matching.filter(n => requested.length ? tags(n.tags).some(t => requested.includes(t)) : !tags(n.tags).length)
  }
  if (matching.length !== 1) return { status: 'unknown', blocked: true }
  const network = matching[0]
  const traffic = await readDiagnosticList(getAPI, 'listTrafficTypes', { physicalnetworkid: network.id }, 'traffictype')
  const guest = traffic.find(t => t.traffictype === 'Guest')
  if (!guest) return { status: 'unsupported', blocked: true }
  const hosts = await readDiagnosticList(getAPI, 'listHosts', { zoneid: zoneId, type: 'Routing', details: 'all', ...(hostId ? { id: hostId } : {}) }, 'host')
  const scoped = hosts.filter(h => !hostId || h.id === hostId)
  if (scoped.some(h => h.hypervisor && h.hypervisor !== 'KVM')) return unknown
  const active = scoped.filter(h => h.hypervisor === 'KVM' && h.state === 'Up' && h.resourcestate === 'Enabled')
  if (!active.length) return { status: 'unavailable', blocked: true }
  const supported = active.some(h => h.details?.['pvlan.guard.version'] === '1' &&
    tags(h.details?.['pvlan.supported.bridges']).includes(guest.kvmnetworklabel || h.details?.['pvlan.default.bridge']))
  if (supported) return { status: 'ready', blocked: false, network: network.name }
  return { status: active.some(h => h.details?.['pvlan.guard.version'] !== '1') ? 'unknown' : 'unsupported', blocked: true }
}
