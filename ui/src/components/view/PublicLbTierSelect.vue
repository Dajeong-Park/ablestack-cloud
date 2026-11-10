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
  <section class="public-lb-tier-select mold-dialog-section">
    <div class="network-form-group-label">{{ $t('label.select.tier') }}</div>
    <div class="public-lb-tier-controls">
      <a-select
        v-if="!hideSelect"
        :value="value"
        :disabled="busy || fixed || state.loading || !state.ready"
        :loading="state.loading"
        :placeholder="$t('label.select.tier')"
        show-search
        option-filter-prop="label"
        @change="$emit('change', $event)">
        <a-select-option v-for="tier in state.data" :key="tier.id" :value="tier.id" :label="tier.displaytext || tier.name || tier.id">
          {{ tier.displaytext || tier.name || tier.id }}
        </a-select-option>
      </a-select>
      <a-button :disabled="busy || state.loading" :loading="state.loading" @click="$emit('refresh')">
        <template #icon><reload-outlined /></template>{{ $t('label.refresh') }}
      </a-button>
    </div>
    <a-alert class="mold-dialog-section" :type="state.failed || unavailable ? 'warning' : 'info'" show-icon role="status" :message="$t(message)" />
  </section>
</template>
<script>
export default {
  name: 'PublicLbTierSelect',
  props: {
    state: { type: Object, required: true },
    value: { type: String, default: null },
    busy: Boolean,
    fixed: Boolean,
    hideSelect: Boolean
  },
  emits: ['change', 'refresh'],
  computed: {
    unavailable () { return this.state.ready && this.value && !this.state.data.some(tier => tier.id === this.value) },
    message () {
      if (this.state.loading) return 'message.network.lb.public.tiers.loading'
      if (this.state.failed) return 'message.network.lb.public.tiers.failed'
      if (this.unavailable) return 'message.network.lb.public.tier.unavailable'
      if (this.state.ready && !this.state.data.length) return 'message.network.lb.public.tiers.empty'
      return 'message.network.lb.public.tiers.hint'
    }
  }
}
</script>
<style scoped>
.public-lb-tier-controls { display: flex; align-items: flex-start; gap: 8px; }
.public-lb-tier-controls .ant-select { flex: 1; min-width: 0; }
.public-lb-tier-controls .ant-btn { flex: none; }
</style>
