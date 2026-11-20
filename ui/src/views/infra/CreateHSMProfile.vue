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
  <MoldDialog size="md" :title="$t('label.create.hsmprofile')" :closable="!busy" :keyboard="!busy" focus-guard @cancel="close">
    <a-alert type="info" show-icon :message="$t('message.hsm.create.metadata')" />
    <a-alert v-if="error" type="error" show-icon :message="error" role="alert" />
    <a-alert v-if="discoveryError" type="warning" show-icon :message="$t('message.hsm.create.providers.unavailable')" />
    <div v-if="discoveryError && !saved" class="hsm-section"><a-button :disabled="busy" @click="loadProviders">{{ $t('label.refresh') }}</a-button></div>
    <a-form v-if="!saved" layout="vertical" class="hsm-create-form" @keydown.ctrl.enter.prevent>
      <a-form-item :label="$t('label.name')" html-for="hsm-create-name" required><a-input id="hsm-create-name" v-model:value="form.name" :disabled="busy || expired" :maxlength="255" /></a-form-item>
      <a-form-item :label="$t('label.protocol')" html-for="hsm-create-protocol" required>
        <a-select id="hsm-create-protocol" v-model:value="form.protocol" :disabled="busy || expired || discoveryError" @change="changeProtocol">
          <a-select-option v-for="provider in providers" :key="provider.protocol" :value="provider.protocol" :disabled="!provider.supported">{{ provider.displayname }}</a-select-option>
        </a-select>
      </a-form-item>
      <a-form-item :label="$t('label.vendorname')" html-for="hsm-create-vendor"><a-input id="hsm-create-vendor" v-model:value="form.vendorname" :disabled="busy || expired" :maxlength="255" /></a-form-item>
      <a-form-item :label="$t('label.hsm.create.scope')" html-for="hsm-create-scope" required>
        <a-select id="hsm-create-scope" v-model:value="form.ownerScope" :disabled="busy || expired" @change="changeOwner">
          <a-select-option v-for="scope in ['account', 'domain', 'project', 'public']" :key="scope" :value="scope">{{ $t('label.hsm.create.scope.' + scope) }}</a-select-option>
        </a-select>
      </a-form-item>
      <a-form-item v-if="['account', 'domain'].includes(form.ownerScope)" :label="$t('label.domain')" html-for="hsm-create-domain" required>
        <a-select id="hsm-create-domain" v-model:value="form.domainid" :disabled="busy || expired || listsLoading" show-search option-filter-prop="label" @change="changeDomain">
          <a-select-option v-for="domain in domains" :key="domain.id" :value="domain.id" :label="domain.path || domain.name">{{ domain.path || domain.name }}</a-select-option>
        </a-select>
      </a-form-item>
      <a-form-item v-if="form.ownerScope === 'account'" :label="$t('label.account')" html-for="hsm-create-account" required>
        <a-select id="hsm-create-account" v-model:value="form.account" :disabled="busy || expired || accountLoading" show-search option-filter-prop="label" @change="clearPin">
          <a-select-option v-for="account in accounts" :key="account.id" :value="account.name" :label="account.name">{{ account.name }}</a-select-option>
        </a-select>
      </a-form-item>
      <a-form-item v-if="form.ownerScope === 'project'" :label="$t('label.project')" html-for="hsm-create-project" required>
        <a-select id="hsm-create-project" v-model:value="form.projectid" :disabled="busy || expired || listsLoading" show-search option-filter-prop="label" @change="clearPin">
          <a-select-option v-for="project in projects" :key="project.id" :value="project.id" :label="project.name">{{ project.name }}</a-select-option>
        </a-select>
      </a-form-item>
      <a-form-item :label="$t('label.hsm.create.zone.scope')" html-for="hsm-create-zone-mode" required>
        <a-select id="hsm-create-zone-mode" v-model:value="form.zoneMode" :disabled="busy || expired" @change="clearPin">
          <a-select-option value="global">{{ $t('label.hsm.create.zone.global') }}</a-select-option>
          <a-select-option value="zone">{{ $t('label.hsm.create.zone.specific') }}</a-select-option>
        </a-select>
      </a-form-item>
      <a-form-item v-if="form.zoneMode === 'zone'" :label="$t('label.zone')" html-for="hsm-create-zone" required>
        <a-select id="hsm-create-zone" v-model:value="form.zoneid" :disabled="busy || expired || listsLoading" @change="clearPin">
          <a-select-option v-for="zone in zones" :key="zone.id" :value="zone.id">{{ zone.name }}</a-select-option>
        </a-select>
      </a-form-item>
      <template v-if="form.protocol === 'pkcs11'">
        <a-form-item :label="$t('label.hsm.create.library')" html-for="hsm-create-library" required><a-input id="hsm-create-library" v-model:value="form.library" :disabled="busy || expired" /></a-form-item>
        <a-form-item :label="$t('label.hsm.create.slot.mode')" html-for="hsm-create-slot-mode" required>
          <a-select id="hsm-create-slot-mode" v-model:value="form.slotMode" :disabled="busy || expired" @change="changeSlot">
            <a-select-option v-for="mode in ['slot', 'slot_list_index', 'token_label']" :key="mode" :value="mode">{{ mode }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item :label="form.slotMode" :html-for="'hsm-create-' + form.slotMode" required><a-input :id="'hsm-create-' + form.slotMode" v-model:value="form[form.slotMode]" :disabled="busy || expired" /></a-form-item>
        <a-form-item :label="$t('label.hsm.create.sessions')" html-for="hsm-create-sessions"><a-input id="hsm-create-sessions" v-model:value="form.max_sessions" :disabled="busy || expired" /></a-form-item>
        <a-form-item label="PIN" html-for="hsm-create-pin">
          <div class="hsm-pin-field" @focusout="hidePinOnExit">
            <a-input id="hsm-create-pin" v-model:value="pin" :type="showPin ? 'text' : 'password'" autocomplete="off" :disabled="busy || expired" />
            <a-button :disabled="busy || expired" :aria-pressed="showPin" @click="showPin = !showPin">{{ $t(showPin ? 'label.hsm.create.pin.hide' : 'label.hsm.create.pin.show') }}</a-button>
          </div>
          <div class="hsm-help">{{ $t('message.hsm.create.pin.optional') }}</div>
        </a-form-item>
      </template>
      <a-alert v-if="listError" type="warning" show-icon :message="$t('message.hsm.create.lists.unavailable')" />
      <p v-if="problem" role="status">{{ $t('message.hsm.create.required.' + problem) }}</p>
    </a-form>
    <template v-else>
      <a-alert type="info" show-icon :message="$t('message.hsm.create.saved')" />
      <a-descriptions :column="1" bordered size="small" class="hsm-section">
        <a-descriptions-item :label="$t('label.name')">{{ saved.name }}</a-descriptions-item>
        <a-descriptions-item :label="$t('label.id')">{{ saved.id }}</a-descriptions-item>
        <a-descriptions-item :label="$t('label.protocol')">{{ saved.protocol }}</a-descriptions-item>
        <a-descriptions-item :label="$t('label.hsm.create.scope')">{{ saved.owner }}</a-descriptions-item>
        <a-descriptions-item :label="$t('label.zone')">{{ saved.zone }}</a-descriptions-item>
      </a-descriptions>
    </template>
    <template #footer>
      <a-button :disabled="busy" @click="close">{{ $t(saved ? 'label.close' : 'label.cancel') }}</a-button>
      <a-button v-if="!saved" type="primary" :disabled="!canSubmit" :loading="busy" @click="submit">{{ $t('label.create') }}</a-button>
    </template>
  </MoldDialog>
</template>
<script>
import MoldDialog from '@/components/view/MoldDialog'
import { getAPI, postAPI } from '@/api'
import { emptyHsmForm, hsmProviders, hsmDefaultProtocol, hsmFormProblem, hsmCreateParams } from '@/utils/hsmProfileCreation'

export default {
  name: 'CreateHSMProfile',
  components: { MoldDialog },
  emits: ['close-action', 'refresh-data'],
  data () {
    return { form: emptyHsmForm(), pin: '', showPin: false, providers: [], domains: [], accounts: [], projects: [], zones: [], busy: false, listsLoading: false, accountLoading: false, discoveryError: false, listError: false, error: '', saved: null, unknown: false, disposed: false, expired: false, generation: 0, accountGeneration: 0, session: '' }
  },
  computed: {
    scopeStamp () { const g = this.$store.getters; return JSON.stringify([g.userInfo?.id, g.userInfo?.roleid, g.userInfo?.roletype, this.$store.state?.user?.token, g.project?.id, this.$route?.fullPath || this.$route?.path, ['createHSMProfile', 'listCapabilities'].filter(api => api in g.apis)]) },
    valid () { return !this.disposed && !this.expired && this.session === this.scopeStamp && this.$store.getters.userInfo?.roletype === 'Admin' && ['createHSMProfile', 'listCapabilities'].every(api => api in this.$store.getters.apis) },
    lists () { return { domains: this.domains, accounts: this.accounts, projects: this.projects, zones: this.zones } },
    problem () { return this.pin === '*****' ? 'pin' : hsmFormProblem(this.form, this.providers, this.lists) },
    canSubmit () { return this.valid && !this.busy && !this.saved && !this.unknown && !this.discoveryError && !this.listsLoading && !this.accountLoading && !this.problem }
  },
  watch: {
    scopeStamp () { if (this.session && this.session !== this.scopeStamp) { this.clearPin(); this.expired = true; this.generation++; this.accountGeneration++; this.error = this.$t('message.hsm.create.context.changed') } }
  },
  mounted () {
    this.session = this.scopeStamp
    this.loadProviders()
    this.loadLists()
    window.addEventListener('pagehide', this.clearPin)
    window.addEventListener('blur', this.hidePin)
    document.addEventListener('visibilitychange', this.visibility)
  },
  beforeUnmount () {
    this.disposed = true; this.generation++; this.accountGeneration++; this.clearPin()
    window.removeEventListener('pagehide', this.clearPin)
    window.removeEventListener('blur', this.hidePin)
    document.removeEventListener('visibilitychange', this.visibility)
  },
  methods: {
    clearPin () { this.pin = ''; this.showPin = false },
    hidePin () { this.showPin = false },
    visibility () { if (document.hidden) this.clearPin() },
    hidePinOnExit (event) { if (!event.currentTarget.contains(event.relatedTarget)) this.showPin = false },
    resetDetails () { this.clearPin(); Object.assign(this.form, { library: '', slot: '', slot_list_index: '0', token_label: '', max_sessions: '', slotMode: 'slot_list_index' }) },
    changeProtocol () { this.resetDetails() },
    changeOwner () { this.clearPin(); this.form.account = ''; this.form.projectid = ''; this.form.domainid = ''; this.accounts = []; this.accountGeneration++; this.accountLoading = false },
    changeSlot () { this.clearPin(); this.form.slot = ''; this.form.slot_list_index = ''; this.form.token_label = '' },
    close () { if (this.busy) return; this.clearPin(); this.$emit('close-action') },
    async discover () {
      if (!this.valid) throw new Error('CONTEXT_CHANGED')
      const json = await getAPI('listCapabilities', { ignoreproject: true }, { preserveOnFailure: true, timeout: 15000 })
      if (!this.valid) throw new Error('CONTEXT_CHANGED')
      return hsmProviders(json)
    },
    async loadProviders () {
      this.discoveryError = false
      try {
        const providers = await this.discover()
        if (!this.valid) return
        this.providers = providers
        if (!providers.some(p => p.protocol === this.form.protocol && p.supported)) { this.resetDetails(); this.form.protocol = hsmDefaultProtocol(providers) }
      } catch (error) { this.clearPin(); this.providers = []; this.discoveryError = true }
    },
    async readList (api, field, params = {}) {
      if (!(api in this.$store.getters.apis)) throw new Error('LIST_UNAVAILABLE')
      const rows = []
      for (let page = 1; this.valid; page++) {
        const json = await getAPI(api, { ...params, listall: true, ignoreproject: true, page, pagesize: 500 }, { preserveOnFailure: true, timeout: 15000 })
        if (!this.valid) throw new Error('CONTEXT_CHANGED')
        const result = json?.[api.toLowerCase() + 'response']
        if (!result || !Array.isArray(result[field] || [])) throw new Error('LIST_UNAVAILABLE')
        const batch = result[field] || []
        const count = result.count === undefined && batch.length === 0 ? 0 : result.count
        if (!Number.isInteger(count) || count < rows.length + batch.length) throw new Error('LIST_UNAVAILABLE')
        rows.push(...batch)
        if (rows.length === count) return rows
        if (!batch.length) throw new Error('LIST_UNAVAILABLE')
      }
      throw new Error('CONTEXT_CHANGED')
    },
    async loadLists () {
      const generation = ++this.generation
      this.listsLoading = true; this.listError = false
      await Promise.all([['listZones', 'zone', 'zones'], ['listDomains', 'domain', 'domains'], ['listProjects', 'project', 'projects']].map(async ([api, field, key]) => {
        try { const rows = await this.readList(api, field); if (this.valid && generation === this.generation) this[key] = rows } catch (error) { if (!this.disposed && generation === this.generation) this.listError = true }
      }))
      if (generation !== this.generation) return
      this.listsLoading = false
      const domain = this.domains.find(d => d.id === this.$store.getters.userInfo?.domainid)
      if (domain && !this.form.domainid && this.form.ownerScope === 'account') { this.form.domainid = domain.id; await this.changeDomain() }
    },
    async changeDomain () {
      const generation = ++this.accountGeneration
      this.clearPin(); this.form.account = ''; this.accounts = []
      this.accountLoading = false
      if (this.form.ownerScope !== 'account' || !this.form.domainid) return
      const domain = this.form.domainid
      this.accountLoading = true
      try {
        const rows = await this.readList('listAccounts', 'account', { domainid: domain })
        if (!this.valid || generation !== this.accountGeneration || domain !== this.form.domainid) return
        this.accounts = rows.filter(a => a.domainid === domain)
        const current = this.$store.getters.userInfo?.account
        if (this.accounts.some(a => a.name === current)) this.form.account = current
      } catch (error) { if (generation === this.accountGeneration) this.listError = true } finally { if (generation === this.accountGeneration) this.accountLoading = false }
    },
    async submit () {
      if (!this.canSubmit) return
      let submittedPin = this.pin
      this.clearPin()
      this.busy = true; this.error = ''
      let params
      let discovered = false
      try {
        const providers = await this.discover()
        if (!this.valid) throw new Error('CONTEXT_CHANGED')
        discovered = true
        this.providers = providers
        params = hsmCreateParams(this.form, providers, this.lists, submittedPin)
        submittedPin = ''
        const owner = params.account || this.projects.find(p => p.id === params.projectid)?.name || this.domains.find(d => d.id === params.domainid)?.name
        const summary = { name: params.name, protocol: params.protocol, owner: [this.$t('label.hsm.create.scope.' + this.form.ownerScope), owner].filter(Boolean).join(' / '), zone: params.zoneid ? this.zones.find(z => z.id === params.zoneid)?.name : this.$t('label.hsm.create.zone.global') }
        this.unknown = true
        const request = postAPI('createHSMProfile', params, { preserveOnFailure: true, timeout: 30000 })
        this.clearPin()
        delete params['details[0].pin']
        const response = (await request)?.createhsmprofileresponse
        const result = response?.hsmprofile || response
        if (!this.valid) return
        if (!result?.id) throw new Error('RESULT_UNKNOWN')
        this.saved = { ...summary, id: result.id }
        this.unknown = false
        this.$emit('refresh-data')
      } catch (error) {
        if (this.valid) {
          if (!discovered) { this.discoveryError = true; this.providers = [] }
          if (error?.response?.status >= 400 && error.response.status < 500) this.unknown = false
          this.error = this.$t(this.unknown ? 'message.hsm.create.unknown' : 'message.hsm.create.failed')
        }
      } finally { submittedPin = ''; this.clearPin(); if (params) delete params['details[0].pin']; this.busy = false }
    }
  }
}
</script>
<style scoped>
.hsm-create-form { margin-top: 16px; }
.hsm-section { margin-top: 16px; }
.hsm-pin-field { display: flex; gap: 8px; }
.hsm-pin-field .ant-input { min-width: 0; }
.hsm-help { margin-top: 6px; opacity: .8; }
.ant-alert + .ant-alert { margin-top: 12px; }
</style>
