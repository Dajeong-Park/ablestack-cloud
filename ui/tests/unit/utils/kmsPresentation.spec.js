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

import TableOverflowText from '@/components/view/TableOverflowText.vue'
import { kmsCellLabel, kmsDisplayQuery, kmsTableColumns } from '@/utils/kmsPresentation'

test('preserves the input column order and reserves room for the primary name', () => {
  const columns = [{ key: 'name', sorter: true }, { key: 'enabled' }, { key: 'filtercolumn', customFilterDropdown: true }]
  const sized = kmsTableColumns(columns)
  expect(sized.map(col => col.key)).toEqual(['name', 'enabled', 'filtercolumn'])
  expect(sized[0]).toMatchObject({ width: 320, sorter: false })
  expect(sized[2]).toMatchObject({ width: 36, customFilterDropdown: true })
  expect(columns[0]).not.toHaveProperty('width')
})

test('uses display labels for states and versions while leaving a resource name intact', () => {
  const t = (key, args) => args ? key + ':' + args.version : key
  const te = key => key === 'label.ready'
  const bytes = value => value + ' B'
  const render = (field, value) => kmsCellLabel(field, value, t, te, bytes, {})
  expect(render('name', 'Enabled')).toBe('Enabled')
  expect(render('enabled', false)).toBe('label.disabled')
  expect(render('ispublic', true)).toBe('label.yes')
  expect(render('state', 'Ready')).toBe('label.ready')
  expect(render('version', 4)).toBe('label.kms.current.version:4')
  expect(render('protocol', 'pkcs11')).toBe('PKCS#11')
  expect(render('size', 0)).toBe('0 B')
  expect(render('hsmprofile', undefined)).toBe('—')
})

test('display filter shares the enabled query and retains other filters', () => {
  const original = { enabled: 'true', keyword: 'key', page: '4', projectid: 'scope' }
  expect(kmsDisplayQuery(original, 'false')).toEqual({ ...original, enabled: 'false', page: '1' })
  expect(kmsDisplayQuery(original, 'all')).toEqual({ keyword: 'key', page: '1', projectid: 'scope' })
  expect(original.page).toBe('4')
})

test('an overflow tooltip becomes available only when content exceeds the rendered width', () => {
  const cell = { scrollWidth: 321, clientWidth: 320 }
  const view = { truncated: false, element: () => cell }
  TableOverflowText.methods.measure.call(view)
  expect(view.truncated).toBe(true)
  cell.clientWidth = 340
  TableOverflowText.methods.measure.call(view)
  expect(view.truncated).toBe(false)
})
