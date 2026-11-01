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

const descriptors = {
  domains: ['listDomains', 'listdomainsresponse', 'domain'],
  accounts: ['listAccounts', 'listaccountsresponse', 'account'],
  projects: ['listProjects', 'listprojectsresponse', 'project']
}

// Read every permitted page before exposing a choice. Never accept a mixed-domain page.
export async function scopedOwnershipOptions (getAPI, kind, params = {}) {
  const [api, envelope, field] = descriptors[kind]
  const rows = []; const seen = new Set(); let count
  for (let page = 1; page <= 100; page++) {
    const result = await getAPI(api, { ...params, listall: true, ignoreproject: true, page, pagesize: 500 }, { preserveOnFailure: true, timeout: 20000 })
    const body = result[envelope]
    if (!body || typeof body !== 'object' || body.errorcode) throw new Error('Owner lookup unavailable')
    const items = body[field] || []; const total = Number(body.count ?? (Object.keys(body).length === 0 ? 0 : NaN))
    if (!Array.isArray(items) || !Number.isInteger(total) || total < 0 || (count !== undefined && total !== count)) throw new Error('Incomplete owner lookup')
    count = total
    for (const row of items) {
      if (!row.id || !row.name || seen.has(row.id)) throw new Error('Invalid owner option')
      if (kind !== 'domains' && row.domainid !== params.domainid) throw new Error('Owner domain mismatch')
      seen.add(row.id); rows.push(row)
    }
    if (rows.length === count) return rows.filter(row => kind === 'accounts' ? String(row.state).toLowerCase() === 'enabled' && Number(row.type) !== 5 : kind === 'projects' ? String(row.state).toLowerCase() === 'active' : !row.state || String(row.state).toLowerCase() === 'active')
    if (!items.length || rows.length > count) throw new Error('Incomplete owner lookup')
  }
  throw new Error('Owner lookup page limit')
}

export function bucketOwnerParameters (owner, caller = {}, project = {}) {
  if (project.id) return { projectid: project.id }
  if (owner?.selectedAccountType === 'Project' && owner.selectedProject) return { projectid: owner.selectedProject }
  if (!owner) return {}
  if (!owner.selectedAccount || !owner.selectedDomain) throw new Error('Owner selection incomplete')
  if (owner.selectedAccount === caller.account && owner.selectedDomain === caller.domainid) return {}
  return { account: owner.selectedAccount, domainid: owner.selectedDomain }
}
