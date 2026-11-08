// Licensed to the Apache Software Foundation (ASF) under one or more
// contributor license agreements. See NOTICE for ownership information.
// Licensed under the Apache License, Version 2.0; http://www.apache.org/licenses/LICENSE-2.0
// Distributed on an AS IS BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND.
import { shallowMount } from '@vue/test-utils'
import Settings from '@/views/image/TemplateVnfSettings.vue'
import { getAPI, postAPI } from '@/api'
jest.mock('@/api', () => ({ getAPI: jest.fn(), postAPI: jest.fn() }))

const original = { deviceid: 0, name: 'Management', required: true, management: true }
const optional = { deviceid: 1, name: 'Data', required: false, management: false, description: 'Test' }
const reply = nics => ({ updatetemplateresponse: { template: { vnfnics: nics } } })
function context () {
  const ctx = {
    ...Settings.data(),
    resource: { id: 'template', name: 'Template', projectid: 'p', project: 'Project', vnfnics: [{ ...original }] },
    $store: { getters: { project: { id: 'p' }, userInfo: { id: 'admin', roletype: 'Admin' }, apis: { updateVnfTemplate: {} } }, state: { user: { token: 'login' } } },
    $route: { fullPath: '/template/template?tab=vnfsettings' },
    $t: key => key,
    $notification: { error: jest.fn() },
    $notifyError: jest.fn(),
    vnfNics: [{ ...original }],
    previousVnfNics: [{ ...original }]
  }
  for (const [k, method] of Object.entries(Settings.methods)) ctx[k] = method.bind(ctx)
  Object.defineProperty(ctx, 'nicScope', { get: () => Settings.computed.nicScope.call(ctx) })
  return ctx
}
beforeEach(() => { jest.clearAllMocks(); getAPI.mockResolvedValue({ listdetailoptionsresponse: { detailoptions: { details: {} } } }) })

test('add and edit share exactly one dialog instance and never open simultaneously', async () => {
  const w = shallowMount(Settings, {
    props: { resource: context().resource },
    global: {
      mocks: { $getApiParams: () => ({ vnfnics: {}, vnfdetails: {} }), $store: context().$store, $t: k => k },
      directives: { focus: {} },
      stubs: { MoldDialog: { props: ['visible'], template: '<section v-if="visible" role="dialog"><slot /><slot name="footer" /></section>' } }
    }
  })
  w.vm.onShowAddVnfNic(); w.vm.onShowEditVnfNic(optional)
  await w.vm.$nextTick()
  expect(w.findAll('[role="dialog"]')).toHaveLength(1)
  expect(w.vm.showEditVnfNic).toBe(false)
  w.vm.closeVnfNicModal(); w.vm.afterVnfNicClose(); await w.vm.$nextTick()
  expect(w.findAll('[role="dialog"]')).toHaveLength(0)
  w.unmount()
})

test('double submit sends one write and never mutates the displayed baseline while pending', async () => {
  const ctx = context(); let done
  postAPI.mockImplementation(() => new Promise(resolve => { done = resolve }))
  ctx.onShowAddVnfNic(); ctx.nicDraft = { ...optional }
  const pending = ctx.submitVnfNic(); ctx.submitVnfNic()
  expect(postAPI).toHaveBeenCalledTimes(1); expect(ctx.updateBusy).toBe(true)
  expect(ctx.vnfNics).toEqual([original])
  expect(postAPI.mock.calls[0][1]['vnfnics[1].name']).toBe('Data')
  ctx.closeVnfNicModal(); expect(ctx.showAddVnfNic).toBe(true)
  done(reply([original, optional])); await pending
  expect(ctx.vnfNics).toEqual([original, optional]); expect(ctx.showAddVnfNic).toBe(false); expect(ctx.updateBusy).toBe(false)
})

test('failed save keeps the draft and existing definitions; retry adds the draft once', async () => {
  const ctx = context(); ctx.onShowAddVnfNic(); ctx.nicDraft = { ...optional }
  postAPI.mockRejectedValueOnce(new Error('503')); await ctx.submitVnfNic()
  expect(ctx.vnfNics).toEqual([original]); expect(ctx.nicDraft).toEqual(optional)
  expect(ctx.showAddVnfNic).toBe(true); expect(ctx.nicError).toBeTruthy()
  postAPI.mockResolvedValueOnce(reply([original, optional])); await ctx.submitVnfNic()
  expect(postAPI).toHaveBeenCalledTimes(2); expect(ctx.vnfNics).toHaveLength(2)
})

test.each([null, '', -1, 1.2, 'not-a-number', 0])('rejects invalid or duplicate device ID %s without a write', id => {
  const ctx = context(); ctx.onShowAddVnfNic(); ctx.nicDraft = { ...optional, deviceid: id }
  ctx.submitVnfNic(); expect(postAPI).not.toHaveBeenCalled(); expect(ctx.vnfNics).toEqual([original])
})

test('device zero is valid for an empty template and whitespace name is rejected', async () => {
  const ctx = context(); ctx.vnfNics = []; ctx.onShowAddVnfNic(); ctx.nicDraft = { ...original, name: '  ' }
  ctx.submitVnfNic(); expect(postAPI).not.toHaveBeenCalled()
  ctx.nicDraft.name = 'Management'; postAPI.mockResolvedValueOnce(reply([original])); await ctx.submitVnfNic()
  expect(postAPI).toHaveBeenCalledTimes(1); expect(ctx.vnfNics).toEqual([original])
})

test('cancel/reopen resets values and returns focus once to the originating control', () => {
  const ctx = context(); const trigger = { isConnected: true, focus: jest.fn() }
  ctx.onShowAddVnfNic({ currentTarget: trigger }); ctx.nicDraft = { ...optional }
  ctx.closeVnfNicModal(); ctx.afterVnfNicClose(); ctx.afterVnfNicClose(); ctx.onShowAddVnfNic()
  expect(trigger.focus).toHaveBeenCalledTimes(1); expect(ctx.nicDraft.deviceid).toBeNull(); expect(ctx.nicDraft.name).toBe('')
})

test.each(['project', 'resource', 'login', 'route', 'unmount'])('late save response cannot overwrite a new %s context', async kind => {
  const ctx = context(); let done
  postAPI.mockImplementation(() => new Promise(resolve => { done = resolve }))
  ctx.onShowAddVnfNic(); ctx.nicDraft = { ...optional }; const pending = ctx.submitVnfNic()
  if (kind === 'project') ctx.$store.getters.project.id = 'other'
  if (kind === 'resource') ctx.resource.id = 'other'
  if (kind === 'login') ctx.$store.state.user.token = 'other'
  if (kind === 'route') ctx.$route.fullPath = '/dashboard'
  if (kind === 'unmount') Settings.beforeUnmount.call(ctx)
  else Settings.watch.nicScope.call(ctx)
  done(reply([original, optional])); await pending
  expect(ctx.vnfNics).toEqual([original]); expect(ctx.showAddVnfNic).toBe(kind === 'unmount')
  expect(ctx.nicTrigger).toBeNull()
})

test('edit is a detached draft; failed edit cannot alter an existing definition', async () => {
  const ctx = context(); ctx.onShowEditVnfNic(original); ctx.nicDraft.name = 'changed'
  expect(ctx.vnfNics).toEqual([original]); postAPI.mockRejectedValueOnce(new Error('503')); await ctx.submitVnfNic()
  expect(ctx.vnfNics).toEqual([original]); expect(ctx.nicDraft.name).toBe('changed')
})

test('reordering then deleting an optional definition preserves the management definition', async () => {
  const ctx = context(); const spare = { ...optional, deviceid: 2, name: 'Spare' }; ctx.vnfNics = [original, optional, spare]
  postAPI.mockImplementation((api, p) => Promise.resolve(reply([0, 1, 2].map(i => ({ deviceid: p['vnfnics[' + i + '].deviceid'], name: p['vnfnics[' + i + '].name'], required: p['vnfnics[' + i + '].required'], management: p['vnfnics[' + i + '].management'], description: p['vnfnics[' + i + '].description'] })).filter(n => n.deviceid !== undefined))))
  await ctx.moveVnfNicUp(spare); expect(ctx.vnfNics.find(n => n.name === 'Spare').deviceid).toBe(1)
  await ctx.moveVnfNicDown(ctx.vnfNics.find(n => n.name === 'Spare'))
  await ctx.deleteVnfNic(ctx.vnfNics.find(n => n.name === 'Spare'))
  expect(ctx.vnfNics).toEqual([original, optional]); expect(postAPI).toHaveBeenCalledTimes(3)
})

test('unavailable API or non-owner cannot write', () => {
  const ctx = context(); ctx.onShowAddVnfNic(); ctx.nicDraft = optional
  ctx.$store.getters.apis = {}; ctx.submitVnfNic(); expect(postAPI).not.toHaveBeenCalled()
  ctx.$store.getters.apis = { updateVnfTemplate: {} }; ctx.$store.getters.userInfo = { roletype: 'User', account: 'outside', domainid: 'outside' }; ctx.$store.getters.project = {}; ctx.submitVnfNic()
  expect(postAPI).not.toHaveBeenCalled()
})
