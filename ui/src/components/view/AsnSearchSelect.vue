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
  <div class="asn-search-select">
    <a-select
:id="'asn-search-' + kind"
:value="value ? { value, label: selected ? optionLabel(selected) : value } : undefined"
:options="options"
:loading="loading"
:disabled="!allowed"
label-in-value
show-search
allow-clear
:filter-option="false"
:aria-label="$t(config.label)"
:placeholder="$t('label.all')"
:not-found-content="loading ? $t('label.loading') : $t('label.no.data')"
dropdown-class-name="asn-search-options"
@search="search"
@change="select"
@popupScroll="moreOnScroll">
      <template #option="{ label, description }"><div class="asn-search-option">{{ label }}<div class="asn-search-description">{{ description }}</div></div></template>
    </a-select>
    <p v-if="!allowed" class="asn-search-description">{{ $t(kind === 'account' && !scope.domainid ? 'message.asn.search.domain' : ['networkid', 'vpcid', 'asnrangeid'].includes(kind) && !scope.zoneid ? 'message.asn.search.zone' : 'message.asn.search.permission') }}</p>
    <p v-if="value && !selected && !loading" class="asn-search-description" role="status">{{ value }} · {{ $t('message.asn.search.unverified') }}</p>
  <p v-if="value && selected" class="asn-search-description">{{ describe(selected) }}</p>
    <a-alert v-if="value && !selected && !loading && !error" type="warning" show-icon :message="$t('message.asn.search.missing')" />
    <a-alert v-if="error" type="error" show-icon :message="$t('error.fetching.data')"><template #description><a-button size="small" @click="load(true)">{{ $t('label.retry') }}</a-button></template></a-alert>
    <a-button v-if="!config.unpaged && received < total && !error" type="link" size="small" :disabled="loading" @click="load(false)">{{ $t('message.snapshot.search.more', [received, total]) }}</a-button>
  </div>
</template>
<script>
import { getAPI } from '@/api'
import { asnConfig, asnPickerParams, asnCandidates, asnAuth, asnLabel } from '@/utils/asnSearch'
export default {
  name: 'AsnSearchSelect',
  props: { value: { type: String, default: undefined }, kind: { type: String, required: true }, scope: { type: Object, default: () => ({}) } },
  emits: ['update:value', 'blocked'],
  data () { return { rows: [], selected: null, total: 0, received: 0, page: 0, keyword: '', loading: false, error: false, version: 0, timer: null, disposed: false } },
  computed: {
    config () { return asnConfig(this.kind) },
    params () { return asnPickerParams(this.kind, this.scope) },
    allowed () { return !!this.$store.state?.user?.token && this.config.api in (this.$store.getters.apis || {}) && (this.kind !== 'account' || !!this.scope.domainid) && (this.kind !== 'asnrangeid' || !!this.scope.zoneid) && (!['vpcid', 'networkid'].includes(this.kind) || !!this.scope.zoneid || !!this.value) },
    context () { return JSON.stringify([this.params, asnAuth(this.$store), this.$route?.path, this.allowed]) },
    blocked () { return !!this.value && (this.loading || !this.selected || this.error || !this.allowed) },
    options () { return (this.loading || this.error ? [] : this.rows).filter(r => !this.config.unpaged || (asnLabel(this.kind, r) + r.id).toLowerCase().includes(this.keyword.toLowerCase())).map(r => ({ value: this.key(r), label: asnLabel(this.kind, r), description: this.describe(r) })) }
  },
  watch: {
    context: { flush: 'sync', handler () { this.version++; clearTimeout(this.timer); this.rows = []; this.selected = null; this.$emit('blocked', !!this.value); this.load(true, '') } },
    value (value) { if (!value) this.selected = null; else if (this.key(this.selected) !== value) this.load(true) },
    blocked: { immediate: true, handler (value) { this.$emit('blocked', value) } }
  },
  created () { this.load(true) },
  beforeUnmount () { this.disposed = true; this.version++; clearTimeout(this.timer) },
  methods: {
    optionLabel (row) { return asnLabel(this.kind, row) },
    key (row) { return this.kind === 'account' ? row?.name : row?.id },
    describe (row) { return [row.zonename, row.domain, row.id].filter(Boolean).join(' · ') },
    search (keyword) { clearTimeout(this.timer); this.version++; this.keyword = String(keyword || '').trim(); this.rows = []; this.page = 0; this.total = 0; this.received = 0; this.loading = true; this.error = false; this.timer = setTimeout(() => this.load(true), 250) },
    select (option) {
      if (!option?.value) { this.selected = null; this.$emit('update:value', undefined); this.search(''); return }
      if (this.loading || this.error || !this.allowed) return
      const row = this.rows.find(r => this.key(r) === option.value)
      if (row) { this.selected = row; this.$emit('update:value', this.key(row)) }
    },
    moreOnScroll (e) { if (!this.loading && !this.error && this.received < this.total && e.target.scrollHeight - e.target.scrollTop - e.target.clientHeight < 24) this.load(false) },
    async load (reset, keyword) {
      clearTimeout(this.timer)
      const version = ++this.version; const context = this.context; const value = this.value
      const current = () => !this.disposed && version === this.version && context === this.context
      if (keyword !== undefined) this.keyword = keyword
      if (reset) { this.rows = []; this.total = 0; this.received = 0; this.page = 0; this.selected = null }
      this.error = false; this.loading = true
      if (!this.allowed) { this.selected = null; this.loading = false; return }
      const selectedOnly = ['networkid', 'vpcid'].includes(this.kind) && !this.scope.zoneid
      const params = { ...this.params, ...(this.config.unpaged ? {} : { page: reset ? 1 : this.page + 1, pagesize: 20, ...(selectedOnly ? { id: value } : this.keyword ? { keyword: this.keyword } : {}) }) }
      try {
        const response = await getAPI(this.config.api, params, { preserveOnFailure: true, timeout: 20000 })
        if (!current()) return
        const result = asnCandidates(response, this.kind, this.scope)
        if (!reset && (result.count !== this.total || result.rows.some(r => this.rows.some(old => old.id === r.id)) || (!result.rows.length && this.received < result.count))) throw Error('changed')
        let selected = result.rows.find(r => this.key(r) === value) || this.selected
        if (value && this.key(selected) !== value && !this.config.unpaged) {
          const lookup = { ...this.params, ...(this.kind === 'account' ? { name: value } : { id: value }), page: 1, pagesize: 20 }
          const response = await getAPI(this.config.api, lookup, { preserveOnFailure: true, timeout: 20000 })
          if (!current() || value !== this.value) return
          selected = asnCandidates(response, this.kind, this.scope).rows.find(r => this.key(r) === value) || null
        }
        if (!current()) return
        this.rows = reset ? result.rows : [...this.rows, ...result.rows]; this.total = result.count; this.page = params.page || 1; this.received = (reset ? 0 : this.received) + result.rows.length; this.selected = selected
      } catch (_) {
        if (current()) { this.rows = []; this.page = 0; this.total = 0; this.received = 0; this.error = true; this.selected = null }
      } finally { if (current()) this.loading = false }
    }
  }
}
</script>
<style scoped>
.asn-search-select, .asn-search-select :deep(.ant-select) { min-width: 0; width: 100%; }
.asn-search-description { margin: 4px 0; overflow-wrap: anywhere; font-size: 12px; color: var(--ui-text-secondary); }
</style>
<style>
.asn-search-options .asn-search-option { white-space: normal; overflow-wrap: anywhere; }
.asn-search-options .asn-search-description { font-size: 12px; color: var(--ui-text-secondary); }
</style>
