<!--
Licensed to the Apache Software Foundation (ASF) under one
or more contributor license agreements. See the NOTICE file
distributed with this work for additional information
regarding copyright ownership. The ASF licenses this file
to you under the Apache License, Version 2.0 (the
"License"); you may not use this file except in compliance
with the License. You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing,
software distributed under the License is distributed on an
"AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, either express or implied. See the License for the
specific language governing permissions and limitations
under the License.
-->
<template>
  <div class="vnf-search-select">
    <a-select
:value="value ? { value, label: selected?.displaytext || selected?.path || selected?.name || value } : undefined"
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
dropdown-class-name="vnf-search-options"
@search="search"
@change="select"
@popupScroll="moreOnScroll">
      <template #option="{ label, description }"><div class="vnf-search-option">{{ label }}<div class="vnf-search-description">{{ description }}</div></div></template>
    </a-select>
    <p v-if="!allowed" class="vnf-search-description">{{ $t(kind === 'account' && !scope.domainid ? 'message.affinity.search.account.domain' : 'message.vnf.search.permission') }}</p>
    <p v-if="value && selected" class="vnf-search-description">{{ describe(selected) }}</p>
    <a-alert v-if="value && !selected && !loading && !error" type="warning" show-icon :message="$t('message.vnf.search.candidate.unavailable')" />
    <a-alert v-if="error" type="error" show-icon :message="$t('error.fetching.data')"><template #description><a-button size="small" @click="load(true)">{{ $t('label.retry') }}</a-button></template></a-alert>
    <a-button v-if="received < total && !error" type="link" size="small" :disabled="loading" @click="load(false)">{{ $t('message.snapshot.search.more', [received, total]) }}</a-button>
  </div>
</template>
<script>
import { getAPI } from '@/api'
import { vnfPickerConfig, vnfPickerParams, readVnfCandidates, vnfAuth, vnfProject } from '@/utils/vnfSearch'
export default {
  name: 'VnfSearchSelect',
  props: { value: { type: String, default: undefined }, kind: { type: String, required: true }, scope: { type: Object, default: () => ({}) } },
  emits: ['update:value', 'blocked'],
  data () { return { rows: [], selected: null, total: 0, received: 0, page: 0, keyword: '', loading: false, error: false, version: 0, timer: null, disposed: false } },
  computed: {
    config () { return vnfPickerConfig(this.kind) },
    params () { return vnfPickerParams(this.kind, this.scope, this.$getApiParams(this.config.api) || {}) },
    allowed () { return !!this.$store.state?.user?.token && (this.scope.projectid || vnfProject(this.$store.getters)) === vnfProject(this.$store.getters) && this.config.api in (this.$store.getters.apis || {}) && (this.kind !== 'account' || !!this.scope.domainid) },
    context () { return JSON.stringify([this.params, vnfAuth(this.$store.getters, this.$store.state?.user?.token), this.$route?.path, this.allowed]) },
    blocked () { return !!this.value && (this.loading || !this.selected || this.error || !this.allowed) },
    options () { return (this.loading || this.error ? [] : this.rows).map(r => ({ value: this.key(r), label: r.displaytext || r.path || r.name, description: this.describe(r) })) }
  },
  watch: {
    context: { flush: 'sync', handler () { this.version++; clearTimeout(this.timer); this.rows = []; this.selected = null; this.$emit('blocked', !!this.value); this.load(true, '') } },
    value (value) { if (!value) this.selected = null; else if (this.key(this.selected) !== value) this.load(true) },
    blocked: { immediate: true, handler (value) { this.$emit('blocked', value) } }
  },
  created () { this.load(true) },
  beforeUnmount () { this.disposed = true; this.version++; clearTimeout(this.timer) },
  methods: {
    key (row) { return this.kind === 'account' ? row?.name : row?.id },
    describe (row) { return [row.state, row.zonename, row.project, row.domain, row.id].filter(Boolean).join(' · ') },
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
      const params = { ...this.params, page: reset ? 1 : this.page + 1, pagesize: 20, ...(this.keyword ? { keyword: this.keyword } : {}) }
      try {
        const response = await getAPI(this.config.api, params, { preserveOnFailure: true, timeout: 20000 })
        if (!current()) return
        const result = readVnfCandidates(response, this.kind, params)
        if (!reset && (result.count !== this.total || result.rows.some(r => this.rows.some(old => old.id === r.id)) || (!result.received && this.received < result.count))) throw Error('changed')
        let selected = result.rows.find(r => this.key(r) === value) || this.selected
        if (value && this.key(selected) !== value) {
          const lookup = { ...this.params, ...(this.kind === 'account' ? { name: value } : { id: value }), page: 1, pagesize: 20 }
          const response = await getAPI(this.config.api, lookup, { preserveOnFailure: true, timeout: 20000 })
          if (!current() || value !== this.value) return
          selected = readVnfCandidates(response, this.kind, lookup).rows.find(r => this.key(r) === value) || null
        }
        if (!current()) return
        this.rows = reset ? result.rows : [...this.rows, ...result.rows]; this.total = result.count; this.page = params.page; this.received = (reset ? 0 : this.received) + result.received; this.selected = selected
      } catch (_) {
        if (current()) { this.rows = []; this.page = 0; this.total = 0; this.received = 0; this.error = true; this.selected = null }
      } finally { if (current()) this.loading = false }
    }
  }
}
</script>
<style scoped>
.vnf-search-select, .vnf-search-select :deep(.ant-select) { min-width: 0; width: 100%; }
.vnf-search-description { margin: 4px 0; overflow-wrap: anywhere; font-size: 12px; color: var(--ui-text-secondary); }
</style>
<style>
.vnf-search-options .vnf-search-option { white-space: normal; overflow-wrap: anywhere; }
.vnf-search-options .vnf-search-description { font-size: 12px; color: var(--ui-text-secondary); }
</style>
