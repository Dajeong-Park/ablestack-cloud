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

// Keep labels searchable while UUID remains the only selection identity.
export function normalizeBucketStoreSearch (value) {
  return String(value ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase()
}

export function filterBucketStoreOption (input, option = {}) {
  const query = normalizeBucketStoreSearch(input)
  return !query || [option?.label, option?.value].some(value => normalizeBucketStoreSearch(value).includes(query))
}

export async function bucketStoreOptions (getAPI) {
  const rows = []; const seen = new Set(); let count
  for (let page = 1; page <= 100; page++) {
    const json = await getAPI('listObjectStoragePools', { ignoreproject: true, page, pagesize: 500 }, { preserveOnFailure: true, timeout: 20000 })
    const body = json?.listobjectstoragepoolsresponse
    if (!body || typeof body !== 'object' || Array.isArray(body) || body.errorcode) throw new Error('Store lookup unavailable')
    const items = body.objectstore === undefined ? [] : body.objectstore; const total = Number(body.count ?? (Object.keys(body).length === 0 ? 0 : NaN))
    if (!Array.isArray(items) || !Number.isInteger(total) || total < 0 || (count !== undefined && count !== total)) throw new Error('Incomplete store lookup')
    count = total
    for (const row of items) {
      if (typeof row.id !== 'string' || !row.id || seen.has(row.id)) throw new Error('Invalid store option')
      seen.add(row.id); rows.push({ id: row.id, name: String(row.name ?? row.id), capabilities: row.capabilities || {} })
    }
    if (rows.length === count) return rows
    if (!items.length || rows.length > count) throw new Error('Incomplete store lookup')
  }
  throw new Error('Store lookup page limit')
}
