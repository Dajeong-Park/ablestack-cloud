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
  <div class="domain-filters">
    <a-popover v-model:visible="open" trigger="click" placement="bottomLeft">
      <template #content>
        <a-form :model="draft" layout="vertical" class="domain-filter-form" @finish="apply">
          <a-form-item :label="$t('label.name')">
            <a-input v-model:value="draft.name" :aria-label="$t('label.name')" allow-clear />
          </a-form-item>
          <a-form-item :label="$t('label.id')">
            <a-input v-model:value="draft.id" :aria-label="$t('label.id')" placeholder="UUID" allow-clear />
          </a-form-item>
          <a-form-item :label="$t('label.level')">
            <a-input-number v-model:value="draft.level" :aria-label="$t('label.level')" :min="0" :precision="0" />
          </a-form-item>
          <a-form-item :label="$t('label.parentdomainname')">
            <a-input v-model:value="draft.parentdomainid" :aria-label="$t('label.parentdomainname')" placeholder="UUID" allow-clear />
            <a-button v-if="selection" type="link" size="small" @click="draft.parentdomainid = selection">
              {{ $t('label.domain.use.selection') }}
            </a-button>
          </a-form-item>
          <a-checkbox v-if="draft.parentdomainid" v-model:checked="draft.recursive">{{ $t('label.domain.include.children') }}</a-checkbox>
          <a-alert v-if="invalid" type="warning" :message="$t('message.domain.filter.invalid')" />
          <div class="domain-filter-buttons">
            <a-button @click="clear">{{ $t('label.reset') }}</a-button>
            <a-button type="primary" html-type="submit">{{ $t('label.search') }}</a-button>
          </div>
        </a-form>
      </template>
      <a-button :aria-label="$t('label.advanced.search')" :title="$t('label.advanced.search')">
        <template #icon><filter-outlined /></template>
      </a-button>
    </a-popover>
    <div v-if="Object.keys(modelValue).length" class="domain-filter-chips">
      <a-tag v-for="(value, field) in modelValue" :key="field" closable @close.prevent="remove(field)">
        {{ $t(labels[field]) }}<template v-if="field !== 'recursive'"> · {{ value }}</template>
      </a-tag>
    </div>
  </div>
</template>

<script>
import { domainFilterValues, isDomainUuid } from '@/utils/domainTree'

export default {
  name: 'DomainTreeFilters',
  props: {
    modelValue: { type: Object, default: () => ({}) },
    selection: { type: String, default: '' }
  },
  emits: ['change'],
  data () {
    return {
      open: false,
      draft: {},
      invalid: false,
      labels: { name: 'label.name', id: 'label.id', level: 'label.level', parentdomainid: 'label.parentdomainname', recursive: 'label.domain.include.children' }
    }
  },
  watch: {
    open (value) {
      if (!value) return
      this.draft = { ...this.modelValue }
      this.invalid = false
    }
  },
  methods: {
    apply () {
      const filters = domainFilterValues(this.draft)
      this.invalid = ['id', 'parentdomainid'].some(key => filters[key] && !isDomainUuid(filters[key]))
      if (this.invalid) return
      this.open = false
      this.$emit('change', filters)
    },
    clear () {
      this.draft = {}
      this.invalid = false
      this.open = false
      this.$emit('change', {})
    },
    remove (field) {
      const next = { ...this.modelValue }
      delete next[field]
      this.$emit('change', domainFilterValues(next))
    }
  }
}
</script>

<style scoped>
.domain-filters { display: contents; }
.domain-filter-chips { display: flex; flex-wrap: wrap; gap: 6px; grid-column: 1 / -1; }
.domain-filter-chips :deep(.ant-tag) { margin: 0; max-width: 100%; overflow-wrap: anywhere; white-space: normal; }
.domain-filter-form { width: min(290px, calc(100vw - 66px)); }
.domain-filter-buttons { display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px; }
</style>
