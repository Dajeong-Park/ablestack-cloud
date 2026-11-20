<!--
Licensed to the Apache Software Foundation (ASF) under one or more
contributor license agreements. See the NOTICE file distributed with this work
for additional information regarding copyright ownership. The ASF licenses this
file to you under the Apache License, Version 2.0 (the "License"); you may not use
this file except in compliance with the License. You may obtain a copy at
http://www.apache.org/licenses/LICENSE-2.0
Unless required by applicable law or agreed to in writing, software distributed
under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
CONDITIONS OF ANY KIND, either express or implied. See the License for the
specific language governing permissions and limitations under the License.
-->
<template>
  <MoldDialog size="md" :title="$t(currentAction.label)" form-actions focus-guard @cancel="close">
    <KmsTargetSummary v-if="target.id" :target="latest || target" :kind="kind" :show-usage="deleting || disabling" :references="latest" />
    <a-form v-if="!deleting" class="kms-operation-form" layout="vertical" @keydown.ctrl.enter.stop.prevent @submit.prevent="!rotating && !disabling && submit()">
      <a-form-item v-if="editingMetadata" :label="$t('label.name')" html-for="kms-operation-name" required :validate-status="fieldError === 'name' ? 'error' : undefined">
        <a-input id="kms-operation-name" v-model:value="form.name" :maxlength="255" :disabled="locked" />
      </a-form-item>
      <a-form-item v-if="editingMetadata && !hsm" :label="$t('label.description')" html-for="kms-operation-description">
        <a-textarea id="kms-operation-description" v-model:value="form.description" :disabled="locked" />
      </a-form-item>
      <a-form-item v-if="updating" :label="$t('label.enabled')" html-for="kms-operation-enabled">
        <a-switch id="kms-operation-enabled" v-model:checked="form.enabled" :disabled="locked" />
      </a-form-item>
      <template v-if="creating">
        <a-form-item :label="$t('label.zone')" html-for="kms-operation-zone" required :validate-status="fieldError === 'zoneid' ? 'error' : undefined">
          <a-select id="kms-operation-zone" v-model:value="form.zoneid" :options="options.zones" :disabled="locked || loading" @change="clearProfile" />
        </a-form-item>
        <template v-if="chooseOwner">
          <a-form-item :label="$t('label.project')" html-for="kms-operation-project">
            <a-select id="kms-operation-project" v-model:value="form.projectid" :options="options.projects" :disabled="locked || loading" allow-clear @change="changeProject" />
          </a-form-item>
          <template v-if="!form.projectid">
            <a-form-item :label="$t('label.domain')" html-for="kms-operation-domain">
              <a-select id="kms-operation-domain" v-model:value="form.domainid" :options="options.domains" :disabled="locked || loading" allow-clear @change="changeDomain" />
            </a-form-item>
            <a-form-item :label="$t('label.account')" html-for="kms-operation-account" :required="!!form.domainid" :validate-status="fieldError === 'account' ? 'error' : undefined">
              <a-select id="kms-operation-account" v-model:value="form.account" :options="options.accounts" :disabled="locked || accountLoading || !form.domainid" allow-clear @change="clearProfile" />
            </a-form-item>
          </template>
        </template>
      </template>
      <template v-if="creating || rotating">
        <a-form-item :label="$t('label.hsm.profile')" html-for="kms-operation-profile" :required="creating" :validate-status="fieldError === 'hsmprofileid' ? 'error' : undefined">
          <a-select id="kms-operation-profile" v-model:value="form.hsmprofileid" :options="profileOptions" :disabled="locked || loading" @change="availabilityError = ''" :allow-clear="rotating" :placeholder="rotating ? $t('label.kms.operation.keep.profile') : undefined" />
        </a-form-item>
        <a-form-item :label="$t('label.keybits')" html-for="kms-operation-bits" required :validate-status="fieldError === 'keybits' ? 'error' : undefined">
          <a-select id="kms-operation-bits" v-model:value="form.keybits" :options="bitOptions" :disabled="locked" />
        </a-form-item>
      </template>
    </a-form>
    <a-alert v-else class="kms-operation-form" type="warning" show-icon :message="$t(currentAction.message)" />
    <template v-if="rotating">
      <a-descriptions class="kms-operation-form kms-rotation-summary" :title="$t('label.kms.risk.requested')" :column="{ xs: 1, sm: 2 }" size="small" bordered>
        <a-descriptions-item :label="$t('label.keybits')">{{ requestedBits }}</a-descriptions-item>
        <a-descriptions-item :label="$t('label.hsm.profile')">{{ requestedHsm }}</a-descriptions-item>
      </a-descriptions>
      <a-alert class="kms-operation-form" type="info" show-icon :message="$t('message.kms.risk.rewrap')" />
    </template>
    <a-alert v-if="disabling" class="kms-operation-form" type="warning" show-icon :message="$t('message.kms.risk.disable')" />
    <KmsAvailabilityNotice
      v-if="blockingAvailability"
      class="kms-operation-form"
      :reason="blockingAvailability"
      :loading="loading || busy"
      refreshable
      :hsm-help="creating || rotating"
      @refresh="load" />
    <div v-if="status" ref="status" tabindex="-1" class="kms-operation-form">
      <a-alert show-icon :type="statusType" :role="statusType === 'error' ? 'alert' : 'status'" :message="status" />
      <div v-if="operation.jobId" class="kms-operation-id">{{ $t('label.jobid') }} {{ operation.jobId }}</div>
      <div v-if="operation.observation && operation.phase === 'unknown'">{{ $t('message.kms.operation.observed', operation.observation) }}</div>
    </div>
    <MoldDialogActions :busy="busy">
      <a-button ref="cancel" :disabled="busy" @click="close">{{ $t(operation.phase === 'succeeded' || operation.phase === 'unknown' ? 'label.close' : 'label.cancel') }}</a-button>
      <a-button v-if="operation.phase === 'unknown'" :disabled="busy || !valid" type="primary" @click="check">{{ $t('label.kms.migration.check') }}</a-button>
      <a-button v-else-if="operation.phase !== 'succeeded'" :disabled="busy || !valid || loading || accountLoading || !!blockingAvailability" :loading="busy" type="primary" :danger="deleting" @click="submit">
        {{ $t(submitLabel) }}
      </a-button>
    </MoldDialogActions>
  </MoldDialog>
</template>

<script>
import MoldDialog from '@/components/view/MoldDialog'
import MoldDialogActions from '@/components/view/MoldDialogActions'
import KmsTargetSummary from '@/components/view/KmsTargetSummary'
import { kmsDeleteBlock, kmsReferenceName, kmsRiskTargetChanged } from '@/utils/kmsRisk'
import KmsAvailabilityNotice from '@/components/view/KmsAvailabilityNotice'
import { getAPI, postAPI } from '@/api'
import { kmsAuth, kmsLookup, kmsListPage } from '@/utils/kmsSearch'
import { actionAvailability, hsmCandidateReason, kmsAvailabilityFailure, projectOwner, sameKmsOwner, loadScopedHsmCandidates, readHsmCandidate } from '@/utils/kmsAvailability'
import { kmsKeyBits, kmsOperationState, kmsOperationBusy, discardKmsOperation, keyBitsParams, readKmsResource, kmsResourceMatch, kmsReadScope, safeKmsObservation, submitKmsOperation, verifyKmsOperation } from '@/utils/kmsOperation'

export default {
  name: 'KmsOperationDialog',
  components: { MoldDialog, MoldDialogActions, KmsAvailabilityNotice, KmsTargetSummary },
  props: { currentAction: { type: Object, required: true } },
  emits: ['close-action', 'refresh-data'],
  data () {
    const target = Object.freeze({ ...this.currentAction.kmsTarget })
    return {
      target,
      form: { name: target.name || '', description: target.description || '', enabled: target.enabled === true, keybits: this.currentAction.api === 'rotateKMSKey' ? 'keep' : 256, zoneid: null, hsmprofileid: undefined, domainid: undefined, account: undefined, projectid: this.$store.getters.project?.id },
      operation: kmsOperationState(),
      options: { zones: [], profiles: [], projects: [], domains: [], accounts: [] },
      loading: false,
      candidateState: 'loading',
      availabilityError: '',
      latest: null,
      accountLoading: false,
      invalidated: false,
      accountVersion: 0,
      fieldError: '',
      expected: null,
      before: null,
      initialScope: ''
    }
  },
  computed: {
    api () { return this.currentAction.api },
    hsm () { return this.api.endsWith('HSMProfile') },
    listApi () { return this.hsm ? 'listHSMProfiles' : 'listKMSKeys' },
    kind () { return this.hsm ? 'hsmprofile' : 'kmskey' },
    creating () { return this.api === 'createKMSKey' },
    rotating () { return this.api === 'rotateKMSKey' },
    updating () { return this.api.startsWith('update') },
    deleting () { return this.api.startsWith('delete') },
    disabling () { return this.updating && (this.latest || this.target).enabled === true && !this.form.enabled },
    submitLabel () {
      if (this.deleting) return this.hsm ? 'label.kms.risk.deleteProfile' : 'label.kms.risk.deleteKey'
      if (this.rotating) return 'label.kms.risk.rotate'
      if (this.disabling) return 'label.disabled'
      if (this.operation.phase === 'failed') return 'label.retry'
      return this.updating ? 'label.save' : 'label.ok'
    },
    requestedBits () { return (this.form.keybits === 'keep' ? (this.latest || this.target).keybits : this.form.keybits) ?? '—' },
    requestedHsm () {
      const current = this.latest || this.target
      if (!this.form.hsmprofileid) return kmsReferenceName(current.hsmprofile, current.hsmprofileid) || '—'
      const profile = this.options.profiles.find(item => item.id === this.form.hsmprofileid)
      return kmsReferenceName(profile?.name, this.form.hsmprofileid)
    },
    editingMetadata () { return this.creating || this.updating },
    chooseOwner () { return this.creating && this.$store.getters.userInfo?.roletype === 'Admin' && !this.$store.getters.project?.id },
    scope () { return JSON.stringify([this.$route.fullPath, kmsAuth(this.$store.getters, this.$store.state?.user?.token)]) },
    valid () {
      const apis = this.$store.getters.apis || {}
      const async = this.rotating || this.api === 'deleteKMSKey'
      return !this.invalidated && this.scope === this.initialScope && !!apis[this.api] && !!apis[this.listApi] &&
        (!async || !!apis.queryAsyncJobResult) && (this.creating || !!this.target.id)
    },
    busy () { return this.valid && kmsOperationBusy(this.operation) },
    blocksNavigation () { return this.busy },
    locked () { return !this.valid || this.busy || ['unknown', 'succeeded'].includes(this.operation.phase) },
    bitOptions () {
      const options = kmsKeyBits.map(value => ({ value, label: String(value) }))
      return this.rotating ? [{ value: 'keep', label: this.$t('label.kms.operation.keep.bits') }, ...options] : options
    },
    owner () {
      if (!this.creating) return this.latest || this.target
      const g = this.$store.getters
      const project = this.form.projectid && (this.options.projects.find(item => item.value === this.form.projectid)?.owner || (g.project?.id === this.form.projectid ? g.project : { id: this.form.projectid }))
      const target = projectOwner(g, project)
      if (!project && this.form.domainid && this.form.account) Object.assign(target, { domainid: this.form.domainid, account: this.form.account })
      return { ...target, zoneid: this.form.zoneid }
    },
    eligibleProfiles () {
      return this.options.profiles.filter(profile => !hsmCandidateReason(profile, this.owner))
    },
    availabilityReason () {
      return actionAvailability(this.api, {
        resource: this.latest || this.target,
        scope: { current: this.initialScope === this.scope && !this.invalidated, role: this.$store.getters.userInfo?.roletype },
        apis: this.$store.getters.apis
      })
    },
    blockingAvailability () {
      if (this.availabilityError) return this.availabilityError
      if (this.availabilityReason) return this.availabilityReason
      if (this.candidateState !== 'ready') return this.candidateState
      if (this.deleting) return kmsDeleteBlock(this.kind, this.latest)
      if (!this.creating && !this.rotating) return ''
      if (!this.eligibleProfiles.length) return 'empty'
      if (!this.form.hsmprofileid && this.rotating) {
        const currentProfile = this.options.profiles.find(profile => profile.id === (this.latest || this.target).hsmprofileid)
        return hsmCandidateReason(currentProfile, this.owner)
      }
      if (this.form.hsmprofileid) {
        return hsmCandidateReason(this.options.profiles.find(profile => profile.id === this.form.hsmprofileid), this.owner)
      }
      return ''
    },
    profileOptions () {
      return this.eligibleProfiles.map(item => ({ value: item.id, label: item.name }))
    },
    status () {
      if (!this.valid) return this.$t('message.kms.operation.context')
      if (this.fieldError && this.operation.phase === 'failed') return this.$t('message.kms.operation.field', { field: this.$t('label.' + this.fieldError) })
      if (this.operation.phase === 'editing') return ''
      return this.$t('message.kms.operation.' + (this.operation.phase === 'failed' && this.operation.reason === 'job' ? 'job.failed' : this.operation.phase))
    },
    statusType () { return !this.valid || this.operation.phase === 'failed' ? 'error' : this.operation.phase === 'unknown' ? 'warning' : this.operation.phase === 'succeeded' ? 'success' : 'info' }
  },
  watch: {
    scope: { flush: 'sync', handler () { this.invalidate() } },
    'operation.phase' (phase) {
      if (['failed', 'unknown', 'succeeded'].includes(phase)) this.$nextTick(() => this.$refs.status?.focus())
    }
  },
  mounted () {
    this.initialScope = this.scope
    this.load()
    if (this.target.id) this.$nextTick(() => this.$refs.cancel?.$el?.focus())
  },
  beforeUnmount () { this.invalidate() },
  methods: {
    invalidate () {
      this.invalidated = true
      this.candidateState = 'stale'
      this.availabilityError = ''
      this.options.profiles = []
      this.form.hsmprofileid = undefined
      this.latest = null
      discardKmsOperation(this.operation)
    },
    async load () {
      if (!this.valid || this.loading || this.busy || ['succeeded', 'unknown'].includes(this.operation.phase)) return
      this.loading = true
      this.candidateState = 'loading'
      this.availabilityError = ''
      this.options.profiles = []
      const jobs = []
      if (this.creating) jobs.push(['zoneid', 'zones'])
      if (this.chooseOwner) {
        const apis = this.$store.getters.apis
        if (apis.listProjects) jobs.push(['projectid', 'projects'])
        if (apis.listDomains && apis.listAccounts) jobs.push(['domainid', 'domains'])
      }
      try {
        await Promise.all(jobs.map(async ([field, key]) => {
          const rows = await kmsLookup(getAPI, field, {}, () => this.valid)
          if (this.valid) this.options[key] = rows.map(item => ({ value: item.id, label: item.path || item.name, owner: { id: item.id, domainid: item.domainid } }))
        }))
        const current = () => this.valid
        const projectid = this.creating ? this.form.projectid : this.target.projectid
        if (this.target.id) {
          this.latest = await this.readCurrentTarget()
          if (!this.valid || this.availabilityReason) return
        }
        if (this.creating || this.rotating) {
          const profiles = await loadScopedHsmCandidates(getAPI, projectid, current)
          if (current()) this.options.profiles = profiles
        }
        if (current()) this.candidateState = 'ready'
      } catch (error) {
        if (this.valid) {
          this.latest = null
          this.candidateState = error.message === 'STALE_TARGET' ? 'stale' : kmsAvailabilityFailure(error)
        }
      } finally { this.loading = false }
    },
    changeProject () {
      this.accountVersion++
      this.accountLoading = false
      this.form.domainid = undefined
      this.form.account = undefined
      this.options.accounts = []
      this.clearProfile()
      this.load()
    },
    clearProfile () {
      this.form.hsmprofileid = undefined
      this.availabilityError = ''
    },
    async changeDomain () {
      this.clearProfile()
      const generation = ++this.accountVersion
      this.form.account = undefined
      this.options.accounts = []
      this.accountLoading = true
      const current = () => this.valid && generation === this.accountVersion
      try {
        const rows = await kmsLookup(getAPI, 'account', { domainid: this.form.domainid }, current)
        if (current()) this.options.accounts = rows.map(item => ({ value: item.name, label: item.name }))
      } catch (error) { if (current()) this.availabilityError = kmsAvailabilityFailure(error) } finally { if (current()) this.accountLoading = false }
    },
    async readCurrentTarget () {
      const latest = await readKmsResource(getAPI, this.listApi, kmsReadScope(this.target), this.target.id, true)
      if (!this.valid || !sameKmsOwner(latest, this.target)) throw new Error('STALE_TARGET')
      return latest
    },
    async verifyAvailability (params) {
      const current = () => this.valid
      const reviewed = this.latest || this.target
      const confirmRisk = this.deleting || this.rotating || this.disabling
      let resource = this.target
      try {
        if (this.target.id) {
          resource = await this.readCurrentTarget()
          this.latest = resource
        }
        const scope = { current: current(), role: this.$store.getters.userInfo?.roletype, owner: this.owner }
        let reason = actionAvailability(this.api, { resource, scope, apis: this.$store.getters.apis })
        if (!reason && this.deleting) reason = kmsDeleteBlock(this.kind, resource)
        if (!reason && confirmRisk && kmsRiskTargetChanged(reviewed, resource)) reason = 'targetChanged'
        if (!reason && (this.creating || this.rotating)) {
          const profileId = params.hsmprofileid || resource.hsmprofileid
          const selected = this.options.profiles.find(profile => profile.id === profileId)
          const profile = await readHsmCandidate(getAPI, selected || (profileId ? { id: profileId, projectid: resource.projectid } : null), current)
          reason = hsmCandidateReason(profile, scope.owner)
        }
        if (current() && reason) this.availabilityError = reason
      } catch (error) {
        if (current()) {
          this.latest = null
          this.availabilityError = error.message === 'STALE_TARGET' ? 'stale' : kmsAvailabilityFailure(error)
        }
      }
      if (!current() || this.availabilityError) throw new Error('AVAILABILITY')
      if (this.rotating) this.before = resource
    },
    validation (field) {
      this.fieldError = field
      throw new Error('INVALID_FORM')
    },
    async prepare () {
      this.fieldError = ''
      this.availabilityError = ''
      const params = { ignoreproject: true }
      if (this.target.id) params.id = this.target.id
      if (this.editingMetadata) {
        if (!this.form.name.trim()) this.validation('name')
        params.name = this.form.name.trim()
        if (!this.hsm && (this.updating || this.form.description)) params.description = this.form.description
      }
      if (this.updating) params.enabled = this.form.enabled
      if (this.creating) {
        if (!this.options.zones.some(item => item.value === this.form.zoneid)) this.validation('zoneid')
        if (this.form.domainid && !this.options.accounts.some(item => item.value === this.form.account)) this.validation('account')
        Object.assign(params, { zoneid: this.form.zoneid }, kmsReadScope(this.form))
      }
      if (this.creating || this.rotating) {
        if (this.creating || this.form.hsmprofileid) {
          if (!this.profileOptions.some(item => item.value === this.form.hsmprofileid)) this.validation('hsmprofileid')
          params.hsmprofileid = this.form.hsmprofileid
        }
        try { Object.assign(params, keyBitsParams(this.form.keybits, this.rotating)) } catch (_) { this.validation('keybits') }
      }
      this.expected = { ...params }
      // Keep the target's owner even if the header's project selector changes.
      if (this.target.id && this.target.projectid) params.projectid = this.target.projectid
      await this.verifyAvailability(params)
      return params
    },
    operationOptions () {
      const scope = () => kmsReadScope(this.target.id ? this.target : this.expected || this.form)
      return {
        api: this.api,
        targetId: this.target.id,
        current: () => this.valid,
        prepare: () => this.prepare(),
        get: getAPI,
        post: postAPI,
        verify: async id => {
          const row = await readKmsResource(getAPI, this.listApi, scope(), id, this.deleting)
          return kmsResourceMatch(this.api, row, { ...this.expected, id }, this.before)
            ? safeKmsObservation(row) || { id, removed: true } : null
        },
        observe: async () => {
          if (this.target.id) {
            const row = await readKmsResource(getAPI, this.listApi, scope(), this.target.id, true)
            return { count: row ? 1 : 0 }
          }
          const json = await getAPI(this.listApi, { ...scope(), keyword: this.expected?.name, listall: true, ignoreproject: true }, { preserveOnFailure: true, timeout: 15000 })
          return { count: kmsListPage(json, this.listApi).count }
        }
      }
    },
    async submit () {
      if (this.locked || this.loading || this.accountLoading || this.blockingAvailability) return
      await submitKmsOperation(this.operation, this.operationOptions())
      if (!this.valid) return
      if (this.deleting && this.operation.phase === 'failed' && this.operation.reason === 'request') await this.load()
      if (this.operation.phase === 'succeeded' && !this.deleting) this.$emit('refresh-data')
    },
    async check () {
      if (!this.valid || this.operation.phase !== 'unknown') return
      await verifyKmsOperation(this.operation, this.operationOptions())
      if (this.valid && this.operation.phase === 'succeeded' && !this.deleting) this.$emit('refresh-data')
    },
    close () {
      if (this.busy && this.valid) return
      const removed = this.valid && this.deleting && this.operation.phase === 'succeeded' ? this.target.id : null
      this.invalidate()
      this.$emit('close-action', removed ? { kmsRemoved: removed, kmsNavigationScope: this.currentAction.kmsNavigationScope } : undefined)
    }
  }
}
</script>

<style scoped>
.kms-operation-form { margin-top: 16px; }
.kms-operation-id, .kms-rotation-summary { overflow-wrap: anywhere; }
</style>
