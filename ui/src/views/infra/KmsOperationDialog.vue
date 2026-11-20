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
  <MoldDialog size="md" :title="$t(currentAction.label)" :closable="!busy" :keyboard="!busy" focus-guard @cancel="close">
    <a-descriptions v-if="target.id" :column="1" size="small" bordered>
      <a-descriptions-item :label="$t('label.name')">{{ target.name }}</a-descriptions-item>
      <a-descriptions-item :label="$t('label.id')"><span class="kms-operation-id">{{ target.id }}</span></a-descriptions-item>
    </a-descriptions>
    <a-form v-if="!deleting" class="kms-operation-form" layout="vertical" @keydown.ctrl.enter.stop.prevent @submit.prevent="submit">
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
          <a-select id="kms-operation-zone" v-model:value="form.zoneid" :options="options.zones" :disabled="locked || loading" />
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
              <a-select id="kms-operation-account" v-model:value="form.account" :options="options.accounts" :disabled="locked || accountLoading || !form.domainid" allow-clear />
            </a-form-item>
          </template>
        </template>
      </template>
      <template v-if="creating || rotating">
        <a-form-item :label="$t('label.hsm.profile')" html-for="kms-operation-profile" :required="creating" :validate-status="fieldError === 'hsmprofileid' ? 'error' : undefined">
          <a-select id="kms-operation-profile" v-model:value="form.hsmprofileid" :options="profileOptions" :disabled="locked || loading" :allow-clear="rotating" :placeholder="rotating ? $t('label.kms.operation.keep.profile') : undefined" />
        </a-form-item>
        <a-form-item :label="$t('label.keybits')" html-for="kms-operation-bits" required :validate-status="fieldError === 'keybits' ? 'error' : undefined">
          <a-select id="kms-operation-bits" v-model:value="form.keybits" :options="bitOptions" :disabled="locked" />
        </a-form-item>
      </template>
    </a-form>
    <a-alert v-else class="kms-operation-form" type="warning" show-icon :message="$t(currentAction.message)" />
    <a-alert v-if="lookupError" class="kms-operation-form" type="warning" show-icon :message="$t('message.kms.operation.lookup')">
      <template #description><a-button size="small" :disabled="locked || loading" @click="load">{{ $t('label.refresh') }}</a-button></template>
    </a-alert>
    <div v-if="status" ref="status" tabindex="-1" class="kms-operation-form">
      <a-alert show-icon :type="statusType" :role="statusType === 'error' ? 'alert' : 'status'" :message="status" />
      <div v-if="operation.jobId" class="kms-operation-id">{{ $t('label.jobid') }} {{ operation.jobId }}</div>
      <div v-if="operation.observation && operation.phase === 'unknown'">{{ $t('message.kms.operation.observed', operation.observation) }}</div>
    </div>
    <template #footer>
      <a-space>
        <a-button :disabled="busy" @click="close">{{ $t(operation.phase === 'succeeded' || operation.phase === 'unknown' ? 'label.close' : 'label.cancel') }}</a-button>
        <a-button v-if="operation.phase === 'unknown'" :disabled="!valid" type="primary" @click="check">{{ $t('label.kms.migration.check') }}</a-button>
        <a-button v-else-if="operation.phase !== 'succeeded'" :disabled="!valid || loading || accountLoading || lookupError" :loading="busy" type="primary" :danger="deleting" @click="submit">
          {{ $t(operation.phase === 'failed' ? 'label.retry' : 'label.ok') }}
        </a-button>
      </a-space>
    </template>
  </MoldDialog>
</template>

<script>
import MoldDialog from '@/components/view/MoldDialog'
import { getAPI, postAPI } from '@/api'
import { kmsAuth, kmsLookup, kmsListPage } from '@/utils/kmsSearch'
import { kmsKeyBits, kmsOperationState, kmsOperationBusy, discardKmsOperation, keyBitsParams, readKmsResource, kmsResourceMatch, kmsReadScope, safeKmsObservation, submitKmsOperation, verifyKmsOperation } from '@/utils/kmsOperation'

export default {
  name: 'KmsOperationDialog',
  components: { MoldDialog },
  props: { currentAction: { type: Object, required: true } },
  emits: ['close-action', 'refresh-data'],
  data () {
    const target = this.currentAction.kmsTarget || {}
    return {
      target,
      form: { name: target.name || '', description: target.description || '', enabled: target.enabled === true, keybits: this.currentAction.api === 'rotateKMSKey' ? 'keep' : 256, zoneid: null, hsmprofileid: undefined, domainid: undefined, account: undefined, projectid: this.$store.getters.project?.id },
      operation: kmsOperationState(),
      options: { zones: [], profiles: [], projects: [], domains: [], accounts: [] },
      loading: false,
      lookupError: false,
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
    creating () { return this.api === 'createKMSKey' },
    rotating () { return this.api === 'rotateKMSKey' },
    updating () { return this.api.startsWith('update') },
    deleting () { return this.api.startsWith('delete') },
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
    locked () { return !this.valid || this.busy || ['unknown', 'succeeded'].includes(this.operation.phase) },
    bitOptions () {
      const options = kmsKeyBits.map(value => ({ value, label: String(value) }))
      return this.rotating ? [{ value: 'keep', label: this.$t('label.kms.operation.keep.bits') }, ...options] : options
    },
    profileOptions () {
      const zone = this.creating ? this.form.zoneid : this.target.zoneid
      return this.options.profiles.filter(item => item.enabled === true && (!item.zoneid || !zone || item.zoneid === zone))
        .map(item => ({ value: item.id, label: item.name }))
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
  },
  beforeUnmount () { this.invalidate() },
  methods: {
    invalidate () {
      this.invalidated = true
      discardKmsOperation(this.operation)
    },
    async load () {
      if (!this.valid || this.loading || (!this.creating && !this.rotating)) return
      this.loading = true
      this.lookupError = false
      const jobs = []
      if (this.creating) jobs.push(['zoneid', 'zones'])
      if (this.chooseOwner) {
        const apis = this.$store.getters.apis
        if (apis.listProjects) jobs.push(['projectid', 'projects'])
        if (apis.listDomains && apis.listAccounts) jobs.push(['domainid', 'domains'])
      }
      try {
        const loadChoices = jobs.map(async ([field, key]) => {
          const rows = await kmsLookup(getAPI, field, {}, () => this.valid)
          if (this.valid) this.options[key] = rows.map(item => ({ value: item.id, label: item.path || item.name }))
        })
        const current = () => this.valid
        const projectid = this.creating ? this.form.projectid : this.target.projectid
        const profiles = Promise.all([
          kmsLookup(getAPI, 'hsmprofileid', {}, current),
          ...(projectid ? [kmsLookup(getAPI, 'hsmprofileid', { projectid }, current)] : [])
        ]).then(groups => {
          if (current()) this.options.profiles = [...new Map(groups.flat().map(row => [row.id, row])).values()]
        })
        await Promise.all([...loadChoices, profiles])
      } catch (_) { if (this.valid) this.lookupError = true } finally { this.loading = false }
    },
    changeProject () {
      this.accountVersion++
      this.accountLoading = false
      this.form.domainid = undefined
      this.form.account = undefined
      this.options.accounts = []
      this.form.hsmprofileid = undefined
      this.load()
    },
    async changeDomain () {
      const generation = ++this.accountVersion
      this.form.account = undefined
      this.options.accounts = []
      this.accountLoading = true
      const current = () => this.valid && generation === this.accountVersion
      try {
        const rows = await kmsLookup(getAPI, 'account', { domainid: this.form.domainid }, current)
        if (current()) this.options.accounts = rows.map(item => ({ value: item.name, label: item.name }))
      } catch (_) { if (current()) this.lookupError = true } finally { if (current()) this.accountLoading = false }
    },
    validation (field) {
      this.fieldError = field
      throw new Error('INVALID_FORM')
    },
    async prepare () {
      this.fieldError = ''
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
      if (this.rotating) this.before = await readKmsResource(getAPI, this.listApi, kmsReadScope(this.target), this.target.id)
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
      if (this.locked || this.loading || this.accountLoading || this.lookupError) return
      await submitKmsOperation(this.operation, this.operationOptions())
      if (this.valid && this.operation.phase === 'succeeded' && !this.deleting) this.$emit('refresh-data')
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
      this.$emit('close-action', removed ? { kmsRemoved: removed } : undefined)
    }
  }
}
</script>

<style scoped>
.kms-operation-form { margin-top: 16px; }
.kms-operation-id { overflow-wrap: anywhere; }
</style>
