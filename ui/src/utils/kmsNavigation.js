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
import { kmsAuth, kmsListApi, kmsListRoute, kmsProjectScope, kmsQuery, kmsRoute } from './kmsSearch'
import { readKmsResource } from './kmsOperation'

const kindOf = route => route.meta?.name || route.name
const isUuid = value => typeof value === 'string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value)
export const kmsHistoryOwner = (getters, token) => hash.sha256().update(kmsAuth(getters, token)).digest('hex')

export function kmsRouteHistory (state) {
  return { kmsReturn: state?.kmsReturn || null, ...(state?.kmsRelatedReturn ? { kmsRelatedReturn: state.kmsRelatedReturn } : {}) }
}

export const kmsDetailRoute = route => kmsRoute(route) && !!route.params?.id

export function kmsDetailLocation (route, row, getters, token) {
  const kind = kindOf(route)
  const query = isUuid(row.projectid) ? { projectid: row.projectid } : {}
  const location = { path: '/' + kind + '/' + row.id, query }
  if (kmsListRoute(route) && getters.userInfo?.id && token) {
    location.state = { kmsReturn: { kind, id: row.id, owner: kmsHistoryOwner(getters, token), query: kmsQuery(route.query, kmsListApi(route), getters) } }
  }
  return location
}

export function kmsListLocation (route, historyState, getters, token, size = getters.defaultListViewPageSize) {
  const kind = kindOf(route)
  const saved = historyState?.kmsReturn
  const matches = kmsDetailRoute(route) && getters.userInfo?.id && token && saved?.kind === kind &&
    saved.id === route.params.id && saved.owner === kmsHistoryOwner(getters, token)
  const query = kmsQuery(matches ? saved.query || {} : {}, kmsListApi(route), getters, size)
  return { path: '/' + kind, query, state: { kmsReturn: null } }
}

export function kmsDetailReadScope (route, getters) {
  const project = kmsProjectScope(getters)
  const requested = route.query?.projectid
  const projectid = (project && project !== '-1' ? project : '') || (isUuid(requested) ? requested.toLowerCase() : project)
  return projectid ? { projectid } : {}
}

export function kmsDetailKey (route, getters) {
  return JSON.stringify([route.path, kmsDetailReadScope(route, getters)])
}

export async function readKmsDetail (get, route, getters) {
  const api = kmsListApi(route)
  if (!(api in (getters.apis || {}))) throw new Error('forbidden')
  const id = route.params.id
  if (!isUuid(id)) throw new Error('missing')
  const row = await readKmsResource(get, api, kmsDetailReadScope(route, getters), id.toLowerCase(), true)
  if (!row) throw new Error('missing')
  return row
}

export function kmsDetailFailure (error) {
  const status = Number(error?.response?.status)
  const body = Object.values(error?.response?.data || {}).find(row => Number(row?.errorcode))
  const codes = [status, Number(body?.errorcode)]
  if (error.message === 'forbidden' || codes.some(code => [401, 403, 531, 536].includes(code))) return 'forbidden'
  if (error.message === 'missing' || codes.includes(404)) return 'missing'
  return 'failed'
}

export function kmsDeletionConfirmed (route, issued, result, currentScope) {
  return kmsDetailRoute(route) && (kmsListApi(route) === 'listKMSKeys' ? issued.api === 'deleteKMSKey' : issued.api === 'deleteHSMProfile') &&
    !!issued.kmsNavigationScope && issued.kmsNavigationScope === currentScope &&
    result?.kmsNavigationScope === currentScope && issued.kmsTarget?.id === result.kmsRemoved &&
    result.kmsRemoved === route.params.id.toLowerCase()
}
