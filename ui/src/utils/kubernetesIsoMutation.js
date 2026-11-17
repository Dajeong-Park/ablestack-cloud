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
import { kubernetesIsoContext, kubernetesIsoCapability } from '@/utils/kubernetesIsoCapabilities'
import { kubernetesIsoListResponse } from '@/utils/kubernetesIsoModel'

// Only operation metadata is kept in this tab. The scope is a one-way digest;
// no credential, raw session, user data or URL is persisted. Lost receipts
// survive closing/reopening and page reload until their outcome is reconciled.
const writes = new Map()
export const kubernetesMutationScope = (getters, token, id) => hash.sha256().update(kubernetesIsoContext(getters, token, id)).digest('hex')
const storageKey = key => 'kubernetes-iso-mutation:' + key
export function saveKubernetesMutation (key, receipt) {
  if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(storageKey(key), JSON.stringify(receipt))
}
export function kubernetesMutationReceipt (key) {
  if (writes.has(key)) return writes.get(key)
  if (typeof sessionStorage === 'undefined') return undefined
  const raw = sessionStorage.getItem(storageKey(key))
  if (!raw) return undefined
  try {
    const value = JSON.parse(raw)
    if (!value || !['update', 'delete'].includes(value.operation) || typeof value.id !== 'string' || !/^[a-f0-9-]{36}$/i.test(value.id) || !['writing', 'pending', 'uncertain'].includes(value.status) || typeof value.jobid !== 'string' || value.jobid && !/^[a-f0-9-]{36}$/i.test(value.jobid) || value.operation === 'update' && !['Enabled', 'Disabled'].includes(value.state)) throw new Error()
    writes.set(key, value)
    return value
  } catch (_) { return { operation: 'unknown', status: 'uncertain', jobid: '' } }
}
export function beginKubernetesMutation (key, operation, record, state) {
  if (kubernetesMutationReceipt(key)) throw new Error('message.kubernetes.iso.mutation.uncertain')
  const receipt = { operation, id: record.id, isoid: record.isoid, state, status: 'writing', jobid: '' }
  saveKubernetesMutation(key, receipt)
  writes.set(key, receipt)
  return receipt
}
export function finishKubernetesMutation (key, receipt) {
  if (writes.get(key) === receipt) {
    if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(storageKey(key))
    writes.delete(key)
  }
}
export function kubernetesMutationSnapshot (json, getters, id, deletion) {
  const result = kubernetesIsoListResponse(json, getters, id)
  if (result.status === 'missing') return null
  const record = result.rows[0]
  if (!['Enabled', 'Disabled'].includes(record.state)) throw new Error('message.kubernetes.iso.read.invalid')
  if (deletion && (record.referenceschecked !== true || typeof record.isreferenced !== 'boolean')) throw new Error('message.kubernetes.iso.mutation.references.unknown')
  return record
}
export function kubernetesMutationParams (operation, record, state, getters) {
  const capability = kubernetesIsoCapability(operation, getters)
  if (!capability.available || !kubernetesIsoCapability('read', getters).available) throw new Error('message.kubernetes.iso.read.forbidden')
  if (operation === 'delete') {
    if (!kubernetesIsoCapability('read', getters).parameters.showreferences || record.referenceschecked !== true) throw new Error('message.kubernetes.iso.mutation.references.unknown')
    if (record.isreferenced !== false) throw new Error('message.kubernetes.iso.mutation.references.used')
    if (!getters.apis?.queryAsyncJobResult) throw new Error('message.kubernetes.iso.read.forbidden')
    return { id: record.id }
  }
  if (!capability.parameters.expectedstate || !['Enabled', 'Disabled'].includes(state) || state === record.state) throw new Error('message.kubernetes.iso.mutation.changed')
  return { id: record.id, state, expectedstate: record.state }
}
export function kubernetesMutationJob (json, jobid) {
  const root = json?.queryasyncjobresultresponse
  if (!root || root.jobid !== jobid || ![0, 1, 2].includes(root.jobstatus)) throw new Error('message.kubernetes.iso.read.invalid')
  if (root.jobstatus === 1 && root.jobresult?.success !== true) throw new Error('message.kubernetes.iso.read.invalid')
  return { status: root.jobstatus, error: root.jobresult?.errortext || '' }
}
