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
  <section class="host-oobm-content" :aria-label="$t('label.outofbandmanagement')">
    <a-alert v-if="listRefreshFailed" type="error" show-icon>
      <template #message>
        <a-space wrap>
          <span>{{ $t('message.host.oobm.failed') }}</span>
          <a-button size="small" @click="fetchData">{{ $t('label.retry') }}</a-button>
        </a-space>
      </template>
    </a-alert>
    <a-spin :spinning="fetchLoading">
      <a-descriptions v-if="host.outofbandmanagement" size="small" bordered :column="{ xs: 1, sm: 1, lg: 2 }">
        <a-descriptions-item :label="$t('label.outofbandmanagement.enable')">
          <a-tag :color="hostStatusColor(host.outofbandmanagement.enabled)">{{ $t(hostStatusLabel(host.outofbandmanagement.enabled)) }}</a-tag>
        </a-descriptions-item>
        <a-descriptions-item :label="$t('label.powerstate')">
          <a-tag :color="hostStatusColor(host.outofbandmanagement.powerstate)">{{ $t(hostStatusLabel(host.outofbandmanagement.powerstate)) }}</a-tag>
        </a-descriptions-item>
        <a-descriptions-item v-for="entry in configuration" :key="entry[0]" :label="$t('label.' + entry[0])">{{ entry[1] }}</a-descriptions-item>
      </a-descriptions>
      <a-empty v-else-if="!listRefreshFailed && !fetchLoading" :description="$t(host.hypervisor === 'External' ? 'message.host.oobm.unsupported' : 'message.host.oobm.unconfigured')" />
    </a-spin>
  </section>
</template>

<script>
import { listRefreshMixin } from '@/utils/listRefreshMixin'

import { getAPI } from '@/api'
import { hostStatusColor, hostStatusLabel } from '@/utils/hostPresentation'

export default {
  mixins: [listRefreshMixin(['fetchData'])],
  name: 'HostInfo',
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
      host: {},
      fetchLoading: false
    }
  },
  created () {
    this.fetchData()
  },
  watch: {
    resource: {
      deep: true,
      handler (newItem, oldItem) {
        if (this.resource) {
          this.host = this.resource
          if (this.resource.id && newItem && newItem.id !== oldItem.id) {
            this.fetchData()
          }
        }
      }
    }
  },
  computed: {
    configuration () {
      const remote = this.host.outofbandmanagement || {}
      const settings = this.host.details || {}
      return [
        ['driver', remote.driver],
        ['address', remote.address],
        ['port', remote.port],
        ['username', remote.username],
        ['manageconsoleprotocol', settings.manageconsoleprotocol],
        ['manageconsoleport', settings.manageconsoleport]
      ].filter(([, value]) => value !== undefined && value !== null && value !== '')
    }
  },
  methods: {
    hostStatusColor,
    hostStatusLabel,
    fetchData () {
      const listRequest = this.listRequestToken('fetchData')
      this.fetchLoading = !listRequest.loaded
      return getAPI('listHosts', { id: this.resource.id }, { preserveOnFailure: true }).then(json => {
        if (!this.isListRequestCurrent('fetchData', listRequest)) return

        const host = json.listhostsresponse?.host?.find(row => row.id === this.resource.id)
        if (!host) throw new Error(this.$t('message.host.oobm.failed'))
        this.host = host
        this.listRefreshFailed = false
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
    }
  }
}
</script>

<style scoped>
.host-oobm-content {
  min-width: 0;
  display: grid;
  gap: 12px;
}

.host-oobm-content :deep(.ant-descriptions-item-content) {
  overflow-wrap: anywhere;
  color: var(--ui-text);
}
</style>
