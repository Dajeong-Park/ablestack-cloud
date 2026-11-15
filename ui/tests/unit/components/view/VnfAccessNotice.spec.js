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
import { mount } from '@vue/test-utils'
import VnfAccessNotice from '@/components/compute/VnfAccessNotice'
import VnfCredentials from '@/components/compute/VnfCredentials'
const mounting = { mocks: { $t: (s, p = {}) => s + JSON.stringify(p) }, stubs: { 'a-alert': { template: '<section><slot name="description" /></section>' } } }
test('renders web links with safe targets; never inserts credential or path HTML', () => {
  const attack = '"><img src=x onerror=alert(1)>'
  const wrapper = mount(VnfAccessNotice, { props: { resource: { templatetype: 'VNF', passwordenabled: true, vnfnics: [{ deviceid: 0, management: true }], nic: [{ deviceid: 0, ipaddress: '10.0.0.2' }], vnfdetails: { access_methods: 'http,https', http_path: '/ui', https_path: '/"><img>', username: attack, password: attack } } }, global: mounting })
  expect(wrapper.findAll('a')).toHaveLength(2)
  for (const a of wrapper.findAll('a')) { expect(a.attributes('target')).toBe('_blank'); expect(a.attributes('rel')).toBe('noopener noreferrer') }
  expect(wrapper.find('img').exists()).toBe(false)
  expect(wrapper.text()).not.toContain(attack)
  expect(wrapper.text()).toContain('message.vnf.credentials.in.template.vnf.details')
})
test('absent credential values never produce template credentials guidance', () => {
  const wrapper = mount(VnfAccessNotice, { props: { resource: { templatetype: 'VNF', nic: null, vnfdetails: {} } }, global: mounting })
  expect(wrapper.text()).not.toContain('message.vnf.credentials.in.template.vnf.details')
})
test('credential values render as text and only actual secrets request a password change', async () => {
  const attack = '<svg onload=alert(1)>'
  const w = mount(VnfCredentials, { props: { rows: [{ key: 'user', prefix: '', label: 'label.username', value: attack, secret: false }] }, global: mounting })
  expect(w.text()).toContain(attack); expect(w.find('svg').exists()).toBe(false); expect(w.find('p').exists()).toBe(false)
  await w.setProps({ rows: [{ key: 'password', prefix: '', label: 'label.password', value: attack, secret: true }] })
  expect(w.find('p').text()).toContain('message.vnf.credentials.change'); expect(w.find('svg').exists()).toBe(false)
})
