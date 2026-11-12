// Licensed to the Apache Software Foundation (ASF) under one or more contributor license agreements.
import { shallowMount } from '@vue/test-utils'
import Panel from '@/components/storage/StorageConfigurationOperationPanel.vue'
import { decodeConfigurationOperation } from '@/utils/storageConfigOperation'
import wire from '../fixtures/storage-1462-iscsi-listener-failure-wire.json'
import ko from '@/../public/locales/ko_KR.json'

jest.mock('@/api', () => ({ getAPI: jest.fn() }))

test('actual manager guard through coordinator and DAO renders its first public reason without rollback ambiguity', () => {
  const operation = decodeConfigurationOperation(wire)
  const wrapper = shallowMount(Panel, {
    props: { operation },
    global: {
      mocks: { $t: key => ko[key] || key },
      stubs: {
        'a-alert': { props: ['message', 'description'], template: '<div role="alert">{{ message }} {{ description }}</div>' },
        'a-descriptions': { template: '<div><slot /></div>' },
        'a-descriptions-item': { template: '<div><slot /></div>' }
      }
    }
  })
  expect(operation.state).toBe('ROLLED_BACK')
  expect(operation.rollback.state).toBe('NOT_NEEDED')
  expect(wrapper.text()).toContain('ISCSI_LISTENER_IN_USE')
  expect(wrapper.text()).toContain(ko['message.storage.configuration.reason.iscsi_listener_in_use'])
  expect(wrapper.text()).toContain(ko['label.storage.configuration.preparation.failed'])
  expect(wrapper.text()).toContain(ko['message.storage.configuration.listener.preparation.failed'])
  expect(wrapper.text()).not.toContain(ko['message.storage.configuration.rolled.back'])
  wrapper.unmount()
})
