// Licensed to the Apache Software Foundation (ASF) under one or more
// contributor license agreements. See the NOTICE file for ownership information.
// Licensed under the Apache License, Version 2.0; http://www.apache.org/licenses/LICENSE-2.0
// Distributed on an AS IS BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND.

import { flushPromises, shallowMount } from '@vue/test-utils'
import InfiniteScrollSelect from '@/components/widgets/InfiniteScrollSelect.vue'
import { callAPI } from '@/api/index'

jest.mock('@/api/index', () => ({ callAPI: jest.fn() }))

const project = { id: 'project', name: 'QA project' }
const Select = { name: 'ASelect', template: '<div><slot /></div>' }

beforeEach(() => {
  jest.useFakeTimers()
  callAPI.mockResolvedValue({ listprojectsresponse: { count: 1, project: [project] } })
})

afterEach(() => {
  jest.clearAllTimers()
  jest.useRealTimers()
  jest.resetAllMocks()
})

test('selecting a project cancels the pending search before it clears the selected option', async () => {
  const wrapper = shallowMount(InfiniteScrollSelect, {
    props: { api: 'listProjects', resourceType: 'project', defaultOption: { id: 0, name: 'Default' } },
    attrs: { value: 0 },
    global: {
      mocks: { $store: { getters: { defaultListViewPageSize: 20 } }, $t: key => key },
      stubs: { 'a-select': Select, 'a-select-option': true, 'render-icon': true }
    }
  })
  await flushPromises()
  const select = wrapper.findComponent(Select)
  select.vm.$emit('search', 'QA')
  select.vm.$emit('change', project.id)
  await flushPromises()
  jest.advanceTimersByTime(500)
  await flushPromises()

  expect(wrapper.emitted('change-option')).toEqual([[project]])
  expect(callAPI).toHaveBeenCalledTimes(1)
  expect(wrapper.vm.options).toContainEqual(project)
  wrapper.unmount()
})

test('a selection started before search completes still emits its loaded object', async () => {
  const wrapper = shallowMount(InfiniteScrollSelect, {
    props: { api: 'listProjects', resourceType: 'project', apiParams: { domainid: 'first' } },
    attrs: { value: 0 },
    global: {
      mocks: { $store: { getters: { defaultListViewPageSize: 20 } }, $t: key => key },
      stubs: { 'a-select': Select, 'a-select-option': true, 'render-icon': true }
    }
  })
  await flushPromises()
  let finishOldSearch
  callAPI.mockReturnValueOnce(new Promise(resolve => { finishOldSearch = resolve }))
  callAPI.mockReturnValue(new Promise(() => {}))
  const select = wrapper.findComponent(Select)
  select.vm.$emit('search', 'QA')
  jest.advanceTimersByTime(500)
  expect(wrapper.vm.options).toEqual([])
  select.vm.$emit('change', project.id)
  expect(wrapper.emitted('change-option')).toEqual([[project]])

  // A different API scope must not reuse objects from the earlier scope.
  await wrapper.setProps({ apiParams: { domainid: 'second' } })
  finishOldSearch({ listprojectsresponse: { count: 1, project: [project] } })
  await flushPromises()
  expect(wrapper.vm.options).toEqual([])
  expect(wrapper.vm.cachedOptions).toEqual([])
  select.vm.$emit('change', project.id)
  expect(wrapper.emitted('change-option')).toHaveLength(1)
  wrapper.unmount()
})
