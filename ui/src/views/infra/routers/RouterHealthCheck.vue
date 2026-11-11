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
  <a-spin :spinning="loading">
    <p v-if="listRefreshFailed" role="status">{{ $t('message.list.refresh.stale') }}</p>
    <a-alert
      v-if="!routerHealthChecksEnabled"
      banner
      :message="$t('message.action.router.health.checks.disabled.warning')" />
    <div v-else class="router-health-checks">
      <div class="detail-tab-toolbar">
      <a-button :disabled="!canRead || loading || listRefreshing > 0" type="primary" @click="showGetHelathCheck">
        <template #icon><play-circle-outlined /></template>
        {{ $t('label.action.router.health.checks') }}
      </a-button>
      <a-button :loading="loading || listRefreshing > 0" :disabled="!canRead || loading || listRefreshing > 0" @click="getHealthChecks()">
        <template #icon><reload-outlined /></template>{{ $t('label.refresh') }}
      </a-button>
      </div>
      <a-table
        :columns="columns"
        :dataSource="healthChecks"
        :pagination="false"
        :rowKey="record => record.checkname"
        :scroll="{ x: 760 }"
        size="small">
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'status'">
            <status class="status" :text="record.status" displayText />
          </template>
          <template v-if="column.key === 'details'"><div class="router-health-checks__details">{{ record.details || '—' }}</div></template>
        </template>
      </a-table>

      <MoldDialog
        v-if="canRead && showGetHealthChecksForm"
        size="md"
        form-actions
        :title="$t('label.action.router.health.checks')"
        :visible="showGetHealthChecksForm"
        @cancel="onCloseGetHealthChecksForm"
        >
        <a-spin :spinning="loading" v-ctrl-enter="handleGetHealthChecksSubmit">
          <a-form
            :ref="formRef"
            :model="form"
            :rules="rules"
            @finish="handleGetHealthChecksSubmit"
            layout="vertical"
           >
            <a-form-item name="performfreshchecks" ref="performfreshchecks">
              <template #label>
                <tooltip-label :title="$t('label.perform.fresh.checks')" :tooltip="apiParams.performfreshchecks.description"/>
              </template>
              <a-switch
                v-model:checked="form.performfreshchecks"
                :disabled="loading || listRefreshing > 0"
                :placeholder="apiParams.performfreshchecks.description"
                v-focus="true"/>
            </a-form-item>

            <MoldDialogActions :busy="loading || listRefreshing > 0">
              <a-button @click="onCloseGetHealthChecksForm">{{ $t('label.cancel') }}</a-button>
              <a-button ref="submit" type="primary" @click="handleGetHealthChecksSubmit">{{ $t('label.ok') }}</a-button>
            </MoldDialogActions>
          </a-form>
        </a-spin>
      </MoldDialog>
    </div>
  </a-spin>
</template>

<script>
import { listRefreshMixin } from '@/utils/listRefreshMixin'
import MoldDialog from '@/components/view/MoldDialog'
import MoldDialogActions from '@/components/view/MoldDialogActions'
import eventBus from '@/config/eventBus'

import { ref, reactive, toRaw } from 'vue'
import { getAPI } from '@/api'
import Status from '@/components/widgets/Status'
import TooltipLabel from '@/components/widgets/TooltipLabel'

export default {
  mixins: [listRefreshMixin(['getHealthChecks'], { scopeKey: vm => vm.healthScope })],
  name: 'RouterHealthCheck',
  components: {
    Status,
    TooltipLabel,
    MoldDialog,
    MoldDialogActions
  },
  props: {
    resource: {
      type: Object,
      required: true
    }
  },
  data () {
    return {
      routerHealthChecksEnabled: false,
      healthChecks: [],
      loading: false,
      contextSuspended: false,
      configVersion: 0,
      columns: [
        {
          title: this.$t('label.router.health.check.name'),
          dataIndex: 'checkname',
          width: 200
        },
        {
          title: this.$t('label.type'),
          dataIndex: 'checktype',
          width: 95
        },
        {
          key: 'status',
          dataIndex: 'status',
          title: this.$t('label.router.health.check.success'),
          width: 90
        },
        {
          title: this.$t('label.router.health.check.last.updated'),
          dataIndex: 'lastupdated',
          width: 185
        },
        {
          title: this.$t('label.details'),
          key: 'details',
          dataIndex: 'details'
        }
      ],
      showGetHealthChecksForm: false
    }
  },
  computed: {
    canRead () { return !this.contextSuspended && 'getRouterHealthCheckResults' in (this.$store.getters.apis || {}) },
    healthScope () {
      const user = this.$store.getters.userInfo || {}
      return [this.resource.id, this.$route.path, this.$route.query?.tab, this.$store.getters.project?.id,
        user.id, user.roleid, user.roletype, this.contextSuspended, this.$store.state?.user?.token, Object.keys(this.$store.getters.apis || {}).sort()]
    },
    healthContext () { return JSON.stringify(this.healthScope) }
  },
  beforeCreate () {
    this.apiParams = this.$getApiParams('getRouterHealthCheckResults')
  },
  watch: {
    healthContext () {
      this.clearContext()
      if (this.canRead && this.$route.query?.tab === 'router.health.checks') this.checkConfigurationAndGetHealthChecks()
    },
    resource: {
      deep: true,
      handler (newItem) {
        this.updateResource(newItem)
      }
    }
  },
  created () {
    eventBus.on('project-switch-start', this.suspendContext)
    eventBus.on('project-switch-end', this.resumeContext)
    this.initForm()
    this.updateResource(this.resource)
  },
  beforeUnmount () {
    this.configVersion++
    eventBus.off('project-switch-start', this.suspendContext)
    eventBus.off('project-switch-end', this.resumeContext)
  },
  methods: {
    clearContext () { this.configVersion++; this.healthChecks = []; this.showGetHealthChecksForm = false; this.loading = false },
    suspendContext () { this.contextSuspended = true; this.clearContext() },
    resumeContext () { this.contextSuspended = false; this.updateResource(this.resource) },
    initForm () {
      this.formRef = ref()
      this.form = reactive({ performfreshchecks: false })
      this.rules = reactive({})
    },
    updateResource (resource) {
      if (!resource) {
        return
      }
      if (!resource.id) {
        return
      }
      this.checkConfigurationAndGetHealthChecks()
    },
    showGetHelathCheck () {
      if (!this.canRead || this.loading || this.listRefreshing) return
      this.initForm()
      this.showGetHealthChecksForm = true
    },
    onCloseGetHealthChecksForm () {
      if (this.loading || this.listRefreshing) return
      this.showGetHealthChecksForm = false
    },
    handleGetHealthChecksSubmit (e) {
      e.preventDefault()
      if (!this.canRead || this.loading || this.listRefreshing) return
      const context = this.healthContext
      return this.formRef.value.validate().then(async () => {
        const values = toRaw(this.form)
        const success = await this.checkConfigurationAndGetHealthChecks(values.performfreshchecks)
        if (context === this.healthContext && success) this.showGetHealthChecksForm = false
      }).catch(error => {
        this.formRef.value.scrollToField(error.errorFields[0].name)
      })
    },
    async checkConfigurationAndGetHealthChecks (performFreshChecks) {
      if (!this.canRead) return
      if (this.routerHealthChecksEnabled) return this.getHealthChecks(performFreshChecks)
      if (!('listConfigurations' in (this.$store.getters.apis || {}))) return
      const context = this.healthContext; const version = ++this.configVersion
      const current = () => !this.listRefreshDisposed && version === this.configVersion && context === this.healthContext && this.canRead
      var params = { name: 'router.health.checks.enabled' }
      this.loading = true
      try {
        const json = await getAPI('listConfigurations', params, { preserveOnFailure: true })
        if (!current()) return
        this.routerHealthChecksEnabled = false
        if (json.listconfigurationsresponse.configuration !== null) {
          var config = json.listconfigurationsresponse.configuration[0]
          if (config && config.name === params.name) {
            this.routerHealthChecksEnabled = config.value === 'true'
          }
        }
        if (this.routerHealthChecksEnabled) {
          this.loading = false
          return await this.getHealthChecks(performFreshChecks)
        }
      } catch (error) {
        if (!current()) return
        this.$notifyError(error)
      } finally {
        if (current()) this.loading = false
      }
      return false
    },
    getHealthChecks (performFreshChecks) {
      if (!this.canRead || !this.resource.id) return
      const listRequest = this.listRequestToken('getHealthChecks')
      var params = { routerid: this.resource.id }
      if (performFreshChecks) {
        params.performfreshchecks = performFreshChecks
      }
      this.loading = !listRequest.loaded
      return getAPI('getRouterHealthCheckResults', params, { preserveOnFailure: true }).then(json => {
        if (!this.isListRequestCurrent('getHealthChecks', listRequest)) return

        this.healthChecks = json.getrouterhealthcheckresultsresponse.routerhealthchecks.healthchecks
        return true
      }).catch(error => {
        if (!this.isListRequestCurrent('getHealthChecks', listRequest)) return
        listRequest.failed = true
        this.listRefreshFailed = true
        if (listRequest.loaded) return

        this.$notifyError(error)
      }).finally(() => {
        if (!this.isListRequestCurrent('getHealthChecks', listRequest)) return
        this.loading = false
      })
    }
  }
}
</script>

<style scoped lang="less">
.router-health-checks { min-width: 0; }
.router-health-checks__details { white-space: pre-wrap; overflow-wrap: anywhere; }
</style>
