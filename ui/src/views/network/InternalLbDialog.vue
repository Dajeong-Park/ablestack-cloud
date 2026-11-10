<!--
Licensed to the Apache Software Foundation (ASF) under one
or more contributor license agreements. See the NOTICE file
distributed with this work for additional information
regarding copyright ownership. The ASF licenses this file
to you under the Apache License, Version 2.0 (the
"License"); you may not use this file except in compliance
with the License. You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing,
software distributed under the License is distributed on an
"AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, either express or implied. See the License for the
specific language governing permissions and limitations
under the License.
-->
<template>
  <MoldDialog :visible="!closed" :title="$t(mode === 'create' ? 'label.add.internal.lb' : 'label.assign.vms')" :size="mode === 'create' ? 'md' : 'lg'" focus-guard :closable="!busy" :keyboard="!busy" @cancel="close">
    <div class="internal-lb-target"><strong>{{ mode === 'create' ? resource.name : resource.name + ' · ' + resource.sourceipaddress }}</strong><span>{{ network.name || tierId || resource.networkid }} · {{ network.cidr || '—' }}</span><span>{{ $t(resource.projectid ? 'label.project' : 'label.account') }}: {{ resource.project || resource.account || '—' }}</span></div>
    <a-alert v-if="error && !jobId" type="error" show-icon :message="$t('message.internal.lb.failed')" :description="error" role="alert" />
    <a-alert v-if="jobId" :type="busy ? 'info' : 'warning'" show-icon :message="$t(busy ? 'message.internal.lb.pending' : 'message.internal.lb.unknown')" :description="jobId" role="status" />
    <a-button class="internal-lb-reload" :loading="loading" :disabled="busy || !!jobId || !allowed" @click="load"><template #icon><reload-outlined /></template>{{ $t('label.internal.lb.reload') }}</a-button>
    <a-spin :spinning="loading">
      <a-form
ref="formRef"
class="internal-lb-form"
layout="vertical"
:model="draft"
:rules="rules"
tabindex="-1"
@keydown.ctrl.enter.prevent="submit"
@finish="submit">
        <template v-if="mode === 'create'">
          <a-form-item :label="$t('label.name')" name="name"><a-input v-model:value="draft.name" :disabled="fieldsDisabled" :aria-label="$t('label.name')" /></a-form-item>
          <a-form-item :label="$t('label.description')" name="description"><a-textarea v-model:value="draft.description" :disabled="fieldsDisabled" :aria-label="$t('label.description')" :auto-size="{ minRows: 2, maxRows: 4 }" /></a-form-item>
          <a-form-item :label="$t('label.sourceipaddress')" name="sourceIP" :extra="$t('message.internal.lb.source')"><a-input v-model:value="draft.sourceIP" :disabled="fieldsDisabled" :aria-label="$t('label.sourceipaddress')" /></a-form-item>
          <a-form-item :label="$t('label.sourceport')" name="sourcePort"><a-input-number v-model:value="draft.sourcePort" :min="1" :max="65535" :precision="0" :disabled="fieldsDisabled" :aria-label="$t('label.sourceport')" /></a-form-item>
          <a-form-item :label="$t('label.instanceport')" name="instancePort"><a-input-number v-model:value="draft.instancePort" :min="1" :max="65535" :precision="0" :disabled="fieldsDisabled" :aria-label="$t('label.instanceport')" /></a-form-item>
          <a-form-item :label="$t('label.algorithm')" name="algorithm"><a-select v-model:value="draft.algorithm" :disabled="fieldsDisabled" :aria-label="$t('label.algorithm')"><a-select-option v-for="algorithm in ['source', 'roundrobin', 'leastconn']" :key="algorithm" :value="algorithm">{{ algorithm }}</a-select-option></a-select></a-form-item>
        </template>
        <template v-else>
          <a-input-search v-model:value="search" class="internal-lb-search" :placeholder="$t('label.search')" :aria-label="$t('label.search')" :disabled="fieldsDisabled" @change="page = 1" />
          <a-table class="internal-lb-vms" :columns="columns" :data-source="filteredVms" row-key="id" :scroll="{ x: 760 }" :pagination="{ current: page, pageSize: 5, total: filteredVms.length, showSizeChanger: false, onChange: value => page = value }">
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'name'"><strong>{{ record.displayname || record.name }}</strong><div class="internal-lb-instance">{{ record.name }}</div></template>
              <template v-else-if="column.key === 'ip'"><a-select v-if="selected[record.id]" v-model:value="selected[record.id]" mode="multiple" :options="options(record).map(ip => ({ value: ip, label: ip }))" :disabled="fieldsDisabled" :aria-label="record.name + ' ' + $t('label.ipaddress')" /><span v-else>{{ options(record).join(', ') || '—' }}</span></template>
              <template v-else-if="column.key === 'select'"><a-checkbox :checked="!!selected[record.id]" :disabled="fieldsDisabled || !options(record).length" :aria-label="record.name + ' ' + $t('label.select')" @change="selectVm(record, $event.target.checked)" /></template>
            </template>
          </a-table>
          <p role="status">{{ $t('label.internal.lb.selected') }}: {{ Object.keys(selected).length }}</p>
        </template>
      </a-form>
    </a-spin>
    <template #footer>
      <a-button :disabled="busy" @click="close">{{ $t('label.cancel') }}</a-button>
      <a-button type="primary" :loading="busy" :disabled="busy || !allowed || (!jobId && (!loaded || !!loadError || (mode === 'assign' && !Object.keys(selected).length)))" @click="submit">{{ $t(jobId ? 'label.network.lifecycle.recheck' : 'label.ok') }}</a-button>
    </template>
  </MoldDialog>
</template>
<script>
import { v4 as uuid } from 'uuid'
import { getAPI, postAPI } from '@/api'
import eventBus from '@/config/eventBus'
import MoldDialog from '@/components/view/MoldDialog'
import { createJobTracker } from '@/utils/jobTracker'
import { internalLbApis, internalLbScope, internalLbSuitable, internalLbIp, internalLbBindings, internalLbNicIps } from '@/utils/internalLb'
import { vpcVpnOwner, vpcVpnSameOwner } from '@/utils/vpcVpn'

export default {
  name: 'InternalLbDialog',
  components: { MoldDialog },
  props: { mode: { type: String, required: true }, resource: { type: Object, required: true }, tierId: { type: String, default: '' } },
  emits: ['cancel', 'success'],
  data () { return { draft: { name: '', description: '', sourceIP: '', sourcePort: null, instancePort: null, algorithm: 'source' }, selected: {}, network: {}, vms: [], assigned: new Set(), search: '', page: 1, loaded: false, loading: false, saving: false, loadError: '', error: '', jobId: '', entityId: '', target: null, origin: '', entryKey: '', closed: false, disposed: false, tracker: null } },
  computed: {
    scope () { return internalLbScope(this) },
    storageKey () { const u = this.$store.getters.userInfo || {}; return 'internal-lb:' + JSON.stringify([this.mode, this.resource.id, this.tierId, this.resource.projectid, this.resource.account, this.resource.domainid, u.id, u.roleid, u.roletype, this.$store.getters.project?.id]) },
    command () { return this.mode === 'create' ? 'createLoadBalancer' : 'assignToLoadBalancerRule' },
    allowed () { const p = this.$store.getters.project?.id; return this.current() && !!this.$store.getters.userInfo?.id && (!p || String(p) === '0' || p === this.resource.projectid) && internalLbApis(this.mode).every(api => api in (this.$store.getters.apis || {})) },
    busy () { return this.loading || this.saving },
    blocksNavigation () { return !this.closed && this.busy },
    fieldsDisabled () { return this.busy || !!this.jobId || !this.allowed || !this.loaded || !!this.loadError },
    filteredVms () { const s = this.search.trim().toLowerCase(); return this.vms.filter(vm => [vm.name, vm.displayname].some(v => String(v || '').toLowerCase().includes(s))) },
    columns () { return [{ key: 'name', title: this.$t('label.name'), width: 270 }, { key: 'state', dataIndex: 'state', title: this.$t('label.state'), width: 110 }, { key: 'ip', title: this.$t('label.ipaddress'), width: 290 }, { key: 'select', title: this.$t('label.select'), width: 90, fixed: 'right' }] },
    rules () { const required = [{ required: true, message: this.$t('label.required') }]; return { name: [{ required: true, whitespace: true, message: this.$t('label.required') }], sourcePort: required, instancePort: required, algorithm: required, sourceIP: [{ validator: (_, ip) => internalLbIp(ip, this.network) ? Promise.resolve() : Promise.reject(this.$t('message.internal.lb.ip')) }] } }
  },
  watch: { scope: { flush: 'sync', handler () { this.invalidate() } } },
  created () {
    this.origin = this.scope; this.entryKey = this.storageKey
    try { const p = JSON.parse(sessionStorage.getItem(this.entryKey) || 'null'); if (p && /^[\da-f-]{36}$/i.test(p.jobId)) { this.jobId = p.jobId; this.entityId = p.entityId || ''; this.draft = { ...this.draft, ...p.draft }; this.selected = p.selected || {}; this.target = p.target } } catch (_) {}
    this.tracker = createJobTracker({
      interval: 1000,
      maxRetries: 2,
      maxDuration: 120000,
      onState: () => {},
      query: async id => {
        const json = await getAPI('queryAsyncJobResult', { jobid: id, ignoreproject: true }, { preserveOnFailure: true, timeout: 15000 }); const job = json.queryasyncjobresultresponse
        const cmd = this.mode === 'create' ? 'createapplicationloadbalancercmd' : 'assigntoloadbalancerrulecmd'
        if (!job || job.jobid !== id || (job.cmd && job.cmd.split('.').pop().toLowerCase() !== cmd)) throw new Error(this.$t('message.internal.lb.changed'))
        return job
      }
    })
    eventBus.on('project-switch-start', this.invalidate); this.load()
  },
  beforeUnmount () { this.disposed = true; eventBus.off('project-switch-start', this.invalidate); this.tracker && this.tracker.clear() },
  methods: {
    current () { return !this.closed && !this.disposed && this.origin === this.scope },
    invalidate () { if (this.closed) return; this.closed = true; this.tracker && this.tracker.clear(); this.$emit('cancel') },
    close () { if (!this.busy) this.invalidate() },
    message (error) { const d = error?.response?.data?.errorresponse; return [d?.errorcode, d?.errortext || error?.message || this.$t('message.request.failed')].filter(Boolean).join(': ') },
    persist () { sessionStorage.setItem(this.entryKey, JSON.stringify({ jobId: this.jobId, entityId: this.entityId, draft: { ...this.draft }, selected: this.selected, target: this.target })) },
    clearReceipt () { this.jobId = ''; this.entityId = ''; this.target = null; try { sessionStorage.removeItem(this.entryKey) } catch (_) {} },
    async rows (api, key, params = {}) {
      const rows = []; const seen = new Set()
      for (let page = 1; page <= 100; page++) {
        const json = await getAPI(api, { ...vpcVpnOwner(this.resource), ignoreproject: true, listall: true, ...params, page, pagesize: 100 }, { preserveOnFailure: true, timeout: 15000 })
        if (!this.current()) return []
        const body = json?.[api.toLowerCase() + 'response']; if (!body || body.errorcode) throw new Error(this.$t('message.internal.lb.changed'))
        const batch = body[key] || []
        for (const row of batch) { const id = row.id || row.loadbalancerruleinstance?.id; if (!id || seen.has(id)) throw new Error(this.$t('message.internal.lb.changed')); seen.add(id); rows.push(row) }
        if (batch.length < 100 || (Number.isInteger(body.count) && rows.length >= body.count)) return rows
      }
      throw new Error(this.$t('message.internal.lb.changed'))
    },
    async fresh () {
      const id = this.mode === 'create' ? this.tierId : this.resource.networkid
      const network = (await this.rows('listNetworks', 'network', { id })).find(n => n.id === id)
      if (!network || !vpcVpnSameOwner(network, this.resource) || ['Destroy', 'Shutdown'].includes(network.state)) throw new Error(this.$t('message.internal.lb.changed'))
      const [vpcs, offerings] = await Promise.all([this.rows('listVPCs', 'vpc', { id: network.vpcid }), this.rows('listNetworkOfferings', 'networkoffering', { id: network.networkofferingid })])
      const vpc = vpcs.find(v => v.id === network.vpcid); const offering = offerings.find(o => o.id === network.networkofferingid)
      if (!vpc || vpc.state !== 'Enabled' || !vpcVpnSameOwner(vpc, this.resource) || (this.mode === 'create' && vpc.id !== this.resource.id) || !offering || !internalLbSuitable(network, offering)) throw new Error(this.$t('message.internal.lb.changed'))
      if (this.mode === 'create') return { network, vms: [], assigned: new Set() }
      const rules = await this.rows('listLoadBalancers', 'loadbalancer', { id: this.resource.id })
      const rule = rules.find(r => r.id === this.resource.id)
      if (!rule || rule.networkid !== id || rule.scheme !== 'Internal' || rule.autoscalevmgroup || !vpcVpnSameOwner(rule, this.resource)) throw new Error(this.$t('message.internal.lb.changed'))
      const [vms, bindings] = await Promise.all([this.rows('listVirtualMachines', 'virtualmachine', { networkid: id }), this.rows('listLoadBalancerRuleInstances', 'lbrulevmidip', { id: rule.id, lbvmips: true })])
      const assigned = internalLbBindings(bindings)
      return { network, assigned, vms: vms.filter(vm => ['Running', 'Stopped'].includes(vm.state) && vpcVpnSameOwner(vm, this.resource) && internalLbNicIps(vm, id, assigned).length) }
    },
    async load () {
      if (this.busy || !this.allowed) return
      if (this.jobId) return this.checkJob()
      this.loading = true; this.error = ''; this.loadError = ''
      try {
        const state = await this.fresh(); if (!this.current()) return; this.network = state.network; this.vms = state.vms; this.assigned = state.assigned; this.loaded = true; this.page = 1
        this.selected = Object.fromEntries(Object.entries(this.selected).filter(([id, ips]) => { const vm = this.vms.find(v => v.id === id); return vm && ips.length && ips.every(ip => this.options(vm).includes(ip)) }))
      } catch (error) { if (this.current()) this.error = this.loadError = this.message(error) } finally { if (this.current()) this.loading = false }
    },
    options (vm) { return internalLbNicIps(vm, this.network.id, this.assigned) },
    selectVm (vm, checked) { if (this.fieldsDisabled) return; if (checked) this.selected[vm.id] = this.options(vm).slice(0, 1); else delete this.selected[vm.id] },
    async verifySuccess (job) {
      if (this.mode === 'create') {
        const row = job.jobresult?.loadbalancer
        if (!row?.id || (this.entityId && row.id !== this.entityId) || row.networkid !== this.target.networkid || row.name !== this.target.name || !vpcVpnSameOwner(row, this.resource)) throw new Error(this.$t('message.internal.lb.changed'))
        const listed = (await this.rows('listLoadBalancers', 'loadbalancer', { id: row.id })).find(r => r.id === row.id && r.networkid === this.target.networkid)
        if (!listed) throw new Error(this.$t('message.internal.lb.changed'))
      } else {
        const bindings = internalLbBindings(await this.rows('listLoadBalancerRuleInstances', 'lbrulevmidip', { id: this.resource.id, lbvmips: true }))
        if (!Object.entries(this.target.selected).every(([id, ips]) => ips.every(ip => bindings.has(id + ':' + ip)))) throw new Error(this.$t('message.internal.lb.changed'))
      }
    },
    async checkJob () {
      if (this.busy || !this.allowed || !this.jobId) return
      this.saving = true; this.error = ''
      const job = await this.tracker.track(this.jobId, {}, true)
      if (!this.current()) return
      if (job?.jobstatus === 1) {
        try { await this.verifySuccess(job); if (!this.current()) return; this.clearReceipt(); this.closed = true; this.$emit('success'); this.$emit('cancel') } catch (_) { if (this.current()) this.error = this.$t('message.internal.lb.unknown') }
      } else if (job?.jobstatus === 2) { this.error = [job.jobresult?.errorcode || job.jobresultcode, job.jobresult?.errortext || this.$t('message.request.failed')].filter(Boolean).join(': '); this.clearReceipt() } else this.error = this.$t('message.internal.lb.unknown')
      if (this.current()) this.saving = false
    },
    async submit () {
      if (this.busy || !this.allowed) return
      if (this.jobId) return this.checkJob()
      if (!this.loaded || this.loadError) return
      this.saving = true; this.error = ''
      try {
        await this.$refs.formRef.validate(); if (!this.current()) return
        const state = await this.fresh(); if (!this.current() || !this.allowed) return
        let params
        if (this.mode === 'create') {
          if (!this.draft.name.trim() || !internalLbIp(this.draft.sourceIP, state.network) || !['source', 'roundrobin', 'leastconn'].includes(this.draft.algorithm) || [this.draft.sourcePort, this.draft.instancePort].some(p => !Number.isInteger(p) || p < 1 || p > 65535)) throw new Error(this.$t('message.internal.lb.validation'))
          params = { name: this.draft.name.trim(), description: this.draft.description, sourceipaddress: this.draft.sourceIP || undefined, sourceport: this.draft.sourcePort, instanceport: this.draft.instancePort, algorithm: this.draft.algorithm, networkid: state.network.id, sourceipaddressnetworkid: state.network.id, scheme: 'Internal' }
          this.target = { networkid: state.network.id, name: params.name }
        } else {
          const entries = Object.entries(this.selected); if (!entries.length) return
          const mapping = {}; let index = 0
          for (const [id, ips] of entries) {
            const vm = state.vms.find(v => v.id === id)
            const json = await getAPI('listNics', { virtualmachineid: id, networkid: state.network.id, ...vpcVpnOwner(this.resource), ignoreproject: true }, { preserveOnFailure: true, timeout: 15000 })
            if (!this.current()) return
            const actual = { id, nic: json?.listnicsresponse?.nic || [] }
            if (!vm || !ips.length || !ips.every(ip => internalLbNicIps(actual, state.network.id, state.assigned).includes(ip))) throw new Error(this.$t('message.internal.lb.changed'))
            mapping['vmidipmap[' + index + '].vmid'] = id; mapping['vmidipmap[' + index++ + '].vmip'] = ips.join(',')
          }
          params = { id: this.resource.id, ...mapping }; this.target = { selected: JSON.parse(JSON.stringify(this.selected)) }
        }
        if (!this.current() || !this.allowed) return
        this.jobId = uuid(); try { this.persist() } catch (_) { this.clearReceipt(); throw new Error(this.$t('message.vpc.vpn.storage')) }
        let json
        try { json = await postAPI(this.command, { ...params, ...vpcVpnOwner(this.resource), ignoreproject: true, customjobid: this.jobId }, { preserveOnFailure: true }) } catch (error) {
          if (!this.current()) return
          if ((error?.response?.data?.errorresponse && ![502, 503, 504].includes(error.response.status)) || [400, 401, 403, 404].includes(error?.response?.status)) this.clearReceipt()
          throw error
        }
        if (!this.current()) return
        if (json?.errorresponse) { this.clearReceipt(); throw new Error(json.errorresponse.errortext) }
        const receipt = json?.[this.command.toLowerCase() + 'response']; if (!receipt?.jobid || !/^[\da-f-]{36}$/i.test(receipt.jobid)) throw new Error(this.$t('message.internal.lb.unknown'))
        this.jobId = receipt.jobid; this.entityId = receipt.id || ''; this.persist()
      } catch (error) { if (this.current() && !error?.errorFields) this.error = this.message(error) } finally { if (this.current()) this.saving = false }
      if (this.current() && this.jobId) return this.checkJob()
    }
  }
}
</script>
<style scoped>
.internal-lb-target { display: flex; flex-direction: column; gap: 4px; margin-bottom: 16px; overflow-wrap: anywhere; }
.internal-lb-target span, .internal-lb-instance { opacity: .75; }
.internal-lb-reload, .internal-lb-search, .ant-alert { margin-bottom: 16px; }
.internal-lb-form, .internal-lb-form :deep(.ant-input-number), .internal-lb-form :deep(.ant-select) { width: 100%; min-width: 0; }
.internal-lb-vms :deep(td), .internal-lb-vms :deep(th) { overflow-wrap: anywhere; }
:global(body.dark-mode) .internal-lb-vms :deep(.ant-table-cell-fix-right) { background: #1d222b; }
</style>
