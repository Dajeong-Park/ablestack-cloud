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
import { eventDetailLocation, eventTimelineQuery, isEventTimelineRoute } from '@/utils/eventTimeline'

const event = { id: 'stage', parentid: 'parent', archived: true }

test('links from every stage use the visible stage as the operation anchor', () => {
  expect(eventTimelineQuery(event)).toEqual({ startid: 'stage', timeline: 'true', projectid: '0', page: '1' })
  expect(eventTimelineQuery({ id: 'parent' }).startid).toBe('parent')
})

test('keeps explicit project scope when navigating into a timeline and back to a stage', () => {
  expect(eventTimelineQuery({ ...event, projectid: 'project' }, 'other').projectid).toBe('project')
  expect(eventTimelineQuery(event, 'current').projectid).toBe('current')
  const route = { meta: { name: 'event' }, query: { startid: 'first', projectid: 'project' } }
  expect(isEventTimelineRoute(route)).toBe(true)
  expect(eventDetailLocation(event, route)).toEqual({ path: '/event/stage', query: { projectid: 'project' } })
})

test('regular event lists and event details keep their normal navigation', () => {
  const route = { meta: { name: 'event' }, query: {} }
  expect(isEventTimelineRoute(route)).toBe(false)
  expect(isEventTimelineRoute({ ...route, params: { id: 'first' }, query: { startid: 'other' } })).toBe(false)
  expect(eventDetailLocation(event, route)).toEqual({ path: '/event/stage' })
})
