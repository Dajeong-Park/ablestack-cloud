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
  <a-form
    ref="form"
    class="form-layout public-ip-reservation"
    layout="vertical"
    :model="form"
    :rules="rules"
    @keydown.ctrl.enter.prevent="!$event.repeat && submitData()"
    @finish="submitData">
    <a-descriptions class="mold-dialog-summary" :column="1" size="small">
      <a-descriptions-item :label="$t('label.ipaddress')">{{ resource.ipaddress || resource.id }}</a-descriptions-item>
      <a-descriptions-item :label="$t('label.accounttype')">{{ $t(form.ownerType === 'project' ? 'label.project' : 'label.account') }}</a-descriptions-item>
      <a-descriptions-item :label="$t('label.public.ip.reserve.owner')">{{ ownerPreview }}</a-descriptions-item>
    </a-descriptions>
    <a-alert v-if="error" class="reservation-notice" type="error" show-icon :message="error" />
    <a-alert
      v-if="operation"
      class="reservation-notice"
      type="warning"
      show-icon
      :message="$t(operation.status === 'mismatch' ? 'message.public.ip.reserve.mismatch' : 'message.public.ip.reserve.unknown')">
      <template #description>
        <div v-if="operation.actual">{{ $t('label.public.ip.reserve.observed') }}: {{ observedOwner }}</div>
        <a-button :loading="checking" :disabled="pending || checking" @click="recheck">{{ $t('label.public.ip.reserve.check') }}</a-button>
        <template v-if="operation.lastRead?.state === 'Free' && !pending">
          <a-checkbox v-model:checked="acknowledged">{{ $t('message.public.ip.reserve.acknowledge') }}</a-checkbox>
          <a-button :disabled="!acknowledged || checking" @click="endTracking">{{ $t('label.public.ip.reserve.endtracking') }}</a-button>
        </template>
      </template>
    </a-alert>
    <a-alert v-if="lookupError" class="reservation-notice" type="error" show-icon :message="lookupError">
      <template #action><a-button :disabled="pending" @click="initialize">{{ $t('label.refresh') }}</a-button></template>
    </a-alert>
    <a-form-item name="ownerType" :label="$t('label.accounttype')">
      <a-select v-model:value="form.ownerType" :disabled="locked || !!pinnedProject" @change="changeType">
        <a-select-option value="account">{{ $t('label.account') }}</a-select-option>
        <a-select-option value="project">{{ $t('label.project') }}</a-select-option>
      </a-select>
    </a-form-item>
    <a-form-item v-if="selectors && !pinnedProject" name="domainId" :label="$t('label.domain')">
      <a-select
        v-model:value="form.domainId"
        show-search
        optionFilterProp="label"
        :loading="domainsLoading"
        :disabled="locked || domainsLoading || !domains.length"
        @change="changeDomain">
        <a-select-option v-for="domain in domains" :key="domain.id" :value="domain.id" :label="domain.path || domain.name">{{ domain.path || domain.name }}</a-select-option>
      </a-select>
    </a-form-item>
    <a-form-item v-if="form.ownerType === 'account' && selectors" name="account" :label="$t('label.account')">
      <a-select
        v-model:value="form.account"
        show-search
        optionFilterProp="label"
        :loading="ownerLoading"
        :disabled="locked || ownerLoading || !accounts.length"
        @change="selectionChanged">
        <a-select-option v-for="account in accounts" :key="account.id || account.name" :value="account.name" :label="account.name">{{ account.name }}</a-select-option>
      </a-select>
    </a-form-item>
    <a-form-item v-else-if="form.ownerType === 'account'" :label="$t('label.account')">{{ user.account }}</a-form-item>
    <a-form-item v-if="form.ownerType === 'project'" name="projectId" :label="$t('label.project')">
      <a-select
        v-model:value="form.projectId"
        show-search
        optionFilterProp="label"
        :loading="ownerLoading"
        :disabled="locked || ownerLoading || !!pinnedProject || !projects.length"
        @change="selectionChanged">
        <a-select-option v-for="project in projects" :key="project.id" :value="project.id" :label="project.name">{{ project.name }}</a-select-option>
      </a-select>
    </a-form-item>
    <div v-if="candidatesReady && ((form.ownerType === 'project' && !projects.length) || (selectors && form.ownerType === 'account' && !accounts.length))" role="status">{{ $t('message.public.ip.reserve.empty') }}</div>
    <mold-dialog-actions :busy="pending" @keydown.ctrl.enter.prevent="!$event.repeat && submitData()">
      <a-button @click="closeAction">{{ $t('label.cancel') }}</a-button>
      <a-button type="primary" :loading="pending" :disabled="!canSubmit" @click="submitData">{{ $t('label.public.ip.reserve.confirm') }}</a-button>
    </mold-dialog-actions>
  </a-form>
</template>

<script>
import { getAPI, postAPI } from '@/api'
import MoldDialogActions from '@/components/view/MoldDialogActions'
import { networkCollection, networkError } from '@/utils/networkLifecycle'
import { reservationScope, reservationParams, reservationMatches, reservationOperation, rememberReservation, forgetReservation } from '@/utils/publicIpReservation'

export default {
  name: 'ReservePublicIP',
  components: { MoldDialogActions },
  props: { resource: { type: Object, required: true }, action: { type: Object, default: () => ({}) } },
  emits: ['close-action', 'refresh-data'],
  data () {
    return {
      form: { ownerType: 'account', domainId: null, account: null, projectId: null },
      domains: [],
      accounts: [],
      projects: [],
      domainsLoading: false,
      ownerLoading: false,
      lookupError: '',
      error: '',
      pending: false,
      checking: false,
      candidatesReady: false,
      active: true,
      version: 0,
      lookupVersion: 0,
      operation: null,
      acknowledged: false
    }
  },
  computed: {
    user () { return this.$store.getters.userInfo || {} },
    selectors () { return ['Admin', 'DomainAdmin'].includes(this.user.roletype) },
    pinnedProject () { const id = this.$store.getters.project?.id; return id && id !== '-1' ? id : '' },
    contextKey () { return reservationScope(this.resource, this.$route, this.$store) },
    locked () { return this.pending || !!this.operation },
    canSubmit () { return this.active && this.resource.state === 'Free' && 'reserveIpAddress' in (this.$store.getters.apis || {}) && this.candidatesReady && !this.lookupError && !this.locked && !this.ownerLoading && !this.domainsLoading },
    rules () {
      const required = [{ required: true, message: this.$t('label.required') }]
      return { ownerType: required, domainId: this.selectors && !this.pinnedProject ? required : [], account: this.selectors && this.form.ownerType === 'account' ? required : [], projectId: this.form.ownerType === 'project' ? required : [] }
    },
    ownerPreview () {
      if (this.form.ownerType === 'project') return this.projects.find(p => p.id === this.form.projectId)?.name || this.operation?.params.projectid || '—'
      const domain = this.domains.find(d => d.id === this.form.domainId)
      return [this.selectors ? this.form.account : this.user.account, domain?.path || domain?.name || this.form.domainId].filter(Boolean).join(' / ') || '—'
    },
    observedOwner () {
      const ip = this.operation?.actual || {}
      return [ip.ipaddress, ip.state, ip.project || ip.projectid || ip.account, ip.domain || ip.domainid].filter(Boolean).join(' / ')
    }
  },
  watch: { contextKey () { this.initialize() } },
  created () { this.initialize() },
  activated () { if (!this.active) { this.active = true; this.initialize() } },
  deactivated () { this.invalidate() },
  beforeUnmount () { this.invalidate() },
  methods: {
    current (scope, version = this.version) { return this.active && scope === this.contextKey && version === this.version && this.action?.currentAction?.reservationCurrent?.() !== false },
    invalidate () { this.active = false; this.version++; this.lookupVersion++ },
    selectionChanged () { this.version++; this.error = ''; if (this.$refs.form) this.$refs.form.clearValidate() },
    async initialize () {
      const scope = this.contextKey; const version = ++this.version; this.lookupVersion++
      this.lookupError = ''; this.error = ''; this.pending = false; this.checking = false; this.acknowledged = false
      this.domains = []; this.accounts = []; this.projects = []; this.candidatesReady = false
      this.operation = reservationOperation(scope)
      const previous = this.operation
      this.form = { ownerType: previous?.params.projectid || this.pinnedProject ? 'project' : 'account', domainId: previous?.domainId || this.user.domainid || null, account: previous?.params.account || null, projectId: previous?.params.projectid || this.pinnedProject || null }
      this.domainsLoading = false
      if (this.selectors && !this.pinnedProject) {
        this.domainsLoading = true
        try {
          const domains = await this.collection('listDomains', 'domain', { listall: true, details: 'min', ignoreproject: true }, () => this.current(scope, version))
          if (!this.current(scope, version)) return
          this.domains = domains
          this.form.domainId = domains.find(d => d.id === this.form.domainId)?.id || domains[0]?.id || null
          if (!this.form.domainId) throw new Error('empty')
        } catch (error) {
          if (this.current(scope, version)) this.lookupError = this.$t('message.public.ip.reserve.lookup')
          return
        } finally { if (this.current(scope, version)) this.domainsLoading = false }
      }
      if (this.current(scope, version)) await this.loadOwners()
    },
    async collection (api, field, params, current) {
      if (!(api in (this.$store.getters.apis || {}))) throw new Error('permission')
      return networkCollection((...args) => { if (!current()) throw new Error('stale'); return getAPI(...args) }, api, field, params)
    },
    changeType () { this.form.account = null; this.form.projectId = this.pinnedProject || null; this.selectionChanged(); this.loadOwners() },
    changeDomain () { this.form.account = null; this.form.projectId = null; this.selectionChanged(); this.loadOwners() },
    async loadOwners () {
      const scope = this.contextKey; const version = this.version; const lookup = ++this.lookupVersion
      const current = () => this.current(scope, version) && lookup === this.lookupVersion
      const type = this.form.ownerType; const domainid = this.form.domainId
      this.ownerLoading = true; this.lookupError = ''; this.candidatesReady = false; this.accounts = []; this.projects = []
      try {
        if (type === 'project') {
          const projects = await this.collection('listProjects', 'project', { listall: true, state: 'Active', details: 'min', ignoreproject: true, ...(this.pinnedProject ? { id: this.pinnedProject } : { domainid, isrecursive: false }) }, current)
          if (!current()) return
          this.projects = projects
          if (!projects.some(p => p.id === this.form.projectId)) this.form.projectId = null
        } else if (type === 'account' && this.selectors) {
          if (!domainid) throw new Error('domain')
          const accounts = await this.collection('listAccounts', 'account', { domainid, state: 'Enabled', isrecursive: false, ignoreproject: true }, current)
          if (!current()) return
          this.accounts = accounts
          if (!accounts.some(a => a.name === this.form.account)) this.form.account = null
        }
        if (current()) this.candidatesReady = true
      } catch (error) { if (current()) this.lookupError = this.$t('message.public.ip.reserve.lookup') } finally { if (current()) this.ownerLoading = false }
    },
    async readAddress (scope, version) {
      const json = await getAPI('listPublicIpAddresses', {
        id: this.resource.id,
        state: 'Free,Reserved,Allocated,Allocating,Releasing',
        allocatedonly: false,
        listall: true,
        ignoreproject: true,
        ...(this.pinnedProject ? { projectid: this.pinnedProject } : {})
      }, { preserveOnFailure: true })
      if (!this.current(scope, version)) return null
      const body = json?.listpublicipaddressesresponse
      if (!body || body.errorcode) throw new Error('read')
      return body.publicipaddress?.find(ip => ip.id === this.resource.id) || null
    },
    async submitData () {
      if (!this.canSubmit) return
      const scope = this.contextKey; const version = this.version
      this.pending = true; this.error = ''
      let operation
      try {
        await this.$refs.form.validate()
        if (!this.current(scope, version)) return
        const params = reservationParams(this.resource.id, this.form, this.user, this.selectors, this.accounts, this.projects, this.pinnedProject)
        const current = await this.readAddress(scope, version)
        if (!this.current(scope, version)) return
        if (current?.state !== 'Free') { this.error = this.$t('message.public.ip.reserve.unavailable'); return }
        operation = { params, domainId: this.form.domainId, status: 'pending', actual: null, lastRead: null, receipt: false }
        rememberReservation(scope, operation)
        const json = await postAPI('reserveIpAddress', { ...params, ignoreproject: true }, { preserveOnFailure: true })
        const ip = json?.reserveipaddressresponse?.ipaddress
        operation.actual = ip || null; operation.receipt = reservationMatches(ip, params)
        operation.status = operation.receipt ? 'verify' : ip ? 'mismatch' : 'unknown'
        if (!this.current(scope, version)) return
        this.operation = operation
        if (operation.receipt) await this.recheck()
      } catch (error) {
        if (operation) {
          const failure = networkError(error)
          if (failure.definitive) forgetReservation(scope)
          else operation.status = 'unknown'
          if (this.current(scope, version)) {
            this.operation = failure.definitive ? null : operation
            this.error = failure.definitive ? failure.text : ''
          }
        } else if (this.current(scope, version) && !error?.errorFields) this.error = this.$t('message.public.ip.reserve.unavailable')
      } finally { if (this.current(scope, version)) this.pending = false }
    },
    async recheck () {
      if (!this.operation || this.checking) return
      const scope = this.contextKey; const version = this.version; const operation = this.operation
      this.checking = true; this.error = ''; this.acknowledged = false
      try {
        const ip = await this.readAddress(scope, version)
        if (!this.current(scope, version) || operation !== this.operation) return
        operation.lastRead = ip; operation.actual = ip || operation.actual
        if (operation.receipt && reservationMatches(ip, operation.params)) {
          forgetReservation(scope); this.operation = null
          this.$notification.success({ message: this.$t('label.action.reserve.ip'), description: this.ownerPreview })
          this.$emit('refresh-data'); this.closeAction()
        } else if (ip?.state === 'Reserved' && !reservationMatches(ip, operation.params)) operation.status = 'mismatch'
      } catch (error) { if (this.current(scope, version)) this.error = this.$t('message.public.ip.reserve.read') } finally { if (this.current(scope, version)) this.checking = false }
    },
    endTracking () {
      if (this.pending || this.checking || !this.acknowledged || this.operation?.lastRead?.state !== 'Free') return
      forgetReservation(this.contextKey); this.operation = null; this.acknowledged = false; this.error = ''
    },
    closeAction () {
      if (this.pending && this.operation) return
      const current = this.current(this.contextKey)
      if (current && this.operation) this.$emit('refresh-data')
      this.invalidate()
      if (current) this.$emit('close-action')
    }
  }
}
</script>

<style scoped>
.public-ip-reservation { width: 100%; min-width: 0; }
.reservation-notice { margin-bottom: 16px; }
.reservation-notice .ant-btn, .reservation-notice .ant-checkbox-wrapper { margin-top: 8px; margin-right: 8px; }
</style>
