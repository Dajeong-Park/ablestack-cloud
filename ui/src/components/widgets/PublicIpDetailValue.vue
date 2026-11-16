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
  <div class="public-ip-detail-value" :data-public-ip-field="field" :lang="$i18n?.locale?.replace('_', '-')">
    <public-ip-status v-if="field === 'state'" :value="resource.state" />
    <template v-else>
    <div class="public-ip-detail-value__line">
      <router-link v-if="value.path" :to="value.path" class="public-ip-detail-value__text">{{ value.text }}</router-link>
      <span v-else class="public-ip-detail-value__text">{{ value.date ? $toLocaleDate(value.date) : value.missing ? $t('label.public.ip.value.notprovided') : value.label ? $t(value.label) : value.text || '—' }}</span>
      <tooltip-button
        v-if="value.id && (!compact || value.text === value.id)"
        :tooltip="copyLabel"
        :aria-label="copyLabel"
        :copy-resource="value.id"
        icon="copy-outlined"
        type="dashed"
        size="small"
        @copy-success="$message.success($t('label.copied.clipboard'))"
        @copy-error="$message.error($t('message.public.ip.copy.failed'))" />
    </div>
    <div v-if="value.id && value.text !== value.id && !compact" class="public-ip-detail-value__raw">{{ value.id }}</div>
    <div v-if="value.raw" class="public-ip-detail-value__raw">{{ $t('label.public.ip.value.raw') }}: {{ value.raw }}</div>
    </template>
  </div>
</template>
<script>
import TooltipButton from '@/components/widgets/TooltipButton'
import PublicIpStatus from '@/components/widgets/PublicIpStatus'
import { publicIpField, publicIpFieldLabel } from '@/utils/publicIpDetails'
export default {
  name: 'PublicIpDetailValue',
  components: { TooltipButton, PublicIpStatus },
  props: { resource: { type: Object, required: true }, field: { type: String, required: true }, compact: { type: Boolean, default: false } },
  computed: {
    value () { return publicIpField(this.resource, this.field, this.$store.getters.apis || {}) },
    copyLabel () { return this.$t('label.copy') + ' ' + this.$t(publicIpFieldLabel(this.field)) }
  }
}
</script>
<style scoped>
.public-ip-detail-value { min-width: 0; width: 100%; max-width: 100%; }
.public-ip-detail-value__line { display: flex; align-items: flex-start; gap: 8px; min-width: 0; }
.public-ip-detail-value__text { flex: 1; min-width: 0; overflow-wrap: anywhere; white-space: pre-wrap; }
.public-ip-detail-value__raw { color: var(--ui-text-secondary); overflow-wrap: anywhere; margin-top: 4px; }
</style>
