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

import { mount } from '@vue/test-utils'
import { h } from 'vue'
import Cell from '@/components/widgets/KubernetesIsoListCell'
import KeyboardTooltip from '@/components/widgets/KeyboardTooltip'
const id = '11111111-1111-4111-8111-111111111111'
const slot = { props: ['title'], render () { return h('div', { 'data-tooltip': this.title }, this.$slots.default?.()) } }
function cell (field, record, canReadZone = false) {
  return mount(Cell, {
    props: { resource: record, field },
    global: {
      mocks: {
        $t: k => k,
        $store: { getters: { apis: canReadZone ? { listZones: {} } : {}, userInfo: { roletype: 'User' } } },
        $router: { resolve: () => ({ matched: [{}] }) }
      },
      stubs: {
        KeyboardTooltip: slot,
        'a-tooltip': slot,
        'a-badge': { props: ['text'], render () { return h('span', this.text) } },
        'router-link': { props: ['to'], render () { return h('a', { href: this.to }, this.$slots.default?.()) } }
      }
    }
  })
}

test('auxiliary values keep zero, a focus target and the complete unshortened tooltip', () => {
  const w = cell('mincpunumber', { mincpunumber: 0 })
  expect(w.text()).toBe('0')
  expect(w.find('[tabindex="0"]').exists()).toBe(true)
  expect(w.attributes('data-tooltip')).toBe('0')
  w.unmount()
})
test('Zone tooltip keeps the full identity while navigation still requires its independent grant', () => {
  const record = { zoneid: id, zonename: 'Long-Zone-'.repeat(20) }
  const denied = cell('zonename', record)
  expect(denied.find('a').exists()).toBe(false)
  expect(denied.attributes('data-tooltip')).toContain(record.zonename)
  expect(denied.attributes('data-tooltip')).toContain(id)
  denied.unmount()
  const allowed = cell('zonename', record, true)
  expect(allowed.find('a').attributes('href')).toContain(id)
  expect(allowed.find('a').attributes('tabindex')).toBe('0')
  allowed.unmount()
})
test('a version Disabled value does not manufacture an ISO-ready result', () => {
  const version = cell('state', { state: 'Disabled', isostate: 'Ready' })
  expect(version.text()).toContain('label.kubernetes.iso.version.disabled'); version.unmount()
  const iso = cell('isostate', { state: 'Disabled', isostate: 'Ready' })
  expect(iso.text()).toContain('label.kubernetes.iso.availability.unqueried')
  expect(iso.attributes('data-tooltip')).toContain('Ready'); iso.unmount()
})

test('focus tooltip preserves the native link and unrelated keys, then Escape hides it without replacing the target', async () => {
  const keydown = jest.fn()
  const w = mount(KeyboardTooltip, {
    props: { title: 'Full unshortened name' },
    slots: { default: () => h('a', { href: '#detail', onKeydown: keydown }, 'Full name') },
    global: {
      stubs: {
        ATooltip: {
          name: 'ATooltip',
          props: ['visible', 'title'],
          emits: ['update:visible'],
          render () { return h('div', { 'data-visible': String(this.visible), 'data-title': this.title }, this.$slots.default?.()) }
        }
      }
    }
  })
  const tooltip = w.findComponent({ name: 'ATooltip' })
  tooltip.vm.$emit('update:visible', true)
  await w.vm.$nextTick()
  const link = w.find('a').element
  await w.find('a').trigger('keydown', { key: 'Tab' })
  expect(w.attributes('data-visible')).toBe('true')
  await w.find('a').trigger('keydown', { key: 'Escape' })
  expect(w.attributes('data-visible')).toBe('false')
  expect(w.find('a').element).toBe(link)
  expect(w.find('a').attributes('href')).toBe('#detail')
  expect(keydown).toHaveBeenCalledTimes(2)
  w.unmount()
})
