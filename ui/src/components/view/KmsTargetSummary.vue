<!--
Licensed to the Apache Software Foundation (ASF) under one or more
contributor license agreements. See the NOTICE file distributed with this work
for additional information regarding copyright ownership. The ASF licenses this
file to you under the Apache License, Version 2.0 (the "License"); you may not use
this file except in compliance with the License. You may obtain a copy at
http://www.apache.org/licenses/LICENSE-2.0
Unless required by applicable law or agreed to in writing, software distributed
under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
CONDITIONS OF ANY KIND, either express or implied. See the License for the
specific language governing permissions and limitations under the License.
-->
<template>
  <a-descriptions class="kms-risk-target" :title="$t('label.kms.risk.target')" :column="{ xs: 1, sm: 2 }" size="small" bordered>
    <a-descriptions-item :label="$t('label.name')">{{ target.name || '—' }}</a-descriptions-item>
    <a-descriptions-item :label="$t('label.id')">{{ target.id || '—' }}</a-descriptions-item>
    <a-descriptions-item :label="$t('label.hsmownerscope')">{{ owner || '—' }}</a-descriptions-item>
    <a-descriptions-item :label="$t('label.zone')">{{ zone }}</a-descriptions-item>
    <template v-if="kind === 'hsmprofile'">
      <a-descriptions-item :label="$t('label.protocol')">{{ target.protocol || '—' }}</a-descriptions-item>
    </template>
    <template v-else>
      <a-descriptions-item :label="$t('label.hsm.profile')">{{ kmsReferenceName(target.hsmprofile, target.hsmprofileid) || '—' }}</a-descriptions-item>
      <a-descriptions-item :label="$t('label.version')">{{ target.version ?? '—' }}</a-descriptions-item>
      <a-descriptions-item :label="$t('label.keybits')">{{ target.keybits ?? '—' }}</a-descriptions-item>
    </template>
    <a-descriptions-item v-if="typeof target.enabled === 'boolean'" :label="$t('label.state')">
      <Status :text="String(target.enabled)" :display-label="$t(target.enabled ? 'label.enabled' : 'label.disabled')" display-text />
    </a-descriptions-item>
    <template v-if="showUsage">
      <a-descriptions-item v-for="field in usageFields" :key="field" :label="$t('label.kms.usage.' + field)">
        {{ usage?.[field] ?? $t('label.kms.risk.unknown') }}
      </a-descriptions-item>
    </template>
  </a-descriptions>
</template>
<script>
import Status from '@/components/widgets/Status'
import { hsmOwnerScope } from '@/utils/kmsSearch'
import { kmsRelations, kmsUsage } from '@/utils/kmsRelated'
import { kmsReferenceName } from '@/utils/kmsRisk'

export default {
  name: 'KmsTargetSummary',
  components: { Status },
  props: {
    target: { type: Object, required: true },
    kind: { type: String, default: 'kmskey' },
    showUsage: Boolean,
    references: { type: Object, default: null }
  },
  computed: {
    owner () {
      const target = this.target
      const scope = hsmOwnerScope(target)
      const domain = target.domainpath || target.domain || target.domainid
      const account = target.project || target.projectid || target.account || target.accountid
      return [scope && this.$t('label.hsm.create.scope.' + scope), account, domain].filter(Boolean).join(' / ')
    },
    zone () {
      return this.target.zonename || this.target.zoneid || (this.kind === 'hsmprofile' ? this.$t('label.hsm.create.zone.global') : '—')
    },
    usageFields () { return kmsRelations[this.kind].usage },
    usage () { return kmsUsage(this.kind, this.references) }
  },
  methods: { kmsReferenceName }
}
</script>
<style scoped>
.kms-risk-target { overflow-wrap: anywhere; }
</style>
