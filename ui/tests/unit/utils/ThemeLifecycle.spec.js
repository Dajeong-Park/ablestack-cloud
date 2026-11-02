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

import { mount, flushPromises } from '@vue/test-utils'
import { h, ref } from 'vue'
import { createStore } from 'vuex'
import App from '@/App'
import Logo from '@/components/header/Logo'
import UserLayout from '@/layouts/UserLayout'
import Setting from '@/components/view/Setting'

jest.mock('@/utils/mixin', () => ({ AppDeviceEnquire: {}, mixinDevice: { computed: { device: () => 'mobile' } } }))
jest.mock('@/layouts/RouteView', () => ({ render: () => null }))
let view, store, storage, media, listeners, saved, page, sidebar, config
const oldMatchMedia = window.matchMedia
const oldLess = window.less
function open (initial = null, systemDark = false) {
  saved = initial
  storage = { get: jest.fn(() => saved), set: jest.fn((key, value) => { saved = value }) }
  listeners = new Set()
  media = { matches: systemDark, addEventListener: jest.fn((name, fn) => listeners.add(fn)), removeEventListener: jest.fn((name, fn) => listeners.delete(fn)) }
  window.matchMedia = jest.fn(() => media)
  window.less = { modifyVars: jest.fn() }
  store = createStore({ state: { dark: false }, getters: { darkMode: state => state.dark, theme: () => 'light', countNotify: () => 0 }, mutations: { set (state, mode) { state.dark = mode; storage.set('DARK_MODE', mode) } }, actions: { SetDarkMode ({ commit }, mode) { commit('set', mode) } } })
  config = { logo: 'light.svg', whiteLogo: 'dark.svg', theme: {} }
  page = ref('login'); sidebar = ref(false)
  const Route = { setup: () => () => page.value === 'login' ? h(UserLayout) : h('main', sidebar.value ? h(Logo) : 'Mobile content') }
  view = mount(App, { global: { plugins: [store], stubs: { AConfigProvider: { template: '<slot />' }, RouterView: Route }, mocks: { $config: config, $localStorage: storage, $i18n: { locale: 'ko_KR' }, $route: { name: 'login' } } } })
}
function expectMode (dark) {
  expect(document.body.classList.contains('dark-mode')).toBe(dark)
  expect(document.documentElement.classList.contains('dark-mode')).toBe(dark)
  expect(config.theme['@layout-mode']).toBe(dark ? 'dark' : 'light')
}
beforeEach(() => { document.body.classList.remove('dark-mode', 'userLayout'); document.documentElement.classList.remove('dark-mode') })
afterEach(() => { if (view) view.unmount(); view = null; window.matchMedia = oldMatchMedia; window.less = oldLess; document.body.classList.remove('dark-mode', 'userLayout'); document.documentElement.classList.remove('dark-mode') })
test.each([[true, false, true], [false, true, false], [null, true, true], [null, false, false], [undefined, true, true]])('initializes saved %s / OS %s once as %s before routing', (initial, system, dark) => {
  open(initial, system); expectMode(dark); expect(saved).toBe(dark); expect(listeners.size).toBe(1)
  expect(view.findComponent(UserLayout).find('img').attributes('src')).toBe(dark ? 'dark.svg' : 'light.svg')
})
test('login to mobile content and repeated sidebar mounts preserve mode without reinitializing or adding listeners', async () => {
  open(true); await flushPromises(); storage.set.mockClear()
  page.value = 'content'; await flushPromises(); expectMode(true)
  expect(document.body.classList.contains('userLayout')).toBe(false)
  for (let i = 0; i < 3; ++i) {
    sidebar.value = true; await flushPromises(); expect(view.findComponent(Logo).find('img').attributes('src')).toBe('dark.svg')
    sidebar.value = false; await flushPromises(); expectMode(true)
  }
  expect(storage.set).not.toHaveBeenCalled(); expect(media.addEventListener).toHaveBeenCalledTimes(1)
  page.value = 'login'; await flushPromises(); expectMode(true)
})
test('real settings action immediately applies both directions with no logo, resize or navigation', async () => {
  open(false); page.value = 'content'; await flushPromises(); expect(view.findComponent(Logo).exists()).toBe(false)
  const settings = { layoutMode: 'dark', $store: store, updateSetting: jest.fn() }
  Setting.methods.switchLayoutMode.call(settings); expectMode(true); expect(saved).toBe(true)
  settings.layoutMode = 'light'; Setting.methods.switchLayoutMode.call(settings); expectMode(false); expect(saved).toBe(false)
})
test('one OS listener follows the existing saved-mode policy and is removed with the exact handler', async () => {
  open(false); page.value = 'content'; await flushPromises(); storage.set.mockClear()
  const onSystemEvent = [...listeners][0]; onSystemEvent({ matches: true }); expectMode(true); expect(storage.set).toHaveBeenCalledTimes(1)
  page.value = 'login'; await flushPromises(); expect(listeners.size).toBe(1)
  view.unmount(); view = null; expect(listeners.size).toBe(0); expect(media.removeEventListener).toHaveBeenCalledWith('change', onSystemEvent)
  const calls = storage.set.mock.calls.length; for (const fn of listeners) fn({ matches: false }); expect(storage.set).toHaveBeenCalledTimes(calls)
  store.dispatch('SetDarkMode', false); expect(document.body.classList.contains('dark-mode')).toBe(true)
})
