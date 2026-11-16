// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements.  See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership.  The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License.  You may obtain a copy of the License at
//
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.

const operations = new Map()
const present = value => typeof value === 'string' && !!value.trim() && !['undefined', 'null'].includes(value)

export function reservationScope (resource, route, store) {
  const g = store.getters || {}; const user = g.userInfo || {}
  return JSON.stringify([resource?.id, route?.path, g.project?.id, g.listAllProjects,
    user.id, user.account, user.domainid, user.roletype, user.roleid,
    store.state?.user?.token, Object.keys(g.apis || {}).sort(), (g.apis?.reserveIpAddress?.params || []).map(p => p.name).sort()])
}

export function reservationParams (id, form, user, selectors, accounts, projects, pinnedProject) {
  if (!present(id)) throw new Error('target')
  if (pinnedProject && (form.ownerType !== 'project' || form.projectId !== pinnedProject)) throw new Error('owner')
  if (form.ownerType === 'project') {
    if (!present(form.projectId) || !projects.some(p => p.id === form.projectId)) throw new Error('owner')
    return { id, projectid: form.projectId }
  }
  if (form.ownerType !== 'account') throw new Error('owner')
  const account = selectors ? form.account : user.account
  const domain = selectors ? form.domainId : user.domainid
  if (!present(account) || !present(domain) || (selectors && !accounts.some(a => a.name === account && (!a.domainid || a.domainid === domain)))) throw new Error('owner')
  return { id, account, domainid: domain }
}

export function reservationMatches (ip, expected) {
  if (!ip || ip.id !== expected.id || ip.state !== 'Reserved') return false
  if (typeof expected.fordisplay === 'boolean' && ip.fordisplay !== expected.fordisplay) return false
  return expected.projectid ? ip.projectid === expected.projectid : !ip.projectid && ip.account === expected.account && ip.domainid === expected.domainid
}

// Retain uncertain writes in memory across dialog reopen; never persist credentials.
export function reservationOperation (scope) { return operations.get(scope) || null }
export function rememberReservation (scope, operation) { operations.set(scope, operation) }
export function forgetReservation (scope) { operations.delete(scope) }
