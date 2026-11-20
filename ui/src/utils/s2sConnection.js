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

import { ipv4 } from '@/utils/guestIpRanges'

export const vpnPassive = value => value === true || value === 'true'

export function vpnConnectionState (row) {
  const state = typeof row.state === 'string' ? row.state.toLowerCase() : ''
  if (state === 'disconnected' && vpnPassive(row.passive)) return 'label.s2s.connection.state.waiting'
  const states = {
    pending: 'connecting',
    connecting: 'connecting',
    connected: 'connected',
    disconnected: 'disconnected',
    error: 'error',
    removed: 'removed'
  }
  return typeof states[state] === 'string' ? 'label.s2s.connection.state.' + states[state] : 'label.unknown'
}

export function vpnCandidateOwner (left, right) {
  if (left.projectid || right.projectid) return !!left.projectid && left.projectid === right.projectid
  return !!left.account && left.account === right.account && !!left.domainid && left.domainid === right.domainid
}

export function vpnCandidate (row) {
  const { id, name, publicip, gateway, vpcid, vpcname, cidrlist, account, domain, domainid, project, projectid } = row
  return { id, name, publicip, gateway, vpcid, vpcname, cidrlist, account, domain, domainid, project, projectid }
}

export function vpnCandidateLabel (row, local) {
  const owner = row.projectid ? row.project || row.projectid : [row.domain || row.domainid, row.account].filter(Boolean).join(' / ')
  return [...(local ? [row.publicip || row.id, row.vpcname || row.vpcid] : [row.name || row.id, row.gateway]), owner].filter(Boolean).join(' · ')
}

const cidrValues = value => typeof value === 'string' ? value.split(',').map(cidr => cidr.trim()).filter(Boolean) : []

export function vpnCandidateChanged (before, after) {
  if (!before || !after || before.id !== after.id || !vpnCandidateOwner(before, after)) return true
  const fields = ['name', 'publicip', 'gateway', 'vpcid', 'vpcname']
  return fields.some(field => before[field] !== after[field]) ||
    cidrValues(before.cidrlist).sort().join(',') !== cidrValues(after.cidrlist).sort().join(',')
}

function cidrRange (cidr) {
  const match = /^([^/]+)\/(\d{1,2})$/.exec(cidr)
  if (!match) return null
  const address = ipv4(match[1])
  const prefix = Number(match[2])
  if (address === null || prefix > 32) return null
  const size = 2 ** (32 - prefix)
  const start = Math.floor(address / size) * size
  return { cidr, start, end: start + size }
}

function overlappingCidrs (a, b) {
  const left = cidrValues(a).map(cidrRange).filter(Boolean)
  const right = cidrValues(b).map(cidrRange).filter(Boolean)
  for (const remote of left) {
    const conflict = right.find(candidate => remote.start < candidate.end && candidate.start < remote.end)
    if (conflict) return { remote: remote.cidr, existing: conflict.cidr }
  }
}

export function vpnCandidateConflict (peer, vpcCidr, connections) {
  if (connections.some(row => row.s2scustomergatewayid === peer.id)) return { code: 'duplicate' }
  const local = overlappingCidrs(peer.cidrlist, vpcCidr)
  if (local) return { code: 'vpc.overlap', ...local }
  for (const row of connections) {
    const conflict = overlappingCidrs(peer.cidrlist, row.cidrlist)
    if (conflict) return { code: 'peer.overlap', ...conflict }
  }
  return null
}
