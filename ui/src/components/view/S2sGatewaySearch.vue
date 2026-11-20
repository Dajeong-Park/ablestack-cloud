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
      <a-input-search v-model:value="keyword" class="input-search" allow-clear :placeholder="$t(isConnection ? 'message.s2s.connection.search.keyword' : 'message.s2s.gateway.search.keyword')" :aria-label="$t('label.search')" @search="$emit('search', { searchQuery: keyword })">
        <template #addonBefore>
          <a-popover placement="bottomRight" trigger="click" :visible="visible" @visibleChange="open">
            <template #content>
              <a-form v-if="visible" :model="form" class="s2s-gateway-search-form" layout="vertical" @finish="apply" @keydown.ctrl.enter.prevent="apply" @keydown.esc.stop.prevent="closeSearch">
                <a-alert v-if="error" role="alert" type="error" show-icon :message="$t('message.s2s.gateway.search.' + error)" />
                <a-form-item :label="$t('label.id')" html-for="s2s-gateway-search-id">
                  <a-input id="s2s-gateway-search-id" ref="idInput" v-model:value="form.id" :placeholder="$t(isConnection ? 'message.s2s.connection.search.id' : 'message.s2s.gateway.search.id')" />
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
            <a-button ref="advancedButton" class="filter-button" size="small" :aria-label="$t('label.advanced.search')" :aria-expanded="visible"><filter-two-tone v-if="filtered" /><filter-outlined v-else /></a-button>
          </a-popover>
        </template>
      </a-input-search>
    </span>
  </span>
</template>
<script>
import S2sGatewaySearchSelect from './S2sGatewaySearchSelect'
import { s2sGatewayAuth, s2sGatewayPickerConfig, s2sGatewayQuery, s2sGatewayError, vpnConnectionApi } from '@/utils/s2sGatewaySearch'
export default {
  name: 'S2sGatewaySearch',
  components: { S2sGatewaySearchSelect },
  props: { validationError: { type: String, default: '' }, apiName: { type: String, default: 'listVpnGateways' } },
  emits: ['search'],
  data () { return { keyword: '', form: {}, visible: false, error: '', blocked: {}, generation: 0, disposed: false } },
  computed: {
    auth () { return s2sGatewayAuth(this.$store.getters, this.$store.state?.user?.token) },
    isConnection () { return this.apiName === vpnConnectionApi },
    pickers () {
      if (!['Admin', 'DomainAdmin'].includes(this.$store.getters.userInfo?.roletype)) return ['vpcid']
      return this.isConnection && this.form.projectid !== '0' ? ['domainid', 'vpcid'] : ['domainid', 'account', 'vpcid']
    },
    filtered () { return ['id', 'domainid', 'account', 'vpcid'].some(key => this.$route.query[key]) }
  },
  watch: {
    auth: { flush: 'sync', handler () { this.visible = false; this.form = {}; this.blocked = {}; this.generation++ } },
    '$route.fullPath': { immediate: true, handler () { this.visible = false; this.keyword = this.$route.query.keyword || this.$route.query.q || '' } }
  },
  mounted () { window.addEventListener('resize', this.resized) },
  beforeUnmount () { window.removeEventListener('resize', this.resized); this.disposed = true },
  methods: {
    config: s2sGatewayPickerConfig,
    resized () { if (this.visible) this.closeSearch() },
    open (value) { if (!value) return this.closeSearch(); this.visible = true; this.form = { ...s2sGatewayQuery(this.$route.query, 20, this.$store.getters, this.apiName) }; this.blocked = {}; this.error = ''; this.generation++; this.$nextTick(() => this.$refs.idInput?.focus()) },
    closeSearch () { this.visible = false; this.$nextTick(() => { if (!this.disposed && this.$refs.advancedButton?.$el) this.$refs.advancedButton.$el.focus() }) },
    changed (kind) { for (const key of ({ domainid: ['account', 'vpcid'], account: ['vpcid'] }[kind] || [])) { delete this.form[key]; delete this.blocked[key] } },
    apply () {
      if (Object.values(this.blocked).some(Boolean)) return
      const values = s2sGatewayQuery({ ...this.form, keyword: this.keyword, q: undefined }, 20, this.$store.getters, this.apiName)
      this.error = s2sGatewayError(values, this.$store.getters, this.$getApiParams(this.apiName), this.apiName)
      if (this.error) return
      this.$emit('search', { s2sGatewaySearch: values }); this.closeSearch()
    },
    reset () { this.keyword = ''; this.form = {}; this.error = ''; this.closeSearch(); this.$emit('search', { s2sGatewaySearch: {} }) }
  }
}
</script>
<style scoped>
.s2s-gateway-search-control { display: table-cell; width: 100%; line-height: 31px; min-width: 0; max-width: 100%; }
.s2s-gateway-search-form :deep(.ant-form-item-extra) { color: var(--ui-text-secondary); overflow-wrap: anywhere; }
.s2s-gateway-search-form { max-height: 65vh; overflow-y: auto; width: min(340px, calc(100vw - 64px)); scroll-padding-bottom: 48px; }
.s2s-gateway-search-form .filter-group-button { position: sticky; bottom: 0; z-index: 1; display: flex; justify-content: space-between; gap: 8px; background: var(--ui-bg-elevated); border-top: 1px solid var(--ui-border); padding: 8px 0; }
.s2s-gateway-search-form .filter-group-button :deep(.ant-btn) { position: static; }
</style>
