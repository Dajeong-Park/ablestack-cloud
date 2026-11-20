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
import { kmsDetails, kmsSearchFields } from '@/utils/kmsSearch'

import { actionAvailability, kmsAvailabilityLabel } from '@/utils/kmsAvailability'

const availability = api => {
  const reason = (resource, getters) => actionAvailability(api, { resource, scope: { role: getters.userInfo?.roletype }, apis: getters.apis })
  return {
    disabled: (resource, getters) => !!reason(resource, getters),
    tooltip: (resource, getters) => kmsAvailabilityLabel(reason(resource, getters))
  }
}

const relatedTab = shallowRef(defineAsyncComponent(() => import('@/views/infra/KmsRelatedResources.vue')))
const operationDialog = shallowRef(defineAsyncComponent(() => import('@/views/infra/KmsOperationDialog.vue')))

export default {
  name: 'kms',
  title: 'label.kms',
  icon: 'lock-outlined',
  show: () => {
    return ['listKMSKeys', 'listHSMProfiles'].some(api => api in store.getters.apis)
  },
  children: [
    {
      name: 'kmskey',
      title: 'label.kms.keys',
      icon: 'file-text-outlined',
      permission: ['listKMSKeys'],
      resourceType: 'KMSKey',
      columns: () => {
        const fields = ['name', 'enabled', 'hsmprofile']
        if (['Admin', 'DomainAdmin'].includes(store.getters.userInfo.roletype)) {
          fields.push('account')
        }
        if (store.getters.listAllProjects) {
          fields.push('project')
        }
        fields.push('domainpath')
        return fields
      },
      details: () => kmsDetails('kmskey', store.getters.userInfo.roletype),
      related: [
        {
          name: 'volume',
          title: 'label.volumes',
          param: 'kmskeyid'
        }
      ],
      tabs: [
        {
          name: 'details',
          component: shallowRef(defineAsyncComponent(() => import('@/components/view/DetailsTab.vue')))
        },
        {
          name: 'kms.used.volumes',
          component: relatedTab,
          show: () => 'listVolumes' in store.getters.apis
        },
        {
          name: 'events',
          resourceType: 'KmsKey',
          component: shallowRef(defineAsyncComponent(() => import('@/components/view/EventsTab.vue'))),
          show: () => {
            return 'listEvents' in store.getters.apis
          }
        }
      ],
      searchFilters: () => kmsSearchFields('listKMSKeys', store.getters),
      actions: [
        {
          api: 'createKMSKey',
          ...availability('createKMSKey'),
          icon: 'plus-outlined',
          label: 'label.create.kms.key',
          docHelp: 'adminguide/kms.html#creating-a-kms-key',
          listView: true,
          popup: true,
          selfManagedDialog: true,
          component: operationDialog,
          dataView: false
        },
        {
          api: 'updateKMSKey',
          ...availability('updateKMSKey'),
          icon: 'edit-outlined',
          label: 'label.update.kms.key',
          dataView: true,
          popup: true,
          selfManagedDialog: true,
          component: operationDialog
        },
        {
          api: 'rotateKMSKey',
          ...availability('rotateKMSKey'),
          icon: 'sync-outlined',
          docHelp: 'adminguide/kms.html#rotating-a-kms-key',
          label: 'label.rotate.kms.key',
          dataView: true,
          popup: true,
          selfManagedDialog: true,
          component: operationDialog
        },
        {
          api: 'migrateVolumesToKMS',
          ...availability('migrateVolumesToKMS'),
          icon: 'swap-outlined',
          docHelp: 'adminguide/kms.html#migrating-existing-volumes-to-kms',
          label: 'label.migrate.volumes.to.kms',
          message: 'message.action.migrate.volumes.to.kms',
          dataView: true,
          selfManagedDialog: true,
          popup: true,
          component: shallowRef(defineAsyncComponent(() => import('@/views/compute/MigrateVolumesToKMS.vue'))),
          show: (record, store) => {
            return ['Admin'].includes(store.userInfo.roletype)
          },
          args: ['kmskeyid', 'volumeids']
        },
        {
          api: 'deleteKMSKey',
          ...availability('deleteKMSKey'),
          icon: 'delete-outlined',
          label: 'label.delete.kms.key',
          message: 'message.action.delete.kms.key',
          dataView: true,
          popup: true,
          selfManagedDialog: true,
          component: operationDialog
        }
      ]
    },
    {
      name: 'hsmprofile',
      title: 'label.hsm.profile',
      icon: 'safety-outlined',
      permission: ['listHSMProfiles'],
      resourceType: 'HSMProfile',
      columns: () => {
        const fields = ['name', 'protocol', 'enabled', 'ispublic']
        if (['Admin', 'DomainAdmin'].includes(store.getters.userInfo.roletype)) {
          fields.push('account')
        }
        if (store.getters.listAllProjects) {
          fields.push('project')
        }
        fields.push('domainpath')
        return fields
      },
      details: () => kmsDetails('hsmprofile', store.getters.userInfo.roletype),
      related: [
        {
          name: 'kmskey',
          title: 'label.kms.keys',
          param: 'hsmprofileid'
        }
      ],
      tabs: [
        {
          name: 'details',
          component: shallowRef(defineAsyncComponent(() => import('@/components/view/DetailsTab.vue')))
        },
        {
          name: 'kms.related.keys',
          component: relatedTab,
          show: () => 'listKMSKeys' in store.getters.apis
        },
        {
          name: 'events',
          resourceType: 'HsmProfile',
          component: shallowRef(defineAsyncComponent(() => import('@/components/view/EventsTab.vue'))),
          show: () => {
            return 'listEvents' in store.getters.apis
          }
        }
      ],
      searchFilters: () => kmsSearchFields('listHSMProfiles', store.getters),
      actions: [
        {
          api: 'createHSMProfile',
          ...availability('createHSMProfile'),
          icon: 'plus-outlined',
          docHelp: 'adminguide/kms.html#adding-an-hsm-profile',
          label: 'label.create.hsmprofile',
          selfManagedDialog: true,
          component: shallowRef(defineAsyncComponent(() => import('@/views/infra/CreateHSMProfile.vue'))),
          listView: true,
          popup: true,
          dataView: false,
          show: (record, store) => {
            return ['Admin'].includes(store.userInfo.roletype)
          },
          args: ['name', 'protocol', 'zoneid', 'vendorname', 'domainid', 'account', 'projectid', 'ispublic', 'details']
        },
        {
          api: 'updateHSMProfile',
          ...availability('updateHSMProfile'),
          icon: 'edit-outlined',
          label: 'label.update.hsm.profile',
          dataView: true,
          popup: true,
          selfManagedDialog: true,
          component: operationDialog,
          show: (record, store) => {
            return ['Admin'].includes(store.userInfo.roletype)
          }
        },
        {
          api: 'deleteHSMProfile',
          ...availability('deleteHSMProfile'),
          icon: 'delete-outlined',
          label: 'label.delete.hsm.profile',
          message: 'message.action.delete.hsm.profile',
          dataView: true,
          popup: true,
          selfManagedDialog: true,
          component: operationDialog,
          show: (record, store) => {
            return ['Admin'].includes(store.userInfo.roletype)
          }
        }
      ]
    }
  ]
}
