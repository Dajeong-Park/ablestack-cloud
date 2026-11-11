// Licensed under the Apache License, Version 2.0. See the NOTICE file.
import { shallowMount, flushPromises } from '@vue/test-utils'
import { getAPI, postAPI } from '@/api'
import Backup from '@/components/storage/StorageConfigBackupTab'
import Operation from '@/components/storage/StorageConfigurationOperationPanel'
import Preflight from '@/components/storage/StorageConfigurationPreflightPanel'
import ko from '@/../public/locales/ko_KR.json'
import en from '@/../public/locales/en.json'
import { sharedfsDateInput } from '@/utils/sharedfsPresentation'

jest.mock('@/api', () => ({ getAPI: jest.fn(), postAPI: jest.fn() }))
const container = { template: '<div><slot /></div>' }
const button = { props: ['type', 'disabled', 'loading'], emits: ['click'], template: '<button :disabled="disabled || loading" @click="$emit(\'click\')"><slot /></button>' }
const description = { props: ['label'], template: '<div>{{ label }}<slot /></div>' }
const table = {
  props: ['columns', 'dataSource'],
  template: '<table><tbody><tr v-for="(row,i) in dataSource" :key="i"><td v-for="column in columns" :key="column.key"><slot name="bodyCell" :column="column" :record="row">{{ row[column.dataIndex] }}</slot></td></tr></tbody></table>'
}
function options (props, locale = ko) {
  return {
    props,
    global: {
      mocks: { $t: key => locale[key] || key, $toLocaleDate: value => new Date(value).toISOString() },
      stubs: { ATable: table, AButton: button, ADescriptions: container, ADescriptionsItem: description, ATag: container, ASpace: container, AAlert: { props: ['message', 'description'], template: '<div role="alert">{{ message }} {{ description }}</div>' } }
    }
  }
}

beforeEach(() => { jest.clearAllMocks(); postAPI.mockResolvedValue({ managestorageconfigartifactresponse: { storageconfigartifact: { result: { artifacts: [] } } } }) })

test.each([ko, en])('backup table renders numeric creation instant and SharedFS-specific restore labels without changing rows', async locale => {
  const artifact = { id: '8b14d9eb-f595-4bd8-917b-761454a8e1bd', kind: 'LKG', created: 1794168980550, revision: 23, metadata: { coverage: { NFS: 'OBSERVED', SMB: 'UNAVAILABLE' } } }
  const original = JSON.stringify(artifact)
  const w = shallowMount(Backup, options({ instanceid: 'instance', canApply: true }, locale))
  await flushPromises()
  await w.setData({ rows: [artifact] })
  expect(w.text()).toContain('2026-11-08T20:16:20.550Z')
  expect(w.text()).not.toContain('Invalid Date')
  expect(w.text()).toContain(locale['label.sharedfs.config.restore'])
  expect(w.text()).not.toContain(locale['label.backup.restore'])
  expect(w.text()).toContain(locale['label.sharedfs.config.coverage.observed'])
  expect(JSON.stringify(artifact)).toBe(original)
  // No restore/submit was executed: this is UI rendering with fixture data.
  expect(postAPI.mock.calls.map(([, args]) => args.action)).toEqual(['LIST'])
  w.unmount()
})
test.each([null, '', undefined, 'bad', 0, -1])('missing/invalid backup time %s is explicit', value => expect(sharedfsDateInput(value)).toBeNull())
test('numeric string and ISO keep the same instant', () => {
  expect(sharedfsDateInput('1794168980550')).toBe('2026-11-08T20:16:20.550Z')
  expect(sharedfsDateInput('2026-11-08T20:16:20.550Z')).toBe('2026-11-08T20:16:20.550Z')
})
test.each([
  [{ state: 'COMMITTED', phase: 'COMMITTED' }, 'no_separate_rollback'],
  [{ state: 'RECOVERY_REQUIRED', phase: 'COMMITTING', observation: { state: 'VERIFIED' } }, 'guest.applied.sql.pending'],
  [{ state: 'ROLLED_BACK', originalfailure: { phase: 'PREFLIGHT', code: 'DRAIN_REQUIRED' } }, 'rejected_before_change'],
  [{ state: 'ROLLED_BACK', originalfailure: { phase: 'DISPATCH', started: false, code: 'DISPATCH_FAILED' } }, 'rejected_before_change'],
  [{ state: 'RECOVERY_REQUIRED' }, 'not_executed']
])('operation result wording follows phase/state without changing protection: %j', (fields, suffix) => {
  const operation = { id: 'op', requestid: 'request', canresume: fields.state === 'RECOVERY_REQUIRED', configurationprotection: true, ...fields, rollback: { state: 'NOT_NEEDED' } }
  const before = JSON.stringify(operation)
  const w = shallowMount(Operation, options({ operation }))
  expect(w.text()).toContain(ko['label.storage.configuration.rollback.' + suffix])
  if (fields.originalfailure) expect(w.text()).toContain(fields.originalfailure.code)
  expect(JSON.stringify(operation)).toBe(before)
  const buttons = w.findAll('button')
  if (operation.canresume) {
    expect(buttons[0].text()).toBe(ko['label.storage.configuration.resume'])
    expect(buttons[0].attributes('disabled')).toBeUndefined()
  }
  expect(getAPI).not.toHaveBeenCalled()
  w.unmount()
})
test('failed rollback remains visible verbatim and diagnostics are preserved', () => {
  const operation = { state: 'RECOVERY_REQUIRED', originalfailure: { code: 'FIRST_FAILURE', reason: 'initial diagnosis' }, rollback: { state: 'FAILED', code: 'ROLLBACK_FAILED' } }
  const w = shallowMount(Operation, options({ operation }))
  expect(w.text()).toContain('FIRST_FAILURE')
  expect(w.text()).toContain('ROLLBACK_FAILED')
  expect(w.text()).toContain('initial diagnosis')
  w.unmount()
})
test('general online reload wording comes only from the observed impact, not creation-mask assumptions', () => {
  const report = { status: 'READY', revision: 23, impact: { class: 'ONLINE_RELOAD', ackrequired: true, affectedcount: 2 }, checks: [] }
  const w = shallowMount(Preflight, options({ report }))
  expect(w.text()).toContain(ko['message.storage.preflight.online.reload'])
  expect(w.text()).not.toContain(ko['message.storage.creation.online'])
  expect(w.text()).not.toContain(ko['message.storage.creation.ack'])
  expect(w.text()).not.toContain(ko['message.storage.preflight.interruption'])
  expect(report.impact.ackrequired).toBe(true)
  w.unmount()
})
