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
  <div class="vm-acl-standard secondary-storage-selectors">
    <div class="content-breadcrumb">
      <a-card class="breadcrumb-card">
        <div class="vm-acl-breadcrumb-layout">
          <a-breadcrumb class="breadcrumb">
            <a-breadcrumb-item>
              <router-link to="/infra">
                <bank-outlined /> {{ $t('label.infrastructure') }}
              </router-link>
            </a-breadcrumb-item>
            <a-breadcrumb-item>
              <router-link :to="originLocation">{{ $t('label.secondary.storage') }}</router-link>
            </a-breadcrumb-item>
            <a-breadcrumb-item>
              <span aria-current="page">{{ $t('label.secondary.selector.rules') }}</span>
            </a-breadcrumb-item>
          </a-breadcrumb>
        </div>
      </a-card>
    </div>

    <resource-table-toolbar
      v-model:search="keyword"
      searchable
      :loading="loading || loadingZones"
      @refresh="refresh">
      <a-select
        id="secondary-selector-zone"
        :aria-label="$t('label.zone')"
        :placeholder="$t('label.zone')"
        :options="zoneOptions"
        :value="zoneId || undefined"
        :loading="loadingZones"
        class="selector-zone"
        @change="setFilter({ zoneid: $event })" />
      <a-select
        :aria-label="$t('label.type')"
        :value="selectorType"
        :options="typeOptions"
        @change="setFilter({ type: $event || undefined })" />
      <a-checkbox
        :checked="showRemoved"
        @change="setFilter({ showremoved: $event.target.checked ? 'true' : undefined })">
        {{ $t('label.secondary.selector.show.removed') }}
      </a-checkbox>
      <template #actions>
        <a-button
          v-if="canCreate"
          ref="addButton"
          type="primary"
          :disabled="!zoneId || jsEnabled === false || checkingJs || readFailed || loading"
          :loading="opening"
          @click="openCreate">
          <template #icon><plus-outlined /></template>
          {{ $t('label.secondary.selector.add') }}
        </a-button>
      </template>
    </resource-table-toolbar>

    <a-alert v-if="zonesFailed" type="error" show-icon :message="$t('message.secondary.selector.zones.failed')" />
    <a-alert v-else-if="jsEnabled === false && (canCreate || canEdit)" type="info" show-icon :message="$t('message.secondary.selector.js.disabled')" />
    <a-alert
      v-if="readFailed"
      type="error"
      show-icon
      :message="$t(rows.length ? 'message.list.refresh.stale' : 'message.secondary.selector.list.failed')" />
    <a-table
      v-if="zoneId && (!readFailed || rows.length)"
      :columns="columns"
      :data-source="filteredRows"
      :loading="loading"
      :pagination="{ current: page, pageSize: 10, showSizeChanger: false }"
      :scroll="{ x: 660 }"
      row-key="id"
      @change="page = $event.current">
      <template #bodyCell="{ column, record }">
        <a-button v-if="column.key === 'name'" type="link" size="small" @click="openRule(record, 'view', $event)">
          {{ record.name }}
        </a-button>
        <template v-else-if="column.key === 'target'">{{ targetLabel(record) }}</template>
        <a-tag v-else-if="column.key === 'status'" :color="record.removed ? undefined : 'success'">
          {{ record.removed ? $t('label.removed') : $t('label.active') }}
        </a-tag>
        <a-space v-else-if="column.key === 'actions' && !record.removed">
          <a-button
            v-if="canEdit"
            size="small"
            type="link"
            :disabled="jsEnabled === false || checkingJs || !rowsReady"
            @click="openRule(record, 'edit', $event)">
            {{ $t('label.edit') }}
          </a-button>
          <a-button v-if="canRemove" size="small" type="link" danger :disabled="!rowsReady" @click="openRemoval(record, $event)">
            {{ $t('label.delete') }}
          </a-button>
        </a-space>
      </template>
      <template #emptyText>{{ $t('message.secondary.selector.no.rules') }}</template>
    </a-table>
    <Empty v-else-if="!zoneId && !zonesFailed && !loadingZones" :description="$t('message.secondary.selector.choose.zone')" />

    <secondary-storage-selector-dialog
      v-if="dialog"
      :dialog="dialog"
      :visible="showRule"
      :zone-name="zoneName"
      :stores="targetStores"
      :stores-loading="loadingStores"
      :stores-failed="storesFailed"
      :busy="saving"
      @save="saveRule"
      @cancel="closeRule"
      @after-close="ruleClosed" />

    <mold-dialog
      :visible="!!removal"
      :title="$t('label.secondary.selector.remove')"
      size="sm"
      form-actions
      focus-guard
      initial-focus="#secondary-selector-cancel-removal"
      :after-close="restoreFocus"
      @cancel="closeRemoval">
      <dl v-if="removal" class="acl-action-context">
        <dt>{{ $t('label.name') }}</dt><dd>{{ removal.name }}</dd>
        <dt>{{ $t('label.zone') }}</dt><dd>{{ zoneName }}</dd>
        <dt>{{ $t('label.type') }}</dt><dd>{{ removal.type }}</dd>
      </dl>
      <p>{{ $t('message.secondary.selector.remove.effect') }}</p>
      <mold-dialog-actions :busy="saving">
        <a-button id="secondary-selector-cancel-removal" @click="closeRemoval">{{ $t('label.cancel') }}</a-button>
        <a-button type="primary" danger :loading="saving" @click="removeRule">{{ $t('label.delete') }}</a-button>
      </mold-dialog-actions>
    </mold-dialog>
  </div>
</template>

<script>
import { markRaw } from 'vue'
import { Empty } from 'ant-design-vue'
import { getAPI, postAPI } from '@/api'
import MoldDialog from '@/components/view/MoldDialog'
import MoldDialogActions from '@/components/view/MoldDialogActions'
import ResourceTableToolbar from '@/components/view/ResourceTableToolbar'
import SecondaryStorageSelectorDialog from '@/views/infra/SecondaryStorageSelectorDialog'
import { secondaryStorageListQuery } from '@/utils/secondaryStorageSearch'
import {
  fixedSelectorId, isSelectorUuid, readSecondaryStorageSelectors, readSelectorStores,
  selectorApi, selectorConfigKey, selectorTypes
} from '@/utils/secondaryStorageSelectors'

export default {
  name: 'SecondaryStorageSelectors',
  components: { Empty, MoldDialog, MoldDialogActions, ResourceTableToolbar, SecondaryStorageSelectorDialog },
  data () {
    return {
      zones: [],
      rows: [],
      targetStores: [],
      keyword: '',
      page: 1,
      loading: false,
      loadingZones: false,
      loadingStores: false,
      zonesFailed: false,
      readFailed: false,
      storesFailed: false,
      storesZone: '',
      checkingJs: false,
      jsEnabled: null,
      rowsKey: '',
      listVersion: 0,
      storeVersion: 0,
      zoneVersion: 0,
      dialog: null,
      showRule: false,
      removal: null,
      opening: false,
      saving: false,
      focusReturn: null
    }
  },
  computed: {
    apis () { return this.$store.getters.apis || {} },
    originLocation () {
      const history = this.$router.options.history.state?.secondaryStorageSelectorOrigin
      return { name: 'imagestore', query: secondaryStorageListQuery(history || {}) }
    },
    requestedZone () { return isSelectorUuid(this.$route.query.zoneid) ? this.$route.query.zoneid : '' },
    zoneId () { return this.zones.some(zone => zone.id === this.requestedZone) ? this.requestedZone : '' },
    zoneName () { return this.zones.find(zone => zone.id === this.zoneId)?.name || this.zoneId },
    selectorType () { return selectorTypes.includes(this.$route.query.type) ? this.$route.query.type : '' },
    showRemoved () { return this.$route.query.showremoved === 'true' },
    zoneOptions () { return this.zones.map(zone => ({ value: zone.id, label: zone.name || zone.id })) },
    typeOptions () {
      return [{ value: '', label: this.$t('label.all') }, ...selectorTypes.map(type => ({ value: type, label: type }))]
    },
    canList () { return !!this.apis[selectorApi.list] },
    canCreate () { return !!this.apis[selectorApi.create] },
    canEdit () { return !!this.apis[selectorApi.update] },
    canRemove () { return !!this.apis[selectorApi.remove] },
    readKey () { return JSON.stringify([this.zoneId, this.selectorType, this.showRemoved, this.canList]) },
    rowsReady () { return this.rowsKey === this.readKey && !this.loading && !this.readFailed },
    filteredRows () {
      const term = this.keyword.trim().toLowerCase()
      return this.rows.filter(row => String(row.name || '').toLowerCase().includes(term))
    },
    columns () {
      const columns = [
        { key: 'name', title: this.$t('label.name'), width: 180 },
        { key: 'type', dataIndex: 'type', title: this.$t('label.type'), width: 105 },
        { key: 'target', title: this.$t('label.secondary.selector.target'), width: 195, ellipsis: true },
        { key: 'status', title: this.$t('label.state'), width: 90 }
      ]
      if (this.canEdit || this.canRemove) columns.push({ key: 'actions', title: this.$t('label.actions'), width: 90 })
      return columns
    }
  },
  watch: {
    readKey () {
      this.keyword = ''
      this.page = 1
      this.readRows()
    },
    zoneId () { this.readTargets() },
    keyword () { this.page = 1 }
  },
  created () {
    this.readZones()
    this.readJsPolicy()
  },
  beforeUnmount () {
    this.listVersion++
    this.storeVersion++
    this.zoneVersion++
  },
  methods: {
    setFilter (changes) {
      return this.$router.replace({
        query: { ...this.$route.query, ...changes },
        state: { secondaryStorageSelectorOrigin: this.originLocation.query }
      })
    },
    async readZones () {
      if (!this.canList || this.loadingZones) return
      const request = ++this.zoneVersion
      this.loadingZones = true
      this.zonesFailed = false
      try {
        let zones
        if (this.apis.listZones) {
          const data = await getAPI('listZones', {}, { preserveOnFailure: true })
          zones = (data.listzonesresponse.zone || []).filter(zone => isSelectorUuid(zone.id))
        } else if (this.requestedZone) {
          zones = [{ id: this.requestedZone }]
        } else {
          throw new Error()
        }
        if (request !== this.zoneVersion) return
        this.zones = zones
        const next = this.zoneId || (zones.length === 1 ? zones[0].id : undefined)
        if (next !== this.$route.query.zoneid) await this.setFilter({ zoneid: next })
      } catch {
        if (request === this.zoneVersion) this.zonesFailed = true
      } finally {
        if (request === this.zoneVersion) this.loadingZones = false
      }
    },
    async readJsPolicy () {
      if (!this.apis.listConfigurations) return
      this.checkingJs = true
      try {
        const data = await getAPI('listConfigurations', { name: selectorConfigKey }, { preserveOnFailure: true })
        const row = data.listconfigurationsresponse.configuration?.find(setting => setting.name === selectorConfigKey)
        this.jsEnabled = row ? String(row.value) === 'true' : null
      } catch {
        this.jsEnabled = null
      } finally {
        this.checkingJs = false
      }
    },
    async readRows () {
      const version = ++this.listVersion
      const key = this.readKey
      this.readFailed = false
      if (this.rowsKey !== key) this.rows = []
      if (!this.zoneId || !this.canList) {
        this.loading = false
        this.rowsKey = ''
        return
      }
      this.loading = true
      try {
        const rows = await readSecondaryStorageSelectors(this.zoneId, { type: this.selectorType, showRemoved: this.showRemoved })
        if (version !== this.listVersion || key !== this.readKey) return
        this.rows = rows
        this.rowsKey = key
        this.page = Math.min(this.page, Math.max(1, Math.ceil(this.filteredRows.length / 10)))
      } catch (error) {
        if (version !== this.listVersion || key !== this.readKey) return
        if ([401, 403].includes(error?.response?.status)) {
          this.rows = []
          this.rowsKey = ''
        }
        this.readFailed = true
      } finally {
        if (version === this.listVersion) this.loading = false
      }
    },
    async readTargets () {
      const version = ++this.storeVersion
      const zoneId = this.zoneId
      if (this.storesZone !== zoneId || !this.apis.listImageStores) this.targetStores = []
      this.storesFailed = !!zoneId && !this.apis.listImageStores
      this.loadingStores = false
      if (!zoneId || !this.apis.listImageStores) return
      this.loadingStores = true
      try {
        const stores = await readSelectorStores(zoneId)
        if (version === this.storeVersion && zoneId === this.zoneId) {
          this.targetStores = stores
          this.storesZone = zoneId
        }
      } catch {
        if (version === this.storeVersion) this.storesFailed = true
      } finally {
        if (version === this.storeVersion) this.loadingStores = false
      }
    },
    refresh () {
      if (this.zonesFailed || !this.zones.length) this.readZones()
      if (!this.checkingJs) this.readJsPolicy()
      this.readTargets()
      if (!this.loading) this.readRows()
    },
    targetLabel (record) {
      const id = fixedSelectorId(record.heuristicrule)
      if (!id) return this.$t('label.secondary.selector.script')
      return this.targetStores.find(store => store.id.toLowerCase() === id)?.name || id
    },
    currentRule (record) {
      return this.rowsReady && !record.removed && record.zoneid === this.zoneId &&
        isSelectorUuid(record.id) && this.rows.some(row => row.id === record.id && !row.removed)
    },
    async openCreate (event) {
      if (!this.canCreate || this.jsEnabled === false || this.checkingJs || !this.rowsReady || this.opening) return
      const key = this.readKey
      const trigger = event.currentTarget
      this.opening = true
      try {
        const active = await readSecondaryStorageSelectors(this.zoneId)
        if (key !== this.readKey || !this.canCreate || this.jsEnabled === false) return
        this.focusReturn = markRaw(trigger)
        this.dialog = { mode: 'add', zoneid: this.zoneId, type: this.selectorType, usedTypes: active.filter(rule => !rule.removed).map(rule => rule.type) }
        this.showRule = true
      } catch (error) {
        if (key === this.readKey) this.$notifyError(error)
      } finally {
        this.opening = false
      }
    },
    openRule (record, mode, event) {
      if (!this.canList || record.zoneid !== this.zoneId) return
      if (mode === 'edit' && (!this.canEdit || this.jsEnabled === false || !this.currentRule(record))) return
      this.focusReturn = markRaw(event.currentTarget)
      this.dialog = { mode, zoneid: this.zoneId, record: { ...record } }
      this.showRule = true
    },
    closeRule () {
      if (!this.saving) this.showRule = false
    },
    ruleClosed () {
      this.dialog = null
      this.restoreFocus()
    },
    openRemoval (record, event) {
      if (!this.canRemove || !this.currentRule(record)) return
      this.focusReturn = markRaw(event.currentTarget)
      this.removal = { ...record }
    },
    closeRemoval () {
      if (!this.saving) this.removal = null
    },
    restoreFocus () {
      const target = this.focusReturn?.isConnected ? this.focusReturn : this.$refs.addButton?.$el
      this.focusReturn = null
      if (target && !target.disabled) target.focus({ preventScroll: true })
    },
    saveRule (values) {
      const dialog = this.dialog
      if (!dialog || dialog.zoneid !== this.zoneId || this.jsEnabled === false || !this.rowsReady) return
      if (dialog.mode === 'edit' && this.canEdit && this.currentRule(dialog.record)) {
        return this.updateRule(selectorApi.update, { id: dialog.record.id, heuristicrule: values.heuristicrule }, this.closeRule)
      }
      if (dialog.mode === 'add' && this.canCreate) {
        return this.updateRule(selectorApi.create, { ...values, zoneid: dialog.zoneid }, this.closeRule)
      }
    },
    removeRule () {
      if (!this.removal || !this.canRemove || !this.currentRule(this.removal)) return
      return this.updateRule(selectorApi.remove, { id: this.removal.id }, this.closeRemoval)
    },
    async updateRule (command, params, close) {
      if (this.saving) return
      this.saving = true
      const key = this.readKey
      try {
        await postAPI(command, params, { preserveOnFailure: true })
      } catch (error) {
        this.$notifyError(error)
        return
      } finally {
        this.saving = false
      }
      if (key !== this.readKey) return
      close()
      this.$message.success(this.$t('label.success'))
      await this.readRows()
    }
  }
}
</script>

<style scoped>
.secondary-storage-selectors { min-width: 0; }
.secondary-storage-selectors .breadcrumb-card { margin-bottom: 16px; }
.secondary-storage-selectors .ant-alert { margin-bottom: 12px; }
.secondary-storage-selectors .selector-zone { min-width: 150px; }
</style>
