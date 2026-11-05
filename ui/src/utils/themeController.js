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

import { watch } from 'vue'

// App owns theme state for both login and authenticated routes. Sidebar/logo
// mounts must never initialize it or register another system-theme listener.
export function startThemeController (store, storage, config) {
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  const saved = storage.get('DARK_MODE')
  store.dispatch('SetDarkMode', saved == null ? media.matches : !!saved)
  const stop = watch(() => store.getters.darkMode, dark => {
    document.documentElement.classList.toggle('dark-mode', !!dark)
    document.body.classList.toggle('dark-mode', !!dark)
    config.theme['@layout-mode'] = dark ? 'dark' : 'light'
  }, { immediate: true, flush: 'sync' })
  // Preserve the existing policy: subsequent OS changes update the saved mode
  // through the same Vuex action used by the settings UI.
  const onSystemTheme = event => store.dispatch('SetDarkMode', event.matches)
  media.addEventListener('change', onSystemTheme)
  return () => {
    stop()
    media.removeEventListener('change', onSystemTheme)
  }
}
