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
        <a-col :span="12" class="configuration-search-tools">
          <a-popover v-model:visible="filtersOpen" trigger="click" placement="bottomRight">
            <template #content>
              <form class="configuration-filters" @submit.prevent="applyFilters">
                <label for="configuration-name-filter">{{ $t('label.global.setting.key') }}</label>
                <a-input id="configuration-name-filter" v-model:value="nameDraft" allow-clear />
                <label for="configuration-category-filter">{{ $t('label.category') }}</label>
                <a-input id="configuration-category-filter" v-model:value="categoryDraft" allow-clear />
                <a-button type="primary" html-type="submit">{{ $t('label.apply') }}</a-button>
              </form>
            </template>
            <a-button :aria-label="$t('label.filterby')"><FilterOutlined /></a-button>
          </a-popover>
          <a-input-search
            :placeholder="$t('label.search')"
            :aria-label="$t('label.search')"
            v-model:value="filterDraft"
            allow-clear
            @search="setConfigurationQuery({ filter: $event, page: 1 })" />
        </a-col>
      </a-card>
    </a-col>
    <a-col :span="24">
      <a-card style="margin-left: 10px;">
        <div v-if="activeFilters.length" class="configuration-active-filters">
          <a-tag
            v-for="condition in activeFilters"
            :key="condition.key"
            closable
            @close.prevent="setConfigurationQuery({ [condition.key]: '', page: 1 })">
            {{ $t(condition.label) }} {{ condition.value }}
          </a-tag>
        </div>
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
import { FilterOutlined } from '@ant-design/icons-vue'
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
import { readConfigurationQuery, writeConfigurationQuery, listConfigurationParams } from './configurationQuery'

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
    FilterOutlined,
    OsLogo,
    Status,
    ActionButton,
    InfoCard,
    TooltipButton,
    ConfigurationHierarchy,
    ConfigurationTable
  },
  mixins: [listRefreshMixin(['fetchConfigurationData'], { active: vm => vm.groupsLoaded }), mixin, mixinDevice],
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
      groupsLoaded: false,
      config: [],
      expandedRows: {},
      parentLookup: 0,
      configLoading: true,
      filterDraft: '',
      nameDraft: '',
      categoryDraft: '',
      filtersOpen: false,
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
    defaultPageSize () {
      return Number(this.$store.getters.defaultListViewPageSize) || 20
    },
    queryState () {
      return readConfigurationQuery(this.$route.query, this.groups, this.defaultPageSize)
    },
    group () {
      return this.queryState.group
    },
    subgroup () {
      return this.queryState.subgroup
    },
    page () {
      return this.queryState.page
    },
    pagesize () {
      return this.queryState.pagesize
    },
    activeFilters () {
      return [
        { key: 'filter', label: 'label.search', value: this.queryState.filter },
        { key: 'name', label: 'label.global.setting.key', value: this.queryState.name },
        { key: 'category', label: 'label.category', value: this.queryState.category }
      ].filter(condition => condition.value)
    },
    sectionKey () {
      return JSON.stringify([this.group, this.subgroup])
    },
    hierarchy () {
      return buildConfigurationHierarchy(this.config)
    }
  },
  watch: {
    '$route.fullPath' () {
      if (this.groupsLoaded && this.$route.meta.name === 'globalsetting') {
        this.applyConfigurationRoute()
      }
    }
  },
  created () {
    this.fetchConfigurationGroups()
  },
  methods: {
    applyConfigurationRoute () {
      this.filterDraft = this.queryState.filter
      this.nameDraft = this.queryState.name
      this.categoryDraft = this.queryState.category
      this.filtersOpen = false
      return this.fetchConfigurationData()
    },
    fetchConfigurationGroups () {
      this.configLoading = true
      const params = {
        pagesize: -1
      }
      getAPI('listConfigurationGroups', params).then(response => {
        this.groups = response.listconfigurationgroupsresponse.configurationgroup || []
      }).catch(error => {
        console.error(error)
        this.$message.error(this.$t('message.error.loading.setting'))
      }).finally(() => {
        if (!this.listRefreshDisposed) {
          this.groupsLoaded = true
          this.applyConfigurationRoute()
        }
      })
    },
    fetchConfigurationData () {
      const listRequest = this.listRequestToken('fetchConfigurationData')
      this.configLoading = !listRequest.loaded
      const params = listConfigurationParams(this.queryState)

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
      const path = this.$route.fullPath
      const isCurrent = () => !this.listRefreshDisposed && request === this.parentLookup && path === this.$route.fullPath
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
        await this.setConfigurationQuery({
          group: subgroup ? group.name : '',
          subgroup: subgroup?.name || '',
          filter: parent.name,
          name: '',
          category: '',
          page: 1
        })
      } catch (error) {
        if (isCurrent()) {
          this.$message.error(this.$t('message.error.loading.setting'))
        }
      }
    },
    changePage (page, pagesize) {
      const pageChanged = pagesize === this.pagesize
      return this.setConfigurationQuery({ page: pageChanged ? page : 1, pagesize })
    },
    setConfigurationQuery (changes) {
      const state = { ...this.queryState, ...changes }
      const query = { ...this.$route.query, ...writeConfigurationQuery(state, this.defaultPageSize) }
      if (this.$router.resolve({ query }).fullPath === this.$route.fullPath) {
        return this.fetchConfigurationData()
      }
      return this.$router.push({ query })
    },
    applyFilters () {
      this.filtersOpen = false
      return this.setConfigurationQuery({ name: this.nameDraft, category: this.categoryDraft, page: 1 })
    },
    changeGroupTab (name) {
      const group = this.groups.find(entry => entry.name === name)
      return this.setConfigurationQuery({ group: group?.name || '', subgroup: group?.subgroup?.[0]?.name || '', page: 1 })
    },
    changeSubgroupTab (name) {
      return this.setConfigurationQuery({ subgroup: name, page: 1 })
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
  .configuration-search-tools {
    display: flex;
    justify-content: flex-end;
    align-items: flex-start;
    gap: 8px;
  }

  .configuration-search-tools .ant-input-search {
    width: min(25vw, 100%);
  }

  .configuration-filters {
    width: min(260px, 75vw);
    display: grid;
    gap: 8px;
  }

  .configuration-active-filters {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 10px;
  }

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
