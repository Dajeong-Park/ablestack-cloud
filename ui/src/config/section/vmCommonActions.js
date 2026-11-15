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

import { shallowRef, defineAsyncComponent } from 'vue'
import { vmUserDataSupported } from '@/utils/vmUserData'
import { isVnfVm, vnfUnmanageReason } from '@/utils/vnfVmActions'

export const vmStoredUserDataAction = () => ({
  api: 'getVirtualMachineUserData',
  show: (_, store) => vmUserDataSupported(store.apis),
  selfManagedDialog: true,
  icon: 'file-search-outlined',
  label: 'label.userdata.vm.stored',
  dataView: true,
  popup: true,
  component: shallowRef(defineAsyncComponent(() => import('@/views/compute/ViewVmUserData')))
})
export const vmVbmcAction = () => ({
  api: 'listVirtualMachines',
  icon: 'heart-filled',
  label: 'label.vbmc.manage',
  dataView: true,
  popup: true,
  selfManagedDialog: true,
  show: record => record.vmtype !== 'sharedfsvm',
  component: shallowRef(defineAsyncComponent(() => import('@/views/compute/VmVbmcManager.vue')))
})
export const vmUnmanageAction = () => ({
  api: 'unmanageVirtualMachine',
  icon: 'disconnect-outlined',
  label: 'label.action.unmanage.virtualmachine',
  message: 'message.action.unmanage.virtualmachine',
  dataView: true,
  show: record => isVnfVm(record) || record.hypervisor !== 'External' && ['Running', 'Stopped'].includes(record.state) && ['VMware', 'KVM'].includes(record.hypervisor) && record.vmtype !== 'sharedfsvm',
  disabled: (record, store) => isVnfVm(record) && !!vnfUnmanageReason(record, store),
  tooltip: (record, store) => isVnfVm(record) ? vnfUnmanageReason(record, store) : ''
})
export const vmCloneAction = (legacy = {}) => ({
  api: 'cloneVirtualMachine',
  icon: 'file-add-outlined',
  label: 'label.action.clone.vm',
  message: 'message.action.clone.instance',
  docHelp: 'adminguide/virtual_machines.html#cloning-vms',
  dataView: true,
  popup: true,
  show: record => isVnfVm(record) || ['Running', 'Stopped'].includes(record.state) && record.vmtype !== 'sharedfsvm',
  disabled: (record, store, selected) => isVnfVm(record) || !!legacy.disabled?.(record, store, selected),
  tooltip: (record, store, selected) => isVnfVm(record) ? 'message.vnf.action.clone.unsupported' : legacy.tooltip?.(record, store, selected),
  component: shallowRef(defineAsyncComponent(() => import('@/views/compute/CloneVM.vue')))
})
