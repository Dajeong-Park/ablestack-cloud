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

import { asnRangeErrors, asnRangeValues, confirmAsnRange } from '@/utils/asnRange'

test.each(['', ' ', '-1', '+1', '1.5', '1e3', '1.1', '1,000', 'abc', '１２', '0', '4294967295', '4294967296', '9223372036854775808'])('invalid endpoint %s is rejected', value => {
  expect(asnRangeErrors({ startasn: value, endasn: value })).not.toEqual({})
  expect(asnRangeValues({ startasn: value, endasn: value })).toBeNull()
})

test.each(['1', '64512', '2147483647', '2147483648', '4200000000', '4294967294'])('full-width endpoint %s is retained', value => {
  expect(asnRangeValues({ startasn: ' ' + value + ' ', endasn: value })).toEqual({ startasn: value, endasn: value, count: 1 })
})

test.each([['2', '1', 'order'], ['23455', '23457', 'reserved'], ['65534', '65536', 'reserved'], ['100000', '101000', 'size']])('range %s–%s is rejected', (startasn, endasn, reason) => {
  expect(asnRangeErrors({ startasn, endasn }).endasn).toBe(reason)
})

test('one thousand entries and leading zeros use canonical decimal values', () => {
  expect(asnRangeValues({ startasn: '0100000', endasn: '100999' })).toEqual({ startasn: '100000', endasn: '100999', count: 1000 })
})

const expected = { zoneid: 'zone', startasn: '100000', endasn: '100999', count: 1000 }
const range = { id: 'range', ...expected }
function reader (mutate = x => x) {
  return jest.fn(async (command, params) => {
    if (command === 'listASNRanges') return { listasnrangesresponse: { asnumberrange: [range] } }
    const rows = Array.from({ length: 500 }, (_, i) => ({ zoneid: 'zone', asnrangeid: 'range', asnumber: 100000 + (params.page - 1) * 500 + i }))
    return { listasnumbersresponse: { count: 1000, asnumber: mutate(rows, params.page) } }
  })
}

test('confirmation reads all members across API pages', async () => {
  const get = reader()
  await expect(confirmAsnRange(get, expected, 'range')).resolves.toEqual({ range, ranges: [range] })
  expect(get.mock.calls.map(x => x[1].page).filter(Boolean)).toEqual([1, 2])
})

test.each(['duplicate', 'foreign-zone', 'foreign-range', 'outside', 'empty'])('incomplete or mismatched members (%s) cannot confirm a write', async kind => {
  const get = reader((rows, page) => {
    if (kind === 'empty') return []
    if (kind === 'duplicate' && page === 2) rows[0].asnumber = 100000
    if (kind === 'foreign-zone') rows[0].zoneid = 'other'
    if (kind === 'foreign-range') rows[0].asnrangeid = 'other'
    if (kind === 'outside') rows[0].asnumber = 99999
    return rows
  })
  await expect(confirmAsnRange(get, expected, 'range')).rejects.toThrow()
})

test('receipt mismatch and absent range are separate outcomes', async () => {
  await expect(confirmAsnRange(reader(), expected, 'wrong')).rejects.toThrow('receipt mismatch')
  const get = jest.fn().mockResolvedValue({ listasnrangesresponse: {} })
  await expect(confirmAsnRange(get, expected)).resolves.toEqual({ absent: true, ranges: [] })
  expect(get).toHaveBeenCalledTimes(1)
})
