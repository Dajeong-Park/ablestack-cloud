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
  <div v-if="compact" class="bucket-quota-context bucket-quota-context-compact">
    <dl class="quota-inline-values">
      <dt>{{ $t('label.bucket.quota.available') }}</dt><dd>{{ available }}</dd>
      <dt>{{ $t('label.bucket.quota.reserved') }}</dt><dd>{{ reserved }}</dd>
    </dl>
    <p v-if="failed" role="status">{{ $t('message.bucket.quota.capacity.unknown') }}</p>
    <details>
      <summary>{{ $t('label.bucket.quota.context') }}</summary>
      <p>{{ $t('message.bucket.quota.validation') }}</p>
      <p>{{ $t('message.bucket.quota.live.check') }}</p>
      <p>{{ $t('label.bucket.quota.checked') }}: {{ checked ? $toLocaleDate(checked) : '—' }}</p>
    </details>
  </div>
  <a-alert v-else class="bucket-quota-context bucket-info-ribbon" type="info" show-icon>
    <template #message>{{ $t('label.bucket.quota.context') }}</template>
    <template #description>
      <p>{{ $t('message.bucket.quota.validation') }}</p>
      <p>{{ $t('message.bucket.quota.live.check') }}</p>
      <dl class="bucket-info-fields">
        <dt>{{ $t('label.bucket.quota.available') }}</dt><dd>{{ available }}</dd>
        <dt>{{ $t('label.bucket.quota.reserved') }}</dt><dd>{{ reserved }}</dd>
        <dt>{{ $t('label.bucket.quota.checked') }}</dt><dd>{{ checked ? $toLocaleDate(checked) : '—' }}</dd>
      </dl>
      <p v-if="failed" role="status">{{ $t('message.bucket.quota.capacity.unknown') }}</p>
    </template>
  </a-alert>
</template>
<script>
import { getAPI } from '@/api'
import { exactBytes, formatBytes } from '@/utils/objectStoreCapacity'
export default {
  name: 'BucketQuotaContext',
  props: { storeId: { type: String, default: '' }, compact: { type: Boolean, default: false } },
  data: () => ({ snapshot: null, checked: '', failed: false, generation: 0 }),
  computed: {
    reserved () { return this.snapshot ? formatBytes(exactBytes(this.snapshot, 'storagereserved')) : '—' },
    available () {
      if (!this.snapshot) return '—'
      const total = exactBytes(this.snapshot, 'storagetotal'); const allocated = exactBytes(this.snapshot, 'storageallocated'); const reserved = exactBytes(this.snapshot, 'storagereserved')
      if (total === 0n) return this.$t('label.bucket.quota.untracked')
      return total === null || allocated === null || reserved === null ? this.$t('state.bucket.protection.unknown') : formatBytes(total > allocated + reserved ? total - allocated - reserved : 0n)
    }
  },
  watch: { storeId: { immediate: true, handler: 'fetchCapacity' } },
  beforeUnmount () { this.generation++ },
  methods: {
    async fetchCapacity () {
      const generation = ++this.generation
      this.snapshot = null; this.failed = false; this.checked = ''
      if (!this.storeId) return
      try {
        const result = await getAPI('listObjectStoragePools', { id: this.storeId })
        if (generation !== this.generation) return
        this.snapshot = (result.listobjectstoragepoolsresponse.objectstore || []).find(store => store.id === this.storeId) || null
        this.failed = !this.snapshot; this.checked = this.snapshot ? new Date().toISOString() : ''
      } catch (_) { if (generation === this.generation) this.failed = true }
    }
  }
}
</script>
<style scoped>
.bucket-quota-context { margin-bottom: 16px; overflow-wrap: anywhere; }
.bucket-quota-context-compact { margin: 8px 0 0; font-size: 12px; color: var(--ui-text-secondary); }
.quota-inline-values { display: flex; flex-wrap: wrap; gap: 4px 8px; margin: 0; }
.quota-inline-values dd { margin: 0 12px 0 0; color: var(--ui-text-primary); }
.bucket-quota-context-compact details { margin-top: 4px; }
.bucket-quota-context-compact summary { cursor: pointer; width: fit-content; color: var(--ui-link); }
.bucket-quota-context-compact p { margin: 4px 0 0; overflow-wrap: anywhere; }
</style>
