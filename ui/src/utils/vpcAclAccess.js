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

import md5 from 'md5'

export function aclOrderHash (rules, count, aclId) {
  if (rules.length !== count || !rules.every(row => row.aclid === aclId && row.id && Number.isSafeInteger(row.number))) return null
  if (new Set(rules.map(row => row.id)).size !== count || new Set(rules.map(row => row.number)).size !== count) return null
  return md5(rules.map(row => row.id).join(''))
}

export function aclOrderConflict (error) {
  return Number(error?.code) === 431 &&
    error.message === 'It seems that the access control list in the database is not in the state that you used to apply the changed. Could you try it again?'
}

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

export const isAclListRoute = route => route.meta?.name === 'acllist'
export const aclDisplayValue = value => ['true', 'false'].includes(String(value)) ? String(value) : undefined
export const aclDisplayLabel = value => 'label.acl.display.' + (value ? 'visible' : 'hidden')

const hasDisplayParam = api => api?.params?.some(param => param.name === 'fordisplay') === true

export function aclDisplaySupported (getters, command = 'listNetworkACLLists') {
  return getters.userInfo?.roletype === 'Admin' && hasDisplayParam(getters.apis?.[command])
}

function aclListQuery (query, getters) {
  const result = Object.fromEntries(['q', 'keyword', 'name', 'vpcid', 'page', 'pagesize'].filter(key =>
    typeof query?.[key] === 'string').map(key => [key, query[key]]))
  const display = aclDisplaySupported(getters) && aclDisplayValue(query?.fordisplay)
  if (display) result.fordisplay = display
  return result
}

export function aclListDetailLocation (route, row, getters) {
  const context = aclListQuery(route.query, getters)
  return { path: '/acllist/' + encodeURIComponent(row.id), query: { aclreturn: JSON.stringify(context) } }
}

export function aclListLocation (route, row, getters) {
  let context
  try { context = JSON.parse(route.query.aclreturn) } catch { /* Direct detail link. */ }
  const query = aclListQuery(context, getters)
  if (!query.fordisplay && row.fordisplay === false && aclDisplaySupported(getters)) query.fordisplay = 'false'
  return { path: '/acllist', query }
}

export async function readAclList (get, params, allowDisplay, detailId, current = () => true) {
  const args = { ...params }
  const display = allowDisplay && aclDisplayValue(args.fordisplay)
  delete args.aclreturn
  delete args.fordisplay
  if (detailId) {
    for (const key of ['name', 'keyword', 'vpcid', 'tab']) delete args[key]
    Object.assign(args, { id: detailId, page: 1, pagesize: 1 })
  } else if (display) {
    args.fordisplay = display
  }
  const json = await get('listNetworkACLLists', args, aclRequestOptions)
  const body = aclResponse(json, 'listnetworkacllistsresponse')
  if (detailId && allowDisplay && current() && !(body.networkacllist || []).length) {
    return get('listNetworkACLLists', { ...args, fordisplay: false }, aclRequestOptions)
  }
  return json
}

export async function resolveAclScope (get, resource, activeProject, allowDisplay = false, current) {
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
  const json = await readAclList(get, { ...params, listall: true }, allowDisplay, resource.id, current)
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
  const flags = Object.fromEntries(Object.entries(aclCommands).map(([action, command]) => [
    action,
    names.has(command.toLowerCase()) && (action === 'readTags' || (write && (!action.endsWith('Tag') || readTags)))
  ]))
  for (const action of ['add', 'edit']) {
    const api = body.api.find(row => row.name.toLowerCase() === aclCommands[action].toLowerCase())
    flags[action + 'Display'] = root && flags[action] && hasDisplayParam(api)
  }
  return flags
}

// Keep a receipt once a job is accepted. A failed poll can be retried without
// submitting the mutation again. Each await is scoped to the original view.
export async function runAclWrite ({ get, post, command, params, pending, current, accepted, completed = () => {}, pause = () => new Promise(resolve => setTimeout(resolve, 750)) }) {
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
      completed(job.jobresult)
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
