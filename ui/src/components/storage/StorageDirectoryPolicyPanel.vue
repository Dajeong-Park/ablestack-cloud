<!-- Licensed to the Apache Software Foundation (ASF) under one or more
contributor license agreements. See NOTICE. Apache License, Version 2.0.
http://www.apache.org/licenses/LICENSE-2.0 -->
<template>
  <div class="shared-directory-policy">
    <div class="toolbar">
      <a-button type="primary" :disabled="guarded" @click="beginRegistration"><PlusOutlined />{{ $t('label.storage.directory.register') }}</a-button>
      <a-button :loading="loading" @click="load"><template #icon><ReloadOutlined /></template>{{ $t('label.refresh') }}</a-button>
    </div>
    <a-alert type="info" show-icon :message="$t('message.storage.directory.single.owner')" :description="$t('message.storage.directory.protocol.separation')" />
    <a-alert v-if="error" type="error" show-icon :message="error" />
    <StorageConfigurationOperationPanel @refresh="$emit('refresh')" v-if="operation" :operation="operation" :refreshing="refreshing" @resume="$emit('resume', $event)" />
    <a-table :columns="columns" :data-source="rows" :loading="loading && !readComplete" :row-key="rowKey" size="small"  :scroll="{x:760}">
      <template #bodyCell="{column,record}">
        <template v-if="column.key==='posix'">{{ record.owneruid ?? record.observation?.owneruid ?? '-' }}:{{ record.ownergid ?? record.observation?.ownergid ?? '-' }} / {{ record.mode || record.observation?.mode || '-' }}</template>
        <template v-else-if="column.key==='setgid'">{{ $t(setgidEnabled(record.observation?.mode) === null ? 'label.unknown' : setgidEnabled(record.observation?.mode) ? 'label.storage.inheritance.enabled' : 'label.storage.inheritance.disabled') }}</template>
        <template v-else-if="column.key==='nfsacl'"><a-tag :color="record.observation?.nfsposixacl?.supported?'green':'orange'">{{ nfsAclStatus(record.observation?.nfsposixacl) }}</a-tag></template>
        <template v-else-if="column.key==='refs'"><a-tag v-for="ref in record.references || []" :key="ref.uuid">{{ ref.protocol }} · {{ ref.name }}</a-tag></template>
        <template v-else-if="column.key==='status'"><a-tag :color="record.observationstatus==='APPLIED'?'green':record.observationstatus==='UNREGISTERED'?'orange':'red'">{{ status(record.observationstatus) }}</a-tag></template>
        <template v-else-if="column.key==='action'">
          <a-space :size="8">
            <a-button size="small" :disabled="guarded || record.observation?.status!=='OBSERVED'" @click="open(record)"><EditOutlined />{{ $t(record.id?'label.edit':'label.storage.directory.register') }}</a-button>
            <a-dropdown v-if="record.id" :trigger="['click']">
              <a-button size="small" :disabled="guarded">{{ $t('label.actions') }}<DownOutlined /></a-button>
              <template #overlay>
                <a-menu>
                  <a-menu-item :disabled="record.observationstatus!=='APPLIED'" @click="sgidSelected=record">{{ $t('label.storage.inheritance.group.settings') }}</a-menu-item>
                  <a-menu-item :disabled="!record.posixacl?.managedEntries?.length" @click="open(record, 'remove')">{{ $t('label.storage.directory.acl.remove') }}</a-menu-item>
                  <a-menu-item :disabled="record.references?.length>0" @click="open(record, 'unregister')">{{ $t('label.storage.directory.unregister') }}</a-menu-item>
                </a-menu>
              </template>
            </a-dropdown>
          </a-space>
        </template>
      </template>
    </a-table>
    <MoldDialog class="sharedfs-standard-dialog" v-if="targetOpen" :visible="true" :title="$t('label.storage.directory.path.select')" size="lg" form-actions @cancel="targetOpen=false">
      <a-form layout="vertical">
        <a-form-item :label="$t('label.storage.directory.volume')"><a-select v-model:value="target.volumeid" :disabled="targetBusy"><a-select-option v-for="volume in volumes" :key="volume.id" :value="volume.id">{{ volume.name }} · {{ volume.provisioningtype }}</a-select-option></a-select></a-form-item>
        <a-form-item :label="$t('label.storage.directory.relative.path')"><a-input v-model:value="target.path" :disabled="targetBusy" placeholder="export/team/docs" /></a-form-item>
        <a-alert type="info" show-icon :message="$t('message.storage.directory.path.inspect')" />
        <a-alert v-if="targetError" class="spaced" type="error" show-icon :message="targetError" />
      </a-form>
      <MoldDialogActions :busy="targetBusy"><a-button @click="targetOpen=false">{{ $t('label.cancel') }}</a-button><a-button type="primary" :loading="targetBusy" :disabled="!target.volumeid || !target.path || guarded" @click="inspectTarget">{{ $t('label.storage.directory.path.inspect') }}</a-button></MoldDialogActions>
    </MoldDialog>
    <StorageDirectorySetgidDialog v-if="sgidSelected" :row="sgidSelected" :instance="instance" :guarded="guarded" :execute="execute" @close="sgidSelected=null" @done="setgidDone" />
    <MoldDialog
class="sharedfs-standard-dialog directory-policy-dialog"
v-if="selected"
:visible="true"
:title="$t(draft.unregister?'label.storage.directory.unregister':aclRemoval?'label.storage.directory.acl.remove':selected.id?'label.storage.directory.edit':'label.storage.directory.register')"
size="xl"

form-actions
focus-guard
@cancel="close">
      <a-form layout="vertical">
        <a-form-item v-if="!selected.id" :label="$t('label.storage.directory.path')">
          <a-select :value="rowKey(selected)" :disabled="busy || checking || guarded" @change="selectUnregistered">
            <a-select-option v-for="row in unregistered" :key="rowKey(row)" :value="rowKey(row)">{{ row.path }} · {{ row.volumeid }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-descriptions :column="1" bordered size="small">
          <a-descriptions-item :label="$t('label.storage.directory.path')">{{ selected.path }}</a-descriptions-item>
          <a-descriptions-item :label="$t('label.storage.directory.volume')">{{ selected.volumeid }}</a-descriptions-item>
          <a-descriptions-item :label="$t('label.storage.directory.observed')">{{ selected.observation?.owneruid }}:{{ selected.observation?.ownergid }} / {{ selected.observation?.mode }}</a-descriptions-item>
          <a-descriptions-item v-if="selected.id" :label="$t('label.storage.directory.desired')">{{ selected.owneruid }}:{{ selected.ownergid }} / {{ selected.mode }} · #{{ selected.policyrevision }}</a-descriptions-item>
        </a-descriptions>
        <a-alert v-if="!selected.id" class="spaced" type="info" show-icon :message="$t('message.storage.directory.adopt')" :description="$t('message.storage.directory.no.recommendations')" />
        <a-alert v-if="selected.observationstatus==='DRIFT'" class="spaced" type="warning" show-icon :message="$t('message.storage.directory.drift')" />
        <template v-if="selected.id && !draft.unregister && !aclRemoval">
          <a-row :gutter="16" class="spaced">
            <a-col :span="8"><a-form-item :label="$t('label.storage.service.owner.uid')"><a-input-number v-model:value="draft.owneruid" :disabled="busy || checking || guarded" :min="0" :max="4294967294" /></a-form-item></a-col>
            <a-col :span="8"><a-form-item :label="$t('label.storage.service.owner.gid')"><a-input-number v-model:value="draft.ownergid" :disabled="busy || checking || guarded" :min="0" :max="4294967294" /></a-form-item></a-col>
            <a-col :span="8"><a-form-item :label="$t('label.storage.directory.mode')"><a-input v-model:value="draft.mode" :disabled="busy || checking || guarded" placeholder="0770" /></a-form-item></a-col>
          </a-row>
          <a-form-item :label="$t('label.storage.directory.recursive')"><a-switch v-model:checked="draft.recursive" :disabled="busy || checking || guarded || draft.aclChanges?.entries?.length>0" /><span class="switch-label">{{ $t(draft.recursive?'message.storage.directory.recursive':'message.storage.directory.root.only') }}</span></a-form-item>
        </template>
        <StoragePosixAclFields v-if="selected.id && !draft.unregister && !aclRemoval" v-model:value="draft.aclChanges" :observation="selected.observation" :disabled="busy || checking || guarded || draft.recursive" />
        <a-alert v-if="draft.unregister" class="spaced" type="warning" show-icon :message="$t('message.storage.directory.unregister')" />
        <template v-if="aclRemoval">
          <a-alert type="warning" show-icon :message="$t('message.storage.directory.acl.remove')" />
          <a-form-item :label="$t('label.storage.directory.acl.remove')">
            <a-select v-model:value="removeKeys" mode="multiple" :disabled="busy || checking || guarded">
              <a-select-option v-for="entry in selected.posixacl?.managedEntries || []" :key="aclEntryKey(entry)" :value="aclEntryKey(entry)">{{ entry.scope }} · {{ entry.tag }} · {{ entry.id }}</a-select-option>
            </a-select>
          </a-form-item>
          <a-checkbox v-model:checked="removeAck" :disabled="busy || checking">{{ $t('message.storage.directory.acl.remove.confirm') }}</a-checkbox>
        </template>
        <div class="section-heading">{{ $t('label.storage.directory.references') }}</div>
        <a-table :columns="referenceColumns" :data-source="selected.references || []" row-key="uuid"  size="small" />
        <template v-if="report">
          <a-alert v-if="blockingMessage" class="spaced" type="error" show-icon :message="blockingMessage" />
          <a-descriptions v-if="report.directorypreview" :column="1" bordered size="small" class="spaced">
            <a-descriptions-item :label="$t('label.storage.directory.after')">{{ afterSummary }}</a-descriptions-item>
            <a-descriptions-item :label="$t('label.storage.directory.entries')">{{ report.directorypreview.entrycount }}</a-descriptions-item>
            <a-descriptions-item v-if="smbReadinessMode" :label="$t('label.storage.directory.smb.readiness')">{{ $t('label.storage.directory.smb.' + smbReadinessMode) }}</a-descriptions-item>
            <a-descriptions-item :label="$t('label.storage.directory.nfs.impact')">{{ selected.id ? (report.directorypreview.units || []).map(u=>u.port).join(', ') || '-' : $t('message.storage.directory.no.restart') }}</a-descriptions-item>
            <a-descriptions-item :label="$t('label.storage.directory.unit.references')">{{ (report.directorypreview.unitreferences || []).map(r=>r.name).join(', ') || '-' }}</a-descriptions-item>
          </a-descriptions>
          <template v-if="report.directorypreview?.aclimpact?.count">
            <div class="section-heading">{{ $t('label.storage.directory.acl.impact') }} · {{ report.directorypreview.aclimpact.count }}</div>
            <a-table :columns="aclColumns" :data-source="report.directorypreview.aclimpact.changes" :row-key="r=>r.path+':'+r.principal"  size="small" />
            <p v-if="report.directorypreview.aclimpact.truncated">{{ $t('message.storage.directory.acl.truncated') }}</p>
          </template>
          <a-table v-if="report.directorypreview?.after?.principalBindings?.length" class="spaced" :columns="principalColumns" :data-source="report.directorypreview.after.principalBindings" :row-key="r=>r.principalType+':'+r.principal"  size="small" />
          <a-table v-if="aclPreviewRows.length" class="spaced" :columns="aclPreviewColumns" :data-source="aclPreviewRows" :row-key="r=>r.scope+':'+r.principal"  size="small" />
          <SmbPublicationNotice :report="report" />
          <StorageConfigurationPreflightPanel class="spaced" :report="report" :loading="checking" :acknowledged="ack" @refresh="check" @acknowledge="ack=$event" />
        </template>
        <a-alert v-if="modalError" class="spaced" type="error" show-icon :message="modalError" />
        <a-alert class="spaced" type="info" show-icon :message="$t('message.storage.directory.rollback')" />
      </a-form>
      <MoldDialogActions :busy="busy">
        <a-button :disabled="busy" @click="close">{{ $t('label.cancel') }}</a-button>
        <a-button v-if="report" :disabled="busy || checking" @click="invalidate">{{ $t('label.storage.directory.recheck') }}</a-button>
        <a-button type="primary" :loading="busy || checking" :disabled="guarded || !dirty || (report && !applicable)" @click="report ? apply() : check()">{{ $t(report ? 'label.storage.preflight.apply':'label.storage.preflight.check') }}</a-button>
      </MoldDialogActions>
    </MoldDialog>
  </div>
</template>
<script>
import SharedFSTable from '@/components/storage/SharedFSTable.vue'
import { getAPI, postAPI } from '@/api'
import { PlusOutlined, ReloadOutlined, EditOutlined, DownOutlined } from '@ant-design/icons-vue'
import SmbPublicationNotice from '@/components/storage/SmbPublicationNotice'
import MoldDialog from '@/components/view/MoldDialog'
import MoldDialogActions from '@/components/view/MoldDialogActions'
import StorageConfigurationOperationPanel from '@/components/storage/StorageConfigurationOperationPanel'
import StorageConfigurationPreflightPanel from '@/components/storage/StorageConfigurationPreflightPanel'
import { decodeConfigurationPreflight, preflightApplicable, configurationPreflightFailure } from '@/utils/storageConfigPreflight'
import { directoryIntent, directoryParameters } from '@/utils/sharedDirectoryPolicy'
import { setgidEnabled } from '@/utils/smbParentInheritance'
import StorageDirectorySetgidDialog from '@/components/storage/StorageDirectorySetgidDialog'
import StoragePosixAclFields from '@/components/storage/StoragePosixAclFields'
export default {
  name: 'StorageDirectoryPolicyPanel',
  components: { ATable: SharedFSTable, StoragePosixAclFields, SmbPublicationNotice, StorageDirectorySetgidDialog, PlusOutlined, ReloadOutlined, EditOutlined, DownOutlined, MoldDialog, MoldDialogActions, StorageConfigurationOperationPanel, StorageConfigurationPreflightPanel },
  props: { instance: { type: Object, required: true }, execute: { type: Function, required: true }, guarded: Boolean, operation: Object, refreshing: Boolean, refreshToken: Number },
  emits: ['refresh', 'loaded', 'resume'],
  data () { return { targetOpen: false, target: {}, volumes: [], targetBusy: false, targetError: '', aclRemoval: false, removeKeys: [], removeAck: false, rows: [], sgidSelected: null, readComplete: false, loading: false, error: '', selected: null, draft: {}, report: null, ack: false, checking: false, busy: false, modalError: '', read: 0, generation: 0, expiry: null, disposed: false } },
  computed: {
    unregistered () { return this.rows.filter(row => !row.id && row.observation?.status === 'OBSERVED') },
    dirty () { if (!this.selected) return false; if (!this.selected.id || this.draft.unregister) return true; try { const intent = directoryIntent(this.selected, this.draft); return Object.keys(intent.posixchanges || {}).length > 0 || Boolean(intent.aclchanges) } catch (error) { return false } },
    applicable () { return preflightApplicable(this.report, this.ack) && (!this.aclRemoval || this.removeAck) },
    blockingMessage () {
      const messages = { DIRECTORY_ACL_MASK_CONFLICT: 'mask.conflict', DIRECTORY_POLICY_STALE: 'stale', DIRECTORY_IDENTITY_CHANGED: 'identity.changed', DIRECTORY_POLICY_REQUIRED: 'registration.required', DIRECTORY_NFS_POSIX_ACL_UNSUPPORTED: 'nfs.acl.unsupported', DIRECTORY_NFS_POSIX_ACL_UNAVAILABLE: 'nfs.acl.unavailable' }
      const code = this.report?.checks?.find(value => value.blocking)?.code
      return messages[code] ? this.$t('message.storage.directory.' + messages[code]) : ''
    },
    smbReadinessMode () {
      const mode = this.report?.directorypreview?.smbreadiness?.mode
      return ['IMPLICIT_LEGACY', 'MANAGED'].includes(mode) ? mode.toLowerCase() : ''
    },
    afterSummary () { const p = this.report?.directorypreview?.after || {}; return `${p.owneruid ?? '-'}:${p.ownergid ?? '-'} / ${p.mode || '-'}` },
    columns () {
      return [
        { title: this.$t('label.storage.directory.path'), dataIndex: 'path', width: 170 },
        { title: this.$t('label.storage.directory.desired'), key: 'posix', width: 150 },
        { title: this.$t('label.storage.inheritance.group'), key: 'setgid', width: 110 },
        { title: this.$t('label.storage.directory.nfs.acl.support'), key: 'nfsacl', width: 150 },
        { title: this.$t('label.storage.directory.references'), key: 'refs', width: 160 },
        { title: this.$t('label.storage.directory.revision'), dataIndex: 'policyrevision', width: 120 },
        { title: this.$t('label.state'), key: 'status', width: 100 },
        { title: this.$t('label.actions'), key: 'action', width: 260 }
      ]
    },
    aclColumns () { return [{ title: this.$t('label.storage.directory.path'), dataIndex: 'path' }, { title: this.$t('label.storage.service.principal'), dataIndex: 'principal' }, { title: this.$t('label.storage.directory.observed'), dataIndex: 'before' }, { title: this.$t('label.storage.directory.after'), dataIndex: 'after' }] },
    aclPreviewColumns () { return [{ title: this.$t('label.storage.directory.acl.scope'), dataIndex: 'scope' }, { title: this.$t('label.storage.service.principal'), dataIndex: 'principal' }, { title: this.$t('label.storage.directory.observed'), dataIndex: 'before' }, { title: this.$t('label.storage.directory.after'), dataIndex: 'after' }, { title: this.$t('label.storage.directory.acl.effective'), dataIndex: 'effective' }] },
    aclPreviewRows () {
      const policy = this.report?.directorypreview?.after
      if (!policy?.aclPolicyVersion) return []
      const rows = []
      for (const [scope, key] of [['ACCESS', 'accessAcl'], ['DEFAULT', 'defaultAcl']]) {
        const entries = policy[key] || []
        const mask = entries.find(e => e.tag === 'mask')?.permissions || 'rwx'
        for (const entry of entries) {
          const before = (this.selected?.observation?.[key] || []).find(e => e.tag === entry.tag && e.id === entry.id)
          const masked = entry.tag === 'group' || Boolean(entry.id)
          const effective = entry.permissions.split('').map((c, i) => masked && mask[i] === '-' ? '-' : c).join('')
          rows.push({ scope, principal: entry.tag + ':' + (entry.id || ''), before: before?.permissions || '-', after: entry.permissions, effective })
        }
      }
      return rows
    },
    principalColumns () { return [{ title: this.$t('label.storage.directory.acl.kind'), dataIndex: 'principalType' }, { title: this.$t('label.storage.service.principal'), dataIndex: 'principal' }, { title: 'UID / GID', dataIndex: 'id' }] },
    referenceColumns () { return [{ title: this.$t('label.name'), dataIndex: 'name' }, { title: this.$t('label.protocol'), dataIndex: 'protocol' }] }
  },
  watch: {
    'instance.id': { immediate: true, handler () { this.generation++; this.rows = []; this.readComplete = false; this.selected = null; this.sgidSelected = null; this.targetOpen = false; this.checking = false; this.busy = false; this.invalidate(); this.load() } },
    refreshToken () { if (!this.busy) this.load() },
    removeKeys () {
      this.draft.aclChanges = {
        version: 1,
        entries: this.removeKeys.map(key => {
          const [scope, tag, id] = key.split(':')
          return { action: 'REMOVE', scope, principalType: tag === 'user' ? 'UID' : 'GID', principal: id }
        })
      }
      this.removeAck = false
    },
    draft: { deep: true, handler () { this.invalidate() } }
  },
  beforeUnmount () { this.disposed = true; this.read++; this.generation++; clearTimeout(this.expiry) },
  methods: {
    setgidEnabled,
    nfsAclStatus (support) {
      if (support?.status === 'NOT_APPLICABLE') return this.$t('label.storage.directory.nfs.acl.not.applicable')
      if (support?.status === 'BLOCKED') return this.$t('label.storage.directory.nfs.acl.unsupported')
      return support?.supported ? this.$t('label.storage.directory.nfs.acl.ready') + ' · ' + support.version : this.$t('label.storage.directory.nfs.acl.unverified')
    },
    aclEntryKey (entry) { return entry.scope + ':' + entry.tag + ':' + entry.id },
    async beginRegistration () {
      if (this.guarded) return
      const id = this.instance.id; const generation = this.generation
      this.target = {}; this.targetError = ''; this.targetOpen = true; this.targetBusy = true
      try {
        const wire = await getAPI('listVolumes', { virtualmachineid: this.instance.virtualmachineid, listall: true, listsystemvms: true }, { preserveOnFailure: true })
        if (generation !== this.generation || id !== this.instance.id) return
        this.volumes = (wire.listvolumesresponse?.volume || []).filter(v => v.type === 'DATADISK' && v.state === 'Ready')
        this.target.volumeid = this.volumes[0]?.id
      } catch (error) { this.targetError = this.errorText(error) } finally { this.targetBusy = false }
    },
    async inspectTarget () {
      if (this.targetBusy || this.guarded) return
      const id = this.instance.id; const generation = this.generation
      const target = { ...this.target }
      this.targetBusy = true; this.targetError = ''
      try {
        const wire = await getAPI('listStorageDirectoryPolicies', { instanceid: id, volumeid: target.volumeid, path: target.path, page: 1, pagesize: 500 }, { preserveOnFailure: true })
        if (generation !== this.generation || id !== this.instance.id) return
        const relative = '/' + target.path.replace(/^\//, '')
        const row = (wire.liststoragedirectorypoliciesresponse?.directorypolicy || []).find(r => r.volumeid === target.volumeid && r.path === relative)
        if (!row || row.observation?.status !== 'OBSERVED') throw new Error('DIRECTORY_OBSERVATION_UNAVAILABLE')
        if (!this.rows.some(r => this.rowKey(r) === this.rowKey(row))) this.rows.push(row)
        this.targetOpen = false; this.open(row)
      } catch (error) { this.targetError = this.errorText(error) } finally { this.targetBusy = false }
    },
    setgidDone () { this.sgidSelected = null; this.load() },
    rowKey (row) { return row.id || `${row.volumeid}:${row.path}` },
    status (value) { return this.$t('label.storage.directory.' + String(value || 'UNAVAILABLE').toLowerCase()) },
    invalidate () { clearTimeout(this.expiry); this.report = null; this.ack = false },
    close () { if (this.busy) return; this.generation++; this.selected = null; this.invalidate(); this.modalError = '' },
    open (row, mode = 'edit') {
      if (this.guarded || row?.observation?.status !== 'OBSERVED') return
      this.generation++; this.selected = row; this.modalError = ''; this.invalidate()
      const actual = row.observation || {}
      this.aclRemoval = mode === 'remove'; this.removeKeys = []; this.removeAck = false
      this.draft = { owneruid: actual.owneruid, ownergid: actual.ownergid, mode: actual.mode, recursive: false, unregister: mode === 'unregister', aclChanges: { version: 1, entries: [] } }
    },
    selectUnregistered (key) { this.open(this.unregistered.find(row => this.rowKey(row) === key)) },
    async load () {
      const id = this.instance?.id; if (!id) return
      const read = ++this.read; this.loading = true; this.error = ''
      try {
        const wire = await getAPI('listStorageDirectoryPolicies', { instanceid: id, page: 1, pagesize: 500 }, { timeout: 30000, preserveOnFailure: true })
        if (this.disposed || read !== this.read || id !== this.instance?.id) return
        this.rows = wire.liststoragedirectorypoliciesresponse?.directorypolicy || []
        this.$emit('loaded', this.rows)
      } catch (error) {
        if (!this.disposed && read === this.read) this.error = this.errorText(error)
      } finally { if (read === this.read) { this.loading = false; this.readComplete = true } }
    },
    errorText (error) {
      const raw = configurationPreflightFailure(error, this.instance.configurationrevision)?.checks?.find(c => c.message)?.message || error?.message || String(error)
      return String(raw).slice(0, 1200)
    },
    async check () {
      if (!this.selected || !this.dirty || this.checking || this.guarded || this.busy) return
      this.invalidate(); this.modalError = ''
      const generation = this.generation; const id = this.instance.id
      const intent = directoryIntent(this.selected, this.draft)
      this.checking = true
      try {
        const wire = await postAPI('preflightStorageServiceConfiguration', { instanceid: id, intent: JSON.stringify(intent) }, { timeout: 30000, preserveOnFailure: true })
        if (this.disposed || generation !== this.generation || id !== this.instance.id || !this.selected) return
        this.report = decodeConfigurationPreflight(wire)
        if (!this.report) throw new Error('Invalid directory preflight response')
        if (this.report.status === 'READY') {
          this.expiry = setTimeout(() => this.invalidate(), Math.max(0, Date.parse(this.report.expiresat) - Date.now()))
        }
      } catch (error) {
        if (!this.disposed && generation === this.generation) { this.modalError = this.errorText(error); this.report = configurationPreflightFailure(error, this.instance.configurationrevision) }
      } finally { if (generation === this.generation) this.checking = false }
    },
    async apply () {
      if (!this.applicable || this.guarded || this.busy || !this.selected) return
      const generation = this.generation; const row = this.selected
      this.busy = true; this.modalError = ''
      try {
        const api = this.draft.unregister ? 'deleteStorageDirectoryPolicy' : row.id ? 'updateStorageDirectoryPolicy' : 'createStorageDirectoryPolicy'
        const result = await this.execute(api, { instanceid: this.instance.id, ...directoryParameters(row, this.draft) }, this.report)
        if (this.disposed || generation !== this.generation) return
        if (result?.state === 'COMMITTED') { this.selected = null; this.invalidate(); await this.load() } else { this.invalidate(); this.modalError = result?.message || result?.originalfailure?.code || result?.state || 'CONFIGURATION_OBSERVATION_UNAVAILABLE' }
      } catch (error) { if (!this.disposed && generation === this.generation) this.modalError = this.errorText(error) } finally { if (generation === this.generation) this.busy = false }
    }
  }
}
</script>
<style scoped>
.shared-directory-policy { color: var(--ui-text-primary); }
.toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-bottom: 16px; }
.shared-directory-policy :deep(.ant-alert) { margin-bottom: 16px; }
.shared-directory-policy :deep(.ant-btn-primary) { background: #096dd9; border-color: #096dd9; color: #fff; }
:global(.directory-policy-dialog .ant-btn-primary) { background: #096dd9; border-color: #096dd9; color: #fff; }
.spaced { margin-top: 16px; }
.section-heading { font-weight: 600; margin: 16px 0 12px; color: var(--ui-text-primary); }
.switch-label { margin-left: 12px; color: var(--ui-text-secondary); }
:deep(.ant-input-number) { width: 100%; }
:deep(.ant-form-item) { margin-bottom: 16px; }
</style>
