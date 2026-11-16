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

import md5 from 'md5'
import { reactive } from 'vue'
import { publicIpReadAuth, validatePublicIpDetail } from '@/utils/publicIpDetails'

const receipts = new Map()
const prefix = 'publicip.display.v1:'
export const displayBoolean = value => typeof value === 'boolean'
export const displayParam = (getters, command) => (getters.apis?.[command]?.params || []).some(p => p.name === 'fordisplay')
export const displayReadSupported = getters => getters.userInfo?.roletype === 'Admin' && displayParam(getters, 'listPublicIpAddresses')
export const displayWriteSupported = (getters, command = 'updateIpAddress') => displayReadSupported(getters) && displayParam(getters, command) && (command !== 'updateIpAddress' || 'queryAsyncJobResult' in (getters.apis || {}))
export const displayEditable = (row, getters) => displayWriteSupported(getters) && !!row?.id && ['Reserved', 'Allocated'].includes(row.state) && row.issystem === false && displayBoolean(row.fordisplay)
export const displayFingerprint = row => JSON.stringify(['id', 'ipaddress', 'state', 'account', 'domainid', 'projectid', 'networkid', 'associatednetworkid', 'vpcid', 'issystem', 'issourcenat', 'isstaticnat', 'virtualmachineid', 'hasrules'].map(k => row?.[k] ?? null))
export const displayScope = (row, store) => JSON.stringify([store.getters.server, publicIpReadAuth(store), row.id, ...['listPublicIpAddresses', 'reserveIpAddress', 'updateIpAddress'].map(api => (store.getters.apis?.[api]?.params || []).map(p => p.name).sort())])
export const displayBlocked = op => !!op && (op.postPending || ['submitting', 'pending', 'verifying', 'unknown'].includes(op.status))

// A root-admin exact-ID detail lookup must also find an address hidden from the default display=true list.
// Never retry a restricted caller through an administrator-only parameter.
export async function readPublicIpDetail (get, params, getters, current = () => true) {
  const options = { preserveOnFailure: true, timeout: 15000 }
  let json = await get('listPublicIpAddresses', { ...params }, options)
  if (!current()) throw new Error('message.public.ip.display.scope')
  const body = json?.listpublicipaddressesresponse
  if (params.id && params.fordisplay === undefined && displayReadSupported(getters) && body && !body.errorcode && !(body.publicipaddress || []).length && !body.count) {
    json = await get('listPublicIpAddresses', { ...params, fordisplay: false }, options)
    if (!current()) throw new Error('message.public.ip.display.scope')
  }
  return json
}
export async function readDisplayAddress (get, row, getters, current) {
  const json = await readPublicIpDetail(get, { id: row.id, state: 'Free,Reserved,Allocated,Allocating,Releasing', allocatedonly: false, listall: true, ignoreproject: true, ...(row.projectid ? { projectid: row.projectid } : {}) }, getters, current)
  validatePublicIpDetail(json, row.id)
  return json.listpublicipaddressesresponse.publicipaddress[0]
}
export function validDisplayJob (job, operation) {
  if (!job || job.jobid !== operation.jobId || ![0, 1, 2].includes(job.jobstatus)) return false
  if (job.cmd && !/(^|\.)UpdateIPAddrCmd$/i.test(job.cmd)) return false
  if (job.jobinstanceid && job.jobinstanceid !== operation.id) return false
  if (job.jobstatus === 1 && job.jobresult?.ipaddress?.id !== operation.id) return false
  return true
}
export function displayReceipt (scope, id, storage) {
  const key = prefix + md5(scope)
  if (receipts.has(key)) return receipts.get(key)
  let op = { id, status: 'idle', jobId: '', error: '', postPending: false }
  try {
    if (!storage) throw new Error('storage')
    const saved = JSON.parse(storage.getItem(key) || 'null')
    if (saved) {
      if (saved.version !== 1 || saved.operation?.id !== id || !displayBoolean(saved.operation?.desired) || !['submitting', 'pending', 'verifying', 'unknown', 'failed', 'verified'].includes(saved.operation.status)) throw new Error('receipt')
      op = { ...saved.operation, postPending: false }
      if (displayBlocked(op)) op.status = 'unknown'
    }
  } catch (_) { op = { ...op, status: 'unknown', error: 'message.public.ip.display.storage' } }
  const state = reactive(op); receipts.set(key, state); return state
}
export function saveDisplayReceipt (scope, op, storage) {
  if (!storage) throw new Error('message.public.ip.display.storage')
  storage.setItem(prefix + md5(scope), JSON.stringify({ version: 1, operation: { id: op.id, status: op.status, jobId: op.jobId, desired: op.desired, previous: op.previous, fingerprint: op.fingerprint, error: op.error || '', postPending: !!op.postPending } }))
}
export function forgetDisplayReceipt (scope, storage) { receipts.delete(prefix + md5(scope)); if (storage) storage.removeItem(prefix + md5(scope)) }
export function clearDisplayReceiptMemory () { receipts.clear() }
