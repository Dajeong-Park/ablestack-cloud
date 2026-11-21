// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements. See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership. The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License. You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied. See the License for the
// specific language governing permissions and limitations
// under the License.
import { eventArchiveScope, eventDetailKey, eventDetailLocation, eventDisplayTitle, eventListLocation, eventRouteHistory, eventTimelineQuery, isEventTimelineRoute } from '@/utils/eventTimeline'

const event = { id: 'stage', parentid: 'parent', archived: true }
const project = 'e6251bec-c1a3-47a8-a4ee-69418f4e4df0'
const anchor = 'd5291978-c4ce-4540-8687-230bc9a90c14'
const projectView = { project: { id: project }, userInfo: { id: 'user', roleid: 'role', roletype: 'Admin' } }
const globalView = { userInfo: projectView.userInfo }
const token = 'test-session'

test('links from every stage use the visible stage as the operation anchor', () => {
  expect(eventTimelineQuery(event)).toEqual({ startid: 'stage', timeline: 'true', projectid: '0', page: '1' })
  expect(eventTimelineQuery({ id: 'parent' }).startid).toBe('parent')
})

test('keeps explicit project scope when navigating into a timeline and back to a stage', () => {
  expect(eventTimelineQuery({ ...event, projectid: 'project' }, 'other').projectid).toBe('project')
  expect(eventTimelineQuery(event, 'current').projectid).toBe('current')
  const route = { meta: { name: 'event' }, query: { startid: 'first', projectid: project } }
  expect(isEventTimelineRoute(route)).toBe(true)
  expect(eventDetailLocation(event, route)).toEqual({ path: '/event/stage', query: { projectid: project } })
})

test('regular event lists and event details keep their normal navigation', () => {
  const route = { meta: { name: 'event' }, query: {} }
  expect(isEventTimelineRoute(route)).toBe(false)
  expect(isEventTimelineRoute({ ...route, params: { id: 'first' }, query: { startid: 'other' } })).toBe(false)
  expect(eventDetailLocation(event, route)).toEqual({ path: '/event/stage', query: { projectid: '0' } })
})

test('returns to the same project, archive, search, sort and page through tab and detail navigation', () => {
  const query = { keyword: 'login', q: 'login', type: 'USER.LOGIN', startdate: '2026-11-20', page: '2', pagesize: '20', archived: 'true', filter: 'archived', sortkey: 'created', sortorder: 'asc' }
  const list = { meta: { name: 'event' }, query: { ...query, id: 'ignore', tab: 'ignore' } }
  const detail = eventDetailLocation(event, list, projectView, token)
  expect(detail.query).toEqual({ projectid: project })
  const route = { ...detail, meta: list.meta, params: { id: event.id } }
  const preserved = eventRouteHistory(route, detail.state, projectView, token)
  expect(eventListLocation(route, preserved, projectView, token)).toEqual({ path: '/event', query: { projectid: project, ...query }, state: { eventReturn: null } })
  expect(eventDetailKey(route)).toBe(eventDetailKey({ ...route, query: { ...detail.query, tab: 'event.timeline' } }))
})

test('return from an all-project timeline retains its anchor and rejects stale context for another session', () => {
  const list = { meta: { name: 'event' }, query: { startid: anchor, timeline: 'true', page: '3', projectid: '-1' } }
  const source = { ...globalView, listAllProjects: true }
  const detail = eventDetailLocation({ ...event, projectid: project }, list, source, token)
  const route = { ...detail, meta: list.meta, params: { id: event.id } }
  expect(eventListLocation(route, detail.state, source, token).query).toEqual(list.query)
  expect(eventListLocation(route, detail.state, source, 'new-session', event).query).toEqual({ projectid: project, archived: 'true', filter: 'archived' })
  expect(eventRouteHistory(route, detail.state, globalView, token)).toEqual({ eventReturn: null })
})

test('event title identifies type, target and creation time', () => {
  expect(eventDisplayTitle({ type: 'USER.LOGIN', resourcename: 'sample', created: 'test-date' }, key => key === 'user.login' ? 'Login' : key, () => 'Formatted date'))
    .toBe('Login · sample · Formatted date')
})

test.each([
  [{ archived: 'true' }, false, 'archived'],
  [{ filter: 'archived' }, false, 'archived'],
  [{ archived: 'false', filter: 'archived' }, true, 'active'],
  [{ filter: 'active' }, true, 'active'],
  [{}, true, 'all'],
  [{}, false, 'active']
])('resolves the event archive scope for %j with timeline=%s', (query, timeline, expected) => {
  expect(eventArchiveScope(query, timeline)).toBe(expected)
})

test('restores canonical archive parameters from legacy archive filter links', () => {
  const list = { meta: { name: 'event' }, query: { startid: anchor, filter: 'archived', page: '2' } }
  const detail = eventDetailLocation(event, list, globalView, token)
  const route = { ...detail, meta: list.meta, params: { id: event.id } }
  expect(eventListLocation(route, detail.state, globalView, token).query)
    .toEqual({ projectid: '0', startid: anchor, timeline: 'true', page: '2', filter: 'archived', archived: 'true' })
})
