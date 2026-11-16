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

import { publicIpBoolean, publicIpAllocated } from '@/utils/publicIpPresentation'

const text = value => typeof value === 'string' && !/^(undefined|null|nan|none)$/i.test(value.trim()) ? value.trim() : ''
const identity = value => /^[a-z0-9][a-z0-9_-]*$/i.test(text(value)) ? text(value) : ''
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key)
export const publicIpDetailFields = ['state', 'vlanname', 'vlanid', 'networkid', 'associatednetworkname', 'vpcname', 'fordisplay', 'issystem', 'issourcenat', 'isstaticnat', 'allocated']
export const publicIpFieldLabel = field => ({ state: 'label.state', allocated: 'label.public.ip.allocated', issystem: 'label.issystem', issourcenat: 'label.issourcenat', isstaticnat: 'label.isstaticnat', vlanname: 'label.public.ip.vlan.value', vlanid: 'label.public.ip.vlan.range.id', networkid: 'label.public.ip.network.source', associatednetworkname: 'label.public.ip.network.attached', vpcname: 'label.vpc', fordisplay: 'label.public.ip.display' }[field])

// Consume the IP response only. Never recover hidden VLAN fields through another API.
export function publicIpField (resource = {}, field, apis = {}) {
  if (['fordisplay', 'issystem', 'issourcenat', 'isstaticnat'].includes(field)) return publicIpBoolean(resource, field)
  if (field === 'allocated') return publicIpAllocated(resource[field])
  if (['vlanname', 'vlanid'].includes(field)) {
    if (!own(resource, field)) return { text: '', missing: true }
    const raw = text(resource[field])
    if (field === 'vlanid') return { text: raw, id: identity(raw) }
    if (/^(vlan:\/\/)?untagged$/i.test(raw)) return { text: '', label: 'label.public.ip.vlan.untagged', raw }
    const tag = /^(?:vlan:\/\/)([0-9]+)$/.exec(raw)
    return { text: tag ? tag[1] : raw, raw: tag ? raw : '' }
  }
  const definition = { networkid: ['networkid', 'networkname'], associatednetworkname: ['associatednetworkid', 'associatednetworkname', '/guestnetwork/', 'listNetworks'], vpcname: ['vpcid', 'vpcname', '/vpc/', 'listVPCs'] }[field]
  if (!definition) return { text: '' }
  const [idKey, nameKey, route, api] = definition
  const id = identity(resource[idKey]); const name = text(resource[nameKey])
  return { text: name || id, id, path: id && route && api in apis ? route + encodeURIComponent(id) : '' }
}

export function publicIpReadAuth (store) {
  const user = store.getters.userInfo || {}
  return JSON.stringify([user.id, user.roletype, user.roleid, user.domainid, store.state?.user?.token, store.getters.project?.id, store.getters.listAllProjects, Object.keys(store.getters.apis || {}).sort(), ...['listPublicIpAddresses', 'reserveIpAddress', 'updateIpAddress'].map(api => (store.getters.apis?.[api]?.params || []).map(p => p.name).sort())])
}

export function validatePublicIpDetail (json, id) {
  const body = json?.listpublicipaddressesresponse
  if (body && !body.errorcode && (!body.publicipaddress || !body.publicipaddress.length) && !body.count) {
    const error = new Error('message.public.ip.detail.unavailable'); error.response = { status: 404 }; throw error
  }
  if (!body || body.errorcode || !Array.isArray(body.publicipaddress) || body.publicipaddress.length !== 1 || body.publicipaddress[0].id !== id || body.count !== undefined && body.count !== 1) throw new Error('message.public.ip.detail.read.failed')
}
