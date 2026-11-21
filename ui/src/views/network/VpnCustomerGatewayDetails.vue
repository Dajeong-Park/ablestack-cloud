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
  <div v-if="resource.id" class="gateway-details">
    <a-descriptions
      v-for="section in sections"
      :key="section.title"
      :title="$t('label.vpn.customer.gateway.section.' + section.title)"
      :column="{ xs: 1, sm: 1, md: 1, lg: 2, xl: 2, xxl: 2 }"
      layout="vertical"
      size="small">
      <a-descriptions-item
        v-for="field in section.fields"
        :key="field"
        :label="$t(field === 'gateway' ? 'label.vpn.customer.gateway.peer' : 'label.' + field)">
        <VpnPsk v-if="field === 'ipsecpsk'" :value="resource.ipsecpsk" :resource="resource" permission="listVpnCustomerGateways" />
        <template v-else-if="['dpd', 'splitconnections', 'forceencap'].includes(field)">
          {{ $t(resource[field] === true ? 'label.yes' : resource[field] === false ? 'label.no' : 'label.unknown') }}
        </template>
        <template v-else>{{ resource[field] ?? '—' }}</template>
      </a-descriptions-item>
    </a-descriptions>
  </div>
</template>

<script>
import VpnPsk from '@/components/network/VpnPsk'

export default {
  name: 'VpnCustomerGatewayDetails',
  components: { VpnPsk },
  props: { resource: { type: Object, required: true } },
  computed: {
    sections () {
      const owner = this.resource.project ? 'project' : 'account'
      return [
        { title: 'general', fields: ['name', 'id', 'gateway', 'cidrlist', owner, 'domain', 'ipsecpsk'] },
        { title: 'ike', fields: ['ikeversion', 'ikepolicy', 'ikelifetime'] },
        { title: 'esp', fields: ['esppolicy', 'esplifetime'] },
        { title: 'options', fields: ['dpd', 'splitconnections', 'forceencap'] }
      ]
    }
  }
}
</script>

<style scoped>
.gateway-details {
  min-width: 0;
  overflow-wrap: anywhere;
}
.gateway-details :deep(.ant-descriptions + .ant-descriptions) {
  margin-top: 12px;
  padding-top: 16px;
  border-top: 1px solid var(--ui-border);
}
.gateway-details :deep(.ant-descriptions-item-label) {
  color: var(--ui-text-secondary);
}
.gateway-details :deep(.ant-descriptions-item-content),
.gateway-details :deep(.ant-descriptions-title) {
  color: var(--ui-text-primary);
}
</style>
