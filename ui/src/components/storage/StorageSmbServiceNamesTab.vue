<!-- Licensed to the Apache Software Foundation (ASF) under one or more
contributor license agreements. See NOTICE. Apache License, Version 2.0.
http://www.apache.org/licenses/LICENSE-2.0 -->
<template>
  <div class="smb-service-names">
    <div class="toolbar">
      <a-button type="primary" :disabled="guarded || !ready" @click="open(null)"><PlusOutlined />서비스 이름 추가</a-button>
      <a-button :disabled="guarded || !ready || baseRegistered" @click="registerBase">기본 이름 등록</a-button>
      <a-button :loading="loading" @click="load"><template #icon><ReloadOutlined /></template>{{ $t('label.refresh') }}</a-button>
    </div>
    <a-alert type="info" show-icon message="기존 AD 컴퓨터 계정 하나에 서비스 이름을 연결합니다." description="이름 작업은 SMB 공유·접근 권한·파일 데이터를 변경하거나 서비스를 재시작하지 않습니다. 기본 Windows UNC는 445 포트를 사용합니다." />
    <a-alert v-if="error" type="error" show-icon :message="error" />
    <a-alert v-if="context && !ready" type="warning" show-icon :message="message(context.code || 'SMB_NAME_OBSERVATION_UNAVAILABLE')">
      <template v-if="context.code==='SMB_NAME_CAPABILITY_REQUIRED'" #action><a-button @click="$emit('runtime')">런타임 보기</a-button></template>
    </a-alert>
    <a-alert v-if="pendingEnrollment.length" type="warning" show-icon message="가입은 완료됐으며 등록할 이름이 남아 있습니다." :description="context.enrollment.namesFailureCode || context.enrollment.state">
      <template #action><a-space wrap><a-button v-for="name in pendingEnrollment" :key="name.fqdn" :disabled="guarded || !ready" @click="openPending(name)">{{ name.fqdn }} 등록</a-button></a-space></template>
    </a-alert>
    <a-descriptions v-if="context" bordered size="small" :column="2" class="spaced">
      <a-descriptions-item label="AD 도메인">{{ context.zone || '-' }}</a-descriptions-item>
      <a-descriptions-item label="기본 FQDN"><span class="break">{{ context.fqdn || '-' }}</span></a-descriptions-item>
      <a-descriptions-item label="컴퓨터 계정">{{ context.account || context.fqdn || '-' }}</a-descriptions-item>
      <a-descriptions-item label="이름 관측">{{ ready ? '관측 완료' : context.status || '알 수 없음' }}</a-descriptions-item>
    </a-descriptions>
    <StorageConfigurationOperationPanel @refresh="$emit('refresh')" v-if="operation" class="spaced" :operation="operation" :refreshing="refreshing" @resume="openRecovery" />
    <a-table
      class="spaced"
      :columns="columns"
      :data-source="rows"
      row-key="id"
      :loading="loading && !readComplete"
      :pagination="false"
      size="small"
      :scroll="{ x: 1060 }">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key==='name'"><a-button type="link" size="small" @click="open(record, 'view')">{{ record.fqdn }}</a-button><a-tag v-if="record.kind==='BASE'">기본</a-tag></template>
        <template v-else-if="column.key==='endpoint'">{{ record.ip }}:{{ record.port }}</template>
        <template v-else-if="column.key==='ownership'">
          <div>DNS A · {{ owned(record.ownership?.dns) }}</div><div>CIFS SPN · {{ owned(record.ownership?.spn) }}</div>
        </template>
        <template v-else-if="column.key==='status'"><a-tag :color="record.observation?.status==='MATCH' ? 'green' : 'orange'">{{ observationStatus(record) }}</a-tag><div v-if="record.observation?.code" class="break">{{ message(record.observation.code) }}</div></template>
        <template v-else-if="column.key==='action'"><a-space :size="8"><a-button size="small" :disabled="guarded || !ready" @click="open(record)"><EditOutlined />{{ $t('label.edit') }}</a-button><a-button size="small" danger :disabled="guarded || !ready" @click="open(record, 'delete')"><DeleteOutlined />{{ $t('label.delete') }}</a-button></a-space></template>
      </template>
    </a-table>
    <MoldDialog
class="sharedfs-standard-dialog"
v-if="selected"
:visible="true"
:title="title"
size="lg"
form-actions
focus-guard
@cancel="close">
      <a-form layout="vertical">
        <a-alert v-if="mode==='recovery'" type="warning" show-icon message="새 요청을 만들지 않고 같은 작업을 재관측·복구합니다." :description="recovery?.id" />
        <a-descriptions v-if="mode==='view'" :column="1" bordered size="small">
          <a-descriptions-item label="서비스 이름">{{ selected.fqdn }}</a-descriptions-item>
          <a-descriptions-item label="엔드포인트">{{ selected.ip }}:{{ selected.port }}</a-descriptions-item>
          <a-descriptions-item label="AD 컴퓨터 GUID"><span class="break">{{ selected.desired?.computerGuid }}</span></a-descriptions-item>
          <a-descriptions-item label="DNS 객체 GUID"><span class="break">{{ selected.ownership?.nodeGuid }}</span></a-descriptions-item>
          <a-descriptions-item label="DNS / SPN 소유권">{{ owned(selected.ownership?.dns) }} / {{ owned(selected.ownership?.spn) }}</a-descriptions-item>
        </a-descriptions>
        <template v-else>
          <template v-if="mode!=='recovery'">
            <a-form-item label="이름 유형"><a-input :value="draft.kind==='BASE' ? '기본 FQDN' : '서비스 별칭'" disabled /></a-form-item>
            <a-form-item label="FQDN" required><a-input v-model:value="draft.fqdn" :disabled="locked || mode==='delete' || draft.kind==='BASE'" :placeholder="'files.' + (context?.zone || 'example.local')" /></a-form-item>
            <a-form-item v-if="mode!=='delete'" label="SMB 엔드포인트">
              <a-select v-model:value="draft.endpointid" :disabled="locked">
                <a-select-option value="">주 IP · 기본 리스너</a-select-option>
                <a-select-option v-for="endpoint in availableEndpoints" :key="endpoint.id" :value="endpoint.id">{{ endpoint.listenip }}:{{ endpoint.port || 445 }}</a-select-option>
              </a-select>
            </a-form-item>
            <a-alert v-if="mode==='delete'" class="spaced" type="warning" show-icon message="이 서비스가 생성한 항목만 정리합니다." :description="'DNS A: ' + owned(selected.ownership?.dns) + ' / CIFS SPN: ' + owned(selected.ownership?.spn) + '. 재사용 항목과 기본 HOST SPN·컴퓨터 계정은 보존합니다.'" />
            <p v-if="mode==='delete'" class="secondary">이름 정리는 이미 발급된 Kerberos 티켓이나 기존 SMB 세션의 접근 철회를 대신하지 않습니다.</p>
          </template>
          <a-row :gutter="16" class="spaced">
            <a-col :span="12"><a-form-item label="일회성 AD 사용자" required><a-input v-model:value="draft.username" :disabled="locked" autocomplete="off" /></a-form-item></a-col>
            <a-col :span="12"><a-form-item label="일회성 AD 암호" required><a-input-password v-model:value="draft.password" :disabled="locked" autocomplete="new-password" /></a-form-item></a-col>
          </a-row>
          <p class="secondary">등록·정리 권한이 위임된 계정을 사용합니다. 인증정보는 이번 실행에만 사용하고 저장하지 않습니다.</p>
          <a-alert v-if="modalError" type="error" show-icon :message="modalError" />
          <template v-if="report && mode!=='recovery'">
            <a-alert v-if="report.status!=='READY'" class="spaced" type="error" show-icon :message="message(report.checks?.find(check=>check.blocking)?.code || 'SMB_NAME_OBSERVATION_UNAVAILABLE')" />
            <a-descriptions v-if="report.namespreview?.entry" :column="1" bordered size="small" class="spaced">
              <a-descriptions-item label="대상 FQDN">{{ report.namespreview.entry.entry?.fqdn }}</a-descriptions-item>
              <a-descriptions-item label="검증된 SMB 엔드포인트">{{ report.namespreview.entry.entry?.ip }}:{{ report.namespreview.entry.entry?.port }}</a-descriptions-item>
              <a-descriptions-item label="DNS A 처리">{{ owned(report.namespreview.entry.ownership?.dns) }}</a-descriptions-item>
              <a-descriptions-item label="CIFS SPN 처리">{{ owned(report.namespreview.entry.ownership?.spn) }}</a-descriptions-item>
              <a-descriptions-item label="적용 영향">공유·ACL·DATA 보존 · 서비스 재시작 없음</a-descriptions-item>
            </a-descriptions>
            <StorageConfigurationPreflightPanel class="spaced" :report="report" :loading="checking" :acknowledged="ack" @refresh="check" @acknowledge="ack=$event" />
          </template>
        </template>
      </a-form>
      <MoldDialogActions :busy="busy">
        <a-button @click="close">{{ $t(mode==='view' ? 'label.close' : 'label.cancel') }}</a-button>
        <template v-if="mode!=='view'">
          <a-button v-if="mode!=='recovery'" :loading="checking" :disabled="locked || !draft.fqdn" @click="check">사전 점검</a-button>
          <a-button type="primary" :loading="busy" :disabled="!canSubmit" @click="submit">{{ mode==='recovery' ? '같은 작업 복구' : $t('label.ok') }}</a-button>
        </template>
      </MoldDialogActions>
    </MoldDialog>
  </div>
</template>
<script>
import { PlusOutlined, ReloadOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons-vue'
import { getAPI, postAPI } from '@/api'
import MoldDialog from '@/components/view/MoldDialog'
import MoldDialogActions from '@/components/view/MoldDialogActions'
import StorageConfigurationPreflightPanel from '@/components/storage/StorageConfigurationPreflightPanel'
import StorageConfigurationOperationPanel from '@/components/storage/StorageConfigurationOperationPanel'
import { decodeConfigurationPreflight, preflightApplicable, configurationPreflightFailure } from '@/utils/storageConfigPreflight'
import { decodeSmbNameContext, decodeSmbNames, smbNameParameters, smbNameIntent, smbNameMessage } from '@/utils/storageSmbServiceNames'
export default {
  name: 'StorageSmbServiceNamesTab',
  components: { PlusOutlined, ReloadOutlined, EditOutlined, DeleteOutlined, MoldDialog, MoldDialogActions, StorageConfigurationPreflightPanel, StorageConfigurationOperationPanel },
  props: { instance: { type: Object, required: true }, endpoints: { type: Array, default: () => [] }, execute: { type: Function, required: true }, resume: Function, guarded: Boolean, operation: Object, refreshing: Boolean, refreshToken: Number },
  emits: ['refresh', 'runtime'],
  data () { return { rows: [], context: null, readComplete: false, loading: false, error: '', selected: null, mode: 'edit', draft: {}, report: null, ack: false, checking: false, busy: false, modalError: '', read: 0, generation: 0, disposed: false, expiry: null, recovery: null } },
  computed: {
    ready () { return !this.loading && !this.error && this.context?.status === 'OBSERVED' && !!this.context?.guid },
    pendingEnrollment () { return (this.context?.enrollment?.items || []).filter(name => !this.rows.some(row => row.fqdn === name.fqdn)) },
    baseRegistered () { return this.rows.some(row => row.fqdn === this.context?.fqdn) },
    availableEndpoints () { return this.endpoints.filter(row => String(row.protocol).toUpperCase() === 'SMB' && row.enabled !== false && String(row.state).toUpperCase() === 'READY' && row.listenip && row.listenip !== '0.0.0.0') },
    title () { return this.mode === 'view' ? '서비스 이름 정보' : this.mode === 'delete' ? '서비스 이름 삭제' : this.mode === 'recovery' ? '서비스 이름 작업 복구' : this.selected?.id ? '서비스 이름 편집' : '서비스 이름 추가' },
    publicSignature () { return JSON.stringify(this.selected ? smbNameIntent(this.mode, this.selected, this.draft) : {}) },
    locked () { return this.busy || this.checking || (this.guarded && this.mode !== 'recovery') },
    canSubmit () { return !!this.selected && !!this.draft.username && !!this.draft.password && !this.locked && (this.mode === 'recovery' ? !!this.recovery?.canresume : this.ready && preflightApplicable(this.report, this.ack)) },
    columns () { return [{ title: '서비스 이름', key: 'name', width: 280 }, { title: 'SMB 엔드포인트', key: 'endpoint', width: 170 }, { title: 'DNS / SPN 소유권', key: 'ownership', width: 180 }, { title: '관측', key: 'status', width: 200 }, { title: this.$t('label.actions'), key: 'action', width: 200 }] }
  },
  watch: {
    publicSignature () { this.invalidate() },
    refreshToken () { this.load() },
    'instance.id' () { this.generation++; this.read++; this.selected = null; this.draft = {}; this.recovery = null; this.busy = false; this.checking = false; this.modalError = ''; this.invalidate(); this.load() }
  },
  mounted () { this.load() },
  beforeUnmount () { this.disposed = true; this.read++; this.generation++; this.invalidate(); this.draft = {} },
  methods: {
    message: smbNameMessage,
    owned (value) { return value === 'CREATED' ? '생성·소유 항목' : value === 'REUSED' ? '기존 항목 재사용·보존' : '-' },
    observationStatus (row) { const state = row.observation?.status || row.observation?.state; return ({ MATCH: '설정 일치', VERIFIED: '마지막 검증 완료', DRIFT: '설정 차이', BLOCKED: '보호 차단', UNKNOWN: '확인 필요' })[state] || '관측 대기' },
    invalidate () { clearTimeout(this.expiry); this.report = null; this.ack = false },
    close () { if (this.busy || this.checking) return; this.generation++; this.selected = null; this.draft = {}; this.recovery = null; this.modalError = ''; this.invalidate() },
    open (row, mode = 'edit') {
      if (this.busy || this.checking || (this.guarded && mode !== 'view')) return
      this.generation++; this.invalidate(); this.selected = row || {}; this.mode = mode; this.modalError = ''
      this.draft = { fqdn: row?.fqdn || '', kind: row?.kind || 'ALIAS', endpointid: row?.endpointid || this.availableEndpoints.find(endpoint => Number(endpoint.port || 445) === 445)?.id || '', username: '', password: '' }
    },
    openPending (name) { this.open(null); if (this.selected) { this.draft.fqdn = name.fqdn; this.draft.endpointid = name.endpointid || '' } },
    registerBase () { this.open(null); if (this.selected) { this.draft.kind = 'BASE'; this.draft.fqdn = this.context.fqdn } },
    openRecovery (operation = this.operation) {
      if (!operation?.canresume || this.busy || this.checking) return
      this.generation++; this.invalidate(); this.selected = {}; this.mode = 'recovery'; this.recovery = operation
      this.draft = { username: '', password: '' }; this.modalError = ''
    },
    async load () {
      const read = ++this.read; const id = this.instance.id; this.loading = true; this.error = ''
      try {
        const [context, list] = await Promise.all([
          getAPI('getStorageSmbServiceNameContext', { instanceid: id }, { timeout: 30000, preserveOnFailure: true }),
          getAPI('listStorageSmbServiceNames', { instanceid: id, refresh: true, page: 1, pagesize: 32 }, { timeout: 30000, preserveOnFailure: true })
        ])
        if (this.disposed || read !== this.read || id !== this.instance.id) return
        this.context = decodeSmbNameContext(context)
        if (!this.context) throw new Error('SMB_NAME_CONTEXT_RESPONSE_INVALID')
        const rows = decodeSmbNames(list)
        if (rows.some(row => row.instanceid && row.instanceid !== id)) throw new Error('SMB_NAME_LIST_SCOPE_MISMATCH')
        this.rows = rows
      } catch (error) { if (!this.disposed && read === this.read) this.error = this.message(error) } finally { if (read === this.read) { this.loading = false; this.readComplete = true } }
    },
    async check () {
      if (!this.selected || this.locked) return
      this.invalidate(); this.modalError = ''; const generation = this.generation; const id = this.instance.id; this.checking = true
      const intent = smbNameIntent(this.mode, this.selected, this.draft)
      try {
        const wire = await postAPI('preflightStorageServiceConfiguration', { instanceid: id, intent: JSON.stringify(intent) }, { timeout: 30000, preserveOnFailure: true })
        if (this.disposed || generation !== this.generation || id !== this.instance.id) return
        this.report = decodeConfigurationPreflight(wire)
        if (!this.report) throw new Error('SMB_NAME_PREFLIGHT_RESPONSE_INVALID')
        if (this.report.status === 'READY') this.expiry = setTimeout(() => this.invalidate(), Math.max(0, Date.parse(this.report.expiresat) - Date.now()))
      } catch (error) { if (!this.disposed && generation === this.generation) { this.modalError = this.message(error); this.report = configurationPreflightFailure(error, this.instance.configurationrevision) } } finally { if (generation === this.generation) this.checking = false }
    },
    async submit () {
      if (!this.canSubmit) return
      const generation = this.generation; const id = this.instance.id; this.busy = true; this.modalError = ''
      const credentials = { username: this.draft.username, password: this.draft.password }
      try {
        let result
        if (this.mode === 'recovery') {
          result = await this.resume(this.recovery, credentials)
          if (this.disposed || generation !== this.generation || id !== this.instance.id) return
          this.draft.username = ''; this.draft.password = ''
          if (['COMMITTED', 'ROLLED_BACK'].includes(result?.state)) { this.busy = false; this.close(); await this.load() } else { this.modalError = this.message(result?.originalfailure?.code || result?.state || 'SMB_NAME_OBSERVATION_UNAVAILABLE') }
          return result
        }
        const intent = smbNameIntent(this.mode, this.selected, this.draft)
        result = await this.execute(intent.api, { instanceid: id, ...smbNameParameters(this.mode, this.selected, this.draft), ...credentials }, this.report)
        if (this.disposed || generation !== this.generation || id !== this.instance.id) return
        this.draft.username = ''; this.draft.password = ''
        if (result?.state === 'COMMITTED') { this.busy = false; this.close(); await this.load() } else { this.invalidate(); this.modalError = this.message(result?.originalfailure?.code || result?.message || result?.state) }
      } catch (error) { if (!this.disposed && generation === this.generation) this.modalError = this.message(error) } finally { if (generation === this.generation) this.busy = false }
    }
  }
}
</script>
<style scoped>
.smb-service-names { color: var(--ui-text-primary); }
.toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-bottom: 16px; }
.smb-service-names :deep(.ant-alert) { margin-bottom: 16px; }
.spaced { margin-top: 16px; }
.break { overflow-wrap: anywhere; }
.secondary { color: var(--ui-text-secondary); margin: 12px 0 16px; }
:deep(.ant-form-item) { margin-bottom: 16px; }
:deep(.ant-btn-primary) { background: #096dd9; border-color: #096dd9; color: #fff; }
</style>
