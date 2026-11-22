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

import { formatCsvRecords, parseCsvRecords } from './csv'

const roleFields = ['rule', 'permission', 'description']

export function parseRoleCsv (input) {
  let records
  try {
    records = parseCsvRecords(input)
  } catch (error) {
    return { rules: [], errors: [{ line: error.line, message: 'message.role.csv.quotes' }] }
  }
  const header = records.shift()?.fields.map(field => field.trim().toLowerCase()) || []
  if (header.length !== roleFields.length || !roleFields.every((key, index) => header[index] === key)) {
    return { rules: [], errors: [{ line: 1, message: 'message.role.csv.header' }] }
  }
  if (!records.length) {
    return { rules: [], errors: [{ line: 1, message: 'message.role.csv.empty' }] }
  }

  const rules = []
  const errors = []
  for (const { line, fields } of records) {
    if (fields.length !== roleFields.length) {
      errors.push({ line, message: 'message.acl.csv.row.columns' })
      continue
    }
    const rule = fields[0].trim()
    const permission = fields[1].trim().toLowerCase()
    if (!/^[a-zA-Z0-9*]+$/.test(rule)) {
      errors.push({ line, message: 'message.role.csv.rule' })
    } else if (!['allow', 'deny'].includes(permission)) {
      errors.push({ line, message: 'message.role.csv.permission' })
    } else {
      rules.push({ rule, permission, description: fields[2] })
    }
  }
  return { rules, errors }
}

export function formatRoleCsv (rules) {
  return formatCsvRecords(roleFields, rules)
}
