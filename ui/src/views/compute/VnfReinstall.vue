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
  <section class="vnf-reinstall" v-ctrl-enter="submit">
    <p><strong>{{ vmDisplayName(resource) }}</strong> <small>{{ resource.id }}</small></p>
    <a-alert type="warning" show-icon :message="$t('message.vnf.reinstall.warning')" />
    <p v-if="vm && ['Running', 'Stopped'].includes(vm.state)">{{ $t(vm.state === 'Running' ? 'message.vnf.reinstall.running' : 'message.vnf.reinstall.stopped') }}</p>
    <p>{{ $t('message.vnf.reinstall.preservation') }}</p>
    <a-alert v-if="error" class="vnf-reinstall-error" type="error" show-icon :message="error" />
    <a-alert v-if="succeeded" type="success" show-icon :message="$t('message.vnf.reinstall.success')" />
    <a-spin :spinning="working">
      <template v-if="!succeeded">
        <a-form v-if="!operation" layout="vertical">
          <a-form-item :label="$t('label.vnf.reinstall.mode')">
            <a-radio-group v-model:value="mode" :disabled="locked" @change="acknowledged = false">
              <a-radio value="original">{{ $t('label.vnf.reinstall.original') }}</a-radio>
              <a-radio value="other">{{ $t('label.vnf.reinstall.other') }}</a-radio>
            </a-radio-group>
          </a-form-item>
          <p v-if="mode === 'original'">{{ $t('message.vnf.reinstall.original') }} <span>{{ originalTemplate?.name || vm?.templatename || resource.templatename }}</span></p>
          <template v-else>
            <a-input-search v-model:value="keyword" :placeholder="$t('label.vnf.reinstall.search')" :disabled="locked" enter-button @search="page = 1; fetchCandidates()" />
            <a-alert v-if="candidateError" type="error" :message="$t('message.vnf.reinstall.template.lookup.failed')" />
            <a-radio-group v-model:value="selectedId" class="vnf-reinstall-candidates" :disabled="locked || searching" @change="acknowledged = false">
              <div v-for="template in candidates" :key="template.id" class="vnf-reinstall-candidate">
                <a-radio :value="template.id" :disabled="!!templateReason(template)">{{ template.name }} <small>{{ template.id }}</small></a-radio>
                <p v-if="templateReason(template)" class="vnf-reinstall-reason">{{ $t(templateReason(template)) }}</p>
              </div>
            </a-radio-group>
            <p v-if="!searching && !candidates.length">{{ $t('message.vnf.reinstall.candidates.empty') }}</p>
            <a-pagination v-if="candidateCount > 20" v-model:current="page" :page-size="20" :total="candidateCount" :disabled="locked || searching" @change="fetchCandidates()" />
          </template>
          <a-alert v-if="selectionReason" type="info" show-icon :message="$t(selectionReason)" />
          <p v-else-if="ready">{{ $t('message.vnf.reinstall.nic.compatible') }}</p>
          <div v-if="vm" class="vnf-reinstall-nics" tabindex="0" role="region" :aria-label="$t('label.vnf.reinstall.nics')">
            <table><caption>{{ $t('label.vnf.reinstall.nics') }}</caption><thead><tr><th>deviceid</th><th>NIC UUID / {{ $t('label.network') }}</th><th>IP / MAC / {{ $t('label.default') }}</th></tr></thead>
              <tbody><tr v-for="nic in vm.nic" :key="nic.id"><td>{{ nic.deviceid }}</td><td>{{ nic.id }}<br />{{ nic.networkname || nic.networkid }}</td><td>{{ nic.ipaddress || nic.ip6address || '—' }}<br />{{ nic.macaddress }}<br />{{ nic.isdefault ? $t('label.yes') : $t('label.no') }}</td></tr></tbody>
            </table>
          </div>
          <a-checkbox v-model:checked="acknowledged" :disabled="locked || !ready || !!selectionReason">{{ $t('message.vnf.reinstall.acknowledge') }}</a-checkbox>
        </a-form>
      </template>
      <template v-else>
        <vnf-access-notice :resource="resultVm" />
        <vnf-credentials v-if="credentialRows.length" :rows="credentialRows" :translate="$t" @close="clearCredentials" />
      </template>
    </a-spin>
    <p v-if="operation" role="status">{{ $t(operation.phase === 'unknown' ? 'message.vnf.reinstall.unknown' : 'message.vnf.reinstall.pending') }} <span v-if="operation.jobid">{{ operation.jobid }}</span></p>
    <mold-dialog-actions :busy="working || posting">
      <a-button @click="close">{{ $t(operation || succeeded ? 'label.close' : 'label.cancel') }}</a-button>
      <a-button v-if="!succeeded" :loading="working || querying" :disabled="posting || (operation?.phase === 'checking')" @click="recheck">{{ $t(operation ? 'label.vnf.reinstall.track' : 'label.vnf.reinstall.recheck') }}</a-button>
      <a-button v-if="!succeeded" type="primary" :loading="posting" :disabled="!canSubmit" @click="submit">{{ $t('label.vnf.app.action.reinstall') }}</a-button>
    </mold-dialog-actions>
  </section>
</template>
<script>
import { getAPI, postAPI } from '@/api'
import MoldDialogActions from '@/components/view/MoldDialogActions'
import VnfAccessNotice from '@/components/compute/VnfAccessNotice'
import VnfCredentials from '@/components/compute/VnfCredentials'
import { vmDisplayName } from '@/utils/vmIdentity'
import { vnfNoticeScope, vnfCredentialRows } from '@/utils/vnfAccess'
import { vnfReinstallJobs, vnfReinstallReason, vnfReinstallTemplateReason, vnfNicIdentity, readVnfReinstallTarget, readVnfReinstallTemplates, readVnfReinstallRoot, readVnfReinstallJobs, vnfReinstallPayload } from '@/utils/vnfReinstall'

export default {
  name: 'VnfReinstall',
  components: { MoldDialogActions, VnfAccessNotice, VnfCredentials },
  props: { resource: { type: Object, required: true }, action: { type: Object, default: () => ({}) } },
  inject: { resourceActionReady: { default: () => () => true } },
  data () {
    return {
      target: { id: this.resource.id, projectid: this.resource.projectid, account: this.resource.account, domainid: this.resource.domainid },
      origin: '',
      closed: false,
      generation: 0,
      searchGeneration: 0,
      vm: null,
      originalTemplate: null,
      candidates: [],
      candidateCount: 0,
      candidateError: false,
      mode: 'original',
      selectedId: '',
      keyword: '',
      page: 1,
      acknowledged: false,
      ready: false,
      working: false,
      searching: false,
      posting: false,
      querying: false,
      error: '',
      operation: null,
      succeeded: false,
      resultVm: {},
      credentialRows: []
    }
  },
  computed: {
    context () { return JSON.stringify([this.resource.id, this.resource.projectid, this.$route?.fullPath, vnfNoticeScope(this.$store)]) },
    selectedTemplate () { return this.mode === 'original' ? this.originalTemplate : this.candidates.find(t => t.id === this.selectedId) },
    selectionReason () { return this.ready ? this.templateReason(this.selectedTemplate) : 'message.vnf.reinstall.vm.unavailable' },
    locked () { return this.closed || this.working || this.posting || !!this.operation },
    canSubmit () { return !this.locked && !this.searching && this.ready && this.acknowledged && !this.selectionReason && !vnfReinstallReason(this.vm, this.$store.getters.apis) }
  },
  watch: { context: { flush: 'sync', handler () { this.invalidate(); this.error = this.$t('message.vnf.reinstall.context') } } },
  created () { this.origin = this.context; this.load() },
  deactivated () { this.invalidate() },
  beforeUnmount () { this.invalidate() },
  methods: {
    vmDisplayName,
    current () { return !this.closed && this.origin === this.context && this.action.currentAction?.vnfReinstallCurrent?.() !== false },
    invalidate () { this.closed = true; this.generation++; this.searchGeneration++; clearTimeout(this.jobTimer); this.clearCredentials() },
    clearCredentials () { clearTimeout(this.credentialTimer); this.credentialRows = [] },
    close () { this.invalidate(); this.$emit('close-action') },
    templateReason (template) { return vnfReinstallTemplateReason(template, this.vm || this.resource) },
    errorText (error, fallback) { return error?.message?.startsWith('message.vnf.reinstall.') ? this.$t(error.message) : (error?.response?.data?.errorresponse?.errortext || error?.response?.data?.restorevmresponse?.errortext || this.$t(fallback)) },
    async load () {
      if (!this.current() || this.working || this.posting) return
      const generation = ++this.generation
      this.working = true; this.ready = false; this.error = ''
      try {
        const vm = await readVnfReinstallTarget(this.target)
        const reason = vnfReinstallReason(vm, this.$store.getters.apis)
        const pending = vnfReinstallJobs.get(vm.id)
        if (pending && (!reason || reason === 'message.vnf.reinstall.vm.busy')) {
          if (!this.current() || generation !== this.generation) return
          this.vm = vm; this.operation = pending; this.mode = pending.mode || 'original'; this.selectedId = pending.templateid || ''
          if (pending.jobid) this.queryResult()
          return
        }
        if (reason) throw new Error(reason)
        await readVnfReinstallRoot(vm)
        let original
        try { original = (await readVnfReinstallTemplates(vm, { id: vm.templateid })).rows.find(t => t.id === vm.templateid) } catch (_) {}
        if (!this.current() || generation !== this.generation) return
        this.vm = vm; this.originalTemplate = original; this.ready = true
        await this.fetchCandidates()
        if (!this.current() || generation !== this.generation) return
        this.operation = vnfReinstallJobs.get(vm.id) || null
        if (this.operation?.jobid) this.queryResult()
      } catch (error) {
        if (this.current() && generation === this.generation) this.error = this.errorText(error, 'message.vnf.reinstall.lookup.failed')
      } finally { if (generation === this.generation) this.working = false }
    },
    async fetchCandidates () {
      if (!this.vm || !this.current()) return
      const generation = ++this.searchGeneration
      this.searching = true; this.candidateError = false
      try {
        const result = await readVnfReinstallTemplates(this.vm, { isready: true, page: this.page, pagesize: 20, ...(this.keyword.trim() ? { keyword: this.keyword.trim() } : {}) })
        if (!this.current() || generation !== this.searchGeneration) return
        this.candidates = result.rows.filter(t => t.templatetype === 'VNF' && t.format !== 'ISO' && t.zoneid === this.vm.zoneid && t.arch === this.vm.arch && t.hypervisor?.toLowerCase() === this.vm.hypervisor.toLowerCase() && [true, 'true'].includes(t.isready))
        this.candidateCount = result.count
      } catch (_) { if (this.current() && generation === this.searchGeneration) { this.candidateError = true; this.candidates = []; this.candidateCount = 0 } } finally { if (generation === this.searchGeneration) this.searching = false }
    },
    async submit () {
      if (!this.current() || !this.canSubmit || this.resourceActionReady?.() === false || vnfReinstallJobs.has(this.target.id)) return
      const mode = this.mode; const templateid = this.selectedTemplate.id; const generation = this.generation
      const operation = { phase: 'checking' }
      vnfReinstallJobs.set(this.target.id, operation); this.operation = operation; this.working = true; this.error = ''
      try {
        const vm = await readVnfReinstallTarget(this.target)
        const reason = vnfReinstallReason(vm, this.$store.getters.apis)
        if (reason) throw new Error(reason)
        if (vm.templateid !== this.vm.templateid || vm.state !== this.vm.state || vnfNicIdentity(vm) !== vnfNicIdentity(this.vm)) throw new Error('message.vnf.reinstall.changed')
        const [templates, , jobs] = await Promise.all([readVnfReinstallTemplates(vm, { id: templateid }), readVnfReinstallRoot(vm), readVnfReinstallJobs(vm)])
        const template = templates.rows.find(t => t.id === templateid)
        const params = vnfReinstallPayload(vm, template, mode)
        if (jobs.jobs.some(j => Number(j.jobstatus) === 0)) throw new Error('message.vnf.reinstall.vm.busy')
        if (!this.current() || generation !== this.generation || this.resourceActionReady?.() === false) return
        Object.assign(operation, { phase: 'sending', mode, templateid, nicIdentity: vnfNicIdentity(vm), allowPasswords: template.passwordenabled === true, beforeJobs: jobs.jobs.map(j => j.jobid || j.id), beforeJobsComplete: jobs.complete })
        this.posting = true
        const response = await postAPI('restoreVirtualMachine', params, { preserveOnFailure: true, timeout: 30000 })
        const jobid = response?.restorevmresponse?.jobid
        if (!jobid) { operation.phase = 'unknown'; throw new Error('message.vnf.reinstall.unknown') }
        operation.phase = 'accepted'; operation.jobid = jobid
        if (this.current()) { this.operation = { ...operation }; this.queryResult() }
      } catch (error) {
        if (operation.phase === 'checking' || (operation.phase === 'sending' && error?.response?.data && Object.values(error.response.data).some(r => r?.errorcode))) vnfReinstallJobs.delete(this.target.id)
        else if (!operation.jobid) operation.phase = 'unknown'
        if (this.current()) { this.operation = vnfReinstallJobs.get(this.target.id) || null; this.error = this.errorText(error, operation.phase === 'unknown' ? 'message.vnf.reinstall.unknown' : 'message.vnf.reinstall.request.failed') }
      } finally {
        if (operation.phase === 'checking') vnfReinstallJobs.delete(this.target.id)
        if (this.current() && generation === this.generation) { this.operation = vnfReinstallJobs.get(this.target.id) || null; this.working = false; this.posting = false }
      }
    },
    async queryResult () {
      const operation = vnfReinstallJobs.get(this.target.id)
      if (!this.current() || !operation?.jobid || this.querying) return
      clearTimeout(this.jobTimer); this.querying = true; this.error = ''
      try {
        const json = await getAPI('queryAsyncJobResult', { jobid: operation.jobid }, { preserveOnFailure: true, backgroundJob: true, timeout: 15000 })
        if (!this.current() || vnfReinstallJobs.get(this.target.id) !== operation) return
        const result = json?.queryasyncjobresultresponse
        if (Number(result?.jobstatus) === 0) { this.jobTimer = setTimeout(() => this.queryResult(), 2000); return }
        if (Number(result?.jobstatus) === 2) {
          vnfReinstallJobs.delete(this.target.id); this.operation = null
          this.error = result.jobresult?.errortext || this.$t('message.vnf.reinstall.job.failed'); this.$emit('refresh-data'); return
        }
        const vm = result?.jobresult?.virtualmachine
        if (Number(result?.jobstatus) !== 1 || vm?.id !== this.target.id || vm.templateid !== operation.templateid || vm.templatetype !== 'VNF' || vnfNicIdentity(vm) !== operation.nicIdentity) throw new Error('message.vnf.reinstall.result.unknown')
        vnfReinstallJobs.delete(this.target.id); this.operation = null; this.succeeded = true
        this.credentialRows = vnfCredentialRows(vm, operation.allowPasswords && vm.passwordenabled !== false)
        this.credentialTimer = setTimeout(() => this.clearCredentials(), 10000)
        const accessKeys = ['access_methods', 'ssh_port', 'http_port', 'http_path', 'https_port', 'https_path']
        this.resultVm = { id: vm.id, state: vm.state, templatetype: vm.templatetype, nic: vm.nic, vnfnics: vm.vnfnics, vnfdetails: Object.fromEntries(accessKeys.filter(k => k in (vm.vnfdetails || {})).map(k => [k, vm.vnfdetails[k]])) }
        this.$emit('refresh-data')
      } catch (error) { if (this.current()) this.error = this.errorText(error, 'message.vnf.reinstall.job.lookup.failed') } finally { this.querying = false }
    },
    async recheck () {
      if (!this.current() || this.working || this.posting) return
      const operation = vnfReinstallJobs.get(this.target.id)
      if (!operation) { this.acknowledged = false; return this.load() }
      if (operation.jobid) return this.queryResult()
      this.working = true
      try {
        const vm = await readVnfReinstallTarget(this.target)
        const result = await readVnfReinstallJobs(vm)
        if (!this.current()) return
        const found = result.jobs.filter(j => !operation.beforeJobs?.includes(j.jobid || j.id) && /RestoreVMCmd|restoreVirtualMachine/i.test(j.cmd || ''))
        if (!operation.beforeJobsComplete || !result.complete || found.length !== 1) throw new Error('message.vnf.reinstall.unknown')
        operation.jobid = found[0].jobid || found[0].id; operation.phase = 'accepted'; this.operation = { ...operation }; this.queryResult()
      } catch (error) { if (this.current()) this.error = this.errorText(error, 'message.vnf.reinstall.unknown') } finally { this.working = false }
    }
  }
}
</script>
<style scoped>
.vnf-reinstall { min-width: 0; overflow-wrap: anywhere; }
.vnf-reinstall > p, .vnf-reinstall .ant-alert { margin-bottom: 12px; }
.vnf-reinstall-candidates { display: block; margin: 12px 0; }
.vnf-reinstall-candidate { margin: 10px 0; }
.vnf-reinstall small { display: block; color: var(--ui-text-secondary); }
.vnf-reinstall-reason { margin: 4px 0 0 24px; color: var(--ui-text-secondary); }
.vnf-reinstall-nics { max-width: 100%; overflow-x: auto; margin: 12px 0; }
.vnf-reinstall table { width: 100%; border-collapse: collapse; }
.vnf-reinstall th, .vnf-reinstall td { text-align: left; vertical-align: top; padding: 6px; border-bottom: 1px solid var(--ui-border-color); }
</style>
