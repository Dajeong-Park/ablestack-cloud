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

import { validCidr } from './conditionalFirewallRule'

export const aclCsvFields = {
  protocol: 'label.protocol',
  cidrlist: 'label.cidr',
  traffictype: 'label.traffictype',
  action: 'label.action',
  number: 'label.rule.number',
  startport: 'label.startport',
  endport: 'label.endport',
  icmptype: 'label.icmptype',
  icmpcode: 'label.icmpcode',
  reason: 'label.reason'
}

export function aclCsvRule (row) {
  const rule = {}
  for (const field of Object.keys(aclCsvFields)) {
    const raw = String(row[field] ?? '')
    const value = field === 'reason' ? raw : raw.trim()
    if (value && (field === 'reason' || value !== 'null')) rule[field] = value
  }
  return rule
}

export function aclCsvError (row) {
  if (row.invalidLength) return 'message.acl.csv.row.columns'
  if (!row.protocol || !['ingress', 'egress'].includes(row.traffictype?.toLowerCase())) return 'message.acl.csv.row.required'
  if (row.cidrlist?.split(',').some(value => !validCidr(value.trim(), value.includes(':')))) return 'message.acl.csv.row.cidr'
  if (row.startport || row.endport) {
    const port = value => /^\d{1,5}$/.test(value || '') && Number(value) >= 1 && Number(value) <= 65535
    if (!port(row.startport) || (row.endport && (!port(row.endport) || Number(row.startport) > Number(row.endport)))) return 'message.acl.csv.row.ports'
  }
  return ''
}

export function parseAclCsv (input) {
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
      throw Object.assign(new Error('Invalid ACL CSV quotes'), { line })
    } else if (!closed) { value += ch }
  }
  if (quoted) throw Object.assign(new Error('Unclosed ACL CSV quotes'), { line: recordLine })
  const header = records.shift()?.fields.map(field => field.trim().toLowerCase()) || []
  if (!records.length || new Set(header).size !== header.length ||
      !['protocol', 'cidrlist', 'traffictype'].every(field => header.includes(field))) {
    throw Object.assign(new Error('Invalid ACL CSV'), { line: 1 })
  }
  return records.map(({ line, fields }) => ({
    ...aclCsvRule(Object.fromEntries(header.map((field, i) => [field, fields[i]]))),
    line,
    invalidLength: fields.length !== header.length
  }))
}

export function formatAclCsv (rows) {
  const keys = Object.keys(aclCsvFields)
  const escape = value => {
    const text = String(value ?? '')
    return /[,\r\n"]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text
  }
  return '\uFEFF' + [keys.join(','), ...rows.map(row => keys.map(key => escape(row[key])).join(','))].join('\r\n') + '\r\n'
}

export function aclImportReport (jobResult, submittedRows) {
  const report = jobResult?.networkaclimport
  const failures = report?.failedrows
  if (!report || !Array.isArray(report.importedrules) || !failures || typeof failures !== 'object' ||
      Array.isArray(failures) || typeof report.applied !== 'boolean') throw new Error('Invalid ACL import report')
  const failureLines = Object.keys(failures)
  if (report.successcount !== report.importedrules.length || report.failurecount !== failureLines.length ||
      report.successcount + report.failurecount !== submittedRows.length ||
      !failureLines.every(line => submittedRows.some(row => String(row.line) === line) && typeof failures[line] === 'string')) {
    throw new Error('Inconsistent ACL import report')
  }
  return report
}
