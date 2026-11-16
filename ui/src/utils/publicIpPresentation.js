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

const states = ['Free', 'Reserved', 'Allocated', 'Allocating', 'Releasing']
export const publicIpFilterLabels = Object.fromEntries(states.map(state => [state.toLowerCase(), 'label.public.ip.state.' + state.toLowerCase()]))
const scalar = value => ['string', 'number', 'boolean'].includes(typeof value) ? String(value).trim() : ''

export function publicIpState (value) {
  const raw = scalar(value)
  const state = typeof value === 'string' && states.find(state => state.toLowerCase() === raw.toLowerCase())
  const missing = value == null || typeof value === 'string' && !raw
  return { state: state || '', raw, key: state ? publicIpFilterLabels[state.toLowerCase()] : missing ? 'label.public.ip.value.notprovided' : 'label.unknown' }
}

export function publicIpBoolean (resource, field) {
  const value = resource[field]
  if (value == null) return { missing: true }
  if (typeof value !== 'boolean') return { label: 'label.unknown', raw: scalar(value) }
  return { label: field === 'fordisplay' ? 'label.public.ip.display.' + (value ? 'visible' : 'hidden') : value ? 'label.yes' : 'label.no' }
}

export function publicIpAllocated (value) {
  if (value == null || value === '') return { text: '—' }
  return typeof value === 'string' && Number.isFinite(Date.parse(value)) ? { date: value } : { label: 'label.unknown', raw: scalar(value) }
}
