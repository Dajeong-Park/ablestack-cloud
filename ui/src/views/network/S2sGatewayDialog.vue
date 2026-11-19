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
    <a-alert v-if="jobId" :type="busy ? 'info' : 'warning'" show-icon :message="$t(busy ? 'message.vpc.vpn.pending' : 'message.vpc.vpn.unknown')" :description="jobId" role="status" />
    <p>{{ $t(mode === 'create' ? 'message.s2s.gateway.create' : 'message.s2s.gateway.delete') }}</p>
    <a-form ref="form" :model="draft" layout="vertical" @keydown.ctrl.enter.prevent="!$event.repeat && submit()" @finish="submit">
      <template v-if="mode === 'create'">
        <a-form-item :label="$t('label.vpc')" name="vpcid" :rules="[{ required: true, message: $t('label.required') }]">
          <a-select v-model:value="draft.vpcid" :aria-label="$t('label.vpc')" :loading="loading" :disabled="busy || !!jobId || !allowed" show-search option-filter-prop="label">
            <a-select-option v-for="vpc in candidates" :key="vpc.id" :value="vpc.id" :label="vpc.name || vpc.id">{{ vpc.name || vpc.id }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-button :loading="loading" :disabled="busy || !!jobId || !allowed" @click="load">{{ $t('label.refresh') }}</a-button>
        <a-alert v-if="loaded && !candidates.length && !error" type="info" show-icon :message="$t('label.no.data')" />
      </template>
      <dl v-if="selected" class="s2s-dialog-context">
        <template v-if="mode === 'delete'"><dt>{{ $t('label.vpn.gateway') }}</dt><dd>{{ gatewayName(resource) }}</dd><dt>{{ $t('label.id') }}</dt><dd>{{ resource.id }}</dd></template>
        <dt>{{ $t('label.vpc') }}</dt><dd>{{ selected.name || selected.vpcname || selected.vpcid || selected.id }}</dd>
        <dt>{{ $t(selected.projectid ? 'label.project' : 'label.account') }}</dt><dd>{{ selected.project || selected.projectid || selected.account || '-' }}</dd>
        <dt>{{ $t('label.domain') }}</dt><dd>{{ selected.domain || selected.domainid || '-' }}</dd>
      </dl>
      <MoldDialogActions :busy="busy">
        <a-button :disabled="busy" @click="close">{{ $t('label.cancel') }}</a-button>
        <a-button type="primary" :danger="mode === 'delete'" :loading="busy" :disabled="!allowed || busy || (!jobId && (mode === 'create' && (!loaded || !!loadError)))" @click="submit">{{ $t(jobId ? 'label.network.lifecycle.recheck' : currentAction.label) }}</a-button>
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
import { vpnJobMatches } from '@/utils/vpcVpn'
export default {
  name: 'S2sGatewayDialog',
  components: { MoldDialog, MoldDialogActions },
  props: { resource: { type: Object, default: () => ({}) }, currentAction: { type: Object, required: true } },
  emits: ['refresh-data', 'close-action'],
  data () { return { draft: { vpcid: '' }, candidates: [], loaded: false, loading: false, loadError: '', error: '', phase: 'idle', jobId: '', target: null, origin: '', entryKey: '', closed: false, disposed: false, tracker: null } },
  computed: {
    mode () { return this.currentAction.api === 'deleteVpnGateway' ? 'delete' : 'create' },
    command () { return this.mode === 'delete' ? 'deleteVpnGateway' : 'createVpnGateway' },
    scope () { return JSON.stringify([gatewayContext(this, this.mode === 'create' ? {} : this.resource), this.$route.fullPath, this.command]) },
    busy () { return this.loading || ['validating', 'submitting', 'tracking'].includes(this.phase) },
    selected () { return this.mode === 'delete' ? this.resource : this.candidates.find(vpc => vpc.id === this.draft.vpcid) || (this.jobId ? this.target : null) },
    allowed () {
      const project = String(this.$store.getters.project?.id || '0')
      return this.current() && !!this.$store.getters.userInfo?.id && !!this.$store.state?.user?.token && gatewayApis(this.mode).every(api => api in (this.$store.getters.apis || {})) && (!this.$store.getters.listAllProjects || project !== '0') && (this.mode === 'create' || this.resource.id && (project === '0' ? !this.resource.projectid : project === this.resource.projectid))
    }
  },
  watch: { scope: { flush: 'sync', handler () { this.invalidate() } } },
  created () {
    this.origin = this.scope
    const user = this.$store.getters.userInfo || {}
    this.entryKey = 's2s-gateway-job:' + JSON.stringify([this.command, this.$route.path, this.mode === 'delete' ? this.resource.id : '', user.id, user.roleid, user.roletype, this.$store.getters.project?.id || '0'])
    try {
      const receipt = JSON.parse(sessionStorage.getItem(this.entryKey) || 'null')
      if (receipt?.command === this.command && /^[\da-f-]{36}$/i.test(receipt.jobId) && receipt.target?.vpcid && (this.mode !== 'delete' || receipt.target.id === this.resource.id)) {
        this.jobId = receipt.jobId; this.target = receipt.target; this.draft.vpcid = receipt.target.vpcid; this.phase = 'unknown'
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
        if (job.jobstatus === 1 && this.mode === 'create') {
          const row = job.jobresult?.vpngateway
          if (!row?.id || row.vpcid !== this.target?.vpcid || !gatewaySameOwner(row, this.target)) throw Error(this.$t('message.vpc.vpn.job.scope'))
        }
        if (job.jobstatus === 1 && this.mode === 'delete' && job.jobresult?.success !== true && job.jobresult?.success !== 'true') throw Error(this.$t('message.vpc.vpn.job.scope'))
        return job
      }
    })
    eventBus.on('project-switch-start', this.invalidate)
    if (this.jobId) this.checkJob()
    else if (this.mode === 'create') this.load()
  },
  beforeUnmount () { this.disposed = true; eventBus.off('project-switch-start', this.invalidate); this.tracker && this.tracker.clear() },
  methods: {
    gatewayName,
    current () { return !this.closed && !this.disposed && this.origin === this.scope },
    invalidate () { if (this.closed) return; this.closed = true; this.tracker && this.tracker.clear(); this.candidates = []; this.draft.vpcid = ''; this.$emit('close-action') },
    close () { if (!this.busy) { this.closed = true; this.$emit('close-action') } },
    message (error) { const body = Object.values(error?.response?.data || {}).find(value => value?.errortext); return [body?.errorcode, body?.errortext || (error?.message?.startsWith('message.') ? this.$t(error.message) : error?.message) || this.$t('message.request.failed')].filter(Boolean).join(': ') },
    async rows (command, field, params) { return gatewayRows(getAPI, command, field, params, () => this.current()) },
    async load () {
      if (this.busy || !this.allowed || this.jobId) return
      this.loading = true; this.error = ''; this.loadError = ''
      try {
        const project = this.$store.getters.project?.id
        const rows = await this.rows('listVPCs', 'vpc', project && String(project) !== '0' ? { projectid: project } : {})
        if (!this.current()) return
        if (rows.some(row => project && String(project) !== '0' ? row.projectid !== project : !!row.projectid)) throw Error('message.s2s.gateway.context.changed')
        this.candidates = rows; this.loaded = true
      } catch (error) { if (this.current()) this.error = this.loadError = this.message(error) } finally { if (this.current()) this.loading = false }
    },
    persist () { sessionStorage.setItem(this.entryKey, JSON.stringify({ command: this.command, jobId: this.jobId, target: this.target })) },
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
        try {
          const rows = await this.rows('listVpnGateways', 'vpngateway', { ...gatewayOwner(this.target), vpcid: this.target.vpcid, ...(this.$store.getters.userInfo.roletype === 'Admin' ? { fordisplay: (this.mode !== 'delete' || this.resource.fordisplay !== false) } : {}) })
          if (!this.current()) return
          if (this.mode === 'create') {
            const created = result.jobresult.vpngateway
            if (!rows.some(row => row.id === created.id && row.vpcid === this.target.vpcid && gatewaySameOwner(row, this.target) && row.publicip === created.publicip)) throw Error('message.s2s.gateway.context.changed')
          } else if (rows.some(row => row.id === this.target.id)) throw Error('message.s2s.gateway.context.changed')
          this.phase = 'succeeded'; this.clearReceipt(); this.closed = true; const completed = { removed: this.mode === 'delete' ? [this.target.id] : [] }; this.$emit('refresh-data', completed); this.$emit('close-action', completed); return
        } catch (error) { if (this.current()) this.error = this.message(error) }
      }
      if (this.current()) { this.phase = 'unknown'; if (!this.error) this.error = this.$t('message.vpc.vpn.unknown') }
    },
    async submit () {
      if (this.busy || !this.allowed) return
      if (this.jobId) return this.checkJob()
      if (this.mode === 'create' && (!this.loaded || this.loadError)) return
      this.phase = 'validating'; this.error = ''
      try {
        if (this.mode === 'create') await this.$refs.form.validate()
        if (!this.current()) return
        if (this.mode === 'create') {
          const selected = this.selected
          if (!selected) throw Error('message.s2s.gateway.context.changed')
          const rows = await this.rows('listVPCs', 'vpc', { ...gatewayOwner(selected), id: selected.id })
          if (!this.current()) return
          const vpc = rows.find(row => row.id === selected.id && gatewaySameOwner(row, selected))
          if (!vpc || vpc.state !== 'Enabled') throw Error('message.s2s.gateway.context.changed')
          this.target = { vpcid: vpc.id, ...gatewayOwner(vpc) }
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
          json = await postAPI(this.command, { ...(this.mode === 'create' ? { vpcid: this.target.vpcid } : { id: this.target.id }), ...gatewayOwner(this.target), ignoreproject: true, customjobid: this.jobId }, { preserveOnFailure: true, timeout: 20000 })
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
      } catch (error) { if (this.current() && !error?.errorFields) this.error = this.message(error) } finally { if (this.current()) this.phase = this.jobId ? 'unknown' : 'failed' }
      if (this.current() && this.jobId) return this.checkJob()
    }
  }
}
</script>
<style scoped>
.ant-alert { margin-bottom: 16px; }
.s2s-dialog-context { margin: 16px 0 0; overflow-wrap: anywhere; }
.s2s-dialog-context dt { font-weight: 600; margin-top: 8px; }
.s2s-dialog-context dd { margin: 0; }
</style>
