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
import { eventSearchQuery, eventSearchError, eventCreatedSortQuery } from '@/utils/eventSearch'

const uuid = 'ddb45b52-f568-4116-bf55-fc42e79fa179'
const isUuid = value => value === uuid

test('advanced filters combine with the keyword, project, archive, and server sort', () => {
  const scope = { projectid: 'project', archived: 'true', filter: 'archived', sortkey: 'created', sortorder: 'desc', page: '4', pagesize: '20' }
  const filters = { keyword: ' alpha ', type: 'VM.START', startdate: '2026-11-01', enddate: '2026-11-05', eventuuid: uuid, resourceid: uuid, resourcetype: 'VirtualMachine' }
  const query = eventSearchQuery(scope, filters)
  expect(query).toEqual({ ...scope, page: '1', ...filters, keyword: 'alpha', q: 'alpha' })
  expect(eventSearchQuery(query, { searchQuery: 'beta' })).toEqual({ ...query, keyword: 'beta', q: 'beta' })
  expect(eventSearchQuery(query)).toEqual({ ...scope, page: '1' })
})

test('rejects reversed dates, malformed UUIDs and missing resource type', () => {
  expect(eventSearchError({ eventuuid: 'x' }, isUuid)).toBe('message.events.search.eventuuid.invalid')
  expect(eventSearchError({ resourceid: 'x' }, isUuid)).toBe('message.events.search.resourceid.invalid')
  expect(eventSearchError({ resourceid: uuid }, isUuid)).toBe('message.events.search.resourceid.type.required')
  expect(eventSearchError({ startdate: '2026-11-02', enddate: '2026-11-01' }, isUuid)).toBe('message.events.search.date.order')
  expect(eventSearchError({ startdate: '2026-11-02', enddate: '2026-11-02', resourceid: uuid, resourcetype: 'User' }, isUuid)).toBe('')
})

test('changes sorting without losing filters and resets paging', () => {
  const query = { page: '3', pagesize: '20', type: 'USER.LOGIN', startdate: '2026-11-20' }
  const asc = eventCreatedSortQuery(query, 'ascend')
  expect(asc).toEqual({ ...query, page: '1', sortkey: 'created', sortorder: 'asc' })
  expect(eventCreatedSortQuery(asc, 'descend')).toEqual({ ...asc, sortorder: 'desc' })
  expect(eventCreatedSortQuery(asc)).toEqual({ ...query, page: '1' })
})
