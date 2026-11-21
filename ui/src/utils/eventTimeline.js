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

export function isEventTimelineRoute (route) {
  return route.meta?.name === 'event' && !route.params?.id && !!route.query?.startid
}

export function eventTimelineQuery (event, currentProject) {
  return { startid: event.id, timeline: 'true', projectid: event.projectid || currentProject || '0', page: '1' }
}

export function eventDetailLocation (event, route) {
  const path = '/event/' + event.id
  if (!isEventTimelineRoute(route)) return { path }
  return { path, query: { projectid: event.projectid || route.query.projectid || '0' } }
}
