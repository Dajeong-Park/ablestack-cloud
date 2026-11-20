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

import { kmsLookup } from './kmsSearch'
import { readKmsResource } from './kmsOperation'

export const availabilityActions = [
  'createKMSKey', 'rotateKMSKey', 'migrateVolumesToKMS', 'deleteKMSKey', 'updateKMSKey',
  'createHSMProfile', 'updateHSMProfile', 'deleteHSMProfile'
]

const requiredApis = {
  createKMSKey: ['listHSMProfiles', 'listZones', 'listKMSKeys'],
  rotateKMSKey: ['listKMSKeys', 'listHSMProfiles', 'queryAsyncJobResult'],
  migrateVolumesToKMS: ['listKMSKeys', 'listHSMProfiles', 'listVolumes', 'queryAsyncJobResult'],
  updateKMSKey: ['listKMSKeys'],
  deleteKMSKey: ['listKMSKeys', 'queryAsyncJobResult'],
  createHSMProfile: ['listCapabilities', 'listHSMProfiles'],
  updateHSMProfile: ['listHSMProfiles'],
  deleteHSMProfile: ['listHSMProfiles']
}

export function hsmCandidateReason (profile, owner) {
  if (!profile?.id) return 'profileMissing'
  if (profile.enabled !== true) return 'profileDisabled'
  if (owner.zoneid && profile.zoneid && profile.zoneid !== owner.zoneid) return 'profileZone'
  if (profile.ispublic === true) return ''
  if (profile.projectid) return profile.projectid === owner.projectid ? '' : 'profileScope'
  if (profile.account) {
    return !owner.projectid && owner.account === profile.account && owner.domainid === profile.domainid ? '' : 'profileScope'
  }
  // An account-less domain profile is usable directly in that domain, also by its project accounts.
  return profile.domainid && profile.domainid === owner.domainid ? '' : 'profileScope'
}

export function actionAvailability (api, { resource, scope = {}, apis = {}, candidate, profile } = {}) {
  if (!availabilityActions.includes(api)) return ''
  if (scope.current === false) return 'stale'
  if ((api === 'migrateVolumesToKMS' || api.endsWith('HSMProfile')) && scope.role !== 'Admin') return 'forbidden'
  if (![api, ...requiredApis[api]].every(name => name in apis)) return 'forbidden'
  if (!api.startsWith('create') && !resource?.id) return 'stale'
  if (['rotateKMSKey', 'migrateVolumesToKMS'].includes(api) && resource.enabled === false) return 'keyDisabled'
  if (api === 'deleteHSMProfile') {
    if (resource.deleteprotected === true) return resource.deletereason === 'SYSTEM_DATABASE_PROFILE' ? 'systemDatabase' : 'protected'
    if (resource.deleteprotected !== false) return 'deletePolicy'
  }
  if (candidate && candidate !== 'ready') return candidate
  if (profile && ['createKMSKey', 'rotateKMSKey'].includes(api)) return hsmCandidateReason(profile, scope.owner || {})
  return ''
}

export function kmsAvailabilityLabel (reason) {
  return reason ? 'message.kms.availability.' + reason : ''
}

export function kmsAvailabilityFailure (error) {
  return [401, 403, 531, 536].includes(Number(error?.response?.status)) ? 'forbidden' : 'error'
}

export function projectOwner (getters, project) {
  if (!project) return { account: getters.userInfo?.account, domainid: getters.userInfo?.domainid }
  return { projectid: project.id, domainid: project.domainid }
}

export function sameKmsOwner (left, right) {
  return !!left && !!right && ['id', 'account', 'domainid', 'projectid', 'zoneid'].every(key => (left[key] || '') === (right[key] || ''))
}

export async function readHsmCandidate (get, profile, current) {
  if (!profile?.id || !current()) return null
  const scope = profile.projectid ? { projectid: profile.projectid } : {}
  const row = await readKmsResource(get, 'listHSMProfiles', scope, profile.id, true)
  return current() ? row : null
}

export async function loadScopedHsmCandidates (get, projectid, current) {
  const groups = await Promise.all([
    kmsLookup(get, 'hsmprofileid', {}, current),
    ...(projectid ? [kmsLookup(get, 'hsmprofileid', { projectid }, current)] : [])
  ])
  return current() ? [...new Map(groups.flat().map(row => [row.id, row])).values()] : []
}
