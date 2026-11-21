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

export function parseCsvRecords (input) {
  const text = input.replace(/^\uFEFF/, '') + '\n'
  const records = []
  let fields = []
  let value = ''
  let quoted = false
  let closed = false
  let line = 1
  let recordLine = 1
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { value += ch; i++ } else if (ch === '"') {
        quoted = false
        closed = true
      } else {
        value += ch
        if (ch === '\n' || (ch === '\r' && text[i + 1] !== '\n')) line++
      }
    } else if (ch === ',' || ch === '\n' || ch === '\r') {
      fields.push(value)
      value = ''
      closed = false
      if (ch !== ',') {
        if (fields.length > 1 || fields[0].trim()) records.push({ line: recordLine, fields })
        fields = []
        if (ch === '\r' && text[i + 1] === '\n') i++
        recordLine = ++line
      }
    } else if (ch === '"' && !value.trim() && !closed) {
      quoted = true
      value = ''
    } else if ((closed && ch.trim()) || ch === '"') {
      throw Object.assign(new Error('Invalid CSV quotes'), { line })
    } else if (!closed) { value += ch }
  }
  if (quoted) throw Object.assign(new Error('Unclosed CSV quotes'), { line: recordLine })
  return records
}

export function formatCsvRecords (keys, rows) {
  const escape = value => {
    const text = String(value ?? '')
    return /[,\r\n"]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text
  }
  return '\uFEFF' + [keys.join(','), ...rows.map(row => keys.map(key => escape(row[key])).join(','))].join('\r\n') + '\r\n'
}
