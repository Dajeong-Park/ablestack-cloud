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
import RolePermissionTab from '@/views/iam/RolePermissionTab.vue'

jest.mock('@/api', () => ({ getAPI: jest.fn(), postAPI: jest.fn() }))

const testRules = [
  { id: 'zones', rule: 'listZones', permission: 'allow' },
  { id: 'types', rule: 'listOsTypes', permission: 'allow' },
  { id: 'categories', rule: 'listOsCategories', permission: 'deny' }
]
const apis = {
  listRolePermissions: {},
  createRolePermission: {},
  updateRolePermission: {},
  deleteRolePermission: {},
  listOsTypes: {},
  listZones: {}
}
const response = rules => ({ listrolepermissionsresponse: { rolepermission: rules } })
const failure = errortext => ({ response: { data: { error: { errortext } } } })

function mountEditor () {
  return shallowMount(RolePermissionTab, {
    props: { resource: { id: 'role' } },
    global: {
      mocks: { $t: key => key, $store: { getters: { apis } } },
      renderStubDefaultSlot: true,
      stubs: [
        'a-alert', 'a-auto-complete', 'a-button', 'a-input', 'a-input-search', 'a-select', 'a-spin',
        'arrow-up-outlined', 'arrow-down-outlined', 'download-outlined', 'drag-outlined', 'loading-outlined'
      ]
    }
  })
}

describe('global role permission editing', () => {
  let editor

  beforeEach(() => {
    getAPI.mockReset().mockResolvedValue(response(testRules))
    postAPI.mockReset().mockResolvedValue({})
  })

  afterEach(() => {
    if (editor) editor.unmount()
    editor = undefined
  })

  it('derives case-insensitive visible rules, hides existing suggestions, and blocks filtered moves', async () => {
    editor = mountEditor()
    await flushPromises()
    await editor.setData({ searchRule: '  LISTos  ' })
    expect(editor.vm.visibleRules.map(rule => rule.id)).toEqual(['types', 'categories'])
    expect(editor.vm.apiOptions).not.toContainEqual({ value: 'listZones' })
    await editor.vm.moveRule(1, -1)
    await editor.vm.changeOrder([...editor.vm.visibleRules].reverse())
    expect(postAPI).not.toHaveBeenCalled()
    expect(editor.html()).toContain('message.role.rules.reorder.search')

    await editor.setData({ searchRule: 'no rule' })
    expect(editor.find('.rules-empty').text()).toBe('label.no.data')
    await editor.setData({ searchRule: '' })
    expect(editor.vm.visibleRules).toHaveLength(3)
  })

  it('sends the complete order for keyboard moves, waits for readback, and blocks duplicate requests', async () => {
    let finishMove
    postAPI.mockImplementationOnce(() => new Promise(resolve => { finishMove = resolve }))
    getAPI.mockResolvedValueOnce(response(testRules))
      .mockResolvedValueOnce(response([testRules[1], testRules[0], testRules[2]]))
    editor = mountEditor()
    await flushPromises()
    const move = editor.vm.moveRule(1, -1)
    await editor.vm.moveRule(1, -1)
    expect(postAPI).toHaveBeenCalledTimes(1)
    expect(postAPI.mock.calls[0].slice(0, 2)).toEqual([
      'updateRolePermission',
      { roleid: 'role', ruleorder: ['types', 'zones', 'categories'] }
    ])
    expect(editor.vm.rules.map(rule => rule.id)).toEqual(['zones', 'types', 'categories'])
    finishMove({})
    await move
    expect(editor.vm.rules.map(rule => rule.id)).toEqual(['types', 'zones', 'categories'])
    expect(editor.vm.announcement).toBe('message.project.rule.moved')
  })

  it('reconciles the latest server order after a concurrent change', async () => {
    const concurrent = { id: 'new', rule: 'listAccounts', permission: 'allow' }
    getAPI.mockResolvedValueOnce(response(testRules)).mockResolvedValueOnce(response([...testRules, concurrent]))
    postAPI.mockRejectedValueOnce(failure('Order changed'))
    editor = mountEditor()
    await flushPromises()
    await editor.vm.changeOrder([...testRules].reverse())
    expect(editor.vm.actionError).toBe('Order changed')
    expect(editor.vm.rules.map(rule => rule.id)).toEqual(['zones', 'types', 'categories', 'new'])
    expect(editor.vm.canReorder).toBe(true)
  })

  it('keeps the filter and the creation draft after a duplicate save, and clears the draft on retry success', async () => {
    const newRule = { id: 'accounts', rule: 'listAccounts', permission: 'deny', description: 'Keep draft' }
    getAPI.mockResolvedValueOnce(response(testRules)).mockResolvedValueOnce(response(testRules))
      .mockResolvedValueOnce(response([...testRules, newRule]))
    postAPI.mockRejectedValueOnce(failure('Duplicate rule'))
    editor = mountEditor()
    await flushPromises()
    await editor.setData({
      searchRule: 'listOs',
      newRule: 'listOsTypes',
      newRulePermission: 'deny',
      newRuleDescription: 'Keep draft'
    })
    await editor.vm.onRuleSave()
    expect(editor.vm.actionError).toBe('Duplicate rule')
    expect(editor.vm.searchRule).toBe('listOs')
    expect(editor.vm.visibleRules.map(rule => rule.id)).toEqual(['types', 'categories'])
    expect(editor.vm.newRule).toBe('listOsTypes')
    expect(editor.vm.newRuleDescription).toBe('Keep draft')
    expect(editor.vm.newRulePermission).toBe('deny')
    await editor.setData({ newRule: ' listAccounts ' })
    await editor.vm.onRuleSave()
    expect(postAPI.mock.calls[1][1]).toEqual({
      roleid: 'role', rule: 'listAccounts', permission: 'deny', description: 'Keep draft'
    })
    expect(editor.vm.searchRule).toBe('listOs')
    expect(editor.vm.visibleRules.map(rule => rule.id)).toEqual(['types', 'categories'])
    expect(editor.vm.newRule).toBe('')
    expect(editor.vm.newRuleDescription).toBe('')
    expect(editor.vm.newRulePermission).toBe('allow')
    expect(editor.vm.actionError).toBe('')
  })

  it('keeps draft permission independent and handles a false success response for an existing rule', async () => {
    postAPI.mockResolvedValueOnce({ updaterolepermissionresponse: { success: false } })
    editor = mountEditor()
    await flushPromises()
    await editor.setData({ newRule: 'listAccounts', searchRule: 'zones' })
    await editor.vm.onPermissionChange(testRules[0], 'deny')
    expect(editor.vm.actionError).toBe('message.request.failed')
    expect(editor.vm.newRulePermission).toBe('allow')
    expect(editor.vm.newRule).toBe('listAccounts')
    expect(editor.vm.visibleRules).toEqual([testRules[0]])
  })

  it('keeps a failed refresh locked until readback succeeds, preserving inputs for the same role', async () => {
    getAPI.mockResolvedValueOnce(response(testRules)).mockRejectedValueOnce(failure('Read failed'))
      .mockResolvedValueOnce(response(testRules))
    editor = mountEditor()
    await flushPromises()
    await editor.setData({ searchRule: 'zones', newRule: 'listAccounts' })
    await editor.setProps({ resource: { id: 'role', name: 'refreshed' } })
    await flushPromises()
    expect(editor.vm.loadError).toBe('Read failed')
    expect(editor.vm.locked).toBe(true)
    expect(editor.vm.visibleRules).toEqual([testRules[0]])
    expect(editor.vm.newRule).toBe('listAccounts')
    await editor.vm.onRuleSave()
    expect(postAPI).not.toHaveBeenCalled()
    await editor.vm.refresh()
    expect(editor.vm.locked).toBe(false)
    expect(editor.vm.loadError).toBe('')
    expect(editor.vm.searchRule).toBe('zones')
    expect(editor.vm.newRule).toBe('listAccounts')
  })

  it('discards the result of a write after changing the role scope', async () => {
    let finishOldWrite
    postAPI.mockImplementationOnce(() => new Promise(resolve => { finishOldWrite = resolve }))
    getAPI.mockResolvedValueOnce(response(testRules)).mockResolvedValueOnce(response([]))
    editor = mountEditor()
    await flushPromises()
    await editor.setData({ searchRule: 'zones', newRule: 'listAccounts' })
    const previousSave = editor.vm.onRuleSave()
    await editor.setProps({ resource: { id: 'other-role' } })
    await flushPromises()
    await editor.setData({ newRule: 'listHosts' })
    finishOldWrite({})
    await previousSave
    expect(getAPI).toHaveBeenCalledTimes(2)
    expect(editor.vm.rules).toEqual([])
    expect(editor.vm.searchRule).toBe('')
    expect(editor.vm.newRule).toBe('listHosts')
    expect(editor.vm.locked).toBe(false)
  })
})
