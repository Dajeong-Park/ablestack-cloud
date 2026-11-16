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
import { createRouter, createMemoryHistory } from 'vue-router'
import Value from '@/components/widgets/PublicIpDetailValue'
import TooltipButton from '@/components/widgets/TooltipButton'
import DetailsTab from '@/components/view/DetailsTab'
import { publicIpField, publicIpDetailFields, validatePublicIpDetail } from '@/utils/publicIpDetails'
import { getAPI } from '@/api'
jest.mock('@/api', () => ({ getAPI: jest.fn(), postAPI: jest.fn(), callAPI: jest.fn() }))
const id = '11111111-1111-4111-8111-111111111111'
const other = '22222222-2222-4222-8222-222222222222'
async function render (resource, field, apis = { listNetworks: {}, listVPCs: {} }) {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:pathMatch(.*)*', component: { template: '<div />' } }] })
  await router.push('/'); await router.isReady()
  return mount(Value, { props: { resource, field }, global: { plugins: [router], mocks: { $store: { getters: { apis } }, $t: k => k, $message: { success: jest.fn(), error: jest.fn() } }, stubs: { TooltipButton: { name: 'TooltipButton', props: ['copyResource'], template: '<button :data-copy="copyResource" />' } } } })
}
beforeEach(() => jest.clearAllMocks())
test('untagged is a real VLAN value with raw source, not a missing allocation', async () => {
  const w = await render({ vlanname: 'vlan://untagged' }, 'vlanname')
  expect(w.text()).toContain('label.public.ip.vlan.untagged'); expect(w.text()).toContain('vlan://untagged'); expect(w.find('button,a').exists()).toBe(false)
  await w.setProps({ resource: {} }); expect(w.text()).toBe('label.public.ip.value.notprovided')
  await w.setProps({ resource: { vlanname: null } }); expect(w.text()).toBe('—'); w.unmount()
})
test.each(['123', 'vlan://123', 'vlan://4094'])('a tagged VLAN %s remains distinct from its range UUID', async vlanname => {
  const w = await render({ vlanname }, 'vlanname'); expect(w.text()).toContain(vlanname.includes('://') ? vlanname.split('://')[1] : vlanname); expect(w.find('a,button').exists()).toBe(false); w.unmount()
})
test('unknown provider text is rendered literally without HTML or field lookups', async () => {
  const w = await render({ vlanname: '<img src=x onerror=alert(1)> vxlan://provider/long' }, 'vlanname')
  expect(w.text()).toContain('<img src=x'); expect(w.find('img').exists()).toBe(false); expect(getAPI).not.toHaveBeenCalled(); w.unmount()
})
test('VLAN range UUID is copyable and never a guessed route or a VLAN tag', async () => {
  const w = await render({ vlanid: id }, 'vlanid'); expect(w.get('button').attributes('data-copy')).toBe(id); expect(w.find('a').exists()).toBe(false); expect(w.text()).toBe(id); w.unmount()
})
test('public source network has a name and copyable ID without a guest-network anchor', async () => {
  const w = await render({ networkid: id, networkname: 'Public source', associatednetworkid: other, associatednetworkname: 'Guest' }, 'networkid')
  expect(w.text()).toContain('Public source'); expect(w.text()).toContain(id); expect(w.find('a').exists()).toBe(false); expect(w.get('button').attributes('data-copy')).toBe(id); expect(getAPI).not.toHaveBeenCalled(); w.unmount()
})
test.each([['associatednetworkname', 'associatednetworkid', '/guestnetwork/'], ['vpcname', 'vpcid', '/vpc/']])('%s links only its matching identity and can use ID-only responses', async (field, key, path) => {
  const w = await render({ [key]: id }, field); expect(w.get('a').attributes('href')).toBe(path + id)
  await w.setProps({ resource: { [field]: 'Name only' } }); expect(w.text()).toBe('Name only'); expect(w.find('a,button').exists()).toBe(false)
  await w.setProps({ resource: {} }); expect(w.text()).toBe('—'); expect(w.find('a,button').exists()).toBe(false); w.unmount()
})
test.each([undefined, null, '', ' ', 'undefined', 'null', 'NaN', {}, [], '../network', 'a/b', 'a?x=1', '<x>'])('invalid reference %p has no anchor or empty copy target', async value => {
  const w = await render({ associatednetworkid: value, associatednetworkname: 'Guest' }, 'associatednetworkname'); expect(w.text()).toBe('Guest'); expect(w.find('a,button').exists()).toBe(false); w.unmount()
})
test('a missing route permission uses plain text but never queries a hidden target', async () => {
  const w = await render({ associatednetworkid: id, associatednetworkname: 'Guest' }, 'associatednetworkname', {})
  expect(w.find('a').exists()).toBe(false); expect(getAPI).not.toHaveBeenCalled(); w.unmount()
})
test('detail labels share public IP semantics and other network VLAN labels stay unchanged', () => {
  const c = { $route: { meta: { name: 'publicip' } }, detailsTitles: { vlan: 'vlan' } }
  expect(DetailsTab.methods.getDetailTitle.call(c, 'vlanid')).toBe('label.public.ip.vlan.range.id')
  expect(DetailsTab.methods.getDetailTitle.call(c, 'networkid')).toBe('label.public.ip.network.source')
  c.$route.meta.name = 'guestnetwork'; expect(DetailsTab.methods.getDetailTitle.call(c, 'vlan')).toBe('label.vlan')
  expect(publicIpDetailFields).not.toContain('vlan')
})
test('redacted responses do not reconstruct VLAN fields from any other identity', () => {
  const ip = { networkid: id, associatednetworkid: other }
  expect(publicIpField(ip, 'vlanname').missing).toBe(true); expect(publicIpField(ip, 'vlanid').missing).toBe(true)
  expect(() => validatePublicIpDetail({ listpublicipaddressesresponse: { count: 1, publicipaddress: [{ id }] } }, id)).not.toThrow()
  expect(() => validatePublicIpDetail({ listpublicipaddressesresponse: { count: 1, publicipaddress: [{ id: other }] } }, id)).toThrow()
})

test('copy messages follow browser results rather than a click', async () => {
  const w = await render({ vlanid: id }, 'vlanid')
  const button = w.findComponent({ name: 'TooltipButton' })
  button.vm.$emit('onClick'); expect(w.vm.$message.success).not.toHaveBeenCalled(); expect(w.vm.$message.error).not.toHaveBeenCalled()
  button.vm.$emit('copy-error', { text: id }); expect(w.vm.$message.error).toHaveBeenCalledWith('message.public.ip.copy.failed'); expect(w.vm.$message.success).not.toHaveBeenCalled()
  button.vm.$emit('copy-success', { text: id }); expect(w.vm.$message.success).toHaveBeenCalledWith('label.copied.clipboard'); w.unmount()
})
test.each(['success', 'error'])('the shared copy button forwards the actual clipboard %s callback', async result => {
  const handlers = {}
  const w = mount(TooltipButton, { props: { copyResource: id }, global: { stubs: { ATooltip: { template: '<div><slot /></div>' }, AButton: { emits: ['click'], template: '<button @click="$emit(\'click\')"><slot /></button>' } }, directives: { clipboard: { mounted: (el, binding) => { handlers[binding.arg] = binding.value } } } } })
  await w.get('button').trigger('click'); expect(w.emitted('onClick')).toHaveLength(1); expect(w.emitted('copy-' + result)).toBeUndefined()
  const event = { text: id }; handlers[result](event); expect(w.emitted('copy-' + result)).toEqual([[event]]); w.unmount()
})
