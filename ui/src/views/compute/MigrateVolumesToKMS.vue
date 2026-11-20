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
  <MoldDialog size="xl" :title="$t('label.migrate.volumes.to.kms')" :closable="!busy" :keyboard="!busy" focus-guard @cancel="close">
    <a-descriptions :column="1" bordered size="small">
      <a-descriptions-item :label="$t('label.kmskeyid')">{{ target.name }} · {{ target.id }}</a-descriptions-item>
      <a-descriptions-item :label="$t('label.account')">{{ target.project || target.account }} / {{ target.domain }} / {{ target.zonename }}</a-descriptions-item>
    </a-descriptions>
    <a-alert type="info" show-icon :message="$t('message.kms.migration.scope')" />
    <a-alert v-if="error" type="error" show-icon :message="error" role="alert" />
    <div class="mold-dialog-toolbar kms-migration-toolbar">
      <strong>{{ $t('label.kms.migration.volumes') }}</strong>
      <span role="status">{{ $t('label.total') }} {{ total }} · {{ $t('label.selected') }} {{ selected.length }}</span>
      <a-input-search v-model:value="keyword" :placeholder="$t('label.search')" :disabled="busy || started" @search="search" />
      <label for="kms-migration-filter" class="kms-filter-label">{{ $t('label.kms.migration.filter') }}</label>
      <a-select id="kms-migration-filter" v-model:value="filter" :disabled="busy || started" style="min-width: 132px" @change="search">
        <a-select-option value="all">{{ $t('label.all') }}</a-select-option>
        <a-select-option value="eligible">{{ $t('label.kms.migration.eligible') }}</a-select-option>
        <a-select-option value="ineligible">{{ $t('label.kms.migration.ineligible') }}</a-select-option>
      </a-select>
      <a-button :disabled="busy || started" @click="load">{{ $t('label.refresh') }}</a-button>
    </div>
    <a-table
:columns="columns"
:data-source="rows"
row-key="id"
size="small"
:loading="loading"
      :scroll="{ x: 1150 }"
:row-selection="started ? undefined : selection"
      :pagination="{ current: page, pageSize: 10, total, showSizeChanger: false }"
@change="changePage">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'name'">{{ record.name }}<div class="kms-volume-id">{{ record.id }}</div></template>
        <template v-else-if="column.key === 'size'">{{ $bytesToHumanReadableSize(record.size || 0) }}</template>
        <template v-else-if="column.key === 'kmsmigrationreason'">{{ reason(record.kmsmigrationreason) }}</template>
        <template v-else>{{ record[column.key] || '—' }}</template>
      </template>
    </a-table>
    <template v-if="started">
      <a-alert :type="resultType" show-icon :message="resultText" role="status" />
      <a-table :columns="resultColumns" :data-source="results" row-key="id" :pagination="false" size="small">
        <template #bodyCell="{ column, record }"><template v-if="column.key === 'status'">{{ $t('label.kms.migration.result.' + record.status) }}</template><template v-else>{{ record[column.key] }}</template></template>
      </a-table>
    </template>
    <template #footer>
      <a-button :disabled="busy" @click="close">{{ $t(started ? 'label.close' : 'label.cancel') }}</a-button>
      <a-button v-if="started" :disabled="busy || !valid" :loading="busy" @click="checkResult">{{ $t('label.kms.migration.check') }}</a-button>
      <a-button v-else type="primary" :disabled="!canSubmit" :loading="busy" @click="submit">{{ $t('label.migrate.volumes.to.kms') }}</a-button>
    </template>
  </MoldDialog>
</template>
<script>
import MoldDialog from '@/components/view/MoldDialog'
import { getAPI, postAPI } from '@/api'
import { migrationIdentity, migrationParams, migrationList, migrationSupported, migrationPreflight, migrationOutcome } from '@/utils/kmsVolumeMigration'

export default {
  name: 'MigrateVolumesToKMS',
  components: { MoldDialog },
  props: { resource: { type: Object, required: true } },
  emits: ['close-action', 'refresh-data'],
  data () {
    return { target: Object.freeze({ ...this.resource }), rows: [], selected: [], selectedRows: {}, total: 0, page: 1, keyword: '', filter: 'all', loading: false, busy: false, started: false, error: '', results: [], receipt: null, jobId: null, terminal: 'unknown', disposed: false, generation: 0, originalScope: '' }
  },
  computed: {
    valid () { return !this.disposed && this.originalScope === this.scope() && migrationIdentity(this.resource) === migrationIdentity(this.target) && migrationSupported(this.$store.getters.apis) && this.$store.getters.userInfo?.roletype === 'Admin' },
    canSubmit () { return this.valid && !this.busy && !this.loading && !this.started && !this.error && this.selected.length > 0 },
    selection () { return { selectedRowKeys: this.selected, preserveSelectedRowKeys: true, getCheckboxProps: row => ({ disabled: this.busy || this.loading || row.kmsmigrationeligible !== true }), onChange: this.select } },
    columns () { return [['name', 245], ['vmname', 140], ['size', 90], ['encryptformat', 100], ['kmskey', 150], ['state', 100], ['kmsmigrationreason', 190]].map(([key, width]) => ({ key, dataIndex: key, width, title: this.$t({ name: 'label.name', vmname: 'label.vm', size: 'label.size', encryptformat: 'label.encryption', kmskey: 'label.kmskeyid', state: 'label.state', kmsmigrationreason: 'label.kms.migration.reason' }[key]) })) },
    resultColumns () { return ['name', 'id', 'status'].map(key => ({ key, dataIndex: key, title: this.$t(key === 'status' ? 'label.operation.status' : 'label.' + key) })) },
    resultType () { return this.terminal === 'success' && this.receipt?.migrated > 0 ? 'success' : this.terminal === 'failed' ? 'error' : 'warning' },
    resultText () {
      if (this.terminal === 'success' && this.receipt) return this.$t('message.kms.migration.counts', this.receipt)
      return this.$t(this.terminal === 'failed' ? 'message.kms.migration.failed' : 'message.kms.migration.unknown')
    },
    scopeStamp () { return this.scope() + migrationIdentity(this.resource) }
  },
  watch: {
    scopeStamp () { this.generation++; this.selected = []; this.selectedRows = {}; this.rows = []; this.error = this.$t('message.kms.migration.context.changed') }
  },
  mounted () { this.originalScope = this.scope(); this.load() },
  beforeUnmount () { this.disposed = true; this.generation++ },
  methods: {
    scope () { const g = this.$store.getters; return JSON.stringify([g.userInfo?.id, g.userInfo?.roleid, this.$store.state?.user?.token, g.project?.id, this.$route?.path]) },
    reason (value) { return this.$t('label.kms.migration.reason.' + value) },
    close () { if (!this.busy) this.$emit('close-action') },
    select (ids, records) {
      if (!this.valid || this.busy || this.started) return
      const eligible = new Map([...Object.values(this.selectedRows), ...records].filter(row => row?.kmsmigrationeligible === true).map(row => [row.id, row]))
      this.selected = [...new Set(ids)].filter(id => eligible.has(id))
      this.selectedRows = Object.fromEntries(this.selected.map(id => [id, eligible.get(id)]))
    },
    search () { this.page = 1; this.load() },
    changePage (pagination) { this.page = pagination.current; this.load() },
    async targetCheck () {
      if (!this.valid) throw new Error('CONTEXT_CHANGED')
      const response = await getAPI('listKMSKeys', { id: this.target.id, listall: true, ignoreproject: true, ...(this.target.projectid ? { projectid: this.target.projectid } : {}) }, { preserveOnFailure: true, timeout: 15000 })
      const list = response?.listkmskeysresponse?.kmskey || []
      if (list.length !== 1 || migrationIdentity(list[0]) !== migrationIdentity(this.target) || list[0].enabled !== true || !this.valid) throw new Error('CONTEXT_CHANGED')
      // The candidate endpoint also revalidates the current profile, active KEK and migration API permission.
    },
    async candidates (extra) { return migrationList(await getAPI('listVolumes', migrationParams(this.target, extra), { preserveOnFailure: true, timeout: 15000 })) },
    async load () {
      const request = ++this.generation
      this.loading = true
      this.error = ''
      try {
        await this.targetCheck()
        const extra = { page: this.page, pagesize: 10, ...(this.keyword ? { keyword: this.keyword } : {}) }
        if (this.filter !== 'all') extra.kmsmigrationeligible = this.filter === 'eligible'
        const list = await this.candidates(extra)
        if (!this.valid || request !== this.generation) return
        this.rows = list.rows; this.total = list.count
      } catch (error) { if (!this.disposed && request === this.generation) { this.rows = []; this.total = 0; this.error = this.$t(error.message === 'CONTEXT_UNSUPPORTED' ? 'message.kms.migration.unsupported' : 'message.kms.migration.preflight') } } finally { if (request === this.generation) this.loading = false }
    },
    async selectedCandidates (ids) {
      const rows = []
      for (let start = 0; start < ids.length; start += 50) {
        const chunk = ids.slice(start, start + 50)
        const list = await this.candidates({ ids: chunk.join(','), page: 1, pagesize: 50 })
        if (!this.valid || list.count !== list.rows.length || list.rows.some(row => !chunk.includes(row.id))) throw new Error('CONTEXT_CHANGED')
        rows.push(...list.rows)
      }
      return rows
    },
    async submit () {
      if (!this.canSubmit) return
      this.busy = true
      this.error = ''
      const ids = [...this.selected]
      try {
        await this.targetCheck()
        const rows = await this.selectedCandidates(ids)
        if (!this.valid || !migrationPreflight(ids, rows)) throw new Error('PREFLIGHT_FAILED')
      } catch (error) {
        this.error = this.$t('message.kms.migration.preflight'); this.busy = false; return
      }
      this.started = true
      this.results = ids.map(id => ({ id, name: this.selectedRows[id]?.name, status: 'unknown' }))
      try {
        const json = await postAPI('migrateVolumesToKMS', { kmskeyid: this.target.id, volumeids: ids.join(','), ignoreproject: true }, { preserveOnFailure: true, timeout: 30000 })
        this.jobId = json?.migratevolumestokmsresponse?.jobid
        if (this.jobId && this.valid) await this.poll()
      } catch (error) { this.terminal = 'unknown' } finally {
        if (this.valid) { await this.reconcile(); this.$emit('refresh-data') }
        this.busy = false
      }
    },
    async poll () {
      for (let attempt = 0; attempt < 30 && this.valid; attempt++) {
        const result = (await getAPI('queryAsyncJobResult', { jobid: this.jobId }, { preserveOnFailure: true, timeout: 15000 }))?.queryasyncjobresultresponse
        if (result?.jobstatus === 2) { this.terminal = 'failed'; return }
        if (result?.jobstatus === 1) {
          const receipt = result.jobresult
          if (receipt?.success === true && ['requested', 'migrated', 'skipped'].every(field => Number.isInteger(receipt[field]) && receipt[field] >= 0) &&
            receipt.requested === this.selected.length && receipt.migrated + receipt.skipped === receipt.requested) { this.receipt = receipt; this.terminal = 'success' }
          return
        }
        if (attempt < 29) await new Promise(resolve => setTimeout(resolve, 2000))
      }
    },
    async reconcile () {
      try {
        const rows = await this.selectedCandidates(this.results.map(row => row.id))
        if (this.valid) this.results = this.results.map(row => ({ ...row, status: migrationOutcome(rows.find(volume => volume.id === row.id), this.target.id) }))
      } catch (error) { if (this.valid) this.results = this.results.map(row => ({ ...row, status: 'unknown' })) }
    },
    async checkResult () {
      if (this.busy || !this.valid) return
      this.busy = true
      try { if (this.jobId && this.terminal === 'unknown') await this.poll(); await this.reconcile() } catch (error) { this.error = this.$t('message.kms.migration.unknown') } finally { this.busy = false }
    }
  }
}
</script>
<style scoped>
.kms-migration-toolbar { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; margin: 16px 0; }
.kms-migration-toolbar .ant-input-search { width: 220px; }
.kms-filter-label { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
.kms-volume-id { font-size: 12px; overflow-wrap: anywhere; opacity: .8; }
.ant-alert { margin-top: 12px; }
</style>
