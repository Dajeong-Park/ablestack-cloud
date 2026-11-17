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

import { probeSsvmCert } from '@/utils/ssvmProbe'

const originalFetch = global.fetch
const originalController = global.AbortController

beforeEach(() => {
  jest.useFakeTimers()
  global.AbortController = class {
    constructor () { this.signal = {} }
    abort () { this.signal.reject(new Error('aborted')) }
  }
})
afterEach(() => {
  jest.useRealTimers()
  global.fetch = originalFetch
  global.AbortController = originalController
})

it('accepts a reachable upload server without requiring CORS access', async () => {
  global.fetch = jest.fn().mockResolvedValue({})
  expect(await probeSsvmCert('https://ssvm')).toBe(true)
  expect(global.fetch).toHaveBeenCalledWith('https://ssvm', expect.objectContaining({ method: 'HEAD', mode: 'no-cors' }))
  expect(jest.getTimerCount()).toBe(0)
})

it('reports TLS or connection failure and clears its timer', async () => {
  global.fetch = jest.fn().mockRejectedValue(new Error('TLS failure'))
  expect(await probeSsvmCert('https://ssvm')).toBe(false)
  expect(jest.getTimerCount()).toBe(0)
})

it('aborts an unresponsive probe after five seconds', async () => {
  global.fetch = jest.fn((url, options) => new Promise((resolve, reject) => { options.signal.reject = reject }))
  const result = probeSsvmCert('https://ssvm')
  jest.advanceTimersByTime(5000)
  expect(await result).toBe(false)
})
