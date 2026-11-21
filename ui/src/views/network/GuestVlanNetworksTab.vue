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
  <section class="guest-vlan-network-tab" :aria-busy="fetchLoading">
    <a-alert
      v-if="listRefreshFailed"
      class="guest-vlan-network-status"
      :type="networks.length ? 'warning' : 'error'"
      :message="$t(networks.length ? 'message.list.refresh.stale' : 'error.fetching.data')"
      show-icon>
      <template #description>
        <a-button size="small" :loading="listRefreshing > 0 || fetchLoading" @click="fetchData">{{ $t('label.retry') }}</a-button>
      </template>
    </a-alert>
    <a-empty v-if="!fetchLoading && !listRefreshFailed && !networks.length" :description="$t(missing ? 'message.guest.vlan.missing' : 'message.guest.vlan.networks.empty')" />
    <div
      v-else-if="fetchLoading || networks.length"
      tabindex="0"
      role="region"
      :aria-label="$t('label.guest.networks')"
      class="guest-vlan-network-table">
      <a-table
        size="small"
        table-layout="fixed"
        :columns="columns"
        :dataSource="networks"
        :rowKey="item => item.id"
        :pagination="false"
        :loading="fetchLoading"
      >
        <template #bodyCell="{ column, text, record }">
          <template v-if="column.key === 'name'">
            <router-link v-if="guestVlanNetworkLocation(record, $store.getters.apis)" :to="guestVlanNetworkLocation(record, $store.getters.apis)">{{ text }}</router-link>
            <span v-else>{{ text }}</span>
          </template>
          <template v-if="column.dataIndex === 'type' && text">{{ $t(networkTypeLabel(text)) }}</template>
          <template v-if="column.key === 'vpcname'">
            <router-link v-if="guestVlanVpcLocation(record, $store.getters.apis)" :to="guestVlanVpcLocation(record, $store.getters.apis)">{{ text || record.vpcid }}</router-link>
            <span v-else>{{ text || record.vpcid || '—' }}</span>
          </template>
          <template v-if="column.key === 'state'">
            <status :text="record.state" :display-label="$t(networkStateLabel(record.state))" display-text />
          </template>
        </template>
      </a-table>
    </div>
  </section>
</template>

<script>
import { Empty } from 'ant-design-vue'
import { listRefreshMixin } from '@/utils/listRefreshMixin'

import { getAPI } from '@/api'
import Status from '@/components/widgets/Status'
import { networkStateLabel, networkTypeLabel } from '@/utils/networkLifecycle'
import { guestVlanNetworkLocation, guestVlanVpcLocation } from '@/utils/guestVlan'

export default {
  mixins: [listRefreshMixin(['fetchData'], {
    scopeKey: vm => [vm.$route.params?.id, vm.resource.id, vm.$store.state?.user?.token]
  })],
  name: 'GuestVlanNetworksTab',
  components: {
    AEmpty: Empty,
    Status
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
      networks: [],
      missing: false,
      columns: [
        {
          key: 'name',
          title: this.$t('label.name'),
          dataIndex: 'name'
        },
        {
          title: this.$t('label.type'),
          dataIndex: 'type'
        },
        {
          key: 'state',
          title: this.$t('label.state')
        },
        {
          title: this.$t('label.broadcasturi'),
          dataIndex: 'broadcasturi'
        },
        {
          title: this.$t('label.domain'),
          dataIndex: 'domain'
        },
        {
          title: this.$t('label.account'),
          dataIndex: 'account'
        },
        {
          title: this.$t('label.project'),
          dataIndex: 'project'
        },
        {
          title: this.$t('label.vpc'),
          key: 'vpcname',
          dataIndex: 'vpcname'
        }
      ]
    }
  },
  created () {
    this.fetchData()
  },
  watch: {
    'resource.id' () {
      this.networks = []
      this.missing = false
      this.listRefreshFailed = false
      if (this.resource.id) this.fetchData()
    },
    loading (busy) {
      if (!busy && this.resource.id) this.fetchData()
    }
  },
  methods: {
    networkStateLabel,
    networkTypeLabel,
    guestVlanNetworkLocation,
    guestVlanVpcLocation,
    async fetchData () {
      const id = this.resource.id
      if (!id || String(id) !== String(this.$route.params.id)) return
      const request = this.listRequestToken('fetchData')
      const current = () => this.isListRequestCurrent('fetchData', request)
      this.fetchLoading = !request.loaded
      try {
        const response = await getAPI('listGuestVlans', { id, ignoreproject: true }, { preserveOnFailure: true, timeout: 20000 })
        if (!current()) return
        const result = response?.listguestvlansresponse
        if (!result || result.errorcode || (result.guestvlan != null && !Array.isArray(result.guestvlan))) {
          throw new Error('Invalid guest VLAN response')
        }
        const vlan = result.guestvlan?.find(row => String(row.id) === String(id))
        this.missing = !vlan
        this.networks = vlan?.network || []
      } catch (error) {
        if (!current()) return
        request.failed = true
        this.listRefreshFailed = true
      } finally {
        if (current()) this.fetchLoading = false
      }
    }
  }
}
</script>
<style scoped>
.guest-vlan-network-status { margin-bottom: 12px; }
.guest-vlan-network-table { max-width: 100%; overflow-x: auto; }
.guest-vlan-network-table:focus-visible { outline: 2px solid var(--ui-focus); outline-offset: -2px; }
.guest-vlan-network-table :deep(.ant-table) { min-width: 960px; }
.guest-vlan-network-table :deep(.ant-table-cell) { overflow-wrap: anywhere; }
</style>
