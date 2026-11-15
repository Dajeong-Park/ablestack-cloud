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
import directives from '@/utils/directives'
let directive
beforeEach(() => { directives.install({ directive: (name, value) => { if (name === 'ctrlEnter') directive = value } }) })
const key = type => new KeyboardEvent(type, { key: 'Enter', keyCode: 13, ctrlKey: true, bubbles: true, cancelable: true })
test('an explicit false binding disables legacy focus movement and submission, including after a binding update', () => {
  const el = document.createElement('form'); const focus = jest.fn(); const submit = jest.fn(); const instance = { $refs: { submit: { $el: { focus } } } }
  directive.mounted(el, { value: false, instance })
  const down = key('keydown'); const up = key('keyup'); el.dispatchEvent(down); el.dispatchEvent(up)
  expect(down.defaultPrevented).toBe(false); expect(up.defaultPrevented).toBe(false); expect(focus).not.toHaveBeenCalled(); expect(submit).not.toHaveBeenCalled()
  directive.updated(el, { value: submit, instance }); el.dispatchEvent(key('keydown')); el.dispatchEvent(key('keyup'))
  expect(focus).toHaveBeenCalledTimes(1); expect(submit).toHaveBeenCalledTimes(1)
  directive.updated(el, { value: false, instance }); el.dispatchEvent(key('keydown')); el.dispatchEvent(key('keyup'))
  expect(focus).toHaveBeenCalledTimes(1); expect(submit).toHaveBeenCalledTimes(1)
})
