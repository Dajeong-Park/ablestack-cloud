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
import { creationVmOsName, creationVmDetails, vmBooleanLabel } from '@/utils/creationVmPresentation'
import Details from '@/components/view/DetailsTab'
const t = key => key
test.each([
  [{ osdisplayname: 'Other Linux (64-bit)', ostypename: 'old' }, 'Other Linux (64-bit)'],
  [{ osdisplayname: null, ostypename: 'Legacy OS' }, 'Legacy OS'],
  [{ osdisplayname: '  ', ostypename: 'Legacy OS' }, 'Legacy OS'],
  [{ osdisplayname: null, ostypename: null }, undefined],
  [{ osdisplayname: false, ostypename: 0 }, undefined],
  [{ details: { 'vm.creation.source': 'true' }, osdisplayname: 'stale' }, 'label.creation.source.os.unspecified'],
  [{ details: { 'vm.creation.source': 'true', 'vm.creation.source.osuuid': 'os-id' }, osdisplayname: 'OS' }, 'OS']
])('shared VM OS presentation keeps canonical, legacy and unspecified-source semantics: %j', (vm, expected) => {
  expect(creationVmOsName(Object.freeze(vm), t)).toBe(expected)
  const copy = creationVmDetails(Object.freeze(vm), t)
  expect(vm).not.toHaveProperty('ostypeid')
  if (expected != null) expect(copy.ostypename).toBe(expected)
})
test.each([true, 'true', 1, '1'])('true representation %j stays affirmative without changing raw data', value => expect(vmBooleanLabel(value)).toBe('label.yes'))
test.each([false, 'false', 0, '0'])('false representation %j stays negative rather than disappearing', value => expect(vmBooleanLabel(value)).toBe('label.no'))
test.each([undefined, null, '', 'missing', 7])('missing or unrecognized boolean %j stays unknown', value => expect(vmBooleanLabel(value)).toBe('label.unknown'))
test.each(['vm', 'vnfapp'])('both %s routes use the existing OS type label', name => {
  expect(Details.methods.getDetailTitle.call({ $route: { meta: { name } } }, 'osdisplayname')).toBe('label.ostypename')
})
