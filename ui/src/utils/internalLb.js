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

export const internalLbApis = mode => ['listNetworks', 'listNetworkOfferings', 'listVPCs', 'listLoadBalancers', 'queryAsyncJobResult', ...(mode === 'create' ? ['createLoadBalancer'] : ['listVirtualMachines', 'listNics', 'listLoadBalancerRuleInstances', 'assignToLoadBalancerRule'])]
export function internalLbScope (vm) {
  const r = vm.resource || {}; const user = vm.$store.getters.userInfo || {}
  return JSON.stringify([vm.mode, vm.tierId, r.id, r.networkid, r.projectid, r.account, r.domainid, vm.$route.path, vm.$route.query?.tab, user.id, user.roleid, user.roletype, user.domainid, vm.$store.state?.user?.token, vm.$store.getters.project?.id, internalLbApis(vm.mode).map(api => api in (vm.$store.getters.apis || {}))])
}
export function internalLbSuitable (network, offering) {
  const internal = row => (row.service || []).some(s => s.name === 'Lb' && (s.capability || []).some(c => c.name === 'LbSchemes' && String(c.value).split(',').map(s => s.trim()).includes('Internal')))
  const providers = row => (row.service || []).filter(s => s.name === 'Lb').flatMap(s => s.provider || []).map(p => p.name)
  const actual = providers(network); const offered = providers(offering)
  return !!network.vpcid && network.networkofferingid === offering.id && offering.state === 'Enabled' &&
    offering.supportsinternallb !== false && internal(network) && (!actual.length || !offered.length || actual.some(p => offered.includes(p)))
}
const ipv4 = value => {
  const parts = String(value).split('.')
  if (parts.length !== 4 || parts.some(p => !/^(0|[1-9]\d{0,2})$/.test(p) || +p > 255)) return null
  return parts.reduce((n, p) => n * 256 + +p, 0)
}
export function internalLbIp (ip, network) {
  if (!ip) return true
  const value = ipv4(ip); const [address, bits] = String(network.cidr || '').split('/'); const base = ipv4(address); const prefix = Number(bits)
  if (value === null || base === null || !bits || !Number.isInteger(prefix) || prefix < 1 || prefix > 30) return false
  const block = 2 ** (32 - prefix); const start = Math.floor(base / block) * block
  return value > start && value < start + block - 1 && ip !== network.gateway
}
export function internalLbBindings (rows) {
  return new Set(rows.flatMap(row => {
    const vm = row.loadbalancerruleinstance || row.virtualmachine || row
    const ips = row.lbvmipaddresses || []
    return ips.map(ip => vm.id + ':' + ip)
  }))
}
export function internalLbNicIps (vm, networkid, assigned) {
  return [...new Set((vm.nic || []).filter(n => n.networkid === networkid).flatMap(n => [n.ipaddress, ...(n.secondaryip || []).map(ip => ip.ipaddress)]).filter(Boolean))].filter(ip => !assigned.has(vm.id + ':' + ip))
}
