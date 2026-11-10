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

import { mount, flushPromises } from '@vue/test-utils'
import Editor from '@/components/view/BucketUploadMetadata'
import { analyzeMetadata, uploadMetadataHeaders, displayMetadataValue, encodeMetadataValue } from '@/utils/bucketUploadMetadata'
it('normalizes custom keys without replacing system MIME headers', () => {
  const headers = uploadMetadataHeaders({ 'X-Amz-Meta-Note': '한글 값', 'content-type': 'custom', empty: '' })
  expect(headers['x-amz-meta-note']).toMatch(/^=\?UTF-8\?B\?/)
  expect(displayMetadataValue(headers['x-amz-meta-note'])).toBe('한글 값')
  expect(headers['x-amz-meta-content-type']).toBe('custom'); expect(headers['Content-Type']).toBeUndefined(); expect(headers['x-amz-meta-empty']).toBe('')
})
it.each([
  [{ key: '', value: 'a' }], [{ key: '한글', value: 'a' }], [{ key: 'key with space', value: 'a' }],
  [{ key: 'Note', value: 'a' }, { key: 'x-amz-meta-note', value: 'b' }],
  [{ key: 'x-amz-acl', value: 'public-read' }], [{ key: 'note', value: 'x'.repeat(2048) }]
].map(rows => [rows]))('rejects invalid, reserved, duplicated or oversized metadata %p', rows => { expect(analyzeMetadata(rows).valid).toBe(false) })
it('allows exact header byte limit and keeps invalid encoded values raw', () => {
  expect(analyzeMetadata([{ key: 'n', value: 'x'.repeat(2047) }]).valid).toBe(true)
  expect(analyzeMetadata(Array(65).fill({ key: 'n', value: 'v' })).valid).toBe(false)
  expect(displayMetadataValue('=?UTF-8?B?////?=')).toBe('=?UTF-8?B?////?=')
  expect(displayMetadataValue('=?UTF-8?Q?hello_world?=')).toBe('hello world')
})
it('renders separate labels, reports draft validity and removes a specific row', async () => {
  const view = mount(Editor, { global: { mocks: { $t: key => key } } })
  await view.find('button').trigger('click'); await flushPromises()
  expect(view.findAll('label')).toHaveLength(2); expect(view.emitted('validity').slice(-1)[0]).toEqual([false])
  await view.find('input').setValue('note'); await view.find('textarea').setValue('한글 값'); await flushPromises()
  expect(view.emitted('update-pairs').slice(-1)[0]).toEqual([{ note: '한글 값' }]); expect(view.emitted('validity').slice(-1)[0]).toEqual([true])
  await view.find('.metadata-remove').trigger('click'); expect(view.findAll('input')).toHaveLength(0)
  await view.setProps({ disabled: true }); expect(view.find('button').attributes('disabled')).toBeDefined(); view.unmount()
})

it('splits long Unicode values into bounded encoded words without losing spaces or UTF-8', () => {
  const original = ' 한글과 공백 😀 '.repeat(15); const encoded = encodeMetadataValue(original)
  expect(encoded.split(' ').every(word => word.length <= 75)).toBe(true)
  expect(displayMetadataValue(encoded)).toBe(original)
  expect(displayMetadataValue('=?UTF-8?B?a?=')).toBe('=?UTF-8?B?a?=')
})
