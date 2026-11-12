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

export const aclCommands = {
  add: 'createNetworkACL',
  edit: 'updateNetworkACLItem',
  remove: 'deleteNetworkACL',
  move: 'moveNetworkAclItem',
  import: 'importNetworkACL',
  readTags: 'listTags',
  addTag: 'createTags',
  removeTag: 'deleteTags'
}

export const aclRequestOptions = { preserveOnFailure: true, timeout: 15000 }
export const aclProjectArgs = projectid => ({ ignoreproject: true, ...(projectid ? { projectid } : {}) })

export function aclResponse (json, key) {
  const body = json?.[key] || Object.entries(json || {}).find(([name]) => name.toLowerCase() === key)?.[1]
  const failure = Object.values(json || {}).find(row => row?.errorcode || row?.errortext)
  if (failure) throw aclFailure(failure.errortext, failure.errorcode)
  if (!body || typeof body !== 'object') throw new Error('Invalid ' + key)
  return body
}

const aclFailure = (message, code) => Object.assign(new Error(message || ''), { code })

export function aclDenied (error) {
  return [401, 403].includes(Number(error?.response?.status || error?.code))
}

export async function resolveAclScope (get, resource, activeProject) {
  let projectId = resource.projectid || activeProject
  // An ACL response has a VPC ID, but usually no project ID. Resolve it before
  // using default-view API metadata for a project ACL reached by a direct link.
  if (!projectId && resource.vpcid) {
    const json = await get('listVPCs', { id: resource.vpcid, listall: true, ignoreproject: true }, aclRequestOptions)
    const vpc = aclResponse(json, 'listvpcsresponse').vpc?.find(row => row.id === resource.vpcid)
    if (!vpc) return null
    projectId = vpc.projectid
  }
  if (activeProject && projectId !== activeProject) return null
  const params = aclProjectArgs(projectId)
  const json = await get('listNetworkACLLists', { ...params, id: resource.id, listall: true }, aclRequestOptions)
  const row = aclResponse(json, 'listnetworkacllistsresponse').networkacllist?.find(row => row.id === resource.id)
  if (!row || (row.vpcid && row.vpcid !== resource.vpcid)) return null
  return { params, row }
}

export async function discoverAclAccess (get, target, root) {
  const body = aclResponse(await get('listApis', { ...target.params }, aclRequestOptions), 'listapisresponse')
  if (!Array.isArray(body.api) || body.api.some(row => typeof row?.name !== 'string')) throw new Error('Invalid ACL API discovery')
  const names = new Set(body.api.map(row => row.name.toLowerCase()))
  const readTags = names.has('listtags')
  const builtIn = !target.row.vpcid && ['default_allow', 'default_deny'].includes(target.row.name)
  const write = !builtIn && (root || !!target.row.vpcid) && names.has('queryasyncjobresult')
  return Object.fromEntries(Object.entries(aclCommands).map(([action, command]) => [
    action,
    names.has(command.toLowerCase()) && (action === 'readTags' || (write && (!action.endsWith('Tag') || readTags)))
  ]))
}

// Keep a receipt once a job is accepted. A failed poll can be retried without
// submitting the mutation again. Each await is scoped to the original view.
export async function runAclWrite ({ get, post, command, params, pending, current, accepted, pause = () => new Promise(resolve => setTimeout(resolve, 750)) }) {
  if (!current()) return false
  let jobId = pending
  if (!jobId) {
    const response = command === aclCommands.edit ? 'createnetworkaclresponse' : command.toLowerCase() + 'response'
    const body = aclResponse(await post(command, { ...params }, aclRequestOptions), response)
    if (!current()) return false
    jobId = body.jobid
    if (!jobId) throw new Error('Missing ACL job receipt')
    accepted(jobId)
  }
  for (let i = 0; i < 25 && current(); i++) {
    const json = await get('queryAsyncJobResult', { jobid: jobId, ignoreproject: true }, aclRequestOptions)
    if (!current()) return false
    const job = aclResponse(json, 'queryasyncjobresultresponse')
    if (job.jobid !== jobId) throw new Error('Unexpected ACL job receipt')
    if (job.jobstatus === 1) {
      accepted(null)
      return true
    }
    if (job.jobstatus === 2) {
      accepted(null)
      throw aclFailure(job.jobresult?.errortext, job.jobresult?.errorcode || job.jobresultcode)
    }
    if (job.jobstatus !== 0) throw new Error('Invalid ACL job status')
    await pause()
  }
  if (!current()) return false
  throw new Error('ACL job pending')
}

const csvFields = ['protocol', 'cidrlist', 'traffictype', 'action', 'number', 'startport', 'endport', 'icmptype', 'icmpcode', 'reason']

export function parseAclCsv (input) {
  const text = input.replace(/^\uFEFF/, '') + '\n'
  const rows = []
  let fields = []
  let value = ''
  let quoted = false
  let closed = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { value += ch; i++ } else if (ch === '"') {
        quoted = false
        closed = true
      } else { value += ch }
    } else if (ch === ',' || ch === '\n' || ch === '\r') {
      fields.push(value.trim())
      value = ''
      closed = false
      if (ch !== ',') {
        if (fields.some(Boolean)) rows.push(fields)
        fields = []
        if (ch === '\r' && text[i + 1] === '\n') i++
      }
    } else if (ch === '"' && !value.trim() && !closed) {
      quoted = true
      value = ''
    } else if ((closed && ch.trim()) || ch === '"') {
      throw new Error('Invalid ACL CSV quotes')
    } else { value += ch }
  }
  const header = rows.shift()?.map(field => field.toLowerCase()) || []
  const required = ['protocol', 'cidrlist', 'traffictype']
  if (quoted || !rows.length || new Set(header).size !== header.length || !required.every(field => header.includes(field))) throw new Error('Invalid ACL CSV')
  return rows.map((fields, key) => {
    if (fields.length !== header.length || !fields[header.indexOf('protocol')] || !fields[header.indexOf('traffictype')]) throw new Error('Invalid ACL CSV row')
    const row = { key }
    header.forEach((name, i) => {
      const value = fields[i]
      if (csvFields.includes(name) && value && value !== 'null') row[name] = value
    })
    return row
  })
}
