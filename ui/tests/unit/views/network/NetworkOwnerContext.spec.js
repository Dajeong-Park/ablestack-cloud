// Licensed to the Apache Software Foundation (ASF) under one or more
// contributor license agreements. See the NOTICE file for ownership information.
// Licensed under the Apache License, Version 2.0; http://www.apache.org/licenses/LICENSE-2.0
// Distributed on an AS IS BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND.
import { reactive, nextTick } from 'vue'
import { mount, shallowMount, flushPromises } from '@vue/test-utils'
import NetworkOwnerContext from '@/components/network/NetworkOwnerContext.vue'
import CreateNetwork from '@/views/network/CreateNetwork.vue'
import { getAPI } from '@/api'
jest.mock('@/api', () => ({ getAPI: jest.fn(), postAPI: jest.fn() }))

const caller = { id: 'u', roletype: 'Admin', account: 'caller', domainid: 'root', domain: 'ROOT' }
function context (props = {}, project = {}) {
  return mount(NetworkOwnerContext, { props: { ready: true, ...props }, global: { mocks: { $store: { getters: { userInfo: caller, project } }, $route: { query: { projectid: 'untrusted-filter' } }, $t: key => key } } })
}
beforeEach(() => { getAPI.mockReset() })
test('personal ownership uses the signed-in account and ignores the list URL', () => {
  const wrapper = context()
  expect(wrapper.text()).toContain('caller'); expect(wrapper.text()).toContain('ROOT'); expect(wrapper.text()).not.toContain('untrusted-filter')
  expect(getAPI).not.toHaveBeenCalled()
})
test('selected project is named only when its ID matches the submitted owner', () => {
  const wrapper = context({ owner: { projectid: 'p' } }, { id: 'p', name: 'QA project' })
  expect(wrapper.text()).toContain('QA project'); wrapper.unmount()
  const other = context({ owner: { projectid: 'other' } }, { id: 'p', name: 'QA project' })
  expect(other.text()).not.toContain('QA project'); expect(other.text()).toContain('other')
})
test('VM owner stays fixed even when the active project is different', () => {
  const wrapper = context({ owner: { projectid: 'vm-p', domainid: 'vm-d' }, resource: { projectid: 'vm-p', project: 'VM project', domainid: 'vm-d', domain: 'VM domain' }, fixed: true }, { id: 'active-p', name: 'Other project' })
  expect(wrapper.text()).toContain('VM project'); expect(wrapper.text()).toContain('VM domain'); expect(wrapper.text()).not.toContain('Other project')
})
test('administrator owner labels follow the selected IDs and pending selections hide stale values', async () => {
  const wrapper = context({ owner: { projectid: 'chosen', domainid: 'd' }, labels: { projectId: 'chosen', projectLabel: 'Chosen project', domainId: 'd', domainLabel: 'Chosen domain' } })
  expect(wrapper.text()).toContain('Chosen project'); expect(wrapper.text()).toContain('Chosen domain')
  await wrapper.setProps({ ready: false })
  expect(wrapper.text()).not.toContain('Chosen project'); expect(wrapper.find('[role="status"]').text()).toBe('message.network.owner.select')
})
test('Shared domain scope identifies system ownership separately from sharing scope', () => {
  const wrapper = context({ owner: { acltype: 'domain', domainid: 'child', subdomainaccess: true }, labels: { domainId: 'child', domainLabel: 'Shared domain' } })
  expect(wrapper.text()).toContain('label.network.owner.system'); expect(wrapper.text()).toContain('Shared domain'); expect(wrapper.text()).toContain('label.yes'); expect(wrapper.text()).not.toContain('caller')
})
test('Shared all scope shows system ownership and all users without a guessed domain', () => {
  const wrapper = context({ owner: { acltype: 'domain' } })
  expect(wrapper.text()).toContain('label.all'); expect(wrapper.text()).toContain('label.network.owner.system'); expect(wrapper.text()).not.toContain('ROOT')
})
function creator () {
  const getters = reactive({ userInfo: caller, project: { id: 'p', name: 'Project' } })
  getAPI.mockResolvedValue({ listzonesresponse: { zone: [{ id: 'z', networktype: 'Advanced', securitygroupsenabled: false }] } })
  const wrapper = shallowMount(CreateNetwork, {
    props: { resource: {} },
    global: {
      mocks: { $store: { getters }, $route: reactive({ name: 'guestnetwork', path: '/guestnetwork', query: {} }), $t: key => key },
      stubs: { 'a-spin': { template: '<div><slot /></div>' }, 'a-tabs': { template: '<div><slot /></div>' }, 'a-tab-pane': { template: '<div><slot /></div>' } }
    }
  })
  return { wrapper, getters }
}
test('project switch closes the form and makes all child forms inactive before another submit', async () => {
  const { wrapper, getters } = creator(); await flushPromises()
  getters.project = { id: 'new-project' }; await nextTick()
  expect(wrapper.emitted('close-action')).toHaveLength(1); expect(wrapper.vm.scopeInvalidated).toBe(true)
  for (const name of ['CreateIsolatedNetworkForm', 'CreateL2NetworkForm', 'CreateSharedNetworkForm']) expect(wrapper.findComponent({ name }).props('active')).toBe(false)
  const submit = jest.fn(); wrapper.vm.$refs.isolated.handleSubmit = submit; wrapper.vm.submit(); expect(submit).not.toHaveBeenCalled()
})
test('a list filter change never changes ownership or closes a valid form', async () => {
  const { wrapper } = creator(); await flushPromises(); wrapper.vm.$route.query.projectid = 'another-filter'; await nextTick()
  expect(wrapper.vm.scopeInvalidated).toBe(false); expect(wrapper.emitted('close-action')).toBeUndefined(); wrapper.unmount()
})
