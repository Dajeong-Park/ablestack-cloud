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

import { createAutoScaleCreation } from '@/utils/autoScaleCreation'
const flush = async () => { for (let i = 0; i < 40; i++) await Promise.resolve() }
const plan = () => ({ name: 'AS02', group: { lbruleid: 'existing-LB', minmembers: 1, maxmembers: 1, interval: 60 }, profile: { userdata: 'SECRET-USERDATA', 'counterparam[0].value': 'SECRET-SNMP', apikey: 'SECRET-KEY' }, up: [{ name: 'up', scaleupduration: 60, scaleupquiettime: 60, conditions: [{ counterid: 'CPU', threshold: 100, relationaloperator: 'GT' }] }], down: [{ name: 'down', scaledownduration: 60, scaledownquiettime: 60, conditions: [{ counterid: 'CPU', threshold: 0, relationaloperator: 'LT' }] }] })
function fixture ({ failAt, lostAt, blockDelete, getFailure, pending } = {}) {
  let serial = 0; let scope = 'owner/project'; const receipts = {}; const resources = new Set(); const values = new Map()
  const storage = { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) }
  const api = {
    post: jest.fn(async (command, params) => {
      if (command.startsWith('delete')) {
        if (params.id === blockDelete) throw Object.assign(new Error('fixture'), { response: { status: 431 } })
        resources.delete(params.id); return { response: { success: true } }
      }
      if (params.creationstage === failAt) throw Object.assign(new Error('fixture'), { response: { status: 431 } })
      const resourceId = params.creationstage; resources.add(resourceId)
      receipts[params.customjobid] = { command, creationoperationid: params.creationoperationid, creationstage: params.creationstage, resourceid: resourceId, status: pending === params.creationstage ? 'PENDING' : 'SUCCESS', jobid: pending === params.creationstage ? params.customjobid : undefined, resourcestate: 'NEW' }
      if (params.creationstage === lostAt) throw new Error('connection lost')
      return { response: { id: resourceId } }
    }),
    get: jest.fn(async (command, params) => {
      if (getFailure?.(command, params)) throw new Error('offline')
      if (command === 'queryAutoScaleCreationRequest') return { response: { autoscalecreationrequest: receipts[params.requestid] || { status: 'NOTFOUND' } } }
      if (command === 'queryAsyncJobResult') return { response: { jobstatus: 0 } }
      const key = command === 'listConditions' ? 'condition' : command === 'listAutoScalePolicies' ? 'autoscalepolicy' : command === 'listAutoScaleVmProfiles' ? 'autoscalevmprofile' : 'autoscalevmgroup'
      return { response: { [key]: resources.has(params.id) ? [{ id: params.id }] : [] } }
    })
  }
  const controller = () => createAutoScaleCreation({ api, storage, scope, getScope: () => scope, makeId: () => `uuid-${++serial}`, pollOptions: { interval: 5, maxDuration: 100, maxRetries: 0 } })
  return { api, storage, values, resources, receipts, controller, scope: value => { scope = value } }
}
afterEach(() => jest.useRealTimers())
test('sync responses settle every stage and do not persist profile secrets', async () => {
  const f = fixture(); const result = await f.controller().start(plan())
  expect(result.status).toBe('success'); expect(f.resources.size).toBe(6)
  const stored = [...f.values.values()].join(''); expect(stored).not.toMatch(/SECRET|userdata|counterparam|apikey/)
  expect(f.api.post.mock.calls.every(([, p]) => p.customjobid && p.creationoperationid && p.creationstage)).toBe(true)
})
test.each(['profile', 'up.0.condition.0', 'up.0.policy', 'down.0.condition.0', 'down.0.policy', 'group'])('failure at %s stops later creation and compensates only confirmed owned resources', async failAt => {
  const f = fixture({ failAt }); const result = await f.controller().start(plan())
  expect(result.status).toBe('cleaned'); expect(f.resources.size).toBe(0)
  expect(f.api.post.mock.calls.filter(([c]) => c.startsWith('create')).slice(-1)[0][1].creationstage).toBe(failAt)
  expect(f.api.post.mock.calls.filter(([c]) => c.startsWith('delete')).every(([, p]) => p.id !== 'existing-LB')).toBe(true)
})
test.each(['profile', 'up.0.policy', 'group'])('lost %s POST response is recovered without another POST', async lostAt => {
  const f = fixture({ lostAt }); const result = await f.controller().start(plan())
  expect(result.status).toBe('success'); expect(f.api.post.mock.calls.filter(([c]) => c.startsWith('create'))).toHaveLength(6)
})
test('rapid duplicate submissions send one workflow', async () => {
  const f = fixture(); const controller = f.controller(); const first = controller.start(plan()); const second = controller.start(plan())
  await first; await second; expect(f.api.post.mock.calls.filter(([c]) => c.startsWith('create'))).toHaveLength(6)
})
test('unknown receipt blocks cleanup and leaves request UUID for recovery', async () => {
  const f = fixture({ lostAt: 'profile', getFailure: c => c === 'queryAutoScaleCreationRequest' }); const controller = f.controller()
  expect((await controller.start(plan())).status).toBe('unknown'); expect((await controller.cleanup()).status).toBe('unknown')
  expect(f.api.post).toHaveBeenCalledTimes(1); expect(controller.snapshot().stages[0].requestId).toBeTruthy()
})
test('reload recovers response loss and resumes without another profile submission', async () => {
  let offline = true; const f = fixture({ lostAt: 'profile', getFailure: c => offline && c === 'queryAutoScaleCreationRequest' }); const first = f.controller()
  expect((await first.start(plan())).status).toBe('unknown'); first.stop(); offline = false
  const reloaded = f.controller(); expect((await reloaded.resume()).status).toBe('success')
  expect(f.api.post.mock.calls.filter(([c]) => c === 'createAutoScaleVmProfile')).toHaveLength(1)
})
test('poll deadline releases controls without declaring backend failure or deleting resources', async () => {
  jest.useFakeTimers(); const f = fixture({ pending: 'profile' }); const controller = f.controller(); const run = controller.start(plan())
  await flush(); jest.advanceTimersByTime(101); await flush()
  expect((await run).status).toBe('unknown'); expect(controller.busy()).toBe(false); expect(f.api.post).toHaveBeenCalledTimes(1)
})
test('leaving view stops polling and subsequent POSTs while preserving pending server request', async () => {
  const f = fixture({ pending: 'profile' }); const controller = f.controller(); const run = controller.start(plan()); await flush(); controller.stop(); await run
  expect(controller.busy()).toBe(false); expect(f.api.post).toHaveBeenCalledTimes(1); expect([...f.values.values()].join('')).toContain('uuid-2')
})
test('context change prevents another stage and suppresses cross-owner recovery', async () => {
  const f = fixture({ pending: 'profile' }); const controller = f.controller(); const run = controller.start(plan()); await flush(); f.scope('different-owner'); controller.stop(); await run
  expect(f.api.post).toHaveBeenCalledTimes(1); expect(f.controller().snapshot()).toBeNull()
})
test('in-use cleanup failure retains resource IDs for retry and then verifies absence', async () => {
  const f = fixture({ failAt: 'down.0.policy', blockDelete: 'up.0.condition.0' }); const controller = f.controller(); const result = await controller.start(plan())
  expect(result.status).toBe('residual'); expect(result.stages.find(s => s.key === 'up.0.condition.0').cleanup).toBe('blocked')
  f.api.post.mockImplementation(async (command, params) => { f.resources.delete(params.id); return { response: { success: true } } })
  expect((await controller.cleanup()).status).toBe('cleaned'); expect(f.resources.size).toBe(0)
})
test('existing shared policies and conditions are never cleanup targets', async () => {
  const f = fixture({ failAt: 'group' }); const data = plan(); data.up[0].id = 'shared-policy'; data.up[0].conditions[0].id = 'shared-condition'
  expect((await f.controller().start(data)).status).toBe('cleaned')
  expect(f.api.post.mock.calls.filter(([c]) => c.startsWith('delete')).map(([, p]) => p.id)).not.toContain('shared-policy')
  expect(f.api.post.mock.calls.filter(([c]) => c.startsWith('delete')).map(([, p]) => p.id)).not.toContain('shared-condition')
})
test('storage failure sends no POST and returns controls', async () => {
  const f = fixture(); f.storage.setItem = () => { throw new Error('quota') }; const controller = f.controller()
  const result = await controller.start(plan()); expect(result.status).toBe('unknown'); expect(result.failureKind).toBe('storage'); expect(controller.busy()).toBe(false); expect(f.api.post).not.toHaveBeenCalled()
})
test('receipt operation mismatch prevents both continuation and deletion', async () => {
  const f = fixture({ pending: 'profile' }); const controller = f.controller(); const run = controller.start(plan()); await flush(); controller.stop(); await run
  Object.values(f.receipts)[0].creationoperationid = 'another-operation'
  const next = f.controller(); expect((await next.resume()).status).toBe('unknown'); await next.cleanup(); expect(f.api.post).toHaveBeenCalledTimes(1)
})

test('an unreadable ledger cannot be treated as successful or safely cleaned', async () => {
  const f = fixture(); f.storage.getItem = () => '{invalid-json'
  const controller = f.controller(); expect((await controller.resume()).status).toBe('unknown'); expect((await controller.cleanup()).status).toBe('unknown')
  await controller.start(plan()); expect(f.api.post).not.toHaveBeenCalled()
})

test.each([1, 2])('terminal async job %s settles the workflow without overlapping polls', async status => {
  const f = fixture({ pending: 'profile' }); const original = f.api.get.getMockImplementation()
  f.api.get.mockImplementation(async (command, params) => {
    if (command === 'queryAsyncJobResult') {
      f.receipts[params.jobid].status = status === 1 ? 'SUCCESS' : 'FAILED'
      return { response: { jobstatus: status } }
    }
    return original(command, params)
  })
  const result = await f.controller().start(plan())
  expect(result.status).toBe(status === 1 ? 'success' : 'cleaned')
  expect(f.api.post.mock.calls.filter(([c]) => c.startsWith('create'))).toHaveLength(status === 1 ? 6 : 1)
})

test('a ledger saved while running restores as inspectable unknown without sending a POST', async () => {
  const f = fixture(); const controller = f.controller()
  await controller.start(plan())
  const [key, value] = [...f.values.entries()][0]
  f.values.set(key, JSON.stringify({ ...JSON.parse(value), status: 'running' }))
  const calls = f.api.post.mock.calls.length
  const restored = f.controller()
  expect(restored.snapshot().status).toBe('unknown')
  expect(f.api.post.mock.calls).toHaveLength(calls)
  expect((await restored.resume()).status).toBe('success')
})
test('a late POST from a stopped page cannot overwrite the completed recovery ledger', async () => {
  const f = fixture(); const originalPost = f.api.post.getMockImplementation(); let release
  f.api.post.mockImplementationOnce(async (...args) => {
    const response = await originalPost(...args)
    await new Promise(resolve => { release = resolve })
    return response
  })
  const old = f.controller(); const pending = old.start(plan()); await flush()
  old.stop()
  const restored = f.controller()
  expect(restored.snapshot().status).toBe('unknown')
  expect((await restored.resume()).status).toBe('success')
  release(); await pending
  expect(JSON.parse([...f.values.values()][0]).status).toBe('success')
  expect(f.api.post.mock.calls.filter(([c]) => c.startsWith('create'))).toHaveLength(6)
})

test('explicit recovery of an unaccepted request reuses its UUID; automatic recovery never replays', async () => {
  const f = fixture(); f.api.post.mockImplementationOnce(async () => { throw new Error('offline before acceptance') })
  const controller = f.controller(); expect((await controller.start(plan())).status).toBe('unknown')
  expect(f.api.post).toHaveBeenCalledTimes(1)
  const request = controller.snapshot().stages[0].requestId
  controller.stop()
  const restored = f.controller()
  expect((await restored.resume()).status).toBe('unknown')
  expect(f.api.post).toHaveBeenCalledTimes(1)
  expect((await restored.resume({ profile: plan().profile })).status).toBe('success')
  expect(f.api.post.mock.calls[1][1].customjobid).toBe(request)
})
test.each([530, 531, 532, 533, 534, 535, 536, 537])('an authoritative Cloud %s rejection with no receipt settles safely', async status => {
  const f = fixture()
  f.api.post.mockImplementationOnce(async () => { throw Object.assign(new Error('Cloud rejected'), { response: { status, data: { response: { errorcode: status } } } }) })
  expect((await f.controller().start(plan())).status).toBe('cleaned')
  expect(f.api.post).toHaveBeenCalledTimes(1)
})
test('a proxy 530 without a Cloud API error remains unknown', async () => {
  const f = fixture()
  f.api.post.mockImplementationOnce(async () => { throw Object.assign(new Error('proxy'), { response: { status: 530, data: 'proxy response' } }) })
  expect((await f.controller().start(plan())).status).toBe('unknown')
  expect(f.api.post).toHaveBeenCalledTimes(1)
})
