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

import { shallowMount, flushPromises } from '@vue/test-utils'
import { h, reactive } from 'vue'
import Routes from '@/views/network/StaticRoutesTab'
import VpcTab from '@/views/network/VpcTab'
import { getAPI, postAPI } from '@/api'
jest.mock('@/api', () => ({ getAPI: jest.fn(), postAPI: jest.fn() }))
const wrappers = []
let getters, route, polls
const slot = { render () { return h('div', this.$slots.default?.()) } }
beforeEach(() => {
  jest.clearAllMocks()
  getters = reactive({ apis: Object.fromEntries(['createTags', 'listTags', 'createNetworkACLList', 'listNetworkACLLists'].map(k => [k, {}])), project: {}, userInfo: { id: 'admin', roleid: 'admin-role' } })
  route = reactive({ fullPath: '/vpc/original?tab=acl', path: '/vpc/original', query: { tab: 'acl' } })
  polls = jest.fn()
  getAPI.mockImplementation(api => Promise.resolve({ [api.toLowerCase() + 'response']: {} }))
  postAPI.mockImplementation(api => Promise.resolve({ [api.toLowerCase() + 'response']: { jobid: 'job' } }))
})
afterEach(() => wrappers.splice(0).forEach(w => { if (w.exists()) w.unmount() }))
async function open (kind) {
  const w = shallowMount(kind === 'tag' ? Routes : VpcTab, {
    props: { resource: { id: 'original', account: 'owner', domainid: 'domain' } },
    global: {
      mocks: { $t: k => k, $store: { getters, state: { user: { token: 'session' }, app: { device: 'desktop' } } }, $route: route, $router: { replace: jest.fn(), push: jest.fn() }, $pollJob: polls, $notifyError: jest.fn() },
      stubs: { ASpin: slot, ATabs: slot, ATabPane: slot, MoldDialog: slot, AForm: slot, AFormItem: slot, AInput: true, MoldDialogActions: slot }
    }
  })
  wrappers.push(w)
  await flushPromises()
  if (kind === 'tag') { w.vm.selectedRule = { id: 'original-route' }; w.vm.tagsModalVisible = true } else w.vm.handleOpenModals('networkAcl')
  return w
}
test.each(['tag', 'acl'].flatMap(kind => ['project', 'resource', 'unmount'].map(change => [kind, change])))('%s validation cannot submit after %s changes', async (kind, change) => {
  const w = await open(kind)
  let finish
  w.vm.formRef.value = { validate: () => new Promise(resolve => { finish = resolve }), scrollToField: jest.fn() }
  Object.assign(w.vm.form, { name: 'original-draft', description: 'original', key: 'original-key', value: 'original-value' })
  const submit = kind === 'tag' ? w.vm.handleAddTag() : w.vm.handleNetworkAclFormSubmit()
  if (change === 'project') getters.project = { id: 'other-project' }
  else if (change === 'resource') await w.setProps({ resource: { id: 'other-vpc', account: 'owner', domainid: 'domain' } })
  else w.unmount()
  await flushPromises()
  finish()
  await submit
  expect(postAPI).not.toHaveBeenCalled()
})
test('late ACL job callbacks cannot close a new project dialog or issue a refresh there', async () => {
  const w = await open('acl')
  w.vm.formRef.value = { validate: () => Promise.resolve(), scrollToField: jest.fn() }
  Object.assign(w.vm.form, { name: 'old-acl' })
  await w.vm.handleNetworkAclFormSubmit()
  expect(postAPI).toHaveBeenCalledTimes(1)
  const job = polls.mock.calls[0][0]
  getters.project = { id: 'other-project' }
  await flushPromises()
  w.vm.handleOpenModals('networkAcl')
  const refresh = jest.spyOn(w.vm, 'fetchAclList')
  job.successMethod()
  job.errorMethod()
  expect(w.vm.modals.networkAcl).toBe(true)
  expect(w.vm.aclError).toBe('')
  expect(refresh).not.toHaveBeenCalled()
})
test.each(['tag', 'acl'])('%s submits exactly once when validation completes in the same context', async kind => {
  const w = await open(kind)
  w.vm.formRef.value = { validate: () => Promise.resolve(), scrollToField: jest.fn() }
  Object.assign(w.vm.form, { name: 'same-acl', key: 'same-key', value: 'same-value' })
  await (kind === 'tag' ? w.vm.handleAddTag() : w.vm.handleNetworkAclFormSubmit())
  expect(postAPI).toHaveBeenCalledTimes(1)
  expect(postAPI.mock.calls[0][1][kind === 'tag' ? 'resourceIds' : 'vpcid']).toBe(kind === 'tag' ? 'original-route' : 'original')
})
