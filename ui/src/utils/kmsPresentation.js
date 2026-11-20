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

import { kmsProtocolOptions } from './kmsSearch'

const widths = { name: 320, id: 280, enabled: 112, ispublic: 112, protocol: 128, hsmprofile: 210, account: 160, project: 170, domainpath: 185, zonename: 172, owner: 180, vmname: 190, state: 110, version: 112, size: 108, encryptformat: 140, kmskeyversion: 126 }
export function kmsTableColumns (columns) {
  return columns.map(column => ({
    ...column,
    sorter: false,
    width: column.key === 'filtercolumn' ? 36 : widths[column.key] || column.width || 144
  }))
}

export function kmsCellLabel (field, value, t, te, readableSize, features) {
  if (value == null || value === '') return '—'
  if (field === 'enabled' && typeof value === 'boolean') return t(value ? 'label.enabled' : 'label.disabled')
  if (typeof value === 'boolean') return t(value ? 'label.yes' : 'label.no')
  if (['version', 'kmskeyversion'].includes(field)) return t('label.kms.current.version', { version: value })
  if (field === 'size') return readableSize(value)
  if (field === 'protocol') return kmsProtocolOptions(features).find(profile => profile.id === value)?.name || value
  if (field === 'state') {
    const key = 'label.' + String(value).toLowerCase()
    return te(key) ? t(key) : String(value)
  }
  return String(value)
}

export function kmsDisplayQuery (query, filter) {
  const next = { ...query, page: '1' }
  if (['true', 'false'].includes(filter)) next.enabled = filter
  else delete next.enabled
  return next
}
