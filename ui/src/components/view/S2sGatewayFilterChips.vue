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
  <a-row v-if="chips.length" class="s2s-gateway-filter-row" style="min-height: 36px; padding-top: 12px; padding-left: 12px;">
    <a-tag v-for="chip in chips" :key="chip.key" closable @close.prevent="remove(chip.key)"><span :title="chip.value">{{ chip.label }}: {{ chip.value }}</span></a-tag>
  </a-row>
</template>
<script>
import { getAPI } from '@/api'
import { s2sGatewayAuth, s2sGatewayFields, s2sGatewayPickerConfig, s2sGatewayQuery, s2sGatewayError, s2sGatewaySelection } from '@/utils/s2sGatewaySearch'
export default {
  name: 'S2sGatewayFilterChips',
  props: { validationError: { type: String, default: '' }, apiName: { type: String, default: 'listVpnGateways' } },
  emits: ['search'],
  data () { return { labels: {}, version: 0, disposed: false } },
  computed: {
    auth () { return s2sGatewayAuth(this.$store.getters, this.$store.state?.user?.token) },
    chips () { return s2sGatewayFields.filter(key => this.$route.query[key]).map(key => ({ key, label: this.$t(key === 'id' ? 'label.id' : this.config(key).label), value: (!this.validationError && this.labels[key]) || String(this.$route.query[key]) })) }
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
      this.labels = {}
      if (!this.chips.length) return
      const query = s2sGatewayQuery(this.$route.query, 20, this.$store.getters, this.apiName)
      if (s2sGatewayError(query, this.$store.getters, this.$getApiParams(this.apiName), this.apiName)) return
      const labels = await s2sGatewaySelection(getAPI, query, this.$store.getters, current).catch(() => null)
      if (labels && current()) this.labels = labels
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
</style>
