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

import { imageAccountScope, invalidImageAccountScope } from '@/utils/imageAccountScope'
import { templateListQuery, templateRequestParams, templateDetailLocation, templateListLocation, templateSearchError } from '@/utils/templateSearch'
import { isoListQuery, isoRequestParams, isoDetailLocation, isoListLocation, isoSearchError, isoFilterChips } from '@/utils/isoSearch'

const domainid = '11111111-1111-4111-8111-111111111111'
const getters = { userInfo: { id: 'actor', roletype: 'Admin' }, project: { id: 'project' } }

test('domain ownership carries a validated UUID without requiring an account', () => {
  expect(imageAccountScope({ domainid }, 'self')).toEqual({ domainid })
  expect(imageAccountScope({ domainid, account: 'account' }, 'self')).toEqual({ domainid, account: 'account' })
  expect(invalidImageAccountScope({ account: 'account' })).toBe(true)
  expect(invalidImageAccountScope({ domainid: 'invalid' })).toBe(true)
  expect(imageAccountScope({ domainid }, 'all')).toEqual({})
})

test('the template query and image detail return retain domain scope and pagination', () => {
  const query = templateListQuery({ domainid, page: '2', projectid: 'project' })
  expect(query).toMatchObject({ domainid, filter: 'self', templatefilter: 'self', page: '2' })
  expect(templateRequestParams(query)).toMatchObject({ domainid, templatefilter: 'self' })
  expect(templateRequestParams(query)).not.toHaveProperty('projectid')
  const detail = templateDetailLocation({ query }, { id: 'template' }, getters)
  expect(templateListLocation(detail, getters).query).toEqual(query)
  expect(templateSearchError({ domainid: 'invalid' })).toBe('message.image.domain.scope.invalid')
})

test('the ISO query retains domain scope across detail and omits project scope at the API boundary', () => {
  const query = isoListQuery({ domainid, page: '2' }, 20, getters)
  expect(query).toMatchObject({ domainid, isofilter: 'self', page: '2' })
  expect(isoRequestParams(query, false, getters)).toMatchObject({ domainid, isofilter: 'self' })
  expect(isoRequestParams(query, false, getters)).not.toHaveProperty('projectid')
  expect(isoFilterChips(query, getters)).toContainEqual({ key: 'domainid', value: domainid, isTag: false })
  expect(isoListLocation(isoDetailLocation({ query }, { id: 'iso' }, getters), getters).query).toEqual(query)
  expect(isoSearchError({ domainid: 'invalid' })).toBe('message.image.domain.scope.invalid')
})
