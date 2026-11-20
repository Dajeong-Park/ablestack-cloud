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

import router from '@/router'
import store from '@/store'
import Cookies from 'js-cookie'
import '@/permission'

jest.mock('nprogress/nprogress.css', () => ({}))
jest.mock('@/router', () => ({ beforeEach: jest.fn(), afterEach: jest.fn() }))
jest.mock('@/store', () => ({ getters: { loginFlag: false, apis: { listUsers: {} } }, commit: jest.fn() }))
jest.mock('js-cookie', () => ({ get: jest.fn() }))
jest.mock('@/locales', () => ({ i18n: { global: { t: key => key } } }))
jest.mock('@/vue-app', () => ({ vueProps: { $config: {}, $localStorage: { get: () => 'session' } } }))

describe('SAML management server cookie', () => {
  it.each([undefined, '', 'ms-123'])('does not overwrite server state with a missing value (%s)', value => {
    store.commit.mockClear()
    Cookies.get.mockImplementation(key => key === 'isSAML' ? 'true' : key === 'managementserverid' ? value : undefined)
    const next = jest.fn()
    router.beforeEach.mock.calls[0][0]({ path: '/vm', meta: {} }, {}, next)
    expect(store.commit).toHaveBeenCalledWith('SET_LOGIN_FLAG', true)
    if (value) expect(store.commit).toHaveBeenCalledWith('SET_MS_ID', value)
    else expect(store.commit.mock.calls.some(call => call[0] === 'SET_MS_ID')).toBe(false)
    expect(next).toHaveBeenCalled()
  })
})

it('keeps the KMS return entry while removing the outer login query on reload', () => {
  const { href } = window.location
  const original = window.history.state
  const state = { current: '/hsmprofile/test-id', kmsReturn: { kind: 'hsmprofile', query: { page: '2' } } }
  const next = jest.fn()
  Cookies.get.mockReturnValue(undefined)
  try {
    window.history.replaceState(state, '', '/?code=temporary#/hsmprofile/test-id')
    router.beforeEach.mock.calls[0][0]({ path: state.current, meta: {} }, {}, next)
    expect(window.location.search).toBe('')
    expect(window.location.hash).toBe('#/hsmprofile/test-id')
    expect(window.history.state).toEqual(state)
    expect(next).toHaveBeenCalled()
  } finally {
    window.history.replaceState(original, '', href)
  }
})
