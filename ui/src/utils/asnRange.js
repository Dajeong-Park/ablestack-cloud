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

export const ASN_MAX = 4294967294
export const ASN_RANGE_MAX_SIZE = 1000
// Uncertain writes survive dialog/tab reopening, for this browser page lifetime only.
const operations = new Map()
export const asnOperation = context => operations.get(context)
export const trackAsnOperation = (context, operation) => operations.set(context, operation)
export const clearAsnOperation = context => operations.delete(context)

export function asnCreationContext (getters, token, zoneId) {
  const user = getters.userInfo || {}
  return JSON.stringify([zoneId, user.id, user.roleid, user.roletype, getters.project?.id, getters.listAllProjects, token,
    Object.keys(getters.apis || {}).sort()])
}

export function asnRangeErrors (form) {
  const errors = {}; const numbers = {}
  for (const key of ['startasn', 'endasn']) {
    const raw = String(form[key] ?? '').trim()
    if (!raw) errors[key] = 'required'
    else if (!/^[0-9]+$/.test(raw)) errors[key] = 'integer'
    else if (!Number.isSafeInteger(Number(raw)) || Number(raw) < 1 || Number(raw) > ASN_MAX) errors[key] = 'bounds'
    else numbers[key] = Number(raw)
  }
  if (Object.keys(errors).length) return errors
  if (numbers.startasn > numbers.endasn) errors.endasn = 'order'
  else if ([23456, 65535].some(n => numbers.startasn <= n && numbers.endasn >= n)) errors.endasn = 'reserved'
  else if (numbers.endasn - numbers.startasn + 1 > ASN_RANGE_MAX_SIZE) errors.endasn = 'size'
  return errors
}

export function asnRangeValues (form) {
  if (Object.keys(asnRangeErrors(form)).length) return null
  const start = Number(String(form.startasn).trim()); const end = Number(String(form.endasn).trim())
  return { startasn: String(start), endasn: String(end), count: end - start + 1 }
}

export function asnRangeMatches (row, expected) {
  return !!row?.id && row.zoneid === expected.zoneid && String(row.startasn) === expected.startasn && String(row.endasn) === expected.endasn
}

export async function confirmAsnRange (getAPI, expected, receiptId) {
  const result = (await getAPI('listASNRanges', { zoneid: expected.zoneid }))?.listasnrangesresponse
  if (!result || result.errorcode) throw new Error('ASN range lookup failed')
  const ranges = result.asnumberrange || []
  const matches = ranges.filter(row => asnRangeMatches(row, expected))
  if (!matches.length) return { absent: true, ranges }
  if (matches.length !== 1 || (receiptId && matches[0].id !== receiptId)) throw new Error('ASN range receipt mismatch')
  const range = matches[0]; const seen = new Set()
  for (let page = 1; page <= 3; page++) {
    const data = (await getAPI('listASNumbers', { zoneid: expected.zoneid, asnrangeid: range.id, page, pagesize: 500 }))?.listasnumbersresponse
    if (!data || data.errorcode || data.count !== expected.count || !Array.isArray(data.asnumber) || !data.asnumber.length) throw new Error('ASN members lookup failed')
    for (const row of data.asnumber) {
      const number = Number(row.asnumber)
      if (row.zoneid !== expected.zoneid || row.asnrangeid !== range.id || !Number.isInteger(number) ||
          number < Number(expected.startasn) || number > Number(expected.endasn) || seen.has(number)) throw new Error('ASN members mismatch')
      seen.add(number)
    }
    if (seen.size === expected.count) return { range, ranges }
    if (seen.size > expected.count) break
  }
  throw new Error('Incomplete ASN range')
}
