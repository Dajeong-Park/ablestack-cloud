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
import { createStore } from 'vuex'
import Wizard from '@/views/compute/DeployVnfAppliance.vue'
import VnfCredentials from '@/components/compute/VnfCredentials'
import { vnfDeploymentNotice } from '@/utils/vnfAccess'
jest.mock('@/api', () => ({ getAPI: jest.fn(), postAPI: jest.fn() }))
jest.mock('@/store', () => ({ getters: { apis: {}, userInfo: {}, project: {} } }))

function subject (passwordenabled = false) {
  const store = createStore({ state: { user: { token: 'old' }, project: {}, info: { id: 'actor', roleid: 'admin' } }, getters: { userInfo: s => s.info, project: s => s.project, apis: () => ({ deployVnfAppliance: {} }) } })
  let finish
  const c = { $route: { path: '/vnfapp' }, form: { templateid: 'a' }, $t: key => key, $notification: { defaultConfig: { onClose: jest.fn() }, success: jest.fn(), close: jest.fn() }, $pollJob: jest.fn(options => { c.job = options; return new Promise(resolve => { finish = resolve }) }) }
  const template = { id: 'a', passwordenabled }
  const notice = vnfDeploymentNotice(store, template, { templateid: 'a' }, () => notice.close?.())
  const pending = Wizard.methods.pollVnfDeployment.call(c, 'job', 'Deploy VNF', 'displayname', notice, 'notice')
  const complete = vm => { const result = { jobstatus: 1, jobinstanceid: 'vm', jobresult: { virtualmachine: { id: 'vm', templateid: 'a', displayname: '<b>label</b>', passwordenabled, ...vm } } }; c.job.successMethod(result); finish(result); return pending }
  return { c, store, template, notice, complete }
}
beforeEach(() => jest.useFakeTimers())
afterEach(() => { jest.runOnlyPendingTimers(); jest.useRealTimers() })
test('accepted job uses common completion tracking and empty credentials never create a notice', async () => {
  const { c, notice, complete } = subject()
  expect(c.$notification.success).not.toHaveBeenCalled()
  expect(c.job.showSuccessMessage).not.toBe(false)
  await complete({ vnfdetails: {} })
  expect(c.$notification.success).not.toHaveBeenCalled(); expect(notice.current()).toBe(false)
})
test('username-only notice is finite, has the actual VM identity and no secret/change hint', async () => {
  const { c, notice, complete } = subject()
  await complete({ password: 'not-allowed', vnfdetails: { username: '<svg>user</svg>', password: 'not-allowed' } })
  const config = c.$notification.success.mock.calls[0][0]
  expect(config.duration).toBe(10); expect(config.placement).toBe('bottomRight')
  expect(config.message).toContain('(vm)'); expect(config.description.type).toBe(VnfCredentials)
  expect(config.description.props.rows).toHaveLength(1); expect(config.description.props.rows[0].secret).toBe(false)
  jest.advanceTimersByTime(10000)
  expect(c.$notification.close).toHaveBeenCalledWith('notice'); expect(notice.current()).toBe(false)
  config.onClose(); expect(c.$notification.defaultConfig.onClose).toHaveBeenCalledTimes(1)
})
test('explicit close only closes this job notice and releases its security observer', async () => {
  const { c, notice, complete } = subject()
  await complete({ vnfdetails: { username: 'user' } })
  c.$notification.success.mock.calls[0][0].description.props.onClose()
  expect(c.$notification.close.mock.calls).toEqual([['notice']]); expect(notice.current()).toBe(false)
  jest.runOnlyPendingTimers(); expect(c.$notification.close).toHaveBeenCalledTimes(1)
  expect(c.$notification.defaultConfig.onClose).toHaveBeenCalledTimes(1)
})
test('frozen enabled policy displays only the completed VM response values; security switch closes it', async () => {
  const { c, store, template, notice, complete } = subject(true)
  template.passwordenabled = false
  await complete({ password: 'generated', vnfdetails: { username: 'user', ssh_password: 'ssh' } })
  expect(c.$notification.success.mock.calls[0][0].description.props.rows.map(row => row.value)).toEqual(['user', 'generated', 'ssh'])
  store.state.user.token = 'new'
  expect(c.$notification.close).toHaveBeenCalledWith('notice'); expect(notice.current()).toBe(false)
})
test.each(['template', 'target', 'project', 'logout'])('late completion after %s transition never announces credentials', async change => {
  const { c, store, complete } = subject(true)
  if (change === 'template') { c.$route.path = '/action/deployVnfAppliance'; c.form.templateid = 'b' }
  if (change === 'target') c.$route.path = '/vnfapp/another'
  if (change === 'project') store.state.project = { id: 'project-b' }
  if (change === 'logout') store.state.user.token = ''
  await complete({ password: 'should-not-appear' })
  expect(c.$notification.success).not.toHaveBeenCalled()
})
