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
    <autogen-view @change-resource="changeResource">
      <template #resource>
        <resource-view
          v-if="isPublicIpAddress && 'id' in resource"
          :key="resource.id"
          :loading="loading"
          :resource="resource"
          :historyTab="activeTab"
          :tabs="tabs"
          :actions="actions"
          @exec-action="(action) => execAction(action, action.groupAction && !dataView)"
          @onTabChange="(tab) => { activeTab = tab }" />
      </template>
    </autogen-view>
  </div>
</template>

<script>
import { shallowRef, defineAsyncComponent } from 'vue'
import { getAPI } from '@/api'
import { mixinDevice } from '@/utils/mixin.js'
import eventBus from '@/config/eventBus'
import AutogenView from '@/views/AutogenView.vue'
import ResourceView from '@/components/view/ResourceView'

export default {
  name: 'PublicIpResource',
  components: {
    AutogenView,
    ResourceView
  },
  data () {
    return {
      loading: false,
      tabRequestVersion: 0,
      selectedRowKeys: [],
      actions: [],
      resource: {},
      tabs: [{
        name: 'details',
        component: shallowRef(defineAsyncComponent(() => import('@/components/view/DetailsTab.vue')))
      },
      {
        name: 'events',
        resourceType: 'IpAddress',
        component: shallowRef(defineAsyncComponent(() => import('@/components/view/EventsTab.vue'))),
        show: () => { return 'listEvents' in this.$store.getters.apis }
      }],
      defaultTabs: [{
        name: 'details',
        component: shallowRef(defineAsyncComponent(() => import('@/components/view/DetailsTab.vue')))
      },
      {
        name: 'events',
        resourceType: 'IpAddress',
        component: shallowRef(defineAsyncComponent(() => import('@/components/view/EventsTab.vue'))),
        show: () => { return 'listEvents' in this.$store.getters.apis }
      },
      {
        name: 'comments',
        component: shallowRef(defineAsyncComponent(() => import('@/components/view/AnnotationsTab.vue')))
      }],
      activeTab: ''
    }
  },
  mixins: [mixinDevice],
  provide: function () {
    return {
      parentFetchData: this.fetchData(),
      parentToggleLoading: this.toggleLoading
    }
  },
  computed: {
    isPublicIpAddress () {
      return this.$route.path.startsWith('/publicip') && this.$route.path.includes('/publicip/')
    }
  },
  watch: {
    resource: {
      deep: true,
      handler () {
        if ('id' in this.resource) {
          this.fetchData()
        }
      }
    }
  },
  created () {
    if ('id' in this.resource) {
      this.fetchData()
    }
  },
  beforeUnmount () { this.tabRequestVersion++ },
  methods: {
    async fetchData () {
      if (Object.keys(this.resource).length === 0) {
        return
      }

      const version = ++this.tabRequestVersion
      const resource = this.resource
      this.loading = true
      try {
        const tabs = await this.filterTabs(resource)
        if (version !== this.tabRequestVersion || resource.id !== this.resource.id) return
        this.tabs = tabs || this.defaultTabs
        this.fetchAction()
      } catch (error) {
        if (version !== this.tabRequestVersion || resource.id !== this.resource.id) return
        this.tabs = this.defaultTabs
        this.$notifyError(error)
      } finally {
        if (version === this.tabRequestVersion && resource.id === this.resource.id) this.loading = false
      }
    },
    async filterTabs (resource = this.resource) {
      const routeTabs = this.$route.meta.tabs
      const defaultTabs = this.defaultTabs
      // Public IPs in Free state have nothing
      if (['Free', 'Reserved'].includes(resource.state)) {
        return defaultTabs
      }
      if (resource && resource.vpcid) {
        const vpc = await this.fetchVpc(resource)
        const hasFirewallCapability = this.hasVpcFirewallCapability(vpc)

        // VPC IPs with source nat have only VPN when VPC offering conserve mode = false
        if (resource.issourcenat && vpc?.vpcofferingconservemode === false) {
          const tabs = defaultTabs.concat(routeTabs.filter(tab => tab.name === 'vpn'))
          return hasFirewallCapability ? this.addFirewallTab(tabs) : tabs
        }

        // VPC IPs with static nat keep existing VPN behavior; show firewall only when capability exists
        if (resource.isstaticnat) {
          let tabs = routeTabs
          if (hasFirewallCapability) {
            tabs = this.addFirewallTab(tabs).map(tab => {
              if (tab.name !== 'firewall') {
                return tab
              }
              const staticNatFirewallTab = { ...tab }
              delete staticNatFirewallTab.networkServiceFilter
              return staticNatFirewallTab
            })
          } else {
            tabs = tabs.filter(tab => tab.name !== 'firewall')
          }
          return tabs
        }

        // VPC IPs have all tabs; firewall is shown only if VPC has firewall capability
        let tabs = routeTabs
        if (!hasFirewallCapability) {
          tabs = tabs.filter(tab => tab.name !== 'firewall')
        }

        const network = await this.fetchNetwork(resource)
        if (network && network.networkofferingconservemode) {
          return tabs
        }

        const portFWRuleCount = await this.fetchPortFWRule(resource)
        const loadBalancerRuleCount = await this.fetchLoadBalancerRule(resource)

        // VPC IPs with PF only have PF (and firewall)
        if (portFWRuleCount > 0) {
          tabs = tabs.filter(tab => tab.name !== 'loadbalancing')
        }

        // VPC IPs with LB rules only have LB (and firewall)
        if (loadBalancerRuleCount > 0) {
          tabs = tabs.filter(tab => tab.name !== 'portforwarding')
        }
        return tabs
      }

      // Regular guest networks with Source Nat have everything
      if (resource && !resource.vpcid && resource.issourcenat) {
        return routeTabs
      }
      // Regular guest networks with Static Nat only have Firewall
      if (resource && !resource.vpcid && resource.isstaticnat) {
        return defaultTabs.concat(routeTabs.filter(tab => tab.name === 'firewall'))
      }

      // Regular guest networks have all tabs
      if (resource && !resource.vpcid) {
        return routeTabs
      }
    },
    fetchAction () {
      this.actions = this.$route.meta.actions || []
    },
    addFirewallTab (tabs) {
      const firewallTab = this.$route.meta.tabs.find(tab => tab.name === 'firewall')
      if (!firewallTab || tabs.some(tab => tab.name === 'firewall')) {
        return tabs
      }
      return tabs.concat(firewallTab)
    },
    hasVpcFirewallCapability (vpc) {
      const services = vpc?.service || []
      return Array.isArray(services) && services.some(service => (service?.name || '').toLowerCase() === 'firewall')
    },
    fetchVpc (resource = this.resource) {
      if (!resource.vpcid) {
        return null
      }
      return new Promise((resolve, reject) => {
        getAPI('listVPCs', {
          id: resource.vpcid
        }).then(json => {
          const vpc = json.listvpcsresponse?.vpc?.[0] || null
          resolve(vpc)
        }).catch(e => {
          reject(e)
        })
      })
    },
    fetchNetwork (resource = this.resource) {
      if (!resource.associatednetworkid) {
        return null
      }
      return new Promise((resolve, reject) => {
        getAPI('listNetworks', {
          listAll: true,
          projectid: resource.projectid,
          id: resource.associatednetworkid
        }).then(json => {
          const network = json.listnetworksresponse?.network?.[0] || null
          resolve(network)
        }).catch(e => {
          reject(e)
        })
      })
    },
    fetchPortFWRule (resource = this.resource) {
      return new Promise((resolve, reject) => {
        getAPI('listPortForwardingRules', {
          listAll: true,
          ipaddressid: resource.id,
          page: 1,
          pagesize: 1
        }).then(json => {
          const portFWRuleCount = json.listportforwardingrulesresponse.count || 0
          resolve(portFWRuleCount)
        }).catch(e => {
          reject(e)
        })
      })
    },
    fetchLoadBalancerRule (resource = this.resource) {
      return new Promise((resolve, reject) => {
        getAPI('listLoadBalancerRules', {
          listAll: true,
          publicipid: resource.id,
          page: 1,
          pagesize: 1
        }).then(json => {
          const loadBalancerRuleCount = json.listloadbalancerrulesresponse.count || 0
          resolve(loadBalancerRuleCount)
        }).catch(e => {
          reject(e)
        })
      })
    },
    changeResource (resource) {
      this.resource = resource
    },
    toggleLoading () {
      this.loading = !this.loading
    },
    execAction (action, isGroupAction) {
      eventBus.emit('exec-action', { action, isGroupAction })
    }
  }
}
</script>
