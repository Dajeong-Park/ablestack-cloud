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

import { serializeHsmDetails } from './kmsOperation'

const supported = ['pkcs11', 'database']
export function hsmProviders (json) {
  const list = json?.listcapabilitiesresponse?.capability?.kmsproviders
  if (!Array.isArray(list) || !list.length) throw new Error('PROVIDERS_UNAVAILABLE')
  const seen = new Set()
  return list.map(item => {
    if (!item || typeof item.protocol !== 'string' || !/^[a-z0-9][a-z0-9_.-]*$/.test(item.protocol) || seen.has(item.protocol)) throw new Error('PROVIDERS_UNAVAILABLE')
    seen.add(item.protocol)
    return { protocol: item.protocol, displayname: item.displayname || item.protocol, supported: supported.includes(item.protocol) }
  })
}
export function hsmDefaultProtocol (providers) {
  return providers.find(p => p.protocol === 'pkcs11' && p.supported)?.protocol || providers.find(p => p.supported)?.protocol || ''
}
function integer (value, minimum, maximum) {
  return /^-?\d+$/.test(String(value)) && Number.isSafeInteger(Number(value)) && Number(value) >= minimum && Number(value) <= maximum
}
export function hsmFormProblem (form, providers, lists) {
  if (!form.name?.trim()) return 'name'
  if (!providers.some(p => p.protocol === form.protocol && p.supported)) return 'protocol'
  if (form.zoneMode === 'zone' && !lists.zones.some(zone => zone.id === form.zoneid)) return 'zone'
  if (!['public', 'domain', 'account', 'project'].includes(form.ownerScope)) return 'scope'
  if (['domain', 'account'].includes(form.ownerScope) && !lists.domains.some(domain => domain.id === form.domainid)) return 'domain'
  if (form.ownerScope === 'account' && !lists.accounts.some(account => account.name === form.account && account.domainid === form.domainid)) return 'account'
  if (form.ownerScope === 'project' && !lists.projects.some(project => project.id === form.projectid)) return 'project'
  if (form.protocol === 'pkcs11') {
    if (!form.library?.trim()) return 'library'
    if (!['slot', 'slot_list_index', 'token_label'].includes(form.slotMode)) return 'slot'
    if (form.slotMode === 'slot' && !integer(form.slot, -2147483648, 2147483647)) return 'slot'
    if (form.slotMode === 'slot_list_index' && !integer(form.slot_list_index, 0, 2147483647)) return 'slot'
    if (form.slotMode === 'token_label' && !form.token_label?.trim()) return 'slot'
    if (form.max_sessions !== '' && !integer(form.max_sessions, 1, 2147483647)) return 'sessions'
  }
  return ''
}
export function hsmCreateParams (form, providers, lists, pin) {
  if (pin === '*****' || hsmFormProblem(form, providers, lists)) throw new Error('INVALID_FORM')
  const params = { name: form.name.trim(), protocol: form.protocol, ispublic: form.ownerScope === 'public', ignoreproject: true }
  if (form.vendorname?.trim()) params.vendorname = form.vendorname.trim()
  if (form.zoneMode === 'zone') params.zoneid = form.zoneid
  if (['domain', 'account'].includes(form.ownerScope)) params.domainid = form.domainid
  if (form.ownerScope === 'account') params.account = form.account
  if (form.ownerScope === 'project') params.projectid = form.projectid
  if (form.protocol === 'pkcs11') {
    const entries = [['library', form.library.trim()], [form.slotMode, String(form[form.slotMode]).trim()]]
    if (form.max_sessions !== '') entries.push(['max_sessions', String(form.max_sessions).trim()])
    if (pin) entries.push(['pin', pin])
    Object.assign(params, serializeHsmDetails(form.protocol, entries))
  }
  return params
}
export function emptyHsmForm () {
  return { name: '', vendorname: '', protocol: '', ownerScope: 'account', domainid: '', account: '', projectid: '', zoneMode: 'global', zoneid: '', library: '', slotMode: 'slot_list_index', slot: '', slot_list_index: '0', token_label: '', max_sessions: '' }
}
