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
  <MoldDialog
    class="vpn-customer-gateway-dialog"
    :title="$t(currentAction.label)"
    :doc-help="currentAction.docHelp"
    size="md"
    focus-guard
    :closable="!running"
    :keyboard="!running"
    :after-close="afterClose"
    :focus-trigger-after-close="false"
    @cancel="close">
    <a-alert
      v-if="result"
      class="gateway-result"
      show-icon
      :type="running ? 'info' : result === 'unknown' ? 'warning' : 'error'"
      :message="result === 'failed' ? errorText : $t('message.vpn.customer.gateway.job.' + result)">
      <template v-if="jobId && result === 'unknown'" #description><code>{{ jobId }}</code></template>
    </a-alert>
    <a-alert
      v-if="editing"
      class="gateway-result"
      type="info"
      show-icon
      :message="$t('message.vpn.customer.gateway.update.impact')" />
    <div :inert="locked || undefined">
      <div v-if="!editing" class="gateway-registration-owner">
        <a-form v-if="!project.id && (allProjects || canChooseAccount)" layout="vertical">
          <a-form-item :label="$t('label.vpn.customer.gateway.owner')" required>
            <a-select
              id="cgw-owner-mode"
              :value="mode || undefined"
              :placeholder="$t('message.vpn.customer.gateway.owner.select')"
              :options="ownerModes"
              @change="selectMode" />
          </a-form-item>
          <a-form-item v-if="mode === 'project'" :label="$t('label.project')" required>
            <a-select
              id="cgw-owner-project"
              v-model:value="selectedProject"
              show-search
              option-filter-prop="label"
              :loading="lookup === 'project'"
              :options="projects.map(row => ({ value: row.id, label: row.name }))" />
          </a-form-item>
          <template v-if="mode === 'account'">
            <a-form-item :label="$t('label.domain')" required>
              <a-select
                id="cgw-owner-domain"
                :value="domainId"
                show-search
                option-filter-prop="label"
                :loading="lookup === 'domain'"
                :options="domains.map(row => ({ value: row.id, label: row.path || row.name }))"
                @change="selectDomain" />
            </a-form-item>
            <a-form-item :label="$t('label.account')" required>
              <a-select
                id="cgw-owner-account"
                v-model:value="account"
                show-search
                option-filter-prop="label"
                :disabled="!domainId"
                :loading="lookup === 'account'"
                :options="accounts.map(row => ({ value: row.name, label: row.name }))" />
            </a-form-item>
          </template>
        </a-form>
        <a-alert
          v-if="lookupError"
          type="error"
          show-icon
          :message="$t('message.vpn.customer.gateway.owner.failed')">
          <template #description><a-button size="small" @click="loadOwners(lookupError)">{{ $t('label.retry') }}</a-button></template>
        </a-alert>
        <p v-if="ownerLabel"><strong>{{ $t('label.vpn.customer.gateway.owner') }}</strong> {{ ownerLabel }}</p>
        <p v-else>{{ $t('message.vpn.customer.gateway.owner.select') }}</p>
      </div>
      <VpnCustomerGateway
        v-show="editing || !!owner"
        ref="gateway"
        :initial-values="initialValues"
        :api-params="apiParams"
        :policy-owner="policyOwner"
        @ready="policyReady = $event"
        @submit="submit"
        @cancel="$emit('close-action')" />
    </div>
    <template #footer>
      <a-button :disabled="running" @click="close">{{ $t('label.cancel') }}</a-button>
      <a-button v-if="result === 'unknown' && jobId" type="primary" @click="track(true)">
        {{ $t('label.vpn.customer.gateway.job.recheck') }}
      </a-button>
      <a-button v-else type="primary" :disabled="locked || !policyReady || !editing && !owner" :loading="running" @click="$refs.gateway.handleSubmit()">
        {{ $t('label.ok') }}
      </a-button>
    </template>
  </MoldDialog>
</template>

<script>
import { getAPI, postAPI } from '@/api'
import { affinityOwnerOptions } from '@/utils/affinityGroupCreation'
import { networkCollection } from '@/utils/networkLifecycle'
import MoldDialog from '@/components/view/MoldDialog'
import VpnCustomerGateway from './VpnCustomerGateway.vue'
import { gatewayErrorText, gatewayJobTracker, gatewayRequestError, gatewayRequestOptions } from '@/utils/vpnCustomerGatewayJobs'

function policyParts (policy = '') {
  const [cipherHash, dh] = policy.split(';')
  const [encryption, hash] = cipherHash.split('-')
  return { encryption, hash, dh }
}

export default {
  name: 'VpnCustomerGatewayDialog',
  components: { MoldDialog, VpnCustomerGateway },
  props: {
    currentAction: { type: Object, required: true },
    resource: { type: Object, default: () => ({}) },
    afterClose: { type: Function, default: undefined }
  },
  emits: ['close-action', 'refresh-data'],
  data () {
    return {
      result: '',
      errorText: '',
      jobId: '',
      policyReady: false,
      active: true,
      mode: this.$store.getters.listAllProjects ? '' : 'self',
      selectedProject: undefined,
      domainId: undefined,
      account: undefined,
      projects: [],
      domains: [],
      accounts: [],
      lookup: '',
      lookupError: '',
      ownerLookupVersion: 0
    }
  },
  computed: {
    editing () { return this.currentAction.api === 'updateVpnCustomerGateway' },
    project () { return this.$store.getters.project || {} },
    allProjects () { return !!this.$store.getters.listAllProjects && !this.project.id },
    canChooseAccount () {
      const { userInfo, apis } = this.$store.getters
      return ['Admin', 'DomainAdmin'].includes(userInfo?.roletype) && !!apis.listDomains && !!apis.listAccounts &&
        !!this.apiParams.account && !!this.apiParams.domainid
    },
    ownerModes () {
      const modes = [{ value: 'self', label: this.$t('label.vpn.customer.gateway.owner.self') }]
      if (this.allProjects && this.$store.getters.apis.listProjects && this.apiParams.projectid) modes.push({ value: 'project', label: this.$t('label.project') })
      if (this.canChooseAccount) modes.push({ value: 'account', label: this.$t('label.account') })
      return modes
    },
    owner () {
      const user = this.$store.getters.userInfo || {}
      if (this.editing) return null
      if (this.project.id) return { params: { projectid: this.project.id }, domain: this.project.domainid, label: this.project.name || this.project.id }
      if (this.mode === 'self') return { params: { ignoreproject: true }, label: [user.domain, user.account].filter(Boolean).join(' / '), domain: user.domainid }
      if (this.mode === 'project') {
        const row = this.projects.find(row => row.id === this.selectedProject)
        if (row) return { params: { projectid: row.id }, domain: row.domainid, label: row.name }
      }
      if (this.mode === 'account' && this.canChooseAccount && this.accounts.some(row => row.name === this.account)) {
        const row = this.domains.find(row => row.id === this.domainId)
        if (row) return { params: { account: this.account, domainid: row.id, ignoreproject: true }, domain: row.id, label: [row.path || row.name, this.account].join(' / ') }
      }
      return null
    },
    ownerLabel () { return this.owner?.label },
    policyOwner () {
      if (this.editing) return JSON.stringify([this.resource.id, this.resource.domainid])
      return this.owner ? JSON.stringify([this.owner.params, this.owner.domain]) : ''
    },
    apiParams () { return this.$getApiParams(this.currentAction.api) },
    running () { return ['submitting', 'pending'].includes(this.result) },
    locked () { return this.running || this.result === 'unknown' },
    initialValues () {
      if (!this.editing) return {}
      const { name, domainid, gateway, cidrlist, ipsecpsk, ikepolicy, esppolicy, ikelifetime, esplifetime, dpd, splitconnections, forceencap, ikeversion, id } = this.resource
      const ike = policyParts(ikepolicy)
      const esp = policyParts(esppolicy)
      return {
        id,
        name,
        domainid,
        gateway,
        cidrlist,
        ipsecpsk,
        ikelifetime,
        esplifetime,
        dpd,
        splitconnections,
        forceencap,
        ikeversion,
        ikeEncryption: ike.encryption,
        ikeHash: ike.hash,
        ikeDh: ike.dh,
        espEncryption: esp.encryption,
        espHash: esp.hash,
        espDh: esp.dh
      }
    }
  },
  watch: {
    policyOwner: { flush: 'sync', handler () { this.policyReady = false } }
  },
  created () { this.tracker = gatewayJobTracker() },
  beforeUnmount () {
    this.active = false
    this.tracker.clear()
  },
  methods: {
    selectMode (mode) {
      this.ownerLookupVersion++
      this.mode = mode
      this.selectedProject = undefined
      this.domainId = undefined
      this.account = undefined
      this.projects = []
      this.domains = []
      this.accounts = []
      this.lookup = ''
      this.lookupError = ''
      if (mode === 'project') this.loadOwners('project')
      if (mode === 'account') this.loadOwners('domain')
    },
    selectDomain (domain) {
      this.domainId = domain
      this.account = undefined
      this.accounts = []
      this.loadOwners('account')
    },
    async loadOwners (kind) {
      const version = ++this.ownerLookupVersion
      const domain = this.domainId
      this.lookup = kind
      this.lookupError = ''
      const current = () => this.active && version === this.ownerLookupVersion
      try {
        if (kind === 'project') {
          const rows = await networkCollection(getAPI, 'listProjects', 'project', { listall: true, state: 'Active', ignoreproject: true })
          if (current()) this.projects = rows
        } else {
          const rows = await affinityOwnerOptions(getAPI, kind, domain)
          if (!current()) return
          if (kind === 'domain') this.domains = rows
          else this.accounts = rows.filter(row => row.domainid === domain && Number(row.accounttype) !== 5)
        }
      } catch (_) {
        if (current()) this.lookupError = kind
      } finally {
        if (current()) this.lookup = ''
      }
    },
    close () {
      if (this.running) return
      if (this.result === 'unknown') this.$emit('refresh-data', { irefresh: true })
      this.$emit('close-action')
    },
    fail (text) {
      const psk = this.$refs.gateway?.form.ipsecpsk
      this.errorText = gatewayErrorText(text, psk) || this.$t('message.request.failed')
      this.result = 'failed'
      if (this.$refs.gateway) this.$refs.gateway.resetSubmission()
    },
    async track (retry = false) {
      if (retry && this.result !== 'unknown') return
      this.result = 'pending'
      const job = await this.tracker.track(this.jobId, {}, retry)
      if (!this.active) return
      if (job.jobstatus === 1) {
        this.$message.success(this.$t(this.editing ? 'message.success.update.vpn.customer.gateway' : 'message.success.add.vpn.customer.gateway'))
        this.$emit('refresh-data', { irefresh: true })
        this.$emit('close-action')
      } else if (job.jobstatus === 2) {
        this.fail(job.jobresult?.errortext)
      } else {
        this.result = 'unknown'
      }
    },
    async submit ({ payload }) {
      if (!this.active || this.locked || !this.policyReady || !this.editing && !this.owner) return
      this.result = 'submitting'
      this.jobId = ''
      const request = this.editing ? { ...payload, id: this.resource.id, ignoreproject: true } : { ...payload, ...this.owner.params }
      try {
        const response = await postAPI(this.currentAction.api, request, gatewayRequestOptions)
        if (!this.active) return
        this.jobId = response?.[this.currentAction.api.toLowerCase() + 'response']?.jobid || ''
        if (this.jobId) await this.track()
        else this.result = 'unknown'
      } catch (error) {
        if (!this.active) return
        const detail = gatewayRequestError(error)
        if (detail) this.fail(detail)
        else this.result = 'unknown'
      }
    }
  }
}
</script>

<style scoped>
.gateway-result, .gateway-registration-owner { margin-bottom: 16px; }
</style>
