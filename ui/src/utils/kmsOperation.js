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

import { createJobTracker } from './jobTracker'
import { kmsListPage } from './kmsSearch'

export const kmsOperationApis = [
  'createKMSKey', 'rotateKMSKey', 'updateKMSKey', 'deleteKMSKey',
  'createHSMProfile', 'updateHSMProfile', 'deleteHSMProfile'
]
export const kmsKeyBits = [128, 192, 256]
const hsmDetailKeys = ['library', 'slot', 'slot_list_index', 'token_label', 'max_sessions', 'pin']
const busyStates = ['validating', 'submitting', 'running', 'verifying']
const asyncApis = ['rotateKMSKey', 'deleteKMSKey', 'migrateVolumesToKMS']
const uuid = value => typeof value === 'string' && /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(value)
const readOptions = { preserveOnFailure: true, timeout: 15000 }

export function serializeHsmDetails (protocol, entries) {
  const details = {}
  for (const [key, value] of entries) {
    if (protocol !== 'pkcs11' || !hsmDetailKeys.includes(key) || Object.prototype.hasOwnProperty.call(details, key) ||
        typeof value !== 'string' || !value.trim() || (key === 'pin' && value === '*****')) {
      throw new Error('INVALID_FORM')
    }
    details[key] = value
  }
  return Object.fromEntries(Object.entries(details).map(([key, value]) => ['details[0].' + key, value]))
}

export function keyBitsParams (value, rotating) {
  if (rotating && value === 'keep') return {}
  if (!kmsKeyBits.includes(value)) throw new Error('INVALID_FORM')
  return { keybits: value }
}

export function kmsOperationState () {
  return { phase: 'editing', jobId: '', resourceId: '', accepted: false, stop: null, observation: null, reason: '' }
}
export const kmsOperationBusy = state => busyStates.includes(state.phase)
export const kmsCanSubmit = state => ['editing', 'failed'].includes(state.phase)

export function discardKmsOperation (state) {
  if (state.stop) state.stop()
  state.stop = null
}

export function definiteKmsRejection (error) {
  const status = Number(error?.response?.status)
  // Timeouts and gateway/transport failures can arrive after a write.
  return status >= 400 && status < 500 && ![408, 425, 429].includes(status)
}

export async function readKmsResource (get, api, scope, id, allowAbsent = false) {
  if (!uuid(id)) throw new Error('INVALID_TARGET')
  try {
    const json = await get(api, { ...scope, id, listall: true, ignoreproject: true }, readOptions)
    const { rows, count } = kmsListPage(json, api)
    if (count === 0 && allowAbsent) return null
    if (count !== 1 || rows.length !== 1 || rows[0].id !== id ||
        (scope.projectid && rows[0].projectid !== scope.projectid)) throw new Error('INVALID_TARGET')
    return rows[0]
  } catch (error) {
    const code = Number(error?.response?.status)
    const body = error?.response?.data
    const message = Object.values(body || {}).find(row => typeof row?.errortext === 'string')?.errortext
    if (allowAbsent && code === 431 && message?.startsWith('Invalid parameter id value=' + id + ' due to incorrect long value format, or entity does not exist')) return null
    throw error
  }
}

export function kmsResourceMatch (api, current, expected, before) {
  if (api.startsWith('delete')) return current === null
  if (!current || current.id !== expected.id) return false
  if (api === 'rotateKMSKey') {
    return Number.isInteger(before?.version) && current.version === before.version + 1 &&
      current.keybits === (expected.keybits ?? before.keybits) &&
      current.hsmprofileid === (expected.hsmprofileid ?? before.hsmprofileid)
  }
  return ['name', 'enabled', 'protocol', 'description', 'vendorname', 'ispublic', 'zoneid', 'projectid', 'account', 'domainid', 'hsmprofileid', 'keybits'].every(field => {
    if (expected[field] === undefined) return true
    const value = field === 'vendorname' ? current.vendor ?? current.vendorname : current[field]
    return field === 'description' ? (value || '') === expected[field] : value === expected[field]
  })
}

export function kmsJobResult (reply, id, resourceId) {
  const job = reply?.queryasyncjobresultresponse
  if (job?.jobid !== id || ![0, 1, 2].includes(job.jobstatus) ||
      (job.jobinstanceid && resourceId && job.jobinstanceid !== resourceId)) throw new Error('UNRELATED_JOB')
  return job
}

export async function trackKmsJob (state, get, current, resourceId) {
  const tracker = createJobTracker({
    maxDuration: 90000,
    maxRetries: 1,
    interval: 2000,
    query: async id => {
      if (!current()) throw new Error('CONTEXT_CHANGED')
      return kmsJobResult(await get('queryAsyncJobResult', { jobid: id, ignoreproject: true }, readOptions), id, resourceId)
    },
    onState: () => {}
  })
  state.stop = tracker.clear
  try { return await tracker.track(state.jobId) } finally { state.stop = null }
}

export async function verifyKmsOperation (state, options) {
  const { get, current, verify, observe } = options
  state.phase = 'verifying'
  try {
    if (state.jobId && !state.accepted) {
      state.phase = 'running'
      const job = await trackKmsJob(state, get, current, options.targetId)
      if (!current()) return
      if (job.jobstatus === 2) {
        state.reason = 'job'
        state.phase = 'failed'
        return
      }
      if (job.jobstatus !== 1 || job.jobresult?.success !== true) {
        throw new Error('RESULT_UNKNOWN')
      }
      state.accepted = true
      state.phase = 'verifying'
    }
    if (!current()) return
    if (state.accepted) {
      const checked = await verify(state.resourceId)
      if (current()) {
        state.observation = checked
        state.phase = checked ? 'succeeded' : 'unknown'
      }
    } else {
      const observed = await observe?.()
      if (current()) {
        state.observation = observed
        state.phase = 'unknown'
      }
    }
  } catch (_) {
    if (current()) state.phase = 'unknown'
  }
}

export async function submitKmsOperation (state, options) {
  if (!kmsCanSubmit(state) || !options.current()) return
  Object.assign(state, kmsOperationState(), { phase: 'validating' })
  let params
  try {
    params = await options.prepare()
    if (!options.current()) return
    state.phase = 'submitting'
    let pending
    try {
      pending = options.post(options.api, params, { preserveOnFailure: true, timeout: 30000 })
    } finally {
      for (const field of Object.keys(params).filter(key => key.endsWith('.pin'))) delete params[field]
      if (options.clearSecret) options.clearSecret()
    }
    const response = (await pending)?.[options.api.toLowerCase() + 'response']
    if (!options.current()) return
    const result = response?.kmskey || response?.hsmprofile || response
    if (asyncApis.includes(options.api)) {
      if (!uuid(result?.jobid)) throw new Error('RESULT_UNKNOWN')
      state.jobId = result.jobid
      state.resourceId = options.targetId
    } else {
      state.resourceId = options.targetId || result?.id
      state.accepted = options.api.startsWith('delete') ? result?.success === true
        : uuid(result?.id) && (!options.targetId || result.id === options.targetId)
    }
    await verifyKmsOperation(state, options)
  } catch (error) {
    if (options.current()) {
      const validation = state.phase === 'validating'
      state.reason = validation ? 'validation' : 'request'
      state.phase = validation || definiteKmsRejection(error) ? 'failed' : 'unknown'
    }
  } finally {
    if (options.clearSecret) options.clearSecret()
  }
}

export function kmsReadScope (form) {
  if (form.projectid) return { projectid: form.projectid }
  if (form.domainid && form.account) return { domainid: form.domainid, account: form.account }
  return {}
}

export function safeKmsObservation (row) {
  if (!row) return null
  const fields = ['id', 'name', 'description', 'protocol', 'vendor', 'enabled', 'ispublic', 'zoneid', 'projectid', 'account', 'domainid', 'hsmprofileid', 'keybits', 'version']
  return Object.fromEntries(fields.filter(key => row[key] !== undefined).map(key => [key, row[key]]))
}
