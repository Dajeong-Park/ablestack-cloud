// Licensed to the Apache Software Foundation (ASF) under one or more
// contributor license agreements. See NOTICE. Apache License, Version 2.0.
// http://www.apache.org/licenses/LICENSE-2.0
import { shallowMount } from '@vue/test-utils'
import Panel from '@/components/storage/StorageConfigurationPreflightPanel'
import { preflightApplicable } from '@/utils/storageConfigPreflight'
import wire from '../../../fixtures/storage-1462-parent-wire.json'
import runtimeWire from '../../../fixtures/storage-1462-runtime-parent-wire.json'
import ko from '@/../public/locales/ko_KR.json'

test('actual protected-path API response renders the parent block without allowing acknowledgement', () => {
  const report = wire.preflightstorageserviceconfigurationresponse.configurationpreflight
  const wrapper = shallowMount(Panel, {
    props: { report, acknowledged: true },
    global: { mocks: { $t: key => ko[key] || key } }
  })
  expect(report.status).toBe('BLOCKED')
  expect(wrapper.text()).toContain(ko['message.storage.smb.parent.denied'])
  expect(wrapper.find('code').text()).toBe(report.checks[0].path)
  expect(preflightApplicable(report, true)).toBe(false)
  wrapper.unmount()
})

test('actual runtime binding API block renders its path and keeps acknowledgement blocked', () => {
  const report = runtimeWire.preflightstorageserviceconfigurationresponse.configurationpreflight
  const wrapper = shallowMount(Panel, {
    props: { report, acknowledged: true },
    global: { mocks: { $t: key => ko[key] || key } }
  })
  expect(report.status).toBe('BLOCKED')
  expect(wrapper.text()).toContain(ko['message.storage.smb.parent.runtime_denied'])
  expect(wrapper.find('code').text()).toBe(report.checks[0].path)
  expect(preflightApplicable(report, true)).toBe(false)
  wrapper.unmount()
})
