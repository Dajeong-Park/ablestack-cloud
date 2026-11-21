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

export const roleRuleActions = ['createRolePermission', 'updateRolePermission', 'deleteRolePermission']

export function canRoleAction (api, role, apis) {
  if (!(api in (apis || {}))) return false
  if (api === 'createRole' || api === 'importRole') return true
  if (!role?.id) return false
  if (api === 'deleteRole') return role.isdefault === false && role.inuse === false
  if (api === 'enableRole') return role.state === 'disabled'
  if (api === 'disableRole') return role.state === 'enabled'
  if (roleRuleActions.includes(api)) return role.isdefault === false
  return api === 'updateRole'
}

export function roleEditFields (role) {
  if (role.isdefault !== false) return ['ispublic']
  return ['name', 'description', ...(role.inuse === false ? ['type'] : []), 'ispublic']
}

export function roleUsageParams (apis) {
  return apis?.listRoles?.params?.some(param => param.name === 'showusage') ? { showusage: true } : {}
}

export function roleActionTarget (role) {
  const { id, name, type, state, isdefault, inuse } = role || {}
  return { id, name, type, state, isdefault, inuse }
}
