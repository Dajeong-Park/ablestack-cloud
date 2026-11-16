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

import { isoBoolean } from './isoModel'

export const isoEditFields = ['name', 'displaytext', 'bootable', 'ostypeid', 'passwordenabled', 'isdynamicallyscalable', 'arch']
const booleans = ['bootable', 'passwordenabled', 'isdynamicallyscalable']
const own = (o, k) => Object.prototype.hasOwnProperty.call(o || {}, k)
export function isoEditCapability (getters = {}) {
  const api = getters.apis?.updateIso
  return { available: !!api, known: Array.isArray(api?.params), parameters: Object.fromEntries((Array.isArray(api?.params) ? api.params : []).filter(p => typeof p.name === 'string').map(p => [p.name.toLowerCase(), p])) }
}
export function isoEditValues (resource) {
  return Object.fromEntries(isoEditFields.map(k => [k, booleans.includes(k) ? isoBoolean(resource[k]) : ['name', 'displaytext'].includes(k) ? (resource[k] ?? '') : resource[k] ?? undefined]))
}
export function isoEditLink (resource) { return { id: resource.userdataid || '', policy: resource.userdataid ? String(resource.userdatapolicy || 'ALLOWOVERRIDE').toUpperCase() : '' } }
export function isoEditFingerprint (resource) { return JSON.stringify([isoEditValues(resource), isoEditLink(resource)]) }
export function isoEditMatches (resource, params) { const v = isoEditValues(resource); return Object.keys(params).filter(k => isoEditFields.includes(k)).every(k => v[k] === params[k]) }
export function isoOptionFilter (input, option) { return [option.label, option.value].some(v => String(v ?? '').toLowerCase().includes(String(input).toLowerCase())) }
export function isoEditParams (form, baseline, capability, osTypes = []) {
  if (!capability.available || !capability.known) throw new Error('message.iso.edit.metadata.unavailable')
  const before = isoEditValues(baseline); const params = { id: baseline.id }
  for (const key of isoEditFields) {
    const value = form[key]
    if (value === undefined || value === before[key]) continue
    if (!own(capability.parameters, key)) throw new Error('message.iso.parameter.unsupported')
    if (booleans.includes(key) && typeof value !== 'boolean') throw new Error('message.iso.parameter.invalid')
    if (key === 'name' && !String(value).trim()) throw new Error('message.error.required.input')
    if (key === 'arch' && !['x86_64', 'aarch64', 's390x'].includes(value)) throw new Error('message.iso.parameter.unsupported')
    if (key === 'ostypeid' && !value) throw new Error('message.iso.edit.os.required')
    params[key] = value
  }
  if (form.bootable === true && (before.bootable !== true || params.ostypeid)) {
    const os = osTypes.find(o => o.id === form.ostypeid)
    if (!os || /^(none|unknown)$/i.test(String(os.description || os.name || '').trim())) throw new Error('message.iso.edit.os.required')
    if (!own(capability.parameters, 'ostypeid')) throw new Error('message.iso.parameter.unsupported')
    params.ostypeid = form.ostypeid
  }
  if (params.ostypeid && params.ostypeid !== before.ostypeid) {
    if (!capability.parameters.forceupdateostype) throw new Error('message.iso.parameter.unsupported')
    params.forceupdateostype = form.forceupdateostype === true
  }
  return params
}
export function isoEditLinkTarget (id, policy) {
  const value = id || ''; const p = value ? String(policy || 'ALLOWOVERRIDE').toUpperCase() : ''
  if (value && !['ALLOWOVERRIDE', 'APPEND', 'DENYOVERRIDE'].includes(p)) throw new Error('message.iso.edit.policy.invalid')
  return { id: value, policy: p }
}
export function isoLinkParams (resource, target) {
  return { templateid: resource.id, ignoreproject: true, ...(resource.projectid ? { projectid: resource.projectid } : {}), ...(target.id ? { userdataid: target.id, userdatapolicy: target.policy } : {}) }
}
