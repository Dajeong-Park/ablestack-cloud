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
  <section class="bucket-object-metadata" :aria-label="$t('label.bucket.object.metadata')">
    <div class="bucket-object-metadata-toolbar">
      <strong>{{ $t('label.bucket.object.metadata') }}</strong>
      <a-button v-if="canRead" :loading="loading" :disabled="loading" @click="load(true)"><reload-outlined /> {{ $t('label.bucket.object.metadata.refresh') }}</a-button>
    </div>
    <p class="bucket-object-metadata-note">{{ $t('message.bucket.object.metadata.head') }}</p>
    <div v-if="loading" role="status" aria-live="polite">{{ $t('message.bucket.object.metadata.loading') }}</div>
    <template v-else-if="status === 'Available' && result">
      <dl class="bucket-object-metadata-fields">
        <dt>{{ $t('label.name') }}</dt><dd>{{ result.key }}</dd>
        <dt v-if="result.versionid != null">{{ $t('label.bucket.object.metadata.version') }}</dt><dd v-if="result.versionid != null">{{ result.versionid }}</dd>
        <dt>{{ $t('label.size') }}</dt><dd>{{ result.sizebytes }} {{ $t('label.bucket.object.metadata.bytes') }}</dd>
        <dt>{{ $t('label.last.updated') }}</dt><dd>{{ result.lastmodified ? $toLocaleDate(result.lastmodified) : '—' }}</dd>
        <dt>ETag</dt><dd>{{ result.etag || '—' }}</dd>
        <dt>Content-Type</dt><dd>{{ result.contenttype || '—' }}</dd>
        <dt>{{ $t('label.bucket.object.metadata.checked') }}</dt><dd>{{ $toLocaleDate(result.checked) }}</dd>
      </dl>
      <h4>{{ $t('label.metadata') }}</h4>
      <p v-if="entries.length === 0" class="bucket-object-metadata-empty">{{ $t('message.bucket.object.metadata.empty') }}</p>
      <dl v-else class="bucket-object-metadata-fields">
        <template v-for="entry in entries" :key="entry.key"><dt>{{ entry.key }}</dt><dd>{{ entry.value }}</dd></template>
      </dl>
    </template>
    <a-alert v-else-if="status !== 'Idle'" :type="status === 'Unsupported' ? 'info' : 'warning'" show-icon :message="$t('message.bucket.object.metadata.' + status.toLowerCase())">
      <template v-if="canRetry" #action><a-button @click="load(true)">{{ $t('label.retry') }}</a-button></template>
    </a-alert>
    <dl v-if="status === 'Unsupported' && listing" class="bucket-object-metadata-fields">
      <dt>{{ $t('label.bucket.object.metadata.listingsize') }}</dt><dd>{{ listing.size }} {{ $t('label.bucket.object.metadata.bytes') }}</dd>
      <dt>{{ $t('label.bucket.object.metadata.listingmodified') }}</dt><dd>{{ listing.lastModified ? $toLocaleDate(listing.lastModified) : '—' }}</dd>
    </dl>
  </section>
</template>
<script>
import { postAPI } from '@/api'
export default {
  name: 'BucketObjectMetadata',
  props: {
    resource: { type: Object, required: true },
    objectKey: { type: String, default: '' },
    versionId: { type: String, default: undefined },
    active: { type: Boolean, default: false },
    listing: { type: Object, default: null },
    contextKey: { type: String, default: '' },
    revision: { type: Number, default: 0 }
  },
  data () { return { result: null, status: 'Idle', loading: false, generation: 0, pending: null, pendingKey: '', cache: new Map(), cacheScope: '' } },
  computed: {
    canRead () { return !!this.$store?.getters?.apis?.getBucketObjectMetadata },
    securityScope () {
      return JSON.stringify([this.resource.id, this.resource.url, this.resource.credentialstate, this.resource.credentialrevision,
        this.contextKey, this.$route?.path, this.$route?.query?.tab, this.$store?.getters?.project?.id, this.$store?.getters?.project?.state,
        this.$store?.getters?.userInfo?.id, this.$store?.getters?.userInfo?.roleid, this.$store?.getters?.userInfo?.roletype,
        this.$store?.state?.user?.token, this.canRead, this.revision])
    },
    queryKey () { return JSON.stringify([this.securityScope, this.objectKey, this.versionId]) },
    requestKey () { return JSON.stringify([this.queryKey, this.active]) },
    canRetry () { return this.canRead && ['NotFound', 'Forbidden', 'Timeout', 'Unavailable'].includes(this.status) },
    entries () { return Object.entries(this.result?.metadata || {}).map(([key, value]) => ({ key, value })) }
  },
  watch: {
    requestKey: {
      immediate: true,
      handler () {
        this.invalidate()
        if (this.cacheScope !== this.securityScope) { this.cache.clear(); this.cacheScope = this.securityScope }
        if (this.active && this.objectKey) this.load()
      }
    }
  },
  beforeUnmount () { this.invalidate(); this.cache.clear() },
  methods: {
    invalidate () { ++this.generation; this.pending = null; this.pendingKey = ''; this.result = null; this.status = 'Idle'; this.loading = false },
    load (force = false) {
      if (!this.active || !this.objectKey) return Promise.resolve()
      if (!this.canRead) { this.status = 'Forbidden'; return Promise.resolve() }
      const key = this.queryKey
      if (this.pending && this.pendingKey === key) return this.pending
      const cached = this.cache.get(key)
      if (!force && cached && Date.now() - cached.time < 10000) { this.result = cached.value; this.status = 'Available'; return Promise.resolve(cached.value) }
      this.cache.delete(key)
      const generation = ++this.generation
      const current = () => this.active && this.canRead && key === this.queryKey && generation === this.generation
      this.result = null; this.status = 'Idle'; this.loading = true; this.pendingKey = key
      const args = { id: this.resource.id, objectkey: this.objectKey }
      if (this.versionId != null) args.versionid = this.versionId
      const request = (async () => {
        try {
          const json = await postAPI('getBucketObjectMetadata', args, { preserveOnFailure: true, timeout: 35000 })
          if (!current()) return
          const value = json?.getbucketobjectmetadataresponse?.objectmetadata
          const known = ['Available', 'NotFound', 'Forbidden', 'Timeout', 'Unavailable', 'Unsupported']
          this.status = known.includes(value?.status) ? value.status : 'Unavailable'
          if (this.status === 'Available') {
            if (value.key !== this.objectKey || this.versionId != null && value.versionid !== this.versionId ||
                !Number.isSafeInteger(value.sizebytes) || value.sizebytes < 0 || !value.lastmodified || !value.etag ||
                !value.metadata || Array.isArray(value.metadata) || typeof value.metadata !== 'object' ||
                Object.values(value.metadata).some(v => typeof v !== 'string')) { this.status = 'Unavailable'; return }
            this.result = value; this.cache.set(key, { time: Date.now(), value })
            if (this.cache.size > 20) this.cache.delete(this.cache.keys().next().value)
          }
        } catch (error) {
          if (current()) {
            const data = error?.response?.data; const apiError = data && Object.values(data)[0]
            this.status = error?.code === 'ECONNABORTED' ? 'Timeout' : [401, 403, 431, 432, 531].includes(apiError?.errorcode || error?.response?.status) ? 'Forbidden' : 'Unavailable'
          }
        } finally {
          if (current()) { this.loading = false; this.pending = null; this.pendingKey = '' }
        }
      })()
      this.pending = request
      return request
    }
  }
}
</script>
<style scoped>
.bucket-object-metadata { color: var(--ui-text-primary); min-width: 0; overflow-wrap: anywhere; }
.bucket-object-metadata-toolbar { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; }
.bucket-object-metadata-note { color: var(--ui-text-secondary); margin: 8px 0 16px; }
.bucket-object-metadata-fields { margin: 0 0 16px; }
.bucket-object-metadata-fields dt { color: var(--ui-text-secondary); margin-top: 12px; }
.bucket-object-metadata-fields dd { margin: 4px 0 0; white-space: pre-wrap; overflow-wrap: anywhere; }
.bucket-object-metadata h4, .bucket-object-metadata-empty { color: var(--ui-text-primary); }
.bucket-object-metadata :deep(.ant-btn:not(:disabled)) { color: var(--ui-text-primary) !important; background: var(--ui-bg-elevated) !important; border-color: var(--ui-border-strong) !important; }
.bucket-object-metadata :deep(.ant-btn:not(:disabled):hover), .bucket-object-metadata :deep(.ant-btn:not(:disabled):focus) { color: var(--ui-link) !important; border-color: var(--ui-link) !important; }
</style>
