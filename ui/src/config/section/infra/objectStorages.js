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

export default {
  name: 'objectstore',
  title: 'label.object.storage',
  icon: 'gold-outlined',
  docHelp: 'adminguide/storage.html#object-storage',
  permission: ['listObjectStoragePools'],
  columns: () => {
    var fields = ['name', 'url', 'providername']
    return fields
  },
  details: () => {
    var fields = ['name', 'id', 'url', 'providername']
    return fields
  },
  resourceType: 'ObjectStorage',
  tabs: [{
    name: 'details',
    component: shallowRef(defineAsyncComponent(() => import('@/views/infra/ObjectStoreDetails.vue')))
  }, {
    name: 'buckets',
    component: shallowRef(defineAsyncComponent(() => import('@/views/infra/ObjectStoreBuckets.vue'))),
    show: () => store.getters.userInfo?.roletype === 'Admin' && !!store.getters.apis.listBuckets
  }, {
    name: 'events',
    resourceType: 'ObjectStore',
    component: shallowRef(defineAsyncComponent(() => import('@/components/view/EventsTab.vue'))),
    show: () => { return 'listEvents' in store.getters.apis }
  }, {
    name: 'comments',
    component: shallowRef(defineAsyncComponent(() => import('@/components/view/AnnotationsTab.vue')))
  }],
  actions: [
    {
      api: 'addObjectStoragePool',
      dialogWidth: 'min(720px, calc(100vw - 32px))',
      icon: 'plus-outlined',
      docHelp: 'installguide/configuration.html#add-object-storage',
      label: 'label.add.object.storage',
      listView: true,
      popup: true,
      component: shallowRef(defineAsyncComponent(() => import('@/views/infra/AddObjectStorage.vue')))
    },
    {
      api: 'updateObjectStoragePool',
      icon: 'edit-outlined',
      label: 'label.action.update.object.storage',
      dataView: true,
      popup: true,
      dialogWidth: 'min(720px, calc(100vw - 32px))',
      component: shallowRef(defineAsyncComponent(() => import('@/views/infra/EditObjectStorage.vue')))
    },
    {
      api: 'updateObjectStoragePool',
      name: 'replaceObjectStorageCredentials',
      icon: 'key-outlined',
      label: 'label.objectstore.credentials.replace',
      dialogWidth: 'min(720px, calc(100vw - 32px))',
      dataView: true,
      popup: true,
      component: shallowRef(defineAsyncComponent(() => import('@/views/infra/ReplaceObjectStorageCredentials.vue'))),
      show: record => record.providername === 'Glue'
    },
    {
      api: 'deleteObjectStoragePool',
      icon: 'delete-outlined',
      label: 'label.action.delete.object.storage',
      dataView: true,
      popup: true,
      dialogWidth: 'min(720px, calc(100vw - 32px))',
      component: shallowRef(defineAsyncComponent(() => import('@/views/infra/DeleteObjectStore.vue'))),
      displayName: (record) => { return record.name || record.displayName || record.id }
    }
  ]
}
