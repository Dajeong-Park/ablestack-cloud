<!-- Licensed to the Apache Software Foundation (ASF) under one
or more contributor license agreements. See the NOTICE file
distributed with this work for additional information
regarding copyright ownership. The ASF licenses this file
to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at
http://www.apache.org/licenses/LICENSE-2.0
Unless required by applicable law or agreed to in writing,
software distributed under the License is distributed on an
"AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND,
either express or implied. See the License for the specific
language governing permissions and limitations under the License. -->
<template>
  <div class="sharedfs-compute">
    <a-spin :spinning="busy">
      <a-alert v-if="error" type="error" show-icon :message="error" />
      <a-alert
v-if="status?.state === 'BLOCKED'"
type="warning"
show-icon
        :message="$t('message.sharedfs.compute.blocked')"
        :description="status.reason === 'COMPUTE_TEMPLATE_DYNAMIC_DISABLED'
          ? $t('message.sharedfs.compute.template') : status.reason" />
      <template v-else-if="status?.operationid">
        <a-alert
show-icon
:type="status.state === 'COMMITTED' ? 'success' : 'info'"
          :message="$t('label.sharedfs.compute.state.' + status.state)" />
        <a-descriptions bordered size="small" :column="1" class="section">
          <a-descriptions-item :label="$t('label.id')">{{ status.operationid }}</a-descriptions-item>
          <a-descriptions-item :label="$t('label.cpunumber')">{{ status.targetcpu }}</a-descriptions-item>
          <a-descriptions-item :label="$t('label.memory.mb')">{{ status.targetmemory }}</a-descriptions-item>
          <a-descriptions-item v-if="status.reason" :label="$t('label.sharedfs.delete.failure')">{{ status.reason }}</a-descriptions-item>
        </a-descriptions>
      </template>
      <template v-else-if="status">
        <a-alert type="info" show-icon :message="$t('message.sharedfs.compute.rule')" />
        <a-descriptions bordered size="small" :column="2" class="section">
          <a-descriptions-item :label="$t('label.cpunumber')">{{ status.currentcpu }} / {{ status.maxcpu }}</a-descriptions-item>
          <a-descriptions-item :label="$t('label.memory.mb')">{{ status.currentmemory }} / {{ status.maxmemory }}</a-descriptions-item>
        </a-descriptions>
        <a-form layout="vertical" class="section" :model="custom" :disabled="!!request">
          <a-form-item :label="$t('label.serviceofferingid')">
            <a-select
v-model:value="offeringId"
:disabled="!!request"
              show-search
option-filter-prop="label"
:options="options"
@change="changeOffering" />
          </a-form-item>
          <SharedFSOfferingInputs :eligibility="eligibility" :values="custom" @update="setCustom" />
        </a-form>
        <a-alert v-if="plan?.state === 'BLOCKED'" type="warning" show-icon :message="plan.reason" />
        <div v-if="plan?.state === 'PLANNED'" class="section">
          <a-descriptions bordered size="small" :column="2">
            <a-descriptions-item :label="$t('label.cpunumber')">{{ status.currentcpu }} → {{ plan.targetcpu }}</a-descriptions-item>
            <a-descriptions-item :label="$t('label.memory.mb')">{{ status.currentmemory }} → {{ plan.targetmemory }}</a-descriptions-item>
          </a-descriptions>
          <a-checkbox v-model:checked="approved" class="section" :disabled="!!request">
            {{ $t('message.sharedfs.compute.approve') }}
          </a-checkbox>
        </div>
      </template>
    </a-spin>
    <MoldDialogActions>
      <a-button @click="close">{{ $t(status?.operationid ? 'label.close' : 'label.cancel') }}</a-button>
      <a-button v-if="status?.operationid && status.state !== 'COMMITTED'" type="primary" :loading="busy" @click="submit">
        {{ $t('label.sharedfs.delete.resume') }}
      </a-button>
      <a-button v-else-if="canApprove" type="primary" :disabled="!approved" :loading="busy" @click="submit">
        {{ $t('label.ok') }}
      </a-button>
      <a-button v-else-if="request && !status?.operationid" :loading="busy" @click="observe"><template #icon><ReloadOutlined /></template>{{ $t('label.refresh') }}</a-button>
      <a-button v-else-if="status?.state === 'READY'" type="primary" :disabled="!offeringId || busy" @click="preflight">
        {{ $t('label.sharedfs.compute.preflight') }}
      </a-button>
    </MoldDialogActions>
  </div>
</template>

<script>
import { v4 as uuid } from 'uuid'
import { ReloadOutlined } from '@ant-design/icons-vue'
import { getAPI, postAPI } from '@/api'
import MoldDialogActions from '@/components/view/MoldDialogActions'
import SharedFSOfferingInputs from './SharedFSOfferingInputs'
import { computeInputErrors, computeReasonText } from '@/utils/sharedFsOffering'

const api = 'getSharedFileSystemComputeStatus'
const action = 'changeSharedFileSystemServiceOffering'
const read = response => {
  const envelope = Object.values(response || {})[0]
  return envelope?.sharedfscomputestatus?.result || envelope?.result
}

export default {
  name: 'SharedFSCompute',
  components: { MoldDialogActions, SharedFSOfferingInputs, ReloadOutlined },
  props: { resource: { type: Object, required: true } },
  emits: ['close-action', 'refresh-data'],
  data: () => ({
    status: null,
    plan: null,
    offeringId: null,
    offerings: [],
    custom: {},
    approved: false,
    request: null,
    error: '',
    busy: false,
    generation: 0
  }),
  computed: {
    options () {
      return this.offerings.map(row => ({ value: row.offering.id, label: row.offering.name }))
    },
    eligibility () {
      const value = this.offerings.find(row => row.offering.id === this.offeringId)?.eligibility
      if (!value) return null
      const { rootdisksize, ...constraints } = value.constraints
      return { ...value, constraints, inputrequired: Object.values(constraints).some(field => field.custom) }
    },
    canApprove () { return !this.request && this.plan?.state === 'PLANNED' }
  },
  mounted () { this.load() },
  beforeUnmount () { this.generation++ },
  methods: {
    async load () {
      await this.observe()
      if (this.status?.state !== 'READY') return
      const generation = this.generation
      try {
        const response = await getAPI('listSharedFileSystemServiceOfferings', { zoneid: this.resource.zoneid, listall: true, page: 1, pagesize: 500 })
        if (generation !== this.generation) return
        const envelope = Object.values(response)[0]
        this.offerings = (envelope?.sharedfilesystemserviceoffering || []).filter(row =>
          row.offering?.dynamicscalingenabled && row.offering?.offerha)
      } catch (error) {
        if (generation === this.generation) this.error = this.apiError(error)
      }
    },
    apiError (error) {
      const body = error.response?.data || {}
      return body.errorresponse?.errortext || Object.values(body).find(value => value?.errortext)?.errortext || error.message
    },
    invalidate () {
      this.generation++
      this.approved = false
      this.plan = null
      this.error = ''
      this.busy = false
    },
    changeOffering () { this.custom = {}; this.invalidate() },
    setCustom (field, value) { this.custom = { ...this.custom, [field]: value }; this.invalidate() },
    params () {
      const params = { id: this.resource.id, serviceofferingid: this.offeringId }
      for (const field of ['cpunumber', 'cpuspeed', 'memory']) {
        if (this.eligibility?.constraints[field]?.custom) params[field] = this.custom[field]
      }
      return params
    },
    async preflight () {
      this.invalidate()
      const invalid = computeInputErrors(this.eligibility, this.custom)
      if (invalid.length) { this.error = computeReasonText(this.$t, invalid[0]); return }
      const generation = this.generation
      this.busy = true
      try {
        const response = await getAPI(api, this.params(), { preserveOnFailure: true })
        if (generation === this.generation) this.plan = read(response)
      } catch (error) {
        if (generation === this.generation) this.error = this.apiError(error)
      } finally {
        if (generation === this.generation) this.busy = false
      }
    },
    async observe () {
      const generation = ++this.generation
      this.busy = true
      try {
        const params = { id: this.resource.id }
        if (this.request?.requestid) params.requestid = this.request.requestid
        const response = await getAPI(api, params, { preserveOnFailure: true })
        if (generation === this.generation) {
          const observed = read(response)
          if (observed?.state !== 'NOT_FOUND') this.status = observed
        }
      } catch (error) {
        if (generation === this.generation && !this.error) this.error = this.apiError(error)
      } finally {
        if (generation === this.generation) this.busy = false
      }
    },
    async submit () {
      if (this.busy || (!this.status?.operationid && (!this.canApprove || !this.approved))) return
      const generation = this.generation
      const operation = this.status?.operationid ? this.status : null
      this.request = operation
        ? {
          id: this.resource.id,
          mode: 'ONLINE',
          requestid: operation.requestid,
          planfingerprint: operation.planfingerprint,
          serviceofferingid: operation.serviceofferingid,
          ...operation.custom
        }
        : { ...this.params(), mode: 'ONLINE', requestid: uuid(), planfingerprint: this.plan.planfingerprint, planexpires: this.plan.planexpires }
      this.busy = true
      this.error = ''
      try {
        const response = await postAPI(action, this.request, { preserveOnFailure: true })
        const jobId = Object.values(response)[0]?.jobid
        if (!jobId) throw new Error('COMPUTE_JOB_UNAVAILABLE')
        let job
        do {
          await new Promise(resolve => setTimeout(resolve, 1500))
          if (generation !== this.generation) return
          const payload = await getAPI('queryAsyncJobResult', { jobid: jobId })
          job = payload.queryasyncjobresultresponse
        } while (job.jobstatus === 0)
        if (job.jobstatus === 2) this.error = job.jobresult?.errortext || 'COMPUTE_OBSERVATION_FAILED'
        if (generation === this.generation) await this.observe()
      } catch (error) {
        if (generation === this.generation) {
          this.error = this.apiError(error)
          await this.observe()
        }
      } finally {
        if (generation === this.generation) this.busy = false
      }
    },
    close () {
      this.generation++
      this.$emit('close-action')
      this.$emit('refresh-data')
    }
  }
}
</script>

<style scoped>
.sharedfs-compute { min-width: 0; }
.section { margin-top: 16px; }
</style>
