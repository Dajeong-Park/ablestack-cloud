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
  <a-row :gutter="12">
    <a-col :span="24" class="content-breadcrumb">
      <a-card class="breadcrumb-card">
        <a-col :span="12" style="display: inline-flex">
          <breadcrumb style="padding-top: 6px; padding-left: 8px" />
          <a-button
            style="margin-left: 12px; margin-top: 4px"
            :loading="loading"
            size="small"
            shape="round"
            @click="fetchConfigurationData()" >
            <template #icon><ReloadOutlined /></template>
            {{ $t('label.refresh') }}
          </a-button>
        </a-col>
        <a-col :span="12" style="float: right">
          <a-input-search
          style="width: 25vw; float: right; margin-bottom: 10px; z-index: 8; display: flex"
          :placeholder="$t('label.search')"
          v-model:value="filter"
          @search="changePage()"
          v-focus="true" />
        </a-col>
      </a-card>
    </a-col>
    <a-col :span="24">
      <a-card style="margin-left: 10px;">
        <a-spin :spinning="configLoading">
          <a-alert v-if="listRefreshFailed" type="error" show-icon :message="$t('message.error.loading.setting')" />
          <a-tabs
            v-if="!listRefreshFailed || config.length > 0"
            tabPosition="left"
            :animated="false"
            :activeKey="this.group || ''"
            @change="changeGroupTab" >
            <a-tab-pane
              key=''
              tab='All Settings' >
                <ConfigurationTable
                  :columns="columns"
                  :config="config"
                  :count="count"
                  :page="page"
                  :pagesize="pagesize"
                  @change-page="changePage"
                  @refresh-config="handleConfigRefresh" />
            </a-tab-pane>
            <a-tab-pane
              v-for="(group) in groups"
              :key="group.name"
              :tab="group.name" >
              <a-tabs
                :activeKey="this.subgroup || ''"
                :animated="false"
                @change="changeSubgroupTab" >
                <a-tab-pane
                  v-for="(subgroup) in group.subgroup"
                  :key="subgroup.name"
                  :tab="subgroup.name" >
                  <ConfigurationHierarchy
                    v-if="group.name === this.group && subgroup.name === this.subgroup"
                    :columns="columns"
                    :config="hierarchy"
                    :expanded-row-keys="expandedRows[sectionKey] || []"
                    @update:expanded-row-keys="expandedRows[sectionKey] = $event"
                    @open-parent="openParent"
                    @refresh-config="handleConfigRefresh" />
                </a-tab-pane>
              </a-tabs>
            </a-tab-pane>
          </a-tabs>
        </a-spin>
      </a-card>
    </a-col>
  </a-row>
</template>

<script>
import { listRefreshMixin } from '@/utils/listRefreshMixin'

import { getAPI } from '@/api'
import { mixin, mixinDevice } from '@/utils/mixin.js'
import Breadcrumb from '@/components/widgets/Breadcrumb'
import OsLogo from '@/components/widgets/OsLogo'
import Status from '@/components/widgets/Status'
import ActionButton from '@/components/view/ActionButton'
import InfoCard from '@/components/view/InfoCard'
import TooltipButton from '@/components/widgets/TooltipButton'
import ConfigurationHierarchy from './ConfigurationHierarchy'
import ConfigurationTable from './ConfigurationTable'
import { buildConfigurationHierarchy } from './configurationHierarchy'

const securitySettings = new Set([
  'api.source.cidr.checks.enabled',
  'password.policy.allowUseOfLastUsedPassword',
  'password.policy.allowContinuousLettersAndNumbersInputOnKeyboard',
  'password.policy.allowConsecutiveRepetitionsOfSameLettersAndNumbers',
  'password.policy.allowPasswordToContainUsername',
  'password.policy.minimum.digits',
  'password.policy.minimum.lowercase.letters',
  'password.policy.minimum.special.characters',
  'password.policy.minimum.uppercase.letters',
  'password.policy.minimum.length',
  'password.policy.maximum.length',
  'incorrect.login.attempts.allowed',
  'incorrect.login.enable.time',
  'block.exist.connection',
  'api.allowed.source.cidr',
  'concurrent.connect.enabled',
  'event.delete.enabled',
  'event.purge.delay',
  'security.check.interval',
  'integrity.verification.interval',
  'license.check.interval'
])

export default {
  name: 'ConfigurationTab',
  components: {
    Breadcrumb,
    OsLogo,
    Status,
    ActionButton,
    InfoCard,
    TooltipButton,
    ConfigurationHierarchy,
    ConfigurationTable
  },
  mixins: [listRefreshMixin(['fetchConfigurationData']), mixin, mixinDevice],
  props: {
    loading: {
      type: Boolean,
      default: false
    },
    actions: {
      type: Array,
      default: () => []
    }
  },
  data () {
    return {
      groups: [],
      config: [],
      expandedRows: {},
      parentLookup: 0,
      configLoading: true,
      page: 1,
      pagesize: this.$store.getters.defaultListViewPageSize,
      group: '',
      subgroup: '',
      filter: '',
      count: 0,
      apiName: 'listConfigurations',
      columns: [
        {
          title: 'name',
          dataIndex: 'name',
          key: 'name'
        },
        {
          title: 'value',
          dataIndex: 'value',
          key: 'value',
          width: '29%'
        }
      ]
    }
  },
  computed: {
    sectionKey () {
      return JSON.stringify([this.group, this.subgroup])
    },
    hierarchy () {
      return buildConfigurationHierarchy(this.config)
    }
  },
  watch: {
    '$route.fullPath': function () {
      this.group = this.$route.query.group || ''
      this.subgroup = this.$route.query.subgroup || ''
      this.page = parseInt(this.$route.query.page) || 1
      this.pagesize = parseInt(this.$route.query.pagesize) || this.pagesize
      this.filter = this.$route.query.filter || ''
    },
    resource: {
      deep: true,
      handler (newItem) {
        if (!newItem || !newItem.id) {
          return
        }
        this.fetchConfigurationData()
      }
    }
  },
  created () {
    this.fetchConfigurationGroups()
  },
  methods: {
    fetchConfigurationGroups () {
      this.configLoading = true
      const params = {
        pagesize: -1
      }
      getAPI('listConfigurationGroups', params).then(response => {
        this.groups = response.listconfigurationgroupsresponse.configurationgroup
      }).catch(error => {
        console.error(error)
        this.$message.error(this.$t('message.error.loading.setting'))
      }).finally(() => {
        this.group = this.$route.query.group || ''
        this.subgroup = this.$route.query.subgroup || ''
        this.fetchConfigurationData()
      })
    },
    fetchConfigurationData () {
      const listRequest = this.listRequestToken('fetchConfigurationData')
      this.configLoading = !listRequest.loaded
      const params = {
        listAll: true
      }
      if (this.group.length > 0) {
        params.group = this.group
        params.pagesize = -1
      } else {
        params.pagesize = this.pagesize || 20
        params.page = this.page || 1
      }
      if (this.subgroup.length > 0) {
        params.subgroup = this.subgroup
      }
      if (this.filter) {
        params.keyword = this.filter
      }

      return getAPI('listConfigurations', params).then(response => {
        if (!this.isListRequestCurrent('fetchConfigurationData', listRequest)) return

        const config = response.listconfigurationsresponse.configuration || []
        this.count = response.listconfigurationsresponse.count || 0
        this.config = this.visibleConfigurations(config)
        if (!listRequest.loaded) window.scrollTo(0, 0)
      }).catch(error => {
        if (!this.isListRequestCurrent('fetchConfigurationData', listRequest)) return
        listRequest.failed = true
        this.listRefreshFailed = true
        if (listRequest.loaded) return

        console.error(error)
        this.$message.error(this.$t('message.error.loading.setting'))
      }).finally(() => {
        if (!this.isListRequestCurrent('fetchConfigurationData', listRequest)) return
        this.configLoading = false
      })
    },
    visibleConfigurations (configs) {
      if (!this.$store.getters.features.securityfeaturesenabled) return configs
      return configs.filter(record => !securitySettings.has(record.name))
    },
    async openParent (record) {
      const request = ++this.parentLookup
      const section = this.sectionKey
      const filter = this.filter
      const isCurrent = () => !this.listRefreshDisposed && request === this.parentLookup && section === this.sectionKey && filter === this.filter
      try {
        const response = await getAPI('listConfigurations', { name: record.parent, pagesize: -1 })
        if (!isCurrent()) return

        const parent = this.visibleConfigurations(response.listconfigurationsresponse.configuration || [])
          .find(item => item.name === record.parent)
        if (!parent) {
          this.$message.info(this.$t('message.global.setting.parent.unavailable'))
          return
        }
        const group = this.groups.find(item => item.name === parent.group)
        const subgroup = group?.subgroup?.find(item => item.name === parent.subgroup)
        this.group = subgroup ? group.name : ''
        this.subgroup = subgroup?.name || ''
        this.filter = parent.name
        this.changePage(1, this.pagesize)
      } catch (error) {
        if (isCurrent()) {
          this.$message.error(this.$t('message.error.loading.setting'))
        }
      }
    },
    changePage (page, pagesize) {
      const query = {}
      if (page) {
        query.page = page
        this.page = page
      } else {
        this.page = 1
      }
      if (pagesize) {
        query.pagesize = pagesize
        this.pagesize = pagesize
      }
      if (this.filter) {
        query.filter = this.filter
      }
      if (this.group !== '') {
        query.group = this.group
      }
      if (this.subgroup !== '') {
        query.subgroup = this.subgroup
      }
      this.pushToHistory(query)
      this.fetchConfigurationData()
    },
    pushToHistory (query) {
      history.pushState(
        {},
        null,
        '#' + this.$route.path + '?' + Object.keys(query).map(key => {
          return (
            encodeURIComponent(key) + '=' + encodeURIComponent(query[key])
          )
        }).join('&')
      )
    },
    changeGroupTab (e) {
      this.group = e
      if (this.group.length > 0) {
        for (const groupIndex in this.groups) {
          if (this.groups[groupIndex].name === this.group) {
            const group = this.groups[groupIndex]
            this.subgroup = group.subgroup[0].name
          }
        }
      } else {
        this.group = ''
        this.subgroup = ''
        this.changePage(1, this.pagesize)
      }
      if (this.group.length > 0 && this.subgroup.length > 0) {
        const query = Object.assign({}, this.$route.query)
        delete query.page
        delete query.pagesize
        query.group = this.group
        query.subgroup = this.subgroup
        query.filter = this.filter
        // this.pagesize = -1
        this.page = 0
        this.pushToHistory(query)
        this.fetchConfigurationData()
      }
    },
    changeSubgroupTab (e) {
      this.subgroup = e || this.subgroup
      if (this.group.length > 0 && this.subgroup.length > 0) {
        const query = Object.assign({}, this.$route.query)
        delete query.page
        delete query.pagesize
        query.group = this.group
        query.subgroup = this.subgroup
        // this.pagesize = -1
        this.page = 0
        this.pushToHistory(query)
        this.fetchConfigurationData()
      } else {
        history.pushState(
          {},
          null,
          '#' + this.$route.path
        )
      }
    },
    updateConfiguration (name, value) {
      getAPI('updateConfiguration', {
        name: name,
        value: value
      }).then(response => {
        this.$notification.success({
          message: this.$t('message.success'),
          description: this.$t('message.configuration.value.updated')
        })
        this.fetchConfigurationData()
      }).catch(error => {
        this.$notifyError(error)
      })
    },
    handleConfigRefresh (name, updatedRecord) {
      if (!name || !updatedRecord) return
      const index = this.config.findIndex(item => item.name === name)
      if (index !== -1) {
        this.config.splice(index, 1, { ...this.config[index], ...updatedRecord })
      }
    }
  }
}

</script>

<style scoped lang="scss">
  .breadcrumb-card {
    margin-left: -24px;
    margin-right: -24px;
    margin-top: -16px;
    margin-bottom: 12px;
  }

  .shift-btns {
    display: flex;
  }

  .shift-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    font-size: 12px;

    &:not(:last-child) {
      margin-right: 5px;
    }

    &--rotated {
      font-size: 10px;
      transform: rotate(90deg);
    }

  }

  .alert-notification-threshold {
    background-color: rgba(255, 231, 175, 0.75);
    color: #e87900;
    padding: 10%;
  }

  .alert-disable-threshold {
    background-color: rgba(255, 190, 190, 0.75);
    color: #f50000;
    padding: 10%;
  }
</style>
