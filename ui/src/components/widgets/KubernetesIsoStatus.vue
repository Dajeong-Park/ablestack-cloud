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
  <span class="kubernetes-iso-status" :class="{ 'kubernetes-iso-status--compact': compact }" :title="tooltip">
    <a-badge :status="value.badge" :text="$t(value.labelKey)" />
    <template v-if="!compact && mode === 'iso'">
      <div v-if="value.complete" class="kubernetes-iso-status__scope">{{ $t('label.kubernetes.iso.observed.zones', { ready: value.readyCount, total: value.zoneCount }) }}</div>
      <div v-for="reason in value.reasons" :key="reason" class="kubernetes-iso-status__reason">{{ isoStoreReason(reason, $t) }}</div>
      <a-button v-if="inspectable" size="small" class="kubernetes-iso-status__inspect" @click="$emit('show-zones')">{{ $t('label.template.availability.inspect') }}</a-button>
    </template>
  </span>
</template>
<script>
import { kubernetesIsoStatus } from '@/utils/kubernetesIsoDetails'
import { isoStoreReason } from '@/utils/isoZoneOperations'
export default {
  name: 'KubernetesIsoStatus',
  props: { resource: { type: Object, required: true }, observation: { type: Object, default: null }, mode: { type: String, default: 'iso' }, compact: Boolean, inspectable: Boolean },
  emits: ['show-zones'],
  methods: { isoStoreReason },
  computed: {
    value () { return kubernetesIsoStatus(this.resource, this.observation, this.mode) },
    tooltip () { return [this.$t(this.value.labelKey), ...(this.value.reasons || []).map(reason => isoStoreReason(reason, this.$t)), ...(this.mode === 'iso' && this.resource.isostate ? [this.$t('label.kubernetes.iso.reported.state') + ': ' + this.resource.isostate] : [])].join('\n') }
  }
}
</script>
<style scoped>
.kubernetes-iso-status { display:block; min-width:0; }
.kubernetes-iso-status--compact { overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
.kubernetes-iso-status--compact :deep(.ant-badge-status-text) { white-space:nowrap; }
.kubernetes-iso-status__scope, .kubernetes-iso-status__reason { margin-top:4px; color:var(--ui-text-secondary); overflow-wrap:anywhere; font-size:12px; }
.kubernetes-iso-status__inspect { margin-top:8px; }
</style>
