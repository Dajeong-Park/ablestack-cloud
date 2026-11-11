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

export function appCookieContract (network) {
  const service = network?.service?.find(s => s.name === 'Lb')
  const raw = service?.capability?.find(c => c.name === 'SupportedStickinessMethods')?.value
  const methods = typeof raw === 'string' ? JSON.parse(raw) : raw
  if (!Array.isArray(methods)) throw new Error('Missing stickiness capability')
  const method = methods.find(m => m.methodname === 'AppCookie')
  return { available: !!method, params: (method?.paramlist || []).map(p => p.paramname), exact: service.provider?.some(p => ['VirtualRouter', 'VpcVirtualRouter'].includes(p.name)) }
}

export function appCookieError (form) {
  if (form.mode || form.prefix) return 'message.appcookie.unsupported'
  if (form.cookieName && !/^[A-Za-z0-9_.-]{1,128}$/.test(form.cookieName)) return 'message.appcookie.cookie'
  if (form.length !== undefined && form.length !== null && form.length !== '' && (!/^[0-9]{1,3}$/.test(String(form.length)) || Number(form.length) < 1 || Number(form.length) > 256)) return 'message.appcookie.length'
  if (form.holdtime !== undefined && form.holdtime !== null && form.holdtime !== '') {
    const match = String(form.holdtime).match(/^([1-9][0-9]{0,9})(ms|s|m|h|d)?$/)
    if (!match || Number(match[1]) * ({ ms: 1, s: 1000, m: 60000, h: 3600000, d: 86400000 }[match[2]] || 1) > 2073600000) return 'message.appcookie.holdtime'
  }
  return null
}
