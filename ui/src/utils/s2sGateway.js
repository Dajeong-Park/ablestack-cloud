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

import { vpcVpnOwner, vpcVpnSameOwner } from '@/utils/vpcVpn'

export const gatewayName = row => row?.publicip || row?.vpcname || row?.id || '-'
export const gatewayOwner = vpcVpnOwner
export const gatewaySameOwner = vpcVpnSameOwner
export const gatewayApis = mode => ['listVpnGateways', 'queryAsyncJobResult', mode === 'create' ? 'createVpnGateway' : 'deleteVpnGateway', ...(mode === 'create' ? ['listVPCs'] : [])]
export function gatewayContext (vm, resource = vm.resource) {
  const getters = vm.$store.getters
  const user = getters.userInfo || {}
  const row = resource || {}
  return JSON.stringify([vm.$route.path, row.id, row.vpcid, row.account, row.domainid, row.projectid, user.id, user.roleid, user.roletype, getters.project?.id, getters.listAllProjects, vm.$store.state?.user?.token, Object.keys(getters.apis || {}).sort()])
}
export async function gatewayRows (api, command, field, params, current = () => true) {
  const rows = []
  for (let page = 1; page <= 100; page++) {
    if (!current()) throw Error('stale')
    const json = await api(command, { ...params, ignoreproject: true, listall: true, page, pagesize: 100 }, { preserveOnFailure: true, timeout: 15000 })
    if (!current()) throw Error('stale')
    const body = json?.[command.toLowerCase() + 'response']
    if (!body || body.errorcode || body[field] !== undefined && !Array.isArray(body[field])) throw Error('message.s2s.gateway.lookup.failed')
    const batch = body[field] || []
    if (batch.some(row => !row.id) || new Set([...rows, ...batch].map(row => row.id)).size !== rows.length + batch.length) throw Error('message.s2s.gateway.lookup.failed')
    rows.push(...batch)
    if (batch.length < 100) return rows
  }
  throw Error('message.s2s.gateway.lookup.failed')
}
export async function readGatewayDetail (api, route, getters, current) {
  if (!getters.userInfo?.id || !('listVpnGateways' in (getters.apis || {}))) throw Error('permission')
  const project = String(getters.project?.id || (getters.listAllProjects ? '-1' : '0'))
  if (!/^[\da-f-]{36}$/i.test(route.params?.id)) throw Error('invalid')
  const rows = await gatewayRows(api, 'listVpnGateways', 'vpngateway', { id: route.params.id, ...(project === '0' ? {} : { projectid: project }) }, current)
  if (rows.length !== 1) throw Error('missing')
  const row = rows[0]
  if (row.id !== route.params.id || project === '0' && row.projectid || !['0', '-1'].includes(project) && row.projectid !== project) throw Error('scope')
  if (getters.userInfo.roletype === 'User' && !row.projectid && (row.account !== getters.userInfo.account || row.domainid !== getters.userInfo.domainid)) throw Error('permission')
  return { listvpngatewaysresponse: { count: 1, vpngateway: rows } }
}
export function gatewayConnectionRows (rows, resource) {
  if (rows.some(row => row.s2svpngatewayid !== resource.id || !gatewaySameOwner(row, resource))) throw Error('message.s2s.gateway.context.changed')
  // Whitelist read-only presentation fields; PSK and policy data never enter tab state.
  return rows.map(({ id, publicip, gateway, state, created, s2svpngatewayid, s2scustomergatewayid }) => ({ id, publicip, gateway, state, created, s2svpngatewayid, s2scustomergatewayid }))
}

// Upgrade only the former default selection; preserve deliberate user choices.
export function gatewayVisibleColumns (selected, defaults) {
  return JSON.stringify(selected) === JSON.stringify(['publicip', 'account', 'domain']) ? [...defaults] : selected
}
export function gatewayDeletedListLocation (location, id) {
  if (location.query?.id !== id) return location
  const query = { ...location.query, page: '1' }
  delete query.id
  return { ...location, query }
}
