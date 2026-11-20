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
  <a-list class="resource-details-list s2s-connection-fields" size="small" :data-source="fields">
    <template #renderItem="{ item: field }">
      <a-list-item>
        <div class="s2s-connection-field">
          <strong>{{ $t(labels[field] || 'label.' + field) }}</strong><br />
          <status v-if="field === 'state'" :text="resource.state || ''" :display-label="$t(vpnConnectionState(resource))" display-text />
          <ul v-else-if="field === 'cidrlist' && cidrs.length">
            <li v-for="cidr in cidrs" :key="cidr">{{ cidr }}</li>
          </ul>
          <vpn-psk
            v-else-if="field === 'ipsecpsk'"
            :value="resource.ipsecpsk"
            :resource="resource"
            permission="listVpnConnections" />
          <span v-else>{{ fieldValue(field) }}</span>
        </div>
      </a-list-item>
    </template>
  </a-list>
</template>

<script>
import Status from '@/components/widgets/Status'
import VpnPsk from '@/components/network/VpnPsk'
import { vpnConnectionState, vpnPassive } from '@/utils/s2sConnection'

const connectionFields = ['publicip', 'gateway', 'state', 'passive', 'cidrlist', 'dpd', 'splitconnections', 'forceencap', 'created']
const cryptoFields = ['ikeversion', 'ikepolicy', 'ikelifetime', 'esppolicy', 'esplifetime', 'ipsecpsk']
const booleanFields = ['dpd', 'splitconnections', 'forceencap']

export default {
  name: 'S2sConnectionDetails',
  components: { Status, VpnPsk },
  props: {
    resource: { type: Object, required: true },
    resourceType: { type: String, default: undefined },
    loading: { type: Boolean, default: false },
    tab: { type: String, required: true }
  },
  computed: {
    fields () { return this.tab === 's2s.connection.crypto' ? cryptoFields : connectionFields },
    labels () { return { publicip: 'label.s2s.connection.local', gateway: 'label.s2s.connection.peer', passive: 'label.s2s.connection.passive' } },
    cidrs () {
      return [...new Set(String(this.resource.cidrlist || '').split(',').map(cidr => cidr.trim()).filter(Boolean))]
    }
  },
  methods: {
    vpnConnectionState,
    fieldValue (field) {
      const value = this.resource[field]
      if (value === null || value === undefined || value === '') return '—'
      if (field === 'passive') return this.$t(vpnPassive(value) ? 'message.s2s.connection.passive.help' : 'label.no')
      if (booleanFields.includes(field)) return this.$t(value === true || value === 'true' ? 'label.yes' : 'label.no')
      return field === 'created' ? this.$toLocaleDate(value) : value
    }
  }
}
</script>

<style scoped>
.s2s-connection-fields :deep(.ant-list-item) {
  padding: 12px 0;
  color: var(--ui-text-secondary);
  border-color: var(--ui-border);
}
.s2s-connection-field { min-width: 0; max-width: 100%; overflow-wrap: anywhere; }
.s2s-connection-field strong { color: var(--ui-text-primary); }
.s2s-connection-field ul { margin: 0; padding-inline-start: 1.2em; }
</style>
