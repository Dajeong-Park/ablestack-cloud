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
  <div class="bucket-versions">
    <a-alert v-if="error" type="error" show-icon :message="$t('message.bucket.versions.failed')" />
    <div class="bucket-version-toolbar">
      <a-button :loading="loading" @click="load">{{ $t('label.refresh') }}</a-button>
      <a-button :disabled="loading || history.length === 0" @click="previous">{{ $t('label.previous') }}</a-button>
      <a-button :disabled="loading || !page.istruncated" @click="next">{{ $t('label.next') }}</a-button>
      <span>{{ $t('message.bucket.versions.page') }}</span>
    </div>
    <a-table :data-source="page.versions || []" :columns="columns" :loading="loading" :pagination="false" :scroll="{x: 820}" :row-key="row => JSON.stringify([row.key, row.versionid])">
      <template #bodyCell="{column, record}">
        <template v-if="column.key === 'key'"><span class="version-key">{{ record.key }}</span></template>
        <template v-else-if="column.key === 'deletemarker'">{{ $t(record.deletemarker ? 'label.bucket.delete.marker' : 'label.object') }}</template>
        <template v-else-if="column.key === 'islatest'">{{ record.islatest ? $t('label.yes') : $t('label.no') }}</template>
        <template v-else-if="column.key === 'lastmodified'">{{ $toLocaleDate(record.lastmodified) }}</template>
        <template v-else-if="column.key === 'actions'">
          <a-dropdown :trigger="['click']" placement="bottomRight" overlay-class-name="autoscale-row-menu bucket-version-row-menu" :disabled="busy" :visible="actionMenuKey === versionRowKey(record)" @visibleChange="visible => setActionMenu(record, visible)">
            <a-button
              class="bucket-version-actions"
              size="small"
              :disabled="busy"
              :aria-label="record.key + ' / ' + record.versionid + ' ' + $t('label.actions')"
              aria-haspopup="menu"
              :aria-expanded="actionMenuKey === versionRowKey(record)"
              @keydown.down.prevent="setActionMenu(record, true)"
              @keydown.up.prevent="setActionMenu(record, true, true)">{{ $t('label.actions') }} <down-outlined /></a-button>
            <template #overlay>
              <a-menu :data-version-menu="versionRowKey(record)" @click="closeActionMenu()" @vue:mounted="focusActionMenu(record)" @vue:updated="focusActionMenu(record)">
                <a-menu-item v-if="canReadMetadata" key="metadata" :disabled="record.deletemarker || busy" @click="metadataObject = { ...record }">{{ $t('label.bucket.object.metadata') }}</a-menu-item>
                <a-menu-item key="restore" :disabled="!canManage || busy || (record.islatest && !record.deletemarker)" @click="select(record, 'restore')">{{ $t(record.deletemarker ? 'label.bucket.marker.remove' : 'label.bucket.version.restore') }}</a-menu-item>
                <a-menu-divider />
                <a-menu-item key="delete" danger :disabled="!canManage || busy" @click="select(record, 'delete')">{{ $t('label.bucket.version.delete') }}</a-menu-item>
              </a-menu>
            </template>
          </a-dropdown>
        </template>
      </template>
    </a-table>
    <a-drawer v-if="!!metadataObject && $route.query.tab === 'versions'" class="object-store-drawer" :width="'min(480px, calc(100vw - 24px))'" :visible="!!metadataObject" :title="metadataObject?.key || ''" @close="metadataObject = null">
      <BucketObjectMetadata :resource="resource" :object-key="metadataObject?.key || ''" :version-id="metadataObject?.versionid" :active="!!metadataObject && $route.query?.tab === 'versions'" :revision="metadataRevision" />
    </a-drawer>
    <MoldDialog class="bucket-version-dialog" size="md" :visible="!!selected" :destroy-on-close="true" :closable="!busy" :title="$t(action === 'delete' ? 'label.bucket.version.delete' : selected?.deletemarker ? 'label.bucket.marker.remove' : 'label.bucket.version.restore')" @cancel="selected=null">
      <a-alert :type="action === 'delete' ? 'warning' : 'info'" show-icon :message="$t(action === 'delete' ? 'message.bucket.version.delete' : selected?.deletemarker ? 'message.bucket.marker.remove' : 'message.bucket.version.restore')" />
      <p v-if="selected" class="version-key">{{ selected.key }} / {{ selected.versionid }}</p>
      <a-alert v-if="mutationError" type="error" :message="$t('message.bucket.version.mutation.failed')" />
      <template #footer><a-button :disabled="busy" @click="selected=null">{{ $t('label.cancel') }}</a-button><a-button type="primary" :danger="action==='delete'" :loading="busy" @click="execute">{{ $t('label.ok') }}</a-button></template>
    </MoldDialog>
  </div>
</template>
<script>
import { postAPI } from '@/api'
import MoldDialog from '@/components/view/MoldDialog'
import BucketObjectMetadata from '@/components/view/BucketObjectMetadata'
export default {
  components: { MoldDialog, BucketObjectMetadata },
  props: { resource: { type: Object, required: true } },
  data () { return { page: {}, history: [], cursor: {}, loading: false, error: false, selected: null, action: '', busy: false, mutationError: false, metadataObject: null, metadataRevision: 0, actionMenuKey: null, actionMenuTrigger: null, actionMenuFocusPending: false, actionMenuFocusLast: false, actionMenuFocusFrame: null } },
  computed: {
    canReadMetadata () { return !!this.$store?.getters?.apis?.getBucketObjectMetadata },
    columns () { return ['key', 'versionid', 'deletemarker', 'islatest', 'size', 'lastmodified', 'actions'].map(key => ({ key, dataIndex: key, title: this.$t('label.bucket.version.' + key), ...(key === 'actions' ? { width: 112, align: 'right' } : {}) })) },
    canManage () { return !!this.$store.getters.apis.manageBucketObjectVersion && !(this.resource.quotaoperationtype === 'PURGE' && !['Succeeded', 'Failed'].includes(this.resource.quotaoperationstate)) }
  },
  watch: { 'resource.id' () { ++this.generation; this.page = {}; this.selected = null; this.cursor = {}; this.history = []; this.load() }, '$store.state.user.token' () { this.dispose() }, '$store.getters.project.id' () { this.dispose() }, '$route.path' () { this.dispose() }, '$route.query.tab' (tab) { if (tab !== 'versions') { this.closeActionMenu(); this.metadataObject = null; ++this.metadataRevision } } },
  created () { this.generation = 0; this.load() },
  mounted () { document.addEventListener('keydown', this.onActionMenuKeydown) },
  deactivated () { this.closeActionMenu(); this.metadataObject = null; ++this.metadataRevision },
  beforeUnmount () { document.removeEventListener('keydown', this.onActionMenuKeydown); this.dispose() },
  methods: {
    versionRowKey (row) { return JSON.stringify([row.key, row.versionid]) },
    actionMenuItems () {
      const menu = [...document.querySelectorAll('.bucket-version-row-menu .ant-dropdown-menu')].find(node => node.getAttribute('data-version-menu') === this.actionMenuKey && node.getBoundingClientRect().width > 0)
      return menu ? [...menu.querySelectorAll('[role="menuitem"]:not([aria-disabled="true"])')] : []
    },
    setActionMenu (row, visible, last = false) {
      const key = this.versionRowKey(row)
      if (!visible) { if (this.actionMenuKey === key) this.closeActionMenu(); return }
      if (this.busy) return
      this.actionMenuTrigger = document.activeElement
      this.actionMenuKey = key; this.actionMenuFocusPending = true; this.actionMenuFocusLast = last
      this.focusActionMenu(row)
    },
    focusActionMenu (row) {
      this.$nextTick(() => {
        const key = this.versionRowKey(row)
        if (this.actionMenuKey !== key || !this.actionMenuFocusPending || this.actionMenuFocusFrame !== null) return
        // Dropdown alignment can reattach its portal on the first animation frame.
        this.actionMenuFocusFrame = window.requestAnimationFrame(() => {
          this.actionMenuFocusFrame = window.requestAnimationFrame(() => {
            this.actionMenuFocusFrame = null
            if (this.actionMenuKey !== key || !this.actionMenuFocusPending) return
            const items = this.actionMenuItems()
            const item = items[this.actionMenuFocusLast ? items.length - 1 : 0]
            if (item) { this.actionMenuFocusPending = false; item.focus() }
          })
        })
      })
    },
    closeActionMenu (restoreFocus = false) {
      if (this.actionMenuFocusFrame !== null) window.cancelAnimationFrame(this.actionMenuFocusFrame)
      this.actionMenuFocusFrame = null
      const trigger = this.actionMenuTrigger
      this.actionMenuKey = null; this.actionMenuTrigger = null; this.actionMenuFocusPending = false
      if (restoreFocus && trigger?.isConnected) trigger.focus()
    },
    onActionMenuKeydown (event) {
      if (this.actionMenuKey === null) return
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); this.closeActionMenu(true); return }
      if (event.key === 'Tab') { this.closeActionMenu(true); return }
      const items = this.actionMenuItems(); const index = items.indexOf(document.activeElement)
      if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key) && items.length) {
        event.preventDefault()
        let next
        if (event.key === 'Home') next = 0
        else if (event.key === 'End') next = items.length - 1
        else if (index < 0) next = event.key === 'ArrowDown' ? 0 : items.length - 1
        else next = (index + (event.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length
        items[next].focus()
      } else if (event.key === ' ' && index >= 0) { event.preventDefault(); items[index].click() }
    },
    dispose () { this.closeActionMenu(); this.metadataObject = null; ++this.metadataRevision; ++this.generation; this.selected = null; this.page = {}; this.loading = false; this.busy = false },
    async load () {
      this.closeActionMenu(); this.metadataObject = null; ++this.metadataRevision
      const generation = ++this.generation; this.loading = true; this.error = false
      try {
        const json = await postAPI('listBucketObjectVersions', { id: this.resource.id, limit: 100, ...this.cursor }, { preserveOnFailure: true })
        if (generation === this.generation) this.page = json.listbucketobjectversionsresponse.bucketoperation
      } catch (_) { if (generation === this.generation) this.error = true } finally { if (generation === this.generation) this.loading = false }
    },
    next () { this.history.push(this.cursor); this.cursor = { keymarker: this.page.nextkeymarker, versionidmarker: this.page.nextversionidmarker }; this.load() },
    previous () { this.cursor = this.history.pop() || {}; this.load() },
    select (row, action) { this.selected = row; this.action = action; this.mutationError = false },
    async execute () {
      if (!this.selected || this.busy) return
      const generation = this.generation; this.busy = true; this.mutationError = false
      try {
        await postAPI('manageBucketObjectVersion', { id: this.resource.id, key: this.selected.key, versionid: this.selected.versionid, action: this.action }, { preserveOnFailure: true })
        if (generation !== this.generation) return
        this.selected = null; this.$notification.success({ message: this.$t('label.success.updated') }); this.cursor = {}; this.history = []; await this.load()
      } catch (_) { if (generation === this.generation) this.mutationError = true } finally { if (generation === this.generation || !this.selected) this.busy = false }
    }
  }
}
</script>
<style>
.bucket-versions .ant-btn:not(.ant-btn-primary):not(:disabled):hover,
.bucket-versions .ant-btn:not(.ant-btn-primary):not(:disabled):focus,
.bucket-version-dialog .ant-btn:not(.ant-btn-primary):not(:disabled):hover,
.bucket-version-dialog .ant-btn:not(.ant-btn-primary):not(:disabled):focus {
  color: var(--ui-link) !important;
  border-color: var(--ui-link) !important;
}
</style>
<style scoped>
.bucket-versions { min-width: 0; }
.bucket-version-toolbar { display:flex; flex-wrap:wrap; align-items:center; gap:8px; margin-bottom:16px; }
.version-key { overflow-wrap:anywhere; }
.bucket-version-actions { display:inline-flex; align-items:center; gap:4px; white-space:nowrap; }
</style>
