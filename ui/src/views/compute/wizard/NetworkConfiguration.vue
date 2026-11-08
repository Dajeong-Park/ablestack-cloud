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
  <div style="margin-top: 10px;" v-if="this.vnf">
    <label>{{ $t('message.configure.network.ip.and.mac') }}</label>
  </div>
  <div style="margin-top: 10px;" v-else>
    <label>{{ $t('message.configure.network.select.default.network') }}</label>
  </div>
  <a-form
    :ref="formRef"
    :model="form"
    :rules="rules">
    <a-table
      :columns="columns"
      :dataSource="dataItems"
      :pagination="false"
      :rowSelection="rowSelection"
      :customRow="onClickRow"
      :rowKey="record => record.id"
      size="middle"
      :scroll="{ x: 850, y: 225 }">
      <template #bodyCell="{ column, text, record }">
        <template v-if="column.key === 'name'">
          <div>{{ text }}</div>
          <small v-if="record.type!=='L2'">{{ $t('label.cidr') + ': ' + record.cidr }}</small>
        </template>
        <template  v-if="!this.autoscale">
          <template v-if="column.key === 'ipAddress'">
            <a-form-item
              style="display: block"
              v-if="record.type !== 'L2'"
              :name="'ipAddress' + record.id">
              <div class="network-ip-options">
                <a-auto-complete
                  v-model:value="form['ipAddress' + record.id]"
                  :aria-label="$t('label.ip') + ' ' + record.name"
                  :options="(ipOptions[record.id] || []).map(ip => ({ value: ip.ipaddress }))"
                  allowClear
                  :placeholder="$t('label.auto.assign')"
                  :filterOption="(input, option) => option.value.includes(input)"
                  @change="($event) => updateNetworkData('ipAddress', record.id, $event)" />
                <a-tooltip :title="$t('label.refresh')">
                  <a-button
                    v-if="canQueryIps(record)"
                    :aria-label="$t('label.refresh') + ' ' + record.name"
                    :loading="ipOptionsLoading[record.id]"
                    :disabled="ipOptionsLoading[record.id]"
                    @click.stop="readIpOptions(record, true)">
                    <template #icon><reload-outlined /></template>
                  </a-button>
                </a-tooltip>
                <a-tooltip :title="getIpRangeDescription(record)">
                  <info-circle-outlined />
                </a-tooltip>
              </div>
              <small class="network-ip-hint">{{ $t('message.network.ip.manual.or.auto') }}</small>
              <a-alert
                v-if="['error', 'unavailable'].includes(ipOptionsStatus[record.id])"
                class="network-ip-feedback"
                :type="ipOptionsStatus[record.id] === 'error' ? 'warning' : 'info'"
                show-icon
                :message="$t(ipOptionsStatus[record.id] === 'error' ? 'message.network.ip.lookup.failed' : 'message.network.ip.lookup.unavailable')" />
            </a-form-item>
          </template>
          <template v-if="column.key === 'macAddress'">
            <a-form-item style="display: block" :name="'macAddress' + record.id">
              <a-input
                style="width: 150px;"
                :placeholder="$t('label.macaddress')"
                v-model:value="form[`macAddress` + record.id]"
                @change="($event) => updateNetworkData('macAddress', record.id, $event.target.value)">
                <template #suffix>
                  <a-tooltip :title="$t('label.macaddress.example')">
                    <info-circle-outlined style="color: rgba(0,0,0,.45)" />
                  </a-tooltip>
                </template>
              </a-input>
            </a-form-item>
          </template>
          <template v-if="column.key === 'enabled'">
            <a-form-item v-if="record.type === 'L2'" :name="'enabled' + record.id">
              <a-switch v-model:checked="form[`enabled` + record.id]" @change="($event) => updateNetworkData('enabled', record.id, $event)" style="margin-bottom: 30px"/>
            </a-form-item>
          </template>
        </template>
      </template>
    </a-table>
    <div v-if="preFillContent.allowIpAddressesFetch" style="margin-bottom: 2rem;">
      <a-button :type="'primary'" @click="handleFetchIpAddresses">
        {{ $t('label.fetch.from.backup') }}
      </a-button>
      <a-button style="margin-left: 8px;" @click="handleClearIpAddresses">
        {{ $t('label.clear') }}
      </a-button>
    </div>
  </a-form>
</template>

<script>
import { ref, reactive } from 'vue'
import { getAPI } from '@/api'

export default {
  name: 'NetworkConfiguration',
  props: {
    items: {
      type: Array,
      default: () => []
    },
    value: {
      type: String,
      default: ''
    },
    autoscale: {
      type: Boolean,
      default: () => false
    },
    vnf: {
      type: Boolean,
      default: () => false
    },
    preFillContent: {
      type: Object,
      default: () => {}
    }
  },
  data () {
    return {
      networks: [],
      columns: [
        {
          key: 'name',
          dataIndex: 'name',
          title: this.$t('label.network'),
          width: 200
        },
        {
          key: 'ipAddress',
          dataIndex: 'ip',
          title: this.$t('label.ip'),
          width: 280
        },
        {
          key: 'macAddress',
          dataIndex: 'mac',
          title: this.$t('label.macaddress'),
          width: 220
        },
        {
          key: 'enabled',
          dataIndex: 'enabled',
          title: this.$t('label.vmnic.enabled'),
          width: 100
        }
      ],
      selectedRowKeys: [],
      dataItems: [],
      ipOptions: {},
      ipOptionsLoading: {},
      ipOptionsStatus: {},
      ipRequests: {},
      ipRequestSequence: 0,
      ipLookupStopped: false,
      macRegex: /^([0-9A-F]{2}[:-]){5}([0-9A-F]{2})$/i,
      ipV4Regex: /^(25[0-5]|2[0-4]\d|[01]?\d\d?)\.(25[0-5]|2[0-4]\d|[01]?\d\d?)\.(25[0-5]|2[0-4]\d|[01]?\d\d?)\.(25[0-5]|2[0-4]\d|[01]?\d\d?)$/i
    }
  },
  beforeCreate () {
    this.dataItems = []
  },
  created () {
    this.dataItems = this.items
    this.initForm()
    this.fetchIpOptions()
    if (this.dataItems.length > 0) {
      this.selectedRowKeys = [this.dataItems[0].id]
      this.$emit('select-default-network-item', this.dataItems[0].id)
    }
  },
  computed: {
    ipLookupScope () {
      const { project, userInfo, apis } = this.$store.getters
      return JSON.stringify([project?.id, userInfo?.id, userInfo?.roleid, this.$store.state?.user?.token,
        this.$route?.path, Object.keys(apis || {}).sort()])
    },
    rowSelection () {
      if (this.vnf) {
        return null
      }
      return {
        type: 'radio',
        selectedRowKeys: this.selectedRowKeys,
        onChange: this.onSelectRow
      }
    }
  },
  watch: {
    ipLookupScope () {
      this.ipRequests = {}
      this.ipOptions = {}
      this.ipOptionsLoading = {}
      this.ipOptionsStatus = {}
      this.fetchIpOptions()
    },
    value (newValue, oldValue) {
      if (newValue && newValue !== oldValue) {
        this.selectedRowKeys = [newValue]
      }
    },
    items: {
      deep: true,
      handler (newData) {
        const signature = rows => JSON.stringify((rows || []).map(n => [n.id, n.type, n.cidr, n.projectid]))
        const changed = signature(this.dataItems) !== signature(newData)
        this.dataItems = newData || []
        if (changed) {
          this.initForm()
          this.fetchIpOptions()
          const keyEx = this.dataItems.filter((item) => this.selectedRowKeys.includes(item.id))
          if (!keyEx || keyEx.length === 0) {
            this.selectedRowKeys = this.dataItems.length ? [this.dataItems[0].id] : []
            this.$emit('select-default-network-item', this.dataItems[0]?.id)
          }
        }
      }
    }
  },
  beforeUnmount () {
    this.ipLookupStopped = true
    this.ipRequests = {}
  },
  emits: ['update-network-config', 'select-default-network-item', 'handler-error'],
  methods: {
    initForm () {
      const previous = this.form || {}
      this.formRef = ref()
      this.form = reactive({})
      this.rules = reactive({})

      const form = {}
      const rules = {}

      let presetMacAddressIndex = 0

      this.dataItems.forEach(record => {
        const ipAddressKey = 'ipAddress' + record.id
        const macAddressKey = 'macAddress' + record.id
        const enabled = 'enabled' + record.id
        rules[ipAddressKey] = [{
          validator: this.validatorIpAddress,
          cidr: record.cidr,
          networkType: record.type
        }]
        form[ipAddressKey] = record.ipAddress !== undefined ? record.ipAddress : previous[ipAddressKey]
        rules[macAddressKey] = [{ validator: this.validatorMacAddress }]
        if (record.macAddress !== undefined) {
          form[macAddressKey] = record.macAddress
        } else if (previous[macAddressKey]) {
          form[macAddressKey] = previous[macAddressKey]
        } else if (this.preFillContent.macAddressArray && this.preFillContent.macAddressArray[presetMacAddressIndex]) {
          form[macAddressKey] = this.preFillContent.macAddressArray[presetMacAddressIndex]
          presetMacAddressIndex++
        }
        form[enabled] = record.enabled === undefined ? true : record.enabled
      })
      this.form = reactive(form)
      this.rules = reactive(rules)
    },
    fetchIpOptions () {
      for (const id of Object.keys(this.ipRequests)) {
        if (!this.dataItems.some(n => n.id === id)) {
          delete this.ipRequests[id]
          delete this.ipOptions[id]
          delete this.ipOptionsLoading[id]
          delete this.ipOptionsStatus[id]
        }
      }
      this.dataItems.forEach(record => {
        if (record.type === 'Shared') {
          this.fetchPublicIps(record)
        } else if (record.type === 'Isolated') {
          this.fetchAvailableGuestIps(record)
        } else {
          this.ipOptions[record.id] = []
        }
      })
    },
    fetchPublicIps (network) {
      return this.readIpOptions(network)
    },
    fetchAvailableGuestIps (network) {
      return this.readIpOptions(network)
    },
    canQueryIps (network) {
      return !!this.$store.getters.apis[network.type === 'Shared' ? 'listPublicIpAddresses' : 'listAvailableGuestIps']
    },
    readIpOptions (network, force = false) {
      const id = network.id
      const scope = this.ipLookupScope
      const old = this.ipRequests[id]
      // Parent updates to IP/MAC/enabled fields must not restart discovery or
      // repeatedly notify. Only an explicit refresh retries a completed failure.
      if (!force && old && old.scope === scope) return old.promise || Promise.resolve()
      const sequence = ++this.ipRequestSequence
      this.ipRequests[id] = { scope, sequence }
      this.ipOptions[network.id] = []
      this.ipOptionsLoading[network.id] = false
      if (!this.canQueryIps(network)) {
        this.ipOptionsStatus[id] = 'unavailable'
        return Promise.resolve()
      }
      const projectid = this.$store.getters.project?.id
      if (network.projectid && network.projectid !== projectid) return Promise.resolve()
      const shared = network.type === 'Shared'
      const api = shared ? 'listPublicIpAddresses' : 'listAvailableGuestIps'
      const params = {
        networkid: id,
        ignoreproject: true,
        ...(projectid ? { projectid } : {}),
        ...(shared ? { allocatedonly: false, forvirtualnetwork: false } : { pagesize: -1 })
      }
      const current = () => !this.ipLookupStopped && this.ipLookupScope === scope && this.ipRequests[id]?.sequence === sequence && this.dataItems.some(n => n.id === id)
      this.ipOptionsLoading[network.id] = true
      this.ipOptionsStatus[id] = 'loading'
      const promise = getAPI(api, params, { preserveOnFailure: true }).then(json => {
        const response = json[shared ? 'listpublicipaddressesresponse' : 'listavailableguestipsresponse']
        if (!response || response.errorcode || (response.availableguestip && !Array.isArray(response.availableguestip)) ||
            (response.publicipaddress && !Array.isArray(response.publicipaddress))) throw new Error('Invalid IP candidate response')
        if (!current()) return
        const rows = shared ? (response.publicipaddress || []).filter(ip => ip.state === 'Free') : response.availableguestip || []
        this.ipOptions[id] = rows.map(ip => ({ ipaddress: ip.ipaddress }))
        this.ipOptionsStatus[id] = 'ready'
      }).catch(() => {
        if (current()) this.ipOptionsStatus[id] = 'error'
      }).finally(() => {
        if (current()) this.ipOptionsLoading[id] = false
      })
      this.ipRequests[id].promise = promise
      return promise
    },
    onSelectRow (value) {
      this.selectedRowKeys = value
      this.$emit('select-default-network-item', value[0])
    },
    updateNetworkData (name, key, value) {
      this.formRef.value.validate().then(() => {
        this.updateNetworkDataWithoutValidation(name, key, value)
        this.$emit('update-network-config', this.networks)
      }).catch((error) => {
        this.formRef.value.scrollToField(error.errorFields[0].name)
        this.$emit('handler-error', true)
      })
    },
    updateNetworkDataWithoutValidation (name, key, value) {
      this.$emit('handler-error', false)
      const index = this.networks.findIndex(item => item.key === key)
      if (index === -1) {
        const networkItem = {}
        networkItem.key = key
        networkItem[name] = value
        this.networks.push(networkItem)
        this.$emit('update-network-config', this.networks)
        return
      }

      this.networks.filter((item, index) => {
        if (item.key === key) {
          this.networks[index][name] = value
        }
      })
    },
    removeItem (id) {
      this.dataItems = this.dataItems.filter(item => item.id !== id)
      if (this.selectedRowKeys.includes(id)) {
        if (this.dataItems && this.dataItems.length > 0) {
          this.selectedRowKeys = [this.dataItems[0].id]
          this.$emit('select-default-network-item', this.dataItems[0].id)
        }
      }
    },
    handleFetchIpAddresses () {
      if (!this.preFillContent.networkids) {
        return
      }
      if (!this.preFillContent.ipAddresses && !this.preFillContent.macAddresses) {
        return
      }

      const networkIds = this.dataItems.map(item => item.id)
      this.dataItems.forEach(record => {
        const ipAddressKey = 'ipAddress' + record.id
        const macAddressKey = 'macAddress' + record.id
        this.form[ipAddressKey] = ''
        this.form[macAddressKey] = ''
      })

      networkIds.forEach((networkId) => {
        const backupIndex = this.preFillContent.networkids.findIndex(id => id === networkId)
        if (backupIndex !== -1) {
          if (this.preFillContent.ipAddresses && backupIndex < this.preFillContent.ipAddresses.length) {
            const ipAddress = this.preFillContent.ipAddresses[backupIndex]
            if (ipAddress) {
              const ipAddressKey = 'ipAddress' + networkId
              this.form[ipAddressKey] = ipAddress
              this.updateNetworkDataWithoutValidation('ipAddress', networkId, ipAddress)
            }
          }

          if (this.preFillContent.macAddresses && backupIndex < this.preFillContent.macAddresses.length) {
            const macAddress = this.preFillContent.macAddresses[backupIndex]
            if (macAddress) {
              const macAddressKey = 'macAddress' + networkId
              this.form[macAddressKey] = macAddress
              this.updateNetworkDataWithoutValidation('macAddress', networkId, macAddress)
            }
          }
        }
      })
    },
    handleClearIpAddresses () {
      this.dataItems.forEach(record => {
        const ipAddressKey = 'ipAddress' + record.id
        const macAddressKey = 'macAddress' + record.id
        this.form[ipAddressKey] = ''
        this.form[macAddressKey] = ''

        this.updateNetworkDataWithoutValidation('ipAddress', record.id, '')
        this.updateNetworkDataWithoutValidation('macAddress', record.id, '')
      })

      this.networks = []
      this.$emit('update-network-config', this.networks)
    },
    async validatorMacAddress (rule, value) {
      if (!value || value === '') {
        return Promise.resolve()
      } else if (!this.macRegex.test(value)) {
        return Promise.reject(this.$t('message.error.macaddress'))
      } else {
        return Promise.resolve()
      }
    },
    async validatorIpAddress (rule, value) {
      if (!value || value === '') {
        return Promise.resolve()
      } else if (!this.ipV4Regex.test(value)) {
        return Promise.reject(this.$t('message.error.ipv4.address'))
      } else if (rule.networkType === 'Isolated' && !this.isIp4InCidr(value, rule.cidr)) {
        const rangeIps = this.calculateCidrRange(rule.cidr)
        const message = `${this.$t('message.error.ip.range')} ${rangeIps[0]} ~ ${rangeIps[1]}`
        return Promise.reject(message)
      } else {
        return Promise.resolve()
      }
    },
    getIpRangeDescription (network) {
      const rangeIps = this.calculateCidrRange(network.cidr)
      const rangeIpDescription = [`${this.$t('label.ip.range')}:`, rangeIps[0], '-', rangeIps[1]].join(' ')
      return rangeIpDescription
    },
    isIp4InCidr (ip, cidr) {
      const [range, bits = 32] = cidr.split('/')
      const mask = ~(2 ** (32 - bits) - 1)
      return (this.ip4ToInt(ip) & mask) === (this.ip4ToInt(range) & mask)
    },
    calculateCidrRange (cidr) {
      const [range, bits = 32] = cidr.split('/')
      const mask = ~(2 ** (32 - bits) - 1)
      return [this.intToIp4(this.ip4ToInt(range) & mask), this.intToIp4(this.ip4ToInt(range) | ~mask)]
    },
    ip4ToInt (ip) {
      return ip.split('.').reduce((int, oct) => (int << 8) + parseInt(oct, 10), 0) >>> 0
    },
    intToIp4 (int) {
      return [(int >>> 24) & 0xFF, (int >>> 16) & 0xFF, (int >>> 8) & 0xFF, int & 0xFF].join('.')
    },
    onClickRow (record, index) {
      return {
        onClick: (event) => {
          if (event.target.tagName.toLowerCase() !== 'input') {
            this.selectedRowKeys = [record.id]
            this.$emit('select-default-network-item', record.id)
          }
        }
      }
    }
  }
}
</script>

<style lang="less" scoped>
  .network-ip-options {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 220px;
    min-width: 220px;

    .ant-select { flex: 1; min-width: 0; }
  }

  .network-ip-hint { display: block; margin-top: 6px; }
  .network-ip-feedback { margin-top: 6px; }

  .ant-table-wrapper {
    margin: 2rem 0;
  }

  .ant-table-wrapper :deep(.ant-table-body) {
    min-width: 0 !important;
    max-width: 100%;
  }

  :deep(.ant-table-tbody) > tr > td {
    cursor: pointer;
  }

  .ant-form .ant-form-item {
    margin-bottom: 0;
    padding-bottom: 0;
  }
</style>
