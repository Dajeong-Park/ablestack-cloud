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
  <a-spin :spinning="fetchLoading">
    <resource-table-toolbar v-if="traffictypes.length" :loading="fetchLoading" @refresh="fetchData()">
      <select
        id="zone-traffic-type"
        class="ant-input traffic-type-select"
        :aria-label="$t('label.traffictype')"
        :value="selectedTraffic?.traffictype"
        @change="selectTraffic($event.target.value)">
        <option v-for="item in traffictypes" :key="item.id" :value="item.traffictype">{{ item.traffictype }}</option>
      </select>
      <template #actions>
        <a-popconfirm
          v-if="selectedTraffic"
          :title="$t('message.confirm.delete.traffic.type')"
          @confirm="deleteTrafficType(selectedTraffic)"
          :okText="$t('label.yes')"
          :cancelText="$t('label.no')" >
          <a-button
            type="primary"
            danger
            :loading="loading"
            :disabled="!('deleteTrafficType' in $store.getters.apis)">
            <template #icon><delete-outlined /></template> {{ $t('label.delete.traffic.type') }}
          </a-button>
        </a-popconfirm>
      </template>
    </resource-table-toolbar>
    <div v-if="selectedTraffic" :key="selectedTraffic.traffictype">
      <div
        v-for="(type, idx) in ['kvmnetworklabel', 'vmwarenetworklabel', 'xennetworklabel', 'hypervnetworklabel', 'ovm3networklabel']"
        :key="idx"
        style="margin-bottom: 10px;">
        <div><strong>{{ $t('label.' + type) }}</strong></div>
        <div>{{ selectedTraffic[type] || $t('label.network.label.display.for.blank.value') }}</div>
      </div>
      <div v-if="selectedTraffic.traffictype === 'Guest' && networkType === 'Advanced'">
        <a-divider />
        <IpRangesTabGuest :resource="resource" :loading="loading"/>
      </div>
      <div v-if="selectedTraffic.traffictype === 'Guest' && networkType === 'Basic'">
        <a-divider />
        <IpRangesTabPublic
          :resource="resource"
          :loading="loading"
          :network="guestNetwork"
          :basicGuestNetwork="networkType === 'Basic' && selectedTraffic.traffictype === 'Guest'"/>
      </div>
      <div v-if="selectedTraffic.traffictype === 'Public'">
        <div style="margin-bottom: 10px;">
          <div><strong>{{ $t('label.traffictype') }}</strong></div>
          <div>{{ publicNetwork.traffictype }}</div>
        </div>
        <div style="margin-bottom: 10px;">
          <div><strong>{{ $t('label.broadcastdomaintype') }}</strong></div>
          <div>{{ publicNetwork.broadcastdomaintype }}</div>
        </div>
        <a-divider />
        <IpRangesTabPublic :resource="resource" :loading="loading" :network="publicNetwork" :basicGuestNetwork="false" />
      </div>
      <div v-if="selectedTraffic.traffictype === 'Management'">
        <a-divider />
        <IpRangesTabManagement :resource="resource" :loading="loading" />
      </div>
      <div v-if="selectedTraffic.traffictype === 'Storage'">
        <a-divider />
        <IpRangesTabStorage :resource="resource" />
      </div>
    </div>
    <a-empty v-else-if="!fetchLoading" />
  </a-spin>
</template>

<script>
import { getAPI, postAPI } from '@/api'
import ResourceTableToolbar from '@/components/view/ResourceTableToolbar'
import IpRangesTabPublic from './IpRangesTabPublic'
import IpRangesTabManagement from './IpRangesTabManagement'
import IpRangesTabStorage from './IpRangesTabStorage'
import IpRangesTabGuest from './IpRangesTabGuest'
import { trafficTypeTab } from '@/config/section/infra/phynetworks.js'

export default {
  name: 'TrafficTypesTab',
  components: {
    ResourceTableToolbar,
    IpRangesTabPublic,
    IpRangesTabManagement,
    IpRangesTabStorage,
    IpRangesTabGuest
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
      traffictypes: [],
      publicNetwork: {},
      guestNetwork: {},
      networkType: 'Advanced',
      fetchLoading: false
    }
  },
  computed: {
    selectedTraffic () {
      return this.traffictypes.find(item => item.traffictype === this.$route.query.traffic) || this.traffictypes[0]
    }
  },
  created () {
    if (this.resource.id) {
      this.fetchData()
    }
  },
  watch: {
    selectedTraffic (traffic) {
      trafficTypeTab.index = Math.max(0, this.traffictypes.indexOf(traffic))
    },
    loading (newData, oldData) {
      if (!newData && this.resource.id) {
        this.fetchData()
      }
    }
  },
  methods: {
    async fetchData () {
      this.fetchTrafficTypes()
      this.fetchLoading = true
      getAPI('listNetworks', {
        listAll: true,
        trafficType: 'Public',
        isSystem: true,
        zoneId: this.resource.zoneid
      }).then(json => {
        if (json.listnetworksresponse && json.listnetworksresponse.network && json.listnetworksresponse.network.length > 0) {
          this.publicNetwork = json.listnetworksresponse.network[0]
        } else {
          this.publicNetwork = {}
        }
      }).catch(error => {
        this.$notifyError(error)
      }).finally(() => {
        this.fetchLoading = false
      })
      await this.fetchZones()
      if (this.networkType === 'Basic') {
        this.fetchGuestNetwork()
      }
    },
    fetchTrafficTypes () {
      this.fetchLoading = true
      getAPI('listTrafficTypes', { physicalnetworkid: this.resource.id }).then(json => {
        this.traffictypes = json.listtraffictypesresponse.traffictype || []
      }).catch(error => {
        this.$notifyError(error)
      }).finally(() => {
        this.fetchLoading = false
      })
    },
    fetchZones () {
      return new Promise((resolve, reject) => {
        this.fetchLoading = true
        getAPI('listZones', { id: this.resource.zoneid }).then(json => {
          const zone = json.listzonesresponse.zone || []
          this.networkType = zone[0].networktype
          resolve(this.networkType)
        }).catch(error => {
          this.$notifyError(error)
          reject(error)
        }).finally(() => {
          this.fetchLoading = false
        })
      })
    },
    fetchGuestNetwork () {
      getAPI('listNetworks', {
        listAll: true,
        trafficType: 'Guest',
        zoneId: this.resource.zoneid
      }).then(json => {
        if (json.listnetworksresponse?.network?.length > 0) {
          this.guestNetwork = json.listnetworksresponse.network[0]
        } else {
          this.guestNetwork = {}
        }
      }).catch(error => {
        this.$notifyError(error)
      }).finally(() => {
        this.fetchLoading = false
      })
    },
    deleteTrafficType (trafficType) {
      postAPI('deleteTrafficType', { id: trafficType.id }).then(response => {
        this.$pollJob({
          jobId: response.deletetraffictyperesponse.jobid,
          title: this.$t('label.delete.traffic.type'),
          description: trafficType.traffictype,
          successMessage: this.$t('message.traffic.type.deleted') + ' ' + trafficType.traffictype,
          successMethod: () => {
            this.fetchLoading = false
            this.fetchTrafficTypes()
          },
          errorMessage: this.$t('message.delete.failed'),
          errorMethod: () => {
            this.fetchLoading = false
            this.fetchTrafficTypes()
          },
          loadingMessage: this.$t('message.delete.traffic.type.processing'),
          catchMessage: this.$t('error.fetching.async.job.result'),
          catchMethod: () => {
            this.fetchLoading = false
            this.fetchTrafficTypes()
          }
        })
      }).catch(error => {
        this.$notifyError(error)
      }).finally(() => {
        this.fetchLoading = false
        this.fetchTrafficTypes()
      })
    },
    selectTraffic (traffic) {
      this.$router.push({ query: { ...this.$route.query, traffic } })
    }
  }
}
</script>

<style lang="less" scoped>

</style>

<style scoped>
.traffic-type-select {
  width: 10rem;
  max-width: 100%;
  height: 32px;
}
@media (max-width: 768px) {
  .traffic-type-select { width: 100%; }
}
</style>
