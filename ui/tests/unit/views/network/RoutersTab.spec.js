// Licensed to the Apache Software Foundation (ASF) under one or more
// contributor license agreements. See the NOTICE file for ownership information.
// Licensed under the Apache License, Version 2.0; http://www.apache.org/licenses/LICENSE-2.0
// Distributed on an AS IS BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND.

import { flushPromises, shallowMount } from '@vue/test-utils'
import RoutersTab from '@/views/network/RoutersTab.vue'
import { getAPI } from '@/api'

jest.mock('@/api', () => ({ getAPI: jest.fn() }))

beforeEach(() => { getAPI.mockResolvedValue({ listroutersresponse: { router: [{ id: 'router' }] } }) })
afterEach(() => { jest.resetAllMocks() })

test.each([
  ['personal Shared in a selected project', '/guestnetwork/shared', { id: 'shared', type: 'Shared' }, { networkid: 'shared' }],
  ['project network', '/guestnetwork/isolated', { id: 'isolated', projectid: 'owner-project' }, { networkid: 'isolated', projectid: 'owner-project' }],
  ['personal VPC', '/vpc/vpc', { id: 'vpc' }, { vpcid: 'vpc' }],
  ['project VPC', '/vpc/vpc', { id: 'vpc', projectid: 'owner-project' }, { vpcid: 'vpc', projectid: 'owner-project' }]
])('%s uses the resource owner instead of injecting the header project', async (_, fullPath, resource, scope) => {
  const wrapper = shallowMount(RoutersTab, {
    props: { resource },
    global: {
      mocks: { $t: key => key, $route: { fullPath }, $store: { getters: { project: { id: 'header-project' } } } },
      stubs: { 'a-table': true, 'a-button': true, 'reload-outlined': true }
    }
  })
  await flushPromises()
  expect(getAPI).toHaveBeenCalledWith('listRouters', { listAll: true, ignoreproject: true, ...scope }, { preserveOnFailure: true })
  expect(wrapper.vm.routers).toEqual([{ id: 'router' }])
  wrapper.unmount()
})
