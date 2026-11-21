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
import { reactive } from 'vue'
import AclRulesTab from '@/views/network/AclRulesTab.vue'
import ImportNetworkACL from '@/views/network/ImportNetworkACL.vue'
import { aclCommands, discoverAclAccess, resolveAclScope, runAclWrite } from '@/utils/vpcAclAccess'
import { getAPI, postAPI } from '@/api'
import { aclCsvError, formatAclCsv, parseAclCsv } from '@/utils/aclCsv'

jest.mock('@/api', () => ({ getAPI: jest.fn(), postAPI: jest.fn() }))

const acl = { id: 'acl', vpcid: 'vpc', name: 'review' }
const rules = [
  { id: 'rule1', number: 10, reason: 'original', protocol: 'all', action: 'Deny', traffictype: 'Ingress' },
  { id: 'rule2', number: 20 }
]
const allApis = ['queryAsyncJobResult', ...Object.values(aclCommands)]
const apis = names => ({ listapisresponse: { api: names.map(name => ({ name })) } })
const ruleList = { listnetworkaclsresponse: { networkacl: rules } }
const job = status => ({ queryasyncjobresultresponse: { jobid: 'job', jobstatus: status } })
const defaultGet = command => Promise.resolve({
  listApis: apis(allApis),
  listNetworkACLLists: { listnetworkacllistsresponse: { networkacllist: [acl] } },
  listNetworkACLs: ruleList,
  listTags: { listtagsresponse: { tag: [] } },
  queryAsyncJobResult: job(1)
}[command])
const denied = status => ({ response: { status, data: { updateerrorresponse: { errorcode: status, errortext: 'Server response' } } } })
const delayed = () => {
  let finish
  const promise = new Promise(resolve => { finish = resolve })
  return { promise, resolve: finish }
}

const mountOptions = {
  directives: { focus: {}, 'ctrl-enter': {} },
  stubs: {
    MoldDialog: { template: '<div><slot/><slot name="footer"/></div>' },
    'a-form': { template: '<div><slot/></div>', methods: { validate: () => Promise.resolve(), scrollToField () {} } },
    'a-spin': { template: '<div><slot/></div>' },
    'a-alert': true,
    'a-button': true,
    'a-input-search': true,
    'a-empty': true,
    'a-form-item': true,
    'a-select': true,
    'a-input-number': true,
    'a-input': true,
    'a-textarea': true,
    'a-switch': true,
    'a-space': true
  },
  mocks: { $t: key => key, $message: { success: jest.fn() } },
  config: { warnHandler () {} }
}
async function mountTab (role = 'Admin') {
  const route = reactive({ fullPath: '/acllist/acl?tab=acl.rules', name: 'acllist', params: { id: 'acl' } })
  const getters = reactive({ token: 'test', apis: {}, project: { id: 'p1' }, userInfo: { id: 'u', roletype: role } })
  const wrapper = shallowMount(AclRulesTab, { props: { resource: acl }, global: { ...mountOptions, mocks: { ...mountOptions.mocks, $route: route, $store: { getters, state: { user: {} } } } } })
  await flushPromises()
  return { wrapper, route, getters }
}

beforeEach(() => {
  jest.resetAllMocks()
  getAPI.mockImplementation(defaultGet)
  postAPI.mockResolvedValue({ createnetworkaclresponse: { jobid: 'job' } })
})

test.each(Object.keys(aclCommands).filter(key => key !== 'readTags'))('gates %s independently', async action => {
  const access = await discoverAclAccess(() => apis(allApis.filter(name => name !== aclCommands[action])), { row: acl, params: { projectid: 'p1' } }, false)
  expect(access[action]).toBe(false)
  expect(access.readTags).toBe(true)
  expect(Object.keys(access).filter(key => access[key])).toHaveLength(Object.keys(aclCommands).length - 1)
})

function mockRuleDisplay (value, supported = true) {
  const rule = { ...rules[0], fordisplay: value }
  const discovery = apis(allApis)
  if (supported) discovery.listapisresponse.api.find(api => api.name === aclCommands.edit).params = [{ name: 'fordisplay' }]
  getAPI.mockImplementation(command => {
    if (command === 'listApis') return Promise.resolve(discovery)
    if (command === 'listNetworkACLs') return Promise.resolve({ listnetworkaclsresponse: { networkacl: [rule] } })
    return defaultGet(command)
  })
  return rule
}

test.each([
  [false, false, undefined],
  [true, true, undefined],
  [true, false, false],
  [false, true, true]
])('admin rule edit sends display only when explicitly changed from %s to %s', async (original, edited, expected) => {
  const rule = mockRuleDisplay(original)
  const { wrapper } = await mountTab()
  const vm = wrapper.vm
  await vm.openRule('edit', rule)
  expect(vm.canEditDisplay).toBe(true)
  expect(vm.form.fordisplay).toBe(original)
  vm.form.reason = 'updated'
  vm.form.fordisplay = edited
  await vm.submitRule()
  const params = postAPI.mock.calls[0][1]
  expect(params).toMatchObject({ id: rule.id, partialupgrade: false, reason: 'updated' })
  if (expected === undefined) expect(params).not.toHaveProperty('fordisplay')
  else expect(params.fordisplay).toBe(expected)
  wrapper.unmount()
})

test.each([
  ['User', true, false],
  ['Admin', false, false],
  ['Admin', true, undefined]
])('omits display for %s without field access or a known value', async (role, supported, original) => {
  const rule = mockRuleDisplay(original, supported)
  const { wrapper } = await mountTab(role)
  const vm = wrapper.vm
  await vm.openRule('edit', rule)
  expect(vm.canEditDisplay).toBe(false)
  vm.form.fordisplay = true
  await vm.submitRule()
  expect(postAPI.mock.calls[0][1]).not.toHaveProperty('fordisplay')
  wrapper.unmount()
})

test('missing discovery or target does not enable writes; direct link uses VPC project', async () => {
  const get = jest.fn()
    .mockResolvedValueOnce({ listvpcsresponse: { vpc: [{ id: 'vpc', projectid: 'actual' }] } })
    .mockResolvedValueOnce({ listnetworkacllistsresponse: { networkacllist: [acl] } })
  const scope = await resolveAclScope(get, acl)
  expect(get.mock.calls[1][1]).toMatchObject({ projectid: 'actual', id: 'acl' })
  expect(scope.params.projectid).toBe('actual')
  await expect(discoverAclAccess(() => ({ listapisresponse: {} }), scope, true)).rejects.toThrow('discovery')
  await expect(resolveAclScope(get, { ...acl, projectid: 'actual' }, 'other')).resolves.toBeNull()
})

test('read-only controls and direct handlers send no writes; tags remain readable', async () => {
  getAPI.mockImplementation(api => api === 'listApis' ? Promise.resolve(apis(['listTags', 'queryAsyncJobResult'])) : defaultGet(api))
  const { wrapper } = await mountTab()
  const vm = wrapper.vm
  expect(vm.acls).toHaveLength(2)
  expect(vm.notice.message).toBe('message.acl.access.readonly')
  expect(vm.canMove).toBe(false)
  await vm.openRule('edit', rules[0])
  await vm.openRule('add')
  vm.openDialog('remove', rules[0])
  vm.openDialog('import')
  await vm.changeOrder({ moved: { element: rules[0], newIndex: 1 } })
  await vm.moveRule('rule1', 'rule2', null)
  await vm.submitRule()
  expect(vm.dialog).toBeNull()
  vm.openTags(rules[0])
  await flushPromises()
  await vm.writeTag('addTag', { key: 'k', value: 'v' })
  expect(vm.dialog.mode).toBe('tags')
  expect(postAPI).not.toHaveBeenCalled()
  wrapper.unmount()
})

test('discovery outage preserves rules; reload enables only returned commands', async () => {
  getAPI.mockImplementation(api => api === 'listApis' ? Promise.reject(new Error('offline')) : defaultGet(api))
  const { wrapper } = await mountTab()
  expect(wrapper.vm.acls).toHaveLength(2)
  expect(wrapper.vm.notice.retry).toBe(true)
  expect(wrapper.vm.can('edit')).toBe(false)
  getAPI.mockImplementation(api => api === 'listApis' ? Promise.resolve(apis(['queryAsyncJobResult', aclCommands.edit])) : defaultGet(api))
  await wrapper.vm.reload()
  expect(wrapper.vm.can('edit')).toBe(true)
  expect(wrapper.vm.can('import')).toBe(false)
  wrapper.unmount()
})

test.each([431, 530, 0])('retains edit data after failure %s; explicit retry makes one new request', async status => {
  const { wrapper } = await mountTab()
  const vm = wrapper.vm
  await vm.openRule('edit', rules[0])
  vm.form.reason = 'draft'
  postAPI.mockRejectedValueOnce(status ? denied(status) : new Error('offline'))
  await Promise.all([vm.submitRule(), vm.submitRule()])
  expect(vm.form.reason).toBe('draft')
  expect(vm.dialogError.message).toBe('message.acl.write.failed')
  expect(postAPI).toHaveBeenCalledTimes(1)
  await vm.submitRule()
  expect(postAPI).toHaveBeenCalledTimes(2)
  expect(postAPI.mock.calls[1][1]).toMatchObject({ id: 'rule1', reason: 'draft', projectid: 'p1' })
  expect(vm.dialog).toBeNull()
  wrapper.unmount()
})

test('401 retains the form while preventing another write until permission refresh', async () => {
  const { wrapper } = await mountTab()
  const vm = wrapper.vm
  await vm.openRule('edit', rules[0])
  vm.form.reason = 'draft'
  postAPI.mockRejectedValueOnce(denied(401))
  await vm.submitRule()
  expect(vm.form.reason).toBe('draft')
  expect(vm.dialogError.message).toBe('message.acl.access.changed')
  await vm.submitRule()
  expect(postAPI).toHaveBeenCalledTimes(1)
  await vm.reload()
  expect(vm.dialog).toBeNull()
  wrapper.unmount()
})

test('project/route change invalidates stale discovery and accepted requests', async () => {
  const { wrapper, route, getters } = await mountTab()
  const vm = wrapper.vm
  await vm.openRule('edit', rules[0])
  const previous = delayed()
  postAPI.mockReturnValueOnce(previous.promise)
  const attempt = vm.submitRule()
  await flushPromises()
  const old = delayed()
  getAPI.mockImplementation((api, params) => api === 'listApis' && params.projectid === 'p2' ? old.promise : defaultGet(api))
  getters.project = { id: 'p2' }
  expect(vm.dialog).toBeNull()
  await flushPromises()
  route.fullPath = '/vpc'
  route.name = 'vpc'
  getAPI.mockImplementation(api => api === 'listApis' ? Promise.resolve(apis([])) : defaultGet(api))
  old.resolve(apis(allApis))
  previous.resolve({ createnetworkaclresponse: { jobid: 'job' } })
  await attempt
  await flushPromises()
  expect(vm.can('edit')).toBe(false)
  expect(getAPI.mock.calls.filter(([cmd]) => cmd === 'queryAsyncJobResult')).toHaveLength(0)
  wrapper.unmount()
})

test('an accepted mutation can be checked without resubmitting', async () => {
  let pending
  const get = jest.fn().mockRejectedValueOnce(new Error('lost poll')).mockResolvedValueOnce(job(1))
  const op = { get, post: postAPI, command: aclCommands.edit, params: { id: 'rule1' }, current: () => true, accepted: value => { pending = value } }
  await expect(runAclWrite(op)).rejects.toThrow('lost poll')
  expect(pending).toBe('job')
  await expect(runAclWrite({ ...op, pending })).resolves.toBe(true)
  expect(postAPI).toHaveBeenCalledTimes(1)
})

test('drag and top/bottom use move permission and send the intended neighbors', async () => {
  const { wrapper } = await mountTab()
  const vm = wrapper.vm
  postAPI.mockResolvedValue({ moveNetworkAclItemResponse: { jobid: 'job' } })
  vm.dragScope = vm.scope
  vm.acls = [rules[1], rules[0]]
  await vm.changeOrder({ moved: { element: rules[0], newIndex: 1 } })
  expect(postAPI).toHaveBeenLastCalledWith('moveNetworkAclItem', expect.objectContaining({ id: 'rule1', previousaclruleid: 'rule2', nextaclruleid: undefined, projectid: 'p1' }), expect.anything())
  vm.searchQuery = 'filtered'
  await vm.moveRule('rule1', 'rule2', null)
  expect(postAPI).toHaveBeenCalledTimes(1)
  wrapper.unmount()
})

test('CSV validates quoted fields, preserves failed input and ignores stale file reads', async () => {
  const csv = 'protocol,cidrlist,traffictype,reason\nall,"192.0.2.0/24,198.51.100.0/24",ingress,"check ""quoted"" reason"'
  expect(parseAclCsv(csv)[0].reason).toBe('check "quoted" reason')
  expect(() => parseAclCsv('protocol,number\nall,10')).toThrow()
  let allowed = true
  const wrapper = shallowMount(ImportNetworkACL, { props: { resource: acl, projectArgs: { projectid: 'p1' }, canWrite: () => allowed }, global: mountOptions })
  const vm = wrapper.vm
  await vm.readFile({ name: 'test.csv', text: async () => csv })
  postAPI.mockRejectedValueOnce(denied(431))
  await vm.handleSubmit()
  expect(vm.csvData).toHaveLength(1)
  expect(vm.error.message).toBe('message.acl.import.failed')
  const read = delayed()
  const stale = vm.readFile({ name: 'later.csv', text: () => read.promise })
  allowed = false
  read.resolve(csv)
  await stale
  await vm.handleSubmit()
  expect(vm.csvData).toHaveLength(0)
  expect(postAPI).toHaveBeenCalledTimes(1)
  wrapper.unmount()
})

test('CSV retains physical line numbers, quotes, multiline reasons and empty fields', () => {
  const one = { protocol: 'tcp', cidrlist: '192.0.2.0/24,2001:db8::/64', traffictype: 'Ingress', reason: '  "문자",\nthen line  ' }
  const two = { protocol: 'all', cidrlist: '', traffictype: 'Egress', reason: 'null' }
  const rows = parseAclCsv(formatAclCsv([one, two]))
  expect(rows[0]).toMatchObject({ ...one, line: 2 })
  expect(rows[1]).toMatchObject({ reason: 'null', line: 4 })
  expect(rows[1]).not.toHaveProperty('cidrlist')
  expect(rows.map(aclCsvError)).toEqual(['', ''])
  expect(aclCsvError(parseAclCsv('protocol,cidrlist,traffictype,startport,endport\ntcp,0.0.0.0/0,ingress,65536,65535')[0])).toBe('message.acl.csv.row.ports')
  expect(aclCsvError(parseAclCsv('protocol,cidrlist,traffictype\nall,invalid,ingress')[0])).toBe('message.acl.csv.row.cidr')
  expect(aclCsvError(parseAclCsv('protocol,cidrlist,traffictype\nall,invalid,ingress,extra')[0])).toBe('message.acl.csv.row.columns')
})

test('CSV checks the same pending job and submits only a repaired failed row', async () => {
  const wrapper = shallowMount(ImportNetworkACL, { props: { resource: acl, projectArgs: {}, canWrite: () => true }, global: mountOptions })
  const vm = wrapper.vm
  await vm.readFile({ name: 'rules.csv', text: async () => 'protocol,cidrlist,traffictype,number\nall,192.0.2.1/32,ingress,10\nall,192.0.2.2/32,egress,10' })
  postAPI.mockResolvedValue({ importnetworkaclresponse: { jobid: 'job' } })
  getAPI.mockRejectedValueOnce(new Error('poll lost'))
  await vm.handleSubmit()
  expect(vm.pending).toBe('job')
  getAPI.mockResolvedValueOnce({
    queryasyncjobresultresponse: {
      jobstatus: 1, jobid: 'job', jobresult: { networkaclimport: { successcount: 1, failurecount: 1, applied: true, importedrules: [{ id: 'new' }], failedrows: { 3: 'Duplicate rule' } } }
    }
  })
  await vm.handleSubmit()
  expect(postAPI).toHaveBeenCalledTimes(1)
  expect(vm.report).toEqual({ saved: 1, failed: 1, applied: true })
  expect(vm.csvData.map(row => row.line)).toEqual([3])
  vm.editor = { ...vm.csvData[0], number: '30' }
  vm.saveEdit()
  getAPI.mockResolvedValueOnce({
    queryasyncjobresultresponse: {
      jobstatus: 1, jobid: 'job', jobresult: { networkaclimport: { successcount: 1, failurecount: 0, applied: true, importedrules: [{ id: 'newer' }], failedrows: {} } }
    }
  })
  await vm.handleSubmit()
  const params = postAPI.mock.calls[1][1]
  expect(params['rules[3].number']).toBe('30')
  expect(Object.keys(params).some(key => key.startsWith('rules[2]'))).toBe(false)
  expect(vm.report).toEqual({ saved: 1, failed: 0, applied: true })
  vm.closeAction()
  expect(wrapper.emitted('imported')).toHaveLength(1)
  wrapper.unmount()
})
