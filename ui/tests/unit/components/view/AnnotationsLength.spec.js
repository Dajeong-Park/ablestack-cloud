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
import { shallowMount, flushPromises } from '@vue/test-utils'
import Notes from '@/components/view/AnnotationsTab.vue'
import { getAPI, postAPI } from '@/api'
import ko from '../../../../public/locales/ko_KR.json'
import en from '../../../../public/locales/en.json'
jest.mock('@/api', () => ({ getAPI: jest.fn(), postAPI: jest.fn() }))

const button = { props: ['disabled', 'loading'], template: '<button :disabled="disabled"><slot /></button>' }
const textarea = { props: ['value'], emits: ['update:value'], template: '<textarea :value="value" @input="$emit(\'update:value\', $event.target.value)" />' }
const content = { template: '<section><slot name="content" /></section>' }
const passthrough = { template: '<section><slot /></section>' }
const dictionaries = { ko, en }
function mount (locale = 'ko') {
  const store = { state: { user: { token: 'session' } }, getters: { userInfo: { id: 'user', roletype: 'Admin' }, apis: { listAnnotations: {}, addAnnotation: {} }, project: {} } }
  return shallowMount(Notes, { props: { resource: { id: 'A' } }, global: { provide: { parentFetchData: jest.fn() }, mocks: { $store: store, $route: { path: '/guestnetwork/A', meta: { resourceType: 'Network' } }, $t: (key, args = []) => (dictionaries[locale][key] || key).replace(/\{(\d+)\}/g, (_, i) => args[i]), $notifyError: jest.fn(), $toLocaleDate: v => v }, stubs: { 'a-spin': passthrough, 'a-comment': content, 'a-button': button, 'a-textarea': textarea } } })
}
beforeEach(() => { getAPI.mockReset(); postAPI.mockReset(); getAPI.mockResolvedValue({ listannotationsresponse: { count: 0, annotation: [] } }); postAPI.mockResolvedValue({}) })

test.each([
  ['ASCII 254', 'a'.repeat(254), 254, false],
  ['Korean 255', '한'.repeat(255), 255, false],
  ['Korean 256', '한'.repeat(256), 256, true],
  ['newlines', '한\n'.repeat(127) + '끝', 255, false],
  ['emoji boundary', '🙂'.repeat(127) + '끝', 255, false],
  ['emoji over limit', '🙂'.repeat(128), 256, true],
  ['untrimmed request', ' ' + '한'.repeat(255), 256, true],
  ['long literal', '<b>리터럴</b>'.repeat(100), '<b>리터럴</b>'.repeat(100).length, true]
])('%s keeps the complete draft and uses the API UTF-16 boundary', async (_, draft, length, blocked) => {
  const wrapper = mount(); await flushPromises(); await wrapper.find('textarea').setValue(draft)
  expect(wrapper.vm.annotationLength).toBe(length); expect(wrapper.vm.annotationLimit).toBe(255)
  expect(wrapper.find('.annotation-length-count').text()).toBe(`${length} / 255`)
  expect(wrapper.find('textarea').element.value).toBe(draft); expect(wrapper.find('textarea').attributes('maxlength')).toBeUndefined()
  expect(wrapper.find('button').element.disabled).toBe(blocked)
  expect(wrapper.find('textarea').attributes('aria-invalid')).toBe(blocked ? 'true' : undefined)
  await wrapper.vm.saveNote()
  expect(postAPI).toHaveBeenCalledTimes(blocked ? 0 : 1)
  if (blocked) expect(wrapper.vm.annotation).toBe(draft)
  else { expect(postAPI.mock.calls[0][1].annotation).toBe(draft); expect(wrapper.vm.annotation).toBe('') }
  wrapper.unmount()
})

test('Ctrl+Enter cannot bypass the overflow guard; correcting it submits once and resets the counter', async () => {
  const wrapper = mount(); await flushPromises(); await wrapper.find('textarea').setValue('한'.repeat(256))
  await wrapper.find('textarea').trigger('keydown', { key: 'Enter', ctrlKey: true }); expect(postAPI).not.toHaveBeenCalled()
  await wrapper.find('textarea').setValue('한'.repeat(255)); await wrapper.find('textarea').trigger('keydown', { key: 'Enter', ctrlKey: true }); await flushPromises()
  expect(postAPI).toHaveBeenCalledTimes(1); expect(wrapper.find('.annotation-length-count').text()).toBe('0 / 255'); expect(wrapper.find('button').element.disabled).toBe(true)
  wrapper.unmount()
})

test.each(['ko', 'en'])('%s exposes localized pre-entry guidance and associates feedback with the input', async locale => {
  const wrapper = mount(locale); await flushPromises()
  expect(wrapper.find('.annotation-length-hint').text()).toContain('255'); expect(wrapper.find('.annotation-length-hint').text()).not.toContain('message.')
  expect(wrapper.find('textarea').attributes('aria-describedby')).toBe(wrapper.find('.annotation-length-feedback').attributes('id'))
  await wrapper.find('textarea').setValue('a'.repeat(256))
  expect(wrapper.find('.annotation-length-count').attributes('aria-label')).toContain('256')
  expect(wrapper.find('.annotation-length-error').text()).not.toContain('message.')
  wrapper.unmount()
})

test('blank input, unavailable scope, missing permission and an active send keep their original guards', async () => {
  const wrapper = mount(); await flushPromises()
  await wrapper.find('textarea').setValue(' \n '); await wrapper.vm.saveNote(); expect(postAPI).not.toHaveBeenCalled()
  await wrapper.find('textarea').setValue('draft'); await wrapper.setData({ loadedContext: '' }); await wrapper.vm.saveNote(); expect(postAPI).not.toHaveBeenCalled()
  await wrapper.setData({ loadedContext: wrapper.vm.annotationContext, annotationSaving: true }); await wrapper.vm.saveNote(); expect(postAPI).not.toHaveBeenCalled()
  await wrapper.setData({ annotationSaving: false }); delete wrapper.vm.$store.getters.apis.addAnnotation; await wrapper.vm.saveNote(); expect(postAPI).not.toHaveBeenCalled()
  wrapper.unmount()
})
