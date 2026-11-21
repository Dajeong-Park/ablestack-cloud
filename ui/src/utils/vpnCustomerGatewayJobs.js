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
import { getAPI } from '@/api'
import { createJobTracker } from '@/utils/jobTracker'
import { networkError } from '@/utils/networkLifecycle'

export const gatewayRequestOptions = { preserveOnFailure: true, timeout: 15000 }

export function gatewayJobTracker () {
  return createJobTracker({
    query: async jobid => {
      const response = await getAPI('queryAsyncJobResult', { jobid, ignoreproject: true }, gatewayRequestOptions)
      const result = response?.queryasyncjobresultresponse
      if (result?.jobid !== jobid) throw new Error('Unexpected VPN customer gateway job')
      return result
    },
    onState: () => {},
    maxDuration: 120000
  })
}

export function gatewayRequestError (error) {
  const { definitive, text } = networkError(error)
  return definitive && error.response?.status < 500 ? text : null
}

export function gatewayErrorText (text, psk) {
  return text && psk ? text.split(psk).join('••••••••') : text
}

export function vpnCustomerGatewayActionKey (getters, route, session) {
  const user = getters.userInfo || {}
  const apis = getters.apis || {}
  return JSON.stringify([session, user.id, user.roletype, user.roleid, user.domainid, getters.project?.id, getters.listAllProjects, route.fullPath,
    ...['listVpnCustomerGateways', 'createVpnCustomerGateway', 'updateVpnCustomerGateway', 'deleteVpnCustomerGateway', 'queryAsyncJobResult'].map(api => !!apis[api])])
}
