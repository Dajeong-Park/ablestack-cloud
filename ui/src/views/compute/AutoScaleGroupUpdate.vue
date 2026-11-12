<!-- Licensed to the Apache Software Foundation (ASF) under one or more
contributor license agreements. See NOTICE for copyright ownership.
Licensed under the Apache License, Version 2.0 (the "License");
http://www.apache.org/licenses/LICENSE-2.0 . Distributed AS IS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND. -->
<template>
  <MoldDialog :visible="!closed" :title="$t('label.update.autoscale.vmgroup')" size="md" focus-guard :closable="!busy" :keyboard="!busy" @cancel="close">
    <div class="group-update-target"><strong>{{ resource.name }}</strong><span>{{ resource.id }}</span></div>
    <a-alert v-if="error" type="error" show-icon :message="$t(jobId ? 'message.autoscale.group.update.unknown' : 'message.autoscale.group.update.failed')" :description="error" />
    <a-alert v-if="jobId" type="info" show-icon :message="$t(busy ? 'message.autoscale.group.update.pending' : 'message.autoscale.group.update.check')" :description="jobId" />
    <a-button class="group-update-reload" :disabled="busy || !!jobId || !allowed" @click="load"><template #icon><reload-outlined /></template>{{ $t('label.autoscale.group.update.reload') }}</a-button>
    <a-spin :spinning="loading">
      <a-form ref="formRef" class="group-update-form" layout="vertical" :model="draft" :rules="rules" v-ctrl-enter="submit">
        <a-form-item :label="$t('label.name')" name="name"><a-input v-model:value="draft.name" :disabled="fieldsDisabled" /></a-form-item>
        <a-form-item :label="$t('label.minmembers')" name="minmembers"><a-input-number v-model:value="draft.minmembers" :disabled="fieldsDisabled" /></a-form-item>
        <a-form-item :label="$t('label.maxmembers')" name="maxmembers"><a-input-number v-model:value="draft.maxmembers" :disabled="fieldsDisabled" /></a-form-item>
        <a-form-item v-if="server?.state === 'DISABLED'" :label="$t('label.interval')" name="interval"><a-input-number v-model:value="draft.interval" :disabled="fieldsDisabled" /></a-form-item>
      </a-form>
    </a-spin>
    <template #footer>
      <a-button :disabled="busy" @click="close">{{ $t('label.cancel') }}</a-button>
      <a-button type="primary" :loading="busy" :disabled="busy || !allowed || (!jobId && (!server || !!loadError))" @click="submit">{{ $t(jobId ? 'label.autoscale.group.update.recheck' : 'label.ok') }}</a-button>
    </template>
  </MoldDialog>
</template>
<script>
import { v4 as uuid } from 'uuid'
import { getAPI, postAPI } from '@/api'
import MoldDialog from '@/components/view/MoldDialog'
import { autoScaleInteger } from '@/utils/autoscaleValidation'
import { autoScaleOwnerParams } from '@/utils/autoScaleEditing'
import { autoScaleResourceScope } from '@/utils/autoScaleUi'
import { createJobTracker } from '@/utils/jobTracker'

const fields = group => ({ name: group.name, minmembers: group.minmembers, maxmembers: group.maxmembers, ...(group.state === 'DISABLED' ? { interval: group.interval } : {}) })
const requiredApis = ['updateAutoScaleVmGroup', 'listAutoScaleVmGroups', 'queryAsyncJobResult']
export default {
  name: 'AutoScaleGroupUpdate',
  components: { MoldDialog },
  props: { resource: { type: Object, required: true } },
  emits: ['close-action', 'refresh-data'],
  data () { return { draft: {}, server: null, loading: false, saving: false, closed: false, disposed: false, origin: '', entryKey: '', jobId: '', error: '', loadError: '', tracker: null } },
  computed: {
    scope () { return JSON.stringify([autoScaleResourceScope(this), this.resource.projectid, this.resource.account, this.resource.domainid, this.$route.path, this.$store.state?.user?.token, requiredApis.map(api => api in (this.$store.getters.apis || {}))]) },
    storageKey () { return 'autoscale-group-update:' + JSON.stringify([autoScaleResourceScope(this), this.resource.projectid, this.resource.account, this.resource.domainid]) },
    allowed () { return this.current() && requiredApis.every(api => api in (this.$store.getters.apis || {})) },
    busy () { return this.loading || this.saving },
    fieldsDisabled () { return this.busy || !!this.jobId || !this.allowed || !this.server || !!this.loadError },
    rules () {
      const number = field => ({
        validator: async (_, value) => {
          if (autoScaleInteger(value, 1, 2147483647) === null || (field === 'maxmembers' && Number(value) < Number(this.draft.minmembers))) throw new Error(this.$t('message.autoscale.group.update.number'))
        }
      })
      return { name: [{ required: true, whitespace: true, message: this.$t('message.error.required.input') }], minmembers: [number('minmembers')], maxmembers: [number('maxmembers')], interval: [number('interval')] }
    }
  },
  watch: { scope () { this.closed = true; if (this.tracker) this.tracker.clear(); this.$emit('close-action') } },
  created () {
    this.origin = this.scope; this.entryKey = this.storageKey
    try {
      const pending = JSON.parse(sessionStorage.getItem(this.entryKey) || 'null')
      if (pending?.id === this.resource.id && /^[\da-f-]{36}$/i.test(pending.jobId)) { this.jobId = pending.jobId; this.draft = { ...pending.draft } }
    } catch (_) {}
    this.tracker = createJobTracker({
      interval: 1000,
      maxRetries: 2,
      maxDuration: 120000,
      onState: () => {},
      query: async id => {
        const json = await getAPI('queryAsyncJobResult', { jobid: id, ignoreproject: true }, { preserveOnFailure: true, timeout: 15000 })
        const job = json.queryasyncjobresultresponse
        if (!job || job.jobid !== id || (job.cmd && job.cmd.split('.').pop().toLowerCase() !== 'updateautoscalevmgroupcmd') || (job.jobinstanceid && job.jobinstanceid !== this.resource.id)) throw new Error(this.$t('message.autoscale.group.update.job.scope'))
        return job
      }
    })
    this.load()
  },
  beforeUnmount () { this.disposed = true; if (this.tracker) this.tracker.clear() },
  methods: {
    current () { return !this.closed && !this.disposed && this.origin === this.scope },
    message (error) { return error?.response?.data?.errorresponse?.errortext || error?.message || this.$t('message.request.failed') },
    persist () { sessionStorage.setItem(this.entryKey, JSON.stringify({ id: this.resource.id, jobId: this.jobId, draft: { ...this.draft } })) },
    clearReceipt () { this.jobId = ''; try { sessionStorage.removeItem(this.entryKey) } catch (_) {} },
    async fresh () {
      const json = await getAPI('listAutoScaleVmGroups', { id: this.resource.id, ...autoScaleOwnerParams(this.resource), ignoreproject: true, listall: true }, { preserveOnFailure: true, timeout: 15000 })
      const group = json.listautoscalevmgroupsresponse?.autoscalevmgroup?.find(g => g.id === this.resource.id)
      if (!group || group.projectid !== this.resource.projectid || group.operationinprogress) throw new Error(this.$t('message.autoscale.group.update.unavailable'))
      return group
    },
    async load () {
      if (this.busy || !this.allowed) return
      this.loading = true; this.loadError = ''; this.error = ''
      try {
        const group = await this.fresh()
        if (!this.current()) return
        this.server = group
        if (!this.jobId) { this.draft = fields(group); if (this.$refs.formRef) this.$refs.formRef.clearValidate() }
      } catch (error) { if (this.current()) this.error = this.loadError = this.message(error) } finally { if (this.current()) this.loading = false }
      if (this.current() && this.jobId) this.checkJob()
    },
    close () { if (!this.busy) { this.closed = true; this.$emit('close-action') } },
    async checkJob () {
      if (this.busy || !this.allowed || !this.jobId) return
      this.saving = true; this.error = ''
      const result = await this.tracker.track(this.jobId, {}, true)
      if (!this.current()) return
      this.saving = false
      if (result?.jobstatus === 1) {
        this.clearReceipt(); this.closed = true; this.$emit('refresh-data'); this.$emit('close-action')
      } else if (result?.jobstatus === 2) {
        this.error = [result.jobresult?.errorcode || result.jobresultcode, result.jobresult?.errortext || this.$t('message.request.failed')].filter(Boolean).join(': ')
        this.clearReceipt()
      } else this.error = this.message(result?.error) || this.$t('message.autoscale.group.update.unknown')
    },
    async submit () {
      if (this.busy || !this.allowed) return
      if (this.jobId) return this.checkJob()
      if (!this.server || this.loadError) return
      this.saving = true; this.error = ''
      try {
        await this.$refs.formRef.validate()
        if (!this.current()) return
        const group = await this.fresh()
        if (!this.current()) return
        if (JSON.stringify(fields(group)) !== JSON.stringify(fields(this.server)) || group.state !== this.server.state) throw new Error(this.$t('message.autoscale.group.update.changed'))
        this.jobId = uuid()
        try { this.persist() } catch (_) { this.jobId = ''; throw new Error(this.$t('message.autoscale.group.update.storage')) }
        const params = { id: group.id, name: this.draft.name.trim(), minmembers: this.draft.minmembers, maxmembers: this.draft.maxmembers, ...(group.state === 'DISABLED' ? { interval: this.draft.interval } : {}), ...autoScaleOwnerParams(group), ignoreproject: true, customjobid: this.jobId }
        let response
        try { response = await postAPI('updateAutoScaleVmGroup', params, { preserveOnFailure: true }) } catch (error) {
          if (!this.current()) return
          if (error?.response?.data?.errorresponse || [400, 401, 403, 404].includes(error?.response?.status)) this.clearReceipt()
          throw error
        }
        if (!this.current()) return
        if (response?.errorresponse) { this.clearReceipt(); throw new Error(response.errorresponse.errortext) }
        const jobId = response?.updateautoscalevmgroupresponse?.jobid
        if (!jobId) throw new Error(this.$t('message.autoscale.group.update.unknown'))
        this.jobId = jobId; this.persist()
      } catch (error) {
        if (this.current() && !error?.errorFields) this.error = this.message(error)
      } finally { if (this.current()) this.saving = false }
      if (this.current() && this.jobId) return this.checkJob()
    }
  }
}
</script>
<style scoped>
.group-update-target { display: flex; flex-direction: column; gap: 4px; margin-bottom: 16px; overflow-wrap: anywhere; }
.group-update-target span { opacity: .75; }
.group-update-reload, .ant-alert { margin-bottom: 16px; }
.group-update-form :deep(.ant-input-number) { width: 100%; }
</style>
