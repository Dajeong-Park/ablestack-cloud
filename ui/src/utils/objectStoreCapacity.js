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

/* global BigInt */
export const GIB = 1073741824n
export const MAX_GIB = 8589934591n
export function exactBytes (resource, name) {
  if (resource?.[name + 'known'] === false) return null
  const precise = resource?.[name + 'bytes']
  const value = precise ?? (Number.isSafeInteger(resource?.[name]) ? String(resource[name]) : null)
  return typeof value === 'string' && /^\d+$/.test(value) ? BigInt(value) : null
}
export function formatBytes (value) {
  if (value === null || value === undefined) return '—'
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB']
  let scale = 1n; let unit = 0
  while (value >= scale * 1024n && unit < units.length - 1) { scale *= 1024n; unit++ }
  const whole = value / scale; const hundredths = (value % scale) * 100n / scale
  return whole.toString() + (hundredths ? '.' + hundredths.toString().padStart(2, '0').replace(/0$/, '') : '') + ' ' + units[unit]
}
export function initialGiB (resource) {
  const bytes = exactBytes(resource, 'storagetotal')
  return bytes !== null && bytes % GIB === 0n ? (bytes / GIB).toString() : ''
}
export function capacityError (value, resource) {
  if (!/^\d+$/.test(String(value))) return 'message.objectstore.capacity.integer'
  const size = BigInt(value)
  if (size > MAX_GIB) return 'message.objectstore.capacity.range'
  const allocated = exactBytes(resource, 'storageallocated'); const reserved = exactBytes(resource, 'storagereserved')
  if (size > 0n && (allocated === null || reserved === null)) return 'message.objectstore.capacity.occupied.unknown'
  if (size > 0n && size * GIB < allocated + reserved) return 'message.objectstore.capacity.below'
  return ''
}
export function capacityPercent (used, total) {
  return used === null || total === null || total === 0n ? null : Number(used * 10000n / total) / 100
}
export function validEndpoint (value) {
  try { const u = new URL(value); return ['http:', 'https:'].includes(u.protocol) && !!u.hostname && !u.username && !u.password && !u.search && !u.hash } catch (_) { return false }
}
