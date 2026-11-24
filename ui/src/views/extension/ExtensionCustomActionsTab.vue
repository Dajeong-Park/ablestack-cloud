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
    <a-button
      type="primary"
      style="width: 100%; margin-bottom: 10px"
      @click="showAddCustomActionModal"
      :loading="tabLoading"
      :disabled="!('addCustomAction' in $store.getters.apis)">
      <template #icon><plus-outlined /></template> {{ $t('label.add.custom.action') }}
    </a-button>
    <a-table
      size="small"
      :columns="columns"
      :dataSource="extensionCustomActions"
      :rowKey="item => item.id"
      :pagination="false"
      :loading="tabLoading"
      :rowExpandable="(record) => record.parameters && Object.keys(record.parameters).length > 0">
      <template #bodyCell="{ column, text, record }">
        <template v-if="column.key === 'name'">
          <router-link :to="{ path: '/customaction/' + record.id }">
            {{ text }}
          </router-link>
        </template>
        <template v-if="['enabled'].includes(column.key)">
          <status :text="text ? 'Enabled' : 'Disabled'" displayText />
        </template>
        <template v-if="['created'].includes(column.key)">
          {{ text && $toLocaleDate(text) }}
        </template>
        <template v-if="column.key === 'actions'">
          <span style="margin-right: 5px">
            <tooltip-button
              v-if="'updateCustomAction' in $store.getters.apis"
              :tooltip="$t('label.update.custom.action')"
              icon="edit-outlined"
              @click="openUpdateCustomActionModal(record)" />
          </span>
          <span style="margin-right: 5px">
            <a-popconfirm
              v-if="'updateCustomAction' in $store.getters.apis"
              placement="topRight"
              :title="record.enabled ? $t('message.confirm.disable.custom.action') : $t('message.confirm.enable.custom.action')"
              :ok-text="$t('label.yes')"
              :cancel-text="$t('label.no')"
              :loading="updateLoading"
              @confirm="updateCustomAction(record)"
            >
              <tooltip-button
                :tooltip="record.enabled ? $t('label.disable.custom.action') : $t('label.enable.custom.action')"
                :icon="record.enabled ? 'pause-circle-outlined' : 'play-circle-outlined'" />
            </a-popconfirm>
          </span>
          <span style="margin-right: 5px">
            <a-popconfirm
              v-if="'deleteCustomAction' in $store.getters.apis"
              placement="topRight"
              :title="$t('message.action.delete.custom.action')"
              :ok-text="$t('label.yes')"
              :cancel-text="$t('label.no')"
              :loading="deleteLoading"
              @confirm="deleteCustomAction(record)"
            >
              <tooltip-button
                :tooltip="$t('label.delete.custom.action')"
                type="primary"
                :danger="true"
                icon="delete-outlined" />
            </a-popconfirm>
          </span>
        </template>
      </template>
      <template #expandedRowRender="{ record }">
        <strong>{{ $t('label.parameters') }}</strong>
        <object-list-table
          :showHeader="true"
          :data-array="record.parameters" />
      </template>
    </a-table>
    <a-pagination
      style="margin-top: 12px"
      size="small"
      :current="page"
      :page-size="pageSize"
      :total="totalCount"
      :show-total="total => $t('label.total') + ' ' + total + ' ' + $t('label.items')"
      :page-size-options="['10', '20', '40', '80']"
      show-size-changer
      @change="changePage" />

    <a-modal
      style="min-width: 1000px;"
      :visible="showAddCustomAction"
      :title="$t('label.add.custom.action')"
      :maskClosable="false"
      :closable="true"
      :footer="null"
      @cancel="closeModals">
      <add-custom-action :extension="resource" @close-action="closeModals" />
    </a-modal>

    <a-modal
      style="min-width: 1000px;"
      :visible="showUpdateCustomAction"
      :title="$t('label.update.custom.action')"
      :maskClosable="false"
      :closable="true"
      :footer="null"
      @cancel="closeModals">
      <update-custom-action
      :key="customActionForUpdate.id"
      :resource="customActionForUpdate"
      @close-action="closeModals" />
    </a-modal>
  </div>
</template>

<script>
import { listRefreshMixin } from '@/utils/listRefreshMixin'

import { getAPI, postAPI } from '@/api'
import ObjectListTable from '@/components/view/ObjectListTable.vue'
import TooltipButton from '@/components/widgets/TooltipButton'
import AddCustomAction from '@/views/extension/AddCustomAction.vue'
import UpdateCustomAction from '@/views/extension/UpdateCustomAction.vue'
import Status from '@/components/widgets/Status'

export default {
  mixins: [listRefreshMixin(['fetchCustomActions'])],
  name: 'ExtensionCustomActionsTab',
  components: {
    ObjectListTable,
    TooltipButton,
    AddCustomAction,
    UpdateCustomAction,
    Status
  },
  props: {
    resource: {
      type: Object,
      required: true
    }
  },
  data () {
    return {
      tabLoading: false,
      columns: [
        {
          key: 'name',
          title: this.$t('label.name'),
          dataIndex: 'name'
        },
        {
          key: 'enabled',
          title: this.$t('label.state'),
          dataIndex: 'enabled'
        },
        {
          title: this.$t('label.resourcetype'),
          dataIndex: 'resourcetype'
        },
        {
          key: 'created',
          title: this.$t('label.created'),
          dataIndex: 'created'
        },
        {
          key: 'actions',
          title: this.$t('label.actions')
        }
      ],
      page: 1,
      pageSize: 20,
      totalCount: 0,
      showAddCustomAction: false,
      updateLoading: false,
      deleteLoading: false,
      showUpdateCustomAction: false,
      customActionForUpdate: {}
    }
  },
  computed: {
    extensionResources () {
      return this.resource?.resources || []
    }
  },
  created () {
    this.fetchData()
  },
  watch: {
    resource: {
      handler () {
        this.fetchCustomActions()
      }
    }
  },
  methods: {
    fetchData () {
      this.fetchCustomActions()
    },
    changePage (page, size) {
      this.page = size === this.pageSize ? page : 1
      this.pageSize = size
      this.fetchCustomActions()
    },
    fetchCustomActions () {
      const listRequest = this.listRequestToken('fetchCustomActions')

      if (!this.resource.id) {
        return
      }
      const params = {
        page: this.page,
        pagesize: this.pageSize,
        extensionid: this.resource.id,
        listall: true
      }
      this.tabLoading = !listRequest.loaded
      return getAPI('listCustomActions', params).then(json => {
        if (!this.isListRequestCurrent('fetchCustomActions', listRequest)) return
        this.totalCount = json?.listcustomactionsresponse?.count || 0
        const lastPage = Math.max(1, Math.ceil(this.totalCount / this.pageSize))
        if (this.page > lastPage) {
          this.page = lastPage
          return this.fetchCustomActions()
        }
        this.extensionCustomActions = json?.listcustomactionsresponse?.extensioncustomaction || []
        this.tabLoading = false
      }).catch(error => {
        if (!this.isListRequestCurrent('fetchCustomActions', listRequest)) return
        listRequest.failed = true
        this.listRefreshFailed = true
        if (listRequest.loaded) return

        this.$notifyError(error)
      }).finally(() => {
        if (!this.isListRequestCurrent('fetchCustomActions', listRequest)) return
        this.tabLoading = false
      })
    },
    showAddCustomActionModal () {
      this.showAddCustomAction = true
    },
    openUpdateCustomActionModal (action) {
      this.customActionForUpdate = action
      this.showUpdateCustomAction = true
    },
    closeModals () {
      this.showAddCustomAction = false
      this.showUpdateCustomAction = false
      this.customActionForUpdate = {}
    },
    updateCustomAction (record) {
      const params = {
        id: record.id,
        enabled: !record.enabled
      }
      this.updateLoading = true
      postAPI('updateCustomAction', params).then(json => {
        this.fetchCustomActions()
        this.$notification.success({
          message: record.enabled ? this.$t('label.disable.custom.action') : this.$t('label.enable.custom.action'),
          description: this.$t('message.success.update.custom.action')
        })
      }).catch(error => {
        this.$notifyError(error)
      }).finally(() => {
        this.updateLoading = false
      })
    },
    deleteCustomAction (record) {
      const params = {
        id: record.id
      }
      this.deleteLoading = true
      postAPI('deleteCustomAction', params).then(json => {
        this.fetchCustomActions()
        this.$notification.success({
          message: this.$t('label.delete.custom.action'),
          description: this.$t('message.success.delete.custom.action')
        })
      }).catch(error => {
        this.$notifyError(error)
      }).finally(() => {
        this.deleteLoading = false
      })
    }
  }
}
</script>
