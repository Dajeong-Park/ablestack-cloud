<!-- Licensed to the Apache Software Foundation (ASF) under one or more
contributor license agreements. See NOTICE. Licensed under the Apache License,
Version 2.0: http://www.apache.org/licenses/LICENSE-2.0 -->
<template>
  <section class="storage-configuration-operation" aria-live="polite">
    <template v-if="history">
      <div class="detail-tab-toolbar">
        <a-button :loading="loading" @click="loadHistory">
          <template #icon><ReloadOutlined /></template>{{ $t('label.refresh') }}
        </a-button>
      </div>
      <a-alert v-if="readFailed" type="warning" show-icon :message="$t('message.storage.configuration.observation.unavailable')" />
      <a-table :columns="columns" :data-source="rows" row-key="id" :loading="loading && !historyReadComplete" :pagination="{ pageSize: 20 }" :scroll="{ x: 720 }">
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'created'">{{ operationDate(record.created) }}</template>
          <template v-else-if="column.key === 'state'">{{ stateLabel(record.state) }}</template>
          <template v-else-if="column.key === 'details'"><a-button @click="selected = record">{{ $t('label.details') }}</a-button></template>
        </template>
      </a-table>
      <MoldDialog class="sharedfs-standard-dialog" v-if="selected" :title="$t('label.storage.configuration.diagnostics')" size="md" @cancel="selected = null">
        <StorageConfigurationOperationPanel :operation="selected" :refreshing="selectedRefreshing" @refresh="refreshSelected" @resume="$emit('resume', selected)" />
      </MoldDialog>
    </template>
    <template v-else-if="operation">
      <p class="storage-configuration-operation__context">{{ resultContext }}<span v-if="operation.protocol"> · {{ operation.protocol }}</span><span v-if="operation.resourcetype"> · {{ operation.resourcetype }}</span><span v-if="operation.updated || operation.created"> · {{ operationDate(operation.updated || operation.created) }}</span></p>
      <a-alert :type="alertType" show-icon :message="alertMessage" :description="$t('message.storage.configuration.' + descriptionKey)" />
      <a-descriptions bordered size="small" :column="1" class="storage-configuration-operation__summary">
        <a-descriptions-item :label="$t('label.storage.configuration.request')"><code>{{ operation.requestid || '-' }}</code></a-descriptions-item>
        <a-descriptions-item :label="$t('label.storage.configuration.phase')">{{ phaseLabel(operation.phase) }}</a-descriptions-item>
        <a-descriptions-item v-if="!['COMMITTED', 'ROLLED_BACK'].includes(operation.state)" :label="$t('label.storage.preflight.cancel')">{{ $t('message.storage.preflight.cancel.unsupported') }}</a-descriptions-item>
        <a-descriptions-item v-if="operation.id" :label="$t('label.id')"><code>{{ operation.id }}</code></a-descriptions-item>
        <a-descriptions-item v-if="operation.originalfailure?.code" :label="$t('label.storage.configuration.first.failure')">
          <code>{{ operation.originalfailure.code }}</code> · {{ phaseLabel(operation.originalfailure.phase) }}
          <span v-if="preparationReason" class="storage-configuration-operation__reason">{{ preparationReason }}</span>
        </a-descriptions-item>
        <a-descriptions-item v-if="blockedProtocol" :label="$t('label.protocol')">{{ blockedProtocol }}</a-descriptions-item>
        <a-descriptions-item v-if="additionalBlockingCodes.length" :label="$t('label.storage.configuration.first.failure.detail')">
          <a-tag v-for="code in additionalBlockingCodes" :key="code">{{ code }}</a-tag>
        </a-descriptions-item>
        <a-descriptions-item v-if="firstChildCode" :label="$t('label.storage.configuration.first.failure.detail')"><code>{{ firstChildCode }}</code></a-descriptions-item>
        <a-descriptions-item v-if="operation.originalfailure?.stage" :label="$t('label.storage.configuration.failure.stage')"><code>{{ operation.originalfailure.stage }}</code></a-descriptions-item>
        <a-descriptions-item v-if="operation.originalfailure?.reason" :label="$t('label.storage.configuration.failure.reason')"><code>{{ operation.originalfailure.reason }}</code></a-descriptions-item>
        <a-descriptions-item v-if="operation.rollback?.state" :label="$t('label.storage.configuration.rollback')">
          {{ rollbackLabel }}
          <code v-if="operation.rollback.code">{{ operation.rollback.code }}</code>
        </a-descriptions-item>
      </a-descriptions>
      <a-descriptions v-if="operation.observation?.execution" bordered size="small" :column="1" class="storage-configuration-operation__summary">
        <a-descriptions-item :label="$t('label.storage.preflight.heartbeat')">{{ executionTime(operation.observation.execution.heartbeatAt) }}</a-descriptions-item>
        <a-descriptions-item :label="$t('label.storage.preflight.deadline')">{{ executionTime(operation.observation.execution.softDeadlineAt) }}</a-descriptions-item>
      </a-descriptions>
      <a-alert v-if="operation.observation?.execution?.overdue" type="warning" show-icon :message="$t('message.storage.preflight.overdue')" />
      <a-alert v-if="operation.observationwarning || operation.observation?.observationAvailable === false" type="warning" show-icon :message="$t('message.storage.configuration.observation.unavailable')" />
      <div class="detail-tab-toolbar storage-configuration-operation__toolbar">
        <a-button v-if="operation.canresume" type="primary" @click="$emit('resume', operation)">{{ $t('label.storage.configuration.resume') }}</a-button>
        <a-button :loading="refreshing" @click="$emit('refresh')"><template #icon><ReloadOutlined /></template>{{ $t('label.refresh') }}</a-button>
      </div>
    </template>
  </section>
</template>
<script>
import SharedFSTable from '@/components/storage/SharedFSTable.vue'
import { getAPI } from '@/api'
import { sharedfsDateInput, sharedfsRollbackKey } from '@/utils/sharedfsPresentation'
import MoldDialog from '@/components/view/MoldDialog'
import { ReloadOutlined } from '@ant-design/icons-vue'
import { decodeConfigurationOperation, decodeConfigurationOperations } from '@/utils/storageConfigOperation'
export default {
  name: 'StorageConfigurationOperationPanel',
  components: { ATable: SharedFSTable, MoldDialog, ReloadOutlined },
  props: { operation: { type: Object, default: null }, history: Boolean, refreshing: Boolean, instanceid: { type: String, default: '' } },
  emits: ['refresh', 'resume'],
  data () { return { rows: [], historyReadComplete: false, selectedRefreshing: false, selectedRead: 0, loading: false, readFailed: false, selected: null, generation: 0 } },
  computed: {
    rollbackLabel () {
      return this.$t('label.storage.configuration.rollback.' + sharedfsRollbackKey(this.operation))
    },
    resultContext () {
      return this.$t(['COMMITTED', 'ROLLED_BACK'].includes(this.operation?.state)
        ? 'label.storage.configuration.recent.result' : 'label.storage.configuration.current.operation')
    },
    blockedProtocol () {
      const failure = this.operation?.originalfailure
      if (failure?.phase !== 'PREFLIGHT') return ''
      return ['NFS', 'SMB', 'ISCSI', 'NVME_OF'].includes(failure.protocol) ? failure.protocol : ''
    },
    additionalBlockingCodes () {
      const failure = this.operation?.originalfailure
      const codes = failure?.blockingcodes
      if (failure?.phase !== 'PREFLIGHT' || !Array.isArray(codes)) return []
      return Array.from(new Set(codes.filter(code => typeof code === 'string' &&
        /^[A-Z][A-Z0-9_]{1,127}$/.test(code) && code !== failure.code)))
    },
    firstChildCode () {
      const code = this.operation?.originalfailure?.detail?.code
      return typeof code === 'string' && /^[A-Z][A-Z0-9_]{1,127}$/.test(code) ? code : ''
    },
    columns () {
      return [
        { title: this.$t('label.created'), dataIndex: 'created', key: 'created' },
        { title: this.$t('label.protocol'), dataIndex: 'protocol', key: 'protocol' },
        { title: this.$t('label.state'), key: 'state' },
        { title: this.$t('label.details'), key: 'details' }
      ]
    },
    alertType () { return this.operation?.state === 'COMMITTED' ? 'success' : this.operation?.state === 'ROLLED_BACK' ? 'warning' : 'info' },
    listenerPreparationFailed () {
      return this.operation?.originalfailure?.phase === 'VALIDATING' && this.operation.originalfailure.stage === 'ISCSI_LISTENER_REMOVE'
    },
    preparationReason () {
      const code = this.operation?.originalfailure?.code
      return this.listenerPreparationFailed && [
        'ISCSI_LISTENER_INVALID_ADDRESS', 'ISCSI_LISTENER_INVALID_PORT', 'ISCSI_LISTENER_NOT_FOUND',
        'ISCSI_LISTENER_IDENTITY_AMBIGUOUS', 'ISCSI_LISTENER_IN_USE'
      ].includes(code) ? this.$t('message.storage.configuration.reason.' + code.toLowerCase()) : ''
    },
    directoryPreparationFailed () { return this.operation?.originalfailure?.phase === 'VALIDATING' && this.operation.originalfailure.stage === 'DIRECTORY_POLICY_INSPECT' },
    alertMessage () {
      if (this.directoryPreparationFailed || this.listenerPreparationFailed) return this.$t('label.storage.configuration.preparation.failed')
      return this.operation?.originalfailure?.phase === 'PREFLIGHT' ? this.$t('label.storage.preflight.blocked') : this.stateLabel(this.operation?.state)
    },
    descriptionKey () {
      if (this.listenerPreparationFailed) return 'listener.preparation.failed'
      if (this.directoryPreparationFailed) return 'preparation.failed'
      if (this.operation?.originalfailure?.phase === 'PREFLIGHT') return 'preflight.blocked'
      if (this.operation?.originalfailure?.phase === 'DISPATCH' && this.operation.originalfailure.started === false) return 'dispatch.not.started'
      if (this.operation?.state === 'ROLLED_BACK') return 'rolled.back'
      if (this.operation?.state === 'COMMITTED') return 'committed'
      if (['RECOVERY_REQUIRED', 'OBSERVATION_UNAVAILABLE', 'SUBMISSION_UNCONFIRMED'].includes(this.operation?.state)) return 'recovery.required'
      return 'pending'
    }
  },
  watch: { instanceid: { immediate: true, handler () { this.generation++; this.rows = []; this.historyReadComplete = false; this.selectedRead++; this.selectedRefreshing = false; this.selected = null; if (this.history && this.instanceid) this.loadHistory() } } },
  beforeUnmount () { this.generation++ },
  methods: {
    operationDate (value) {
      const input = sharedfsDateInput(value)
      return input ? this.$toLocaleDate(input) : '—'
    },
    executionTime (value) { return value ? new Date(Number(value) * 1000).toLocaleString() : '-' },
    stateLabel (state) { return this.$t('label.storage.configuration.state.' + String(state || 'QUEUED').toLowerCase()) },
    phaseLabel (phase) { return this.$t('label.storage.configuration.phase.' + String(phase || 'PREPARING').toLowerCase()) },
    async loadHistory () {
      const generation = ++this.generation
      this.loading = true
      try {
        const wire = await getAPI('listStorageServiceConfigurationOperations', { instanceid: this.instanceid, page: 1, pagesize: 200 })
        if (generation !== this.generation) return
        this.rows = decodeConfigurationOperations(wire); this.readFailed = false
      } catch (error) { if (generation === this.generation) this.readFailed = true } finally { if (generation === this.generation) { this.loading = false; this.historyReadComplete = true } }
    },
    async refreshSelected () {
      if (!this.selected || this.selectedRefreshing) return
      const read = ++this.selectedRead
      this.selectedRefreshing = true
      const id = this.selected.id; const generation = this.generation
      try {
        const wire = await getAPI('getStorageServiceConfigurationOperation', { instanceid: this.instanceid, id })
        if (generation === this.generation && this.selected?.id === id) this.selected = decodeConfigurationOperation(wire) || this.selected
      } catch (error) { if (this.selected?.id === id) this.selected = { ...this.selected, observationwarning: true } } finally { if (read === this.selectedRead) this.selectedRefreshing = false }
    }
  }
}
</script>
<style scoped>
.storage-configuration-operation { color: var(--ui-text-primary); min-width: 0; }
.storage-configuration-operation__context { color: var(--ui-text-secondary); margin: 0 0 12px; overflow-wrap: anywhere; }
.storage-configuration-operation__summary { margin-top: 16px; }
.storage-configuration-operation__reason { display: block; margin-top: 8px; }
.storage-configuration-operation__toolbar { margin-top: 16px; }
.storage-configuration-operation code { overflow-wrap: anywhere; color: inherit; }
.storage-configuration-operation :deep(.ant-descriptions-item-label),
.storage-configuration-operation :deep(.ant-descriptions-item-content) { color: var(--ui-text-primary); }
</style>
