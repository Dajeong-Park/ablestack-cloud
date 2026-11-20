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
  <a-row v-if="chips.length || validationError || verification" class="s2s-gateway-filter-row" style="min-height: 36px; padding-top: 12px; padding-left: 12px;">
    <a-tag v-for="chip in chips" :key="chip.key" closable @close.prevent="remove(chip.key)"><span :title="chip.value">{{ chip.label }}: {{ chip.value }}</span></a-tag>
    <span v-if="validationError || verification" role="status" class="s2s-gateway-search-verification">{{ $t('message.s2s.gateway.search.' + (validationError || verification)) }}</span>
  </a-row>
</template>
<script>
import { getAPI } from '@/api'
import { gatewayDisplayAdmin } from '@/utils/s2sGatewayDisplay'
import { s2sGatewayAuth, s2sGatewayFields, s2sGatewayPickerConfig, s2sGatewayQuery, s2sGatewayError, s2sGatewaySelection } from '@/utils/s2sGatewaySearch'
export default {
  name: 'S2sGatewayFilterChips',
  props: { validationError: { type: String, default: '' } },
  emits: ['search'],
  data () { return { labels: {}, verification: '', version: 0, disposed: false } },
  computed: {
    auth () { return s2sGatewayAuth(this.$store.getters, this.$store.state?.user?.token) },
    displayAdmin () { return gatewayDisplayAdmin(this.$store.getters) },
    chips () { return [...(this.displayAdmin ? [{ key: 'fordisplay', label: this.$t('label.s2s.display.filter'), value: this.$t(this.$route.query.fordisplay === 'false' ? 'label.s2s.display.hidden' : 'label.s2s.display.visible') }] : []), ...s2sGatewayFields.filter(key => this.$route.query[key]).map(key => ({ key, label: this.$t(key === 'id' ? 'label.id' : this.config(key).label), value: (!this.validationError && this.labels[key]) || String(this.$route.query[key]) + (key !== 'id' && (this.verification || this.validationError) ? ' · ' + this.$t('message.s2s.gateway.search.unverified') : '') }))] }
  },
  watch: {
    auth: { flush: 'sync', handler () { this.labels = {}; this.verify() } },
    '$route.fullPath': { immediate: true, handler () { this.verify() } }
  },
  beforeUnmount () { this.disposed = true; this.version++ },
  methods: {
    config: s2sGatewayPickerConfig,
    async verify () {
      const version = ++this.version; const auth = this.auth
      const current = () => !this.disposed && version === this.version && auth === this.auth
      this.labels = {}; this.verification = 'checking'
      const query = s2sGatewayQuery(this.$route.query, 20, this.$store.getters)
      const error = s2sGatewayError(query, this.$store.getters, this.$getApiParams('listVpnGateways'))
      if (error) { this.verification = error; return }
      try { const labels = await s2sGatewaySelection(getAPI, query, this.$store.getters, current); if (current()) { this.labels = labels; this.verification = '' } } catch (error) { if (current()) this.verification = ['permission', 'scope', 'missing'].includes(error.message) ? error.message : 'lookup' }
    },
    remove (key) {
      const query = { ...this.$route.query }
      for (const field of [key, ...({ domainid: ['account', 'vpcid'], account: ['vpcid'] }[key] || [])]) delete query[field]
      this.$emit('search', { s2sGatewaySearch: query })
    }
  }
}
</script>
<style scoped>
.s2s-gateway-filter-row { align-items: center; row-gap: 4px; min-width: 0; }
.s2s-gateway-filter-row :deep(.ant-tag) { max-width: 100%; white-space: normal; overflow-wrap: anywhere; }
.s2s-gateway-search-verification { color: var(--ui-text-secondary); overflow-wrap: anywhere; }
</style>
