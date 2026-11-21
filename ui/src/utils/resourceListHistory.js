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

export function listSessionScope (getters, token) {
  const user = getters.userInfo
  return token && user?.id ? hash.sha256().update(JSON.stringify([
    token, user.id, user.roleid, user.roletype, user.domainid, getters.project?.id, getters.listAllProjects
  ])).digest('hex') : ''
}

export function resourceDetailLocation (name, key, route, id, scope, query) {
  const path = '/' + name + '/' + encodeURIComponent(id)
  return scope && route.meta?.name === name && !route.params?.id
    ? { path, state: { [key]: { id, scope, query } } }
    : { path }
}

export function resourceListHistory (name, key, route, history, scope) {
  const saved = history?.[key]
  const valid = scope && route.meta?.name === name && route.params?.id &&
    saved?.id === route.params.id && saved.scope === scope
  return { [key]: valid ? saved : null }
}
