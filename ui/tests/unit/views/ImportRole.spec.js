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

/** @jest-environment jsdom */

import { flushPromises, shallowMount } from '@vue/test-utils'
import { getAPI, postAPI } from '@/api'
import { formatRoleCsv, parseRoleCsv } from '@/utils/roleCsv'
import ImportRole from '@/views/iam/ImportRole.vue'

jest.mock('@/api', () => ({ getAPI: jest.fn(), postAPI: jest.fn() }))

const rows = [
  { rule: 'listOsTypes', permission: 'allow', description: '한글, "값"\r\nNext & # %' },
  { rule: 'create*', permission: 'deny', description: '' },
  { rule: 'listZones', permission: 'allow', description: ' line\nnext "quoted" ' }
]
const notice = jest.fn()
const target = { id: 'target-id', name: 'Existing role', type: 'User', isdefault: false }

function mountImport () {
  const view = shallowMount(ImportRole, {
    global: {
      renderStubDefaultSlot: true,
      mocks: {
        $t: key => key,
        $getApiParams: () => Object.fromEntries(['name', 'description', 'type', 'ispublic', 'forced'].map(key => [key, { description: key }])),
        $notification: { success: notice }
      },
      stubs: ['a-alert', 'a-button', 'a-form', 'a-form-item', 'a-input', 'a-select', 'a-select-option', 'a-spin', 'a-switch', 'a-upload-dragger']
    }
  })
  view.vm.$refs.formRef.validate = jest.fn().mockResolvedValue()
  return view
}

const roleResponse = role => ({ listrolesresponse: { role: [role], count: 1 } })
const ruleResponse = rolepermission => ({ listrolepermissionsresponse: { rolepermission } })
const csvFile = (text = formatRoleCsv(rows)) => ({ name: 'rules.CSV', text: () => Promise.resolve(text) })

describe('role rule CSV', () => {
  it('preserves order, BOM, record separators, quotes, non-ASCII text, line breaks and blank descriptions', () => {
    const csv = formatRoleCsv(rows)
    expect(csv.startsWith('\uFEFFrule,permission,description\r\n')).toBe(true)
    expect(csv).toContain('"한글, ""값""\r\nNext & # %"')
    expect(parseRoleCsv(csv)).toEqual({ rules: rows, errors: [] })
  })

  it('validates headers, fields and physical line numbers after multiline values', () => {
    expect(parseRoleCsv('rule,description,permission\nlistZones,,allow').errors[0]).toEqual({
      line: 1, message: 'message.role.csv.header'
    })
    expect(parseRoleCsv('rule,permission,description\n').errors[0].message).toBe('message.role.csv.empty')
    const csv = 'rule,permission,description\nlistZones,allow,"start\nend"\nnot a rule,allow,\nlistHosts,maybe,\nlistTags,deny'
    const invalid = parseRoleCsv(csv)
    expect(invalid.rules).toEqual([{ rule: 'listZones', permission: 'allow', description: 'start\nend' }])
    expect(invalid.errors).toEqual([
      { line: 4, message: 'message.role.csv.rule' },
      { line: 5, message: 'message.role.csv.permission' },
      { line: 6, message: 'message.acl.csv.row.columns' }
    ])
    expect(parseRoleCsv('rule,permission,description\nlistZones,allow,"unfinished').errors).toEqual([
      { line: 2, message: 'message.role.csv.quotes' }
    ])
  })
})

describe('role import confirmation', () => {
  let view

  beforeEach(() => {
    postAPI.mockReset().mockResolvedValue({ importroleresponse: { role: target } })
    getAPI.mockReset()
    notice.mockReset()
    view = mountImport()
  })

  afterEach(() => view.unmount())

  it('blocks the entire file when a row is invalid and submits ordered fields after selecting a valid replacement', async () => {
    view.vm.form.name = 'new role'
    view.vm.form.type = 'User'
    await view.vm.readFile(csvFile('rule,permission,description\nlistZones,allow,\nlistOsTypes,bad,'))
    expect(view.vm.canImport).toBe(false)
    await view.vm.handleSubmit()
    expect(postAPI).not.toHaveBeenCalled()

    await view.vm.readFile(csvFile())
    await view.vm.handleSubmit()
    const [command, data] = postAPI.mock.calls[0]
    expect(command).toBe('importRole')
    expect(data).toMatchObject({
      name: 'new role',
      forced: false,
      'rules[0].description': rows[0].description,
      'rules[1].description': '',
      'rules[2].rule': 'listZones'
    })
  })

  it('requires a separate confirmation and renews it when the previously shown rules change', async () => {
    view.vm.form.name = target.name
    view.vm.form.type = target.type
    view.vm.form.forced = true
    await view.vm.readFile(csvFile())
    getAPI.mockResolvedValueOnce(roleResponse(target)).mockResolvedValueOnce(ruleResponse([rows[0]]))
      .mockResolvedValueOnce(roleResponse(target)).mockResolvedValueOnce(ruleResponse([rows[1], rows[0]]))
      .mockResolvedValueOnce(roleResponse(target)).mockResolvedValueOnce(ruleResponse([rows[1], rows[0]]))
    await view.vm.handleSubmit()
    expect(view.vm.preview).toEqual({ role: target, rules: [rows[0]] })
    await view.vm.handleSubmit()
    expect(postAPI).not.toHaveBeenCalled()
    await view.vm.confirmForce()
    expect(view.vm.error).toBe('message.role.csv.changed')
    expect(view.vm.preview.rules).toHaveLength(2)
    expect(postAPI).not.toHaveBeenCalled()
    await view.vm.confirmForce()
    expect(postAPI.mock.calls[0][1]).toMatchObject({ forced: true, name: target.name, type: target.type })
    expect(view.emitted('close-action')).toHaveLength(1)
  })

  it('blocks a default target and discards a preview when the form changes', async () => {
    view.vm.form.name = target.name
    view.vm.form.type = target.type
    view.vm.form.forced = true
    await view.vm.readFile(csvFile())
    getAPI.mockResolvedValueOnce(roleResponse({ ...target, isdefault: true }))
      .mockResolvedValueOnce(roleResponse(target)).mockResolvedValueOnce(ruleResponse([]))
    await view.vm.handleSubmit()
    expect(view.vm.error).toBe('message.role.csv.default')
    expect(postAPI).not.toHaveBeenCalled()
    await view.vm.handleSubmit()
    expect(view.vm.preview.role.id).toBe(target.id)
    view.vm.form.name = 'Other role'
    await flushPromises()
    expect(view.vm.preview).toBeNull()
    await view.vm.confirmForce()
    expect(postAPI).not.toHaveBeenCalled()
  })

  it('keeps a newer file when an earlier read resolves out of order', async () => {
    let finish
    const older = view.vm.readFile({ name: 'older.csv', text: () => new Promise(resolve => { finish = resolve }) })
    await view.vm.readFile(csvFile())
    finish('bad data')
    await older
    expect(view.vm.csvErrors).toEqual([])
    expect(view.vm.csvRules).toEqual(rows)
  })
})
