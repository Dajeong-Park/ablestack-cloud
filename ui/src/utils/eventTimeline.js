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
import { eventSearchKeys } from './eventSearch'

const isUuid = value => typeof value === 'string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value)
const isProjectScope = value => value === '0' || value === '-1' || isUuid(value)
const scalar = value => typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? String(value) : undefined

export const isEventDetailRoute = route => route.meta?.name === 'event' && !!route.params?.id

export function isEventTimelineRoute (route) {
  return route.meta?.name === 'event' && !route.params?.id && !!route.query?.startid
}

export function eventArchiveScope (query, timeline) {
  const archived = scalar(query.archived)
  if (archived === 'true' || archived === 'false') return archived === 'true' ? 'archived' : 'active'
  if (query.filter === 'archived') return 'archived'
  if (query.filter === 'active' || !timeline) return 'active'
  return 'all'
}

export function eventTimelineQuery (event, currentProject) {
  return { startid: event.id, timeline: 'true', projectid: event.projectid || currentProject || '0', page: '1' }
}

export function eventViewScope (getters = {}) {
  return getters.project?.id || (getters.listAllProjects ? '-1' : '0')
}

export function eventProjectScope (route, getters) {
  return isProjectScope(route.query?.projectid) ? route.query.projectid : eventViewScope(getters)
}

export function eventDetailKey (route) {
  const query = { ...route.query }
  delete query.tab
  return JSON.stringify([route.path, query])
}

function eventHistoryOwner (getters, token) {
  const { id, roleid, roletype } = getters?.userInfo || {}
  return token && id ? hash.sha256().update(JSON.stringify([id, roleid, roletype, token, eventViewScope(getters)])).digest('hex') : ''
}

function eventListQuery (input, projectid) {
  const query = { projectid }
  for (const key of eventSearchKeys) {
    const value = scalar(input[key])
    if (value) query[key] = value
  }
  if (query.keyword) query.q = query.keyword
  for (const key of ['page', 'pagesize']) {
    const value = Number(input[key])
    if (Number.isSafeInteger(value) && value > 0) query[key] = String(value)
  }
  if (isUuid(input.startid)) {
    query.startid = input.startid
    query.timeline = 'true'
  } else if (input.sortkey === 'created') {
    query.sortkey = 'created'
    query.sortorder = input.sortorder === 'asc' ? 'asc' : 'desc'
  }
  const archive = eventArchiveScope(input, !!query.startid)
  if (archive !== 'all') query.filter = archive
  if (archive === 'archived') query.archived = 'true'
  else if (archive === 'active' && (query.startid || scalar(input.archived) === 'false')) query.archived = 'false'
  return query
}

export function eventRouteHistory (route, historyState, getters, token) {
  const saved = historyState?.eventReturn
  const owner = eventHistoryOwner(getters, token)
  const valid = isEventDetailRoute(route) && owner && saved?.owner === owner && saved.id === route.params.id
  return { eventReturn: valid ? saved : null }
}

export function eventDetailLocation (event, route, getters, token, historyState) {
  const path = '/event/' + event.id
  if (route.meta?.name !== 'event') return { path }
  const sourceProject = eventProjectScope(route, getters)
  const projectid = isUuid(event.projectid) ? event.projectid : sourceProject === '-1' ? '0' : sourceProject
  const location = { path, query: { projectid } }
  const owner = eventHistoryOwner(getters, token)
  if (owner && !route.params?.id) {
    location.state = { eventReturn: { id: event.id, owner, query: eventListQuery(route.query || {}, sourceProject) } }
  } else if (owner) {
    const saved = eventRouteHistory(route, historyState, getters, token).eventReturn
    if (saved) location.state = { eventReturn: { ...saved, id: event.id } }
  }
  return location
}

export function eventListLocation (route, historyState, getters, token, event) {
  const saved = eventRouteHistory(route, historyState, getters, token).eventReturn
  const projectid = saved && isProjectScope(saved.query?.projectid) ? saved.query.projectid : eventProjectScope(route, getters)
  const query = eventListQuery(saved?.query || (event?.archived ? { archived: 'true' } : {}), projectid)
  return { path: '/event', query, state: { eventReturn: null } }
}

export function eventTypeLabel (type, translate) {
  if (!type || typeof type !== 'string') return type
  const key = type.toLowerCase()
  const label = translate(key)
  return label === key ? type : label
}

export function eventDisplayTitle (event, translate, formatDate) {
  return [eventTypeLabel(event.type, translate), event.resourcename || event.resourcetype, event.created && formatDate(event.created)]
    .filter(Boolean).join(' · ')
}
