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
  <mold-dialog
v-if="visible"
class="iso-zone-dialog"
:visible="visible"
:title="$t('label.action.' + kind + '.iso')"
size="lg"
form-actions
focus-guard
@cancel="close">
    <div ref="content" v-ctrl-enter="submit" class="iso-zone-operation">
      <dl class="template-dialog-context"><dt>{{ $t('label.name') }}</dt><dd>{{ resource.name }}</dd><dt>{{ $t('label.id') }}</dt><dd>{{ resource.id }}</dd><template v-if="kind==='copy'"><dt>{{ $t('label.iso.zone.source') }}</dt><dd>{{ sourceName }}</dd></template></dl>
      <a-alert v-if="kind==='delete'" type="warning" show-icon :message="$t('message.iso.zone.delete')" />
      <a-alert v-if="error" type="error" show-icon :message="error" />
      <template v-if="phase==='confirm' && kind==='copy'">
        <a-alert v-if="!optionsLoading && !error && !destinations.length" type="info" show-icon :message="$t('message.iso.zone.copy.empty')" />
        <a-form-item :label="$t('label.select.zones')" :html-for="selectorId">
          <a-select
:id="selectorId"
v-model:value="selectedZones"
mode="multiple"
:loading="optionsLoading"
:disabled="busy || !destinations.length"
show-search
option-filter-prop="label"
:options="destinations.map(z=>({value:z.id,label:z.name}))" />
        </a-form-item>
      </template>
      <a-spin :spinning="optionsLoading">
        <a-table size="small" :columns="columns" :data-source="rows" :pagination="false" :scroll="{x:600}" row-key="zoneid">
          <template #bodyCell="{column,record}">
            <span v-if="column.key==='zonename'" class="iso-zone-name" :title="record.zonename">{{ record.zonename || '—' }}</span>
            <template-availability v-else-if="column.key==='status'" kind="iso" :record="record" compact :show-scope="false" />
            <span v-else-if="column.key==='operationState'" role="status">{{ $t('label.iso.zone.state.'+record.operationState) }}<span v-if="record.jobComplete" class="job-completed"> · {{ $t('label.iso.zone.job.completed') }}</span><p v-if="record.error">{{ record.error }}</p></span>
          </template>
        </a-table>
      </a-spin>
      <p v-if="phase==='result'" role="status">{{ $t('label.success') }} {{ count('success') }} · {{ $t('state.failed') }} {{ count('failed') }} · {{ $t('label.unknown') }} {{ count('unknown') }} · {{ $t('state.inprogress') }} {{ count('requesting')+count('running')+count('waitingReady') }}</p>
      <mold-dialog-actions :busy="busy">
        <a-button @click="close">{{ $t(phase==='confirm'?'label.cancel':'label.close') }}</a-button>
        <a-button v-if="phase==='confirm'" type="primary" :danger="kind==='delete'" :disabled="!canSubmit" :loading="busy" @click="submit">{{ $t('label.ok') }}</a-button>
        <a-button v-if="phase==='result' && rows.some(r=>r.operationState==='failed' && r.retryable)" @click="retryFailed">{{ $t('label.template.zone.retry.failed') }}</a-button>
        <a-button v-if="phase==='result' && rows.some(r=>['unknown','waitingReady'].includes(r.operationState))" @click="observeUnknown">{{ $t('label.template.zone.observe') }}</a-button>
      </mold-dialog-actions>
    </div>
  </mold-dialog>
</template>
<script>
import { getAPI, postAPI } from '@/api'
import { canIsoAction, isoOwner } from '@/utils/isoModel'
import { isoCopyDestinations, isoCopyResult, isoZoneSnapshot, readOwnedIsoZones } from '@/utils/isoZoneOperations'
import { isoListLocation } from '@/utils/isoSearch'
import MoldDialog from '@/components/view/MoldDialog'
import MoldDialogActions from '@/components/view/MoldDialogActions'
import TemplateAvailability from '@/components/widgets/TemplateAvailability'
export default {
  name: 'IsoZoneOperations',
  components: { MoldDialog, MoldDialogActions, TemplateAvailability },
  props: { resource: { type: Object, required: true }, context: { type: String, required: true }, permitted: Boolean, allowed: { type: Function, required: true } },
  emits: ['retained', 'refresh', 'refresh-parent', 'closed'],
  data () { return { visible: false, kind: 'delete', phase: 'confirm', rows: [], allSourceRows: [], sourceId: '', sourceName: '', busy: false, optionsLoading: false, error: '', destinations: [], selectedZones: [], epoch: 0, operationContext: '', returnFocus: null } },
  computed: {
    selectorId () { return 'iso-copy-zones-' + this.resource.id },
    canSubmit () {
      if (!this.current(this.epoch) || this.busy || this.optionsLoading || this.error || !this.rows.length) return false
      return this.kind === 'delete' || (this.selectedZones.length > 0 && new Set(this.selectedZones).size === this.selectedZones.length && this.selectedZones.every(id => this.destinations.some(z => z.id === id)))
    },
    columns () { return ['zonename', ...(this.phase === 'confirm' ? ['status'] : ['operationState'])].map(key => ({ key, dataIndex: key, title: this.$t(key === 'operationState' ? 'label.operation.status' : 'label.' + key) })) }
  },
  watch: { context () { this.invalidate() }, permitted (value) { if (!value) this.invalidate() } },
  beforeUnmount () { this.invalidate() },
  methods: {
    count (state) { return this.rows.filter(r => r.operationState === state).length },
    current (epoch) { return this.visible && epoch === this.epoch && this.operationContext === this.context && this.permitted && isoOwner(this.resource, this.$store.getters) },
    retained (active = true) { this.$emit('retained', { active, context: this.operationContext, busy: this.busy }) },
    invalidate () { this.epoch++; this.visible = false; this.busy = false; this.optionsLoading = false; this.returnFocus = null; this.retained(false); this.operationContext = ''; this.rows = [] },
    errorText (e) { return String(e?.message || this.$t('message.request.failed')).replace(/([?&](?:sessionkey|apikey|signature|token)=)[^&\s]+/gi, '$1[redacted]').slice(0, 1000) },
    rejected (error) { const r = error.response; const d = r?.data; return !!(d?.errorcode || d?.errorresponse?.errorcode || Object.values(d || {}).some(v => v?.errorcode) || (r?.status >= 400 && r.status < 500 && r.status !== 408)) },
    async read (epoch) { return readOwnedIsoZones(getAPI, this.resource, this.$store.getters, () => this.current(epoch)) },
    async open (kind, records) {
      if (this.busy || this.visible || !this.permitted || !records.length || records.some(r => !this.allowed(kind, r))) return
      this.returnFocus = document.activeElement
      if (!this.returnFocus || this.returnFocus === document.body) this.returnFocus = Array.from(this.$parent?.$el?.querySelectorAll?.('button[aria-label]') || []).find(b => b.getAttribute('aria-label') === this.$t('label.action.' + kind + '.iso') && b.closest('tr')?.getAttribute('data-row-key') === records[0].zoneid)
      if (this.operationContext === this.context && this.rows.some(r => ['unknown', 'waitingReady'].includes(r.operationState))) { this.visible = true; this.retained(); return }
      this.epoch++; this.kind = kind; this.phase = 'confirm'; this.rows = records.map(r => isoZoneSnapshot(r, this.resource)); this.sourceId = records[0].zoneid; this.sourceName = records[0].zonename; this.selectedZones = []; this.destinations = []; this.error = ''; this.operationContext = this.context; this.visible = true; this.optionsLoading = true; this.retained()
      const epoch = this.epoch
      try {
        const rows = await this.read(epoch); if (!this.current(epoch)) return
        this.allSourceRows = rows
        if (records.some(r => !rows.some(f => f.zoneid === r.zoneid && canIsoAction(kind, f, this.$store.getters)))) throw new Error(this.$t('message.iso.action.unavailable'))
        if (kind === 'copy') {
          if (!('listZones' in this.$store.getters.apis)) throw new Error(this.$t('message.no.access'))
          const d = (await getAPI('listZones', { available: true, ignoreproject: true }, { preserveOnFailure: true })).listzonesresponse
          if (!this.current(epoch)) return
          if (!d || (d.zone !== undefined && !Array.isArray(d.zone))) throw new Error(this.$t('error.fetching.data'))
          this.destinations = isoCopyDestinations(d.zone || [], this.sourceId, rows)
        }
      } catch (e) { if (this.current(epoch)) this.error = this.errorText(e) } finally { if (this.current(epoch)) this.optionsLoading = false }
    },
    async submit (event) {
      if (event?.preventDefault) event.preventDefault()
      if (this.phase !== 'confirm' || !this.canSubmit) return
      if (this.kind === 'copy') { const source = this.rows[0]; this.rows = this.selectedZones.map(id => ({ ...source, zoneid: id, zonename: this.destinations.find(z => z.id === id).name, operationState: 'pending', jobid: '', jobComplete: false, error: '' })) }
      this.phase = 'result'; await this.run(this.rows)
    },
    async run (rows) {
      if (this.busy) return
      this.busy = true; this.retained(); const epoch = this.epoch
      try { for (const row of rows) { if (!this.current(epoch)) break; await this.request(row, epoch) } } finally { if (this.current(epoch)) { this.busy = false; this.retained(); this.$emit('refresh') } }
    },
    async request (row, epoch) {
      row.operationState = 'requesting'; row.error = ''; row.retryable = false; row.jobid = ''; row.jobComplete = false
      let postStarted = false
      try {
        const fresh = await this.read(epoch); if (!this.current(epoch)) return
        const target = fresh.find(r => r.zoneid === (this.kind === 'copy' ? this.sourceId : row.zoneid))
        if (this.kind === 'delete' && !target) { row.operationState = 'success'; row.verifiedGone = true; return }
        if (!target || !canIsoAction(this.kind, target, this.$store.getters)) throw Object.assign(new Error(this.$t('message.iso.action.unavailable')), { response: {} })
        if (this.kind === 'copy' && fresh.some(r => r.zoneid === row.zoneid)) { row.operationState = isoCopyResult(fresh, row.id, row.zoneid) === 'success' ? 'success' : 'failed'; row.error = row.operationState === 'success' ? '' : this.$t('message.iso.zone.copy.duplicate'); return }
        const api = this.kind === 'copy' ? 'copyIso' : 'deleteIso'
        const params = this.kind === 'copy' ? { id: row.id, sourcezoneid: this.sourceId, destzoneids: row.zoneid } : { id: row.id, zoneid: row.zoneid }
        postStarted = true
        const json = await postAPI(api, params, { preserveOnFailure: true }); if (!this.current(epoch)) return
        row.jobid = json[this.kind === 'copy' ? 'copytemplateresponse' : 'deleteisoresponse']?.jobid || ''
        row.operationState = row.jobid ? 'running' : 'unknown'
        if (row.jobid) await this.observeJob(row, epoch)
      } catch (e) { if (this.current(epoch)) { row.operationState = !postStarted || this.rejected(e) ? 'failed' : 'unknown'; row.retryable = !postStarted || this.rejected(e); row.error = this.errorText(e) } }
    },
    async observeJob (row, epoch) {
      const deadline = Date.now() + 60000
      try {
        while (this.current(epoch)) {
          const d = (await getAPI('queryAsyncJobResult', { jobid: row.jobid }, { preserveOnFailure: true, timeout: 10000 })).queryasyncjobresultresponse
          if (!this.current(epoch)) return
          if ([0, 1, 2].includes(d?.jobstatus)) row.error = ''
          if (d?.jobstatus === 2) { row.operationState = 'failed'; row.jobComplete = true; row.retryable = true; row.error = this.errorText({ message: d.jobresult?.errortext }); return }
          if (d?.jobstatus === 1) { row.jobComplete = true; await this.observeResult(row, epoch); return }
          if (!d || ![0, 1, 2].includes(d.jobstatus)) throw new Error(this.$t('error.fetching.data'))
          if (Date.now() >= deadline) break
          await new Promise(resolve => setTimeout(resolve, 1500))
        }
        if (this.current(epoch)) row.operationState = 'unknown'
      } catch (e) { if (this.current(epoch)) { row.operationState = 'unknown'; row.error = this.errorText(e) } }
    },
    async observeResult (row, epoch) {
      const deadline = Date.now() + 60000
      try {
        while (this.current(epoch)) {
          const fresh = await this.read(epoch); if (!this.current(epoch)) return
          row.error = ''
          if (this.kind === 'delete') { if (!fresh.some(r => r.zoneid === row.zoneid)) { row.operationState = 'success'; row.verifiedGone = true; return } row.operationState = 'unknown' } else {
            row.operationState = isoCopyResult(fresh, row.id, row.zoneid)
            if (['success', 'failed'].includes(row.operationState)) return
          }
          if (!row.jobComplete || Date.now() >= deadline) return
          await new Promise(resolve => setTimeout(resolve, 1500))
        }
      } catch (e) { if (this.current(epoch)) { row.operationState = 'unknown'; row.error = this.errorText(e) } }
    },
    async retryFailed () { await this.run(this.rows.filter(r => r.operationState === 'failed' && r.retryable)) },
    async observeUnknown () {
      if (this.busy) return
      this.busy = true; this.retained(); const epoch = this.epoch
      try { for (const row of this.rows.filter(r => ['unknown', 'waitingReady'].includes(r.operationState))) { if (row.jobid && !row.jobComplete) await this.observeJob(row, epoch); else await this.observeResult(row, epoch) } } finally { if (this.current(epoch)) { this.busy = false; this.retained(); this.$emit('refresh') } }
    },
    close () {
      if (this.busy) return
      const target = this.returnFocus; const context = this.operationContext
      const last = this.kind === 'delete' && this.phase === 'result' && this.rows.every(r => r.operationState === 'success' && r.verifiedGone) && this.allSourceRows.every(r => this.rows.some(d => d.zoneid === r.zoneid))
      this.epoch++; this.visible = false; this.retained(false); this.$emit('closed', this.rows.filter(r => r.operationState !== 'success').map(r => r.zoneid))
      if (last) this.$router.push(isoListLocation(this.$route, this.$store.getters)); else { this.$emit('refresh'); this.$emit('refresh-parent'); this.$nextTick(() => { if (!this.visible && context === this.context && target?.isConnected && !target.disabled && target.getClientRects().length) target.focus({ preventScroll: true }) }) }
    }
  }
}
</script>
<style scoped>
.iso-zone-operation {min-width:0;overflow-wrap:anywhere;}
.iso-zone-operation .ant-alert {margin-bottom:16px;}
.iso-zone-operation dd {white-space:pre-wrap;}
.iso-zone-name {display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.iso-zone-operation :deep(.ant-select) {width:100%;}
</style>
