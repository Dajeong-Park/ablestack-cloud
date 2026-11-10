// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements. See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership. The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License. You may obtain a copy of the License at
//
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied. See the License for the
// specific language governing permissions and limitations
// under the License.

import { mount } from '@vue/test-utils'
import GuestNetworkSummary from '@/components/view/GuestNetworkSummary.vue'

const render = props => mount(GuestNetworkSummary, {
  props,
  global: {
    mocks: { $t: key => key, $toLocaleDate: value => value },
    stubs: {
      CopyLabel: { props: ['label', 'tooltip', 'copyValue'], template: '<a :title="tooltip" :data-copy="copyValue || label">{{ label }}</a>' },
      'a-tooltip': { template: '<div><slot /></div>' },
      'a-popover': { template: '<div><slot /><section class="details"><slot name="content" /></section></div>' },
      'a-button': { template: '<button><slot /></button>' },
      'a-tag': { template: '<span><slot /></span>' }
    }
  }
})

describe('Compact VM IP summary', () => {
  it('shows only the representative address and count outside the details', () => {
    const wrapper = render({
      cloudAddress: '10.0.0.1',
      summary: {
        status: 'PARTIAL',
        observed: '2026-09-15',
        ipv4addresses: ['10.0.0.2/24', '10.0.0.3/24'],
        ipv6addresses: ['2001:db8::1/64']
      }
    })
    expect(wrapper.find('.primary-address').text()).toBe('10.0.0.1')
    expect(wrapper.find('button').text()).toBe('+3')
    expect(wrapper.find('.summary-line').findAll('.ant-tag')).toHaveLength(0)
    expect(wrapper.find('.address-popover-metadata').text()).toContain('label.cloud.ip')
    expect(wrapper.find('.address-popover-metadata').text()).toContain('label.guest.network.status.partial')
    expect(wrapper.find('.primary-address a').attributes('title')).toContain('2026-09-15')
    expect(wrapper.findAll('.address-popover-row')).toHaveLength(3)
    expect(wrapper.find('.address-popover-header a').attributes('data-copy')).toBe('10.0.0.2/24\n10.0.0.3/24\n2001:db8::1/64')
  })
  it('counts unique additional addresses, ignoring prefixes and IPv6 case', () => {
    const wrapper = render({
      summary: {
        representativeaddress: '2001:DB8::1',
        representativeprefix: 64,
        representativefamily: 'IPv6',
        ipv6addresses: ['2001:db8::1/64', '2001:DB8::1/128', '2001:db8::2/64']
      }
    })
    expect(wrapper.find('button').text()).toBe('+1')
    expect(wrapper.findAll('.address-popover-row')).toHaveLength(2)
    expect(wrapper.find('.primary-address a').attributes('data-copy')).toBe('2001:DB8::1/64')
  })
  it('keeps a single IP copyable without a +0 button and exposes status in its tooltip', () => {
    const wrapper = render({
      summary: {
        representativeaddress: '10.0.0.1', ipv4addresses: ['10.0.0.1/24'], status: 'STALE'
      }
    })
    expect(wrapper.find('button').exists()).toBe(false)
    expect(wrapper.find('.primary-address a').attributes('title')).toContain('message.guest.network.status.stale')
  })
  it('uses an active default cloud NIC for fallback', () => {
    const wrapper = render({
      cloudAddress: '10.0.0.99',
      cloudNics: [
        { isdefault: true, ipaddress: '10.0.0.1', enabled: false },
        { isdefault: true, ipaddress: '10.0.0.2', enabled: true }
      ]
    })
    expect(wrapper.find('.primary-address').text()).toBe('10.0.0.2')
  })
  it('uses enabled as the authority when retired linkstate metadata disagrees', () => {
    const wrapper = render({
      cloudNics: [
        { isdefault: true, ipaddress: '10.0.0.1', enabled: true, linkstate: false },
        { isdefault: true, ipaddress: '10.0.0.2', enabled: false, linkstate: true }
      ]
    })
    expect(wrapper.find('.primary-address').text()).toBe('10.0.0.1')
  })
  it('shows a dash when no address is available', () => {
    const wrapper = render({ summary: { status: 'UNAVAILABLE' } })
    expect(wrapper.text()).toBe('-')
    expect(wrapper.find('button').exists()).toBe(false)
  })
  it('retains all collected addresses when the representative is not in the collection', () => {
    const wrapper = render({ summary: { representativeaddress: '10.0.0.1', ipv4addresses: ['10.0.0.2'] } })
    expect(wrapper.find('button').text()).toBe('+1')
  })
  it('updates the address and count on a background refresh', async () => {
    const wrapper = render({ cloudAddress: '10.0.0.1' })
    await wrapper.setProps({ summary: { representativeaddress: '10.0.0.2', ipv4addresses: ['10.0.0.2', '10.0.0.3'] } })
    expect(wrapper.find('.primary-address').text()).toBe('10.0.0.2')
    expect(wrapper.find('button').text()).toBe('+1')
    await wrapper.setProps({ summary: { representativeaddress: '10.0.0.2', ipv4addresses: ['10.0.0.2'] } })
    expect(wrapper.find('button').exists()).toBe(false)
  })
})
