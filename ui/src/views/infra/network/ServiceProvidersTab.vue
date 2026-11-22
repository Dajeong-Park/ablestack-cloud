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
    <a-alert
      v-if="providerLoadError"
      type="error"
      show-icon
      :message="$t(providerLoadError)">
      <template #description>
        <a-button size="small" :loading="fetchLoading" @click="fetchData">{{ $t('label.retry') }}</a-button>
      </template>
    </a-alert>
    <a-spin :spinning="fetchLoading">
      <div v-if="!providerLoadError" class="provider-layout">
        <div class="provider-list">
          <div class="provider-filters">
            <a-input
              v-model:value="providerSearch"
              allow-clear
              :aria-label="$t('label.zone.provider.search')"
              :placeholder="$t('label.zone.provider.search')" />
            <label for="zone-provider-state">{{ $t('label.state') }}</label>
            <a-select
              id="zone-provider-state"
              v-model:value="providerFilter"
              :options="providerStates"
              :virtual="false"
              class="provider-state-filter" />
          </div>
          <a-table
            size="small"
            row-key="name"
            :columns="providerColumns"
            :data-source="fetchLoading ? [] : filteredProviders"
            :pagination="false"
            :scroll="{ x: 260, y: 300 }">
            <template #bodyCell="{ column, record }">
              <a-button
                v-if="column.key === 'name'"
                type="link"
                :aria-current="record.name === activeProvider?.name ? 'true' : undefined"
                @click="selectProvider(record.name)">
                {{ record.name }}
              </a-button>
              <status v-else-if="record.linked && record.state !== 'unsupported'" :text="record.state" display-text />
              <span v-else>{{ providerStateLabel(record.state) }}</span>
            </template>
          </a-table>
        </div>
        <section
          v-if="activeProvider && !fetchLoading"
          class="provider-details"
          :aria-label="activeProvider.name">
          <h3>{{ activeProvider.name }}</h3>
          <provider-item
            :key="activeProvider.name"
            :loading="loading"
            :item-nsp="activeProvider.item"
            :nsp="nsps[activeProvider.name]"
            :resource-id="resource.id"
            :zone-id="resource.zoneid" />
        </section>
      </div>
    </a-spin>

    <div v-if="showFormAction">
      <keep-alive v-if="currentAction.component">
        <a-modal
          :title="$t(currentAction.label)"
          :visible="showFormAction"
          :closable="true"
          :maskClosable="false"
          style="top: 20px;"
          @cancel="onCloseAction"
          :confirmLoading="actionLoading"
          :footer="null"
          centered>
          <keep-alive>
            <component
              :is="currentAction.component"
              :resource="nsp"
              :action="currentAction" />
          </keep-alive>
        </a-modal>
      </keep-alive>
      <a-modal
        v-else
        :title="$t(currentAction.label)"
        :visible="showFormAction"
        :confirmLoading="actionLoading"
        :closable="true"
        :maskClosable="false"
        :footer="null"
        @cancel="onCloseAction"
        style="top: 20px;"
        centered
      >
        <a-form
          :ref="formRef"
          :model="form"
          :rules="rules"
          @finish="handleSubmit"
          v-ctrl-enter="handleSubmit"
          layout="vertical"
         >
          <a-form-item
            :name="field.name"
            :ref="field.name"
            v-for="(field, index) in currentAction.fieldParams"
            :key="index"
            :label="$t('label.' + field.name)">
            <span v-if="field.name==='password'">
              <a-input-password
                v-focus="index===0"
                v-model:value="form[field.name]"
                :placeholder="field.description" />
            </span>
            <span v-else-if="field.type==='boolean'">
              <a-switch
                v-focus="index===0"
                v-model:checked="form[field.name]"
                :placeholder="field.description"
              />
            </span>
            <span v-else-if="field.type==='uuid'">
              <a-select
                v-focus="index===0"
                v-model:value="form[field.name]"
                :loading="field.loading"
                :placeholder="field.description"
                showSearch
                optionFilterProp="label"
                :filterOption="(input, option) => {
                  return option.label.toLowerCase().indexOf(input.toLowerCase()) >= 0
                }" >
                <a-select-option
                  v-for="(opt, idx) in field.opts"
                  :key="idx"
                  :label="opt.name || opt.description">{{ opt.name || opt.description }}</a-select-option>
              </a-select>
            </span>
            <span v-else>
              <a-input
                v-focus="index===0"
                v-model:value="form[field.name]"
                :placeholder="field.description" />
            </span>
          </a-form-item>

          <div :span="24" class="action-button">
            <a-button @click="onCloseAction">{{ $t('label.cancel') }}</a-button>
            <a-button type="primary" ref="submit" @click="handleSubmit">{{ $t('label.ok') }}</a-button>
          </div>
        </a-form>
      </a-modal>
    </div>
  </div>
</template>

<script>
import { ref, reactive, toRaw, shallowRef, defineAsyncComponent } from 'vue'
import store from '@/store'
import { getAPI, postAPI } from '@/api'
import Status from '@/components/widgets/Status'
import ProviderItem from '@/views/infra/network/providers/ProviderItem'

export default {
  name: 'ServiceProvidersTab',
  components: {
    Status,
    ProviderItem
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
      nsps: {},
      nsp: {},
      fetchLoading: true,
      providerLoadError: '',
      providerLoadSequence: 0,
      actionLoading: false,
      showFormAction: false,
      currentAction: {},
      providerSearch: '',
      providerFilter: 'all',
      registeredExtensions: []
    }
  },
  computed: {
    providerColumns () {
      return [{ key: 'name', title: this.$t('label.name') }, { key: 'state', title: this.$t('label.state') }]
    },
    providerRows () {
      const known = new Map(this.hardcodedNsps.map(item => [item.title, item]))
      this.registeredExtensions.forEach(extension => known.set(extension.name, this.extensionNspItem(extension.name)))
      Object.keys(this.nsps).forEach(name => {
        if (!known.has(name)) known.set(name, { title: name, details: ['name', 'state', 'id', 'physicalnetworkid', 'servicelist'], actions: [] })
      })
      return [...known].map(([name, item]) => {
        const provider = this.nsps[name]
        return {
          name,
          item,
          linked: !!provider?.id,
          state: provider?.supported === false ? 'unsupported' : provider?.state || 'unregistered'
        }
      }).sort((a, b) => Number(b.linked) - Number(a.linked) || a.name.localeCompare(b.name))
    },
    providerStates () {
      const states = [...new Set(this.providerRows.map(provider => provider.state))]
      return [{ value: 'all', label: this.$t('label.all') }, ...states.map(state => ({ value: state, label: this.providerStateLabel(state) }))]
    },
    filteredProviders () {
      const search = this.providerSearch.trim().toLowerCase()
      return this.providerRows.filter(provider =>
        provider.name.toLowerCase().includes(search) && (this.providerFilter === 'all' || provider.state === this.providerFilter))
    },
    activeProvider () {
      return this.filteredProviders.find(provider => provider.name === this.$route.query.provider) || this.filteredProviders[0]
    },
    hardcodedNsps () {
      return [
        {
          title: 'BaremetalDhcpProvider',
          actions: [
            {
              api: 'addBaremetalDhcp',
              listView: true,
              icon: 'plus-outlined',
              label: 'label.add.baremetal.dhcp.device',
              args: ['url', 'username', 'password'],
              mapping: {
                dhcpservertype: {
                  value: (record) => { return 'DHCPD' }
                }
              }
            },
            {
              api: 'updateNetworkServiceProvider',
              icon: 'stop-outlined',
              listView: true,
              label: 'label.disable.provider',
              confirm: 'message.confirm.disable.provider',
              show: (record) => { return (record && record.id && record.state === 'Enabled') },
              mapping: {
                state: {
                  value: (record) => { return 'Disabled' }
                }
              }
            },
            {
              api: 'updateNetworkServiceProvider',
              icon: 'play-circle-outlined',
              listView: true,
              label: 'label.enable.provider',
              confirm: 'message.confirm.enable.provider',
              show: (record) => { return (record && record.id && record.state === 'Disabled') },
              mapping: {
                state: {
                  value: (record) => { return 'Enabled' }
                }
              }
            },
            {
              api: 'deleteNetworkServiceProvider',
              listView: true,
              icon: 'poweroff-outlined',
              label: 'label.shutdown.provider',
              confirm: 'message.confirm.delete.provider',
              show: (record) => { return record && record.id }
            }
          ],
          details: ['name', 'state', 'id', 'servicelist'],
          lists: [
            {
              title: 'label.baremetal.dhcp.devices',
              api: 'listBaremetalDhcp',
              mapping: {
                physicalnetworkid: {
                  value: (record) => { return record.physicalnetworkid }
                }
              },
              columns: ['url']
            }
          ]
        },
        {
          title: 'BaremetalPxeProvider',
          actions: [
            {
              api: 'addBaremetalPxeKickStartServer',
              listView: true,
              icon: 'plus-outlined',
              label: 'label.baremetal.pxe.device',
              args: ['url', 'username', 'password', 'tftpdir'],
              mapping: {
                pxeservertype: {
                  value: (record) => { return 'KICK_START' }
                }
              }
            },
            {
              api: 'updateNetworkServiceProvider',
              icon: 'stop-outlined',
              listView: true,
              label: 'label.disable.provider',
              confirm: 'message.confirm.disable.provider',
              show: (record) => { return (record && record.id && record.state === 'Enabled') },
              mapping: {
                state: {
                  value: (record) => { return 'Disabled' }
                }
              }
            },
            {
              api: 'updateNetworkServiceProvider',
              icon: 'play-circle-outlined',
              listView: true,
              label: 'label.enable.provider',
              confirm: 'message.confirm.enable.provider',
              show: (record) => { return (record && record.id && record.state === 'Disabled') },
              mapping: {
                state: {
                  value: (record) => { return 'Enabled' }
                }
              }
            },
            {
              api: 'deleteNetworkServiceProvider',
              listView: true,
              icon: 'poweroff-outlined',
              label: 'label.shutdown.provider',
              confirm: 'message.confirm.delete.provider',
              show: (record) => { return record && record.id }
            }
          ],
          details: ['name', 'state', 'id', 'servicelist'],
          lists: [
            {
              title: 'label.baremetal.pxe.devices',
              api: 'listBaremetalPxeServers',
              mapping: {
                physicalnetworkid: {
                  value: (record) => { return record.physicalnetworkid }
                }
              },
              columns: ['url']
            }
          ]
        },
        {
          title: 'BigSwitchBcf',
          actions: [
            {
              api: 'addBigSwitchBcfDevice',
              listView: true,
              icon: 'plus-outlined',
              label: 'label.add.bigswitchbcf.device',
              args: ['hostname', 'username', 'password', 'nat']
            },
            {
              api: 'updateNetworkServiceProvider',
              icon: 'stop-outlined',
              listView: true,
              label: 'label.disable.provider',
              confirm: 'message.confirm.disable.provider',
              show: (record) => { return record && record.id && record.state === 'Enabled' },
              mapping: {
                state: {
                  value: (record) => { return 'Disabled' }
                }
              }
            },
            {
              api: 'updateNetworkServiceProvider',
              icon: 'play-circle-outlined',
              listView: true,
              label: 'label.enable.provider',
              confirm: 'message.confirm.enable.provider',
              show: (record) => { return record && record.id && record.state === 'Disabled' },
              mapping: {
                state: {
                  value: (record) => { return 'Enabled' }
                }
              }
            },
            {
              api: 'deleteNetworkServiceProvider',
              listView: true,
              icon: 'poweroff-outlined',
              label: 'label.shutdown.provider',
              confirm: 'message.confirm.delete.provider',
              show: (record) => { return record && record.id }
            }
          ],
          details: ['name', 'state', 'id', 'servicelist'],
          lists: [
            {
              title: 'label.devices',
              api: 'listBigSwitchBcfDevices',
              mapping: {
                physicalnetworkid: {
                  value: (record) => { return record.physicalnetworkid }
                }
              },
              columns: ['hostname', 'actions']
            }
          ]
        },
        {
          title: 'BrocadeVcs',
          actions: [
            {
              api: 'addBrocadeVcsDevice',
              listView: true,
              icon: 'plus-outlined',
              label: 'label.add.brocadevcs.device',
              args: ['hostname', 'username', 'password']
            },
            {
              api: 'updateNetworkServiceProvider',
              icon: 'stop-outlined',
              listView: true,
              label: 'label.disable.provider',
              confirm: 'message.confirm.disable.provider',
              show: (record) => { return record && record.id && record.state === 'Enabled' },
              mapping: {
                state: {
                  value: (record) => { return 'Disabled' }
                }
              }
            },
            {
              api: 'updateNetworkServiceProvider',
              icon: 'play-circle-outlined',
              listView: true,
              label: 'label.enable.provider',
              confirm: 'message.confirm.enable.provider',
              show: (record) => { return record && record.id && record.state === 'Disabled' },
              mapping: {
                state: {
                  value: (record) => { return 'Enabled' }
                }
              }
            },
            {
              api: 'deleteNetworkServiceProvider',
              listView: true,
              icon: 'poweroff-outlined',
              label: 'label.shutdown.provider',
              confirm: 'message.confirm.delete.provider',
              show: (record) => { return record && record.id }
            }
          ],
          details: ['name', 'state', 'id', 'servicelist'],
          lists: [
            {
              title: 'label.devices',
              api: 'listBrocadeVcsDevices',
              mapping: {
                physicalnetworkid: {
                  value: (record) => { return record.physicalnetworkid }
                }
              },
              columns: ['hostname', 'actions']
            }
          ]
        },
        {
          title: 'CiscoVnmc',
          actions: [
            {
              api: 'addCiscoVnmcResource',
              listView: true,
              icon: 'plus-outlined',
              label: 'label.add.vnmc.device',
              args: ['hostname', 'username', 'password']
            },
            {
              api: 'addCiscoAsa1000vResource',
              listView: true,
              icon: 'plus-circle-outlined',
              label: 'label.add.ciscoasa1000v',
              args: ['hostname', 'insideportprofile', 'clusterid'],
              mapping: {
                zoneid: {
                  params: (record) => { return record.zoneid }
                }
              }
            },
            {
              api: 'updateNetworkServiceProvider',
              icon: 'stop-outlined',
              listView: true,
              label: 'label.disable.provider',
              confirm: 'message.confirm.disable.provider',
              show: (record) => { return record && record.id && record.state === 'Enabled' },
              mapping: {
                state: {
                  value: (record) => { return 'Disabled' }
                }
              }
            },
            {
              api: 'updateNetworkServiceProvider',
              icon: 'play-circle-outlined',
              listView: true,
              label: 'label.enable.provider',
              confirm: 'message.confirm.enable.provider',
              show: (record) => { return record && record.id && record.state === 'Disabled' },
              mapping: {
                state: {
                  value: (record) => { return 'Enabled' }
                }
              }
            },
            {
              api: 'deleteNetworkServiceProvider',
              listView: true,
              icon: 'poweroff-outlined',
              label: 'label.shutdown.provider',
              confirm: 'message.confirm.delete.provider',
              show: (record) => { return record && record.id }
            }
          ],
          details: ['name', 'state', 'id', 'servicelist'],
          lists: [
            {
              title: 'label.list.ciscovnmc',
              api: 'listCiscoVnmcResources',
              mapping: {
                physicalnetworkid: {
                  value: (record) => { return record.physicalnetworkid }
                }
              },
              columns: ['resource', 'provider']
            },
            {
              title: 'label.list.ciscoasa1000v',
              api: 'listCiscoAsa1000vResources',
              mapping: {
                physicalnetworkid: {
                  value: (record) => { return record.physicalnetworkid }
                }
              },
              columns: ['hostname', 'insideportprofile', 'actions']
            }
          ]
        },
        {
          title: 'ConfigDrive',
          actions: [
            {
              api: 'updateNetworkServiceProvider',
              icon: 'stop-outlined',
              listView: true,
              label: 'label.disable.provider',
              confirm: 'message.confirm.disable.provider',
              show: (record) => { return record && record.id && record.state === 'Enabled' },
              mapping: {
                state: {
                  value: (record) => { return 'Disabled' }
                }
              }
            },
            {
              api: 'updateNetworkServiceProvider',
              icon: 'play-circle-outlined',
              listView: true,
              label: 'label.enable.provider',
              confirm: 'message.confirm.enable.provider',
              show: (record) => { return record && record.id && record.state === 'Disabled' },
              mapping: {
                state: {
                  value: (record) => { return 'Enabled' }
                }
              }
            }
          ],
          details: ['name', 'state', 'id', 'servicelist', 'physicalnetworkid']
        },
        {
          title: 'GloboDns',
          actions: [
            {
              api: 'addGloboDnsHost',
              listView: true,
              icon: 'plus-outlined',
              label: 'label.globo.dns.configuration',
              args: ['url', 'username', 'password']
            },
            {
              api: 'updateNetworkServiceProvider',
              icon: 'stop-outlined',
              listView: true,
              label: 'label.disable.provider',
              confirm: 'message.confirm.disable.provider',
              show: (record) => { return record && record.id && record.state === 'Enabled' },
              mapping: {
                state: {
                  value: (record) => { return 'Disabled' }
                }
              }
            },
            {
              api: 'updateNetworkServiceProvider',
              icon: 'play-circle-outlined',
              listView: true,
              label: 'label.enable.provider',
              confirm: 'message.confirm.enable.provider',
              show: (record) => { return record && record.id && record.state === 'Disabled' },
              mapping: {
                state: {
                  value: (record) => { return 'Enabled' }
                }
              }
            },
            {
              api: 'deleteNetworkServiceProvider',
              listView: true,
              icon: 'poweroff-outlined',
              label: 'label.shutdown.provider',
              confirm: 'message.confirm.delete.provider',
              show: (record) => { return record && record.id }
            }
          ],
          details: ['name', 'state', 'id', 'servicelist']
        },
        {
          title: 'InternalLbVm',
          actions: [
            {
              api: 'updateNetworkServiceProvider',
              icon: 'stop-outlined',
              listView: true,
              label: 'label.disable.provider',
              confirm: 'message.confirm.disable.provider',
              show: (record) => { return record && record.id && record.state === 'Enabled' },
              mapping: {
                state: {
                  value: (record) => { return 'Disabled' }
                }
              }
            },
            {
              api: 'updateNetworkServiceProvider',
              icon: 'play-circle-outlined',
              listView: true,
              label: 'label.enable.provider',
              confirm: 'message.confirm.enable.provider',
              show: (record) => { return record && record.id && record.state === 'Disabled' },
              mapping: {
                state: {
                  value: (record) => { return 'Enabled' }
                }
              }
            }
          ],
          details: ['name', 'state', 'id', 'physicalnetworkid', 'destinationphysicalnetworkid', 'servicelist'],
          lists: [
            {
              title: 'label.instances',
              api: 'listInternalLoadBalancerVMs',
              mapping: {
                zoneid: {
                  value: (record) => { return record.zoneid }
                }
              },
              columns: ['name', 'zonename', 'type', 'state']
            }
          ]
        },
        {
          title: 'Netscaler',
          actions: [
            {
              api: 'addNetscalerLoadBalancer',
              icon: 'plus-outlined',
              listView: true,
              label: 'label.add.netscaler.device',
              component: shallowRef(defineAsyncComponent(() => import('@/views/infra/network/providers/AddNetscalerLoadBalancer.vue')))
            },
            {
              api: 'updateNetworkServiceProvider',
              icon: 'stop-outlined',
              listView: true,
              label: 'label.disable.provider',
              confirm: 'message.confirm.disable.provider',
              show: (record) => { return record && record.id && record.state === 'Enabled' },
              mapping: {
                state: {
                  value: (record) => { return 'Disabled' }
                }
              }
            },
            {
              api: 'updateNetworkServiceProvider',
              icon: 'play-circle-outlined',
              listView: true,
              label: 'label.enable.provider',
              confirm: 'message.confirm.enable.provider',
              show: (record) => { return record && record.id && record.state === 'Disabled' },
              mapping: {
                state: {
                  value: (record) => { return 'Enabled' }
                }
              }
            },
            {
              api: 'deleteNetworkServiceProvider',
              listView: true,
              icon: 'poweroff-outlined',
              label: 'label.shutdown.provider',
              confirm: 'message.confirm.delete.provider',
              show: (record) => { return record && record.id }
            }
          ],
          details: ['name', 'state', 'id', 'servicelist'],
          lists: [
            {
              title: 'label.devices',
              api: 'listNetscalerLoadBalancers',
              mapping: {
                physicalnetworkid: {
                  value: (record) => { return record.physicalnetworkid }
                }
              },
              columns: ['ipaddress', 'lbdevicestate', 'actions']
            }
          ]
        },
        {
          title: 'NiciraNvp',
          actions: [
            {
              api: 'addNiciraNvpDevice',
              icon: 'plus-outlined',
              listView: true,
              label: 'label.add.niciranvp.device',
              component: shallowRef(defineAsyncComponent(() => import('@/views/infra/network/providers/AddNiciraNvpDevice.vue')))
            },
            {
              api: 'updateNetworkServiceProvider',
              icon: 'stop-outlined',
              listView: true,
              label: 'label.disable.provider',
              confirm: 'message.confirm.disable.provider',
              show: (record) => { return record && record.id && record.state === 'Enabled' },
              mapping: {
                state: {
                  value: (record) => { return 'Disabled' }
                }
              }
            },
            {
              api: 'updateNetworkServiceProvider',
              icon: 'play-circle-outlined',
              listView: true,
              label: 'label.enable.provider',
              confirm: 'message.confirm.enable.provider',
              show: (record) => { return record && record.id && record.state === 'Disabled' },
              mapping: {
                state: {
                  value: (record) => { return 'Enabled' }
                }
              }
            },
            {
              api: 'deleteNetworkServiceProvider',
              listView: true,
              icon: 'poweroff-outlined',
              label: 'label.shutdown.provider',
              confirm: 'message.confirm.delete.provider',
              show: (record) => { return record && record.id }
            }
          ],
          details: ['name', 'state', 'id', 'servicelist'],
          lists: [
            {
              title: 'label.devices',
              api: 'listNiciraNvpDevices',
              mapping: {
                physicalnetworkid: {
                  value: (record) => { return record.physicalnetworkid }
                }
              },
              columns: ['hostname', 'transportzoneuuid', 'l3gatewayserviceuuid', 'l2gatewayserviceuuid', 'actions']
            }
          ]
        },
        {
          title: 'Opendaylight',
          actions: [
            {
              api: 'addOpenDaylightController',
              listView: true,
              icon: 'plus-outlined',
              label: 'label.add.opendaylight.device',
              args: ['url', 'username', 'password']
            },
            {
              api: 'updateNetworkServiceProvider',
              icon: 'stop-outlined',
              listView: true,
              label: 'label.disable.provider',
              confirm: 'message.confirm.disable.provider',
              show: (record) => { return record && record.id && record.state === 'Enabled' },
              mapping: {
                state: {
                  value: (record) => { return 'Disabled' }
                }
              }
            },
            {
              api: 'updateNetworkServiceProvider',
              icon: 'play-circle-outlined',
              listView: true,
              label: 'label.enable.provider',
              confirm: 'message.confirm.enable.provider',
              show: (record) => { return record && record.id && record.state === 'Disabled' },
              mapping: {
                state: {
                  value: (record) => { return 'Enabled' }
                }
              }
            },
            {
              api: 'deleteNetworkServiceProvider',
              listView: true,
              icon: 'poweroff-outlined',
              label: 'label.shutdown.provider',
              confirm: 'message.confirm.delete.provider',
              show: (record) => { return record && record.id }
            }
          ],
          details: ['name', 'state', 'id', 'servicelist'],
          lists: [
            {
              title: 'label.opendaylight.controllers',
              api: 'listOpenDaylightControllers',
              mapping: {
                physicalnetworkid: {
                  value: (record) => { return record.physicalnetworkid }
                }
              },
              columns: ['name', 'url', 'username', 'actions']
            }
          ]
        },
        {
          title: 'Ovs',
          details: ['name', 'state', 'id', 'servicelist'],
          lists: [
            {
              title: 'listOvsElements',
              api: 'listOvsElements',
              mapping: {
                nspid: {
                  value: (record) => { return record.id }
                }
              },
              columns: ['account', 'domain', 'enabled', 'project', 'actions']
            }
          ]
        },
        {
          title: 'PaloAlto',
          actions: [
            {
              api: 'addPaloAltoFirewall',
              listView: true,
              icon: 'plus-outlined',
              label: 'label.add.pa.device',
              component: shallowRef(defineAsyncComponent(() => import('@/views/infra/network/providers/AddPaloAltoFirewall.vue')))
            },
            {
              api: 'updateNetworkServiceProvider',
              icon: 'stop-outlined',
              listView: true,
              label: 'label.disable.provider',
              confirm: 'message.confirm.disable.provider',
              show: (record) => { return (record && record.id && record.state === 'Enabled') },
              mapping: {
                state: {
                  value: (record) => { return 'Disabled' }
                }
              }
            },
            {
              api: 'updateNetworkServiceProvider',
              icon: 'play-circle-outlined',
              listView: true,
              label: 'label.enable.provider',
              confirm: 'message.confirm.enable.provider',
              show: (record) => { return record && record.id && record.state === 'Disabled' },
              mapping: {
                state: {
                  value: (record) => { return 'Enabled' }
                }
              }
            },
            {
              api: 'deleteNetworkServiceProvider',
              listView: true,
              icon: 'poweroff-outlined',
              label: 'label.shutdown.provider',
              confirm: 'message.confirm.delete.provider',
              show: (record) => { return record && record.id }
            }
          ],
          details: ['name', 'state', 'id', 'servicelist'],
          lists: [
            {
              title: 'label.devices',
              api: 'listPaloAltoFirewalls',
              mapping: {
                physicalnetworkid: {
                  value: (record) => { return record.physicalnetworkid }
                }
              },
              columns: ['ipaddress', 'fwdevicestate', 'type', 'actions']
            }
          ]
        },
        {
          title: 'SecurityGroupProvider',
          details: ['name', 'state', 'id', 'servicelist'],
          actions: [
            {
              api: 'updateNetworkServiceProvider',
              icon: 'stop-outlined',
              listView: true,
              label: 'label.disable.provider',
              confirm: 'message.confirm.disable.provider',
              show: (record) => { return record && record.id && record.state === 'Enabled' },
              mapping: {
                state: {
                  value: (record) => { return 'Disabled' }
                }
              }
            },
            {
              api: 'updateNetworkServiceProvider',
              icon: 'play-circle-outlined',
              listView: true,
              label: 'label.enable.provider',
              confirm: 'message.confirm.enable.provider',
              show: (record) => { return record && record.id && record.state === 'Disabled' },
              mapping: {
                state: {
                  value: (record) => { return 'Enabled' }
                }
              }
            }
          ]
        },
        {
          title: 'VirtualRouter',
          actions: [
            {
              api: 'updateNetworkServiceProvider',
              icon: 'stop-outlined',
              listView: true,
              label: 'label.disable.provider',
              confirm: 'message.confirm.disable.provider',
              show: (record) => { return record && record.id && record.state === 'Enabled' },
              mapping: {
                state: {
                  value: (record) => { return 'Disabled' }
                }
              }
            },
            {
              api: 'updateNetworkServiceProvider',
              icon: 'play-circle-outlined',
              listView: true,
              label: 'label.enable.provider',
              confirm: 'message.confirm.enable.provider',
              show: (record) => { return record && record.id && record.state === 'Disabled' },
              mapping: {
                state: {
                  value: (record) => { return 'Enabled' }
                }
              }
            }
          ],
          details: ['name', 'state', 'id', 'servicelist'],
          lists: [
            {
              title: 'label.instances',
              api: 'listRouters',
              mapping: {
                listAll: {
                  value: (record) => { return true }
                },
                zoneid: {
                  value: (record) => { return record.zoneid }
                },
                forvpc: {
                  value: (record) => { return false }
                }
              },
              columns: ['name', 'state', 'hostname', 'zonename']
            }
          ]
        },
        {
          title: 'VpcVirtualRouter',
          actions: [
            {
              api: 'updateNetworkServiceProvider',
              icon: 'stop-outlined',
              listView: true,
              label: 'label.disable.provider',
              confirm: 'message.confirm.disable.provider',
              show: (record) => { return record && record.id && record.state === 'Enabled' },
              mapping: {
                state: {
                  value: (record) => { return 'Disabled' }
                }
              }
            },
            {
              api: 'updateNetworkServiceProvider',
              icon: 'play-circle-outlined',
              listView: true,
              label: 'label.enable.provider',
              confirm: 'message.confirm.enable.provider',
              show: (record) => { return record && record.id && record.state === 'Disabled' },
              mapping: {
                state: {
                  value: (record) => { return 'Enabled' }
                }
              }
            }
          ],
          details: ['name', 'state', 'id', 'servicelist'],
          lists: [
            {
              title: 'label.instances',
              api: 'listRouters',
              mapping: {
                forvpc: {
                  value: (record) => { return true }
                },
                zoneid: {
                  value: (record) => { return record.zoneid }
                },
                listAll: {
                  value: () => { return true }
                }
              },
              columns: ['name', 'state', 'hostname', 'zonename']
            }
          ]
        },
        {
          title: 'Tungsten',
          details: ['name', 'state', 'id', 'physicalnetworkid', 'servicelist'],
          lists: [
            {
              title: 'label.tungsten.fabric.provider',
              api: 'listTungstenFabricProviders',
              mapping: {
                zoneid: {
                  value: (record) => { return record.zoneid }
                }
              },
              columns: ['name', 'tungstenproviderhostname', 'tungstenproviderport', 'tungstengateway', 'tungstenprovidervrouterport', 'tungstenproviderintrospectport']
            }
          ]
        },
        {
          title: 'Nsx',
          details: ['name', 'state', 'id', 'physicalnetworkid', 'servicelist'],
          actions: [
            {
              api: 'updateNetworkServiceProvider',
              icon: 'stop-outlined',
              listView: true,
              label: 'label.disable.provider',
              confirm: 'message.confirm.disable.provider',
              // show: (record) => { return record && record.id && record.state === 'Enabled' },
              mapping: {
                state: {
                  value: (record) => { return 'Disabled' }
                }
              }
            },
            {
              api: 'updateNetworkServiceProvider',
              icon: 'play-circle-outlined',
              listView: true,
              label: 'label.enable.provider',
              confirm: 'message.confirm.enable.provider',
              // show: (record) => { return record && record.id && record.state === 'Disabled' },
              mapping: {
                state: {
                  value: (record) => { return 'Enabled' }
                }
              }
            }
          ],
          lists: [
            {
              title: 'label.nsx.provider',
              api: 'listNsxControllers',
              mapping: {
                zoneid: {
                  value: (record) => { return record.zoneid }
                }
              },
              columns: ['name', 'hostname', 'port', 'tier0gateway', 'edgecluster', 'transportzone']
            }
          ]
        },
        {
          title: 'Netris',
          details: ['name', 'state', 'id', 'physicalnetworkid', 'servicelist'],
          actions: [
            {
              api: 'updateNetworkServiceProvider',
              icon: 'stop-outlined',
              listView: true,
              label: 'label.disable.provider',
              confirm: 'message.confirm.disable.provider',
              show: (record) => { return (record && record.id && record.state === 'Enabled') },
              mapping: {
                state: {
                  value: (record) => { return 'Disabled' }
                }
              }
            },
            {
              api: 'updateNetworkServiceProvider',
              icon: 'play-circle-outlined',
              listView: true,
              label: 'label.enable.provider',
              confirm: 'message.confirm.enable.provider',
              show: (record) => { return (record && record.id && record.state === 'Disabled') },
              mapping: {
                state: {
                  value: (record) => { return 'Enabled' }
                }
              }
            }
          ],
          lists: [
            {
              title: 'label.netris.provider',
              api: 'listNetrisProviders',
              mapping: {
                zoneid: {
                  value: (record) => { return record.zoneid }
                }
              },
              columns: ['name', 'netrisurl', 'site', 'tenantname', 'netristag']
            }
          ]
        }
      ]
    }
  },
  created () {
    this.initForm()
    this.fetchData()
  },
  watch: {
    'resource.id' () {
      this.nsps = {}
      this.registeredExtensions = []
      this.fetchData()
    },
    loading (newData, oldData) {
      if (!newData && this.resource.id) {
        this.fetchData()
      }
    }
  },
  inject: ['parentPollActionCompletion'],
  provide () {
    return {
      provideSetNsp: this.setNsp,
      provideExecuteAction: this.executeAction,
      provideCloseAction: this.onCloseAction,
      provideReload: this.fetchData
    }
  },
  methods: {
    initForm () {
      this.formRef = ref()
      this.form = reactive({})
      this.rules = reactive({})
    },
    fetchData () {
      if (!this.resource || !('id' in this.resource)) {
        return
      }
      this.fetchServiceProvider(this.resource.id)
      this.fetchRegisteredExtensions(this.resource.id)
    },
    fetchRegisteredExtensions (networkId) {
      // Load NetworkOrchestrator extensions registered to this physical network
      getAPI('listExtensions', {
        type: 'NetworkOrchestrator',
        details: 'resource'
      }).then(json => {
        if (networkId !== this.resource.id) return
        const exts = (json?.listextensionsresponse?.extension) || []
        this.registeredExtensions = exts.filter(ext =>
          (ext.resources || []).some(r => r.type === 'PhysicalNetwork' && r.id === networkId)
        )
      }).catch(() => {
        if (networkId === this.resource.id) this.registeredExtensions = []
      })
    },
    extensionNspItem (extName) {
      // Build a ProviderItem-compatible itemNsp descriptor for extension-backed NSPs.
      // Mirrors the structure of hardcoded entries in hardcodedNsps.
      return {
        title: extName,
        details: ['name', 'state', 'id', 'physicalnetworkid', 'servicelist'],
        actions: [
          {
            api: 'updateNetworkServiceProvider',
            icon: 'play-circle-outlined',
            listView: true,
            label: 'label.enable.provider',
            confirm: 'message.confirm.enable.provider',
            show: (record) => record && record.id && record.state === 'Disabled',
            mapping: {
              state: { value: () => 'Enabled' }
            }
          },
          {
            api: 'updateNetworkServiceProvider',
            icon: 'stop-outlined',
            listView: true,
            label: 'label.disable.provider',
            confirm: 'message.confirm.disable.provider',
            show: (record) => record && record.id && record.state === 'Enabled',
            mapping: {
              state: { value: () => 'Disabled' }
            }
          }
        ]
      }
    },
    async fetchServiceProvider (networkId) {
      const sequence = ++this.providerLoadSequence
      this.fetchLoading = true
      this.providerLoadError = ''
      try {
        const json = await getAPI('listNetworkServiceProviders', { physicalnetworkid: networkId }, { preserveOnFailure: true })
        if (sequence !== this.providerLoadSequence || networkId !== this.resource.id) return
        const providers = json.listnetworkserviceprovidersresponse.networkserviceprovider || []
        this.nsps = Object.fromEntries(providers.map(provider => [provider.name, provider]))
      } catch (error) {
        if (sequence !== this.providerLoadSequence || networkId !== this.resource.id) return
        this.nsps = {}
        this.providerLoadError = error.response?.status === 403
          ? 'message.zone.providers.forbidden'
          : 'message.zone.providers.load.failed'
      } finally {
        if (sequence === this.providerLoadSequence && networkId === this.resource.id) this.fetchLoading = false
      }
    },
    providerStateLabel (state) {
      return this.$t({
        Enabled: 'label.enabled',
        Disabled: 'label.disabled',
        Shutdown: 'label.shutdown',
        unsupported: 'label.zone.provider.unsupported',
        unregistered: 'label.not.added'
      }[state] || 'label.unknown')
    },
    selectProvider (provider) {
      this.$router.push({ query: { ...this.$route.query, provider } })
    },
    setNsp (nsp) {
      this.nsp = nsp
    },
    handleSubmit () {
      if (this.currentAction.confirm) {
        this.executeConfirmAction()
        return
      }

      this.formRef.value.validate().then(async () => {
        const values = toRaw(this.form)
        const params = {}
        params.physicalnetworkid = this.nsp.physicalnetworkid
        for (const key in values) {
          const input = values[key]
          for (const param of this.currentAction.fieldParams) {
            if (param.name !== key) {
              continue
            }
            if (param.type === 'uuid') {
              params[key] = param.opts[input].id
            } else if (param.type === 'list') {
              params[key] = input.map(e => { return param.opts[e].id }).reduce((str, name) => { return str + ',' + name })
            } else {
              params[key] = input
            }
          }
        }
        if (this.currentAction.mapping) {
          for (const key in this.currentAction.mapping) {
            if (!this.currentAction.mapping[key].value) {
              continue
            }
            params[key] = this.currentAction.mapping[key].value(this.resource, params)
          }
        }
        this.actionLoading = true

        try {
          if (!this.nsp.id) {
            const serviceParams = {}
            serviceParams.name = this.nsp.name
            serviceParams.physicalnetworkid = this.nsp.physicalnetworkid
            const networkServiceProvider = await this.addNetworkServiceProvider(serviceParams)
            this.nsp = { ...this.nsp, ...networkServiceProvider }
          }
          params.id = this.nsp.id
          const hasJobId = await this.executeApi(this.currentAction.api, params, this.currentAction.method)
          if (!hasJobId) {
            await this.$message.success('Success')
            await this.fetchData()
          }
          this.actionLoading = false
          this.onCloseAction()
        } catch (error) {
          this.actionLoading = false
          this.$notification.error({
            message: this.$t('message.request.failed'),
            description: error
          })
        }
      }).catch(error => {
        this.formRef.value.scrollToField(error.errorFields[0].name)
      })
    },
    onCloseAction () {
      this.currentAction = {}
      this.showFormAction = false
    },
    addNetworkServiceProvider (args) {
      return new Promise((resolve, reject) => {
        let message = ''
        postAPI('addNetworkServiceProvider', args).then(async json => {
          const jobId = json.addnetworkserviceproviderresponse.jobid
          if (jobId) {
            const result = await this.pollJob(jobId)
            if (result.jobstatus === 2) {
              message = result.jobresult.errortext
              reject(message)
              return
            }
            resolve(result.jobresult.networkserviceprovider)
          }
        }).catch(error => {
          message = (error.response && error.response.headers && error.response.headers['x-description']) || error.message
          reject(message)
        })
      })
    },
    async pollJob (jobId) {
      return new Promise(resolve => {
        const asyncJobInterval = setInterval(() => {
          getAPI('queryAsyncJobResult', { jobId }).then(async json => {
            const result = json.queryasyncjobresultresponse
            if (result.jobstatus === 0) {
              return
            }

            clearInterval(asyncJobInterval)
            resolve(result)
          })
        }, 1000)
      })
    },
    executeAction (action) {
      this.currentAction = action
      if (this.currentAction.confirm) {
        this.$confirm({
          title: this.$t('label.confirmation'),
          content: this.$t(action.confirm),
          onOk: this.handleSubmit
        })
      } else {
        this.showFormAction = true
        if (!action.component) {
          const apiParams = store.getters.apis[action.api].params || []
          this.currentAction.fieldParams = action.args.map(arg => {
            const field = apiParams.filter(param => param.name === arg)[0]
            if (field.type === 'uuid') {
              this.listFieldOpts(field)
            }
            return field
          }) || []
          if (this.currentAction.api === 'addCiscoVnmcResource') {
            this.currentAction.method = 'POST'
          }
          this.setFormRules()
        }
      }
    },
    setFormRules () {
      this.form = reactive({})
      this.rules = reactive({})
      this.currentAction.fieldParams.forEach(field => {
        this.rules[field.name] = []
        const rule = {}
        rule.required = field.required
        if (field.type === 'uuid') {
          rule.message = this.$t('message.error.select')
        } else {
          rule.message = this.$t('message.error.required.input')
        }
        this.rules[field.name].push(rule)
      })
    },
    listFieldOpts (field) {
      const paramName = field.name
      const params = { listall: true }
      const possibleName = 'list' + paramName.replace('ids', '').replace('id', '').toLowerCase() + 's'
      let possibleApi
      for (const api in store.getters.apis) {
        if (api.toLowerCase().startsWith(possibleName)) {
          possibleApi = api
          break
        }
      }
      if (this.currentAction.mapping) {
        Object.keys(this.currentAction.mapping).forEach(key => {
          if (this.currentAction.mapping[key].params) {
            params[key] = this.currentAction.mapping[key].params(this.resource)
          }
        })
      }
      if (!possibleApi) {
        return
      }
      field.loading = true
      field.opts = []
      postAPI(possibleApi, params).then(json => {
        field.loading = false
        for (const obj in json) {
          if (obj.includes('response')) {
            for (const res in json[obj]) {
              if (res === 'count') {
                continue
              }
              field.opts = json[obj][res]
              break
            }
            break
          }
        }
      }).catch(error => {
        console.log(error.stack)
        field.loading = false
      })
    },
    async executeConfirmAction () {
      const params = {}
      params.id = this.nsp.id
      if (this.currentAction.mapping) {
        for (const key in this.currentAction.mapping) {
          if (!this.currentAction.mapping[key].value) {
            continue
          }
          params[key] = this.currentAction.mapping[key].value(this.resource, params)
        }
      }
      this.actionLoading = true

      try {
        const hasJobId = await this.executeApi(this.currentAction.api, params)
        if (!hasJobId) {
          await this.fetchData()
        }
        this.actionLoading = false
        this.onCloseAction()
      } catch (message) {
        this.actionLoading = false
        this.$notification.error({
          message: this.$t('message.request.failed'),
          description: message
        })
      }
    },
    executeApi (apiName, args, method) {
      return new Promise((resolve, reject) => {
        let hasJobId = false
        let message = ''
        const promise = postAPI(apiName, args)
        promise.then(json => {
          for (const obj in json) {
            if (obj.includes('response') || obj.includes(apiName)) {
              for (const res in json[obj]) {
                if (res === 'jobid') {
                  this.parentPollActionCompletion(json[obj][res], this.currentAction, this.$t(this.nsp.name))
                  hasJobId = true
                  break
                }
              }
              break
            }
          }

          resolve(hasJobId)
        }).catch(error => {
          message = (error.response && error.response.headers && error.response.headers['x-description']) || error.message
          reject(message)
        })
      })
    }
  }
}
</script>

<style scoped>
.provider-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 16px;
}
.provider-filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}
.provider-filters :deep(.ant-input-affix-wrapper) { min-width: 0; width: 100%; }
.provider-state-filter { width: min(100%, 9rem); }
.provider-list { overflow-x: auto; }
.provider-list :deep(.ant-btn-link) { padding-inline: 0; white-space: normal; text-align: start; }
.provider-list :deep([aria-current='true']) { font-weight: 600; }
.provider-list, .provider-details { min-width: 0; }
.provider-details { overflow-x: auto; overflow-wrap: anywhere; }
@media (max-width: 900px) {
  .provider-layout { grid-template-columns: minmax(0, 1fr); }
}
</style>
