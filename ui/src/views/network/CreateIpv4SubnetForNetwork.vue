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
  <a-spin :spinning="submitting">
    <a-form
      class="form"
      :disabled="submitting"
      layout="vertical"
      :ref="formRef"
      :model="form"
      :rules="rules"
      @finish="handleSubmit"
      v-ctrl-enter="handleSubmit"
     >
      <a-form-item ref="zoneid" name="zoneid">
        <template #label>
          <tooltip-label :title="$t('label.zoneid')"/>
        </template>
        <a-select
          v-model:value="form.zoneid"
          :loading="zonesLoading"
          :disabled="submitting"
          @change="fetchParentSubnets"
          showSearch
          optionFilterProp="label"
          :filterOption="(input, option) => {
            return option.label.toLowerCase().indexOf(input.toLowerCase()) >= 0
          }" >
          <a-select-option
            v-for="(zone, index) in zones"
            :value="zone.id"
            :key="index"
            :label="zone.name">
            <span>
              <resource-icon v-if="zone.icon" :image="zone.icon.base64image" size="1x" style="margin-right: 5px"/>
              <global-outlined v-else style="margin-right: 5px"/>
              {{ zone.name }}
            </span>
          </a-select-option>
        </a-select>
      </a-form-item>
      <a-form-item ref="parentid" name="parentid">
        <template #label>
          <tooltip-label :title="$t('label.parentsubnet')"/>
        </template>
        <a-select
          v-model:value="form.parentid"
          :loading="parentsLoading"
          :disabled="submitting || parentsLoading || !parentSubnets.length"
          :placeholder="$t('message.error.parent.subnet')"
          showSearch
          optionFilterProp="label"
          :filterOption="(input, option) => {
            return option.label.toLowerCase().indexOf(input.toLowerCase()) >= 0
          }" >
          <a-select-option
            v-for="(parentSubnet, index) in parentSubnets"
            :value="parentSubnet.id"
            :key="index"
            :label="parentSubnet.subnet">
            {{ parentSubnet.subnet }}
          </a-select-option>
        </a-select>
        <div v-if="lookupError" class="lookup-feedback">
          <a-alert type="error" show-icon :message="$t(lookupError)" />
          <a-button @click="retryLookup">{{ $t('label.retry') }}</a-button>
        </div>
        <div v-else-if="!zonesLoading && !parentsLoading && !parentSubnets.length" class="lookup-feedback" role="status">
          {{ $t(form.zoneid ? 'message.ipv4.subnet.no.parents' : 'message.ipv4.subnet.no.zones') }}
        </div>
      </a-form-item>
      <a-form-item :label="$t('message.ipv4.subnet.create.method')">
        <a-radio-group v-model:value="form.mode" @change="clearError">
          <a-radio value="subnet">{{ $t('label.subnet') }}</a-radio>
          <a-radio value="cidrsize">{{ $t('label.cidrsize') }}</a-radio>
        </a-radio-group>
      </a-form-item>
      <a-form-item v-if="form.mode === 'subnet'" name="subnet" :label="$t('label.subnet')">
        <a-input v-model:value="form.subnet" placeholder="192.0.2.0/28" />
      </a-form-item>
      <a-form-item v-else name="cidrsize" :label="$t('label.cidrsize')">
        <a-input v-model:value="form.cidrsize" inputmode="numeric" placeholder="28" />
      </a-form-item>
      <a-alert v-if="submitError" class="lookup-feedback" type="error" show-icon :message="submitError" />
      <MoldDialogActions :busy="submitting">
        <a-button :disabled="submitting" @click="closeModal">{{ $t('label.cancel') }}</a-button>
        <a-button type="primary" ref="submit" :loading="submitting" :disabled="!canSubmit" @click="handleSubmit">{{ $t('label.ok') }}</a-button>
      </MoldDialogActions>
    </a-form>
  </a-spin>
</template>

<script>
import { ref, reactive } from 'vue'
import { getAPI, postAPI } from '@/api'
import { isValidIPv4Cidr } from '@/utils/util'
import { networkError } from '@/utils/networkLifecycle'
import MoldDialogActions from '@/components/view/MoldDialogActions'
import ResourceIcon from '@/components/view/ResourceIcon'
import TooltipLabel from '@/components/widgets/TooltipLabel'

export default {
  name: 'CreateIpv4SubnetForNetwork',
  components: {
    MoldDialogActions,
    ResourceIcon,
    TooltipLabel
  },
  emits: ['close-action'],
  data () {
    return {
      zones: [],
      parentSubnets: [],
      zonesLoading: false,
      parentsLoading: false,
      submitting: false,
      lookupError: '',
      submitError: '',
      jobPending: false,
      parentRequest: 0
    }
  },
  computed: {
    canSubmit () {
      return !this.jobPending && !this.zonesLoading && !this.parentsLoading && !this.submitting &&
        !this.lookupError && this.parentSubnets.some(parent => parent.id === this.form.parentid)
    }
  },
  beforeUnmount () {
    this.parentRequest++
  },
  created () {
    this.initForm()
    this.fetchZones()
  },
  methods: {
    initForm () {
      this.formRef = ref()
      this.form = reactive({ mode: 'subnet' })
      this.rules = reactive({
        zoneid: [{ required: true, message: this.$t('message.error.zone') }],
        parentid: [{ required: true, message: this.$t('message.error.parent.subnet') }],
        subnet: [{ validator: (_, value) => this.validateSubnet(value) }],
        cidrsize: [{ validator: (_, value) => this.validatePrefix(value) }]
      })
    },
    async fetchZones () {
      this.zonesLoading = true
      this.lookupError = ''
      try {
        const json = await getAPI('listZones', { showicon: true }, { preserveOnFailure: true })
        this.zones = (json.listzonesresponse.zone || []).filter(zone => zone.routedmodeenabled)
        this.form.zoneid = this.zones[0]?.id
        this.fetchParentSubnets(this.form.zoneid)
      } catch {
        this.lookupError = 'message.ipv4.subnet.zones.failed'
      } finally {
        this.zonesLoading = false
      }
    },
    async fetchParentSubnets (zoneId) {
      const request = ++this.parentRequest
      this.form.parentid = undefined
      this.parentSubnets = []
      this.lookupError = ''
      this.parentsLoading = Boolean(zoneId)
      if (!zoneId) return

      try {
        const json = await getAPI('listIpv4SubnetsForZone', { zoneid: zoneId, listall: true }, { preserveOnFailure: true })
        if (request === this.parentRequest) {
          this.parentSubnets = json.listipv4subnetsforzoneresponse.zoneipv4subnet || []
        }
      } catch {
        if (request === this.parentRequest) this.lookupError = 'message.ipv4.subnet.parents.failed'
      } finally {
        if (request === this.parentRequest) this.parentsLoading = false
      }
    },
    retryLookup () {
      return this.form.zoneid ? this.fetchParentSubnets(this.form.zoneid) : this.fetchZones()
    },
    clearError () {
      this.submitError = ''
      this.formRef.value.clearValidate(['subnet', 'cidrsize'])
    },
    validateSubnet (value) {
      if (this.form.mode !== 'subnet') return Promise.resolve()
      return isValidIPv4Cidr(null, value?.trim()).catch(() => {
        throw new Error(this.$t('message.ipv4.subnet.create.invalid.cidr'))
      })
    },
    validatePrefix (value) {
      if (this.form.mode !== 'cidrsize') return Promise.resolve()
      const input = value?.trim()
      const parent = this.parentSubnets.find(option => option.id === this.form.parentid)
      const minimum = Number(parent?.subnet.split('/')[1] ?? 0)
      if (!/^\d{1,2}$/.test(input) || Number(input) < minimum || Number(input) > 32) {
        return Promise.reject(new Error(this.$t('message.ipv4.subnet.create.invalid.size', [minimum])))
      }
      return Promise.resolve()
    },
    async handleSubmit () {
      if (!this.canSubmit) return
      const parentId = this.form.parentid
      try {
        await this.formRef.value.validate()
      } catch (error) {
        if (error.errorFields?.length) this.formRef.value.scrollToField(error.errorFields[0].name)
        return
      }
      if (!this.canSubmit || parentId !== this.form.parentid) return

      const mode = this.form.mode
      const value = this.form[mode].trim()
      this.submitting = true
      this.submitError = ''
      try {
        const response = await postAPI('createIpv4SubnetForGuestNetwork', { parentid: parentId, [mode]: value }, { preserveOnFailure: true })
        this.jobPending = true
        const jobId = response.createipv4subnetforguestnetworkresponse?.jobid
        const result = jobId && await this.$pollJob({
          jobId,
          title: this.$t('label.add.ipv4.subnet'),
          description: value,
          successMessage: this.$t('message.success.add.ipv4.subnet'),
          action: { api: 'createIpv4SubnetForGuestNetwork', suppressErrorNotification: true }
        })
        if (result?.jobstatus === 1) this.$emit('close-action')
        else if (result?.jobstatus === 2) {
          this.jobPending = false
          this.submitError = result.jobresult?.errortext || this.$t('message.request.failed')
        } else this.submitError = this.$t('message.job.result.unknown')
      } catch (error) {
        const detail = networkError(error)
        if (!detail.definitive) this.jobPending = true
        this.submitError = detail.text || this.$t(this.jobPending ? 'message.job.result.unknown' : 'message.request.failed')
      } finally {
        this.submitting = false
      }
    },
    closeModal () {
      if (!this.submitting) this.$emit('close-action')
    }
  }
}
</script>

<style lang="scss" scoped>
.lookup-feedback {
  display: grid;
  gap: 8px;
  justify-items: start;
  margin-top: 8px;
}

</style>
