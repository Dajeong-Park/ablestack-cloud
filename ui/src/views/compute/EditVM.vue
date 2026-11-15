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

<template>
  <a-spin :spinning="loading">
    <a-form
      class="form-layout"
      layout="vertical"
      :ref="formRef"
      :model="form"
      :rules="rules"
      v-ctrl-enter="handleSubmit"
      @finish="handleSubmit">
      <a-alert v-if="!cloneEditRestricted" style="margin-bottom: 5px" type="warning" show-icon>
        <template #message>
          <span v-html="$t('message.restart.vm.to.update.settings')" />
        </template>
      </a-alert>
      <a-form-item name="displayname" ref="displayname">
        <template #label>
          <tooltip-label :title="$t('label.vm.displayname')" :tooltip="apiParams.displayname.description"/>
        </template>
        <a-input
          v-model:value="form.displayname"
          v-focus="true" />
      </a-form-item>
      <a-form-item v-if="!cloneEditRestricted" name="ostypeid" ref="ostypeid">
        <template #label>
          <tooltip-label :title="$t('label.ostypeid')" :tooltip="apiParams.ostypeid.description"/>
        </template>
        <a-select
          showSearch
          optionFilterProp="label"
          :filterOption="(input, option) => {
            return option.label.toLowerCase().indexOf(input.toLowerCase()) >= 0
          }"
          :loading="osTypes.loading"
          :disabled="osTypes.loading || !osTypes.opts.length"
          v-model:value="form.ostypeid">
          <a-select-option v-for="(ostype) in osTypes.opts" :key="ostype.id" :label="ostype.description">
            {{ ostype.description }}
          </a-select-option>
        </a-select>
      </a-form-item>
      <a-form-item v-if="!cloneEditRestricted" name="isdynamicallyscalable" ref="isdynamicallyscalable">
        <template #label>
          <tooltip-label :title="$t('label.isdynamicallyscalable')" :tooltip="apiParams.isdynamicallyscalable.description"/>
        </template>
        <a-switch v-model:checked="form.isdynamicallyscalable" :disabled="!dynamicScalingEditable" />
        <div v-if="!metadataReady" role="status">{{ $t('message.vm.edit.metadata.unavailable') }}</div>
      </a-form-item>
      <a-form-item name="haenable" ref="haenable" v-if="!cloneEditRestricted && serviceOffering?.offerha">
        <template #label>
          <tooltip-label :title="$t('label.haenable')" :tooltip="apiParams.haenable.description"/>
        </template>
        <a-switch v-model:checked="form.haenable" :disabled="offeringStatus !== 'ready'" />
      </a-form-item>
      <a-form-item name="group" ref="group" :extra="$t('message.vm.group.no.restart')">
        <template #label>
          <tooltip-label :title="$t('label.group')" :tooltip="apiParams.group.description"/>
        </template>
        <a-auto-complete
          v-model:value="form.group"
          allowClear
          :disabled="!groupLookupReady"
          :filterOption="(input, option) => {
            return option.value.toLowerCase().indexOf(input.toLowerCase()) >= 0
          }"
          :options="groups.opts" />
        <div role="status" aria-live="polite">{{ $t('message.vm.group.lookup.' + groups.status) }}</div>
        <a-button v-if="['error', 'forbidden', 'empty'].includes(groups.status)" size="small" :loading="groups.loading" @click="fetchInstanceGroups">{{ $t('label.refresh') }}</a-button>
      </a-form-item>
      <a-form-item v-if="!cloneEditRestricted && userDataEnabled">
        <template #label>
          <tooltip-label :title="$t('label.user.data')" :tooltip="apiParams.userdata.description"/>
        </template>
        <a-textarea v-model:value="form.userdata">
        </a-textarea>
      </a-form-item>
      <a-form-item v-if="!cloneEditRestricted && extraConfigEnabled">
        <template #label>
          <tooltip-label :title="$t('label.extraconfig')" :tooltip="$t('label.extraconfig.tooltip')"/>
        </template>
        <a-textarea v-model:value="form.extraconfig"/>
      </a-form-item>
      <a-form-item ref="securitygroupids" name="securitygroupids" :label="$t('label.security.groups')" v-if="!cloneEditRestricted && securityGroupsEnabled">
        <a-select
          mode="multiple"
          v-model:value="form.securitygroupids"
          showSearch
          optionFilterProp="label"
          :filterOption="(input, option) => {
            return option.label.toLowerCase().indexOf(input.toLowerCase()) >= 0
          }"
          :loading="securitygroups.loading"
          v-focus="true">
          <a-select-option v-for="securitygroup in securitygroups.opts" :key="securitygroup.id" :label="securitygroup.name ||  securitygroup.id">
            <div>
              {{ securitygroup.name ||  securitygroup.id }}
            </div>
          </a-select-option>
        </a-select>
      </a-form-item>

      <a-form-item name="deleteprotection" ref="deleteprotection">
        <template #label>
          <tooltip-label :title="$t('label.deleteprotection')" :tooltip="apiParams.deleteprotection.description"/>
        </template>
        <a-switch v-model:checked="form.deleteprotection" />
      </a-form-item>
      <a-form-item name="showLeaseOptions" ref="showLeaseOptions" v-if="!cloneEditRestricted && isLeaseEditable">
        <template #label>
          <tooltip-label :title="$t('label.lease.enable')" :tooltip="$t('label.lease.enable.tooltip')" />
        </template>
        <a-switch v-model:checked="showLeaseOptions" @change="onToggleLeaseData"/>
      </a-form-item>
      <a-row :gutter="12" v-if="!cloneEditRestricted && showLeaseOptions">
        <a-col :md="12" :lg="12">
          <a-form-item name="leaseduration" ref="leaseduration">
            <template #label>
              <tooltip-label :title="$t('label.leaseduration')" />
            </template>
            <a-input
              v-model:value="form.leaseduration"
              :placeholder="$t('label.instance.lease.placeholder')"/>
          </a-form-item>
        </a-col>
        <a-col :md="12" :lg="12">
          <a-form-item name="leaseexpiryaction" ref="leaseexpiryaction">
            <template #label>
              <tooltip-label :title="$t('label.leaseexpiryaction')"  />
            </template>
            <a-select v-model:value="form.leaseexpiryaction" :defaultValue="expiryActions">
              <a-select-option v-for="action in expiryActions" :key="action" :label="action" />
            </a-select>
          </a-form-item>
        </a-col>
      </a-row>

      <mold-dialog-actions :busy="loading || submitPending">
        <a-button :loading="loading" @click="onCloseAction">{{ $t('label.cancel') }}</a-button>
        <a-button :loading="loading" ref="submit" type="primary" @click="handleSubmit">{{ $t('label.ok') }}</a-button>
      </mold-dialog-actions>
    </a-form>
  </a-spin>
</template>

<script>
import { ref, reactive, toRaw } from 'vue'
import { getAPI, postAPI } from '@/api'
import { buildVmGroupUpdate, isGroupOnlyEdit } from '@/utils/vmGroupAssignment'
import { createVmGroupLookup, vmGroupOwnerKey, vmGroupLookupReady } from '@/utils/vmGroupLookup'
import TooltipLabel from '@/components/widgets/TooltipLabel'
import MoldDialogActions from '@/components/view/MoldDialogActions'
import { getFastClonePhase } from '@/utils/fastClone'
import { vmDisplayName, vmEditScope } from '@/utils/vmIdentity'

export default {
  name: 'EditVM',
  components: {
    MoldDialogActions,
    TooltipLabel
  },
  props: {
    action: {
      type: Object,
      required: true
    },
    resource: {
      type: Object,
      required: true
    }
  },
  data () {
    return {
      serviceOffering: {},
      template: {},
      offeringStatus: 'loading',
      templateStatus: 'loading',
      metadataGeneration: 0,
      userDataEnabled: false,
      securityGroupsEnabled: false,
      loading: false,
      editActive: true,
      editGeneration: 0,
      submitPending: false,
      initialForm: {},
      initialResourceContextKey: '',
      securitygroups: {
        loading: false,
        opts: []
      },
      osTypes: {
        loading: false,
        opts: []
      },
      groups: {
        loading: false,
        status: 'unavailable',
        scopeKey: '',
        opts: []
      },
      isLeaseEditable: this.$store.getters.features.instanceleaseenabled && this.resource.leaseduration > -1,
      showLeaseOptions: false,
      leaseduration: this.resource.leaseduration === undefined ? 90 : this.resource.leaseduration,
      leaseexpiryaction: this.resource.leaseexpiryaction === undefined ? 'STOP' : this.resource.leaseexpiryaction,
      expiryActions: ['STOP', 'DESTROY'],
      naturalNumberRule: {
        type: 'number',
        validator: this.validateNumber
      }
    }
  },
  computed: {
    resourceContextKey () {
      return JSON.stringify([vmEditScope(this.resource, this.$route, this.$store), vmGroupOwnerKey(this.resource), this.resource.templateid, this.resource.serviceofferingid, this.resource.zoneid])
    },
    groupLookupReady () { return this.initialResourceContextKey === this.resourceContextKey && vmGroupLookupReady(this.groups, this.resource) },
    metadataReady () { return this.templateStatus === 'ready' && this.offeringStatus === 'ready' },
    dynamicScalingEditable () { return this.metadataReady && this.isDynamicScalingEnabled() },
    cloneEditRestricted () {
      const details = this.resource.details || {}
      const status = String(this.resource.clonefaststatus || details['clone.fast.status'] || '').toLowerCase()
      return !!getFastClonePhase(this.resource) || !!details['clone.fast.source.phase'] ||
        !!details['clone.fast.clone.phase'] || ['pending', 'running'].includes(status)
    },
    extraConfigEnabled () {
      return this.$store.getters.features.additionalconfigenabled
    },
    combinedExtraConfig () {
      if (!this.extraConfigEnabled || !this.resource.details) return ''
      const configs = Object.keys(this.resource.details)
        .filter(key => key.startsWith('extraconfig-'))
        .map(key => this.resource.details[key] || '')
        .filter(val => val.trim())
      return configs.join('\n\n')
    }
  },
  beforeCreate () {
    this.apiParams = this.$getApiParams('updateVirtualMachine')
  },
  created () {
    this.groupLookup = createVmGroupLookup(getAPI, state => { this.groups = state })
    this.initForm()
    this.fetchData()
  },
  watch: {
    resourceContextKey () { this.editGeneration++; this.loading = false; this.submitPending = false; this.initForm(); this.fetchData() },
    '$store.getters.apis.listInstanceGroups' () { this.fetchInstanceGroups() }
  },
  activated () {
    if (!this.editActive) { this.editActive = true; this.initForm(); this.fetchData() }
  },
  deactivated () { this.invalidateEdit() },
  beforeUnmount () { this.invalidateEdit(); this.groupLookup.dispose(); this.metadataGeneration++ },
  methods: {
    invalidateEdit () { this.editActive = false; this.editGeneration++; this.loading = false; this.submitPending = false; this.metadataGeneration++ },
    initForm () {
      this.initialResourceContextKey = this.resourceContextKey
      this.formRef = ref()
      this.form = reactive({
        name: this.resource.name,
        displayname: this.resource.displayname,
        ostypeid: this.resource.ostypeid,
        isdynamicallyscalable: this.resource.isdynamicallyscalable,
        deleteprotection: this.resource.deleteprotection,
        group: this.resource.group,
        userdata: '',
        haenable: this.resource.haenable,
        leaseduration: this.resource.leaseduration,
        leaseexpiryaction: this.resource.leaseexpiryaction,
        extraconfig: this.combinedExtraConfig
      })
      this.rules = reactive({
        leaseduration: [this.naturalNumberRule]
      })
      this.initialForm = JSON.parse(JSON.stringify(toRaw(this.form)))
      this.showLeaseOptions = this.isLeaseEditable
    },
    fetchData () {
      this.metadataGeneration++
      this.serviceOffering = {}
      this.template = {}
      this.userDataEnabled = false
      this.securityGroupsEnabled = false
      this.fetchZoneDetails()
      this.fetchSecurityGroups()
      this.fetchOsTypes()
      this.fetchInstanceGroups()
      this.fetchServiceOfferingData()
      this.fetchTemplateData()
      this.fetchUserData()
    },
    fetchZoneDetails () {
      const generation = this.metadataGeneration
      getAPI('listZones', {
        id: this.resource.zoneid
      }).then(response => {
        if (generation !== this.metadataGeneration) return
        const zone = response?.listzonesresponse?.zone || []
        this.securityGroupsEnabled = zone?.[0]?.securitygroupsenabled || this.$store.getters.showSecurityGroups
      }).catch(() => {})
    },
    fetchSecurityGroups () {
      const generation = this.metadataGeneration
      this.securitygroups.loading = true
      this.securitygroups.opts = []
      getAPI('listSecurityGroups', {
        zoneid: this.resource.zoneid
      }).then(json => {
        if (generation !== this.metadataGeneration) return
        const items = json?.listsecuritygroupsresponse?.securitygroup || []
        if (items && items.length > 0) {
          for (let i = 0; i < items.length; i++) {
            this.securitygroups.opts.push(items[i])
          }
          this.securitygroups.opts.sort((a, b) => {
            if (a.name < b.name) return -1
            if (a.name > b.name) return 1
            return 0
          })
        }
      }).catch(() => {}).finally(() => {
        if (generation === this.metadataGeneration) this.securitygroups.loading = false
      })
    },
    fetchServiceOfferingData () {
      const generation = this.metadataGeneration
      this.offeringStatus = 'loading'
      const params = {}
      params.id = this.resource.serviceofferingid
      params.isrecursive = true
      var apiName = 'listServiceOfferings'
      return getAPI(apiName, params, { preserveOnFailure: true, timeout: 20000 }).then(json => {
        if (generation !== this.metadataGeneration) return
        const offerings = json?.listserviceofferingsresponse?.serviceoffering || []
        this.serviceOffering = offerings[0] || {}
        this.offeringStatus = offerings[0] ? 'ready' : 'empty'
      }).catch(() => { if (generation === this.metadataGeneration) { this.serviceOffering = {}; this.offeringStatus = 'error' } })
    },
    fetchTemplateData () {
      const generation = this.metadataGeneration
      this.templateStatus = 'loading'
      const params = {}
      params.id = this.resource.templateid
      params.isrecursive = true
      params.templatefilter = 'all'
      params.isready = true
      var apiName = 'listTemplates'
      return getAPI(apiName, params, { preserveOnFailure: true, timeout: 20000 }).then(json => {
        if (generation !== this.metadataGeneration) return
        const templates = json?.listtemplatesresponse?.template || []
        this.template = templates[0] || {}
        this.templateStatus = templates[0] ? 'ready' : 'empty'
      }).catch(() => { if (generation === this.metadataGeneration) { this.template = {}; this.templateStatus = 'error' } })
    },
    fetchDynamicScalingVmConfig () {
      const params = {}
      params.name = 'enable.dynamic.scale.vm'
      params.zoneid = this.resource.zoneid
      var apiName = 'listConfigurations'
      getAPI(apiName, params).then(json => {
        const configResponse = json?.listconfigurationsresponse?.configuration || []
        this.dynamicScalingVmConfig = configResponse[0]?.value === 'true'
      }).catch(() => { this.dynamicScalingVmConfig = false })
    },
    canDynamicScalingEnabled () {
      return this.template.isdynamicallyscalable && this.serviceOffering.dynamicscalingenabled && this.dynamicScalingVmConfig
    },
    isDynamicScalingEnabled () {
      return this.template.isdynamicallyscalable && this.serviceOffering.dynamicscalingenabled && this.$store.getters.features.dynamicscalingenabled
    },
    fetchOsTypes () {
      const generation = this.metadataGeneration
      this.osTypes.loading = true
      this.osTypes.opts = []
      getAPI('listOsTypes').then(json => {
        if (generation !== this.metadataGeneration) return
        this.osTypes.opts = json?.listostypesresponse?.ostype || []
      }).catch(error => {
        if (generation === this.metadataGeneration) this.$notifyError(error)
      }).finally(() => { if (generation === this.metadataGeneration) this.osTypes.loading = false })
    },
    fetchInstanceGroups () {
      return this.groupLookup.load(this.resource, 'listInstanceGroups' in this.$store.getters.apis)
    },
    decodeUserData (userdata) {
      const decodedData = Buffer.from(userdata, 'base64')
      return decodedData.toString('utf-8')
    },
    normalizeSecurityGroupIds (securityGroupIds = []) {
      return [...new Set(securityGroupIds)].sort()
    },
    hasSecurityGroupsChanged (currentSecurityGroupIds = []) {
      const initialSecurityGroupIds = this.normalizeSecurityGroupIds((this.resource.securitygroup || []).map(x => x.id))
      const currentIds = this.normalizeSecurityGroupIds(currentSecurityGroupIds)
      return initialSecurityGroupIds.join(',') !== currentIds.join(',')
    },
    fetchUserData () {
      const generation = this.metadataGeneration
      let networkId
      ;(this.resource.nic || []).forEach(nic => {
        if (nic.isdefault) {
          networkId = nic.networkid
        }
      })
      if (!networkId) {
        return
      }
      const listNetworkParams = {
        id: networkId,
        listall: true
      }
      getAPI('listNetworks', listNetworkParams).then(json => {
        if (generation !== this.metadataGeneration) return
        (json?.listnetworksresponse?.network?.[0]?.service || []).forEach(service => {
          if (service.name === 'UserData') {
            const listVmParams = {
              id: this.resource.id,
              userdata: true,
              listall: true
            }
            getAPI('listVirtualMachines', listVmParams).then(json => {
              if (generation !== this.metadataGeneration) return
              const vm = json?.listvirtualmachinesresponse?.virtualmachine?.[0]
              if (!vm) { this.userDataEnabled = false; return }
              this.form.userdata = atob(vm.userdata || '')
              this.initialForm.userdata = this.form.userdata
              this.userDataEnabled = true
            }).catch(() => { if (generation === this.metadataGeneration) this.userDataEnabled = false })
          }
        })
      }).catch(() => { if (generation === this.metadataGeneration) this.userDataEnabled = false })
    },
    handleSubmit () {
      if (!this.editActive || this.submitPending || this.loading || !('updateVirtualMachine' in (this.$store.getters.apis || {}))) return
      const generation = ++this.editGeneration
      const context = this.resourceContextKey
      const actionCurrent = this.action?.currentAction?.vmEditCurrent
      const current = () => this.editActive && generation === this.editGeneration && context === this.resourceContextKey && actionCurrent?.() !== false
      this.submitPending = true
      return this.formRef.value.validate().then(() => {
        if (!current()) return
        const values = { ...toRaw(this.form) }
        if (this.initialResourceContextKey !== this.resourceContextKey) {
          this.$message.error(this.$t('message.vm.group.lookup.blocked'))
          return
        }
        if ((values.group || '') !== (this.resource.group || '') && !this.groupLookupReady) {
          this.$message.error(this.$t('message.vm.group.lookup.blocked'))
          return
        }
        if ((!this.dynamicScalingEditable && values.isdynamicallyscalable !== this.initialForm.isdynamicallyscalable) ||
            (this.offeringStatus !== 'ready' && values.haenable !== this.initialForm.haenable)) {
          this.$message.error(this.$t('message.vm.edit.metadata.unavailable'))
          return
        }
        let params = {}
        params.id = this.resource.id
        params.displayname = values.displayname
        params.ostypeid = values.ostypeid
        if (this.securityGroupNetworkProviderUseThisVM) {
          if (this.hasSecurityGroupsChanged(values.securitygroupids || [])) {
            params.securitygroupids = values.securitygroupids || []
          }
        }
        if (this.dynamicScalingEditable && values.isdynamicallyscalable !== undefined) {
          params.isdynamicallyscalable = values.isdynamicallyscalable
        }
        if (values.deleteprotection !== undefined) {
          params.deleteprotection = values.deleteprotection
        }
        if (this.offeringStatus === 'ready' && values.haenable !== undefined) {
          params.haenable = values.haenable
        }
        let groupUpdate
        try {
          groupUpdate = buildVmGroupUpdate(this.resource, values.group, this.groups.opts, {
            groupId: 'groupid' in this.apiParams,
            clearGroup: 'cleargroup' in this.apiParams
          })
        } catch (error) {
          this.$message.error(this.$t(error.message))
          return
        }
        Object.assign(params, groupUpdate)
        if (this.userDataEnabled && values.userdata && values.userdata.length > 0) {
          params.userdata = this.$toBase64AndURIEncoded(values.userdata)
        }
        if (values.leaseduration !== undefined && (values.leaseduration === -1 || values.leaseduration > 0)) {
          params.leaseduration = values.leaseduration
          if (values.leaseexpiryaction !== undefined) {
            params.leaseexpiryaction = values.leaseexpiryaction
          }
        }
        if (values.extraconfig && values.extraconfig.length > 0) {
          params.extraconfig = encodeURIComponent(values.extraconfig)
        } else if (this.combinedExtraConfig) {
          params.cleanupextraconfig = true
        }
        // Do not submit unchanged hardware or lifecycle settings during a clone operation.
        if (this.cloneEditRestricted) {
          const allowed = ['id', 'displayname', 'group', 'groupid', 'cleargroup', 'deleteprotection']
          Object.keys(params).filter(key => !allowed.includes(key)).forEach(key => delete params[key])
        }
        if (Object.keys(groupUpdate).length > 0 && isGroupOnlyEdit(values, this.initialForm)) {
          params = { id: this.resource.id, ...groupUpdate }
        }
        this.loading = true

        return postAPI('updateVirtualMachine', params).then(json => {
          if (!current()) return
          const vm = json?.updatevirtualmachineresponse?.virtualmachine
          const label = vmDisplayName(vm?.id === params.id ? vm : { id: params.id, name: values.name, displayname: values.displayname })
          this.$message.success({
            content: `${this.$t('label.action.edit.instance')} - ${label}`,
            duration: 2
          })
          this.$emit('refresh-data')
          this.onCloseAction()
        }).catch(error => {
          if (current()) this.$notifyError(error)
        }).finally(() => { if (generation === this.editGeneration) this.loading = false })
      }).catch(error => {
        if (current() && error.errorFields?.length) this.formRef.value.scrollToField(error.errorFields[0].name)
      }).finally(() => { if (generation === this.editGeneration) this.submitPending = false })
    },
    onCloseAction () {
      this.invalidateEdit()
      this.$emit('close-action')
    },
    onToggleLeaseData () {
      if (this.showLeaseOptions === false) {
        this.form.leaseduration = -1
        this.form.leaseexpiryaction = undefined
      } else {
        this.form.leaseduration = this.leaseduration
        this.form.leaseexpiryaction = this.leaseexpiryaction
      }
    },
    async validateNumber (rule, value) {
      if (value && (isNaN(value) || value <= 0)) {
        return Promise.reject(this.$t('message.error.number'))
      }
      return Promise.resolve()
    }
  }
}
</script>

<style scoped lang="less">
.form-layout {
  width: 100%;
  min-width: 0;
  max-width: 100%;

  .action-button {
    text-align: right;
    margin-top: 20px;

    button {
      margin-right: 5px;
    }
  }
}
</style>
