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
  <a-table
    size="small"
    style="overflow-y: auto"
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
      <template v-if="column.key === 'vpcname'">
        <router-link v-if="guestVlanVpcLocation(record, $store.getters.apis)" :to="guestVlanVpcLocation(record, $store.getters.apis)">{{ text || record.vpcid }}</router-link>
        <span v-else>{{ text || record.vpcid || '—' }}</span>
      </template>
      <template v-if="column.key === 'state'">
        <status :text="record.state" displayText></status>
      </template>
    </template>
  </a-table>
</template>

<script>
import { listRefreshMixin } from '@/utils/listRefreshMixin'

import { getAPI } from '@/api'
import Status from '@/components/widgets/Status'
import { guestVlanNetworkLocation, guestVlanVpcLocation } from '@/utils/guestVlan'

export default {
  mixins: [listRefreshMixin(['fetchData'])],
  name: 'GuestVlanNetworksTab',
  components: {
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
    resource: function (newItem, oldItem) {
      if (!newItem || !newItem.id) {
        return
      }
      this.fetchData()
    }
  },
  methods: {
    guestVlanNetworkLocation,
    guestVlanVpcLocation,
    fetchData () {
      const listRequest = this.listRequestToken('fetchData')
      var params = {
        id: this.resource.id
      }
      this.fetchLoading = !listRequest.loaded
      return getAPI('listGuestVlans', params).then(json => {
        if (!this.isListRequestCurrent('fetchData', listRequest)) return

        this.networks = json.listguestvlansresponse.guestvlan[0].network || []
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
<style lang="scss" scoped>
.status {
  margin-top: -5px;

  &--end {
    margin-left: 5px;
  }
}
</style>
