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
  <div :class="['form-layout', { 'form-list': operationKeys.length > 0 }]" v-ctrl-enter="handleSubmit">
    <section v-if="!showGroupActionModal" class="vm-delete-preflight" aria-live="polite">
      <a-alert type="info" show-icon :message="$t('message.vm.delete.preflight')" />
      <ul class="vm-delete-targets">
        <li v-for="row in guardRows" :key="row.id">
          <strong>{{ row.displayname || row.name || row.id }}</strong> <small>{{ row.id }}</small>
          <div>{{ $t('label.deleteprotection') }}: {{ $t('label.vm.protection.' + (row.readFailed ? 'failed' : vmProtection(row.record))) }}</div>
          <div v-if="row.reason" class="vm-delete-reason">{{ $t(row.reason) }}</div>
          <a-button v-if="operationKeys.length > 1" size="small" :disabled="checking || operationStarted" @click="excludeTarget(row.id)">{{ $t('label.vm.delete.exclude') }}</a-button>
        </li>
      </ul>
      <a-alert v-if="submissionError" type="error" show-icon :message="submissionError" />
      <a-button :loading="checking" :disabled="operationStarted || actionClosed" @click="refreshGuard">{{ $t('label.vm.delete.recheck') }}</a-button>
      <p>{{ $t('message.vm.delete.edit') }}</p>
      <p v-if="operationStarted">{{ $t('message.vm.delete.tracking') }}</p>
    </section>
    <div v-if="operationKeys.length === 0">
      <a-alert type="warning">
        <template #message>
          <span v-html="isExpunge ? $t(resource.backupofferingid ? 'message.action.expunge.instance.with.backups' : 'message.action.expunge.instance') : $t(resource.backupofferingid ? 'message.action.destroy.instance.with.backups' : 'message.action.destroy.instance')"></span>
        </template>
      </a-alert>
      <br/>
      <a-spin :spinning="loading">
        <a-form
          :model="form"
          :ref="formRef"
          :rules="rules"
          @finish="handleSubmit"
          layout="vertical">
          <a-form-item
            name="expunge"
            ref="expunge"
            v-if="!isExpunge && 'expungeVirtualMachine' in $store.getters.apis && ($store.getters.userInfo.roletype === 'Admin' || $store.getters.features.allowuserexpungerecovervm)">
            <template #label>
              <tooltip-label :title="$t('label.expunge')" :tooltip="apiParams.expunge.description"/>
            </template>
            <a-switch v-model:checked="form.expunge" v-focus="true" />
          </a-form-item>

          <a-form-item v-if="!isExpunge && volumes.length > 0" name="volumeids" ref="volumeids">
            <template #label>
              <tooltip-label :title="$t('label.delete.volumes')" :tooltip="apiParams.volumeids.description"/>
            </template>
            <a-select
              v-model:value="form.volumeids"
              :placeholder="$t('label.delete.volumes')"
              mode="multiple"
              :loading="loading"
              v-focus="$store.getters.userInfo.roletype !== 'Admin' && !$store.getters.features.allowuserexpungerecovervm"
              showSearch
              optionFilterProp="label"
              :filterOption="(input, option) => {
                return option.label.toLowerCase().indexOf(input.toLowerCase()) >= 0
              }" >
              <a-select-option v-for="volume in volumes" :key="volume.id" :label="volume.name">
                {{ volume.name }}
              </a-select-option>
            </a-select>
          </a-form-item>
          <p v-else-if="!isExpunge" v-html="$t('label.volume.empty')" />
          <div v-for="offering in diskOffering" :key="offering.id">
              <a-alert v-if="offering.shareable===true"  type="error">
                <template #message>
                  <span v-html="$t('message.action.destroy.instance.shareable')"></span>
                </template>
              </a-alert>
          </div>
          <div :span="24" class="action-button">
            <a-button @click="closeAction">{{ $t(operationStarted ? 'label.close' : 'label.cancel') }}</a-button>
            <a-button :loading="loading || checking" :disabled="!canSubmit" ref="submit" type="primary" @click="handleSubmit">{{ $t('label.ok') }}</a-button>
          </div>
        </a-form>
      </a-spin>
    </div>
    <div v-else>
      <div v-if="!showGroupActionModal">
        <div>
          <a-alert type="error">
            <message-outlined type="exclamation-circle" style="color: red; fontSize: 30px; display: inline-flex" />
            <template #message>
              <span style="padding-left: 5px" v-html="`<b>${operationKeys.length} ` + $t('label.items.selected') + `. </b>&nbsp`" />
              <span v-html="$t(typeof currentAction.message === 'function' ? currentAction.message(resource) : currentAction.message)" />
            </template>
          </a-alert>
        </div>
        <div v-if="operationKeys.length > 0" class="row-keys">
          <a-divider />
          <a-form layout="vertical">
            <a-table
              v-if="operationKeys.length > 0"
              size="middle"
              :columns="chosenColumns"
              :dataSource="operationItems"
              :rowKey="(record, idx) => record.id || record.name || record.usageType || idx + '-' + Math.random()"
              :pagination="true"
              style="overflow-y: auto"
            >
              <template
                #expandedRowRender="{ record } "
                style="margin: 0">
                <a-form-item :label="$t('label.delete.volumes')" v-if="!isExpunge && listVolumes[record.id]?.opts.length > 0">
                  <a-select
                    mode="multiple"
                    showSearch
                    optionFilterProp="label"
                    :filterOption="(input, option) => {
                      return option.label.toLowerCase().indexOf(input.toLowerCase()) >= 0
                    }"
                    :loading="listVolumes[record.id].loading"
                    :placeholder="$t('label.delete.volumes')"
                    @change="(value) => onChangeVolume(record.id, value)">
                    <a-select-option v-for="item in listVolumes[record.id].opts" :key="item.id" :label="item.name || item.description">
                      {{ item.name || item.description }}
                    </a-select-option>
                  </a-select>
                </a-form-item>
                <span v-else v-html="$t('label.volume.empty')" />
              </template>
            </a-table>
            <a-form-item v-if="!isExpunge && ($store.getters.userInfo.roletype === 'Admin' || $store.getters.features.allowuserexpungerecovervm)">
              <template #label>
                <tooltip-label :title="$t('label.expunge')" :tooltip="apiParams.expunge.description"/>
              </template>
              <a-switch v-model:checked="expunge" v-focus="true" />
            </a-form-item>
          </a-form>
        </div>

        <div :span="24" class="action-button">
          <a-button @click="closeAction">{{ $t(operationStarted ? 'label.close' : 'label.cancel') }}</a-button>
          <a-button :loading="loading || checking" :disabled="!canSubmit" ref="submit" type="primary" @click="handleSubmit">{{ $t('label.ok') }}</a-button>
        </div>
      </div>
    </div>
    <bulk-action-progress
      :showGroupActionModal="showGroupActionModal"
      :selectedItems="selectedItemsProgress"
      :selectedColumns="selectedColumns"
      :message="modalInfo"
      @handle-cancel="handleCancel" />
  </div>
</template>

<script>
import { ref, reactive, toRaw } from 'vue'
import { getAPI, postAPI } from '@/api'
import TooltipLabel from '@/components/widgets/TooltipLabel'
import BulkActionProgress from '@/components/view/BulkActionProgress'
import { vmProtection, vmDeletionScope, vmDeletionReason, readVmDeletionTarget } from '@/utils/vmDeletion'

export default {
  name: 'DestroyVM',
  components: { TooltipLabel, BulkActionProgress },
  props: {
    resource: { type: Object, required: true },
    action: { type: Object, default: () => ({}) },
    selectedRowKeys: { type: Array, default: () => [] },
    selectedItems: { type: Array, default: () => [] },
    chosenColumns: { type: Array, default: () => [] }
  },
  inject: { parentFetchData: { default: () => () => {} }, resourceActionReady: { default: () => () => true } },
  data () {
    const bulk = this.action.currentAction?.invokedAsGroupAction ?? this.selectedRowKeys.length > 0
    const targets = (this.action.currentAction?.vmDeletionTargets || (bulk ? this.selectedItems : [this.resource])).map(row => ({ ...row }))
    return {
      deletionAction: { ...this.action.currentAction },
      operationKeys: bulk ? targets.map(row => row.id) : [],
      operationItems: targets,
      originScope: vmDeletionScope(this.$route, this.$store),
      guardRows: targets.map(row => ({ ...row, reason: 'message.vm.delete.checking' })),
      checking: false,
      checkGeneration: 0,
      operationStarted: false,
      actionClosed: false,
      submissionError: '',
      optionsError: false,
      volumes: [],
      diskOffering: [],
      loading: false,
      volumeIds: {},
      listVolumes: {},
      selectedColumns: [],
      selectedItemsProgress: [],
      showGroupActionModal: false,
      modalInfo: {},
      expunge: false
    }
  },
  computed: {
    currentAction () { return this.deletionAction },
    isExpunge () { return this.currentAction.api === 'expungeVirtualMachine' },
    contextKey () { return vmDeletionScope(this.$route, this.$store) },
    canSubmit () { return !this.loading && !this.checking && !this.operationStarted && !this.actionClosed && !this.optionsError && this.guardRows.length > 0 && this.guardRows.every(row => !row.reason) }
  },
  watch: {
    contextKey () { this.closeAction() },
    'resource.id' (id) { if (!this.operationKeys.length && id !== this.operationItems[0]?.id) this.closeAction() }
  },
  beforeCreate () { this.apiParams = this.$getApiParams('destroyVirtualMachine') },
  created () {
    this.formRef = ref()
    this.form = reactive({})
    this.rules = reactive({ volumeids: [{ type: 'array' }] })
    this.fetchData()
    this.refreshGuard()
  },
  deactivated () { this.actionClosed = true; this.checkGeneration++ },
  beforeUnmount () { this.actionClosed = true; this.checkGeneration++ },
  methods: {
    vmProtection,
    current () { return !this.actionClosed && this.deletionAction.vmDeletionCurrent?.() !== false && this.originScope === this.contextKey && this.resourceActionReady?.() !== false },
    async refreshGuard () {
      if (this.checking || this.operationStarted || !this.current()) return false
      if (this.optionsError) await this.fetchData()
      this.checking = true
      if (!this.optionsError) this.submissionError = ''
      const generation = ++this.checkGeneration
      const active = () => this.current() && generation === this.checkGeneration
      try {
        const rows = await Promise.all(this.operationItems.map(async target => {
          try {
            const record = await readVmDeletionTarget(target, this.$store, active)
            return { ...target, record, reason: vmDeletionReason(record, this.currentAction, this.$store.getters, this.isExpunge || this.expunge || this.form.expunge) }
          } catch (error) {
            return { ...target, readFailed: true, reason: error.message?.startsWith('message.vm.delete.') ? error.message : 'message.vm.delete.read.failed' }
          }
        }))
        if (!active()) return false
        this.guardRows = rows
        return rows.length > 0 && rows.every(row => !row.reason)
      } finally {
        if (generation === this.checkGeneration) this.checking = false
      }
    },
    excludeTarget (id) {
      if (this.operationStarted || this.checking || this.operationKeys.length < 2) return
      this.operationKeys = this.operationKeys.filter(key => key !== id)
      this.operationItems = this.operationItems.filter(row => row.id !== id)
      this.guardRows = this.guardRows.filter(row => row.id !== id)
    },
    async fetchData () {
      if (this.isExpunge) return
      this.loading = true
      this.optionsError = false
      try {
        const rows = await Promise.all(this.operationItems.map(row => this.callListVolume(row.id)))
        if (!this.current()) return
        rows.forEach(row => { this.listVolumes[row.id] = { loading: false, opts: row.volumes } })
        if (!this.operationKeys.length) {
          this.volumes = rows[0]?.volumes || []
          this.diskOffering = (await Promise.all([...new Set(this.volumes.map(row => row.diskofferingid).filter(Boolean))].map(id => getAPI('listDiskOfferings', { id }, { preserveOnFailure: true, timeout: 15000 })))).flatMap(json => json.listdiskofferingsresponse.diskoffering || [])
        }
      } catch (error) {
        if (this.current()) { this.optionsError = true; this.submissionError = this.$t('message.vm.delete.read.failed') }
      } finally { this.loading = false }
    },
    async callListVolume (vmId) {
      const json = await getAPI('listVolumes', { virtualMachineId: vmId, type: 'DATADISK', details: 'min', listall: true }, { preserveOnFailure: true, timeout: 15000 })
      return { id: vmId, volumes: json.listvolumesresponse.volume || [] }
    },
    onChangeVolume (vmId, volumes) { this.volumeIds[vmId] = volumes },
    handleCancel () {
      this.closeAction()
      this.$emit('cancel-bulk-action')
      this.showGroupActionModal = false
    },
    async handleSubmit (e) {
      if (e) e.preventDefault()
      if (!this.canSubmit || !this.current()) return
      if (!this.operationKeys.length) {
        try { await this.formRef.value.validate() } catch (error) { if (error.errorFields?.length) this.formRef.value.scrollToField(error.errorFields[0].name); return }
      }
      // Check the whole immutable selection before the first mutation.
      if (!await this.refreshGuard() || !this.current()) return
      if (this.operationKeys.length) return this.destroyGroupVMs(true)
      this.operationStarted = true
      this.loading = true
      const values = toRaw(this.form)
      const target = this.operationItems[0]
      const params = { id: target.id }
      if (!this.isExpunge && values.volumeids?.length) params.volumeids = values.volumeids.join(',')
      if (!this.isExpunge && values.expunge) params.expunge = true
      try {
        const jobId = await this.destroyVM(params)
        await this.trackJob(target, jobId)
      } catch (error) {
        if (this.current()) { this.$notifyError(error); this.submissionError = this.$t('message.vm.delete.request.failed'); await this.refreshAfterFailure(target); if (this.current()) this.parentFetchData() }
      } finally { this.loading = false }
    },
    async destroyVM (params) {
      if (!this.current()) throw new Error('message.vm.delete.context')
      const api = this.isExpunge ? 'expungeVirtualMachine' : 'destroyVirtualMachine'
      const json = await postAPI(api, params, { preserveOnFailure: true })
      const jobId = json?.[api.toLowerCase() + 'response']?.jobid
      if (!jobId) throw new Error('message.vm.delete.job.unknown')
      return jobId
    },
    async destroyGroupVMs (validated = false) {
      if (this.operationStarted || !this.current()) return
      if (!validated) return this.handleSubmit()
      this.operationStarted = true
      this.loading = true
      this.selectedColumns = [{ key: 'status', dataIndex: 'status', title: this.$t('label.operation.status') }, ...this.chosenColumns.filter(column => column.key !== 'status').map(column => ({ ...column })), { key: 'jobid', dataIndex: 'jobid', title: this.$t('label.id') }, { key: 'deletionreason', dataIndex: 'deletionreason', title: this.$t('label.deleteprotection') }]
      this.selectedItemsProgress = this.operationItems.map(row => ({ ...row, status: 'InProgress' }))
      this.showGroupActionModal = true
      this.modalInfo = { title: this.currentAction.label, docHelp: this.currentAction.docHelp }
      try {
        await Promise.allSettled(this.operationItems.map(target => {
          const params = { id: target.id }
          if (!this.isExpunge && this.volumeIds[target.id]?.length) params.volumeids = this.volumeIds[target.id].join(',')
          if (!this.isExpunge && this.expunge) params.expunge = true
          return this.callGroupApi(params)
        }))
      } finally {
        this.loading = false
        if (this.current()) this.parentFetchData()
      }
    },
    async callGroupApi (params) {
      const target = this.operationItems.find(row => row.id === params.id)
      try {
        const jobId = await this.destroyVM(params)
        this.updateResourceState(target.id, 'InProgress', jobId)
        await this.trackJob(target, jobId, true)
      } catch (error) {
        const rejected = Object.values(error.response?.data || {}).some(value => value?.errorcode) || (error.response?.status >= 400 && error.response.status < 500)
        this.updateResourceState(target.id, rejected ? 'failed' : 'unknown')
        const row = this.selectedItemsProgress.find(row => row.id === target.id)
        if (row && !rejected) row.deletionreason = this.$t('message.vm.delete.request.failed')
        if (this.current()) { this.$notifyError(error); await this.refreshAfterFailure(target) }
      }
    },
    trackJob (target, jobId, bulk = false) {
      return new Promise(resolve => {
        const finish = async (status) => {
          this.updateResourceState(target.id, status, jobId)
          if (status === 'unknown') {
            const row = this.selectedItemsProgress.find(row => row.id === target.id)
            if (row) row.deletionreason = this.$t('message.vm.delete.job.unknown')
          }
          if (status === 'failed' && this.current()) await this.refreshAfterFailure(target)
          if (!bulk && this.current()) {
            if (status === 'success') { this.parentFetchData(); this.closeAction() } else {
              this.submissionError = this.$t(status === 'failed' ? 'message.vm.delete.job.failed' : 'message.vm.delete.job.unknown')
              if (status === 'failed') this.parentFetchData()
            }
          }
          resolve()
        }
        const polling = this.$pollJob({
          jobId,
          showLoading: !bulk,
          bulkAction: false,
          title: this.$t(this.currentAction.label || 'label.action.destroy.instance'),
          description: target.displayname || target.name,
          loadingMessage: `${this.$t('message.deleting.vm')} ${target.displayname || target.name}`,
          successMessage: `${this.$t('message.success.delete.vm')} ${target.displayname || target.name}`,
          catchMessage: this.$t('error.fetching.async.job.result'),
          successMethod: () => finish('success'),
          errorMethod: () => finish('failed'),
          catchMethod: () => finish('unknown'),
          action: { isFetchData: false }
        })
        if (polling) polling.catch(() => finish('unknown'))
      })
    },
    async refreshAfterFailure (target) {
      try {
        const record = await readVmDeletionTarget(target, this.$store, () => this.current())
        if (this.current()) this.guardRows = this.guardRows.map(row => row.id === target.id ? { ...row, record, readFailed: false, reason: vmDeletionReason(record, this.currentAction, this.$store.getters) } : row)
      } catch (error) {
        if (this.current()) this.guardRows = this.guardRows.map(row => row.id === target.id ? { ...row, record: undefined, readFailed: true, reason: 'message.vm.delete.read.failed' } : row)
      }
      if (this.current()) {
        const progress = this.selectedItemsProgress.find(row => row.id === target.id)
        const guard = this.guardRows.find(row => row.id === target.id)
        if (progress && progress.status !== 'unknown') progress.deletionreason = this.$t(guard?.reason || 'message.vm.delete.job.failed')
      }
    },
    updateResourceState (id, status, jobId) {
      const row = this.selectedItemsProgress.find(row => row.id === id)
      if (row) { row.status = status; if (jobId) row.jobid = jobId }
    },
    closeAction () {
      if (this.actionClosed) return
      this.actionClosed = true
      this.checkGeneration++
      this.$emit('close-action')
    }
  }
}
</script>

<style scoped lang="less">
  .vm-delete-targets { padding-left: 20px; max-height: 220px; overflow-y: auto; }
  .vm-delete-targets li { margin: 12px 0; overflow-wrap: anywhere; }
  .vm-delete-targets small { display: block; }
  .vm-delete-reason { color: var(--error-color, #cf1322); }
  .vm-delete-preflight p { margin-top: 10px; }
  .form-layout {
    &.form-list {
      max-width: 60vw;
    }

    &:not(.form-list) {
      width: 60vw;

      @media (min-width: 500px) {
        width: 450px;
      }
    }

    .row-keys {
      .ant-select {
        display: block;
        width: 90%;
      }
    }
  }
</style>
