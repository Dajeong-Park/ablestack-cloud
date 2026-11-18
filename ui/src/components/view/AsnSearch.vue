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
  <span class="asn-search-control" @keydown.esc.stop="closeSearch">
    <span class="filter-group">
      <a-input-search v-model:value="keyword" class="input-search" :placeholder="$t('label.search')" allow-clear @search="$emit('search', { asnSearch: { ...$route.query, keyword, q: undefined } })">
        <template #addonBefore>
          <a-popover placement="bottomRight" trigger="click" :visible="visible" @visibleChange="open">
            <template #content>
              <a-form v-if="visible" :model="form" layout="vertical" class="storage-standard-search-form asn-search-form" @finish="apply" @keydown.esc.stop.prevent="closeSearch" @keydown.ctrl.enter.prevent="!$event.repeat && apply()">
                <a-alert v-if="error" role="alert" type="error" show-icon :message="$t('message.asn.search.' + error)" />
                <a-form-item :label="$t('label.asn.search.exact')" html-for="asn-search-exact">
                  <a-input id="asn-search-exact" ref="exactInput" v-model:value="form.asnumber" inputmode="numeric" :aria-describedby="'asn-exact-help'" />
                  <template #extra><span id="asn-exact-help">{{ $t('message.asn.search.exact') }}</span></template>
                </a-form-item>
                <a-form-item v-for="field in pickers" :key="field" :label="$t(config(field).label)" :html-for="'asn-search-' + field">
                  <AsnSearchSelect :key="field + ':' + generation" v-model:value="form[field]" :kind="field" :scope="form" @update:value="changed(field)" @blocked="blocked[field] = $event" />
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
    <span class="asn-search-chips">
      <a-tag v-for="chip in chips" :key="chip.key" closable @close.prevent="remove(chip.key)"><span :title="chip.value">{{ chip.label }}: {{ chip.value }}</span></a-tag>
    </span>
    <span v-if="validationError || verification" role="status" class="asn-search-verification">{{ $t('message.asn.search.' + (validationError || verification)) }}</span>
  </span>
</template>
<script>
import { getAPI } from '@/api'
import AsnSearchSelect from './AsnSearchSelect'
import { asnAuth, asnFields, asnConfig, asnQuery, asnError, asnSelection } from '@/utils/asnSearch'
export default {
  name: 'AsnSearch',
  components: { AsnSearchSelect },
  props: { validationError: { type: String, default: '' } },
  emits: ['search'],
  data () { return { keyword: '', form: {}, visible: false, error: '', blocked: {}, labels: {}, verification: '', generation: 0, version: 0, disposed: false, pickers: ['zoneid', 'asnrangeid', 'domainid', 'account', 'vpcid', 'networkid'] } },
  computed: {
    auth () { return asnAuth(this.$store) },
    chips () { return asnFields.filter(k => this.$route.query[k] !== undefined).map(key => ({ key, label: this.$t(key === 'asnumber' ? 'label.asn.search.exact' : asnConfig(key).label), value: (!this.validationError && this.labels[key]) || String(this.$route.query[key]) + (key !== 'asnumber' && (this.validationError || this.verification) ? ' · ' + this.$t('message.asn.search.unverified') : '') })) }
  },
  watch: {
    auth: { flush: 'sync', handler () { this.visible = false; this.form = {}; this.blocked = {}; this.labels = {}; this.generation++; this.verify() } },
    '$route.fullPath': { immediate: true, handler () { this.visible = false; this.keyword = this.$route.query.keyword || this.$route.query.q || ''; this.verify() } }
  },
  beforeUnmount () { this.disposed = true; this.version++ },
  methods: {
    config: asnConfig,
    async verify () {
      const version = ++this.version; const auth = this.auth; const query = asnQuery(this.$route.query, 20, this.$store.getters)
      const current = () => !this.disposed && version === this.version && auth === this.auth
      this.labels = {}; this.verification = 'checking'
      try { const result = await asnSelection(getAPI, query, this.$store.getters, current); if (current()) { this.labels = result.labels; this.verification = '' } } catch (error) { if (current()) this.verification = ['permission', 'project', 'zone', 'domain', 'integer', 'invalid', 'missing', 'combination'].includes(error.message) ? error.message : 'lookup' }
    },
    open (value) { if (!value) { this.closeSearch(); return }; this.visible = true; this.form = { ...asnQuery(this.$route.query, 20, this.$store.getters) }; this.blocked = {}; this.error = ''; this.generation++; this.$nextTick(() => { if (this.$refs.exactInput) this.$refs.exactInput.focus() }) },
    closeSearch () { this.visible = false; this.$nextTick(() => { if (!this.disposed && this.$refs.advancedButton?.$el) this.$refs.advancedButton.$el.focus() }) },
    changed (field) {
      const keys = { zoneid: ['asnrangeid', 'vpcid', 'networkid'], domainid: ['account', 'asnrangeid', 'vpcid', 'networkid'], account: ['asnrangeid', 'vpcid', 'networkid'], vpcid: ['networkid'] }[field] || []
      for (const key of keys) { delete this.form[key]; delete this.blocked[key] }
    },
    apply () {
      if (Object.values(this.blocked).some(Boolean)) return
      const values = asnQuery({ ...this.form, keyword: this.keyword, q: undefined }, 20, this.$store.getters)
      this.error = asnError(values, this.$store.getters)
      if (this.error) { if (this.error === 'integer' && this.$refs.exactInput) this.$refs.exactInput.focus(); return }
      this.$emit('search', { asnSearch: values }); this.closeSearch()
    },
    reset () { this.keyword = ''; this.form = {}; this.error = ''; this.closeSearch(); this.$emit('search', { asnSearch: {} }) },
    remove (key) { this.form = { ...this.$route.query }; delete this.form[key]; this.changed(key); this.$emit('search', { asnSearch: this.form }) }
  }
}
</script>
<style scoped>
.asn-search-control { display: inline-flex; flex-direction: column; min-width: 0; max-width: 100%; }
.asn-search-control .input-search { width: 240px; max-width: 100%; }
.asn-search-chips { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
.asn-search-chips :deep(.ant-tag) { max-width: 100%; white-space: normal; overflow-wrap: anywhere; }
.asn-search-verification { color: var(--ui-text-secondary); overflow-wrap: anywhere; }
.asn-search-form { max-height: 65vh; overflow-y: auto; width: min(340px, calc(100vw - 64px)); scroll-padding-bottom: 48px; }
.asn-search-form :deep(.ant-form-item-extra) { color: var(--ui-text-secondary); }
.asn-search-form .filter-group-button { position: sticky; bottom: 0; z-index: 1; display: flex; justify-content: space-between; gap: 8px; background: var(--ui-bg-elevated); border-top: 1px solid var(--ui-border); padding: 8px 0; }
.asn-search-form .filter-group-button :deep(.ant-btn) { position: static; }
</style>
