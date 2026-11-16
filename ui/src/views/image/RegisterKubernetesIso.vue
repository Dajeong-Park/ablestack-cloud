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
  <MoldDialog size="md" focus-guard :title="$t('label.kubernetes.version.add')" :closable="!busy" :keyboard="!busy" @cancel="closeAction">
    <a-alert v-if="showSubmitError" type="error" show-icon :message="$t(submitError)" class="registration-notice" />
    <a-form
:id="formId"
v-if="phase === 'draft' || phase === 'submitting'"
ref="registrationForm"
:model="form"
:rules="rules"
layout="vertical"
@finish="handleSubmit"
v-ctrl-enter="handleSubmit">
      <a-form-item name="semanticversion" :label="$t('label.semanticversion')" :extra="$t('message.kubernetes.iso.version.help')">
        <a-input v-focus="true" v-model:value="form.semanticversion" :disabled="busy" placeholder="1.30.0" />
      </a-form-item>
      <a-form-item name="name" :label="$t('label.name')" :extra="$t('message.kubernetes.iso.name.help')">
        <a-input v-model:value="form.name" :disabled="busy" />
      </a-form-item>
      <a-form-item name="zoneid" :label="$t('label.zoneid')">
        <a-select v-model:value="form.zoneid" :disabled="busy" :loading="zoneLoading" show-search option-filter-prop="label" @change="handleZoneChange">
          <a-select-option :value="allZones" :label="$t('label.all.zone')">{{ $t('label.all.zone') }}</a-select-option>
          <a-select-option v-for="zone in zones" :key="zone.id" :value="zone.id" :label="zone.name">{{ zone.name }}</a-select-option>
        </a-select>
        <template v-if="zoneError" #extra><span>{{ $t('message.kubernetes.iso.zones.unavailable') }}</span> <a-button type="link" size="small" :disabled="busy" @click="fetchZones">{{ $t('label.retry') }}</a-button></template>
      </a-form-item>
      <a-form-item name="url" :label="$t('label.url')">
        <a-input v-model:value="form.url" :disabled="busy" placeholder="https://example.com/kubernetes.iso" />
      </a-form-item>
      <a-form-item name="checksum" :label="$t('label.checksum')" :extra="$t('message.kubernetes.iso.checksum.help')">
        <a-input v-model:value="form.checksum" :disabled="busy" />
      </a-form-item>
      <a-row :gutter="16">
        <a-col :span="12"><a-form-item name="mincpunumber" :label="$t('label.mincpunumber')"><a-input v-model:value="form.mincpunumber" :disabled="busy" inputmode="numeric" /></a-form-item></a-col>
        <a-col :span="12"><a-form-item name="minmemory" :label="$t('label.minmemory')"><a-input v-model:value="form.minmemory" :disabled="busy" inputmode="numeric" /></a-form-item></a-col>
      </a-row>
      <a-form-item v-if="supports('directdownload')" name="directdownload" :label="$t('label.directdownload')" :extra="$t(forcedDirect ? 'message.kubernetes.iso.direct.forced' : 'message.kubernetes.iso.direct.help')">
        <a-switch v-model:checked="form.directdownload" :disabled="busy || forcedDirect" @change="handleDirectChange" />
      </a-form-item>
      <a-form-item v-if="supports('arch')" name="arch" :label="$t('label.arch')">
        <a-select v-model:value="form.arch" :disabled="busy">
          <a-select-option v-for="arch in architectureOptions" :key="arch.id" :value="arch.id">{{ arch.name || arch.id }}</a-select-option>
        </a-select>
      </a-form-item>
    </a-form>
    <template v-else-if="phase === 'accepted'">
      <a-alert type="info" show-icon :message="$t('message.kubernetes.iso.registration.accepted')" class="registration-notice" />
      <a-descriptions bordered size="small" :column="1">
        <a-descriptions-item :label="$t('label.name')">{{ receipt.name }}</a-descriptions-item>
        <a-descriptions-item :label="$t('label.id')">{{ receipt.id }}</a-descriptions-item>
        <a-descriptions-item :label="$t('label.iso')">{{ receipt.isoid || $t('label.none') }}</a-descriptions-item>
        <a-descriptions-item :label="$t('label.zoneid')">{{ selectedScopeName }}</a-descriptions-item>
        <a-descriptions-item :label="$t('label.arch')">{{ receipt.arch || $t('label.none') }}</a-descriptions-item>
        <a-descriptions-item :label="$t('label.directdownload')">{{ receipt.directdownload === true ? $t('label.yes') : receipt.directdownload === false ? $t('label.no') : $t('label.none') }}</a-descriptions-item>
      </a-descriptions>
      <a-alert class="registration-notice" show-icon :type="availabilityType" :message="$t(availabilityLabel)" />
      <ul v-if="reasons.length"><li v-for="reason in reasons" :key="reason">{{ reason }}</li></ul>
    </template>
    <template v-else-if="phase === 'uncertain'">
      <a-alert type="warning" show-icon :message="$t('message.kubernetes.iso.request.uncertain')" />
      <p v-if="candidates.length">{{ $t('message.kubernetes.iso.registration.candidates') }}</p>
      <a-button v-for="row in candidates" :key="row.id" type="link" @click="openResource(row, 'parent')">{{ row.name }} · {{ row.id }}</a-button>
    </template>
    <a-alert v-else type="warning" show-icon :message="$t('message.kubernetes.iso.registration.context')" />
    <template #footer>
      <a-button :disabled="busy" @click="closeAction">{{ $t(phase === 'draft' ? 'label.cancel' : 'label.close') }}</a-button>
      <a-button v-if="phase === 'draft' || phase === 'submitting'" type="primary" html-type="submit" :form="formId" :loading="busy" :disabled="!capability.available || zoneLoading" @click="handleSubmit">{{ $t('label.kubernetes.version.add') }}</a-button>
      <template v-else-if="phase === 'accepted'">
        <a-button :loading="checking" @click="checkAccepted">{{ $t('message.kubernetes.iso.registration.check') }}</a-button>
        <a-button v-if="receipt.isoid" :disabled="checking" @click="openResource(receipt, 'iso')">{{ $t('label.iso') }}</a-button>
        <a-button type="primary" :disabled="checking" @click="openResource(receipt, 'parent')">{{ $t('label.kubernetes.isos') }}</a-button>
      </template>
      <a-button v-else-if="phase === 'uncertain'" :loading="checking" @click="checkAccepted">{{ $t('message.kubernetes.iso.registration.check') }}</a-button>
    </template>
  </MoldDialog>
</template>

<script>
import { reactive } from 'vue'
import { getAPI, postAPI } from '@/api'
import MoldDialog from '@/components/view/MoldDialog'
import { kubernetesIsoCapability, kubernetesIsoContext } from '@/utils/kubernetesIsoCapabilities'
import { kubernetesIsoWriteResponse, kubernetesIsoFailure } from '@/utils/kubernetesIsoModel'
import { ALL_KUBERNETES_ZONES, kubernetesUrlErrors, kubernetesUrlParams, kubernetesDirectDownloadForced, kubernetesUrlAttempt, rememberKubernetesUrlAttempt, synchronizeKubernetesUrlScope, reconcileKubernetesUrl, observeKubernetesUrl } from '@/utils/kubernetesIsoRegistration'

let registrationSequence = 0
export default {
  name: 'RegisterKubernetesIso',
  inheritAttrs: false,
  components: { MoldDialog },
  emits: ['close-action', 'refresh-data'],
  data () {
    return {
      formId: 'kubernetes-url-' + (++registrationSequence),
      form: reactive({ semanticversion: '', name: '', zoneid: ALL_KUBERNETES_ZONES, url: '', checksum: '', mincpunumber: 2, minmemory: 2048, directdownload: false, arch: 'x86_64' }),
      allZones: ALL_KUBERNETES_ZONES,
      zones: [],
      zoneLoading: false,
      zoneError: false,
      directPreference: false,
      phase: 'draft',
      busy: false,
      checking: false,
      disposed: false,
      submitError: '',
      receipt: {},
      availability: 'unqueried',
      reasons: [],
      pendingParams: null,
      attempt: null,
      candidates: []
    }
  },
  computed: {
    capability () { return kubernetesIsoCapability('url', this.$store.getters) },
    registrationScope () { return kubernetesIsoContext(this.$store.getters, this.$store.state?.user?.token) },
    availabilityLabel () { return ['ready', 'progress', 'failed', 'unqueried'].includes(this.availability) ? 'message.kubernetes.iso.registration.' + this.availability : 'message.kubernetes.iso.read.' + this.availability },
    availabilityType () { return this.availability === 'ready' ? 'success' : ['failed', 'forbidden', 'expired', 'network', 'invalid', 'missing'].includes(this.availability) ? 'error' : 'info' },
    showSubmitError () { return !!this.submitError && this.submitError !== this.availabilityLabel && !(this.phase === 'uncertain' && this.submitError === 'message.kubernetes.iso.request.uncertain') },
    blocksNavigation () { return this.busy },
    forcedDirect () { return kubernetesDirectDownloadForced(this.form.zoneid, this.zones) },
    selectedScopeName () {
      const scope = this.receipt.catalog?.zone
      return scope?.kind === 'all' ? this.$t('label.all.zone') : scope?.kind === 'zone' ? scope.name || scope.id : this.$t('label.unknown')
    },
    architectureOptions () {
      const options = this.$fetchCpuArchitectureTypes?.() || []
      return ['x86_64', 'aarch64', 's390x'].map(id => options.find(row => row.id === id) || { id, name: id })
    },
    rules () {
      return Object.fromEntries(['semanticversion', 'zoneid', 'url', 'checksum', 'mincpunumber', 'minmemory', 'directdownload', 'arch'].map(key => [key, [{
        required: ['semanticversion', 'zoneid', 'url', 'mincpunumber', 'minmemory', 'arch'].includes(key),
        validator: async () => {
          const error = kubernetesUrlErrors(this.form, this.zones, this.capability)[key]
          if (error) throw new Error(this.$t(error))
        }
      }]]))
    }
  },
  watch: {
    registrationScope: {
      flush: 'sync',
      handler () { synchronizeKubernetesUrlScope(this.registrationScope); this.busy = false; this.checking = false; this.phase = 'contextChanged'; this.receipt = {}; this.pendingParams = null; this.candidates = [] }
    }
  },
  created () { synchronizeKubernetesUrlScope(this.registrationScope); this.fetchZones() },
  beforeUnmount () { this.disposed = true },
  methods: {
    supports (field) { return !this.capability.schemaKnown || !!this.capability.parameters[field] },
    isCurrent (scope) { return !this.disposed && scope === this.registrationScope && this.capability.available },
    options () { return { preserveOnFailure: true, timeout: 20000, readScope: JSON.stringify([this.$store.state?.user?.token, this.$store.getters.userInfo?.id, this.$store.getters.project?.id]) } },
    async fetchZones () {
      const scope = this.registrationScope
      if (!this.capability.available) return
      if (!this.$store.getters.apis?.listZones) { this.zoneError = true; return }
      this.zoneLoading = true; this.zoneError = false
      try {
        const json = await getAPI('listZones', {}, this.options())
        if (!this.isCurrent(scope)) return
        const zones = json?.listzonesresponse?.zone
        if (!Array.isArray(zones)) throw new Error('invalid Zone response')
        this.zones = zones.filter(z => typeof z?.id === 'string' && z.name)
        this.handleZoneChange()
      } catch (_) { if (this.isCurrent(scope)) this.zoneError = true } finally { if (this.isCurrent(scope)) this.zoneLoading = false }
    },
    handleZoneChange () { this.form.directdownload = this.forcedDirect ? true : this.directPreference },
    handleDirectChange (value) { if (!this.forcedDirect) this.directPreference = value },
    async handleSubmit (event) {
      if (event?.preventDefault) event.preventDefault()
      if (this.busy || this.checking || this.zoneLoading || this.phase !== 'draft' || !this.capability.available) return
      this.busy = true; this.submitError = ''
      const scope = this.registrationScope
      try {
        await this.$refs.registrationForm.validate()
        if (!this.isCurrent(scope)) return
        const params = kubernetesUrlParams(this.form, this.zones, this.$store.getters)
        this.pendingParams = params
        const operation = kubernetesUrlAttempt(scope, params)
        this.attempt = operation.entry
        if (!operation.fresh) {
          this.receipt = operation.entry.record || {}; this.phase = operation.entry.record ? 'accepted' : 'uncertain'
          return
        }
        this.phase = 'submitting'
        try {
          const json = await postAPI('addKubernetesSupportedVersion', params, this.options())
          if (!this.isCurrent(scope)) { rememberKubernetesUrlAttempt(operation.entry, 'uncertain'); return }
          const record = kubernetesIsoWriteResponse(json, 'url', this.$store.getters)
          rememberKubernetesUrlAttempt(operation.entry, 'accepted', record)
          this.receipt = record; this.phase = 'accepted'; this.$emit('refresh-data')
        } catch (error) {
          rememberKubernetesUrlAttempt(operation.entry, 'uncertain')
          if (!this.isCurrent(scope)) return
          this.phase = 'uncertain'; this.submitError = 'message.kubernetes.iso.request.uncertain'
        }
      } catch (error) {
        if (!this.isCurrent(scope)) return
        if (error.errorFields?.length) this.$refs.registrationForm.scrollToField(error.errorFields[0].name)
        else this.submitError = error.message?.startsWith('message.') ? error.message : 'message.kubernetes.iso.read.failed'
      } finally {
        if (this.isCurrent(scope)) {
          this.busy = false
          if (this.phase === 'accepted') await this.checkAccepted()
        }
      }
    },
    async checkAccepted () {
      if (this.checking || this.busy || !this.pendingParams || !this.capability.available) return
      this.checking = true
      const scope = this.registrationScope
      try {
        if (this.phase === 'uncertain') {
          const result = await reconcileKubernetesUrl(getAPI, this.pendingParams, this.zones, this.$store.getters, this.options(), () => this.isCurrent(scope))
          if (this.isCurrent(scope)) {
            // Matching rows are candidates, not proof that this request created them.
            this.candidates = result.rows
            this.submitError = result.status === 'forbidden' ? 'message.kubernetes.iso.read.forbidden' : ''
          }
          return
        }
        const result = await observeKubernetesUrl(getAPI, this.receipt, this.form.zoneid, this.$store.getters, this.options(), () => this.isCurrent(scope), this.pendingParams)
        if (!this.isCurrent(scope) || result.key === 'stale') return
        this.receipt = result.record; this.availability = result.key; this.reasons = result.reasons || []
        this.submitError = ''
      } catch (error) {
        if (this.isCurrent(scope)) {
          this.availability = kubernetesIsoFailure(error)
          this.submitError = 'message.kubernetes.iso.read.' + this.availability
        }
      } finally { if (this.isCurrent(scope)) this.checking = false }
    },
    openResource (row, kind) {
      const id = kind === 'iso' ? row.isoid : row.id
      if (this.busy || this.checking || !id) return
      this.$emit('close-action')
      this.$router.push({ path: '/' + (kind === 'iso' ? 'iso' : 'kubernetesiso') + '/' + id })
    },
    closeAction () { if (!this.busy) this.$emit('close-action') }
  }
}
</script>

<style scoped>
.registration-notice { margin: 12px 0; }
</style>
