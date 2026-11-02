// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements. See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership. The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License. You may obtain a copy of the License at
//
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied. See the License for the
// specific language governing permissions and limitations
// under the License.

import Up from '@/views/compute/AutoScaleUpPolicyTab.vue'
import Down from '@/views/compute/AutoScaleDownPolicyTab.vue'
import Profile from '@/views/compute/AutoScaleVmProfile.vue'
import LB from '@/views/compute/AutoScaleLoadBalancing.vue'
import Schedules from '@/views/compute/ResourceSchedules.vue'
import ResetUserData from '@/views/compute/ResetUserData.vue'
import { autoScaleResourceScope } from '@/utils/autoScaleUi'
import { NO_USER_DATA, userDataSelectionConsumer } from '@/utils/userDataSelection'
import { nextTick } from 'vue'
import { getAPI, postAPI } from '@/api'
jest.mock('@/api', () => ({ getAPI: jest.fn(), postAPI: jest.fn() }))
jest.mock('@/store', () => ({ getters: { apis: {}, userInfo: {}, project: null } }))

beforeEach(() => { getAPI.mockReset(); postAPI.mockReset() })

test.each([Up, Down])('policy dialog draft changes do not mutate the displayed policy before confirmation', component => {
  const policy = { id: 'policy', name: 'before', duration: 60, quiettime: 300, conditions: [{ id: 'condition' }] }
  const ctx = { policy, policyDraft: {}, mutationError: 'old' }
  component.methods.openPolicyModal.call(ctx)
  ctx.policyDraft.name = 'cancelled edit'
  ctx.policyDraft.duration = 100
  component.methods.closeModal.call(ctx)
  expect(policy.name).toBe('before')
  expect(policy.duration).toBe(60)
  expect(ctx.editPolicyModalVisible).toBe(false)
  expect(postAPI).not.toHaveBeenCalled()
})

test.each([Up, Down])('policy confirmation sends the dialog values and retains the current condition links', async component => {
  const mutate = jest.fn().mockResolvedValue({})
  const ctx = { resource: { interval: 10 }, policy: { id: 'p', name: 'old', duration: 60, quiettime: 300, conditions: [{ id: 'c' }] }, policyDraft: { name: 'changed', duration: 80, quiettime: 400 }, editPolicyModalVisible: true, isEditable: true, mutate, saveEdit: action => action() }
  await component.methods.updateAutoScalePolicy.call(ctx, null, null)
  expect(mutate).toHaveBeenCalledWith('updateAutoScalePolicy', { id: 'p', name: 'changed', duration: 80, quiettime: 400, conditionids: 'c' })
  expect(ctx.policy.name).toBe('old')
})

function userDataContext (autoscale, tab, values) {
  postAPI.mockResolvedValue({ updateautoscalevmprofileresponse: { jobid: 'job' } })
  getAPI.mockResolvedValue({ queryasyncjobresultresponse: { jobstatus: 1, jobresult: { autoscalevmprofile: { id: 'profile' } } } })
  const mocks = { $t: key => key }
  const ctx = {
    ...ResetUserData.data.call(mocks),
    ...mocks,
    isAutoScaleProfile: autoscale,
    userdataTabKey: tab,
    userdataDefaultOverridePolicy: undefined,
    form: values,
    resource: autoscale ? { resetUserDataApiName: 'updateAutoScaleVmProfile', resetUserDataResourceId: 'profile' } : { id: 'vm' },
    currentLoaded: true,
    editCurrent: true,
    userDataSelectionReady: true,
    $toBase64AndURIEncoded: value => 'encoded:' + value,
    $message: { success: jest.fn() },
    $emit: jest.fn(),
    closeAction: jest.fn()
  }
  Object.defineProperty(ctx, 'userDataSelectionBlocked', {
    get: () => userDataSelectionConsumer.computed.userDataSelectionBlocked.call(ctx)
  })
  return ctx
}
test('registered AutoScale UserData selection ignores a retained manual draft', async () => {
  await ResetUserData.methods.handleSubmit.call(userDataContext(true, 'userdataregistered', { userdata: 'stale', userdataid: 'registered' }))
  expect(postAPI).toHaveBeenCalledWith('updateAutoScaleVmProfile', { id: 'profile', userdataid: 'registered' })
})
test('manual AutoScale UserData ignores a retained registered selection', async () => {
  await ResetUserData.methods.handleSubmit.call(userDataContext(true, 'userdatatext', { userdata: 'manual', userdataid: 'registered' }))
  expect(postAPI).toHaveBeenCalledWith('updateAutoScaleVmProfile', { id: 'profile', userdata: 'encoded:manual' })
})
test('registered None clears AutoScale custom data even when the manual draft is retained', async () => {
  await ResetUserData.methods.handleSubmit.call(userDataContext(true, 'userdataregistered', { userdata: 'stale' }))
  expect(postAPI).toHaveBeenCalledWith('updateAutoScaleVmProfile', { id: 'profile', userdata: '' })
})
test('VM library reset excludes a retained hidden manual draft', async () => {
  await ResetUserData.methods.handleSubmit.call(userDataContext(false, 'userdataregistered', { userdata: 'manual', userdataid: 'registered' }))
  expect(postAPI).toHaveBeenCalledWith('resetUserDataForVirtualMachine', { id: 'vm', userdataid: 'registered' }, { preserveOnFailure: true })
})
test('a verified script with no declared variables clears stale variables without another lookup', () => {
  const ctx = { form: {}, userDataParams: [{ key: 'stale' }], userDataValues: { stale: 'old' } }
  ResetUserData.methods.updateUserData.call(ctx, 'registered', { id: 'registered' })
  expect(ctx.userDataParams).toEqual([])
  expect(ctx.form.userdataid).toBe('registered')
  expect(ctx.userDataValues).toEqual({})
  expect(getAPI).not.toHaveBeenCalled()
})
test('AutoScale metadata reads the current scoped profile before its template and omits unrelated library reads', async () => {
  const ctx = userDataContext(true, 'userdataregistered', {})
  ctx.resource = { resetUserDataApiName: 'updateAutoScaleVmProfile', resetUserDataResourceId: 'profile', templateid: 'template', projectid: 'project', zoneid: 'zone' }
  getAPI.mockImplementation(command => Promise.resolve(command === 'listAutoScaleVmProfiles'
    ? { listautoscalevmprofilesresponse: { autoscalevmprofile: [{ id: 'profile', templateid: 'template', zoneid: 'zone' }] } }
    : { listtemplatesresponse: { template: [{ id: 'template' }] } }))
  await ResetUserData.methods.fetchTemplateData.call(ctx)
  expect(getAPI).toHaveBeenCalledWith('listTemplates', expect.objectContaining({ projectid: 'project', isready: true, templatefilter: 'executable' }), { preserveOnFailure: true, timeout: 15000 })
  expect(getAPI.mock.calls.map(([command]) => command)).not.toContain('listUserData')
  expect(ctx.currentLoaded).toBe(true)
  expect(ctx.templateError).toBe(false)
})
test.each(['currentLoaded', 'editCurrent', 'userDataSelectionReady'])('reset cannot submit when %s is false', async field => {
  const ctx = userDataContext(true, 'userdataregistered', { userdataid: 'registered' })
  ctx[field] = false
  await ResetUserData.methods.handleSubmit.call(ctx)
  expect(postAPI).not.toHaveBeenCalled()
})

test.each(['AutoScaleVmGroup', 'VirtualMachine'])('schedule state rendering is localized only for the AutoScale resource: %s', resourceType => {
  const ctx = { resourceType, columnKeys: ['enabled'], selectedColumnKeys: ['enabled'], $t: key => key }
  Schedules.methods.updateColumns.call(ctx)
  if (resourceType === 'AutoScaleVmGroup') {
    expect(ctx.columns[0].customRender({ record: { enabled: false } }).props.displayLabel).toBe('state.disabled')
    expect(ctx.columns[0].customRender({ record: { enabled: true } }).props.displayLabel).toBe('state.enabled')
  } else {
    expect(ctx.columns[0].key).toBe('enabled')
    expect(ctx.columns[0].customRender).toBeUndefined()
  }
})

const removalCases = [
  ['schedule', Schedules, 'prepareScheduleRemoval', 'confirmScheduleRemoval', 'removeSchedule', () => ({ selectedSchedule: { id: 'schedule' }, schedules: [{ id: 'schedule', description: 'current' }] }), ctx => { ctx.selectedSchedule = null }, ctx => { ctx.schedules = [] }],
  ['parameter', Profile, 'prepareParamRemoval', 'confirmParamRemoval', 'deleteParam', () => ({ profileid: 'profile', selectedParam: { name: 'rootdisksize' }, allParams: [{ name: 'rootdisksize', value: '100' }] }), ctx => { ctx.selectedParam = undefined }, ctx => { ctx.profileid = 'different' }],
  ...[Up, Down].flatMap((component, index) => [
    ['condition-' + index, component, 'prepareConditionRemoval', 'confirmConditionRemoval', 'deleteConditionFromAutoScalePolicy', () => ({ policy: { id: 'policy', conditions: [{ id: 'condition' }] }, selectedTableCondition: { id: 'condition' } }), ctx => { ctx.selectedTableCondition = undefined }, ctx => { ctx.policy = { id: 'different', conditions: [{ id: 'condition' }] } }],
    ['policy-' + index, component, 'preparePolicyRemoval', 'confirmPolicyRemoval', 'removeScalePolicyFromGroup', () => ({ policy: { id: 'policy' }, policies: [{ id: 'policy' }, { id: 'other' }] }), () => {}, ctx => { ctx.policy = { id: 'other' } }]
  ]),
  ['VM-IP', LB, 'prepareInstanceRemoval', 'confirmInstanceRemoval', 'handleDeleteInstanceFromRule', () => ({ currentRule: { id: 'rule' }, selectedInstance: { key: 'vm/10.0.0.2' }, ruleInstances: [{ key: 'vm/10.0.0.2', ip: '10.0.0.2', instance: { loadbalancerruleinstance: { id: 'vm' } } }] }), ctx => { ctx.selectedInstance = undefined }, ctx => { ctx.ruleInstances = [{ key: 'vm/10.0.0.3', ip: '10.0.0.3' }] }]
]
function removalContext (setup, mutation) {
  return { ...setup(), resource: { id: 'group' }, loading: false, saving: false, tabLoading: false, isSubmitted: false, $t: key => key, $message: { warning: jest.fn() }, [mutation]: jest.fn() }
}
test.each(removalCases)('%s row confirmation keeps the clicked record when background state clears former selection', (name, component, prepare, confirm, mutation, setup, clear) => {
  const ctx = removalContext(setup, mutation)
  component.methods[prepare].call(ctx, name === 'schedule' ? ctx.selectedSchedule : name === 'parameter' ? ctx.selectedParam : name === 'VM-IP' ? ctx.selectedInstance : ctx.selectedTableCondition)
  clear(ctx)
  component.methods[confirm].call(ctx)
  expect(ctx[mutation]).toHaveBeenCalledTimes(1)
  expect(ctx.$message.warning).not.toHaveBeenCalled()
  if (name === 'schedule') expect(ctx[mutation]).toHaveBeenCalledWith(ctx.schedules[0])
  if (name === 'parameter') expect(ctx[mutation]).toHaveBeenCalledWith('rootdisksize')
  if (name.startsWith('condition')) expect(ctx[mutation]).toHaveBeenCalledWith('condition')
  if (name === 'VM-IP') expect(ctx[mutation]).toHaveBeenCalledWith(ctx.ruleInstances[0].instance, ctx.currentRule, '10.0.0.2')
})
test.each(removalCases)('%s confirmation refuses the target when its list, parent or VM-IP tuple changed', (name, component, prepare, confirm, mutation, setup, clear, change) => {
  const ctx = removalContext(setup, mutation)
  component.methods[prepare].call(ctx, name === 'schedule' ? ctx.selectedSchedule : name === 'parameter' ? ctx.selectedParam : name === 'VM-IP' ? ctx.selectedInstance : ctx.selectedTableCondition)
  change(ctx)
  component.methods[confirm].call(ctx)
  expect(ctx[mutation]).not.toHaveBeenCalled()
  expect(ctx.$message.warning).toHaveBeenCalledWith('message.autoscale.selection.stale')
})
test.each(removalCases)('%s confirmation cannot mutate a different group after navigation', (name, component, prepare, confirm, mutation, setup) => {
  const ctx = removalContext(setup, mutation)
  component.methods[prepare].call(ctx, name === 'schedule' ? ctx.selectedSchedule : name === 'parameter' ? ctx.selectedParam : name === 'VM-IP' ? ctx.selectedInstance : ctx.selectedTableCondition)
  ctx.resource = { id: 'another-group' }
  component.methods[confirm].call(ctx)
  expect(ctx[mutation]).not.toHaveBeenCalled()
})

test.each(['설정 안함', 'None'])('the actual localized library None row %s clears the previous AutoScale selection and variable values', async label => {
  const ctx = userDataContext(true, 'userdataregistered', { userdataid: 'old', userdata: 'retained' })
  ctx.$t = key => key === 'label.noselect' ? label : key
  ctx.userDataValues = { old: 'secret' }
  ResetUserData.methods.updateUserData.call(ctx, NO_USER_DATA)
  await ResetUserData.methods.handleSubmit.call(ctx)
  expect(postAPI).toHaveBeenCalledWith('updateAutoScaleVmProfile', { id: 'profile', userdata: '' })
  expect(getAPI.mock.calls.map(([command]) => command)).not.toContain('listUserData')
})
test('returning to the controlled AutoScale library retains its verified selection and excludes hidden manual text', async () => {
  const ctx = userDataContext(true, 'userdataregistered', { userdataid: 'old-library', userdata: 'manual' })
  ResetUserData.methods.onUserdataTabChange.call(ctx, 'userdatatext', 'userdataTabKey')
  ResetUserData.methods.onUserdataTabChange.call(ctx, 'userdataregistered', 'userdataTabKey')
  await ResetUserData.methods.handleSubmit.call(ctx)
  expect(postAPI).toHaveBeenCalledWith('updateAutoScaleVmProfile', { id: 'profile', userdataid: 'old-library' })
})
test('the same library tab navigation keeps the existing VM request contract', async () => {
  const ctx = userDataContext(false, 'userdataregistered', { userdataid: 'old-library', userdata: 'manual' })
  ResetUserData.methods.onUserdataTabChange.call(ctx, 'userdatatext', 'userdataTabKey')
  ResetUserData.methods.onUserdataTabChange.call(ctx, 'userdataregistered', 'userdataTabKey')
  await ResetUserData.methods.handleSubmit.call(ctx)
  expect(postAPI).toHaveBeenCalledWith('resetUserDataForVirtualMachine', { id: 'vm', userdataid: 'old-library' }, { preserveOnFailure: true })
})
test('consumer rejects mismatched metadata after None without starting a parameter lookup', () => {
  const ctx = { form: { userdataid: 'old' }, userDataParams: [{ key: 'old' }], userDataValues: { old: 'secret' } }
  ResetUserData.methods.updateUserData.call(ctx, NO_USER_DATA)
  ResetUserData.methods.updateUserData.call(ctx, 'script', { id: 'another-script', params: 'old-variable' })
  expect(ctx.form.userdataid).toBeUndefined()
  expect(ctx.userDataParams).toEqual([])
  expect(ctx.userDataValues).toEqual({})
  expect(getAPI).not.toHaveBeenCalled()
})

test.each([Up, Down])('policy row actions select the clicked policy independently of the prior selection', component => {
  const ctx = { selectedPolicyId: 'old', switchPolicy: jest.fn() }
  component.methods.selectPolicy.call(ctx, { id: 'clicked' })
  expect(ctx.selectedPolicyId).toBe('clicked')
  expect(ctx.switchPolicy).toHaveBeenCalledTimes(1)
})
test('VM row detach pins exactly the clicked IP when the same VM has several addresses', () => {
  const rows = ['10.0.0.2', '10.0.0.3'].map(ip => ({ key: 'vm/' + ip, ip, instance: { loadbalancerruleinstance: { id: 'vm' } } }))
  const ctx = { resource: { id: 'group' }, currentRule: { id: 'rule' }, ruleInstances: rows, selectedInstance: rows[0], loading: false, handleDeleteInstanceFromRule: jest.fn(), $t: key => key, $message: { warning: jest.fn() } }
  LB.methods.prepareInstanceRemoval.call(ctx, rows[1])
  LB.methods.confirmInstanceRemoval.call(ctx)
  expect(ctx.handleDeleteInstanceFromRule).toHaveBeenCalledWith(rows[1].instance, ctx.currentRule, '10.0.0.3')
})

test.each(removalCases.filter(([name]) => !name.startsWith('policy')))('%s confirmation from an older row cannot execute a newly opened target', (name, component, prepare, confirm, mutation, setup) => {
  const ctx = removalContext(setup, mutation)
  const first = name === 'schedule' ? ctx.selectedSchedule : name === 'parameter' ? ctx.selectedParam : name === 'VM-IP' ? ctx.selectedInstance : ctx.selectedTableCondition
  component.methods[prepare].call(ctx, first)
  const second = { ...first, id: 'another', name: 'another', key: 'another' }
  component.methods[prepare].call(ctx, second)
  component.methods[confirm].call(ctx, first)
  expect(ctx[mutation]).not.toHaveBeenCalled()
  expect(ctx.$message.warning).toHaveBeenCalledWith('message.autoscale.selection.stale')
})

test.each([Up, Down])('an older policy row confirmation cannot remove a newly selected policy', component => {
  const ctx = { resource: { id: 'group' }, policy: { id: 'first' }, policies: [{ id: 'first' }, { id: 'second' }], loading: false, saving: false, removeScalePolicyFromGroup: jest.fn(), $t: key => key, $message: { warning: jest.fn() } }
  component.methods.preparePolicyRemoval.call(ctx)
  ctx.policy = { id: 'second' }
  component.methods.preparePolicyRemoval.call(ctx)
  component.methods.confirmPolicyRemoval.call(ctx, { id: 'first' })
  expect(ctx.removeScalePolicyFromGroup).not.toHaveBeenCalled()
  expect(ctx.$message.warning).toHaveBeenCalledWith('message.autoscale.selection.stale')
})

function deferred () { let resolveDeferred; let rejectDeferred; const promise = new Promise((resolve, reject) => { resolveDeferred = resolve; rejectDeferred = reject }); return { resolve: resolveDeferred, reject: rejectDeferred, promise } }
function refreshContext (component) {
  const resource = { id: 'group', vmprofileid: 'profile', lbruleid: 'rule', lbprovider: 'VirtualRouter' }
  return { ...component.data.call({ $t: key => key, resource, fetchTimeZone: jest.fn() }), resource, $store: { getters: { userInfo: { id: 'owner' }, project: { id: 'project' } } }, $notifyError: jest.fn(), $t: key => key }
}
test('profile refresh retains existing values and rows without restarting table loading', async () => {
  getAPI.mockReset(); const pending = deferred(); getAPI.mockReturnValue(pending.promise)
  const ctx = refreshContext(Profile); ctx.profileReadScope = autoScaleResourceScope(ctx); ctx.profile = { id: 'profile' }; ctx.allParams = [{ name: 'rootdisksize', value: '100' }]
  ctx.decodeUserData = value => value; ctx.finalizeParams = Profile.methods.finalizeParams.bind(ctx); ctx.fetchTemplateData = jest.fn().mockResolvedValue()
  const update = Profile.methods.fetchData.call(ctx)
  expect(ctx.loading).toBe(false); expect(ctx.profileRefreshing).toBe(true); expect(ctx.allParams).toHaveLength(1)
  pending.resolve({ listautoscalevmprofilesresponse: { autoscalevmprofile: [{ id: 'profile', otherdeployparams: { rootdisksize: '100' } }] } }); await update
  expect(ctx.profileRefreshing).toBe(false); expect(ctx.allParams).toEqual([{ name: 'rootdisksize', value: '100' }])
})
test('a late profile response from another project cannot overwrite its current scope', async () => {
  getAPI.mockReset(); const pending = deferred(); getAPI.mockReturnValue(pending.promise)
  const ctx = refreshContext(Profile); ctx.profileReadScope = autoScaleResourceScope(ctx); ctx.profile = { id: 'old' }; ctx.fetchTemplateData = jest.fn()
  const update = Profile.methods.fetchData.call(ctx); ctx.$store.getters.project = { id: 'another-project' }
  pending.resolve({ listautoscalevmprofilesresponse: { autoscalevmprofile: [{ id: 'foreign' }] } }); await update
  expect(ctx.profile.id).toBe('old'); expect(ctx.fetchTemplateData).not.toHaveBeenCalled()
})
test.each([Up, Down])('policy refresh preserves the existing table until the group reply arrives', async component => {
  getAPI.mockReset(); const pending = deferred(); getAPI.mockImplementation(api => api === 'listAutoScaleVmGroups' ? pending.promise : Promise.resolve({ counterresponse: { counter: [] } }))
  const ctx = refreshContext(component); ctx.policiesReadScope = autoScaleResourceScope(ctx); ctx.policies = [{ id: 'policy', name: 'kept' }]; ctx.selectedPolicyId = 'policy'; ctx.switchPolicy = jest.fn()
  const update = component.methods.fetchInitData.call(ctx)
  expect(ctx.loading).toBe(false); expect(ctx.policies[0].name).toBe('kept')
  const field = component === Up ? 'scaleuppolicies' : 'scaledownpolicies'
  pending.resolve({ listautoscalevmgroupsresponse: { autoscalevmgroup: [{ [field]: [{ id: 'policy', name: 'new' }] }] } }); await update
  expect(ctx.policies[0].name).toBe('new'); expect(ctx.policiesRefreshing).toBe(false)
})
test.each(['success', 'partial-failure', 'late-scope'])('LB refresh commits a complete snapshot and never clears existing VM rows: %s', async outcome => {
  getAPI.mockReset(); const rules = deferred(); const instances = deferred()
  getAPI.mockImplementation(api => api === 'listLoadBalancerRules' ? rules.promise : api === 'listLoadBalancerRuleInstances' ? instances.promise : Promise.resolve({ listlbstickinesspoliciesresponse: { stickinesspolicies: [] }, listautoscalevmgroupsresponse: { autoscalevmgroup: [] } }))
  const ctx = refreshContext(LB); const token = {}; ctx.listRequestToken = () => token; ctx.isListRequestCurrent = () => true; ctx.lbReadScope = autoScaleResourceScope(ctx); ctx.lbRules = [{ id: 'rule', ruleInstances: [{ id: 'kept' }] }]; ctx.stickinessPolicies = []
  const previous = ctx.lbRules; const update = LB.methods.fetchLBRules.call(ctx)
  expect(ctx.loading).toBe(false); expect(ctx.lbRules).toBe(previous)
  rules.resolve({ listloadbalancerrulesresponse: { loadbalancerrule: [{ id: 'rule', name: 'new' }], count: 1 } }); await Promise.resolve(); await Promise.resolve()
  expect(ctx.lbRules).toBe(previous)
  if (outcome === 'late-scope') ctx.resource = { ...ctx.resource, id: 'different-group' }
  if (outcome === 'partial-failure') instances.reject(new Error('offline'))
  else instances.resolve({ listloadbalancerruleinstancesresponse: { lbrulevmidip: [{ id: 'new' }] } })
  await update
  if (outcome === 'late-scope') expect(ctx.lbRules).toBe(previous)
  else expect(ctx.lbRules[0].ruleInstances[0].id).toBe(outcome === 'partial-failure' ? 'kept' : 'new')
  if (outcome === 'partial-failure') expect(ctx.listRefreshFailed).toBe(true)
})
test('AutoScale schedule refresh retains loaded rows even when the tab URL changed', async () => {
  getAPI.mockReset(); const pending = deferred(); getAPI.mockReturnValue(pending.promise)
  const ctx = refreshContext(Schedules); ctx.resourceType = 'AutoScaleVmGroup'; ctx.$refs = {}; ctx.scheduleReadScope = autoScaleResourceScope(ctx); ctx.schedules = [{ id: 'kept' }]; ctx.listRequestToken = () => ({ loaded: false }); ctx.isListRequestCurrent = () => true
  const update = Schedules.methods.fetchSchedules.call(ctx)
  expect(ctx.tabLoading).toBe(false); expect(ctx.schedules[0].id).toBe('kept')
  pending.resolve({ listresourcescheduleresponse: { resourceschedule: [{ id: 'new' }], count: 1 } }); await update
  expect(ctx.schedules[0].id).toBe('new'); expect(ctx.scheduleRefreshing).toBe(false)
})
test('a new stickiness dialog displays None instead of an empty method with cookie fields', () => {
  const ctx = { $t: key => key, initForm: jest.fn(), form: {}, stickinessPolicies: [], selectedStickinessPolicy: { id: 'stale' } }
  LB.methods.openStickinessModal.call(ctx, 'rule')
  expect(ctx.form.methodname).toBe('none'); expect(ctx.stickinessPolicyMethod).toBe('none'); expect(ctx.selectedStickinessPolicy).toBeNull()
})
test('an existing SourceBased policy pre-fills its source settings', async () => {
  const policy = { methodname: 'SourceBased', params: { tablesize: '10000', expire: '600' } }
  const ctx = { $t: key => key, initForm: jest.fn(), form: {}, stickinessPolicies: [{ lbruleid: 'rule', stickinesspolicy: [policy] }] }
  LB.methods.openStickinessModal.call(ctx, 'rule'); await nextTick()
  expect(ctx.form.methodname).toBe('SourceBased'); expect(ctx.form.tablesize).toBe('10000'); expect(ctx.form.expire).toBe('600')
})
