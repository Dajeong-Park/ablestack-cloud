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
  <a-form class="form-layout public-ip-display" layout="vertical" :model="form" @finish="submitData" @keydown.ctrl.enter.prevent="!$event.repeat && submitData()">
    <a-descriptions class="mold-dialog-summary" :column="1" size="small">
      <a-descriptions-item :label="$t('label.ipaddress')">{{ resource.ipaddress || resource.id }}</a-descriptions-item>
      <a-descriptions-item :label="$t('label.state')"><public-ip-status :value="row?.state || resource.state" /></a-descriptions-item>
      <a-descriptions-item :label="$t('label.public.ip.display.current')">{{ currentLabel }}</a-descriptions-item>
    </a-descriptions>
    <a-alert v-if="error" class="display-notice" type="error" show-icon :message="translated(error)">
      <template #action><a-button v-if="!locked" :disabled="sending || checking" @click="initialize">{{ $t('label.retry') }}</a-button></template>
    </a-alert>
    <a-alert v-if="!supported" class="display-notice" type="warning" show-icon :message="$t('message.public.ip.display.permission')" />
    <a-alert v-else-if="row && !eligible" class="display-notice" type="warning" show-icon :message="$t('message.public.ip.display.unavailable')" />
    <a-alert v-if="operation && operation.status !== 'idle'" class="display-notice" :type="operation.status === 'failed' ? 'error' : operation.status === 'unknown' ? 'warning' : 'info'" show-icon :message="$t('message.public.ip.display.' + (operation.status === 'failed' ? 'failed' : operation.status === 'unknown' ? 'unknown' : 'pending'))">
      <template #description>
        <div v-if="operation.jobId">{{ $t('label.job.id') }}: <span class="display-job-id">{{ operation.jobId }}</span></div>
        <div v-if="operation.error">{{ translated(operation.error) }}</div>
        <a-button v-if="locked && !sending" :loading="checking" :disabled="checking || operation.postPending" @click="recheck">{{ $t('label.public.ip.display.recheck') }}</a-button>
      </template>
    </a-alert>
    <a-form-item v-if="supported && knownValue" name="fordisplay" :label="$t('label.public.ip.display')" :extra="$t('message.public.ip.display.help')">
      <a-switch v-model:checked="form.fordisplay" :aria-label="$t('label.public.ip.display')" :disabled="!eligible || loading || sending || locked" />
    </a-form-item>
    <div v-if="eligible && !changed && !locked" role="status">{{ $t('message.public.ip.display.unchanged') }}</div>
    <mold-dialog-actions :busy="sending" @keydown.ctrl.enter.prevent="!$event.repeat && submitData()">
      <a-button @click="closeAction">{{ $t('label.cancel') }}</a-button>
      <a-button type="primary" :loading="sending" :disabled="!canSubmit" @click="submitData">{{ $t('label.save') }}</a-button>
    </mold-dialog-actions>
  </a-form>
</template>
<script>
import { getAPI, postAPI } from '@/api'
import MoldDialogActions from '@/components/view/MoldDialogActions'
import PublicIpStatus from '@/components/widgets/PublicIpStatus'
import { networkError } from '@/utils/networkLifecycle'
import { displayBoolean, displayWriteSupported, displayEditable, displayFingerprint, displayScope, displayBlocked, readDisplayAddress, validDisplayJob, displayReceipt, saveDisplayReceipt, forgetDisplayReceipt } from '@/utils/publicIpDisplay'
export default {
  name: 'EditPublicIpDisplay',
  components: { MoldDialogActions, PublicIpStatus },
  props: { resource: { type: Object, required: true }, action: { type: Object, default: () => ({}) } },
  emits: ['close-action', 'refresh-data'],
  data: () => ({ row: null, form: { fordisplay: null }, operation: null, operationScope: '', loading: false, sending: false, checking: false, error: '', active: true, version: 0 }),
  computed: {
    scope () { return displayScope(this.resource, this.$store) },
    supported () { return displayWriteSupported(this.$store.getters) },
    knownValue () { return displayBoolean(this.row?.fordisplay) },
    eligible () { return displayEditable(this.row, this.$store.getters) },
    locked () { return displayBlocked(this.operation) },
    changed () { return this.knownValue && displayBoolean(this.form.fordisplay) && this.form.fordisplay !== this.row.fordisplay },
    canSubmit () { return this.active && this.supported && this.eligible && !this.loading && !this.sending && !this.checking && !this.locked && this.changed },
    currentLabel () { return this.knownValue ? this.$t(this.row.fordisplay ? 'label.public.ip.display.visible' : 'label.public.ip.display.hidden') : this.$t('label.unknown') }
  },
  watch: {
    scope () { this.invalidate(); this.active = true; this.initialize() },
    'operation.jobId' () { if (this.active && !this.sending && !this.checking && this.operation?.jobId && this.locked) this.recheck() }
  },
  created () { this.initialize() },
  activated () { if (!this.active) { this.active = true; this.initialize() } },
  deactivated () { this.invalidate() },
  beforeUnmount () { this.invalidate() },
  methods: {
    storage () { try { return window.sessionStorage } catch (_) { return null } },
    translated (text) { return text?.startsWith('message.') ? this.$t(text) : text },
    current (scope, version) { return this.active && scope === this.scope && version === this.version && this.action?.currentAction?.displayCurrent?.() !== false },
    remember (scope, op) { saveDisplayReceipt(scope, op, this.storage()) },
    invalidate () {
      this.active = false; this.version++
      if (this.operation && ['pending', 'verifying'].includes(this.operation.status)) {
        this.operation.status = 'unknown'
        try { this.remember(this.operationScope, this.operation) } catch (_) { /* Keep the in-memory write lock. */ }
      }
    },
    async initialize () {
      const scope = this.scope; const version = ++this.version
      this.row = null; this.form.fordisplay = null; this.operation = null; this.operationScope = scope; this.error = ''; this.loading = true; this.sending = false; this.checking = false
      try {
        if (!this.supported) throw new Error('message.public.ip.display.permission')
        const row = await readDisplayAddress(getAPI, this.resource, this.$store.getters, () => this.current(scope, version))
        if (!this.current(scope, version)) return
        this.row = row
        this.operation = displayReceipt(scope, row.id, this.storage())
        if (this.operation.status === 'verified') { forgetDisplayReceipt(scope, this.storage()); this.operation = displayReceipt(scope, row.id, this.storage()) }
        this.form.fordisplay = displayBoolean(this.operation.desired) ? this.operation.desired : row.fordisplay
        if (this.operation.jobId && this.locked) await this.recheck()
      } catch (error) { if (this.current(scope, version)) this.error = error.message?.startsWith('message.') ? error.message : 'message.public.ip.display.read' } finally { if (this.current(scope, version)) this.loading = false }
    },
    async submitData () {
      if (!this.canSubmit) return
      const scope = this.scope; const version = this.version; const desired = this.form.fordisplay
      this.sending = true; this.error = ''
      let op
      try {
        const row = await readDisplayAddress(getAPI, this.resource, this.$store.getters, () => this.current(scope, version))
        if (!this.current(scope, version)) return
        if (!displayEditable(row, this.$store.getters) || displayFingerprint(row) !== displayFingerprint(this.row) || row.fordisplay !== this.row.fordisplay) throw new Error('message.public.ip.display.changed')
        op = this.operation
        Object.assign(op, { id: row.id, status: 'submitting', jobId: '', desired, previous: row.fordisplay, fingerprint: displayFingerprint(row), error: '', postPending: true })
        try { this.remember(scope, op) } catch (error) { op.status = 'failed'; op.postPending = false; throw error }
        let json
        try { json = await postAPI('updateIpAddress', { id: row.id, fordisplay: desired, ignoreproject: true }, { preserveOnFailure: true, timeout: 15000 }) } catch (error) {
          const failure = networkError(error)
          // A transport/server failure may have accepted the write, even when an error envelope exists.
          const denied = [400, 401, 403, 404, 405, 422, 431, 432, 531].includes(Number(error?.response?.status)) || [401, 403, 431, 432, 531].includes(Number(failure.code))
          op.status = denied ? 'failed' : 'unknown'; op.error = failure.text; throw error
        } finally { op.postPending = false }
        const receipt = json?.updateipaddressresponse
        if (typeof receipt?.jobid !== 'string' || !receipt.jobid.trim()) { op.status = 'unknown'; op.error = 'message.public.ip.display.receipt' } else { op.jobId = receipt.jobid; op.status = 'pending' }
        this.remember(scope, op)
      } catch (error) {
        if (op) { try { this.remember(scope, op) } catch (_) { op.status = 'unknown'; op.error = 'message.public.ip.display.storage' } } else if (this.current(scope, version)) this.error = error.message?.startsWith('message.') ? error.message : 'message.public.ip.display.read'
      } finally { if (this.current(scope, version)) this.sending = false }
      if (this.current(scope, version) && op?.jobId) await this.recheck()
    },
    async recheck () {
      if (!this.operation || this.checking || this.sending || this.operation.postPending || !this.supported) return
      const scope = this.scope; const version = this.version; const op = this.operation
      this.checking = true; this.error = ''
      try {
        if (!op.jobId) {
          const row = await readDisplayAddress(getAPI, this.resource, this.$store.getters, () => this.current(scope, version))
          if (this.current(scope, version)) this.row = row
          return
        }
        op.status = 'pending'; this.remember(scope, op)
        for (let reads = 0; reads < 60 && this.current(scope, version); reads++) {
          const job = (await getAPI('queryAsyncJobResult', { jobid: op.jobId, ignoreproject: true }, { preserveOnFailure: true, backgroundJob: true, timeout: 15000 })).queryasyncjobresultresponse
          if (!this.current(scope, version)) return
          if (!validDisplayJob(job, op)) throw new Error('message.public.ip.display.receipt')
          if (job.jobstatus === 2) {
            op.status = 'failed'; op.error = job.jobresult?.errortext || 'message.public.ip.display.failed'; this.remember(scope, op)
            const row = await readDisplayAddress(getAPI, this.resource, this.$store.getters, () => this.current(scope, version))
            if (this.current(scope, version)) this.row = row
            return
          }
          if (job.jobstatus === 1) {
            op.status = 'verifying'; this.remember(scope, op)
            const row = await readDisplayAddress(getAPI, this.resource, this.$store.getters, () => this.current(scope, version))
            if (!this.current(scope, version)) return
            this.row = row
            if (row.fordisplay !== op.desired || displayFingerprint(row) !== op.fingerprint) throw new Error('message.public.ip.display.verify')
            op.status = 'verified'; op.error = ''; this.remember(scope, op)
            this.$notification.success({ message: this.$t('label.public.ip.display.edit'), description: this.$t(op.desired ? 'message.public.ip.display.saved.visible' : 'message.public.ip.display.saved.hidden') })
            this.$emit('refresh-data'); this.checking = false; this.closeAction(); return
          }
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
        if (this.current(scope, version)) { op.status = 'unknown'; op.error = 'message.public.ip.display.pending'; this.remember(scope, op) }
      } catch (error) {
        if (this.current(scope, version)) {
          if (op.status === 'failed') this.error = 'message.public.ip.display.read'
          else { op.status = 'unknown'; op.error = error.message?.startsWith('message.') ? error.message : 'message.public.ip.display.read' }
          try { this.remember(scope, op) } catch (_) { op.error = 'message.public.ip.display.storage' }
        }
      } finally { if (this.current(scope, version)) this.checking = false }
    },
    closeAction () {
      if (this.sending) return
      const current = this.current(this.scope, this.version)
      if (current && this.locked) this.$emit('refresh-data')
      this.invalidate()
      if (current) this.$emit('close-action')
    }
  }
}
</script>
<style scoped>
.public-ip-display { width: 100%; min-width: 0; }
.display-notice { margin-bottom: 16px; }
.display-notice .ant-btn { margin-top: 8px; }
.display-job-id { overflow-wrap: anywhere; }
</style>
