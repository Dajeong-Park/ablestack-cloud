// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements. See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership. The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License. You may obtain a copy of the License at
//
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied. See the License for the
// specific language governing permissions and limitations
// under the License.

<template>
  <MoldDialog
:visible="!closed"
:title="$t(currentAction.label)"
size="md"
form-actions
focus-guard
:closable="!busy"
:keyboard="!busy"
@cancel="close">
    <a-alert v-if="!allowed" type="warning" show-icon :message="$t('message.s2s.gateway.permission')" />
    <a-alert v-if="error" type="error" show-icon :message="error" role="alert" />
    <a-alert v-if="jobId" :type="busy ? 'info' : 'warning'" show-icon :message="$t(confirmed ? 'message.s2s.display.confirmed.readback' : busy ? 'message.vpc.vpn.pending' : 'message.vpc.vpn.unknown')" :description="jobId" role="status" />
    <p v-if="mode !== 'update'">{{ $t(mode === 'create' ? 'message.s2s.gateway.create' : 'message.s2s.gateway.delete') }}</p>
    <a-form ref="form" :model="draft" layout="vertical" @keydown.ctrl.enter.prevent="!$event.repeat && submit()" @finish="submit">
      <template v-if="mode === 'create'">
        <a-form-item :label="$t('label.vpc')" :extra="$t('message.s2s.create.vpc.help')" name="vpcid" :rules="[{ required: true, message: $t('label.required') }]">
          <a-select v-model:value="draft.vpcid" :aria-label="$t('label.vpc')" :loading="loading" :disabled="busy || !!jobId || !allowed" :virtual="false" show-search option-filter-prop="label">
            <a-select-option v-for="vpc in candidates" :key="vpc.id" :value="vpc.id" :label="gatewayCandidateLabel(vpc)" :disabled="!!vpc.reason">
              <div class="s2s-vpc-option"><strong>{{ vpc.name || vpc.id }}</strong><small>{{ vpc.id }}</small><small>{{ vpc.project || vpc.projectid || vpc.account }} · {{ vpc.zonename || vpc.zoneid || '-' }}</small><small v-if="vpc.reason">{{ $t('message.s2s.create.' + vpc.reason) }}</small></div>
            </a-select-option>
          </a-select>
        </a-form-item>
        <a-alert v-if="loaded && candidates.length && !candidates.some(vpc => !vpc.reason) && !loadError" type="info" show-icon :message="$t('message.s2s.create.candidates.unavailable')" />
        <a-spin :spinning="selectionPending">
          <a-alert v-if="selectionError && selectionError !== error" type="error" show-icon :message="selectionError" role="alert" />
          <a-form-item v-if="selection" :label="$t('label.publicip')" :extra="$t('message.s2s.create.ip.' + selection.kind)" name="ipaddressid" :rules="[{ required: true, message: $t('label.required') }]">
            <a-input v-if="selection.fixed" :value="selection.ips[0].ipaddress" :aria-label="$t('label.publicip')" readonly />
            <a-select v-else v-model:value="draft.ipaddressid" :aria-label="$t('label.publicip')" :disabled="busy || !!jobId || !allowed" show-search option-filter-prop="label">
              <a-select-option value="auto" :label="$t('label.s2s.create.ip.auto')">{{ $t('label.s2s.create.ip.auto') }}</a-select-option>
              <a-select-option v-for="ip in selection.ips" :key="ip.id" :value="ip.id" :label="ip.ipaddress + ' · ' + ip.id">{{ ip.ipaddress }} · {{ ip.id }}</a-select-option>
            </a-select>
            <small v-if="draft.ipaddressid !== 'auto'" class="s2s-ip-id">{{ draft.ipaddressid }}</small>
            <p v-if="draft.ipaddressid === 'auto'">{{ $t('message.s2s.create.ip.auto') }}</p>
          </a-form-item>
        </a-spin>
        <a-button :loading="loading || selectionPending" :disabled="busy || !!jobId || !allowed" @click="load">{{ $t('label.refresh') }}</a-button>
        <a-alert v-if="loaded && !candidates.length && !error" type="info" show-icon :message="$t('label.no.data')" />
      </template>
      <template v-if="mode === 'update'">
        <a-button :loading="loading" :disabled="busy || !!jobId || !allowed" @click="loadUpdate">{{ $t('label.refresh') }}</a-button>
        <a-alert v-if="loaded && draft.fordisplay === confirmedDisplay && !jobId" type="info" show-icon :message="$t('message.s2s.display.unchanged')" />
      </template>
      <a-form-item v-if="displayOption" :label="$t('label.s2s.display.option')" :extra="$t('message.s2s.display.scope')" name="fordisplay">
        <a-switch v-model:checked="draft.fordisplay" :aria-label="$t('label.s2s.display.option')" :disabled="busy || !!jobId || !allowed || (mode === 'update' && (!loaded || !!loadError))" />
      </a-form-item>
      <dl v-if="selected" class="s2s-dialog-context">
        <template v-if="mode !== 'create'"><dt>{{ $t('label.vpn.gateway') }}</dt><dd>{{ gatewayName(selected) }}</dd><dt>{{ $t('label.id') }}</dt><dd>{{ selected.id }}</dd></template>
        <dt>{{ $t('label.vpc') }}</dt><dd>{{ selected.name || selected.vpcname || selected.vpcid || selected.id }}</dd>
        <template v-if="mode === 'create'"><dt>{{ $t('label.id') }}</dt><dd>{{ selected.id }}</dd><dt>{{ $t('label.zone') }}</dt><dd>{{ selected.zonename || selected.zoneid || '-' }}</dd></template>
        <dt>{{ $t(selected.projectid ? 'label.project' : 'label.account') }}</dt><dd>{{ selected.project || selected.projectid || selected.account || '-' }}</dd>
        <dt>{{ $t('label.domain') }}</dt><dd>{{ selected.domain || selected.domainid || '-' }}</dd>
        <template v-if="mode === 'update'"><dt>{{ $t('label.s2s.display.current') }}</dt><dd>{{ typeof confirmedDisplay === 'boolean' ? $t(confirmedDisplay ? 'label.s2s.display.visible' : 'label.s2s.display.hidden') : '-' }}</dd></template>
      </dl>
      <MoldDialogActions :busy="busy">
        <a-button :disabled="busy" @click="close">{{ $t('label.cancel') }}</a-button>
        <a-button type="primary" :danger="mode === 'delete'" :loading="busy" :disabled="!allowed || busy || (!jobId && ((mode === 'create' && (!loaded || !!loadError || selectionPending || !selection || !!selectionError)) || (mode === 'update' && (!loaded || !!loadError || typeof draft.fordisplay !== 'boolean' || draft.fordisplay === confirmedDisplay))))" @click="submit">{{ $t(jobId ? 'label.network.lifecycle.recheck' : currentAction.label) }}</a-button>
      </MoldDialogActions>
    </a-form>
  </MoldDialog>
</template>
<script>
import { v4 as uuid } from 'uuid'
import { getAPI, postAPI } from '@/api'
import eventBus from '@/config/eventBus'
import MoldDialog from '@/components/view/MoldDialog'
import MoldDialogActions from '@/components/view/MoldDialogActions'
import { createJobTracker } from '@/utils/jobTracker'
import { gatewayName, gatewayContext, gatewayOwner, gatewaySameOwner, gatewayApis, gatewayRows } from '@/utils/s2sGateway'
import { gatewayCreateApis, gatewayCreateCandidates, gatewayCreateSelection, gatewayCandidateLabel } from '@/utils/s2sGatewayCreate'
import { gatewayDisplayAdmin, gatewayDisplayMatches } from '@/utils/s2sGatewayDisplay'
import { s2sGatewayAuth } from '@/utils/s2sGatewaySearch'
import { vpnJobMatches } from '@/utils/vpcVpn'
export default {
  name: 'S2sGatewayDialog',
  components: { MoldDialog, MoldDialogActions },
  props: { resource: { type: Object, default: () => ({}) }, currentAction: { type: Object, required: true } },
  emits: ['refresh-data', 'close-action'],
  data () { return { draft: { vpcid: '', ipaddressid: '', fordisplay: true }, confirmedDisplay: null, loadedResource: null, confirmed: false, selection: null, selectionPending: false, selectionError: '', selectionVersion: 0, candidates: [], loaded: false, loading: false, loadError: '', error: '', phase: 'idle', jobId: '', target: null, origin: '', entryKey: '', closed: false, disposed: false, tracker: null } },
  computed: {
    mode () { return ({ deleteVpnGateway: 'delete', updateVpnGateway: 'update' })[this.currentAction.api] || 'create' },
    command () { return { create: 'createVpnGateway', update: 'updateVpnGateway', delete: 'deleteVpnGateway' }[this.mode] },
    displayOption () { return this.mode !== 'delete' && gatewayDisplayAdmin(this.$store.getters) && !!this.$getApiParams?.(this.command)?.fordisplay },
    scope () { return JSON.stringify([gatewayContext(this, this.mode === 'create' ? {} : this.resource), this.$route.fullPath, this.command, this.displayOption, !!this.$getApiParams?.('listVpnGateways')?.fordisplay]) },
    busy () { return this.loading || ['validating', 'submitting', 'tracking'].includes(this.phase) },
    selected () { return this.mode !== 'create' ? this.loadedResource || this.resource : this.candidates.find(vpc => vpc.id === this.draft.vpcid) || (this.jobId ? this.target : null) },
    allowed () {
      const project = String(this.$store.getters.project?.id || '0')
      return this.current() && (this.mode !== 'update' || this.displayOption && !!this.$getApiParams?.('listVpnGateways')?.fordisplay) && !!this.$store.getters.userInfo?.id && !!this.$store.state?.user?.token && [...gatewayApis(this.mode), ...(this.mode === 'create' ? gatewayCreateApis : [])].every(api => api in (this.$store.getters.apis || {})) && (!this.$store.getters.listAllProjects || project !== '0') && (this.mode === 'create' || this.resource.id && (project === '0' ? !this.resource.projectid : project === this.resource.projectid))
    }
  },
  watch: { scope: { flush: 'sync', handler () { this.invalidate() } }, 'draft.vpcid': { flush: 'sync', handler () { this.resetSelection(); if (!this.jobId && !this.loading && this.mode === 'create') this.loadSelection() } } },
  created () {
    this.origin = this.scope
    const user = this.$store.getters.userInfo || {}
    this.entryKey = 's2s-gateway-job:' + JSON.stringify([this.command, this.$route.path, this.mode !== 'create' ? this.resource.id : '', user.id, user.roleid, user.roletype, this.$store.getters.project?.id || '0'])
    try {
      const receipt = JSON.parse(sessionStorage.getItem(this.entryKey) || 'null')
      if (receipt?.command === this.command && /^[\da-f-]{36}$/i.test(receipt.jobId) && receipt.target?.vpcid && (this.mode === 'create' || receipt.target.id === this.resource.id) && (this.mode !== 'update' || typeof receipt.target.fordisplay === 'boolean')) {
        this.jobId = receipt.jobId; this.target = receipt.target; this.draft.vpcid = receipt.target.vpcid; this.phase = 'unknown'; this.confirmed = receipt.confirmed === true
      }
    } catch (_) {}
    this.tracker = createJobTracker({
      interval: 1000,
      maxRetries: 2,
      maxDuration: 120000,
      onState: () => {},
      query: async id => {
        const json = await getAPI('queryAsyncJobResult', { jobid: id, ignoreproject: true }, { preserveOnFailure: true, timeout: 15000 })
        const job = json?.queryasyncjobresultresponse
        if (!vpnJobMatches(job, id, this.command) || !job.cmd || ![0, 1, 2].includes(job.jobstatus)) throw Error(this.$t('message.vpc.vpn.job.scope'))
        if (job.jobstatus === 1 && this.mode !== 'delete') {
          const row = job.jobresult?.vpngateway
          if (!row?.id || this.mode === 'update' && row.id !== this.target.id || !gatewayDisplayMatches(row, this.target.fordisplay) || row.vpcid !== this.target?.vpcid || !gatewaySameOwner(row, this.target) || this.target.publicip && row.publicip !== this.target.publicip) throw Error(this.$t('message.vpc.vpn.job.scope'))
        }
        if (job.jobstatus === 1 && this.mode === 'delete' && job.jobresult?.success !== true && job.jobresult?.success !== 'true') throw Error(this.$t('message.vpc.vpn.job.scope'))
        return job
      }
    })
    eventBus.on('project-switch-start', this.invalidate)
    if (this.jobId) this.checkJob()
    else if (this.mode === 'create') this.load()
    else if (this.mode === 'update') this.loadUpdate()
  },
  beforeUnmount () { this.disposed = true; eventBus.off('project-switch-start', this.invalidate); this.tracker && this.tracker.clear() },
  methods: {
    gatewayName,
    gatewayCandidateLabel,
    current () { return !this.closed && !this.disposed && this.origin === this.scope },
    invalidate () { if (this.closed) return; this.closed = true; this.tracker && this.tracker.clear(); this.candidates = []; this.resetSelection(); this.draft.vpcid = ''; this.draft.fordisplay = true; this.confirmedDisplay = null; this.loadedResource = null; this.$emit('close-action') },
    close () { if (!this.busy) { this.closed = true; this.$emit('close-action') } },
    message (error) { const body = Object.values(error?.response?.data || {}).find(value => value?.errortext); return [body?.errorcode, body?.errortext || (error?.message?.startsWith('message.') ? this.$t(error.message) : error?.message) || this.$t('message.request.failed')].filter(Boolean).join(': ') },
    async rows (command, field, params) { return gatewayRows(getAPI, command, field, params, () => this.current()) },
    resetSelection () { this.selectionVersion++; this.selection = null; this.selectionError = ''; this.selectionPending = false; this.draft.ipaddressid = '' },
    async readCreate (command, field, params, version) {
      return gatewayRows(getAPI, command, field, params, () => this.current() && (version === undefined || version === this.selectionVersion))
    },
    async loadSelection () {
      if (!this.current() || this.busy || this.jobId || !this.allowed || !this.draft.vpcid || this.loadError) return
      const selected = this.selected
      if (!selected || selected.reason) { if (selected) this.selectionError = this.$t('message.s2s.create.' + selected.reason); return }
      const version = ++this.selectionVersion
      this.selection = null; this.selectionError = ''; this.selectionPending = true; this.draft.ipaddressid = ''
      try {
        const state = await gatewayCreateSelection((...args) => this.readCreate(...args, version), selected, this.$store.getters.userInfo.roletype === 'Admin')
        if (!this.current() || version !== this.selectionVersion) return
        this.selection = state; this.draft.ipaddressid = state.defaultId
      } catch (error) { if (this.current() && version === this.selectionVersion) this.selectionError = this.message(error) } finally { if (this.current() && version === this.selectionVersion) this.selectionPending = false }
    },
    async load () {
      if (this.busy || !this.allowed || this.jobId) return
      this.resetSelection(); this.loading = true; this.error = ''; this.loadError = ''
      try {
        const rows = await gatewayCreateCandidates((...args) => this.readCreate(...args), this.$store.getters)
        if (!this.current()) return
        this.candidates = rows; this.loaded = true
      } catch (error) { if (this.current()) this.error = this.loadError = this.message(error) } finally { if (this.current()) this.loading = false }
      if (this.current() && !this.loadError) await this.loadSelection()
    },
    async loadUpdate () {
      if (this.busy || !this.allowed || this.jobId) return
      const preserveDraft = this.loaded
      this.loading = true; this.error = ''; this.loadError = ''
      try {
        if (typeof this.resource.fordisplay !== 'boolean') throw Error('message.s2s.display.unverified')
        const rows = await this.rows('listVpnGateways', 'vpngateway', { id: this.resource.id, ...gatewayOwner(this.resource), fordisplay: this.resource.fordisplay })
        if (!this.current()) return
        const row = rows.find(row => row.id === this.resource.id && row.vpcid === this.resource.vpcid && gatewaySameOwner(row, this.resource) && row.publicip === this.resource.publicip && row.fordisplay === this.resource.fordisplay)
        if (!row) throw Error('message.s2s.display.unverified')
        this.loadedResource = row; this.confirmedDisplay = row.fordisplay; this.loaded = true
        if (!preserveDraft) this.draft.fordisplay = row.fordisplay
      } catch (error) { if (this.current()) this.error = this.loadError = this.message(error) } finally { if (this.current()) this.loading = false }
    },
    persist () { sessionStorage.setItem(this.entryKey, JSON.stringify({ command: this.command, jobId: this.jobId, target: this.target, confirmed: this.confirmed })) },
    clearReceipt () { this.jobId = ''; try { sessionStorage.removeItem(this.entryKey) } catch (_) {} },
    async checkJob () {
      if (this.busy || !this.allowed || !this.jobId) return
      this.phase = 'tracking'; this.error = ''
      const result = await this.tracker.track(this.jobId, {}, true)
      if (!this.current()) return
      if (result?.jobstatus === 2) {
        this.phase = 'failed'; this.error = [result.jobresult?.errorcode || result.jobresultcode, result.jobresult?.errortext || this.$t('message.request.failed')].filter(Boolean).join(': '); this.clearReceipt(); return
      }
      if (result?.jobstatus === 1) {
        this.confirmed = true; try { this.persist() } catch (_) {}
        try {
          const rows = await this.rows('listVpnGateways', 'vpngateway', { ...gatewayOwner(this.target), vpcid: this.target.vpcid, ...(this.$store.getters.userInfo.roletype === 'Admin' ? { fordisplay: (this.target.fordisplay ?? (this.mode !== 'delete' || this.resource.fordisplay !== false)) } : {}) })
          if (!this.current()) return
          if (this.mode !== 'delete') {
            const created = result.jobresult.vpngateway
            if (!rows.some(row => row.id === created.id && row.vpcid === this.target.vpcid && gatewaySameOwner(row, this.target) && row.publicip === created.publicip && gatewayDisplayMatches(row, this.target.fordisplay))) throw Error('message.s2s.gateway.context.changed')
          } else if (rows.some(row => row.id === this.target.id)) throw Error('message.s2s.gateway.context.changed')
          this.phase = 'succeeded'; this.clearReceipt(); this.closed = true; const completed = { removed: this.mode === 'delete' ? [this.target.id] : [], ...(this.mode !== 'delete' && typeof this.target.fordisplay === 'boolean' ? { displayChanged: true, id: result.jobresult.vpngateway.id, fordisplay: this.target.fordisplay, target: this.target, auth: s2sGatewayAuth(this.$store.getters, this.$store.state?.user?.token), originPath: this.$route.fullPath } : {}) }; this.$emit('refresh-data', completed); this.$emit('close-action', completed); return
        } catch (error) { if (this.current()) this.error = this.message(error) }
      }
      if (this.current()) { this.phase = 'unknown'; if (!this.error) this.error = this.$t('message.vpc.vpn.unknown') }
    },
    async submit () {
      if (this.busy || !this.allowed) return
      if (this.jobId) return this.checkJob()
      if (this.mode === 'create' && (!this.loaded || this.loadError || this.selectionPending || !this.selection || this.selectionError)) return
      if (this.mode === 'update' && (!this.loaded || this.loadError || typeof this.draft.fordisplay !== 'boolean')) return
      if (this.mode === 'update' && this.draft.fordisplay === this.confirmedDisplay) { this.error = ''; return }
      this.phase = 'validating'; this.error = ''; this.confirmed = false
      try {
        if (this.mode === 'create') await this.$refs.form.validate()
        if (!this.current()) return
        if (this.mode === 'create') {
          const selected = this.selected
          if (!selected) throw Error('message.s2s.gateway.context.changed')
          const state = await gatewayCreateSelection((...args) => this.readCreate(...args), selected, this.$store.getters.userInfo.roletype === 'Admin')
          if (!this.current()) return
          const id = this.draft.ipaddressid
          const ip = state.ips.find(ip => ip.id === id)
          if (state.kind !== this.selection.kind || state.fixed && id !== state.defaultId || id !== 'auto' && !ip || id === 'auto' && state.fixed) throw Error('message.s2s.create.ip.changed')
          this.selection = state
          this.target = { ...(this.displayOption ? { fordisplay: this.draft.fordisplay } : {}), vpcid: state.vpc.id, ...gatewayOwner(state.vpc), ...(ip ? { ipaddressid: ip.id, publicip: ip.ipaddress } : {}) }
        } else if (this.mode === 'update') {
          const rows = await this.rows('listVpnGateways', 'vpngateway', { id: this.resource.id, ...gatewayOwner(this.resource), fordisplay: this.confirmedDisplay })
          if (!this.current()) return
          if (!rows.some(row => row.id === this.resource.id && row.vpcid === this.resource.vpcid && gatewaySameOwner(row, this.resource) && row.publicip === this.resource.publicip && row.fordisplay === this.confirmedDisplay)) throw Error('message.s2s.display.unverified')
          this.target = { id: this.resource.id, vpcid: this.resource.vpcid, publicip: this.resource.publicip, ...gatewayOwner(this.resource), fordisplay: this.draft.fordisplay }
        } else {
          const rows = await this.rows('listVpnGateways', 'vpngateway', { ...gatewayOwner(this.resource), vpcid: this.resource.vpcid, ...(this.$store.getters.userInfo.roletype === 'Admin' ? { fordisplay: this.resource.fordisplay !== false } : {}) })
          if (!this.current()) return
          if (!rows.some(row => row.id === this.resource.id && row.vpcid === this.resource.vpcid && gatewaySameOwner(row, this.resource))) throw Error('message.s2s.gateway.context.changed')
          this.target = { id: this.resource.id, vpcid: this.resource.vpcid, ...gatewayOwner(this.resource) }
        }
        if (!this.current() || !this.allowed) return
        this.jobId = uuid()
        try { this.persist() } catch (_) { this.clearReceipt(); throw Error('message.vpc.vpn.storage') }
        this.phase = 'submitting'
        let json
        try {
          json = await postAPI(this.command, { ...(this.mode === 'create' ? { vpcid: this.target.vpcid, ...(this.target.ipaddressid ? { ipaddressid: this.target.ipaddressid } : {}) } : { id: this.target.id }), ...(typeof this.target.fordisplay === 'boolean' ? { fordisplay: this.target.fordisplay } : {}), ...gatewayOwner(this.target), ignoreproject: true, customjobid: this.jobId }, { preserveOnFailure: true, timeout: 20000 })
        } catch (error) {
          if (!this.current()) return
          if (Object.values(error?.response?.data || {}).some(value => value?.errorcode) || [400, 401, 403, 404].includes(error?.response?.status)) this.clearReceipt()
          throw error
        }
        if (!this.current()) return
        if (json?.errorresponse) { this.clearReceipt(); throw Error(json.errorresponse.errortext) }
        const receipt = json?.[this.command.toLowerCase() + 'response']
        if (receipt?.errorcode) { this.clearReceipt(); throw Error(String(receipt.errorcode) + ': ' + receipt.errortext) }
        if (!receipt?.jobid || !/^[\da-f-]{36}$/i.test(receipt.jobid)) throw Error('message.vpc.vpn.unknown')
        this.jobId = receipt.jobid; this.persist()
      } catch (error) { if (this.current() && !error?.errorFields) { this.error = this.message(error); if (this.mode === 'create' && this.phase === 'validating') this.selectionError = this.error } } finally { if (this.current()) this.phase = this.jobId ? 'unknown' : 'failed' }
      if (this.current() && this.jobId) return this.checkJob()
    }
  }
}
</script>
<style scoped>
.ant-alert { margin-bottom: 16px; }
.s2s-ip-id { display: block; overflow-wrap: anywhere; margin-top: 4px; }
.s2s-vpc-option { display: flex; flex-direction: column; white-space: normal; overflow-wrap: anywhere; }
.s2s-dialog-context { margin: 16px 0 0; overflow-wrap: anywhere; }
.s2s-dialog-context dt { font-weight: 600; margin-top: 8px; }
.s2s-dialog-context dd { margin: 0; }
</style>
