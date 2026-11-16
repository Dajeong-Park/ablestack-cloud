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
import { templateAvailability } from '@/utils/templateAvailability'
import { isoBoolean, isoRegistrationCapability, canIsoAction } from '@/utils/isoModel'
import { canManageImagePermissions } from '@/utils/imagePermissions'
import { isStorageServiceTemplate, canReadTemplateRuntimeCatalog } from '@/utils/templateDetails'
import { isZoneCreated } from '@/utils/zone'
import { canKubernetesIsoAction } from '@/utils/kubernetesIsoCapabilities'
import kubernetesIcon from '@/assets/icons/kubernetes.svg?inline'

export default {
  name: 'image',
  title: 'label.images',
  icon: 'picture-outlined',
  docHelp: 'adminguide/templates.html',
  children: [
    {
      name: 'template',
      title: 'label.templates',
      icon: 'save-outlined',
      docHelp: 'adminguide/templates.html',
      permission: ['listTemplates'],
      params: { templatefilter: 'self', showunique: 'true' },
      resourceType: 'Template',
      filters: ['self', 'shared', 'featured', 'community'],
      columns: () => {
        var fields = ['name',
          {
            state: record => templateAvailability(record).state
          }, 'format', 'ostypename', 'arch', 'hypervisor']
        if (['Admin', 'DomainAdmin'].includes(store.getters.userInfo.roletype)) {
          fields.push('size')
          fields.push('account')
        }
        if (store.getters.listAllProjects) {
          fields.push('project')
        }
        if (['Admin'].includes(store.getters.userInfo.roletype)) {
          fields.push('templatetype')
          fields.push('order')
        }
        return fields
      },
      details: () => {
        var fields = ['name', 'id', 'displaytext', 'checksum', 'hypervisor', 'arch', 'format', 'externalprovisioner', 'ostypename', 'size', 'physicalsize', 'isready', 'passwordenabled',
          'sshkeyenabled', 'requireshvm', 'templatetype', 'directdownload', 'deployasis', 'ispublic', 'isfeatured', 'isextractable', 'isdynamicallyscalable', 'crossZones',
          'account', 'domain', 'created', 'userdatadetails', 'userdatapolicy', 'forcks', 'url']
        if (['Admin'].includes(store.getters.userInfo.roletype)) {
          fields.push('templatetag', 'kvdoenable')
        }
        return fields
      },
      searchFilters: () => {
        var filters = ['name', 'zoneid', 'tags', 'arch', 'oscategoryid', 'templatetype', 'extensionid', 'isready', 'hypervisor', 'forcks', 'userdataid']
        if (['Admin', 'DomainAdmin'].includes(store.getters.userInfo.roletype)) {
          filters.push('storageid')
          filters.push('imagestoreid')
        }
        return filters
      },
      related: [{
        name: 'vm',
        title: 'label.instances',
        param: 'templateid'
      }],
      tabs: [{
        name: 'details',
        component: shallowRef(defineAsyncComponent(() => import('@/components/view/DetailsTab.vue')))
      }, {
        name: 'zones',
        component: shallowRef(defineAsyncComponent(() => import('@/views/image/TemplateZones.vue')))
      }, {
        name: 'settings',
        component: shallowRef(defineAsyncComponent(() => import('@/views/image/TemplateSettingsTab.vue')))
      }, {
        name: 'vnf.settings',
        component: shallowRef(defineAsyncComponent(() => import('@/views/image/TemplateVnfSettings.vue'))),
        show: (record) => { return record.templatetype === 'VNF' && 'updateVnfTemplate' in store.getters.apis }
      },
      { name: 'runtime.catalog', label: () => 'runtime.bundle.tab', component: shallowRef(defineAsyncComponent(() => import('@/views/tools/RuntimeBundleCatalogSummary.vue'))), show: record => canReadTemplateRuntimeCatalog(store.getters) && isStorageServiceTemplate(record) },
      {
        name: 'events',
        resourceType: 'Template',
        component: shallowRef(defineAsyncComponent(() => import('@/components/view/EventsTab.vue'))),
        show: () => { return 'listEvents' in store.getters.apis }
      },
      {
        name: 'comments',
        component: shallowRef(defineAsyncComponent(() => import('@/components/view/AnnotationsTab.vue')))
      }],
      actions: [
        {
          api: 'registerTemplate',
          selfManagedDialog: true,
          icon: 'plus-outlined',
          label: 'label.action.register.template',
          docHelp: 'adminguide/templates.html#uploading-templates-from-a-remote-http-server',
          listView: true,
          popup: true,
          show: isZoneCreated,
          component: shallowRef(defineAsyncComponent(() => import('@/views/image/RegisterOrUploadTemplate.vue')))
        },
        {
          api: 'registerTemplate',
          selfManagedDialog: true,
          icon: 'cloud-upload-outlined',
          label: 'label.upload.template.from.local',
          docHelp: 'adminguide/templates.html#uploading-templates-and-isos-from-a-local-computer',
          listView: true,
          popup: true,
          show: () => { return isZoneCreated() && 'getUploadParamsForTemplate' in store.getters.apis },
          component: shallowRef(defineAsyncComponent(() => import('@/views/image/RegisterOrUploadTemplate.vue')))
        },
        {
          api: 'updateTemplate',
          selfManagedDialog: true,
          icon: 'edit-outlined',
          label: 'label.action.edit.template',
          dataView: true,
          show: (record, store) => {
            return (['Admin'].includes(store.userInfo.roletype) || // If admin or owner or belongs to current project
              (record.domainid === store.userInfo.domainid && record.account === store.userInfo.account) ||
              (record.domainid === store.userInfo.domainid && record.projectid && store.project && store.project.id && record.projectid === store.project.id)) &&
              record.isready
          },
          popup: true,
          component: shallowRef(defineAsyncComponent(() => import('@/views/image/UpdateTemplate.vue')))
        },
        {
          api: 'updateTemplatePermissions',
          icon: 'share-alt-outlined',
          label: 'label.action.template.share',
          dataView: true,
          args: (record, store) => {
            const fields = ['isfeatured', 'isextractable']
            if (['Admin'].includes(store.userInfo.roletype) || store.features.userpublictemplateenabled) {
              fields.unshift('ispublic')
            }
            return fields
          },
          show: (record, store) => {
            return (['Admin'].includes(store.userInfo.roletype) || // If admin or owner or belongs to current project
              (record.domainid === store.userInfo.domainid && record.account === store.userInfo.account) ||
              (['Admin', 'DomainAdmin', 'ResourceAdmin'].includes(store.userInfo.roletype) && !store.listAllProjects && record.domainid === store.userInfo.domainid && record.projectid && store.project && store.project.id && record.projectid === store.project.id)) &&
              record.templatetype !== 'SYSTEM' &&
              record.isready
          }
        },
        {
          api: 'extractTemplate',
          icon: 'cloud-download-outlined',
          label: 'label.action.download.template',
          message: 'message.action.download.template',
          docHelp: 'adminguide/templates.html#exporting-templates',
          dataView: true,
          show: (record, store) => {
            return (['Admin'].includes(store.userInfo.roletype) || // If admin or owner or belongs to current project
              ((record.domainid === store.userInfo.domainid && record.account === store.userInfo.account) ||
              (record.domainid === store.userInfo.domainid && record.projectid && store.project && store.project.id && record.projectid === store.project.id)) &&
              record.templatetype !== 'SYSTEM' &&
              record.isextractable) &&
              record.isready
          },
          args: ['zoneid', 'mode'],
          mapping: {
            zoneid: {
              value: (record) => { return record.zoneid }
            },
            mode: {
              value: (record) => { return 'HTTP_DOWNLOAD' }
            }
          },
          response: (result) => { return `Please click <a href="${result.template.url}" target="_blank">${result.template.url}</a> to download.` }
        },
        {
          api: 'updateTemplatePermissions',
          selfManagedDialog: true,
          icon: 'reconciliation-outlined',
          label: 'label.action.template.permission',
          docHelp: 'adminguide/templates.html#sharing-templates-with-other-accounts-projects',
          dataView: true,
          popup: true,
          show: (record, getters) => canManageImagePermissions('template', record, getters),
          component: shallowRef(defineAsyncComponent(() => import('@/views/image/UpdateTemplateIsoPermissions')))
        }
      ]
    },
    {
      name: 'iso',
      title: 'label.isos',
      icon: 'usb-outlined',
      docHelp: 'adminguide/templates.html#working-with-isos',
      permission: ['listIsos'],
      params: { isofilter: 'self', showunique: 'true' },
      resourceType: 'ISO',
      filters: ['self', 'shared', 'featured', 'community'],
      filterLabels: { executable: 'label.iso.filter.executable', selfexecutable: 'label.iso.filter.selfexecutable', sharedexecutable: 'label.iso.filter.sharedexecutable' },
      columns: () => {
        var fields = ['name', 'state', 'ostypename', 'arch']
        if (['Admin', 'DomainAdmin'].includes(store.getters.userInfo.roletype)) {
          fields.push('size')
          fields.push('account')
        }
        if (store.getters.listAllProjects) {
          fields.push('project')
        }
        if (['Admin'].includes(store.getters.userInfo.roletype)) {
          fields.push('order')
        }
        return fields
      },
      details: ['name', 'id', 'displaytext', 'checksum', 'ostypename', 'size', 'arch', 'bootable', 'isready', 'passwordenabled', 'directdownload', 'isextractable', 'ispublic', 'isfeatured', 'isdynamicallyscalable', 'crosszones', 'account', 'domain', 'created', 'userdatadetails', 'userdatapolicy', 'url'],
      searchFilters: () => {
        var filters = ['name', 'zoneid', 'tags', 'arch', 'oscategoryid', 'bootable', 'isready', 'ispublic', 'hypervisor', 'userdataid']
        if (['Admin', 'DomainAdmin'].includes(store.getters.userInfo.roletype)) {
          filters.push('storageid')
          filters.push('imagestoreid')
        }
        return filters
      },
      related: [{
        name: 'vm',
        title: 'label.instances',
        param: 'isoid'
      }],
      tabs: [{
        name: 'details',
        component: shallowRef(defineAsyncComponent(() => import('@/components/view/DetailsTab.vue')))
      }, {
        name: 'zones',
        component: shallowRef(defineAsyncComponent(() => import('@/views/image/IsoZones.vue')))
      },
      {
        name: 'events',
        resourceType: 'Iso',
        component: shallowRef(defineAsyncComponent(() => import('@/components/view/EventsTab.vue'))),
        show: () => { return 'listEvents' in store.getters.apis }
      },
      {
        name: 'comments',
        component: shallowRef(defineAsyncComponent(() => import('@/components/view/AnnotationsTab.vue')))
      }],
      actions: [
        {
          api: 'registerIso',
          selfManagedDialog: true,
          icon: 'plus-outlined',
          label: 'label.action.register.iso',
          docHelp: 'adminguide/templates.html#id10',
          listView: true,
          popup: true,
          show: () => isZoneCreated() && isoRegistrationCapability('url', store.getters).available,
          component: shallowRef(defineAsyncComponent(() => import('@/views/image/RegisterOrUploadIso.vue')))
        },
        {
          api: 'getUploadParamsForIso',
          selfManagedDialog: true,
          icon: 'cloud-upload-outlined',
          label: 'label.upload.iso.from.local',
          show: () => isZoneCreated() && isoRegistrationCapability('local', store.getters).available,
          docHelp: 'adminguide/templates.html#id10',
          listView: true,
          popup: true,
          component: shallowRef(defineAsyncComponent(() => import('@/views/image/RegisterOrUploadIso.vue')))
        },
        {
          api: 'updateIso',
          selfManagedDialog: true,
          icon: 'edit-outlined',
          label: 'label.action.edit.iso',
          dataView: true,
          show: (record, getters) => canIsoAction('edit', record, getters),
          popup: true,
          component: shallowRef(defineAsyncComponent(() => import('@/views/image/UpdateISO.vue')))
        },
        {
          api: 'updateIsoPermissions',
          icon: 'share-alt-outlined',
          label: 'label.action.iso.share',
          dataView: true,
          args: (record, store) => {
            const fields = ['isextractable']
            if (store.userInfo.roletype === 'Admin') fields.unshift('isfeatured')
            if (store.userInfo.roletype === 'Admin' || isoBoolean(store.features.userpublictemplateenabled) === true) {
              fields.unshift('ispublic')
            }
            return fields
          },
          show: (record, getters) => canIsoAction('share', record, getters)
        },
        {
          api: 'attachIso',
          selfManagedDialog: true,
          popup: true,
          icon: 'link-outlined',
          label: 'label.iso.attach.vm',
          dataView: true,
          show: (record, getters) => canIsoAction('attach', record, getters),
          component: shallowRef(defineAsyncComponent(() => import('@/views/image/IsoVmAttach.vue')))
        },
        {
          api: 'extractIso',
          icon: 'cloud-download-outlined',
          label: 'label.action.download.iso',
          message: 'message.action.download.iso',
          docHelp: 'adminguide/templates.html#exporting-templates',
          dataView: true,
          show: (record, getters) => canIsoAction('download', record, getters),
          selfManagedDialog: true,
          popup: true,
          component: shallowRef(defineAsyncComponent(() => import('@/views/image/IsoDownload.vue')))
        },
        {
          api: 'updateIsoPermissions',
          selfManagedDialog: true,
          icon: 'reconciliation-outlined',
          label: 'label.action.iso.permission',
          docHelp: 'adminguide/templates.html#sharing-templates-with-other-accounts-projects',
          dataView: true,
          args: ['op', 'accounts', 'projectids'],
          popup: true,
          show: (record, getters) => canIsoAction('permissions', record, getters),
          component: shallowRef(defineAsyncComponent(() => import('@/views/image/UpdateTemplateIsoPermissions')))
        }
      ]
    },
    {
      name: 'kubernetesiso',
      title: 'label.kubernetes.isos',
      icon: kubernetesIcon,
      docHelp: 'plugins/cloudstack-kubernetes-service.html#kubernetes-supported-versions',
      permission: ['listKubernetesSupportedVersions'],
      searchFilters: ['zoneid', 'minimumsemanticversion', 'minimumkubernetesversionid', 'arch'],
      columns: ['name', 'state', 'semanticversion', 'isostate', 'mincpunumber', 'minmemory', 'arch', 'zonename'],
      details: () => ['name', 'semanticversion', 'supportsautoscaling', 'zoneid', 'zonename', 'isoid', 'isoname', 'isostate', 'arch', 'mincpunumber', 'minmemory', 'supportsha', 'state', 'created', ...(store.getters.userInfo?.roletype === 'Admin' ? ['isourl'] : [])],
      tabs: [
        {
          name: 'details',
          component: shallowRef(defineAsyncComponent(() => import('@/components/view/DetailsTab.vue')))
        },
        {
          name: 'events',
          resourceType: 'KubernetesSupportedVersion',
          component: shallowRef(defineAsyncComponent(() => import('@/components/view/EventsTab.vue'))),
          show: () => { return 'listEvents' in store.getters.apis }
        }
      ],
      actions: [
        {
          api: 'addKubernetesSupportedVersion',
          selfManagedDialog: true,
          icon: 'plus-outlined',
          label: 'label.kubernetes.version.add',
          listView: true,
          popup: true,
          show: (record, getters) => canKubernetesIsoAction('url', record, getters),
          component: shallowRef(defineAsyncComponent(() => import('@/views/image/RegisterKubernetesIso.vue')))
        },
        {
          api: 'getUploadParamsForKubernetesSupportedVersion',
          selfManagedDialog: true,
          icon: 'cloud-upload-outlined',
          label: 'label.kubernetes.version.from.local',
          listView: true,
          popup: true,
          show: (record, getters) => isZoneCreated() && canKubernetesIsoAction('local', record, getters),
          component: shallowRef(defineAsyncComponent(() => import('@/views/image/UploadKubernetesIso.vue')))
        },
        {
          api: 'updateKubernetesSupportedVersion',
          show: (record, getters) => canKubernetesIsoAction('update', record, getters),
          dialogWidth: 1000,
          icon: 'edit-outlined',
          label: 'label.kubernetes.version.update',
          dataView: true,
          popup: true,
          component: shallowRef(defineAsyncComponent(() => import('@/views/image/UpdateKubernetesSupportedVersion.vue')))
        },
        {
          api: 'deleteKubernetesSupportedVersion',
          show: (record, getters) => canKubernetesIsoAction('delete', record, getters),
          icon: 'delete-outlined',
          label: 'label.kubernetes.version.delete',
          message: 'message.kubernetes.version.delete',
          dataView: true
        }
      ]
    }
  ]
}
