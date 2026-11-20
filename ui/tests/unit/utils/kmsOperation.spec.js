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

import {
  serializeHsmDetails, keyBitsParams, kmsOperationState, submitKmsOperation,
  verifyKmsOperation, kmsResourceMatch, kmsJobResult, readKmsResource, discardKmsOperation
} from '@/utils/kmsOperation'

const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const job = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const other = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const reply = (jobstatus, resource = id) => ({ queryasyncjobresultresponse: { jobid: job, jobinstanceid: resource, jobstatus, jobresult: { success: jobstatus === 1 } } })
function rotation (overrides = {}) {
  return {
    api: 'rotateKMSKey',
    targetId: id,
    current: () => true,
    prepare: jest.fn().mockResolvedValue({ id }),
    post: jest.fn().mockResolvedValue({ rotatekmskeyresponse: { jobid: job } }),
    get: jest.fn().mockResolvedValue(reply(1)),
    verify: jest.fn().mockResolvedValue({ id, version: 2 }),
    ...overrides
  }
}

test.each([0, 129, 256.5, '', ' ', '128', null])('invalid key size %p never serializes', value => {
  expect(() => keyBitsParams(value, true)).toThrow('INVALID_FORM')
})
test('rotation keep omits the value while allowed explicit bits are used for both operations', () => {
  expect(keyBitsParams('keep', true)).toEqual({})
  expect(() => keyBitsParams('keep', false)).toThrow()
  for (const size of [128, 192, 256]) expect(keyBitsParams(size, false)).toEqual({ keybits: size })
})
test('empty details are omitted and no empty, duplicate, foreign or masked detail is accepted', () => {
  expect(serializeHsmDetails('database', [])).toEqual({})
  expect(serializeHsmDetails('pkcs11', [])).toEqual({})
  expect(serializeHsmDetails('pkcs11', [['slot_list_index', '0'], ['library', '/opt/example']])).toEqual({
    'details[0].slot_list_index': '0', 'details[0].library': '/opt/example'
  })
  for (const entries of [[['', 'x']], [['library', ' ']], [['slot', '0'], ['slot', '1']], [['pin', '*****']], [['cleanupdetails', 'true']]]) {
    expect(() => serializeHsmDetails('pkcs11', entries)).toThrow('INVALID_FORM')
  }
  expect(() => serializeHsmDetails('database', [['pin', 'example']])).toThrow()
})
test('duplicate submit is blocked and ack alone is not a success', async () => {
  const state = kmsOperationState()
  let resolveJob
  let startJob
  const started = new Promise(resolve => { startJob = resolve })
  const get = jest.fn().mockImplementation(() => new Promise(resolve => {
    resolveJob = resolve
    startJob()
  }))
  const options = rotation({ get })
  const pending = submitKmsOperation(state, options)
  expect(state.phase).toBe('validating')
  await submitKmsOperation(state, options)
  await started
  expect(state.phase).toBe('running')
  expect(options.post).toHaveBeenCalledTimes(1)
  resolveJob(reply(1))
  await pending
  expect(options.verify).toHaveBeenCalledWith(id)
  expect(state.phase).toBe('succeeded')
})
test('confirmed async failure permits one explicit retry', async () => {
  const options = rotation({ get: jest.fn().mockResolvedValueOnce(reply(2)).mockResolvedValueOnce(reply(1)) })
  const state = kmsOperationState()
  await submitKmsOperation(state, options)
  expect(state.phase).toBe('failed')
  expect(state.reason).toBe('job')
  expect(options.verify).not.toHaveBeenCalled()
  await submitKmsOperation(state, options)
  expect(state.phase).toBe('succeeded')
  expect(options.post).toHaveBeenCalledTimes(2)
})
test.each([431, 408, 530])('only definitive rejection %i permits retry and PIN is removed from the draft request', async status => {
  const state = kmsOperationState()
  const params = { name: 'profile', 'details[0].pin': 'hidden' }
  const options = rotation({
    api: 'createHSMProfile',
    prepare: () => params,
    clearSecret: jest.fn(),
    post: jest.fn().mockRejectedValue({ response: { status, data: { hidden: 'hidden' } } })
  })
  await submitKmsOperation(state, options)
  expect(params).toEqual({ name: 'profile' })
  expect(options.clearSecret).toHaveBeenCalled()
  expect(state.phase).toBe(status === 431 ? 'failed' : 'unknown')
  expect(JSON.stringify(state)).not.toContain('hidden')
})
test('lost POST is observed without resubmission or invented success', async () => {
  const state = kmsOperationState()
  const options = rotation({ post: jest.fn().mockRejectedValue(new Error('offline')), observe: jest.fn().mockResolvedValue({ count: 1 }) })
  await submitKmsOperation(state, options)
  await verifyKmsOperation(state, options)
  await submitKmsOperation(state, options)
  expect(state.phase).toBe('unknown')
  expect(state.observation).toEqual({ count: 1 })
  expect(options.post).toHaveBeenCalledTimes(1)
})
test('a known job resumes read-only after tracking was interrupted', async () => {
  const state = kmsOperationState()
  const get = jest.fn().mockRejectedValueOnce({ response: { status: 403 } }).mockResolvedValueOnce(reply(1))
  const options = rotation({ get })
  await submitKmsOperation(state, options)
  expect(state.phase).toBe('unknown')
  await verifyKmsOperation(state, options)
  expect(state.phase).toBe('succeeded')
  expect(options.post).toHaveBeenCalledTimes(1)
  expect(get.mock.calls.map(call => call[1].jobid)).toEqual([job, job])
})
test('final job success with inconclusive reread keeps the same job receipt for a read-only retry', async () => {
  const state = kmsOperationState()
  const options = rotation({ verify: jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({ id }) })
  await submitKmsOperation(state, options)
  expect(state.phase).toBe('unknown')
  await verifyKmsOperation(state, options)
  expect(state.phase).toBe('succeeded')
  expect(options.get).toHaveBeenCalledTimes(1)
  expect(options.post).toHaveBeenCalledTimes(1)
})
test('obsolete scope callbacks cannot apply a mutation or a completion', async () => {
  let live = true
  const state = kmsOperationState()
  const op = rotation({ current: () => live, prepare: () => { live = false; return { id } } })
  await submitKmsOperation(state, op)
  expect(op.post).not.toHaveBeenCalled()
  live = true
  Object.assign(state, kmsOperationState())
  let resolveJob
  let startJob
  const started = new Promise(resolve => { startJob = resolve })
  const get = jest.fn().mockImplementation(() => new Promise(resolve => {
    resolveJob = resolve
    startJob()
  }))
  const accepted = rotation({ current: () => live, get })
  const pending = submitKmsOperation(state, accepted)
  await started
  live = false
  discardKmsOperation(state)
  resolveJob(reply(1))
  await pending
  expect(accepted.verify).not.toHaveBeenCalled()
  expect(state.phase).not.toBe('succeeded')
})
test('same job and target identity and next version/size/profile must agree', () => {
  expect(() => kmsJobResult(reply(1, other), job, id)).toThrow()
  expect(() => kmsJobResult(reply(1), other, id)).toThrow()
  const before = { version: 2, keybits: 192, hsmprofileid: other }
  const next = { id, version: 3, keybits: 192, hsmprofileid: other }
  expect(kmsResourceMatch('rotateKMSKey', next, { id }, before)).toBe(true)
  expect(kmsResourceMatch('rotateKMSKey', { ...next, version: 4 }, { id }, before)).toBe(false)
  expect(kmsResourceMatch('rotateKMSKey', next, { id, keybits: 256 }, before)).toBe(false)
})
test('deleted UUID and permission denial are distinct during verification', async () => {
  const get = jest.fn().mockResolvedValue({ listkmskeysresponse: {} })
  await expect(readKmsResource(get, 'listKMSKeys', {}, id, true)).resolves.toBe(null)
  get.mockRejectedValue({ response: { status: 403 } })
  await expect(readKmsResource(get, 'listKMSKeys', {}, id, true)).rejects.toBeTruthy()
})
