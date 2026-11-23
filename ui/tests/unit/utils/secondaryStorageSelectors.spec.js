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

import { getAPI } from '@/api'
import { fixedSelectorId, fixedSelectorRule, readSecondaryStorageSelectors, readSelectorStores } from '@/utils/secondaryStorageSelectors'

jest.mock('@/api', () => ({ getAPI: jest.fn() }))

const zone = 'f0000000-0000-4000-8000-000000019310'
const store = 'f0000000-0000-4000-8000-000000019311'

beforeEach(() => getAPI.mockReset())

test('decodes a fixed destination without interpreting a conditional rule', () => {
  expect(fixedSelectorRule(store)).toBe(JSON.stringify(store))
  expect(fixedSelectorId(fixedSelectorRule(store))).toBe(store)
  expect(fixedSelectorId("'" + store + "';")).toBe(store)
  expect(fixedSelectorId("isKvm ? '" + store + "' : null")).toBe('')
  expect(fixedSelectorRule('not-a-storage-id')).toBe('')
})

test('scopes list requests to a valid Zone and distinguishes empty data', async () => {
  await expect(readSecondaryStorageSelectors('')).resolves.toEqual([])
  expect(getAPI).not.toHaveBeenCalled()
  getAPI.mockResolvedValueOnce({ listsecondarystorageselectorsresponse: {} })
  await expect(readSecondaryStorageSelectors(zone, { type: 'ISO', showRemoved: true })).resolves.toEqual([])
  expect(getAPI).toHaveBeenCalledWith('listSecondaryStorageSelectors', { zoneid: zone, type: 'ISO', showremoved: true }, { preserveOnFailure: true })
})

test('reads candidates without a page number for unlimited results', async () => {
  const row = { id: store, zoneid: zone }
  getAPI.mockResolvedValueOnce({ listimagestoresresponse: { imagestore: [row, { ...row, zoneid: 'other-zone' }] } })
  await expect(readSelectorStores(zone)).resolves.toEqual([row])
  expect(getAPI).toHaveBeenCalledWith('listImageStores', { zoneid: zone, pagesize: -1 }, { preserveOnFailure: true })
})
