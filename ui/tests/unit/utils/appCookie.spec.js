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

import { appCookieContract, appCookieError, appCookieRequestLearning } from '@/utils/appCookie'
const network = (provider, params) => ({ service: [{ name: 'Lb', provider: [{ name: provider }], capability: [{ name: 'SupportedStickinessMethods', value: JSON.stringify([{ methodname: 'AppCookie', paramlist: params.map(paramname => ({ paramname })) }]) }] }] })
test('uses the selected network provider capability and preserves external-provider options', () => {
  expect(appCookieContract(network('VirtualRouter', ['length'])).exact).toBe(true)
  expect(appCookieContract(network('Netscaler', ['prefix', 'mode'])).params).toEqual(['prefix', 'mode'])
  expect(appCookieContract(network('Netscaler', ['prefix'])).exact).toBe(false)
  expect(() => appCookieContract({})).toThrow()
})
test.each([{}, { length: 1, holdtime: '600' }, { length: 256, holdtime: '24d' }, { cookieName: 'QA_SESSION', holdtime: '1ms' }])('accepts supported defaults and boundaries %j', value => expect(appCookieError(value)).toBeNull())
test.each([{ length: 0 }, { length: 257 }, { length: 2.5 }, { holdtime: '0' }, { holdtime: '25d' }, { holdtime: '3h30m' }, { cookieName: 'bad)' }, { prefix: true }, { mode: 'query-string' }])('rejects unsafe or unsupported input %j', value => expect(appCookieError(value)).toMatch(/^message.appcookie/))

test('missing AppCookie capability does not offer the method', () => {
  expect(appCookieContract({ service: [{ name: 'Lb', capability: [{ name: 'SupportedStickinessMethods', value: '[]' }] }] }).available).toBe(false)
})

test.each([[undefined, false], ['false', false], [false, false], ['', true], ['true', true], [true, true]])('request learning %p reopens as %p', (value, expected) => expect(appCookieRequestLearning(value)).toBe(expected))
