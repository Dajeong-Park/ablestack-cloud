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

import hash from 'hash.js'
import { validTemplateChecksum } from '@/utils/templateForm'
import { validIsoUrl, isoReadiness } from '@/utils/isoRegistration'
import { isoListResponse } from '@/utils/isoModel'
import { kubernetesIsoRegistrationParams, kubernetesIsoCapability } from '@/utils/kubernetesIsoCapabilities'
import { kubernetesIsoListResponse } from '@/utils/kubernetesIsoModel'

export const ALL_KUBERNETES_ZONES = 'all'
export const MIN_KUBERNETES_VERSION = '1.11.0'
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value)
const architectures = ['x86_64', 'aarch64', 's390x']
const digestLengths = { MD5: 32, 'SHA-1': 40, 'SHA-224': 56, 'SHA-256': 64, 'SHA-384': 96, 'SHA-512': 128 }
const fail = key => { throw new Error(key) }
const text = value => typeof value === 'string' ? value.trim() : ''

export function validKubernetesVersion (value) {
  const raw = text(value)
  if (!/^[0-9]+(?:\.[0-9]+){2,}$/.test(raw)) return false
  const parts = raw.split('.').map(Number)
  if (parts.some(p => !Number.isSafeInteger(p) || p > 2147483647)) return false
  for (const [i, minimum] of [1, 11, 0].entries()) {
    if (parts[i] !== minimum) return parts[i] > minimum
  }
  return true
}

export function validKubernetesInteger (value, minimum) {
  const raw = typeof value === 'number' ? String(value) : text(value)
  return /^\d+$/.test(raw) && Number.isSafeInteger(Number(raw)) && Number(raw) >= minimum && Number(raw) <= 2147483647
}

export function validKubernetesChecksum (value) {
  const raw = value == null ? '' : text(value)
  if (value != null && typeof value !== 'string') return false
  if (!raw) return true
  const match = /^(?:\{([A-Za-z0-9-]+)\})?([a-fA-F0-9]+)$/.exec(raw)
  return !!match && Object.prototype.hasOwnProperty.call(digestLengths, match[1] || 'MD5') &&
    validTemplateChecksum(raw) && match[2].length === digestLengths[match[1] || 'MD5']
}

export function validKubernetesIsoUrl (value) {
  const raw = text(value)
  if (!validIsoUrl(raw) || /%(?![0-9a-f]{2})/i.test(raw)) return false
  try { return /(?:\.iso(?:\.(?:gz|bz2|zip|xz))?|\.metalink)$/i.test(decodeURIComponent(new URL(raw).pathname)) } catch (_) { return false }
}

export function kubernetesDirectDownloadForced (zoneid, zones = []) {
  return zoneid === ALL_KUBERNETES_ZONES ? zones.some(z => z.type === 'Edge') : zones.find(z => z.id === zoneid)?.type === 'Edge'
}

export function kubernetesUrlErrors (form, zones, capability) {
  const errors = {}
  if (!capability.available) errors._form = 'message.kubernetes.iso.read.forbidden'
  if (!validKubernetesVersion(form.semanticversion)) errors.semanticversion = 'message.kubernetes.iso.version.invalid'
  if (!validKubernetesInteger(form.mincpunumber, 2)) errors.mincpunumber = 'message.kubernetes.iso.cpu.invalid'
  if (!validKubernetesInteger(form.minmemory, 2048)) errors.minmemory = 'message.kubernetes.iso.memory.invalid'
  if (!validKubernetesIsoUrl(form.url)) errors.url = 'message.kubernetes.iso.url.invalid'
  if (!validKubernetesChecksum(form.checksum)) errors.checksum = 'message.kubernetes.iso.checksum.invalid'
  if (form.zoneid !== ALL_KUBERNETES_ZONES && (!uuid(form.zoneid) || !zones.some(z => z.id === form.zoneid))) errors.zoneid = 'message.error.select'
  const arch = form.arch || 'x86_64'
  if (!architectures.includes(arch) || (capability.schemaKnown && !capability.parameters.arch && arch !== 'x86_64')) errors.arch = 'message.kubernetes.iso.arch.invalid'
  if (typeof form.directdownload !== 'boolean' || (kubernetesDirectDownloadForced(form.zoneid, zones) && !form.directdownload) ||
      (capability.schemaKnown && !capability.parameters.directdownload && form.directdownload)) errors.directdownload = 'message.kubernetes.iso.direct.invalid'
  return errors
}

export function kubernetesUrlParams (form, zones, getters) {
  const capability = kubernetesIsoCapability('url', getters)
  const errors = kubernetesUrlErrors(form, zones, capability)
  if (Object.keys(errors).length) fail(Object.values(errors)[0])
  const values = {
    ...form,
    name: text(form.name),
    semanticversion: text(form.semanticversion),
    url: text(form.url),
    checksum: text(form.checksum),
    mincpunumber: Number(form.mincpunumber),
    minmemory: Number(form.minmemory),
    arch: form.arch || 'x86_64',
    zoneid: form.zoneid === ALL_KUBERNETES_ZONES ? undefined : form.zoneid
  }
  return kubernetesIsoRegistrationParams('url', values, getters)
}

export function kubernetesRegistrationName (params, zones) {
  return params.name || ('v' + params.semanticversion + (params.zoneid ? '-' + (zones.find(z => z.id === params.zoneid)?.name || '') : ''))
}

// Only opaque hashes and unresolved state survive reload in this tab. Never
// persist credentials, URLs, checksums, request payloads or upload tickets.
const journalKey = 'mold.kubernetesIso.url.unresolved.v1'
const fingerprint = value => hash.sha256().update(value).digest('hex')
let owner = ''
const attempts = new Map()
function persistAttempts () {
  try {
    const entries = [...attempts.entries()].filter(([, entry]) => entry.state !== 'accepted').map(([key]) => ({ key, state: 'uncertain' }))
    sessionStorage.setItem(journalKey, JSON.stringify({ owner, entries }))
  } catch (_) { /* A restricted browser still retains the current runtime guard. */ }
}
export function rememberKubernetesUrlAttempt (entry, state, record = null) {
  entry.state = state; entry.record = record
  persistAttempts()
}
export function synchronizeKubernetesUrlScope (scope) {
  const scopedOwner = fingerprint(scope)
  if (owner !== scopedOwner) {
    owner = scopedOwner; attempts.clear()
    try {
      const stored = JSON.parse(sessionStorage.getItem(journalKey) || 'null')
      if (stored?.owner === owner && Array.isArray(stored.entries) && stored.entries.length <= 100) {
        for (const entry of stored.entries) {
          if (/^[a-f0-9]{64}$/.test(entry?.key) && entry.state === 'uncertain') attempts.set(entry.key, { state: 'uncertain', record: null })
        }
      }
    } catch (_) { /* Storage cannot supply a confirmed acceptance. */ }
    persistAttempts()
  }
}
export function kubernetesUrlAttempt (scope, params) {
  synchronizeKubernetesUrlScope(scope)
  const key = fingerprint(JSON.stringify(params))
  if (attempts.has(key)) return { entry: attempts.get(key), fresh: false }
  if (attempts.size >= 100) {
    const complete = [...attempts.entries()].find(([, entry]) => entry.state === 'accepted')
    if (complete) attempts.delete(complete[0])
    else fail('message.kubernetes.iso.request.uncertain')
  }
  const entry = { state: 'submitting', record: null }
  attempts.set(key, entry); persistAttempts()
  return { entry, fresh: true }
}

export async function reconcileKubernetesUrl (request, params, zones, getters, options, current = () => true) {
  if (!kubernetesIsoCapability('read', getters).available) return { status: 'forbidden', rows: [] }
  const json = await request('listKubernetesSupportedVersions', { keyword: kubernetesRegistrationName(params, zones), page: 1, pagesize: 500 }, options)
  if (!current()) return { status: 'stale', rows: [] }
  const page = kubernetesIsoListResponse(json, getters)
  const rows = page.rows.filter(row => row.name === kubernetesRegistrationName(params, zones) && row.semanticversion === params.semanticversion &&
    row.isourl === params.url && (params.zoneid ? row.zoneid === params.zoneid : row.catalog.zone.kind === 'all') &&
    row.arch === (params.arch || 'x86_64') && Number(row.mincpunumber) === params.mincpunumber &&
    Number(row.minmemory) === params.minmemory && row.directdownload === (params.directdownload ?? false))
  return { status: page.countKnown && page.count === page.rows.length && rows.length === 1 ? 'found' : 'uncertain', rows }
}

export async function observeKubernetesUrl (request, accepted, zoneid, getters, options, current = () => true, expected = null) {
  if (!kubernetesIsoCapability('read', getters).available) return { key: 'forbidden', record: accepted }
  const json = await request('listKubernetesSupportedVersions', { id: accepted.id }, options)
  if (!current()) return { key: 'stale' }
  const parent = kubernetesIsoListResponse(json, getters, accepted.id)
  if (!parent.rows.length) return { key: 'missing', record: accepted }
  const record = parent.rows[0]
  if (!uuid(record.isoid) || accepted.isoid && record.isoid !== accepted.isoid) return { key: 'invalid', record }
  const scope = record.catalog.zone
  if (zoneid === ALL_KUBERNETES_ZONES ? scope.kind !== 'all' : scope.kind !== 'zone' || scope.id !== zoneid) return { key: 'invalid', record }
  if (expected && (record.arch !== (expected.arch || 'x86_64') || record.directdownload !== (expected.directdownload ?? false) ||
      Number(record.mincpunumber) !== expected.mincpunumber || Number(record.minmemory) !== expected.minmemory)) return { key: 'invalid', record }

  if (!getters.apis?.listIsos) return { key: 'forbidden', record }
  let rows = []; let count; let page = 1
  do {
    const response = await request('listIsos', { id: record.isoid, isofilter: 'all', showunique: false, page, pagesize: 500, ...(zoneid && zoneid !== ALL_KUBERNETES_ZONES ? { zoneid } : {}) }, options)
    if (!current()) return { key: 'stale' }
    const parsed = isoListResponse(response)
    if (!parsed.countKnown || parsed.rows.some(row => row.id !== record.isoid || !uuid(row.zoneid)) || count !== undefined && count !== parsed.count) fail('message.kubernetes.iso.read.invalid')
    count = parsed.count
    if (rows.length < count && !parsed.rows.length) fail('message.kubernetes.iso.read.invalid')
    rows = rows.concat(parsed.rows); page++
    if (rows.length > count || page > 100) fail('message.kubernetes.iso.read.invalid')
  } while (rows.length < count)
  const readiness = isoReadiness({ listisosresponse: { iso: rows, count } }, record.isoid, zoneid === ALL_KUBERNETES_ZONES ? '-1' : zoneid)
  return { key: readiness.ready ? 'ready' : readiness.failed ? 'failed' : rows.length ? 'progress' : 'missing', record, reasons: readiness.reasons }
}
