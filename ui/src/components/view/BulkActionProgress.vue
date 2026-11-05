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
  <a-modal
    v-if="showGroupActionModal"
    :visible="showGroupActionModal"
    :closable="true"
    :maskClosable="false"
    :cancelText="$t('label.cancel')"
    @cancel="handleCancel"
    :width="$route.path === '/buckets' ? 'min(720px, calc(100vw - 32px))' : '50vw'"
    :class="$route.path === '/buckets' ? 'mold-dialog mold-dialog-standard object-storage-dialog' : undefined"
    :wrap-class-name="$route.path === '/buckets' ? 'mold-dialog-standard-wrap' : undefined"
    :style="$route.path === '/buckets' ? undefined : { top: '20px', overflowY: 'auto' }"
    centered
  >
    <template #title>
      {{ $t(message.title) }}
      <a
        v-if="message.docHelp || $route.meta.docHelp"
        style="margin-left: 5px"
        :href="$config.docBase + '/' + (message.docHelp || $route.meta.docHelp)"
        target="_blank">
        <question-circle-outlined />
      </a>
    </template>
    <template #footer>
      <a-button key="back" @click="handleCancel"> {{ $t('label.close') }} </a-button>
    </template>
    <a-card :bordered="false" class="bulk-action-summary">
      <div><check-circle-outlined style="color: #52c41a; margin-right: 8px"/> {{ $t('label.success') + ': ' + succeededCount }}</div>
      <div><close-circle-outlined style="color: #f5222d; margin-right: 8px"/> {{ $t('state.failed') + ': ' + failedCount }}</div>
      <div><sync-outlined style="color: #1890ff; margin-right: 8px"/> {{ $t('state.inprogress') + ': ' + inProgressCount }}</div>
    </a-card>
    <a-divider />
    <div v-if="showGroupActionModal">
      <a-table
        v-if="selectedItems.length > 0"
        size="middle"
        :columns="progressColumns"
        :dataSource="filteredItems"
        :rowKey="record => ($route.path.includes('/template') || $route.path.includes('/iso')) ? record.zoneid: record.id"
        :pagination="true"
        @change="handleTableChange"
        :scroll="$route.path === '/buckets' ? { x: 760 } : undefined"
          style="overflow-y: auto">
        <template #bodyCell="{ column, text, record }">
          <template v-if="column.key === 'status'">
            <a-badge
              :status="text === 'success' ? 'success' : text === 'failed' ? 'error' : 'processing'"
              :text="$t(text === 'success' ? 'label.success' : text === 'failed' ? 'state.failed' : 'state.inprogress')" />
          </template>
          <template v-if="column.key === 'algorithm'">
            {{ returnAlgorithmName(record.algorithm) }}
          </template>
          <template v-if="column.key === 'privateport'">
            {{ record.privateport }} - {{ record.privateendport }}
          </template>
          <template v-if="column.key === 'publicport'">
            {{ record.publicport }} - {{ record.publicendport }}
          </template>
          <template v-if="column.key === 'protocol'">
            {{ capitalise(record.protocol) }}
          </template>
          <template v-if="column.key === 'startport'">
            {{ record.icmptype || record.startport >= 0 ? record.icmptype || record.startport : $t('label.all') }}
          </template>
          <template v-if="column.key === 'endport'">
            {{ record.icmpcode || record.endport >= 0 ? record.icmpcode || record.endport : $t('label.all') }}
          </template>
          <template v-if="column.key === 'vm'">
            <div><desktop-outlined /> {{ record.virtualmachinename }} ({{ record.vmguestip }})</div>
          </template>
          <template v-if="column.key === 'cidrlist'">
            <span style="white-space: pre-line"> {{ record.cidrlist?.replaceAll(" ", "\n") }}</span>
          </template>
        </template>
      </a-table>
      <br/>
    </div>
  </a-modal>
</template>
<script>

export default {
  name: 'BulkActionProgress',
  props: {
    showGroupActionModal: {
      type: Boolean,
      default: false
    },
    selectedItems: {
      type: Array,
      default: () => []
    },
    selectedColumns: {
      type: Array,
      default: () => []
    },
    message: {
      type: Object,
      default: () => {}
    }
  },
  data () {
    return { appliedFilterStatus: [], refreshTimer: null }
  },
  inject: ['parentFetchData'],
  beforeUnmount () {
    clearTimeout(this.refreshTimer)
  },
  watch: {
    statusSignature () {
      if (!this.showGroupActionModal) return
      clearTimeout(this.refreshTimer)
      this.refreshTimer = setTimeout(() => {
        // fetchData keeps the current rows while the new response is loading.
        Promise.resolve(this.parentFetchData()).catch(() => {})
      }, 50)
    },
    showGroupActionModal (visible) {
      if (!visible) {
        clearTimeout(this.refreshTimer)
        this.appliedFilterStatus = []
      }
    }
  },
  computed: {
    statusSignature () {
      return JSON.stringify(this.selectedItems.map(item => [item.id, item.zoneid, item.status, item.jobid]))
    },
    progressColumns () {
      let hasStatus = false
      return this.selectedColumns.filter(column => {
        if (column.key !== 'status') return true
        if (hasStatus) return false
        hasStatus = true
        return true
      })
    },
    filteredItems () {
      return this.appliedFilterStatus?.length
        ? this.selectedItems.filter(item => this.appliedFilterStatus.includes(item.status))
        : this.selectedItems
    },
    inProgressCount () {
      return this.selectedItems.filter(item => !['success', 'failed'].includes(item.status)).length
    },
    succeededCount () {
      return this.selectedItems.filter(item => item.status === 'success').length || 0
    },
    failedCount () {
      return this.selectedItems.filter(item => item.status === 'failed').length || 0
    }
  },
  methods: {
    handleTableChange (pagination, filters) {
      this.appliedFilterStatus = filters.status || []
    },
    handleCancel () {
      clearTimeout(this.refreshTimer)
      this.appliedFilterStatus = []
      this.$emit('handle-cancel')
      Promise.resolve(this.parentFetchData()).catch(() => {})
    },
    returnAlgorithmName (name) {
      switch (name) {
        case 'leastconn':
          return 'Least connections'
        case 'roundrobin' :
          return 'Round-robin'
        case 'source':
          return 'Source'
        default :
          return ''
      }
    },
    capitalise (val) {
      if (val === 'all') return 'All'
      return val.toUpperCase()
    }
  }
}
</script>

<style scoped lang="less">
.bulk-action-summary {
  background: var(--ui-bg-elevated, #f1f1f1);
  color: var(--ui-text-primary, #262626);
}
</style>
