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
    <a-table
      size="small"
      style="overflow-y: auto"
      :columns="columns"
      :dataSource="securityChecks"
      :pagination="{showSizeChanger: true, total: total, position: ['bottomLeft']}"
      :pageSize="pageSize"
      :pageSizeOptions="pageSizeOptions"
      :rowKey="record => record.id || record.name"
      @expand="showUuid">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'status'">
          <status class="status" :text="record.success === true ? 'True' : 'False'" displayText />
        </template>
      </template>
      <template #expandedRowRender="{ record } ">
        <a-table
          style="margin: 10px 0;"
          :columns="innerColumns"
          :dataSource="securityChecksResultMap[record.id] || []"
          :pagination="false"
          :bordered="true"
          :rowKey="record.id">
        </a-table>
      </template>
    </a-table>
  </div>
</template>

<script>
import { ref, reactive } from 'vue'
import { api } from '@/api'
import Status from '@/components/widgets/Status'
import TooltipLabel from '@/components/widgets/TooltipLabel'
import BulkActionProgress from '@/components/view/BulkActionProgress'
import TooltipButton from '@/components/widgets/TooltipButton'
import OsLogo from '@/components/widgets/OsLogo'
import ResourceIcon from '@/components/view/ResourceIcon'
import eventBus from '@/config/eventBus'
import { genericCompare } from '@/utils/sort'

export default {
  name: 'SecurityCheckTab',
  components: {
    Status,
    TooltipLabel,
    BulkActionProgress,
    TooltipButton,
    OsLogo,
    ResourceIcon
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
      dateData: new Date(),
      total: 0,
      securityChecks: [],
      securityChecksResult: [],
      securityChecksResultMap: {},
      listValue: [],
      defaultPagination: false,
      columns: [],
      innerColumns: [],
      page: 1,
      pageSize: 10,
      itemCount: 0,
      fetchLoading: false,
      showCopyActionForm: false,
      currentRecord: {},
      zones: [],
      zoneLoading: false,
      deleteLoading: false,
      showDeleteResult: false,
      forcedDelete: false,
      selectedRowKeys: [],
      showGroupActionModal: false,
      selectedItems: [],
      selectedColumns: [],
      showConfirmationAction: false,
      filterColumns: ['Status', 'Ready'],
      message: {
        title: this.$t('label.action.bulk.delete.security.check.results'),
        confirmMessage: this.$t('label.confirm.delete.security.check.results')
      },
      modalWidth: '30vw',
      showTable: false
    }
  },
  computed: {
    pageSizeOptions () {
      var sizes = [20, 50, 100, 200, this.$store.getters.defaultListViewPageSize]
      if (this.device !== 'desktop') {
        sizes.unshift(20)
      }
      return [...new Set(sizes)].sort(function (a, b) {
        return a - b
      }).map(String)
    },
    filteredData () {
      return this.data.filter(record => record.id === this.desiredId)
    }
  },
  created () {
    this.initForm()
    this.fetchData()
    this.columns = [
      {
        key: 'lastupdated',
        title: this.$t('label.created'),
        dataIndex: 'lastupdated',
        defaultSortOrder: ['descend'],
        sorter: function (a, b) { return genericCompare(a.lastupdated || '', b.lastupdated || '') }
      },
      {
        key: 'status',
        title: this.$t('label.security.check.success')
      },
      {
        key: 'type',
        title: this.$t('label.verification.type'),
        dataIndex: 'type'
      },
      {
        key: 'servicename',
        title: this.$t('label.serviceunitname'),
        dataIndex: 'servicename'
      }
    ]
    this.innerColumns = [
      {
        key: 'checkfailedlist',
        title: this.$t('label.failed.security.check.list')
      }
    ]
  },
  watch: {
    loading (newData, oldData) {
      if (!newData && !this.showGroupActionModal) {
        this.fetchData()
      }
    }
  },
  methods: {
    initForm () {
      this.formRef = ref()
      this.form = reactive({})
      this.rules = reactive({})
    },
    showUuid (record, index) {
      const filteredItem = this.securityChecks.find(item => item.id === index.id)
      const key = String(index.id)
      if (filteredItem && filteredItem.details) {
        const failedList = filteredItem.details
        const updatedValues = failedList.split(', ').filter(item => item.trim() !== '')
        // index.id를 문자열로 변환하여 사용
        this.securityChecksResultMap[key] = updatedValues
      } else {
        // 해당 인덱스의 아이템을 찾지 못한 경우 빈 배열 설정
        this.securityChecksResultMap[key] = []
      }
    },
    fetchData () {
      const params = {}
      params.managementserverid = this.resource.id
      this.securityChecks = []
      this.itemCount = 0
      this.fetchLoading = true
      api('getSecurityCheck', { managementserverid: this.resource.id }).then(json => {
        this.securityChecks = json.getsecuritycheckresponse.securitychecks.securitychecks || []
      }).catch(error => {
        this.$notifyError(error)
      }).finally(f => {
      })
    },
    handleChangePage (page, pageSize) {
      this.page = page
      this.pageSize = pageSize
      this.fetchData()
    },
    handleChangePageSize (currentPage, pageSize) {
      this.page = currentPage
      this.pageSize = pageSize
      this.fetchData()
    },
    setSelection (selection) {
      this.selectedRowKeys = selection
      if (selection?.length > 0) {
        this.modalWidth = '50vw'
        this.$emit('selection-change', this.selectedRowKeys)
        this.selectedItems = (this.securityChecks.filter(function (item) {
          return selection.indexOf(item.id) !== -1
        }))
      } else {
        this.modalWidth = '30vw'
        this.selectedItems = []
      }
    },
    resetSelection () {
      this.setSelection([])
    },
    onSelectChange (selectedRowKeys, selectedRows) {
      this.setSelection(selectedRowKeys)
    },
    bulkActionConfirmation () {
      this.showConfirmationAction = true
      this.selectedColumns = this.columns.filter(column => {
        return !this.filterColumns.includes(column.title)
      })
      this.selectedItems = this.selectedItems.map(v => ({ ...v, status: 'InProgress' }))
      this.onShowDeleteModal(this.selectedItems[0])
    },
    handleCancel () {
      eventBus.emit('update-bulk-job-status', { items: this.selectedItems, action: false })
      this.showGroupActionModal = false
      this.selectedItems = []
      this.selectedRowKeys = []
      this.showTable = false
      this.fetchData()
      if (this.securityChecks.length === 0) {
        this.$router.go(-1)
      }
    },
    getOkProps () {
      if (this.selectedRowKeys.length > 0) {
        return { props: { type: 'default' } }
      } else {
        return { props: { type: 'primary' } }
      }
    },
    getCancelProps () {
      if (this.selectedRowKeys.length > 0) {
        return { props: { type: 'primary' } }
      } else {
        return { props: { type: 'default' } }
      }
    },
    deleteResults (e) {
      this.showConfirmationAction = false
      this.selectedColumns.splice(0, 0, {
        key: 'status',
        dataIndex: 'status',
        title: this.$t('label.operation.status'),
        filters: [
          { text: 'In Progress', value: 'InProgress' },
          { text: 'Success', value: 'success' },
          { text: 'Failed', value: 'failed' }
        ]
      })
      if (this.selectedRowKeys.length > 0) {
        this.showGroupActionModal = true
      }
      for (const result of this.selectedItems) {
        this.deleteResult(result)
      }
      this.onCloseModal()
      if (this.selectedItems.length === 0) {
        this.fetchData()
      }
    },
    deleteResult (result) {
      if (!result.id) {
        result = this.currentRecord
      }
      const params = {
        id: result.id
      }
      this.deleteLoading = true
      api('deleteSecurityCheckResults', params).then(json => {
        const jobId = json.deletesecuritycheckresultsresponse.jobid
        if (jobId) {
          this.$pollJob({
            jobId,
            title: this.$t('label.action.delete.security.check.result'),
            showLoading: !(this.selectedItems.length > 0 && this.showGroupActionModal),
            loadingMessage: `${this.$t('label.deleting.security.check.results')} ${this.resource.name} ${this.$t('label.in.progress')}`,
            catchMessage: this.$t('error.fetching.async.job.result'),
            bulkAction: this.selectedItems.length > 0 && this.showGroupActionModal
          })
        }
      }).catch(error => {
        this.$notifyError(error)
      }).finally(() => {
        this.deleteLoading = false
      })
    },
    onShowDeleteModal (record) {
      this.forcedDelete = false
      this.currentRecord = record
      this.showDeleteResult = true
      if (this.showConfirmationAction) {
        this.showTable = true
      } else {
        this.selectedItems = []
      }
    },
    onCloseModal () {
      this.showDeleteResult = false
      this.showConfirmationAction = false
      this.showTable = false
      this.selectedRowKeys = []
    },
    handleTableChange (pagination) {
      this.options.page = pagination.current
      this.options.pageSize = pagination.pageSize
      this.fetchData()
    },
    closeAction () {
      this.$emit('close-action')
    }
  }
}
</script>

<style lang="less" scoped>
.row-element {
  margin-top: 15px;
  margin-bottom: 15px;
}
</style>
