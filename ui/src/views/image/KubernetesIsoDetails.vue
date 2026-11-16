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
  <a-list class="resource-details-list vm-details-list kubernetes-iso-details" size="small" :data-source="fields">
    <template #renderItem="{ item }">
      <a-list-item><div class="kubernetes-iso-detail-field">
        <strong>{{ $t(item.label) }}</strong><br />
        <kubernetes-iso-status v-if="item.key === 'state'" :resource="resource" mode="version" />
        <kubernetes-iso-status v-else-if="item.key === 'availability'" :resource="resource" :observation="observation" inspectable @show-zones="$emit('show-zones')" />
        <kubernetes-iso-scope v-else-if="item.key === 'scope'" :resource="resource" />
        <iso-detail-value v-else-if="item.copy" :field="item.key === 'isourl' ? 'url' : 'id'" :value="value(item.key)" :label="$t(item.label)" />
        <iso-detail-value v-else-if="item.boolean" :field="item.key" :value="resource[item.key]" :label="$t(item.label)" />
        <router-link v-else-if="item.key === 'isoname' && isoLink" :to="isoLink">{{ value(item.key) || resource.isoid || '—' }}</router-link>
        <a-tooltip v-else-if="item.key === 'isostate'" :title="resource.isostate"><span>{{ reportedLabel ? $t(reportedLabel) : value(item.key) ?? '—' }}</span></a-tooltip>
        <span v-else-if="item.key === 'created'">{{ resource.created ? $toLocaleDate(resource.created) : '—' }}</span>
        <span v-else>{{ value(item.key) ?? '—' }}</span>
      </div></a-list-item>
    </template>
  </a-list>
</template>
<script>
import IsoDetailValue from '@/components/widgets/IsoDetailValue'
import KubernetesIsoScope from '@/components/widgets/KubernetesIsoScope'
import KubernetesIsoStatus from '@/components/widgets/KubernetesIsoStatus'
import { kubernetesIsoLink, kubernetesIsoScope, kubernetesIsoReportedState } from '@/utils/kubernetesIsoDetails'
export default {
  name: 'KubernetesIsoDetails',
  components: { IsoDetailValue, KubernetesIsoScope, KubernetesIsoStatus },
  props: { resource: { type: Object, required: true }, observation: { type: Object, default: null } },
  emits: ['show-zones'],
  computed: {
    isoLink () { return kubernetesIsoLink(this.resource, this.$store.getters, this.observation) },
    reportedLabel () { return kubernetesIsoReportedState(this.resource.isostate) },
    fields () {
      const fields = [
        ['name', 'label.name'], ['id', 'label.id', 'copy'], ['semanticversion', 'label.semanticversion'],
        ['state', 'label.kubernetes.iso.version.state'], ['scope', 'label.kubernetes.iso.registration.scope'], ['zoneid', 'label.kubernetes.iso.zone.id', 'copy'],
        ['isoname', 'label.isoname'], ['isoid', 'label.kubernetes.iso.child.id', 'copy'],
        ['availability', 'label.kubernetes.iso.availability'], ['isostate', 'label.kubernetes.iso.reported.state'],
        ['arch', 'label.arch'], ['mincpunumber', 'label.mincpunumber'], ['minmemory', 'label.minmemory'],
        ['supportsha', 'label.supportsha', 'boolean'], ['supportsautoscaling', 'label.supportsautoscaling', 'boolean'],
        ['directdownload', 'label.directdownload', 'boolean'], ['created', 'label.created']
      ]
      if (this.$store.getters.userInfo?.roletype === 'Admin') fields.push(['isourl', 'label.isourl', 'copy'])
      return fields.map(([key, label, type]) => ({ key, label, copy: type === 'copy', boolean: type === 'boolean' }))
    }
  },
  methods: {
    value (key) {
      if (key === 'zoneid') { const scope = kubernetesIsoScope(this.resource); return scope.kind === 'zone' ? scope.id : null }
      if (key === 'isourl' && this.$store.getters.userInfo?.roletype !== 'Admin') return null
      return this.resource[key] === '' ? null : this.resource[key]
    }
  }
}
</script>
<style scoped>
.kubernetes-iso-detail-field { width:100%; min-width:0; overflow-wrap:anywhere; }
.kubernetes-iso-details { color:var(--ui-text-secondary); background:var(--ui-bg-surface); }
.kubernetes-iso-details :deep(.ant-list-item) { padding:12px 8px; color:var(--ui-text-secondary); background:transparent; border-color:var(--ui-border); }
.kubernetes-iso-details :deep(.ant-list-item strong) { color:var(--ui-text-primary); }
</style>
