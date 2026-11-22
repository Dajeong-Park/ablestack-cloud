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
  <div>
    <p v-if="listRefreshFailed" role="status">{{ $t('message.list.refresh.stale') }}</p>
    <a-spin :spinning="fetchLoading">
      <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
        <a-input-search
          v-model:value="searchText"
          :placeholder="$t('label.search')"
          style="width: 250px;"
          allow-clear />
        <a-button
          v-if="canCreate"
          shape="round"
          @click="() => { showAddForm = true }">
          {{ $t('label.dns.create.record') }}
          <plus-outlined style="margin-left: 5px;" />
        </a-button>
      </div>

      <a-table
        size="small"
        style="overflow-y: auto; width: 100%;"
        :columns="visibleColumns"
        :dataSource="filteredRecords"
        :rowKey="item => `${item.name}-${item.type}`"
        :pagination="tablePagination">

        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'contents'">
            <a-tag v-for="(item, idx) in record.contents" :key="idx">{{ item }}</a-tag>
          </template>
          <template v-if="column.dataIndex === 'ttl'">
            {{ record.ttl }}
          </template>
          <template v-if="column.key === 'actions' && canDelete">
            <span v-if="isApexNs(record)">{{ $t('label.dns.record.apex.ns.protected') }}</span>
            <tooltip-button
              v-else
              tooltipPlacement="bottom"
              :tooltip="$t('label.delete')"
              type="primary"
              :danger="true"
              icon="delete-outlined"
              @onClick="deleteTarget = record" />
          </template>
        </template>
      </a-table>
    </a-spin>

    <a-modal
      v-if="deleteTarget && canDelete"
      :visible="true"
      :title="$t('label.dns.delete.record')"
      :closable="!deleteLoading"
      :keyboard="!deleteLoading"
      :mask-closable="false"
      :footer="null"
      centered
      @cancel="closeDeleteForm">
      <p>{{ $t('message.dns.record.delete.rrset', { name: deleteTarget.name, type: deleteTarget.type, count: deleteTarget.contents?.length || 0 }) }}</p>
      <a-alert v-if="jobError" :message="jobError" type="error" show-icon />
      <div class="action-button">
        <a-button :disabled="deleteLoading" @click="closeDeleteForm">{{ $t('label.cancel') }}</a-button>
        <a-button type="primary" danger :loading="deleteLoading" :disabled="jobTracking === 'unconfirmed'" @click="handleDeleteRecord">
          {{ $t(jobId ? 'label.dns.job.recheck' : 'label.delete') }}
        </a-button>
      </div>
    </a-modal>

    <a-modal
      v-if="showAddForm && canCreate"
      :visible="showAddForm"
      :title="$t('label.dns.create.record')"
      :maskClosable="false"
      :closable="true"
      :footer="null"
      @cancel="() => { showAddForm = false }"
      centered
      width="auto">
      <CreateDnsRecord
        :resource="resource"
        @close-action="handleCloseCreateForm" />
    </a-modal>
  </div>
</template>

<script>
import { listRefreshMixin } from '@/utils/listRefreshMixin'

import { getAPI } from '@/api'
import { dnsJob } from './dnsJob'
import TooltipButton from '@/components/widgets/TooltipButton'
import CreateDnsRecord from '@/views/network/dns/CreateDnsRecord'

export default {
  mixins: [listRefreshMixin(['fetchData']), dnsJob],
  name: 'DnsRecordsTab',
  components: {
    TooltipButton,
    CreateDnsRecord
  },
  props: {
    resource: {
      type: Object,
      required: true
    },
    loading: {
      type: Boolean,
      default: false
    }
  },
  data () {
    return {
      fetchLoading: false,
      deleteTarget: null,
      showAddForm: false,
      searchText: '',
      records: [],
      tablePagination: {
        defaultPageSize: 10,
        showSizeChanger: true,
        pageSizeOptions: ['10', '20', '40', '80', '100'],
        showTotal: (total) => `${this.$t('label.total')} ${total} ${this.$t('label.items')}`
      },
      columns: [
        {
          title: this.$t('label.name'),
          dataIndex: 'name',
          sorter: (a, b) => a.name.localeCompare(b.name)
        },
        {
          title: this.$t('label.type'),
          dataIndex: 'type',
          sorter: (a, b) => a.type.localeCompare(b.type)
        },
        {
          title: this.$t('label.contents'),
          dataIndex: 'contents'
        },
        {
          title: this.$t('label.ttl') + ' (' + this.$t('label.seconds') + ')',
          dataIndex: 'ttl',
          sorter: (a, b) => a.ttl - b.ttl
        },
        {
          key: 'actions',
          title: this.$t('label.actions')
        }
      ]
    }
  },
  computed: {
    deleteLoading () { return this.jobLoading },
    canRead () { return !!this.$store.getters.apis?.listDnsRecords },
    canCreate () { return this.canRead && !!this.$store.getters.apis?.createDnsRecord },
    canDelete () { return this.canRead && !!this.$store.getters.apis?.deleteDnsRecord },
    visibleColumns () { return this.canDelete ? this.columns : this.columns.filter(column => column.key !== 'actions') },
    filteredRecords () {
      const q = this.searchText.trim().toLowerCase()
      if (!q) return this.records
      return this.records.filter(r =>
        r.name?.toLowerCase().includes(q) ||
        r.type?.toLowerCase().includes(q) ||
        r.contents?.some(c => c.toLowerCase().includes(q))
      )
    }
  },
  created () {
    this.fetchData()
  },
  watch: {
    'resource.id' (newId) {
      if (!newId) return
      this.fetchData()
    }
  },
  methods: {
    fetchData () {
      if (!this.canRead || !this.resource.id) return
      const listRequest = this.listRequestToken('fetchData')
      if (this.fetchLoading) return

      const params = {
        dnszoneid: this.resource.id
      }
      this.fetchLoading = !listRequest.loaded
      return getAPI('listDnsRecords', params).then(json => {
        if (!this.isListRequestCurrent('fetchData', listRequest)) return

        const response = json.listdnsrecordsresponse || {}
        this.records = response.dnsrecord || []
      }).catch(error => {
        if (!this.isListRequestCurrent('fetchData', listRequest)) return
        listRequest.failed = true
        this.listRefreshFailed = true
        if (listRequest.loaded) return

        this.$notifyError(error)
      }).finally(() => {
        if (!this.isListRequestCurrent('fetchData', listRequest)) return

        this.fetchLoading = false
      }).finally(() => {
        if (!this.isListRequestCurrent('fetchData', listRequest)) return
        this.fetchLoading = false
      })
    },
    isApexNs (record) {
      if (record.type !== 'NS') return false
      const name = record.name?.trim().toLowerCase().replace(/\.$/, '')
      return name === '@' || name === this.resource.name?.trim().toLowerCase().replace(/\.$/, '')
    },
    closeDeleteForm () {
      this.deleteTarget = null
      this.jobId = ''
      this.jobTracking = ''
      this.jobError = ''
    },
    handleDeleteRecord () {
      const record = this.deleteTarget
      if (!record || !this.canDelete || this.jobTracking === 'unconfirmed' || this.isApexNs(record)) return
      const params = { dnszoneid: this.resource.id, name: record.name, type: record.type }
      return this.submitDnsJob('deleteDnsRecord', params, 'label.dns.delete.record', record.name, () => {
        this.closeDeleteForm()
        this.fetchData()
      })
    },
    handleCloseCreateForm (payload) {
      this.showAddForm = false
      if (payload?.saved) this.fetchData()
    }
  }
}
</script>
