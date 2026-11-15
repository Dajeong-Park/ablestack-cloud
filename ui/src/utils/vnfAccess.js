// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements. See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership. The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License. You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied. See the License for the
// specific language governing permissions and limitations
// under the License.

const text = value => typeof value === 'string' && value.trim() ? value : ''
const enabled = value => value !== false && value !== 'false' && value !== 0
const deviceId = value => /^\d+$/.test(String(value)) && Number(value) <= 2147483647 ? Number(value) : null

export function vnfCredentialRows (vm = {}, allowPasswords = false) {
  const d = vm.vnfdetails || {}
  return [
    ['username', '', 'label.username', d.username],
    ['password', '', 'label.password.default', allowPasswords ? text(vm.password) || d.password : ''],
    ['web_user', 'Web ', 'label.username', d.web_user],
    ['web_password', 'Web ', 'label.password.default', allowPasswords ? d.web_password : ''],
    ['ssh_user', 'SSH ', 'label.username', d.ssh_user],
    ['ssh_password', 'SSH ', 'label.password.default', allowPasswords ? d.ssh_password : '']
  ].filter(row => text(row[3])).map(([key, prefix, label, value]) => ({ key, prefix, label, value, secret: /password/.test(key) }))
}

export function vnfManagementAddress (value) {
  if (typeof value !== 'string') return null
  const ip = value.trim()
  if (/^(?:0|[1-9]\d{0,2})(?:\.(?:0|[1-9]\d{0,2})){3}$/.test(ip) && ip.split('.').every(n => Number(n) <= 255)) return ip
  if (!ip.includes(':') || !/^[\da-fA-F:.]+$/.test(ip)) return null
  try { return new URL(`http://[${ip}]/`).hostname } catch (_) { return null }
}

function port (value, fallback) {
  if (value === undefined || value === null || value === '') return fallback
  return /^\d+$/.test(String(value)) && Number(value) >= 1 && Number(value) <= 65535 ? Number(value) : null
}

export function vnfWebUrl (protocol, address, value, path = '') {
  if (!['http', 'https'].includes(protocol)) return null
  const host = vnfManagementAddress(address)
  const p = port(value, protocol === 'http' ? 80 : 443)
  if (!host || !p || typeof path !== 'string') return null
  try {
    const decoded = decodeURIComponent(path)
    if ([...decoded].some(c => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127) || decoded.includes('\\') || decoded.startsWith('//') || /^[a-z][\w+.-]*:/i.test(decoded)) return null
    const url = new URL(`${protocol}://${host}:${p}${path.startsWith('/') ? path : '/' + path}`)
    return url.protocol === protocol + ':' && url.hostname === host ? url.href : null
  } catch (_) { return null }
}

export function vnfManagementAccess (vm = {}) {
  if (vm.templatetype !== 'VNF') return null
  const d = vm.vnfdetails || {}
  const raw = text(d.access_methods)
  const methods = [...new Set((raw ? raw.split(',') : ['console']).map(s => s.trim().toLowerCase()).filter(Boolean))]
  const definitions = (Array.isArray(vm.vnfnics) ? vm.vnfnics : []).filter(n => n.management === true && enabled(n.enabled)).map(n => deviceId(n.deviceid)).filter(id => id !== null)
  const addresses = [...new Set((Array.isArray(vm.nic) ? vm.nic : []).filter(n => enabled(n.enabled) && definitions.includes(deviceId(n.deviceid))).flatMap(n => [n.ipaddress, n.ip6address, n.publicip]).map(vnfManagementAddress).filter(Boolean))]
  const entries = []
  for (const method of methods) {
    if (method === 'console') {
      entries.push({ key: method, label: vm.state === 'Running' ? 'message.vnf.access.console' : 'message.vnf.access.console.stopped' })
    } else if (['ssh-password', 'ssh-key', 'http', 'https'].includes(method)) {
      const p = port(d[method.startsWith('ssh') ? 'ssh_port' : method + '_port'], method.startsWith('ssh') ? 22 : method === 'http' ? 80 : 443)
      const usable = addresses.map(address => ({ address, href: ['http', 'https'].includes(method) ? vnfWebUrl(method, address.replace(/^\[|\]$/g, ''), d[method + '_port'], d[method + '_path'] ?? '') : null }))
        .filter(row => p && (method.startsWith('ssh') || row.href))
      if (!usable.length) entries.push({ key: method, label: 'message.vnf.access.unavailable', params: { method: method.toUpperCase() } })
      for (const row of usable) entries.push({ key: `${method}:${row.address}`, label: 'message.vnf.access.ssh', params: { method: method.toUpperCase(), address: row.address, port: p }, href: row.href })
    }
  }
  if (!entries.length) entries.push({ key: 'unsupported', label: 'message.vnf.access.unsupported' })
  return { entries, hasCredentials: vnfCredentialRows(vm, vm.passwordenabled === true).length > 0 }
}

export function vnfNoticeScope (store) {
  const g = store.getters
  const u = g.userInfo || {}
  return JSON.stringify([store.state?.user?.token, u.id, u.account, u.domainid, u.roletype, u.roleid, g.project?.id, g.listAllProjects, Object.keys(g.apis || {}).sort()])
}

// Contains policy/identity only. Credentials come exclusively from the completed job response.
export function vnfDeploymentNotice (store, template, params, invalidate) {
  const scope = vnfNoticeScope(store)
  const policy = { templateid: params.templateid, passwordenabled: template?.id === params.templateid && template.passwordenabled === true, projectid: params.projectid || store.getters.project?.id || null }
  let valid = true
  let stop = () => {}
  const release = () => { valid = false; stop() }
  stop = store.watch(() => vnfNoticeScope(store), () => { release(); invalidate() }, { flush: 'sync' })
  return {
    release,
    current: () => valid && scope === vnfNoticeScope(store),
    credentials (result, route, currentTemplate) {
      const vm = result?.jobresult?.virtualmachine
      if (!valid || scope !== vnfNoticeScope(store) || result?.jobstatus !== 1 || !vm?.id || vm.templateid !== policy.templateid || (vm.projectid || null) !== policy.projectid || (result.jobinstanceid && result.jobinstanceid !== vm.id)) return []
      const path = route?.path
      const deploying = ['/action/deployVnfAppliance', '/deployVnfAppliance'].includes(path)
      if (deploying && currentTemplate !== policy.templateid) return []
      if (!deploying && !['/vnfapp', '/vm', `/vnfapp/${vm.id}`, `/vm/${vm.id}`, `/template/${policy.templateid}`].includes(path)) return []
      return vnfCredentialRows(vm, policy.passwordenabled && vm.passwordenabled !== false)
    }
  }
}
