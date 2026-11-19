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
  <keyboard-tooltip v-if="field === 'zonename'" :title="tooltip" :trigger="['hover','focus']">
    <kubernetes-iso-scope class="kubernetes-iso-list-value" tabindex="0" :resource="resource" />
  </keyboard-tooltip>
  <keyboard-tooltip v-else :title="tooltip" :trigger="['hover','focus']">
    <span tabindex="0" class="kubernetes-iso-list-value">
      <a-badge v-if="presentation" :status="presentation.badge" :text="$t(presentation.labelKey)" />
      <template v-else>{{ value }}</template>
    </span>
  </keyboard-tooltip>
</template>
<script>
import KubernetesIsoScope from '@/components/widgets/KubernetesIsoScope'
import KeyboardTooltip from '@/components/widgets/KeyboardTooltip'
import { kubernetesIsoStatus, kubernetesIsoScope } from '@/utils/kubernetesIsoDetails'
export default {
  name: 'KubernetesIsoListCell',
  components: { KubernetesIsoScope, KeyboardTooltip },
  props: { resource: { type: Object, required: true }, field: { type: String, required: true } },
  computed: {
    presentation () { return ['state', 'isostate'].includes(this.field) ? kubernetesIsoStatus(this.resource, null, this.field === 'state' ? 'version' : 'iso') : null },
    value () { return this.resource[this.field] ?? '—' },
    tooltip () {
      if (this.field === 'zonename') {
        const scope = kubernetesIsoScope(this.resource)
        return scope.kind === 'all' ? this.$t('label.kubernetes.iso.scope.all') : scope.kind === 'zone' ? [scope.name || scope.id, scope.id].filter((value, index, rows) => value && rows.indexOf(value) === index).join('\n') : this.$t('label.kubernetes.iso.scope.unknown')
      }
      if (this.presentation) return this.$t(this.presentation.labelKey) + (this.field === 'isostate' && this.resource.isostate ? '\n' + this.$t('label.kubernetes.iso.reported.state') + ': ' + this.resource.isostate : '')
      return String(this.value)
    }
  }
}
</script>
<style scoped>
.kubernetes-iso-list-value { display:block; min-width:0; max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.kubernetes-iso-list-value:focus-visible { outline:2px solid var(--ui-focus); outline-offset:-2px; }
.kubernetes-iso-list-value :deep(.ant-badge-status-text) { white-space:nowrap; }
</style>
