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
  <section class="bucket-owner-context" :aria-label="$t('label.bucket.owner.confirm')">
    <h4>{{ $t('label.bucket.owner.confirm') }}</h4>
    <p v-if="!ready" role="status">{{ $t('message.bucket.owner.required') }}</p>
    <dl v-else>
      <dt>{{ $t('label.bucket.owner') }}</dt><dd>{{ owner.selectedAccountType === 'Project' ? $t('label.project') + ': ' + (owner.projectLabel || owner.selectedProject) : $t('label.account') + ': ' + owner.selectedAccount + ' · ' + (owner.domainLabel || owner.selectedDomain) }}</dd>
      <dt>{{ $t('label.object.storage') }}</dt><dd>{{ storeName || '—' }}</dd>
      <dt>{{ $t('label.quotagib') }}</dt><dd>{{ quota || '—' }} GiB</dd>
    </dl>
    <template v-if="ready">
      <p>{{ $t('message.bucket.owner.limits.note') }}</p>
      <div v-if="limits" class="bucket-owner-limits">
        <span>{{ $t('label.bucket.owner.bucket.limit') }}: {{ format(limits.bucket) }}</span>
        <span>{{ $t('label.bucket.owner.storage.limit') }}: {{ format(limits.object_storage) }}</span>
      </div>
      <p v-else role="status">{{ $t(busy ? 'label.loading' : 'message.bucket.owner.limits.failed') }}</p>
      <a-button v-if="!busy && !limits" @click="load"><template #icon><reload-outlined /></template>{{ $t('label.retry') }}</a-button>
    </template>
  </section>
</template>
<script>
import { getAPI } from '@/api'
export default {
  name: 'BucketOwnerContext',
  props: { owner: { type: Object, required: true }, ready: Boolean, scope: { type: String, required: true }, storeName: String, quota: [String, Number] },
  data: () => ({ limits: null, busy: false, generation: 0 }),
  computed: { context () { return JSON.stringify([this.scope, this.ready, this.owner.selectedAccountType, this.owner.selectedDomain, this.owner.selectedAccount, this.owner.selectedProject]) } },
  watch: { context: { immediate: true, handler: 'load' } },
  beforeUnmount () { ++this.generation },
  methods: {
    format (value) { return value === -1 ? this.$t('label.unlimited') : value },
    async load () {
      const generation = ++this.generation; const context = this.context; this.limits = null; this.busy = false
      if (!this.ready) return
      const project = this.owner.selectedAccountType === 'Project'
      const params = project ? { projectid: this.owner.selectedProject } : { account: this.owner.selectedAccount, domainid: this.owner.selectedDomain }
      this.busy = true
      try {
        const types = ['bucket', 'object_storage']
        const result = await Promise.all(types.map(resourcetypename => getAPI('listResourceLimits', { ...params, resourcetypename, ignoreproject: true }, { preserveOnFailure: true, timeout: 20000 })))
        if (generation !== this.generation || context !== this.context) return
        const values = result.map((json, i) => {
          const body = json.listresourcelimitsresponse
          if (!body || body.errorcode || !Array.isArray(body.resourcelimit)) throw new Error('Owner limits unavailable')
          const row = body.resourcelimit.find(row => Number(row.resourcetype) === (i === 0 ? 14 : 15) && (project ? row.projectid === params.projectid : row.account === params.account && row.domainid === params.domainid))
          const max = Number(row?.max)
          if (!row || row.max === null || row.max === undefined || !/^-?\d+$/.test(String(row.max)) || !Number.isSafeInteger(max) || max < -1) throw new Error('Owner limit scope mismatch')
          return max
        })
        this.limits = { bucket: values[0], object_storage: values[1] }
      } catch (_) { /* Unknown is explicit; the backend still enforces the final resource limits. */ } finally { if (generation === this.generation) this.busy = false }
    }
  }
}
</script>
<style scoped>
.bucket-owner-context { margin: 16px 0; padding: 16px; border: 1px solid var(--ui-border); border-radius: 4px; color: var(--ui-text-primary); background: var(--ui-bg-elevated); overflow-wrap: anywhere; }
.bucket-owner-context h4 { color: var(--ui-text-primary); }
.bucket-owner-context p { color: var(--ui-text-secondary); }
.bucket-owner-context dl { display: grid; grid-template-columns: minmax(100px, auto) minmax(0, 1fr); gap: 8px 16px; }
.bucket-owner-context dt, .bucket-owner-context dd { margin: 0; }
.bucket-owner-limits { display: flex; flex-wrap: wrap; gap: 8px 16px; }
@media (max-width: 575px) { .bucket-owner-context dl { grid-template-columns: minmax(0, 1fr); } }
</style>
