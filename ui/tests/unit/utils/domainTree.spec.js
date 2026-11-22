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

import { domainFilterValues, moveDomainCandidates } from '@/utils/domainTree'
import domain from '@/config/section/domain'

test('domain moves exclude the current parent, self and descendants and restore the selected path', () => {
  const root = { id: 'root', path: 'ROOT' }
  const current = { id: 'current', parentdomainid: 'root', path: 'ROOT/current' }
  const subject = { id: 'subject', parentdomainid: 'current', path: 'ROOT/current/subject' }
  const child = { id: 'child', parentdomainid: 'subject', path: 'ROOT/current/subject/child' }
  const other = { id: 'other', parentdomainid: 'root', path: 'ROOT/other' }
  const entries = moveDomainCandidates(subject, [root, current, subject, child, other])
  expect(entries.map(item => item.id)).toEqual(['root', 'other'])
  expect(entries[1].ancestors).toEqual(['root', 'other'])
  expect(moveDomainCandidates({ id: 'bad' }, [root])).toEqual([])
})

test('only the supported role and a movable domain have a move action', () => {
  const action = domain.actions.find(action => action.api === 'moveDomain')
  expect(action.show({ level: 0 }, { userInfo: { roletype: 'Admin' } })).toBe(false)
  expect(action.show({ level: 1 }, { userInfo: { roletype: 'Admin' } })).toBe(true)
  expect(action.show({ level: 1 }, { userInfo: { roletype: 'DomainAdmin' } })).toBe(false)
})

test('advanced filters preserve zero depth and require a parent for recursive mode', () => {
  expect(domainFilterValues({ name: ' sample ', id: '', level: 0, recursive: true })).toEqual({ name: 'sample', level: 0 })
  expect(domainFilterValues({ parentdomainid: 'parent', recursive: true })).toEqual({ parentdomainid: 'parent', recursive: true })
})
