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

import { shallowRef, defineAsyncComponent } from 'vue'
import store from '@/store'
import { roleTypes } from '@/utils/roleSearch'
import { canRoleAction, roleEditFields } from '@/utils/roleActions'

const roleLifecycleDialog = shallowRef(defineAsyncComponent(() => import('@/views/iam/RoleLifecycleDialog.vue')))

export default {
  name: 'role',
  title: 'label.roles',
  icon: 'idcard-outlined',
  docHelp: 'adminguide/accounts.html#roles',
  permission: ['listRoles', 'listRolePermissions'],
  searchFilters: ['name', 'type', 'state', 'id'],
  columns: ['name', 'type', 'description', 'state'],
  details: ['name', 'id', 'type', 'description', 'ispublic'],
  tabs: [{
    name: 'details',
    component: shallowRef(defineAsyncComponent(() => import('@/components/view/DetailsTab.vue')))
  }, {
    name: 'rules',
    component: shallowRef(defineAsyncComponent(() => import('@/views/iam/RolePermissionTab.vue')))
  }, {
    name: 'events',
    resourceType: 'Role',
    component: shallowRef(defineAsyncComponent(() => import('@/components/view/EventsTab.vue'))),
    show: () => { return 'listEvents' in store.getters.apis }
  }],
  actions: [
    {
      api: 'createRole',
      icon: 'plus-outlined',
      label: 'label.add.role',
      listView: true,
      popup: true,
      component: shallowRef(defineAsyncComponent(() => import('@/views/iam/CreateRole.vue')))
    },
    {
      api: 'importRole',
      icon: 'cloud-upload-outlined',
      label: 'label.import.role',
      listView: true,
      popup: true,
      component: shallowRef(defineAsyncComponent(() => import('@/views/iam/ImportRole.vue')))
    },
    {
      api: 'enableRole',
      icon: 'play-circle-outlined',
      label: 'label.action.enable.role',
      dataView: true,
      show: (record, getters) => canRoleAction('enableRole', record, getters.apis),
      popup: true,
      component: roleLifecycleDialog
    },
    {
      api: 'disableRole',
      icon: 'pause-circle-outlined',
      label: 'label.action.disable.role',
      dataView: true,
      show: (record, getters) => canRoleAction('disableRole', record, getters.apis),
      popup: true,
      component: roleLifecycleDialog
    },
    {
      api: 'updateRole',
      icon: 'edit-outlined',
      label: 'label.edit.role',
      dataView: true,
      args: roleEditFields,
      mapping: {
        type: {
          options: roleTypes
        }
      }
    },
    {
      api: 'deleteRole',
      icon: 'delete-outlined',
      label: 'label.delete.role',
      dataView: true,
      show: (record, getters) => canRoleAction('deleteRole', record, getters.apis),
      popup: true,
      component: roleLifecycleDialog
    }
  ]
}
