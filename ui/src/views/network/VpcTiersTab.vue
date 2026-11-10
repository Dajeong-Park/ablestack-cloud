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
    <p v-if="listRefreshFailed" role="status">{{ $t('message.list.refresh.stale') }}</p>
    <div class="tier-toolbar">
      <a-button
        ref="addTier"
        type="primary"
        :disabled="!canCreateTier"
        @click="handleOpenModal">
        <template #icon><plus-outlined /></template>
        {{ $t('label.add.new.tier') }}
      </a-button>
    </div>
    <a-list class="list">
      <a-list-item v-for="(network, idx) in networks" :key="idx" class="list__item">
        <div class="list__item-outer-container">
          <div class="list__item-container">
            <div class="list__col">
              <div class="list__label">
                {{ $t('label.name') }}
              </div>
              <div>
                <router-link :to="{ path: '/guestnetwork/' + network.id }">{{ network.name }} </router-link>
                <a-tag v-if="network.broadcasturi">{{ network.broadcasturi }}</a-tag>
              </div>
            </div>
            <div class="list__col">
              <div class="list__label">{{ $t('label.state') }}</div>
              <div><status :text="network.state" displayText></status></div>
            </div>
            <div class="list__col">
              <div class="list__label">
                {{ $t('label.cidr') }}
              </div>
              <div>{{ network.cidr }}</div>
            </div>
            <div class="list__col">
              <div class="list__label">
                {{ $t('label.aclid') }}
              </div>
              <div>
                <router-link :to="{ path: '/acllist/' + network.aclid }">
                  {{ network.aclname }}
                </router-link>
              </div>
            </div>
          </div>
          <a-collapse :bordered="false" style="margin-left: -18px">
            <template #expandIcon="props">
              <caret-right-outlined :rotate="props.isActive ? 90 : 0" />
            </template>
            <a-collapse-panel :header="$t('label.instances')" key="vm" :style="customStyle">
              <a-button
                type="dashed"
                style="margin-bottom: 15px; width: 100%"
                :disabled="!('deployVirtualMachine' in $store.getters.apis)"
                @click="$router.push({ path: '/action/deployVirtualMachine', query: { networkid: network.id, zoneid: network.zoneid } })">
                <template #icon><plus-outlined /></template>
                {{ $t('label.vm.add') }}
              </a-button>
              <a-table
                class="table"
                size="small"
                :columns="vmCols"
                :dataSource="vms[network.id]"
                :rowKey="item => item.id"
                :pagination="false"
                :loading="fetchLoading">
                <template #bodyCell="{ column, record }">
                  <template v-if="column.key === 'name'">
                    <router-link :to="{ path: '/vm/' + record.id}">{{ record.name }}
                    </router-link>
                  </template>
                  <template v-if="column.key === 'state'">
                    <status :text="record.state" displayText></status>
                  </template>
                  <template v-if="column.key === 'ip'">
                    <div v-for="nic in record.nic" :key="nic.id">
                      {{ nic.networkid === network.id ? nic.ipaddress : '' }}
                    </div>
                  </template>
                </template>
              </a-table>
              <a-divider/>
              <a-pagination
                class="row-element pagination"
                size="small"
                :current="page"
                :pageSize="pageSize"
                :total="itemCounts.vms[network.id]"
                :showTotal="total => `${$t('label.total')} ${total} ${$t('label.items')}`"
                :pageSizeOptions="['10', '20', '40', '80', '100']"
                @change="changePage"
                @showSizeChange="changePageSize"
                showSizeChanger>
                <template #buildOptionText="props">
                  <span>{{ props.value }} / {{ $t('label.page') }}</span>
                </template>
              </a-pagination>
            </a-collapse-panel>
            <a-collapse-panel :header="$t('label.internal.lb')" key="ilb" :style="customStyle" :collapsible="displayCollapsible[network.id] ? null: 'disabled'" >
              <a-button
                type="dashed"
                style="margin-bottom: 15px; width: 100%"
                :disabled="!('createLoadBalancer' in $store.getters.apis)"
                @click="handleAddInternalLB(network.id)">
                <template #icon><plus-outlined /></template>
                {{ $t('label.add.internal.lb') }}
              </a-button>
              <a-table
                class="table"
                size="small"
                :columns="internalLbCols"
                :dataSource="internalLB[network.id]"
                :rowKey="item => item.id"
                :pagination="false"
                :loading="fetchLoading">
                <template #bodyCell="{ column, record }">
                  <template v-if="column.key === 'name'">
                    <router-link :to="{ path: '/ilb/'+ record.id}">{{ record.name }}
                    </router-link>
                  </template>
                </template>
              </a-table>
              <a-divider/>
              <a-pagination
                class="row-element pagination"
                size="small"
                :current="page"
                :pageSize="pageSize"
                :total="itemCounts.internalLB[network.id]"
                :showTotal="total => `${$t('label.total')} ${total} ${$t('label.items')}`"
                :pageSizeOptions="['10', '20', '40', '80', '100']"
                @change="changePage"
                @showSizeChange="changePageSize"
                showSizeChanger>
                <template #buildOptionText="props">
                  <span>{{ props.value }} / {{ $t('label.page') }}</span>
                </template>
              </a-pagination>
            </a-collapse-panel>
          </a-collapse>
        </div>
      </a-list-item>
    </a-list>

    <VpcTierCreateDialog
      v-if="openTierScope && openTierScope === tierScope"
      :key="openTierScope"
      :resource="resource"
      :scope="tierScope"
      @cancel="closeTier"
      @created="tierCreated" />

    <InternalLbDialog v-if="showAddInternalLB" mode="create" :resource="resource" :tier-id="networkid" @cancel="showAddInternalLB = false" @success="fetchData" />
  </a-spin>
</template>

<script>
import { listRefreshMixin } from '@/utils/listRefreshMixin'
import { getAPI } from '@/api'
import Status from '@/components/widgets/Status'
import InternalLbDialog from './InternalLbDialog'
import VpcTierCreateDialog from '@/views/network/VpcTierCreateDialog'
import { vpcTierScope } from '@/utils/vpcTierCreation'

export default {
  mixins: [listRefreshMixin(['refreshTiers'])],
  name: 'VpcTiersTab',
  components: {
    Status,
    VpcTierCreateDialog,
    InternalLbDialog
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
  inject: ['parentFetchData'],
  data () {
    return {
      networks: [],
      networkid: '',
      fetchLoading: false,
      openTierScope: '',
      showAddInternalLB: false,
      internalLB: {},
      LBPublicIPs: {},
      staticNats: {},
      vms: {},
      internalLbCols: [
        {
          key: 'name',
          title: this.$t('label.name'),
          dataIndex: 'name'
        },
        {
          title: this.$t('label.sourceipaddress'),
          dataIndex: 'sourceipaddress'
        },
        {
          title: this.$t('label.algorithm'),
          dataIndex: 'algorithm'
        },
        {
          title: this.$t('label.account'),
          dataIndex: 'account'
        }
      ],
      vmCols: [
        {
          key: 'name',
          title: this.$t('label.name'),
          dataIndex: 'name'
        },
        {
          key: 'state',
          title: this.$t('label.state'),
          dataIndex: 'state'
        },
        {
          key: 'ip',
          title: this.$t('label.ip')
        }
      ],
      customStyle: 'margin-bottom: 0; border: none',
      page: 1,
      pageSize: 10,
      itemCounts: {
        internalLB: {},
        publicIps: {},
        snats: {},
        vms: {}
      },
      displayCollapsible: []
    }
  },
  created () {
    this.fetchData()
  },
  computed: {
    canCreateTier () {
      const apis = this.$store.getters.apis || {}
      const project = this.$store.getters.project?.id
      return !!this.resource.id && (!project || project === this.resource.projectid) &&
        ['createNetwork', 'listNetworkOfferings'].every(api => api in apis)
    },
    tierScope () { return vpcTierScope(this) }
  },
  watch: {
    tierScope: {
      flush: 'sync',
      handler () { this.openTierScope = '' }
    },
    loading (newData, oldData) {
      if (!newData && this.resource.id) {
        this.fetchData()
      }
    }
  },
  methods: {
    showIlb (network, networkOffering) {
      return ((networkOffering.supportsinternallb && network.service.filter(s => (s.name === 'Lb') && (s.capability.filter(c => c.name === 'LbSchemes' && c.value.split(',').includes('Internal')).length > 0)).length > 0)) || false
    },
    fetchData () {
      return this.refreshTiers()
    },
    async refreshTiers () {
      if (!this.resource.id) return
      const request = this.listRequestToken('refreshTiers')
      this.fetchLoading = !request.loaded
      try {
        const networks = this.resource.network || []
        const results = await Promise.all(networks.map(async network => {
          const params = { networkid: network.id, page: this.page, pagesize: this.pageSize, listall: true }
          const [lbs, vms] = await Promise.all([
            getAPI('listLoadBalancers', params),
            getAPI('listVirtualMachines', { ...params, vpcid: this.resource.id })
          ])
          return { network, lbs: lbs.listloadbalancersresponse, vms: vms.listvirtualmachinesresponse }
        }))
        if (!this.isListRequestCurrent('refreshTiers', request)) return
        this.networks = networks
        const nextVms = {}
        const nextLbs = {}
        for (const { network, lbs, vms } of results) {
          nextVms[network.id] = vms.virtualmachine || []
          nextLbs[network.id] = lbs.loadbalancer || []
          this.itemCounts.vms[network.id] = vms.count || 0
          this.itemCounts.internalLB[network.id] = lbs.count || 0
          if (!(network.id in this.displayCollapsible)) this.updateDisplayCollapsible(network.networkofferingid, network)
        }
        this.vms = nextVms
        this.internalLB = nextLbs
      } catch (error) {
        if (!this.isListRequestCurrent('refreshTiers', request)) return
        request.failed = true
        this.listRefreshFailed = true
        if (!request.loaded) this.$notifyError(error)
      } finally {
        if (this.isListRequestCurrent('refreshTiers', request)) this.fetchLoading = false
      }
    },
    updateDisplayCollapsible (offeringId, network) {
      getAPI('listNetworkOfferings', {
        id: offeringId
      }).then(json => {
        var networkOffering = json.listnetworkofferingsresponse.networkoffering[0]
        this.displayCollapsible[network.id] = this.showIlb(network, networkOffering)
      }).catch(e => {
        this.$notifyError(e)
      })
    },
    fetchLoadBalancers (id) {
      this.fetchLoading = true
      getAPI('listLoadBalancers', {
        networkid: id,
        page: this.page,
        pagesize: this.pageSize,
        listAll: true
      }).then(json => {
        this.internalLB[id] = json.listloadbalancersresponse.loadbalancer || []
        this.itemCounts.internalLB[id] = json.listloadbalancersresponse.count || 0
      }).finally(() => {
        this.fetchLoading = false
      })
    },
    fetchVMs (id) {
      this.fetchLoading = true
      getAPI('listVirtualMachines', {
        listAll: true,
        vpcid: this.resource.id,
        networkid: id,
        page: this.page,
        pagesize: this.pageSize
      }).then(json => {
        this.vms[id] = json.listvirtualmachinesresponse.virtualmachine || []
        this.itemCounts.vms[id] = json.listvirtualmachinesresponse.count || 0
      }).finally(() => {
        this.fetchLoading = false
      })
    },
    handleOpenModal () {
      if (this.canCreateTier) this.openTierScope = this.tierScope
    },
    async closeTier () {
      const scope = this.tierScope
      this.openTierScope = ''
      await this.$nextTick()
      if (scope === this.tierScope && this.$refs.addTier) this.$refs.addTier.$el.focus()
    },
    tierCreated () {
      if (!this.openTierScope || this.openTierScope !== this.tierScope) return
      this.closeTier()
      this.$notification.success({ message: this.$t('message.success.add.vpc.network') })
      this.parentFetchData()
    },
    handleAddInternalLB (id) {
      if (!('createLoadBalancer' in this.$store.getters.apis) || !this.displayCollapsible[id]) return
      this.networkid = id
      this.showAddInternalLB = true
    },
    changePage (page, pageSize) {
      this.page = page
      this.pageSize = pageSize
      this.fetchData()
    },
    changePageSize (currentPage, pageSize) {
      this.page = currentPage
      this.pageSize = pageSize
      this.fetchData()
    }
  }
}
</script>

<style lang="scss" scoped>
.tier-toolbar { margin-bottom: 16px; }
.list {

  &__label {
    font-weight: bold;
  }

  &__col {
    flex: 1;

    @media (min-width: 480px) {
      &:not(:last-child) {
        margin-right: 20px;
      }
    }
  }

  &__item {
    margin-right: -8px;
    align-items: flex-start;

    &-outer-container {
      width: 100%;
    }

    &-container {
      display: flex;
      flex-direction: column;
      width: 100%;

      @media (min-width: 480px) {
        flex-direction: row;
        margin-bottom: 10px;
      }
    }
  }
}
</style>
