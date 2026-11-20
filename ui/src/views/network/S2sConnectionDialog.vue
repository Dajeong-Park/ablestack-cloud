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
    class="s2s-connection-dialog"
    size="md"
    form-actions
    focus-guard
    :closable="!busy"
    :keyboard="!busy"
    @cancel="close">
    <template #title>
      {{ $t(currentAction.label) }}
      <a
        v-if="currentAction.docHelp"
        class="s2s-connection-dialog-help"
        :href="documentationUrl($config.docBase, currentAction.docHelp, $i18n.locale)"
        target="_blank"
        rel="noopener"
        :aria-label="$t('label.help')">
        <question-circle-outlined />
      </a>
    </template>
    <a-alert v-if="!allowed" type="warning" show-icon :message="$t('message.s2s.gateway.permission')" />
    <a-alert v-if="statusMessage" type="info" show-icon :message="$t(statusMessage)" :description="jobId || undefined" role="status" />
    <a-alert v-if="phase === 'unknown'" type="warning" show-icon :message="$t('message.vpc.vpn.unknown')" :description="jobId" role="status" />
    <a-alert v-if="error" type="error" show-icon :message="$t('message.vpc.vpn.failed')" :description="error" role="alert" />
    <a-alert v-if="loadError" type="error" show-icon :message="$t(loadError)" role="alert" />
    <a-alert v-if="creating && selectionNotice" type="warning" show-icon :message="$t(selectionNotice)" />
    <a-alert v-if="creating && loaded && !localOptions.length" type="info" show-icon :message="$t('message.s2s.connection.local.empty')" />
    <a-form ref="form" :model="draft" layout="vertical" @keydown.ctrl.enter.prevent="!$event.repeat && submit()">
      <template v-if="creating">
        <a-form-item :label="$t('label.s2svpngatewayid')" name="s2svpngatewayid" :rules="required">
          <a-select
            v-model:value="draft.s2svpngatewayid"
            :aria-label="$t('label.s2svpngatewayid')"
            :options="localOptions"
            :placeholder="$t('label.select')"
            :disabled="fieldsDisabled"
            :loading="loading"
            show-search
            option-filter-prop="label"
            @change="chooseLocal" />
        </a-form-item>
        <a-form-item :label="$t('label.s2scustomergatewayid')" name="s2scustomergatewayid" :rules="required">
          <a-select
            v-model:value="draft.s2scustomergatewayid"
            :aria-label="$t('label.s2scustomergatewayid')"
            aria-describedby="s2s-connection-peer-help"
            :options="peerOptions"
            :placeholder="$t('label.select')"
            :disabled="fieldsDisabled || !candidateSet || selectionLoading"
            :loading="selectionLoading"
            show-search
            option-filter-prop="label"
            option-label-prop="label"
            :dropdown-match-select-width="true"
            @change="peerChanged">
            <template #option="{ label, reason }">
              <div class="s2s-connection-peer-option" :title="label">{{ label }}</div>
              <div v-if="reason" class="s2s-connection-peer-option">{{ reason }}</div>
            </template>
          </a-select>
          <template #extra>
            <p id="s2s-connection-peer-help" class="s2s-connection-peer-help" role="status">{{ peerHelp }}</p>
          </template>
        </a-form-item>
        <a-form-item :label="$t('label.s2s.connection.passive')" name="passive">
          <a-switch v-model:checked="draft.passive" :aria-label="$t('label.s2s.connection.passive')" aria-describedby="s2s-connection-passive-help" :disabled="fieldsDisabled" />
          <template #extra>
            <p id="s2s-connection-passive-help" class="s2s-connection-peer-help">{{ $t('message.s2s.connection.passive.help') }}</p>
          </template>
        </a-form-item>
        <a-button :disabled="busy || !!jobId || !allowed" @click="load">{{ $t('label.refresh') }}</a-button>
      </template>
      <template v-else>
        <p>{{ $t(currentAction.message) }}</p>
        <dl class="vpn-connection-target">
          <dt>{{ $t('label.s2s.connection.local') }}</dt>
          <dd>{{ resource.publicip || '—' }}</dd>
          <dt>{{ $t('label.s2s.connection.peer') }}</dt>
          <dd>{{ resource.gateway || '—' }}</dd>
          <dt>{{ $t(resource.projectid ? 'label.project' : 'label.account') }}</dt>
          <dd>{{ resource.project || resource.projectid || resource.account || '—' }}</dd>
          <dt>{{ $t('label.id') }}</dt>
          <dd>{{ resource.id }}</dd>
        </dl>
      </template>
      <MoldDialogActions :busy="busy">
        <a-button :disabled="busy" @click="close">{{ $t('label.cancel') }}</a-button>
        <a-button
          type="primary"
          :danger="deleting && !jobId"
          :loading="busy"
          :disabled="!allowed || busy || (creating && !jobId && !readyToCreate)"
          @click="submit">
          {{ $t(jobId ? 'label.network.lifecycle.recheck' : 'label.ok') }}
        </a-button>
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
import { documentationUrl } from '@/utils/cniFileImport'
import { createJobTracker } from '@/utils/jobTracker'
import { gatewayRows } from '@/utils/s2sGateway'
import { s2sGatewayAuth, s2sGatewayProject } from '@/utils/s2sGatewaySearch'
import { vpcVpnOwner, vpnJobMatches } from '@/utils/vpcVpn'
import { vpnCandidate, vpnCandidateChanged, vpnCandidateConflict, vpnCandidateLabel, vpnCandidateOwner } from '@/utils/s2sConnection'

const validId = value => typeof value === 'string' && /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(value)
const connectionApis = ['createVpnConnection', 'resetVpnConnection', 'deleteVpnConnection']
const isRejectionCode = value => Number(value) >= 400 && Number(value) < 500 && Number(value) !== 408
const knownRejection = error => isRejectionCode(error?.response?.status) ||
  Object.values(error?.response?.data || {}).some(body => isRejectionCode(body?.errorcode))

export default {
  name: 'S2sConnectionDialog',
  components: { MoldDialog, MoldDialogActions },
  props: {
    resource: { type: Object, default: () => ({}) },
    currentAction: { type: Object, required: true }
  },
  emits: ['refresh-data', 'close-action'],
  data () {
    return {
      draft: { s2scustomergatewayid: undefined, s2svpngatewayid: undefined, passive: false },
      localGateways: [],
      candidateSet: null,
      selectionLoading: false,
      selectionVersion: 0,
      selectionNotice: '',
      loaded: false,
      loading: false,
      loadError: '',
      error: '',
      phase: 'idle',
      jobId: '',
      entryKey: '',
      origin: '',
      closed: false,
      disposed: false,
      tracker: null
    }
  },
  computed: {
    command () { return this.currentAction.api },
    creating () { return this.command === 'createVpnConnection' },
    deleting () { return this.command === 'deleteVpnConnection' },
    required () { return [{ required: true, message: this.$t('label.required') }] },
    project () { return s2sGatewayProject(this.$store.getters) },
    scope () {
      return JSON.stringify([this.$route.fullPath, this.command, this.creating ? null : this.identity(this.resource),
        s2sGatewayAuth(this.$store.getters, this.$store.state?.user?.token)])
    },
    allowed () {
      const getters = this.$store.getters
      const apis = [this.command, 'listVpnConnections', 'queryAsyncJobResult']
      if (this.creating) apis.push('listVpnGateways', 'listVpnCustomerGateways')
      return this.current() && this.$route.meta?.name === 's2svpnconn' && connectionApis.includes(this.command) &&
        !!getters.userInfo?.id && !!this.$store.state?.user?.token && apis.every(api => api in (getters.apis || {})) &&
        (this.creating ? !this.$route.params?.id : validId(this.resource.id) &&
          this.resource.id === this.$route.params?.id && this.inProject(this.resource))
    },
    busy () { return this.loading || ['validating', 'submitting', 'tracking'].includes(this.phase) },
    fieldsDisabled () { return this.busy || !!this.jobId || !this.loaded || !this.allowed },
    selectedLocal () { return this.localGateways.find(row => row.id === this.draft.s2svpngatewayid) },
    peerOptions () {
      if (this.jobId && !this.candidateSet) return this.receiptOption(this.draft.s2scustomergatewayid)
      if (!this.candidateSet) return []
      return this.candidateSet.peers.map(row => {
        const conflict = vpnCandidateConflict(row, this.candidateSet.vpcCidr, this.candidateSet.connections)
        return { value: row.id, label: vpnCandidateLabel(row, false), reason: this.conflictText(conflict), disabled: !!conflict }
      })
    },
    localOptions () {
      if (this.jobId && !this.localGateways.length) return this.receiptOption(this.draft.s2svpngatewayid)
      return this.localGateways.map(row => ({ value: row.id, label: vpnCandidateLabel(row, true) }))
    },
    selectedPeerOption () { return this.peerOptions.find(option => option.value === this.draft.s2scustomergatewayid) },
    readyToCreate () { return this.loaded && !this.selectionLoading && !this.loadError && !!this.selectedLocal && !!this.selectedPeerOption && !this.selectedPeerOption.disabled },
    peerHelp () {
      if (this.jobId) return ''
      if (!this.selectedLocal) return this.$t('message.s2s.connection.peer.choose.local')
      if (this.selectionLoading) return this.$t('label.loading')
      if (this.loadError || !this.candidateSet) return ''
      if (!this.peerOptions.length) return this.$t('message.s2s.connection.peer.empty')
      if (this.selectedPeerOption?.disabled) return this.selectedPeerOption.reason
      if (this.peerOptions.every(option => option.disabled)) return this.$t('message.s2s.connection.peer.blocked')
      if (!this.candidateSet.vpcCidr) return this.$t('message.s2s.connection.vpc.unavailable')
      return ''
    },
    statusMessage () {
      if (this.phase === 'submitting') return 'message.s2s.connection.submitting'
      if (this.phase === 'tracking') return 'message.vpc.vpn.pending'
      return ''
    }
  },
  watch: {
    scope: { flush: 'sync', handler () { this.invalidate(true) } }
  },
  created () {
    this.origin = this.scope
    const user = this.$store.getters.userInfo || {}
    this.entryKey = 's2s-connection-job:' + JSON.stringify([this.command, this.creating ? '' : this.resource.id,
      user.id, user.roleid, user.roletype, user.domainid, this.project])
    this.tracker = createJobTracker({
      interval: 1000,
      maxRetries: 2,
      maxDuration: 120000,
      onState: () => {},
      query: this.queryJob
    })
    eventBus.on('project-switch-start', this.projectChanged)
    if (!this.allowed) return
    this.restoreReceipt()
    if (this.jobId) this.checkJob()
    else if (this.creating) this.load()
  },
  beforeUnmount () {
    this.disposed = true
    eventBus.off('project-switch-start', this.projectChanged)
    this.tracker.clear()
  },
  methods: {
    documentationUrl,
    current () { return !this.closed && !this.disposed && this.origin === this.scope },
    identity (row) {
      return [row.id, row.s2svpngatewayid, row.s2scustomergatewayid, row.projectid, row.account, row.domainid, row.publicip, row.gateway]
    },
    inProject (row) {
      return this.project === '-1' || this.project === '0' && !row.projectid || row.projectid === this.project
    },
    projectChanged () { this.invalidate(true) },
    invalidate (contextChanged = false) {
      if (this.closed) return
      if (contextChanged && this.creating && !this.jobId) this.$message.info(this.$t('message.s2s.connection.context.changed'))
      this.closed = true
      this.tracker.clear()
      this.$emit('close-action')
    },
    close () { if (!this.busy) this.invalidate() },
    invalidateIfStale () {
      if (!this.current()) throw Error('message.vpc.vpn.changed')
    },
    message (error) {
      const body = Object.values(error?.response?.data || {}).find(value => value?.errortext)
      const detail = error?.message?.startsWith('message.') ? this.$t(error.message) : error?.message
      return [body?.errorcode, body?.errortext || detail || this.$t('message.request.failed')].filter(Boolean).join(': ')
    },
    rows (command, field, params) { return gatewayRows(getAPI, command, field, params, () => this.current()) },
    receiptOption (id) { return id ? [{ value: id, label: id }] : [] },
    conflictText (conflict) {
      return conflict ? this.$t('message.s2s.connection.conflict.' + conflict.code, conflict) : ''
    },
    async load () {
      if (!this.allowed || this.busy || this.jobId) return
      const previousLocal = this.selectedLocal
      const previousPeer = this.candidateSet?.peers.find(row => row.id === this.draft.s2scustomergatewayid)
      const params = this.project === '0' ? {} : { projectid: this.project }
      this.selectionVersion++
      this.selectionLoading = false
      this.loading = true
      this.loaded = false
      this.loadError = ''
      this.selectionNotice = ''
      this.candidateSet = null
      try {
        const local = await this.rows('listVpnGateways', 'vpngateway', params)
        if (!this.current()) return
        this.localGateways = local.filter(row => validId(row.id) && validId(row.vpcid) && this.inProject(row) && vpnCandidateOwner(row, row)).map(vpnCandidate)
        this.loaded = true
        if (this.draft.s2svpngatewayid && (!this.selectedLocal || (previousLocal && vpnCandidateChanged(previousLocal, this.selectedLocal)))) {
          this.draft.s2svpngatewayid = undefined
          this.draft.s2scustomergatewayid = undefined
          this.selectionNotice = 'message.s2s.connection.selection.changed'
        } else if (this.selectedLocal) {
          await this.loadCandidates(previousPeer)
        }
      } catch (_) {
        if (this.current()) this.loadError = 'message.s2s.connection.local.failed'
      } finally {
        if (this.current()) this.loading = false
      }
    },
    chooseLocal () {
      this.draft.s2scustomergatewayid = undefined
      this.selectionNotice = ''
      this.error = ''
      return this.loadCandidates()
    },
    peerChanged () { this.selectionNotice = ''; this.error = '' },
    async loadCandidates (previousPeer) {
      const local = this.selectedLocal
      const version = ++this.selectionVersion
      const current = () => this.current() && version === this.selectionVersion && this.draft.s2svpngatewayid === local?.id
      this.candidateSet = null
      this.loadError = ''
      this.selectionLoading = !!local
      if (!local) return
      try {
        const snapshot = await this.readCandidates(local, current)
        if (!current()) return
        this.candidateSet = snapshot
        const selectedPeer = snapshot.peers.find(row => row.id === this.draft.s2scustomergatewayid)
        if (this.draft.s2scustomergatewayid && (!selectedPeer || (previousPeer && vpnCandidateChanged(previousPeer, selectedPeer)))) {
          this.draft.s2scustomergatewayid = undefined
          this.selectionNotice = 'message.s2s.connection.selection.changed'
        }
      } catch (_) {
        if (current()) {
          this.draft.s2scustomergatewayid = undefined
          this.loadError = 'message.s2s.connection.peer.failed'
        }
      } finally {
        if (current()) this.selectionLoading = false
      }
    },
    async readCandidates (local, current) {
      const owner = vpcVpnOwner(local)
      const getters = this.$store.getters
      const canReadHidden = getters.userInfo?.roletype === 'Admin' &&
        getters.apis.listVpnConnections?.params?.some(param => param.name === 'fordisplay')
      const read = (command, field, filter) => gatewayRows(getAPI, command, field, { ...owner, ...filter }, current)
      const vpcScope = { vpcid: local.vpcid }
      const [peers, displayed, hidden, vpcs] = await Promise.all([
        read('listVpnCustomerGateways', 'vpncustomergateway', {}),
        read('listVpnConnections', 'vpnconnection', vpcScope),
        canReadHidden ? read('listVpnConnections', 'vpnconnection', { ...vpcScope, fordisplay: false }) : [],
        'listVPCs' in getters.apis ? read('listVPCs', 'vpc', { id: local.vpcid }) : []
      ])
      const connections = [...displayed, ...hidden]
      if (connections.some(row => row.s2svpngatewayid !== local.id || !vpnCandidateOwner(local, row)) ||
        vpcs.some(row => row.id !== local.vpcid || !vpnCandidateOwner(local, row))) throw Error('message.s2s.connection.peer.failed')
      return {
        peers: peers.filter(row => validId(row.id) && vpnCandidateOwner(local, row)).map(vpnCandidate),
        connections: connections.map(({ s2scustomergatewayid, cidrlist }) => ({ s2scustomergatewayid, cidrlist })),
        vpcCidr: vpcs[0]?.cidr
      }
    },
    async mutationParams () {
      if (this.creating) {
        const { s2svpngatewayid, s2scustomergatewayid, passive } = this.draft
        const before = this.selectedLocal
        const previousPeer = this.candidateSet?.peers.find(row => row.id === s2scustomergatewayid)
        const rows = await this.rows('listVpnGateways', 'vpngateway', { ...vpcVpnOwner(before), id: s2svpngatewayid })
        const local = rows.length === 1 && this.inProject(rows[0]) ? vpnCandidate(rows[0]) : null
        if (vpnCandidateChanged(before, local)) {
          if (local && validId(local.vpcid) && local.id === before.id && vpnCandidateOwner(before, local)) {
            this.localGateways = this.localGateways.map(row => row.id === before.id ? local : row)
          } else {
            this.localGateways = this.localGateways.filter(row => row.id !== before.id)
          }
          this.draft.s2svpngatewayid = undefined
          this.draft.s2scustomergatewayid = undefined
          this.candidateSet = null
          throw Error('message.s2s.connection.selection.changed')
        }
        const current = () => this.current() && this.draft.s2svpngatewayid === s2svpngatewayid &&
          this.draft.s2scustomergatewayid === s2scustomergatewayid && this.draft.passive === passive
        let snapshot
        try {
          snapshot = await this.readCandidates(local, current)
        } catch (_) {
          throw Error('message.s2s.connection.peer.failed')
        }
        if (!current()) throw Error('message.s2s.connection.selection.changed')
        this.candidateSet = snapshot
        const peer = snapshot.peers.find(row => row.id === s2scustomergatewayid)
        if (vpnCandidateChanged(previousPeer, peer)) {
          this.draft.s2scustomergatewayid = undefined
          throw Error('message.s2s.connection.selection.changed')
        }
        const conflict = vpnCandidateConflict(peer, snapshot.vpcCidr, snapshot.connections)
        if (conflict) throw Error(this.conflictText(conflict))
        return { s2svpngatewayid, s2scustomergatewayid, passive }
      }
      const rows = await this.rows('listVpnConnections', 'vpnconnection', { ...vpcVpnOwner(this.resource), id: this.resource.id })
      if (rows.length !== 1 || JSON.stringify(this.identity(rows[0])) !== JSON.stringify(this.identity(this.resource))) {
        throw Error('message.vpc.vpn.changed')
      }
      return { id: this.resource.id }
    },
    persist () {
      // Store identifiers and the passive flag, never API responses or credentials.
      sessionStorage.setItem(this.entryKey, JSON.stringify({ jobId: this.jobId, draft: this.draft }))
    },
    restoreReceipt () {
      try {
        const saved = JSON.parse(sessionStorage.getItem(this.entryKey) || 'null')
        if (!validId(saved?.jobId)) return
        if (this.creating) {
          const { s2svpngatewayid, s2scustomergatewayid, passive } = saved.draft || {}
          if (!validId(s2svpngatewayid) || !validId(s2scustomergatewayid) || typeof passive !== 'boolean') return
          this.draft = { s2svpngatewayid, s2scustomergatewayid, passive }
        }
        this.jobId = saved.jobId
        this.phase = 'unknown'
      } catch (_) {}
    },
    clearReceipt () {
      this.jobId = ''
      try { sessionStorage.removeItem(this.entryKey) } catch (_) {}
    },
    async queryJob (id) {
      const json = await getAPI('queryAsyncJobResult', { jobid: id, ignoreproject: true }, { preserveOnFailure: true, timeout: 15000 })
      const job = json?.queryasyncjobresultresponse
      if (!job?.cmd || !vpnJobMatches(job, id, this.command)) throw Error('message.vpc.vpn.job.scope')
      return job
    },
    async verifyCompletion (result) {
      if (this.deleting) {
        if (![true, 'true'].includes(result?.success)) throw Error('message.vpc.vpn.job.scope')
        const rows = await this.rows('listVpnConnections', 'vpnconnection', { ...vpcVpnOwner(this.resource), id: this.resource.id })
        if (rows.length) throw Error('message.vpc.vpn.changed')
        return
      }
      const row = result?.vpnconnection
      const expected = this.creating ? this.draft : this.resource
      if (!validId(row?.id) || !this.inProject(row) ||
        row.s2svpngatewayid !== expected.s2svpngatewayid || row.s2scustomergatewayid !== expected.s2scustomergatewayid ||
        (!this.creating && (row.id !== expected.id || !vpnCandidateOwner(row, expected)))) throw Error('message.vpc.vpn.job.scope')
      const rows = await this.rows('listVpnConnections', 'vpnconnection', { ...vpcVpnOwner(row), id: row.id })
      if (rows.length !== 1 || JSON.stringify(this.identity(rows[0])) !== JSON.stringify(this.identity(row))) {
        throw Error('message.vpc.vpn.changed')
      }
    },
    async checkJob () {
      if (this.busy || !this.allowed || !this.jobId) return
      this.phase = 'tracking'
      this.error = ''
      const result = await this.tracker.track(this.jobId, {}, true)
      if (!this.current()) return
      if (result.jobstatus === 2) {
        this.error = [result.jobresult?.errorcode || result.jobresultcode, result.jobresult?.errortext || this.$t('message.request.failed')].filter(Boolean).join(': ')
        this.clearReceipt()
        this.phase = 'failed'
        if (this.creating && !this.loaded) this.load()
      } else if (result.jobstatus === 1) {
        try {
          await this.verifyCompletion(result.jobresult)
          if (!this.current()) return
          this.clearReceipt()
          this.closed = true
          this.$message.success(this.$t('message.s2s.connection.completed'))
          if (!this.deleting) this.$emit('refresh-data', { irefresh: true })
          this.$emit('close-action', this.deleting ? { removed: [this.resource.id] } : undefined)
        } catch (_) {
          if (this.current()) this.phase = 'unknown'
        }
      } else {
        this.phase = 'unknown'
      }
    },
    async submit () {
      if (this.busy || !this.allowed) return
      if (this.jobId) return this.checkJob()
      if (this.creating && !this.readyToCreate) return
      this.phase = 'validating'
      this.error = ''
      try {
        if (this.creating) await this.$refs.form.validate()
        this.invalidateIfStale()
        const params = await this.mutationParams()
        this.invalidateIfStale()
        this.jobId = uuid()
        try { this.persist() } catch (_) {
          this.clearReceipt()
          throw Error('message.s2s.connection.receipt.storage')
        }
        this.phase = 'submitting'
        let json
        try {
          json = await postAPI(this.command, { ...params, ignoreproject: true, customjobid: this.jobId },
            { preserveOnFailure: true, timeout: 20000 })
        } catch (error) {
          if (knownRejection(error)) {
            this.clearReceipt()
            throw error
          }
        }
        if (json) {
          const receipt = json[this.command.toLowerCase() + 'response']
          const rejected = json.errorresponse || (receipt?.errorcode ? receipt : null)
          if (rejected && isRejectionCode(rejected.errorcode)) {
            this.clearReceipt()
            throw Error([rejected.errorcode, rejected.errortext].filter(Boolean).join(': '))
          }
          if (validId(receipt?.jobid) && receipt.jobid !== this.jobId) {
            this.jobId = receipt.jobid
            try { this.persist() } catch (_) {}
          }
        }
      } catch (error) {
        if (this.current() && !error?.errorFields) this.error = this.message(error)
      } finally {
        if (this.current()) this.phase = this.jobId ? 'unknown' : 'failed'
      }
      if (this.current() && this.jobId) return this.checkJob()
    }
  }
}
</script>

<style scoped>
.ant-alert { margin-bottom: 16px; }
.s2s-connection-peer-help { color: var(--ui-text-secondary); margin: 4px 0 0; }
.s2s-connection-peer-option { color: var(--ui-text-secondary); white-space: normal; overflow-wrap: anywhere; }
.vpn-connection-target { overflow-wrap: anywhere; }
.vpn-connection-target dt { font-weight: 600; margin-top: 8px; }
.vpn-connection-target dd { margin: 0; }
</style>
