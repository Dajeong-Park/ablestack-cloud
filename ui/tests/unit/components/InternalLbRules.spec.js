// Licensed to the Apache Software Foundation (ASF) under one or more
// contributor license agreements. See NOTICE for copyright ownership.
// Licensed under the Apache License, Version 2.0 (the "License");
// http://www.apache.org/licenses/LICENSE-2.0 . Distributed AS IS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND.
import { mount } from '@vue/test-utils'
import { reactive, nextTick } from 'vue'
import Rules from '@/components/network/InternalLbRules.vue'
import eventBus from '@/config/eventBus'

const rule = { sourceport: 19018, instanceport: 22, state: 'Active' }
const status = { name: 'Status', props: { text: String, displayText: Boolean }, template: '<span class="standard-status">{{ text }}</span>' }
let wrappers
beforeEach(() => { wrappers = [] })
afterEach(() => { wrappers.forEach(w => w.unmount()) })
function render (record = { id: 'lb', loadbalancerrule: [rule] }) {
  const getters = reactive({ project: {}, listAllProjects: false, apis: { listLoadBalancers: {} } })
  const route = reactive({ params: {}, meta: { name: 'ilb' } })
  const read = reactive({ pending: false, failed: false })
  const w = mount(Rules, {
    props: { record },
    global: {
      mocks: { $t: key => key, $store: { getters }, $route: route },
      provide: { resourceReadPending: () => read.pending, resourceReadFailed: () => read.failed },
      stubs: { Status: status }
    }
  })
  wrappers.push(w)
  return { w, getters, route, read }
}
test('one rule uses semantic port values and the shared status contract instead of raw JSON', () => {
  const { w } = render()
  expect(w.findAll('dt').map(e => e.text())).toEqual(['label.sourceport', 'label.instanceport', 'label.state'])
  expect(w.findAll('dd').map(e => e.text())).toEqual(['19018', '22', 'Active'])
  expect(w.getComponent({ name: 'Status' }).props('displayText')).toBe(true)
  expect(w.text()).not.toContain('{')
})
test('multiple rules retain their order, ports and states', () => {
  const { w } = render({ id: 'lb', loadbalancerrule: [rule, { sourceport: ' 19019 ', instanceport: '443', state: 'Add' }] })
  expect(w.findAll('dl')).toHaveLength(2)
  expect(w.findAll('dd').map(e => e.text())).toEqual(['19018', '22', 'Active', '19019', '443', 'Add'])
})
test.each([undefined, null, [], {}, '[]', 0, [null, true, [], 'invalid']])('missing or malformed rule collection %p renders a dash', value => {
  expect(render({ id: 'lb', loadbalancerrule: value }).w.text()).toBe('—')
})
test.each([undefined, null, '', 0, -1, 65536, '1e3', {}, [], true, '<script>'])('invalid port %p is never stringified into a value', value => {
  const { w } = render({ id: 'lb', loadbalancerrule: [{ sourceport: value, instanceport: value }] })
  expect(w.findAll('dd').map(e => e.text())).toEqual(['—', '—', '—'])
})
test('valid port bounds and unknown status are safely displayed', () => {
  const { w } = render({ id: 'lb', loadbalancerrule: [{ sourceport: 1, instanceport: 65535, state: '<img src=x onerror=alert(1)>' }] })
  expect(w.get('dd').text()).toBe('1')
  expect(w.text()).toContain('65535')
  expect(w.find('img').exists()).toBe(false)
})
test('record replacement removes previous rules and supports recovery without local caching', async () => {
  const { w } = render()
  await w.setProps({ record: { id: 'other' } })
  expect(w.text()).toBe('—')
  await w.setProps({ record: { id: 'other', loadbalancerrule: [{ ...rule, sourceport: 443 }] } })
  expect(w.text()).toContain('443')
  expect(w.text()).not.toContain('19018')
})
test.each(['pending', 'failed'])('%s read hides old rules and successful current read restores unchanged data', async key => {
  const { w, read } = render()
  read[key] = true; await nextTick()
  expect(w.text()).toBe('—')
  read[key] = false; await nextTick()
  expect(w.text()).toContain('19018')
})
test('loading clears previous rules', async () => {
  const { w } = render()
  await w.setProps({ loading: true })
  expect(w.text()).toBe('—')
})
test('route id mismatch suppresses old resource rules', async () => {
  const { w, route } = render()
  route.params.id = 'other'; await nextTick()
  expect(w.text()).toBe('—')
})
test('project switch starts immediately and cannot disclose the prior default record in another project', async () => {
  const { w, getters } = render()
  eventBus.emit('project-switch-start'); await nextTick()
  expect(w.text()).toBe('—')
  getters.project.id = 'project'; eventBus.emit('project-switch-end'); await nextTick()
  expect(w.text()).toBe('—')
  await w.setProps({ record: { id: 'project-lb', projectid: 'project', loadbalancerrule: [rule] } })
  expect(w.text()).toContain('19018')
  getters.project = {}; await nextTick()
  expect(w.text()).toBe('—')
  getters.listAllProjects = true; await nextTick()
  expect(w.text()).toContain('19018')
})
test('failed project transition can return to the same record', async () => {
  const { w } = render()
  eventBus.emit('project-switch-start'); await nextTick()
  expect(w.text()).toBe('—')
  eventBus.emit('project-switch-end'); await nextTick()
  expect(w.text()).toContain('19018')
})
test('missing read permission suppresses prior rules', async () => {
  const { w, getters } = render()
  getters.apis = {}; await nextTick()
  expect(w.text()).toBe('—')
})
