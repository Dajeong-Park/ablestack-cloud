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

import { isoBoolean, isoListResponse } from '@/utils/isoModel'

export function isoDownloadResult (data, id, zoneid) {
  if (!data || data.id !== id || (data.zoneid && data.zoneid !== zoneid)) return null
  try {
    const url = new URL(data.url)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null
    return { url: url.href, size: Number.isSafeInteger(data.physicalsize) && data.physicalsize >= 0 ? data.physicalsize : null }
  } catch (_) { return null }
}

export function bootIsoZones (rows) {
  return [...new Map(rows.filter(i => i.zoneid && isoBoolean(i.isready) === true && isoBoolean(i.bootable) === true).map(i => [i.zoneid, { id: i.zoneid, name: i.zonename }])).values()]
}

// Keep the existing VM consumer's executable filters, but include shared media.
export async function readVmIsoCandidates (request, vm, current = () => true) {
  const found = []
  for (const filter of ['featured', 'community', 'selfexecutable', 'sharedexecutable']) {
    let seen = 0; let total
    for (let page = 1; page <= 100; page++) {
      const response = isoListResponse(await request('listIsos', { zoneid: vm.zoneid, isofilter: filter, isready: true, listall: true, page, pagesize: 100 }, { preserveOnFailure: true }))
      if (!current()) return null
      if (total !== undefined && response.count !== total) throw new Error('ISO candidate list changed')
      total = response.count; found.push(...response.rows); seen += response.rows.length
      if (seen >= total) break
      if (!response.rows.length || page === 100) throw new Error('Incomplete ISO candidate list')
    }
  }
  return [...new Map(found.filter(i => isoBoolean(i.isready) !== false && (!i.zoneid || i.zoneid === vm.zoneid)).map(i => [i.id, i])).values()]
}
