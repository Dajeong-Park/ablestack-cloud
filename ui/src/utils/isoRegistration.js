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

import { isoListResponse, isoBoolean, isoAvailability } from '@/utils/isoModel'
import { validTemplateChecksum } from '@/utils/templateForm'
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i
const fail = key => { throw new Error(key) }
export function validIsoUrl (value) {
  try { const raw = String(value || '').trim(); if (/\s/.test(raw) || !/^(https?|file):\/\//i.test(raw)) return false; const url = new URL(raw); return url.protocol === 'file:' ? url.pathname.startsWith('/') : ['http:', 'https:'].includes(url.protocol) && !!url.hostname && /^https?:\/\/[^/]/i.test(raw) } catch (_) { return false }
}
export function acceptedIsoId (mode, json) {
  const ids = mode === 'Upload'
    ? [json?.postuploadisoresponse?.getuploadparams?.id]
    : (Array.isArray(json?.registerisoresponse?.iso) ? json.registerisoresponse.iso.map(row => row?.id) : [])
  if (!ids.length || ids.some(id => typeof id !== 'string' || !uuid.test(id)) || new Set(ids.map(id => id.toLowerCase())).size !== 1) fail('message.iso.response.invalid')
  return ids[0]
}
// Signed fields are runtime-only. Never put this ticket into storage, logs or routes.
export function isoUploadTicket (json) {
  const value = json?.postuploadisoresponse?.getuploadparams
  const id = acceptedIsoId('Upload', json)
  if (!value || ['postURL', 'metadata', 'signature', 'expires'].some(key => value[key] == null || String(value[key]).trim() === '')) fail('message.iso.response.invalid')
  let url
  try { url = new URL(value.postURL) } catch (_) { fail('message.iso.response.invalid') }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) fail('message.iso.response.invalid')
  const ticket = { id, postURL: value.postURL, metadata: value.metadata, signature: value.signature, expires: value.expires }
  if (!Number.isFinite(ticketDeadline(ticket))) fail('message.iso.response.invalid')
  return ticket
}
function ticketDeadline (ticket) {
  const value = String(ticket?.expires || '')
  return /^\d{10}$/.test(value) ? Number(value) * 1000 : /^\d{13}$/.test(value) ? Number(value) : Date.parse(value)
}
export function uploadTicketExpired (ticket, now = Date.now()) { return !ticket || !Number.isFinite(ticketDeadline(ticket)) || now >= ticketDeadline(ticket) }
export function isoRegistrationParams (form, capability, getters = {}) {
  if (!capability.available || !capability.schemaKnown) fail('message.iso.metadata.unavailable')
  const params = {}; const supported = capability.parameters
  const admin = getters.userInfo?.roletype === 'Admin'
  const keys = ['name', 'displaytext', 'checksum', 'zoneid', 'bootable', 'ostypeid', 'arch', 'isextractable', 'ispublic', 'isfeatured', 'isdynamicallyscalable', 'passwordenabled', 'directdownload', 'domainid', 'account']
  for (const key of keys) {
    const value = form[key]
    if (value == null || value === '') continue
    if (key === 'isfeatured' && !admin) continue
    if (key === 'ispublic' && !admin && isoBoolean(getters.features?.userpublictemplateenabled) !== true) continue
    if (key === 'ostypeid' && !form.bootable) continue
    if (!supported[key]) { if (value !== false) fail('message.iso.parameter.unsupported'); continue }
    params[key] = typeof value === 'string' ? value.trim() : value
  }
  if (!params.name || !params.zoneid || (!uuid.test(params.zoneid) && params.zoneid !== '-1')) fail('message.iso.parameter.invalid')
  if (!validTemplateChecksum(params.checksum)) fail('message.template.checksum.invalid')
  if (getters.project?.id) {
    if (!supported.projectid) fail('message.iso.parameter.unsupported')
    params.projectid = getters.project.id; delete params.account; delete params.domainid
  }
  if (capability.api === 'getUploadParamsForIso') {
    if (!supported.format) fail('message.iso.metadata.unavailable')
    params.format = 'ISO'
  }
  if (capability.api === 'registerIso') {
    if (!validIsoUrl(form.url)) fail('message.iso.url.invalid')
    params.url = form.url.trim()
  }
  return params
}
export function isoReadiness (json, id, zoneid) {
  let result
  try { result = isoListResponse(json) } catch (_) { fail('message.iso.response.invalid') }
  if (result.rows.some(row => row.id.toLowerCase() !== id.toLowerCase())) fail('message.iso.response.invalid')
  const rows = result.rows.filter(row => zoneid === '-1' || row.zoneid === zoneid)
  const complete = result.countKnown && result.count === result.rows.length
  const scoped = zoneid === '-1' ? complete : rows.length > 0
  return { ...result, rows, ready: scoped && rows.length > 0 && rows.every(row => isoBoolean(row.isready) === true), failed: rows.some(row => isoBoolean(row.isready) !== true && isoAvailability(row).key === 'failed'), reasons: [...new Set(rows.flatMap(row => isoAvailability(row).reasons))] }
}
