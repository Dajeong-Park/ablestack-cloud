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
  <MoldDialog size="md" focus-guard :title="$t('label.kubernetes.version.from.local')" :closable="!busy" :keyboard="!busy" @cancel="closeAction">
    <a-alert v-if="submitError" class="upload-notice" type="error" show-icon :message="submitError" />
    <a-form
v-if="phase === 'draft'"
:id="formId"
ref="uploadForm"
:model="form"
:rules="rules"
layout="vertical"
@finish="handleSubmit"
v-ctrl-enter="handleSubmit">
      <a-form-item name="semanticversion" :label="$t('label.semanticversion')" :extra="$t('message.kubernetes.iso.version.help')"><a-input v-focus="true" v-model:value="form.semanticversion" :disabled="busy" placeholder="1.30.0" /></a-form-item>
      <a-form-item name="name" :label="$t('label.name')"><a-input v-model:value="form.name" :disabled="busy" /></a-form-item>
      <a-form-item name="zoneid" :label="$t('label.zoneid')">
        <a-select v-model:value="form.zoneid" :disabled="busy" :loading="zoneLoading" option-filter-prop="label" show-search>
          <a-select-option v-for="zone in zones" :key="zone.id" :value="zone.id" :label="zone.name">{{ zone.name }}</a-select-option>
        </a-select>
        <template v-if="zoneError" #extra><a-button type="link" size="small" :disabled="busy" @click="fetchZones">{{ $t('label.retry') }}</a-button></template>
      </a-form-item>
      <a-form-item name="file" :label="$t('label.templatefileupload')">
        <a-upload-dragger :multiple="false" :file-list="files" :disabled="busy" accept=".iso,.iso.gz,.iso.bz2,.iso.zip,.iso.xz" :before-upload="beforeUpload" @remove="removeFile">
          <p class="ant-upload-drag-icon"><cloud-upload-outlined /></p><p>{{ $t('label.volume.volumefileupload.description') }}</p>
        </a-upload-dragger>
      </a-form-item>
      <a-form-item name="checksum" :label="$t('label.checksum')" :extra="$t('message.kubernetes.iso.checksum.help')"><a-input v-model:value="form.checksum" :disabled="busy" /></a-form-item>
      <a-row :gutter="16">
        <a-col :span="12"><a-form-item name="mincpunumber" :label="$t('label.mincpunumber')"><a-input v-model:value="form.mincpunumber" :disabled="busy" inputmode="numeric" /></a-form-item></a-col>
        <a-col :span="12"><a-form-item name="minmemory" :label="$t('label.minmemory')"><a-input v-model:value="form.minmemory" :disabled="busy" inputmode="numeric" /></a-form-item></a-col>
      </a-row>
      <a-form-item v-if="capability.parameters.arch" name="arch" :label="$t('label.arch')">
        <a-select v-model:value="form.arch" :disabled="busy"><a-select-option v-for="arch in ['x86_64', 'aarch64', 's390x']" :key="arch" :value="arch">{{ arch }}</a-select-option></a-select>
      </a-form-item>
    </a-form>
    <template v-else>
      <a-alert class="upload-notice" show-icon :type="phase === 'done' ? 'success' : ['failed', 'transferFailed', 'expired', 'uncertain'].includes(phase) ? 'warning' : 'info'" :message="$t(phaseLabel)" />
      <a-progress v-if="phase === 'uploading'" :percent="percentage" />
      <a-descriptions bordered size="small" :column="1" v-if="isoId">
        <a-descriptions-item :label="$t('label.name')">{{ form.name }}</a-descriptions-item>
        <a-descriptions-item :label="$t('label.id')">{{ receipt.id || $t('label.unknown') }}</a-descriptions-item>
        <a-descriptions-item :label="$t('label.iso')">{{ isoId }}</a-descriptions-item>
        <a-descriptions-item :label="$t('label.arch')">{{ receipt.arch || $t('label.unknown') }}</a-descriptions-item>
      </a-descriptions>
      <a v-if="phase === 'preflight' && uploadOrigin" :href="uploadOrigin" target="_blank" rel="noopener noreferrer">{{ $t('message.kubernetes.iso.local.certificate') }}</a>
      <ul v-if="reasons.length"><li v-for="reason in reasons" :key="reason">{{ reason }}</li></ul>
    </template>
    <template #footer>
      <a-button :disabled="busy" @click="closeAction">{{ $t(phase === 'draft' ? 'label.cancel' : 'label.close') }}</a-button>
      <a-button v-if="phase === 'draft'" type="primary" html-type="submit" :form="formId" :loading="busy" :disabled="!capability.available || zoneLoading" @click="handleSubmit">{{ $t('label.kubernetes.version.from.local') }}</a-button>
      <a-button v-if="phase === 'preflight'" :loading="busy" @click="retryUpload">{{ $t('label.retry') }}</a-button>
      <a-button v-if="phase === 'uploading'" danger @click="interruptTransfer">{{ $t('message.kubernetes.iso.local.stop') }}</a-button>
      <a-button v-if="isoId && !['draft', 'uploading'].includes(phase)" :disabled="busy" :loading="checking" @click="checkAccepted">{{ $t('message.kubernetes.iso.registration.check') }}</a-button>
      <a-button v-if="isoId" :disabled="busy || checking" @click="openResource('iso')">{{ $t('label.iso') }}</a-button>
      <a-button v-if="receipt.id" type="primary" :disabled="busy || checking" @click="openResource('parent')">{{ $t('label.kubernetes.isos') }}</a-button>
      <a-button v-else-if="phase === 'uncertain'" :disabled="busy" @click="openCatalog">{{ $t('label.kubernetes.isos') }}</a-button>
    </template>
  </MoldDialog>
</template>
<script>
import { reactive } from 'vue'
import { getAPI, postAPI } from '@/api'
import { axios } from '@/utils/request'
import { probeSsvmCert } from '@/utils/ssvmProbe'
import MoldDialog from '@/components/view/MoldDialog'
import { kubernetesIsoCapability, kubernetesIsoContext } from '@/utils/kubernetesIsoCapabilities'
import { kubernetesIsoUploadResponse } from '@/utils/kubernetesIsoModel'
import { kubernetesLocalErrors, kubernetesLocalParams, kubernetesLocalTicket, findLocalKubernetesVersion } from '@/utils/kubernetesIsoUpload'
import { uploadTicketExpired } from '@/utils/isoRegistration'
import { observeKubernetesUrl, kubernetesUrlAttempt, rememberKubernetesUrlAttempt, synchronizeKubernetesUrlScope } from '@/utils/kubernetesIsoRegistration'
import { safeTemplateReason } from '@/utils/templateAvailability'
let sequence = 0
export default {
  name: 'UploadKubernetesIso',
  inheritAttrs: false,
  components: { MoldDialog },
  emits: ['close-action', 'refresh-data'],
  data () {
    return {
      formId: 'kubernetes-local-' + (++sequence),
      form: reactive({ name: '', semanticversion: '', zoneid: undefined, checksum: '', mincpunumber: 2, minmemory: 2048, arch: 'x86_64' }),
      files: [],
      zones: [],
      zoneLoading: false,
      zoneError: false,
      phase: 'draft',
      busy: false,
      checking: false,
      disposed: false,
      percentage: 0,
      ticket: null,
      isoId: '',
      receipt: {},
      acceptedParams: null,
      attempted: false,
      uploadAbort: null,
      submitError: '',
      reasons: []
    }
  },
  computed: {
    capability () { return kubernetesIsoCapability('local', this.$store.getters) },
    registrationScope () { return kubernetesIsoContext(this.$store.getters, this.$store.state?.user?.token) },
    blocksNavigation () { return this.busy },
    uploadOrigin () { try { return this.ticket ? new URL(this.ticket.postURL).origin : '' } catch (_) { return '' } },
    phaseLabel () {
      return ({
        requesting: 'message.kubernetes.iso.local.requesting',
        preflight: 'message.iso.preflight.retry',
        preparing: 'message.kubernetes.iso.local.preparing',
        uploading: 'message.upload.file.processing',
        checking: 'message.kubernetes.iso.local.checking',
        pending: 'message.iso.ready.pending',
        done: 'message.kubernetes.iso.local.done',
        transferFailed: 'message.iso.transfer.check',
        checkFailed: 'message.iso.ready.check.failed',
        failed: 'message.kubernetes.iso.registration.failed',
        expired: 'message.iso.ticket.expired',
        uncertain: 'message.kubernetes.iso.request.uncertain',
        contextChanged: 'message.kubernetes.iso.registration.context'
      })[this.phase] || 'message.kubernetes.iso.local.checking'
    },
    rules () {
      return Object.fromEntries(['name', 'semanticversion', 'zoneid', 'file', 'checksum', 'mincpunumber', 'minmemory', 'arch'].map(key => [key, [{
        required: key !== 'checksum',
        validator: async () => { const error = kubernetesLocalErrors(this.form, this.files, this.zones, this.capability)[key]; if (error) throw new Error(this.$t(error)) }
      }]]))
    }
  },
  watch: {
    registrationScope: { flush: 'sync', handler () { synchronizeKubernetesUrlScope(this.registrationScope); if (this.uploadAbort) this.uploadAbort.abort(); this.ticket = null; this.receipt = {}; this.isoId = ''; this.files = []; this.phase = 'contextChanged'; this.busy = false; this.checking = false } }
  },
  created () { synchronizeKubernetesUrlScope(this.registrationScope); this.fetchZones() },
  beforeUnmount () { this.disposed = true; this.ticket = null; if (this.uploadAbort) this.uploadAbort.abort() },
  methods: {
    current (scope) { return !this.disposed && scope === this.registrationScope && this.capability.available },
    options () { return { preserveOnFailure: true, timeout: 20000, readScope: JSON.stringify([this.$store.state?.user?.token, this.$store.getters.userInfo?.id, this.$store.getters.project?.id]) } },
    errorText (error) {
      const data = error?.response?.data
      const known = typeof data === 'string' && /^(Checksum does not match the uploaded file\.|Unsupported checksum algorithm\.|Unable to verify uploaded file checksum\.)\s*$/.test(data) ? data.trim() : ''
      const message = known || Object.values(typeof data === 'object' && data || {}).find(v => v?.errortext)?.errortext || error?.message || 'message.request.failed'
      return safeTemplateReason(message.startsWith('message.') ? this.$t(message) : message)
    },
    async fetchZones () {
      if (!this.capability.available) return
      const scope = this.registrationScope; this.zoneLoading = true; this.zoneError = false
      try {
        if (!this.$store.getters.apis?.listZones) throw new Error('denied')
        const json = await getAPI('listZones', {}, this.options()); if (!this.current(scope)) return
        const rows = json?.listzonesresponse?.zone
        if (!Array.isArray(rows)) throw new Error('invalid')
        this.zones = rows.filter(z => z?.id && z.name && z.type !== 'Edge')
        if (!this.form.zoneid) this.form.zoneid = this.zones[0]?.id
      } catch (_) { if (this.current(scope)) this.zoneError = true } finally { if (this.current(scope)) this.zoneLoading = false }
    },
    beforeUpload (file, batch = [file]) {
      if (this.busy || this.phase !== 'draft') return false
      if (batch.length !== 1) { this.files = []; this.form.file = undefined; this.submitError = this.$t('message.kubernetes.iso.local.file'); return false }
      this.files = [file]; this.form.file = file; this.submitError = ''
      return false
    },
    removeFile () { if (this.busy || this.phase !== 'draft') return false; this.files = []; this.form.file = undefined; return true },
    async handleSubmit (event) {
      if (event?.preventDefault) event.preventDefault()
      if (this.busy || this.checking || this.zoneLoading || this.phase !== 'draft' || !this.capability.available) return
      this.busy = true; this.submitError = ''
      const scope = this.registrationScope
      try {
        await this.$refs.uploadForm.validate(); if (!this.current(scope)) return
        this.acceptedParams = kubernetesLocalParams(this.form, this.files, this.zones, this.$store.getters)
        const file = this.files[0]
        const operation = kubernetesUrlAttempt(scope, { mode: 'local', ...this.acceptedParams, file: { name: file.name, size: file.size, lastModified: file.lastModified } })
        this.attempt = operation.entry
        if (!operation.fresh) {
          this.isoId = operation.entry.isoid || ''; this.receipt = operation.entry.record || {}
          this.phase = this.isoId ? 'checkFailed' : 'uncertain'
          this.submitError = this.$t('message.kubernetes.iso.request.uncertain')
          return
        }
        this.phase = 'requesting'
        const json = await postAPI('getUploadParamsForKubernetesSupportedVersion', this.acceptedParams, this.options())
        if (!this.current(scope)) return
        // Preserve the allocated ISO ID even when a signed field is malformed.
        const root = json?.getuploadparamsforkubernetessupportedversionresponse
        const partialId = (root?.getuploadparams || root)?.id
        if (typeof partialId === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(partialId)) { this.isoId = partialId; operation.entry.isoid = partialId }
        this.isoId = kubernetesIsoUploadResponse(json).id
        operation.entry.isoid = this.isoId
        this.$emit('refresh-data')
        try { this.ticket = kubernetesLocalTicket(json) } catch (error) { this.phase = error.message === 'message.iso.ticket.expired' ? 'expired' : 'checkFailed'; this.submitError = this.errorText(error); return }
        await this.sendFile(scope)
      } catch (error) {
        if (!this.current(scope)) return
        if (error.errorFields?.length) this.$refs.uploadForm.scrollToField(error.errorFields[0].name)
        else { this.submitError = this.errorText(error); if (this.phase === 'requesting') this.phase = 'uncertain' }
      } finally { if (this.current(scope)) this.busy = false }
    },
    async sendFile (scope) {
      if (!this.current(scope) || this.attempted) return
      if (uploadTicketExpired(this.ticket)) { this.ticket = null; this.phase = 'expired'; return }
      this.phase = 'preparing'
      if (!await probeSsvmCert(this.uploadOrigin)) { if (this.current(scope)) this.phase = 'preflight'; return }
      if (!this.current(scope)) return
      if (uploadTicketExpired(this.ticket)) { this.ticket = null; this.phase = 'expired'; return }
      const ticket = this.ticket; this.attempted = true; this.phase = 'uploading'; this.uploadAbort = new AbortController()
      const data = new FormData(); data.append('files[]', this.files[0])
      try {
        await axios.post(ticket.postURL, data, {
          headers: { 'x-signature': ticket.signature, 'x-expires': ticket.expires, 'x-metadata': ticket.metadata, 'x-host': new URL(ticket.postURL).host },
          signal: this.uploadAbort.signal,
          timeout: 86400000,
          onUploadProgress: event => { if (this.current(scope) && event.total > 0) this.percentage = Math.min(100, Math.round(event.loaded * 100 / event.total)) }
        })
        if (!this.current(scope)) return
        this.ticket = null
        await this.observe(scope)
      } catch (error) {
        if (this.current(scope)) { this.phase = 'transferFailed'; this.submitError = this.errorText(error); this.$emit('refresh-data') }
      } finally { this.ticket = null; this.uploadAbort = null }
    },
    async observe (scope) {
      this.phase = 'checking'
      try {
        const record = await findLocalKubernetesVersion(getAPI, this.acceptedParams, this.isoId, this.$store.getters, this.options(), () => this.current(scope))
        if (!this.current(scope) || !record) return
        this.receipt = record
        const result = await observeKubernetesUrl(getAPI, record, this.acceptedParams.zoneid, this.$store.getters, this.options(), () => this.current(scope), { ...this.acceptedParams, directdownload: false })
        if (!this.current(scope)) return
        this.receipt = result.record || record; this.reasons = result.reasons || []
        this.phase = result.key === 'ready' ? 'done' : result.key === 'failed' ? 'failed' : result.key === 'progress' ? 'pending' : 'checkFailed'
        if (this.phase === 'checkFailed') this.submitError = this.$t('message.kubernetes.iso.read.' + result.key)
        if (this.phase === 'done' && this.attempt) rememberKubernetesUrlAttempt(this.attempt, 'accepted', record)
        this.$emit('refresh-data')
      } catch (error) { if (this.current(scope)) { this.phase = 'checkFailed'; this.submitError = this.errorText(error) } }
    },
    async retryUpload () {
      if (this.busy || this.phase !== 'preflight' || this.attempted) return
      this.busy = true; const scope = this.registrationScope
      try { await this.sendFile(scope) } finally { if (this.current(scope)) this.busy = false }
    },
    interruptTransfer () { if (this.phase === 'uploading' && this.uploadAbort) this.uploadAbort.abort() },
    async checkAccepted () {
      if (this.busy || this.checking || !this.isoId || !this.acceptedParams) return
      this.checking = true; this.submitError = ''; const scope = this.registrationScope
      try { await this.observe(scope) } finally { if (this.current(scope)) this.checking = false }
    },
    openResource (kind) { const id = kind === 'iso' ? this.isoId : this.receipt.id; if (this.busy || this.checking || !id) return; this.$emit('close-action'); this.$router.push({ path: '/' + (kind === 'iso' ? 'iso' : 'kubernetesiso') + '/' + id }) },
    openCatalog () { if (!this.busy) { this.$emit('close-action'); this.$router.push({ path: '/kubernetesiso', query: { keyword: this.form.name } }) } },
    closeAction () { if (!this.busy) { this.ticket = null; this.$emit('close-action') } }
  }
}
</script>
<style scoped>
.upload-notice { margin: 12px 0; }
</style>
