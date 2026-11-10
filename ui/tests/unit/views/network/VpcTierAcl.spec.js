// Licensed to the Apache Software Foundation (ASF) under one or more
// contributor license agreements. See NOTICE for copyright ownership.
// Licensed under the Apache License, Version 2.0 (the "License");
// http://www.apache.org/licenses/LICENSE-2.0 . Distributed AS IS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND.
import { mount, shallowMount, flushPromises } from '@vue/test-utils'
import { h, reactive, nextTick } from 'vue'
import Value from '@/views/network/VpcTierAclValue.vue'
import Tiers from '@/views/network/VpcTiersTab.vue'
import eventBus from '@/config/eventBus'
import { getAPI } from '@/api'
jest.mock('@/api', () => ({ getAPI: jest.fn() }))
const id = '8cc96409-b253-11f1-a895-0024814c313f'
const otherId = '3b64a0c2-b23b-11f1-990e-0024811f8935'
const link = { props: ['to'], render () { return h('a', { href: '#' + this.to.path }, this.$slots.default?.()) } }
const slot = { render () { return h('div', this.$slots.default?.()) } }
let wrappers
beforeEach(() => { wrappers = []; jest.clearAllMocks() })
afterEach(() => { wrappers.forEach(w => w.unmount()) })
function value (acl) { const w = mount(Value, { props: { acl }, global: { stubs: { RouterLink: link } } }); wrappers.push(w); return w }
test.each([undefined, null, '', ' ', 'undefined', 'null', '0', 0, true, {}, 'not-an-id', 'javascript:alert(1)', '../other', id + '/extra'])('missing or malformed ACL %p renders dash without link', aclid => { const w = value({ aclid, aclname: 'Must not become a link' }); expect(w.text()).toBe('—'); expect(w.find('a').exists()).toBe(false) })
test('valid ACL retains its route and display name', () => { const w = value({ aclid: id, aclname: 'default_allow' }); expect(w.get('a').attributes('href')).toBe('#/acllist/' + id); expect(w.text()).toBe('default_allow') })
test.each([undefined, null, '', '  ', 0])('valid ID with missing name %p displays readable UUID', aclname => { const w = value({ aclid: id, aclname }); expect(w.text()).toBe(id); expect(w.get('a').attributes('href')).toBe('#/acllist/' + id) })
test('same tier removes previous href when ACL disappears or changes', async () => { const w = value({ aclid: id, aclname: 'before' }); await w.setProps({ acl: {} }); expect(w.text()).toBe('—'); expect(w.find('a').exists()).toBe(false); await w.setProps({ acl: { aclid: otherId } }); expect(w.text()).toBe(otherId); expect(w.get('a').attributes('href')).toBe('#/acllist/' + otherId) })
const network = { id: 'tier', name: 'Tier', networkofferingid: 'offering', aclid: id, aclname: 'default_allow', service: [] }
const vpc = { id: 'vpc', name: 'VPC', projectid: 'project', network: [network] }
const drain = async () => { await flushPromises(); await nextTick(); await flushPromises() }
function lookup (command) {
  const rows = { listVirtualMachines: ['virtualmachine', []], listLoadBalancers: ['loadbalancer', []], listNetworkOfferings: ['networkoffering', [{ id: 'offering', supportsinternallb: false }]] }[command]
  return Promise.resolve({ [command.toLowerCase() + 'response']: { [rows[0]]: rows[1] } })
}
async function open () {
  getAPI.mockImplementation(lookup)
  const readState = reactive({ failed: false })
  const getters = reactive({ project: { id: 'project' }, userInfo: { id: 'user', roleid: 'role' }, token: 'session', apis: { listVirtualMachines: {}, listLoadBalancers: {}, listNetworkOfferings: {} } }); const route = reactive({ path: '/vpc/vpc', fullPath: '/vpc/vpc?tab=tier' })
  const w = shallowMount(Tiers, { props: { resource: { ...vpc, network: [{ ...network }, { ...network, id: 'missing', aclid: undefined, aclname: undefined }] } }, global: { provide: { parentFetchData: jest.fn(), resourceReadFailed: () => readState.failed }, mocks: { $t: k => k, $store: { getters }, $route: route, $notifyError: jest.fn() }, stubs: { RouterLink: link, VpcTierAclValue: Value, ASpin: slot, AList: slot, AListItem: slot } } }); wrappers.push(w); await drain(); return { w, getters, route, readState }
}
test('parent presents latest VPC ACLs with valid link and missing dash', async () => { const { w } = await open(); expect(w.findAll('.vpc-tier-acl-value a')).toHaveLength(1); expect(w.findAll('.vpc-tier-acl-value').map(x => x.text())).toEqual(['default_allow', '—']); expect(getAPI.mock.calls.some(([cmd]) => cmd === 'listNetworkACLLists')).toBe(false) })
test('new VPC payload removes cached ACL immediately even before VM/LB refresh completes', async () => { const { w } = await open(); let finish; getAPI.mockImplementationOnce(() => new Promise(resolve => { finish = resolve })); const pending = w.vm.fetchData(); await w.setProps({ resource: { ...vpc, network: [{ ...network, aclid: undefined, aclname: undefined }] } }); expect(w.find('.vpc-tier-acl-value a').exists()).toBe(false); finish({ listloadbalancersresponse: {} }); await pending; await drain(); expect(w.find('.vpc-tier-acl-value a').exists()).toBe(false) })
test('failed refresh hides old ACL links and successful update restores current values', async () => { const { w } = await open(); getAPI.mockRejectedValueOnce(Error('503 candidate outage')); await w.vm.fetchData(); await drain(); expect(w.vm.listRefreshFailed).toBe(true); expect(w.find('.vpc-tier-acl-value a').exists()).toBe(false); getAPI.mockImplementation(lookup); await w.vm.fetchData(); await drain(); expect(w.vm.listRefreshFailed).toBe(false); expect(w.get('.vpc-tier-acl-value a').attributes('href')).toBe('#/acllist/' + id) })
test('loading parent metadata suppresses links until the response is current', async () => { const { w } = await open(); await w.setProps({ loading: true }); expect(w.find('.vpc-tier-acl-value a').exists()).toBe(false); await w.setProps({ resource: { ...vpc, network: [{ ...network, aclid: otherId, aclname: '' }] }, loading: false }); await drain(); expect(w.get('.vpc-tier-acl-value a').text()).toBe(otherId) })
test('project switch-start invalidates ACLs before getters change and failed transition can recover', async () => { const { w } = await open(); eventBus.emit('project-switch-start'); await nextTick(); expect(w.find('.vpc-tier-acl-value a').exists()).toBe(false); eventBus.emit('project-switch-end'); await drain(); expect(w.find('.vpc-tier-acl-value a').exists()).toBe(true) })
test.each(['project', 'role', 'token', 'route'])('%s scope changes prevent stale ACL link reuse', async type => { const { w, getters, route } = await open(); let finish; getAPI.mockImplementationOnce(() => new Promise(resolve => { finish = resolve })); const pending = w.vm.fetchData(); if (type === 'project') getters.project.id = 'other'; if (type === 'role') getters.userInfo.roleid = 'other'; if (type === 'token') getters.token = 'other'; if (type === 'route') route.fullPath = '/vpc/other?tab=tier'; await w.setProps({ resource: { ...vpc, id: 'other', projectid: type === 'project' ? 'other' : 'project', network: [{ ...network, id: 'new-tier', aclid: otherId, aclname: '' }] } }); await drain(); finish({ listloadbalancersresponse: {} }); await pending; await drain(); const links = w.findAll('.vpc-tier-acl-value a'); expect(links.every(x => x.attributes('href') === '#/acllist/' + otherId)).toBe(true); expect(w.text()).not.toContain('default_allow') })

test('unchanged metadata success recovers from parent query failure without requiring object replacement', async () => { const { w, readState } = await open(); readState.failed = true; await nextTick(); expect(w.find('.vpc-tier-acl-value a').exists()).toBe(false); readState.failed = false; await nextTick(); expect(w.get('.vpc-tier-acl-value a').text()).toBe('default_allow') })
