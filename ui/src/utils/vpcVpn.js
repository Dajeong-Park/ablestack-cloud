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

export const vpcVpnApis = kind => ['listVPCs', 'listVpnGateways', 'queryAsyncJobResult', ...(kind === 'gateway' ? ['listPublicIpAddresses', 'createVpnGateway'] : ['listVpnCustomerGateways', 'listVpnConnections', 'createVpnConnection'])]
export const vpcVpnOwner = resource => resource.projectid ? { projectid: resource.projectid } : { account: resource.account, domainid: resource.domainid }
export function vpcVpnContext (vm, kind) {
  const user = vm.$store.getters.userInfo || {}
  const r = vm.resource || {}
  return JSON.stringify([kind, r.id, r.projectid, r.account, r.domainid, r.zoneid, vm.$route.fullPath || vm.$route.path, user.id, user.roleid, user.roletype, vm.$store.getters.project?.id, vm.$store.state?.user?.token, vpcVpnApis(kind).map(api => api in (vm.$store.getters.apis || {}))])
}
export function vpcVpnIps (rows, vpcid) {
  const ips = rows.filter(ip => ip.vpcid === vpcid)
  if (ips.some(ip => ip.issourcenat && ip.forprovider)) {
    const router = ips.filter(ip => ip.forprovider && ip.virtualmachinetype === 'DomainRouter')
    return router.length ? router : ips.filter(ip => ip.forprovider && !ip.issourcenat && !ip.isstaticnat)
  }
  return ips.filter(ip => ip.issourcenat)
}
export function vpcVpnSameOwner (row, resource) {
  if ((row.projectid || '') !== (resource.projectid || '')) return false
  return !!resource.projectid || ((!row.account || row.account === resource.account) && (!row.domainid || row.domainid === resource.domainid))
}
