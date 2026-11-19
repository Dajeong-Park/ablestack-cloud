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
  <span class="s2s-gateway-search-control">
    <span class="filter-group">
      <a-input-search v-model:value="keyword" class="input-search" allow-clear :placeholder="$t('message.s2s.gateway.search.keyword')" :aria-label="$t('label.search')" @search="$emit('search', { searchQuery: keyword })">
        <template #addonBefore>
          <a-popover placement="bottomRight" trigger="click" :visible="visible" @visibleChange="open">
            <template #content>
              <a-form v-if="visible" :model="form" class="storage-standard-search-form guest-network-search-form s2s-gateway-search-form" layout="vertical" @finish="apply" @keydown.ctrl.enter.prevent="apply" @keydown.esc.stop.prevent="closeSearch">
                <a-alert v-if="error" role="alert" type="error" show-icon :message="$t('message.s2s.gateway.search.' + error)" />
                <a-form-item :label="$t('label.id')" html-for="s2s-gateway-search-id">
                  <a-input id="s2s-gateway-search-id" ref="idInput" v-model:value="form.id" :placeholder="$t('message.s2s.gateway.search.id')" />
                </a-form-item>
                <a-form-item v-for="kind in pickers" :key="kind" :label="$t(config(kind).label)" :html-for="'s2s-gateway-search-' + kind">
                  <S2sGatewaySearchSelect :key="kind + ':' + generation" v-model:value="form[kind]" :kind="kind" :scope="form" @update:value="changed(kind)" @blocked="blocked[kind] = $event" />
                </a-form-item>
                <div class="filter-group-button">
                  <a-button size="small" @click="reset"><stop-outlined />{{ $t('label.reset') }}</a-button>
                  <a-button type="primary" size="small" html-type="submit" :disabled="Object.values(blocked).some(Boolean)"><search-outlined />{{ $t('label.search') }}</a-button>
                </div>
              </a-form>
            </template>
            <a-button ref="advancedButton" class="filter-button" size="small" :aria-label="$t('label.advanced.search')" :aria-expanded="visible"><filter-two-tone v-if="chips.length" /><filter-outlined v-else /></a-button>
          </a-popover>
        </template>
      </a-input-search>
    </span>
    <span v-if="chips.length" class="s2s-gateway-search-chips">
      <a-tag v-for="chip in chips" :key="chip.key" closable @close.prevent="remove(chip.key)"><span :title="chip.value">{{ chip.label }}: {{ chip.value }}</span></a-tag>
    </span>
    <span v-if="validationError || verification" role="status" class="s2s-gateway-search-verification">{{ $t('message.s2s.gateway.search.' + (validationError || verification)) }}</span>
  </span>
</template>
<script>
import { getAPI } from '@/api'
import S2sGatewaySearchSelect from './S2sGatewaySearchSelect'
import { s2sGatewayAuth, s2sGatewayFields, s2sGatewayPickerConfig, s2sGatewayQuery, s2sGatewayError, s2sGatewaySelection } from '@/utils/s2sGatewaySearch'
export default {
  name: 'S2sGatewaySearch',
  components: { S2sGatewaySearchSelect },
  props: { validationError: { type: String, default: '' } },
  emits: ['search'],
  data () { return { keyword: '', form: {}, visible: false, error: '', blocked: {}, labels: {}, verification: '', generation: 0, version: 0, disposed: false } },
  computed: {
    auth () { return s2sGatewayAuth(this.$store.getters, this.$store.state?.user?.token) },
    pickers () { return ['Admin', 'DomainAdmin'].includes(this.$store.getters.userInfo?.roletype) ? ['domainid', 'account', 'vpcid'] : ['vpcid'] },
    chips () { return s2sGatewayFields.filter(key => this.$route.query[key]).map(key => ({ key, label: this.$t(key === 'id' ? 'label.id' : this.config(key).label), value: (!this.validationError && this.labels[key]) || String(this.$route.query[key]) + (key !== 'id' && (this.verification || this.validationError) ? ' · ' + this.$t('message.s2s.gateway.search.unverified') : '') })) }
  },
  watch: {
    auth: { flush: 'sync', handler () { this.visible = false; this.form = {}; this.blocked = {}; this.labels = {}; this.generation++; this.verify() } },
    '$route.fullPath': { immediate: true, handler () { this.visible = false; this.keyword = this.$route.query.keyword || this.$route.query.q || ''; this.verify() } }
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
    open (value) { if (!value) return this.closeSearch(); this.visible = true; this.form = { ...s2sGatewayQuery(this.$route.query, 20, this.$store.getters) }; this.blocked = {}; this.error = ''; this.generation++; this.$nextTick(() => this.$refs.idInput?.focus()) },
    closeSearch () { this.visible = false; this.$nextTick(() => { if (!this.disposed && this.$refs.advancedButton?.$el) this.$refs.advancedButton.$el.focus() }) },
    changed (kind) { for (const key of ({ domainid: ['account', 'vpcid'], account: ['vpcid'] }[kind] || [])) { delete this.form[key]; delete this.blocked[key] } },
    apply () {
      if (Object.values(this.blocked).some(Boolean)) return
      const values = s2sGatewayQuery({ ...this.form, keyword: this.keyword, q: undefined }, 20, this.$store.getters)
      this.error = s2sGatewayError(values, this.$store.getters, this.$getApiParams('listVpnGateways'))
      if (this.error) return
      this.$emit('search', { s2sGatewaySearch: values }); this.closeSearch()
    },
    reset () { this.keyword = ''; this.form = {}; this.error = ''; this.closeSearch(); this.$emit('search', { s2sGatewaySearch: {} }) },
    remove (key) { this.form = { ...this.$route.query }; delete this.form[key]; this.changed(key); this.$emit('search', { s2sGatewaySearch: this.form }) }
  }
}
</script>
<style scoped>
.s2s-gateway-search-control { display: table-cell; width: 100%; line-height: 31px; min-width: 0; max-width: 100%; }
.s2s-gateway-search-chips { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
.s2s-gateway-search-chips :deep(.ant-tag) { max-width: 100%; white-space: normal; overflow-wrap: anywhere; color: var(--ui-text-primary); background: var(--ui-bg-elevated); border-color: var(--ui-border-strong); }
.s2s-gateway-search-verification { color: var(--ui-text-secondary); overflow-wrap: anywhere; }
.s2s-gateway-search-form { max-height: 65vh; overflow-y: auto; width: min(340px, calc(100vw - 64px)); scroll-padding-bottom: 48px; }
.s2s-gateway-search-form :deep(.ant-form-item-label > label) { color: var(--ui-text-primary); }
.s2s-gateway-search-form :deep(.ant-input), .s2s-gateway-search-form :deep(.ant-select:not(.ant-select-disabled) .ant-select-selector) { color: var(--ui-text-primary); background: var(--ui-bg-input); border-color: var(--ui-border-strong); }
.s2s-gateway-search-form .filter-group-button { position: sticky; bottom: 0; z-index: 1; display: flex; justify-content: space-between; gap: 8px; background: var(--ui-bg-elevated); border-top: 1px solid var(--ui-border); padding: 8px 0; }
.s2s-gateway-search-form .filter-group-button :deep(.ant-btn) { position: static; }
</style>
