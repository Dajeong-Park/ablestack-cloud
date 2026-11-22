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
  <a-row>
    {{ $t('message.drs.plan.description') }}
  </a-row>
  <a-row>
    <strong>{{ $t('label.algorithm') }}:</strong>&nbsp;{{ algorithm }}
  </a-row>
  <br/>
  <a-row>
    <a-col>
      <a-input-number
          v-model:value="maxMigrations"
          :addonBefore="$t('label.max.migrations')"
          :min="1"
          :disabled="configLoading || planning || executing"
          :step="1"
        />
        &nbsp;&nbsp;
    </a-col>
    <a-col>
      <a-button
        type="primary"
        @click="generateDrsPlan"
        :loading="planning"
        :disabled="!canGenerate || configLoading || planning || executing">
        {{ $t('label.drs.generate.plan') }}
      </a-button>
    </a-col>
  </a-row>
  <a-alert v-if="generationError" type="error" show-icon :message="$t(generationError)" />
  <br/>
  <a-table
    size="small"
    :columns="drsPlanColumns"
    :dataSource="drsPlans"
    :rowKey="item => item.id"
    :pagination="{hideOnSinglePage: true, showSizeChanger: true}"
    :expandRowByClick="true"
  >
    <template #expandedRowRender="{ record }">
      <a-table
        size="small"
        :columns="migrationColumns"
        :dataSource="record.migrations"
        :rowKey="(record, index) => index"
        :pagination="{hideOnSinglePage: true, showSizeChanger: true}"
        @resizeColumn="resizeColumn">
        <template #bodyCell="{ column, text, record }">
          <template v-if="column.key === 'vm'">
            <router-link :to="{ path: '/vm/' + record.virtualmachineid }">
              <desktop-outlined/> {{ record.virtualmachinename }}
            </router-link>
          </template>
          <template v-else-if="column.key === 'sourcehost'">
            <router-link :to="{ path: '/host/' + record.sourcehostid }">
              <cluster-outlined/> {{ record.sourcehostname }}
            </router-link>
          </template>
          <template v-else-if="column.key === 'destinationhost'">
            <router-link :to="{ path: '/host/' + record.destinationhostid }">
              <cluster-outlined/> {{ record.destinationhostname }}
            </router-link>
          </template>
          <template v-else>
            {{ text }}
          </template>
        </template>
      </a-table>
      <br/>
    </template>
    <template #bodyCell="{ column, text }">
      <template v-if="column.key === 'successfulMigrations'">
        {{  text.migrations.filter(m => m.jobstatus === 'SUCCEEDED').length }} / {{  text.migrations.length }}
        <!-- {{  text.migrations }} -->
      </template>
      <template v-else-if="column.key === 'created'">
        {{ $toLocaleDate(text) }}
      </template>
      <template v-else-if="column.key === 'eventid'" >
        <router-link :to="{ path: '/event', query: { startid: text} }" target="_blank">
          <schedule-outlined /> {{ $t('label.events') }}
        </router-link>
      </template>
      <template v-else>
        {{ text }}
      </template>
    </template>
  </a-table>

  <a-modal
    width="50%"
    :visible="showModal"
    :title="$t('label.drs.plan')"
    :maskClosable="false"
    :closable="!executing"
    :keyboard="!executing"
    :confirmLoading="executing"
    :cancelButtonProps="{ disabled: executing }"
    :okButtonProps="{ disabled: executing, style: { display: canExecute && generatedMigrations.length ? undefined : 'none' } }"
    :okText="$t('label.execute')"
    :cancelText="$t('label.cancel')"
    @ok="executeDrsPlan"
    @cancel="closeModal">
    <a-alert v-if="executionError" type="error" show-icon :message="$t(executionError)" />
    <a-table
      v-if="generatedMigrations.length > 0"
      size="small"
      :columns="generatedPlanMigrationColumns"
      :dataSource="generatedMigrations"
      :rowKey="(record, index) => index"
      :pagination="{ showTotal: (total, range) => [range[0], '-', range[1], $t('label.of'), total, $t('label.items')].join(' ') }"
      @resizeColumn="resizeColumn" >
      <template #bodyCell="{ column, text, record }">
        <template v-if="column.key === 'vm'">
          <router-link :to="{ path: '/vm/' + record.virtualmachineid }">
            <desktop-outlined/> {{ record.virtualmachinename }}
          </router-link>
        </template>
        <template v-else-if="column.key === 'sourcehost'">
          <router-link :to="{ path: '/host/' + record.sourcehostid }">
            <cluster-outlined/> {{ record.sourcehostname }}
          </router-link>
        </template>
        <template v-else-if="column.key === 'destinationhost'">
          <router-link :to="{ path: '/host/' + record.destinationhostid }">
            <cluster-outlined/> {{ record.destinationhostname }}
          </router-link>
        </template>
        <template v-else>
          {{ text }}
        </template>
      </template>
    </a-table>
    <p v-else>
      {{ $t('label.drs.no.plan.generated') }}
    </p>

  </a-modal>

</template>

<script>
import { listRefreshMixin } from '@/utils/listRefreshMixin'

import { getAPI, postAPI } from '@/api'

export default {
  mixins: [listRefreshMixin(['fetchDRSPlans'])],
  name: 'ClusterDrsTab',
  props: {
    resource: {
      type: Object,
      required: true
    }
  },
  data () {
    const generatedPlanMigrationColumns = [
      {
        key: 'vm',
        title: this.$t('label.vm'),
        dataIndex: 'vm',
        ellipsis: true,
        resizable: true
      },
      {
        key: 'sourcehost',
        title: this.$t('label.sourcehost'),
        dataIndex: 'sourcehost',
        ellipsis: true,
        resizable: true
      },
      {
        key: 'destinationhost',
        title: this.$t('label.desthost'),
        dataIndex: 'created',
        ellipsis: true,
        resizable: true
      }
    ]
    return {
      drsPlanColumns: [
        {
          title: this.$t('label.type'),
          dataIndex: 'type'
        },
        {
          title: this.$t('label.success.migrations'),
          key: 'successfulMigrations'
        },
        {
          title: this.$t('label.status'),
          dataIndex: 'status'
        },
        {
          key: 'created',
          title: this.$t('label.created'),
          dataIndex: 'created'
        },
        {
          key: 'eventid',
          title: this.$t('label.events'),
          dataIndex: 'eventid'
        }
      ],
      generatedPlanMigrationColumns: generatedPlanMigrationColumns,
      migrationColumns: generatedPlanMigrationColumns.concat([
        {
          key: 'jobstatus',
          title: this.$t('label.status'),
          dataIndex: 'jobstatus'
        }
      ]),
      configLoading: false,
      planning: false,
      executing: false,
      generationError: '',
      executionError: '',
      viewVersion: 0,
      planClusterId: '',
      drsPlans: [],
      algorithm: '',
      maxMigrations: undefined,
      generatedMigrations: [],
      showModal: false
    }
  },
  computed: {
    canGenerate () { return Boolean(this.$store.getters.apis?.generateClusterDrsPlan) },
    canExecute () { return Boolean(this.$store.getters.apis?.executeClusterDrsPlan) }
  },
  watch: {
    'resource.id' (id, previous) {
      if (id === previous) return
      this.viewVersion++
      this.planning = false
      this.executing = false
      this.configLoading = false
      this.generationError = ''
      this.algorithm = ''
      this.maxMigrations = undefined
      this.drsPlans = []
      this.closeModal()
      this.fetchDRSPlans()
      this.fetchDrsConfig()
    }
  },
  created () {
    this.fetchDRSPlans()
    this.fetchDrsConfig()
  },
  beforeUnmount () {
    this.viewVersion++
  },
  methods: {
    isCurrentCluster (id, version) {
      const routeId = this.$route.params?.id
      return this.viewVersion === version && this.resource.id === id && (!routeId || routeId === id)
    },
    async fetchDRSPlans () {
      const listRequest = this.listRequestToken('fetchDRSPlans')
      const clusterid = this.resource.id
      if (!clusterid || !this.$store.getters.apis?.listClusterDrsPlan) return
      try {
        const response = await getAPI('listClusterDrsPlan', { page: 1, pagesize: 500, clusterid }, { preserveOnFailure: true })
        if (!this.isListRequestCurrent('fetchDRSPlans', listRequest)) return
        this.drsPlans = response.listclusterdrsplanresponse?.drsPlan || []
      } catch (error) {
        if (!this.isListRequestCurrent('fetchDRSPlans', listRequest)) return
        listRequest.failed = true
        this.listRefreshFailed = true
        if (!listRequest.loaded) this.$notifyError(error)
      }
    },
    async executeDrsPlan () {
      const id = this.resource.id
      const version = this.viewVersion
      if (this.executing || !this.canExecute || !this.generatedMigrations.length || this.planClusterId !== id || !this.isCurrentCluster(id, version)) return

      this.executing = true
      this.executionError = ''
      const params = { id }
      this.generatedMigrations.forEach((mapping, index) => {
        params['migrateto[' + index + '].vm'] = mapping.virtualmachineid
        params['migrateto[' + index + '].host'] = mapping.destinationhostid
      })

      try {
        await postAPI('executeClusterDrsPlan', params, { preserveOnFailure: true })
        if (!this.isCurrentCluster(id, version)) return
        this.$message.success(this.$t('message.drs.plan.executed'))
        this.executing = false
        this.closeModal()
        await this.fetchDRSPlans()
      } catch {
        if (this.isCurrentCluster(id, version)) this.executionError = 'message.drs.plan.execution.failed'
      } finally {
        if (this.isCurrentCluster(id, version)) this.executing = false
      }
    },
    async generateDrsPlan () {
      const id = this.resource.id
      const version = this.viewVersion
      if (!id || this.planning || this.executing || this.configLoading || !this.canGenerate || !this.isCurrentCluster(id, version)) return

      this.generationError = ''
      const migrations = this.maxMigrations == null ? undefined : Number(this.maxMigrations)
      if (migrations !== undefined && (!Number.isInteger(migrations) || migrations < 1)) {
        this.generationError = 'message.drs.plan.invalid.limit'
        return
      }
      this.planning = true
      try {
        const response = await postAPI('generateClusterDrsPlan', { id, migrations }, { preserveOnFailure: true })
        if (!this.isCurrentCluster(id, version)) return
        const envelope = response.generateclusterdrsplanresponse || {}
        const entries = (envelope.generateclusterdrsplanresponse || envelope).migrations
        this.generatedMigrations = Array.isArray(entries) ? entries : []
        this.planClusterId = id
        this.executionError = ''
        this.showModal = true
      } catch {
        if (this.isCurrentCluster(id, version)) this.generationError = 'message.drs.plan.generation.failed'
      } finally {
        if (this.isCurrentCluster(id, version)) this.planning = false
      }
    },
    async fetchDrsConfig () {
      const clusterid = this.resource.id
      const version = this.viewVersion
      if (!clusterid || !this.$store.getters.apis?.listConfigurations) return
      this.configLoading = true
      try {
        const [algorithm, limit] = await Promise.all(
          ['drs.algorithm', 'drs.max.migrations'].map(name =>
            getAPI('listConfigurations', { clusterid, name }, { preserveOnFailure: true })
              .then(response => response.listconfigurationsresponse?.configuration?.[0]?.value))
        )
        if (!this.isCurrentCluster(clusterid, version)) return
        this.algorithm = algorithm || ''
        const max = Number(limit)
        this.maxMigrations = Number.isInteger(max) && max > 0 ? max : undefined
      } catch (error) {
        if (this.isCurrentCluster(clusterid, version)) this.$notifyError(error)
      } finally {
        if (this.isCurrentCluster(clusterid, version)) this.configLoading = false
      }
    },
    closeModal () {
      if (this.executing) return
      this.showModal = false
      this.generatedMigrations = []
      this.planClusterId = ''
      this.executionError = ''
    },
    resizeColumn (w, col) {
      col.width = w
    }
  }
}
</script>
