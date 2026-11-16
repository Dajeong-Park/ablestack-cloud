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

export const kubernetesIsoApis = Object.freeze({
  read: 'listKubernetesSupportedVersions',
  url: 'addKubernetesSupportedVersion',
  local: 'getUploadParamsForKubernetesSupportedVersion',
  update: 'updateKubernetesSupportedVersion',
  delete: 'deleteKubernetesSupportedVersion'
})
const object = value => !!value && typeof value === 'object' && !Array.isArray(value)
const own = (value, key) => !!value && Object.prototype.hasOwnProperty.call(value, key)
const fields = ['name', 'semanticversion', 'zoneid', 'url', 'checksum', 'mincpunumber', 'minmemory', 'directdownload', 'arch', 'format', 'account', 'domainid', 'projectid']

// The catalog is global and system-owned. ISO ownership or VM Metrics grants
// cannot substitute for an independently granted catalog command.
export function kubernetesIsoCapability (operation, getters = {}) {
  const api = kubernetesIsoApis[operation]
  const metadata = api && getters.apis?.[api]
  const granted = object(metadata)
  const available = granted && (operation === 'read' || getters.userInfo?.roletype === 'Admin')
  const schema = granted && Array.isArray(metadata.params) ? metadata.params : null
  const parameters = Object.fromEntries((schema || []).filter(p => object(p) && typeof p.name === 'string').map(p => [p.name.toLowerCase(), p]))
  return { api: api || '', available, granted, schemaKnown: schema !== null, parameters }
}

export function canKubernetesIsoAction (operation, record = {}, getters = {}) {
  return kubernetesIsoCapability(operation, getters).available &&
    (['read', 'url', 'local'].includes(operation) || (typeof record.id === 'string' && !!record.id))
}

export function kubernetesIsoMode (action = {}) {
  return (action.currentAction?.api || action.api) === kubernetesIsoApis.local ? 'local' : 'url'
}

export function kubernetesIsoParameterHelp (parameters = {}) {
  return Object.fromEntries(fields.map(name => [name, { ...(object(parameters[name]) ? parameters[name] : {}), description: typeof parameters[name]?.description === 'string' ? parameters[name].description : '' }]))
}

export function kubernetesIsoRegistrationParams (mode, values, getters = {}) {
  const capability = kubernetesIsoCapability(mode, getters)
  if (!['url', 'local'].includes(mode) || !capability.available) throw new Error('message.kubernetes.iso.read.forbidden')
  const allowed = ['name', 'semanticversion', 'zoneid', 'checksum', 'mincpunumber', 'minmemory', ...(mode === 'url' ? ['url', 'directdownload', 'arch'] : ['arch'])]
  const params = {}
  for (const name of allowed) {
    if (capability.schemaKnown && !own(capability.parameters, name)) continue
    const value = values[name]
    if (value !== undefined && value !== null && value !== '') params[name] = value
  }
  // Inherited account/domain/project fields do not own the version or its ISO.
  // Never send the global catalog operation into the selected project.
  if (mode === 'local') params.format = 'ISO'
  return params
}

// This value is runtime-only. Never persist or log it: it includes the current
// session marker so relogin with the same account also invalidates pending reads.
export function kubernetesIsoContext (getters = {}, session, target = '') {
  const user = getters.userInfo || {}
  return JSON.stringify([target, session, user.id, user.account, user.domainid, user.roleid, user.roletype, getters.project?.id, !!getters.listAllProjects,
    Object.entries(getters.apis || {}).map(([name, value]) => [name, Array.isArray(value?.params) ? value.params.map(p => p.name).sort() : null]).sort(([a], [b]) => a.localeCompare(b))])
}
