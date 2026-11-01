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

import { Buffer } from 'buffer'
export const normalizeMetadataKey = key => String(key).trim().replace(/^x-amz-meta-/i, '').toLowerCase()
export function encodeMetadataValue (value) {
  return /[^\x20-\x7e]/.test(value) || value !== value.trim() ? '=?UTF-8?B?' + Buffer.from(value, 'utf8').toString('base64') + '?=' : value
}
export function analyzeMetadata (rows) {
  const entries = []; const seen = new Set(); let bytes = 0
  if (rows.length > 64) return { valid: false, error: 'message.objectstore.metadata.count', bytes, metadata: {} }
  for (const row of rows) {
    const key = normalizeMetadataKey(row.key); const value = String(row.value ?? '')
    if (!key || !/^[!#$%&'*+\-.^_`|~0-9a-z]+$/.test(key)) return { valid: false, error: 'message.objectstore.metadata.key', bytes, metadata: {} }
    if (key.startsWith('x-amz-')) return { valid: false, error: 'message.objectstore.metadata.reserved', bytes, metadata: {} }
    if (seen.has(key)) return { valid: false, error: 'message.objectstore.metadata.duplicate', bytes, metadata: {} }
    try { encodeURIComponent(value) } catch (_) { return { valid: false, error: 'message.objectstore.metadata.value', bytes, metadata: {} } }
    // Reject header injection and control characters before signing.
    // eslint-disable-next-line no-control-regex
    if (/[\x00-\x1f\x7f]/.test(value)) return { valid: false, error: 'message.objectstore.metadata.value', bytes, metadata: {} }
    seen.add(key); bytes += Buffer.byteLength(key, 'utf8') + Buffer.byteLength(encodeMetadataValue(value), 'utf8'); entries.push([key, value])
  }
  return { valid: bytes <= 2048, error: bytes > 2048 ? 'message.objectstore.metadata.bytes' : '', bytes, metadata: Object.fromEntries(entries) }
}
export function uploadMetadataHeaders (metadata) {
  const result = analyzeMetadata(Object.entries(metadata).map(([key, value]) => ({ key, value })))
  if (!result.valid) throw new Error(result.error)
  return Object.fromEntries(Object.entries(result.metadata).map(([key, value]) => ['x-amz-meta-' + key, encodeMetadataValue(value)]))
}
export function displayMetadataValue (value) {
  if (typeof value !== 'string' || !/^(=\?UTF-8\?[BQ]\?[^?]*\?=)([ \t]+=\?UTF-8\?[BQ]\?[^?]*\?=)*$/i.test(value)) return value
  try {
    return value.match(/=\?UTF-8\?[BQ]\?[^?]*\?=/gi).map(word => {
      const parts = /^=\?UTF-8\?([BQ])\?([^?]*)\?=$/i.exec(word); let bytes
      if (parts[1].toUpperCase() === 'B') {
        if (!/^[A-Za-z0-9+/]*={0,2}$/.test(parts[2])) throw new Error('Invalid encoding')
        bytes = Buffer.from(parts[2], 'base64')
      } else {
        const q = parts[2].replace(/_/g, ' '); const array = []
        for (let i = 0; i < q.length; i++) { if (q[i] === '=') { if (!/^[0-9a-f]{2}$/i.test(q.slice(i + 1, i + 3))) throw new Error('Invalid encoding'); array.push(parseInt(q.slice(i + 1, i + 3), 16)); i += 2 } else { if (q.charCodeAt(i) > 127) throw new Error('Invalid encoding'); array.push(q.charCodeAt(i)) } }
        bytes = Buffer.from(array)
      }
      const text = bytes.toString('utf8'); if (!Buffer.from(text, 'utf8').equals(bytes)) throw new Error('Invalid UTF-8'); return text
    }).join('')
  } catch (_) { return value }
}
