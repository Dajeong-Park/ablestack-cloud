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

import { shallowMount } from '@vue/test-utils'
import { getAPI, postAPI } from '@/api'
import NetBackupHostConfiguration from '@/views/infra/backup/NetBackupHostConfiguration.vue'
import ko from '../../../../public/locales/ko_KR.json'

jest.mock('@/api', () => ({ getAPI: jest.fn(), postAPI: jest.fn() }))

const base = {
  state: 'NOT_CONFIGURED',
  hoststate: 'Up',
  frameworkenabled: true,
  frameworkglobalenabled: true,
  frameworkzoneenabled: true,
  providerenabled: true,
  stagingenabled: true,
  netbackupurl: 'https://netbackup.test/netbackup',
  credentialsconfigured: true,
  moldcredentialsavailable: true,
  vmschedulebackup: true,
  stagingpath: '/stage/ablestack-netbackup',
  incrementalbackup: false,
  backupchainsize: 8,
  settingsource: {
    'backup.framework.enabled': 'Global',
    'backup.framework.provider.plugin': 'Global',
    'backup.plugin.netbackup.url': 'Global',
    'backup.plugin.netbackup.apikey': 'Global',
    'kvm.incremental.backup': 'Global'
  },
  virtualmachine: []
}
const response = info => ({ getnetbackuphostconfigurationresponse: { netbackuphostconfiguration: { ...base, ...info } } })
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve() }

async function mount (info = {}, options = {}) {
  getAPI.mockResolvedValue(response(info))
  const wrapper = shallowMount(NetBackupHostConfiguration, {
    props: { resource: { id: 'host-1', zoneid: 'zone-1', clusterid: 'cluster-1' } },
    global: {
      stubs: {
        ASteps: { template: '<div><slot /></div>' },
        AStep: { props: ['title'], template: '<span>{{ title }}</span>' },
        ADescriptions: { template: '<div><slot /></div>' },
        ADescriptionsItem: { props: ['label'], template: '<div>{{ label }}<slot /></div>' },
        ACard: { props: ['title'], template: '<div>{{ title }}<slot /></div>' },
        ASpin: { template: '<div><slot /></div>' },
        ATypographyParagraph: { template: '<p><slot /></p>' },
        ATag: { template: '<span><slot /></span>' },
        ATable: {
          props: ['columns', 'dataSource'],
          template: '<div><div v-for="record in dataSource" :key="record.key || record.id" :data-setting="record.key"><div v-for="column in columns" :key="column.key"><slot v-if="[\'setting\', \'source\'].includes(column.key)" name="bodyCell" :column="column" :record="record" /><span v-else>{{ record[column.dataIndex] }}</span></div></div></div>'
        },
        ASpace: { template: '<div><slot /></div>' },
        AAlert: { props: ['message', 'description', 'type'], template: '<div :data-type="type">{{ message }} {{ description }}</div>' },
        RouterLink: { props: ['to'], template: '<a :data-route="JSON.stringify(to)"><slot /></a>' }
      },
      mocks: {
        $store: { getters: { apis: { configureNetBackupHost: {} } } },
        $t: key => ko[key] || key,
        $toLocaleDate: value => value,
        $route: { path: '/host/host-1' },
        $pollJob: options.pollJob || jest.fn(async ({ successMethod }) => successMethod())
      }
    }
  })
  await flush()
  return wrapper
}

beforeEach(() => { jest.clearAllMocks(); jest.useFakeTimers() })
afterEach(() => { jest.clearAllTimers(); jest.useRealTimers() })

test('shared configuration starts in Global and displays inherited sources with exact setting names', async () => {
  const w = await mount()
  expect(w.text()).toContain(ko['message.backup.integration.inheritance'])
  expect(w.text()).toContain('backup.thirdparty.staging.*')
  expect(w.text()).toContain('kvm.incremental.backup')
  expect(w.text()).toContain(ko['message.backup.integration.restart'])
  const endpoint = w.find('[data-setting="backup.plugin.netbackup.url"]')
  expect(endpoint.text()).toContain('https://netbackup.test/netbackup')
  expect(endpoint.text()).toContain(ko['label.backup.integration.source.global'])
  expect(JSON.parse(endpoint.find('a').attributes('data-route'))).toEqual({ name: 'globalsetting' })
  const settingsLink = w.findAll('a').find(a => a.text() === ko['label.backup.integration.shared.settings'])
  expect(JSON.parse(settingsLink.attributes('data-route'))).toEqual({ name: 'globalsetting' })
  w.unmount()
})

test('Zone and Cluster overrides link to the scope actually supplying each value', async () => {
  const w = await mount({ settingsource: { ...base.settingsource, 'backup.plugin.netbackup.url': 'Zone', 'kvm.incremental.backup': 'Cluster' }, incrementalbackup: true })
  const endpoint = w.find('[data-setting="backup.plugin.netbackup.url"]')
  expect(endpoint.text()).toContain(ko['label.backup.integration.source.zone'])
  expect(JSON.parse(endpoint.find('a').attributes('data-route'))).toEqual({ path: '/zone/zone-1', query: { tab: 'settings' } })
  const incremental = w.find('[data-setting="kvm.incremental.backup"]')
  expect(incremental.text()).toContain('true')
  expect(JSON.parse(incremental.find('a').attributes('data-route'))).toEqual({ path: '/cluster/cluster-1', query: { tab: 'settings' } })
  w.unmount()
})

test('initial disabled settings stay on shared setup and identify the Global framework master switch', async () => {
  const w = await mount({ state: 'PROVIDER_DISABLED', frameworkenabled: false, frameworkglobalenabled: false, frameworkzoneenabled: false, providerenabled: false, stagingenabled: false })
  expect(w.vm.step).toBe(0)
  expect(w.vm.canRun).toBe(false)
  expect(w.find('[data-setting="backup.framework.enabled"]').text()).toContain('Global: false / Zone: false')
  expect(w.text()).toContain(ko['message.backup.integration.prerequisites'])
  w.unmount()
})

test('default true mode guides offering assignment and VM schedules with an empty inventory', async () => {
  const w = await mount()
  expect(w.text()).toContain(ko['label.backup.integration.schedule'])
  expect(w.text()).toContain(ko['message.backup.integration.next.schedule'])
  expect(w.vm.step).toBe(1)
  await w.setData({ policyName: 'seocho+01', moldUrl: 'http://mold.test/client/api' })
  expect(w.vm.canRun).toBe(true)
  expect(w.vm.canApply).toBe(false)
  expect(w.text()).not.toContain('VM_INCLUDE')
  expect(w.text()).not.toContain('VM_EXCLUDE')
  w.unmount()
})

test('off mode guides offering assignment without requiring or displaying VM schedules', async () => {
  const w = await mount({ vmschedulebackup: false, linkready: true })
  expect(w.text()).toContain(ko['message.backup.integration.next.policy'])
  expect(w.vm.columns.some(column => column.key === 'hasschedule')).toBe(false)
  expect(w.vm.step).toBe(2)
  expect(w.text()).not.toContain(ko['label.backup.integration.schedule'])
  w.unmount()
})

test('applying requires successful preflight for the exact current policy and endpoint', async () => {
  const w = await mount({ state: 'CHECKED', action: 'CHECK', policyname: 'seocho+01', moldurl: 'http://mold.test/client/api' })
  expect(w.vm.canApply).toBe(true)
  await w.setData({ policyName: 'other-policy' })
  expect(w.vm.canApply).toBe(false)
  await w.vm.run('APPLY')
  expect(postAPI).not.toHaveBeenCalled()
  w.unmount()
})

test('policy path mismatch shows expected and actual selections without reporting integration ready', async () => {
  const w = await mount({ state: 'POLICY_PATH_MISMATCH', bootstrappath: '/stage/bootstrap/seocho+01', policyselections: ['/wrong/path'], policypathmatched: false, linkready: false })
  expect(w.text()).toContain('/stage/bootstrap/seocho+01')
  expect(w.text()).toContain('/wrong/path')
  expect(w.text()).toContain(ko['label.backup.integration.path.mismatch'])
  expect(w.find('[data-type="success"]').exists()).toBe(false)
  w.unmount()
})

test('opening a running configuration resumes status polling and unmount cancels polling', async () => {
  const w = await mount({ state: 'RUNNING', operationid: 'operation-1' })
  expect(w.vm.busy).toBe(true)
  getAPI.mockResolvedValue(response({ state: 'COMPLETED', operationid: 'operation-1' }))
  jest.advanceTimersByTime(5000)
  await flush()
  expect(w.vm.busy).toBe(false)
  expect(getAPI).toHaveBeenCalledTimes(2)
  w.unmount()
  jest.advanceTimersByTime(10000)
  expect(getAPI).toHaveBeenCalledTimes(2)
})

test('preflight starts through the admin API without transmitting API keys from the browser', async () => {
  const w = await mount()
  await w.setData({ policyName: 'seocho+01', moldUrl: 'http://mold.test/client/api' })
  postAPI.mockResolvedValue({ configurenetbackuphostresponse: { jobid: 'async-1' } })
  await w.vm.run('CHECK')
  await flush()
  expect(postAPI).toHaveBeenCalledWith('configureNetBackupHost', { hostid: 'host-1', action: 'CHECK', policyname: 'seocho+01', moldurl: 'http://mold.test/client/api' })
  expect(w.vm.submitting).toBe(false)
  w.unmount()
})

test('a late response from a previous Host cannot replace the current Host state', async () => {
  const w = await mount()
  let finish
  getAPI.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const pending = w.vm.load()
  getAPI.mockResolvedValue(response({ policyname: 'host-two-policy' }))
  await w.setProps({ resource: { id: 'host-2', zoneid: 'zone-1', clusterid: 'cluster-1' } })
  await flush()
  finish(response({ policyname: 'stale-policy' }))
  await pending
  expect(w.vm.policyName).toBe('host-two-policy')
  w.unmount()
})

test('disabling the provider in a refreshed Host configuration disables both actions', async () => {
  const w = await mount({ providerenabled: false })
  await w.setData({ policyName: 'seocho+01', moldUrl: 'http://mold.test/client/api' })
  expect(w.vm.canRun).toBe(false)
  expect(w.vm.canApply).toBe(false)
  await w.vm.run('CHECK')
  expect(postAPI).not.toHaveBeenCalled()
  w.unmount()
})

test('a rejected provider status query disables actions using stale previous settings', async () => {
  const w = await mount({ state: 'CHECKED', action: 'CHECK', policyname: 'seocho+01', moldurl: 'http://mold.test/client/api' })
  expect(w.vm.canApply).toBe(true)
  getAPI.mockRejectedValueOnce(new Error('Zone NetBackup provider is disabled'))
  await w.vm.load()
  expect(w.vm.canRun).toBe(false)
  expect(w.vm.canApply).toBe(false)
  expect(w.text()).toContain('Zone NetBackup provider is disabled')
  w.unmount()
})
