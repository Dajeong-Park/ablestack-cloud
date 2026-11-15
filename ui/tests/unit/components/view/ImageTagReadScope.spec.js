// Licensed to the Apache Software Foundation (ASF) under one or more
// contributor license agreements. See the NOTICE file distributed with this
// work for additional information regarding copyright ownership. The ASF
// licenses this file to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance with the License.
// You may obtain a copy at http://www.apache.org/licenses/LICENSE-2.0 .
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
// WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
// License for the specific language governing permissions and limitations.
import { mount, flushPromises } from '@vue/test-utils'
import ResourceTags from '@/components/view/ResourceTags.vue'
import { getAPI, postAPI } from '@/api'
import { clearResourceTagOperations } from '@/utils/resourceTags'
jest.mock('@/api', () => ({ getAPI: jest.fn(), postAPI: jest.fn() }))
const id = '11111111-1111-4111-8111-111111111111'
let wrapper
beforeEach(() => { clearResourceTagOperations(sessionStorage); sessionStorage.clear(); jest.clearAllMocks(); getAPI.mockResolvedValue({ listtagsresponse: { count: 0 } }) })
afterEach(() => { if (wrapper) wrapper.unmount(); clearResourceTagOperations(sessionStorage) })
test.each([['ISO', {}], ['Template', {}], ['ISO', { id: 'active-project' }], ['Template', { id: 'active-project' }]])('%s read-only tag widget uses the actor view %j instead of owner membership', async (type, project) => {
  const getters = { userInfo: { id: 'recipient', account: 'recipient', domainid: 'domain', roletype: 'User' }, project, apis: { listTags: {} } }
  wrapper = mount(ResourceTags, {
    props: { resource: { id, projectid: 'owner-project' }, resourceType: type, canEdit: false },
    global: {
      mocks: { $store: { getters, state: { user: { token: 'session' } } }, $route: { fullPath: '/image/' + id, params: { id }, meta: { resourceType: type, name: type === 'ISO' ? 'iso' : 'template' } }, $t: k => k },
      stubs: { ASpin: { template: '<div><slot /></div>' }, AAlert: true, AButton: true, ATag: true, MoldDialog: true }
    }
  })
  await flushPromises()
  const call = getAPI.mock.calls.find(([command]) => command === 'listTags')
  expect(call).toBeTruthy()
  expect(call[1]).toEqual(expect.objectContaining(project.id ? { projectid: 'active-project' } : { ignoreproject: true }))
  expect(call[1].projectid).not.toBe('owner-project')
  expect(wrapper.vm.readError).toBe('')
  expect(postAPI).not.toHaveBeenCalled()
})
