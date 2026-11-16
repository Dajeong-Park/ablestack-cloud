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

import { reactive, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { publicIpState, publicIpBoolean, publicIpAllocated, publicIpFilterLabels } from '@/utils/publicIpPresentation'
import { publicIpField, publicIpDetailFields } from '@/utils/publicIpDetails'
import ReservePublicIP from '@/views/network/ReservePublicIP'
import PublicIpStatus from '@/components/widgets/PublicIpStatus'
import PublicIpDetailValue from '@/components/widgets/PublicIpDetailValue'
import PublicIpReleaseSummary from '@/components/view/PublicIpReleaseSummary'
import SearchFilter from '@/components/view/SearchFilter'
import Status from '@/components/widgets/Status'
import DetailsTab from '@/components/view/DetailsTab'
import AutogenView from '@/views/AutogenView'
import ko from '@/../public/locales/ko_KR.json'
import en from '@/../public/locales/en.json'

const states = ['Free', 'Reserved', 'Allocated', 'Allocating', 'Releasing']
const labels = { ko: ['가용', '예약', '할당됨', '할당 중', '해제 중'], en: states }
const id = '11111111-1111-4111-8111-111111111111'
const badges = { props: ['text', 'status', 'color'], template: '<span class="badge" :data-status="status">{{ text }}</span>' }
const stubs = { ATooltip: { template: '<span><slot /></span>' }, ABadge: badges, ADescriptions: { template: '<dl><slot /></dl>' }, ADescriptionsItem: { props: ['label'], template: '<div><dt>{{ label }}</dt><dd><slot /></dd></div>' }, TooltipButton: true }
function options (locale = 'ko', route = 'publicip') { const dict = locale === 'ko' ? ko : en; return { mocks: { $t: k => dict[k] || k, $route: { path: '/' + route, meta: { name: route } }, $store: { getters: { apis: {} } }, $toLocaleDate: jest.fn(v => 'formatted:' + v) }, stubs } }

test.each(['ko', 'en'])('all five Public IP states use the same %s labels without changing raw values', locale => {
  const original = [...states]
  states.forEach((state, index) => { const w = mount(PublicIpStatus, { props: { value: state }, global: options(locale) }); expect(w.text()).toBe(labels[locale][index]); expect(w.attributes('data-public-ip-state')).toBe(state); expect(publicIpFilterLabels[state.toLowerCase()]).toBe(publicIpState(state).key); w.unmount() })
  expect(states).toEqual(original)
})
test.each([null, undefined, '', '  '])('a missing state %p is never labelled Free or success', value => {
  const w = mount(PublicIpStatus, { props: { value }, global: options() }); expect(w.text()).toBe(ko['label.public.ip.value.notprovided']); expect(w.get('.badge').attributes('data-status')).toBe('default'); w.unmount()
})
test.each(['Running', 'provider-state', false, 0])('an unknown state %p remains neutral and exposes its raw value', value => {
  const w = mount(PublicIpStatus, { props: { value }, global: options() }); expect(w.text()).toContain(ko['label.public.ip.state.unknown']); expect(w.get('.public-ip-status__raw').text()).toContain(String(value)); expect(w.get('.badge').attributes('data-status')).toBe('default'); w.unmount()
})
test('untrusted state text is escaped and cannot create elements', () => { const raw = '<img src=x onerror=alert(1)>' + 'x'.repeat(400); const w = mount(PublicIpStatus, { props: { value: raw }, global: options() }); expect(w.text()).toContain(raw); expect(w.find('img').exists()).toBe(false); w.unmount() })
test.each(['issystem', 'issourcenat', 'isstaticnat'])('%s distinguishes false/true, missing and malformed responses', field => {
  expect(publicIpBoolean({ [field]: false }, field)).toEqual({ label: 'label.no' }); expect(publicIpBoolean({ [field]: true }, field)).toEqual({ label: 'label.yes' }); expect(publicIpBoolean({}, field)).toEqual({ missing: true }); expect(publicIpBoolean({ [field]: null }, field)).toEqual({ missing: true }); expect(publicIpBoolean({ [field]: 'false' }, field)).toEqual({ label: 'label.unknown', raw: 'false' }); expect(publicIpDetailFields).toContain(field)
})
test('display preference retains its specific wording and never treats malformed false as false', () => { expect(publicIpField({ fordisplay: false }, 'fordisplay')).toEqual({ label: 'label.public.ip.display.hidden' }); expect(publicIpField({ fordisplay: true }, 'fordisplay')).toEqual({ label: 'label.public.ip.display.visible' }); expect(publicIpField({}, 'fordisplay')).toEqual({ missing: true }); expect(publicIpField({ fordisplay: 'false' }, 'fordisplay').label).toBe('label.unknown') })
test.each(['2026-11-16T07:17:03+0000', '2026-11-16T16:17:03+0900', '2026-11-16T07:17:03Z'])('allocated time %s is passed to the VM common formatter once, with its original offset', allocated => {
  const global = options(); const w = mount(PublicIpDetailValue, { props: { resource: { allocated }, field: 'allocated' }, global }); expect(w.text()).toBe('formatted:' + allocated); expect(global.mocks.$toLocaleDate).toHaveBeenCalledTimes(1); expect(global.mocks.$toLocaleDate).toHaveBeenCalledWith(allocated); expect(publicIpAllocated(allocated)).toEqual({ date: allocated }); w.unmount()
})
test.each([null, undefined, '', 'not-a-date'])('absent/invalid allocation %p is not sent to the date formatter', allocated => {
  const global = options(); const w = mount(PublicIpDetailValue, { props: { resource: { allocated }, field: 'allocated' }, global }); expect(global.mocks.$toLocaleDate).not.toHaveBeenCalled(); expect(w.text()).toContain(allocated === 'not-a-date' ? ko['label.unknown'] : '—'); w.unmount()
})
test('Public IP details use the private title while VM and general state consumers retain their labels', () => {
  expect(DetailsTab.methods.getDetailTitle.call({ $route: { meta: { name: 'publicip' } } }, 'allocated')).toBe('label.public.ip.allocated')
  const w = mount(Status, { props: { text: 'Free', displayText: true }, global: options('ko', 'volume') }); expect(w.text()).toBe(ko['state.free']); expect(w.text()).not.toBe(ko['label.public.ip.state.free']); w.unmount()
})
test('release summary binds an account or project and domain to the exact address, with translated state', () => {
  const resources = [{ id, ipaddress: '192.0.2.10', state: 'Reserved', account: '<owner>', domain: 'D' }, { id: 'project-ip', ipaddress: '192.0.2.11', state: 'Reserved', projectid: 'project-id', project: 'P', domainid: 'domain-id' }]; const w = mount(PublicIpReleaseSummary, { props: { resources }, global: options() }); expect(w.text()).toContain('192.0.2.10'); expect(w.text()).toContain(id); expect(w.text()).toContain('예약'); expect(w.text()).toContain('<owner>'); expect(w.text()).toContain('P'); expect(w.text()).toContain('domain-id'); expect(w.find('owner').exists()).toBe(false); w.unmount()
})
test('the release dialog extension is scoped to Reserved Public IP release, not disassociation or other menus', () => {
  const check = (name, api) => AutogenView.computed.publicIpReleaseDialog.call({ $route: { meta: { name } }, currentAction: { api } }); expect(check('publicip', 'releaseIpAddress')).toBe(true); expect(check('vm', 'releaseIpAddress')).toBe(false); expect(check('publicip', 'disassociateIpAddress')).toBe(false); expect(check('publicip', 'updateIpAddress')).toBe(false)
})

test('language changes translate Public IP chips and column titles from raw keys without altering the request or other menus', () => {
  let locale = 'ko'; const t = k => (locale === 'ko' ? ko : en)[k] || k
  const context = { apiName: 'listPublicIpAddresses', $t: t }; const chip = { key: 'state', value: 'old text', rawValue: 'Reserved' }; const columns = [{ key: 'allocated', title: 'old title', dataIndex: 'allocated' }, { key: 'state', title: 'old state' }]
  const columnContext = { $route: { meta: { name: 'publicip' } }, $t: t }
  expect(SearchFilter.methods.publicIpFilterValue.call(context, chip)).toBe('예약'); expect(AutogenView.methods.localizePublicIpColumns.call(columnContext, columns)[0].title).toBe('할당 일시')
  locale = 'en'; expect(SearchFilter.methods.publicIpFilterValue.call(context, chip)).toBe('Reserved'); expect(AutogenView.methods.localizePublicIpColumns.call(columnContext, columns)[0].title).toBe('Allocated at'); expect(columns[0].title).toBe('old title'); expect(chip.rawValue).toBe('Reserved')
  expect(AutogenView.methods.localizePublicIpColumns.call({ $route: { meta: { name: 'vm' } } }, columns)).toBe(columns)
})
test('an existing Public IP date rerenders for a locale change even though the common formatter reads local storage', async () => {
  const locale = reactive({ locale: 'ko_KR' }); let storedLocale = 'ko_KR'; const global = options(); global.mocks.$i18n = locale; global.mocks.$toLocaleDate = date => storedLocale + ':' + date
  const w = mount(PublicIpDetailValue, { props: { resource: { allocated: '2026-11-16T07:17:03Z' }, field: 'allocated' }, global }); expect(w.attributes('lang')).toBe('ko-KR'); storedLocale = 'en'; locale.locale = 'en'; await nextTick(); expect(w.attributes('lang')).toBe('en'); expect(w.text()).toBe('en:2026-11-16T07:17:03Z'); w.unmount()
})

test('column selection controls retain their icon-only title during a Public IP language change', () => {
  const utility = { key: 'filtercolumn', dataIndex: 'filtercolumn', title: '', customFilterDropdown: true, width: 5 }; const t = jest.fn(k => k)
  expect(AutogenView.methods.localizePublicIpColumns.call({ $route: { meta: { name: 'publicip' } }, $t: t }, [utility])[0]).toBe(utility)
  expect(t).not.toHaveBeenCalled()
})

test('the unresolved reservation summary localizes the observed state and retains an unknown raw value', () => {
  const context = { operation: { actual: { ipaddress: '192.0.2.10', state: 'Free', account: 'owner', domain: 'D' } }, $t: key => ko[key] || key }
  expect(ReservePublicIP.computed.observedOwner.call(context)).toBe('192.0.2.10 / 가용 / owner / D')
  context.operation.actual.state = 'ProviderFuture'; const value = ReservePublicIP.computed.observedOwner.call(context); expect(value).toContain('확인 불가'); expect(value).toContain('ProviderFuture')
})
