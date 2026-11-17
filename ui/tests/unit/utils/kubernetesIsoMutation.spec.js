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

import { beginKubernetesMutation, finishKubernetesMutation, kubernetesMutationReceipt, kubernetesMutationScope, kubernetesMutationSnapshot, kubernetesMutationParams, kubernetesMutationJob } from '@/utils/kubernetesIsoMutation'
const id = '11111111-1111-4111-8111-111111111111'
const record = { id, state: 'Enabled', semanticversion: '1.36.5', referenceschecked: true, isreferenced: false }
const getters = { userInfo: { id: 'actor', roletype: 'Admin' }, apis: { listKubernetesSupportedVersions: { params: [{ name: 'showreferences' }] }, updateKubernetesSupportedVersion: { params: [{ name: 'expectedstate' }] }, deleteKubernetesSupportedVersion: {}, queryAsyncJobResult: {} } }
const response = row => ({ listkubernetessupportedversionsresponse: { count: 1, kubernetessupportedversion: [row] } })
test('absence, denied/malformed reads and explicit unreferenced are distinct', () => {
  expect(kubernetesMutationSnapshot({ listkubernetessupportedversionsresponse: { count: 0 } }, getters, id, true)).toBeNull()
  for (const row of [{ ...record, referenceschecked: undefined }, { ...record, isreferenced: 'false' }]) expect(() => kubernetesMutationSnapshot(response(row), getters, id, true)).toThrow()
  expect(kubernetesMutationSnapshot(response(record), getters, id, true).isreferenced).toBe(false)
  expect(() => kubernetesMutationSnapshot({ errorresponse: { errorcode: 432 } }, getters, id, true)).toThrow()
})
test('referenced versions can be disabled, while deletion remains blocked', () => {
  expect(kubernetesMutationParams('update', { ...record, isreferenced: true }, 'Disabled', getters)).toEqual({ id, state: 'Disabled', expectedstate: 'Enabled' })
  expect(() => kubernetesMutationParams('delete', { ...record, isreferenced: true }, '', getters)).toThrow('references.used')
})
test('metadata loss and non-root roles fail closed independently', () => {
  expect(() => kubernetesMutationParams('update', record, 'Disabled', { ...getters, userInfo: { roletype: 'User' } })).toThrow('forbidden')
  expect(() => kubernetesMutationParams('delete', record, '', { ...getters, apis: { ...getters.apis, queryAsyncJobResult: undefined } })).toThrow('forbidden')
  expect(() => kubernetesMutationParams('update', record, 'Disabled', { ...getters, apis: { ...getters.apis, updateKubernetesSupportedVersion: {} } })).toThrow('changed')
})
test('uncertain receipts block a second write and survive consumers until confirmed', () => {
  const scope = kubernetesMutationScope(getters, 'session-a', id)
  const receipt = beginKubernetesMutation(scope, 'delete', record)
  receipt.status = 'uncertain'
  expect(() => beginKubernetesMutation(scope, 'update', record, 'Disabled')).toThrow('uncertain')
  finishKubernetesMutation(scope, { ...receipt })
  expect(kubernetesMutationReceipt(scope)).toBe(receipt)
  expect(kubernetesMutationReceipt(kubernetesMutationScope(getters, 'session-b', id))).toBeUndefined()
  finishKubernetesMutation(scope, receipt)
  expect(kubernetesMutationReceipt(scope)).toBeUndefined()
})
test('wrong-job, incomplete and malformed success cannot confirm deletion', () => {
  expect(kubernetesMutationJob({ queryasyncjobresultresponse: { jobid: id, jobstatus: 0 } }, id).status).toBe(0)
  expect(kubernetesMutationJob({ queryasyncjobresultresponse: { jobid: id, jobstatus: 2, jobresult: { errortext: 'ISO failure' } } }, id).status).toBe(2)
  for (const root of [{ jobid: 'other', jobstatus: 1, jobresult: { success: true } }, { jobid: id, jobstatus: 1 }, { jobid: id, jobstatus: '1', jobresult: { success: true } }]) expect(() => kubernetesMutationJob({ queryasyncjobresultresponse: root }, id)).toThrow()
})

test('lost receipts survive a page/module reload without storing authentication material', () => {
  const scope = kubernetesMutationScope(getters, 'private-session-value', id)
  const receipt = beginKubernetesMutation(scope, 'update', record, 'Disabled')
  const persisted = sessionStorage.getItem('kubernetes-iso-mutation:' + scope)
  expect(persisted).not.toContain('private-session-value')
  let reloaded
  jest.isolateModules(() => { reloaded = require('@/utils/kubernetesIsoMutation') })
  const recovered = reloaded.kubernetesMutationReceipt(scope)
  expect(recovered).toEqual(receipt)
  expect(() => reloaded.beginKubernetesMutation(scope, 'update', record, 'Disabled')).toThrow('uncertain')
  reloaded.finishKubernetesMutation(scope, recovered)
  finishKubernetesMutation(scope, receipt)
})
