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
  <div class="form-layout bucket-deletion-form">
    <a-alert :type="purge ? 'warning' : 'info'" show-icon :message="$t(purge ? 'message.bucket.purge.warning' : 'message.bucket.delete.empty.only')" />
    <a-alert v-if="error" type="error" show-icon :message="$t(error)" />
    <a-spin :spinning="loading">
      <template v-if="impact">
        <a-descriptions :column="1" size="small" bordered>
          <a-descriptions-item :label="$t('label.bucket.current.objects')">{{ count(impact.currentobjects) }}</a-descriptions-item>
          <a-descriptions-item :label="$t('label.bucket.object.versions')">{{ count(impact.versioncount) }}</a-descriptions-item>
          <a-descriptions-item :label="$t('label.bucket.delete.markers')">{{ count(impact.deletemarkers) }}</a-descriptions-item>
          <a-descriptions-item :label="$t('label.bucket.inspected')">{{ $toLocaleDate(impact.checked) }}</a-descriptions-item>
        </a-descriptions>
        <a-alert v-if="impact.blockedreason" type="warning" show-icon :message="$t('message.bucket.delete.reason.' + impact.blockedreason.toLowerCase())" />
      </template>
      <div v-if="operation" class="bucket-purge-progress" role="status" aria-live="polite">
        <Status :text="operation.state === 'Succeeded' ? 'Running' : operation.state === 'NeedsReconcile' ? 'Error' : 'Pending'" :display-label="$t('state.bucket.purge.' + operation.state.toLowerCase())" display-text />
        <p>{{ $t('label.bucket.purge.operation') }}: <code>{{ operation.operationid }}</code></p>
        <p>{{ $t('label.bucket.purge.deleted') }}: {{ operation.deletedcount || 0 }}</p>
        <a-alert v-if="!operation.progressknown" type="warning" :message="$t('message.bucket.purge.unknown.progress')" />
        <p v-if="operation.lastkey">{{ $t('label.bucket.purge.checkpoint') }}: {{ operation.lastkey }} / {{ operation.lastversionid }}</p>
        <a-alert v-if="operation.state === 'NeedsReconcile'" type="error" show-icon :message="$t('message.bucket.purge.partial.failure')" />
        <ul v-if="operation.failures && operation.failures.length"><li v-for="item in operation.failures" :key="item.key + ':' + item.versionid">{{ item.key }} / {{ item.versionid }} — {{ item.errorcode }}</li></ul>
        <a-button :disabled="loading" @click="status">{{ $t('label.refresh') }}</a-button>
      </div>
      <a-form v-if="purge && impact && !finished" layout="vertical">
        <a-form-item :label="$t('label.bucket.confirm.name')" :html-for="'bucket-confirm-' + resource.id">
          <p>{{ resource.name }}</p>
          <a-input :id="'bucket-confirm-' + resource.id" v-model:value="confirmation" autocomplete="off" :disabled="running" />
        </a-form-item>
        <a-checkbox v-model:checked="includeVersions" :disabled="running">{{ $t('message.bucket.purge.include.versions') }}</a-checkbox>
        <a-checkbox v-model:checked="acknowledged" :disabled="running">{{ $t('message.bucket.purge.acknowledge') }}</a-checkbox>
      </a-form>
    </a-spin>
    <div class="action-button">
      <a-button @click="close">{{ $t('label.close') }}</a-button>
      <a-button v-if="requestId && !operation" :disabled="loading" @click="status">{{ $t('label.bucket.purge.status') }}</a-button>
      <a-button v-if="!operation" :disabled="loading" @click="load">{{ $t('label.refresh') }}</a-button>
      <a-button v-if="!purge" danger type="primary" :loading="loading" :disabled="!canDelete" @click="remove">{{ $t('label.bucket.delete.empty') }}</a-button>
      <a-button v-else-if="!finished" danger type="primary" :loading="loading" :disabled="!canPurge" @click="start">{{ $t(operation ? 'label.bucket.purge.retry' : 'label.bucket.purge') }}</a-button>
    </div>
  </div>
</template>
<script>
import { postAPI } from '@/api'
import Status from '@/components/widgets/Status'
const body = (json, command) => json[command.toLowerCase() + 'response'].bucketoperation
export default {
  components: { Status },
  props: { resource: { type: Object, required: true }, purge: Boolean },
  emits: ['close-action'],
  inject: { parentFetchData: { default: null } },
  data () { return { impact: null, operation: null, loading: false, error: '', confirmation: '', includeVersions: false, acknowledged: false, requestId: '' } },
  computed: {
    running () { return this.operation && !['Succeeded', 'NeedsReconcile', 'Failed'].includes(this.operation.state) },
    finished () { return this.operation?.state === 'Succeeded' },
    canDelete () { return !this.loading && this.impact?.complete && !this.impact.operationid && !(this.impact.versioncount || this.impact.deletemarkers) },
    canPurge () {
      return !this.loading && !this.running && this.confirmation === this.resource.name && this.includeVersions && this.acknowledged && this.impact && (this.impact.exists || this.operation?.state === 'NeedsReconcile') &&
      (!this.impact.blockedreason || this.impact.blockedreason === 'PURGE_RUNNING') && (!this.operation || this.operation.state === 'NeedsReconcile')
    }
  },
  watch: { 'resource.id' () { this.close() }, '$store.state.user.token' () { this.close() }, '$store.getters.project.id' () { this.close() }, '$route.path' () { this.close() } },
  created () { this.generation = 0; this.load() },
  beforeUnmount () { ++this.generation; clearTimeout(this.timer) },
  methods: {
    count (value) { return String(value || 0) + (this.impact.complete ? '' : ' +') },
    async load () {
      if (this.loading) return
      const generation = this.generation; this.loading = true; this.error = ''
      try {
        const json = await postAPI('getBucketDeletionImpact', { id: this.resource.id }, { preserveOnFailure: true })
        if (generation !== this.generation) return
        this.impact = body(json, 'getBucketDeletionImpact')
        if (this.purge && this.impact.blockedreason === 'PURGE_RUNNING') { this.requestId = this.impact.operationid; await this.status() }
      } catch (_) { if (generation === this.generation) this.error = 'message.bucket.delete.inspect.failed' } finally { if (generation === this.generation) this.loading = false }
    },
    async remove () {
      if (!this.canDelete) return
      const generation = this.generation; this.loading = true; this.error = ''
      try {
        await postAPI('deleteBucket', { id: this.resource.id }, { preserveOnFailure: true })
        if (generation !== this.generation) return
        this.$notification.success({ message: this.$t('label.bucket.delete.empty') }); this.close()
      } catch (_) {
        if (generation === this.generation) { this.error = 'message.bucket.delete.rejected'; this.loading = false; await this.load(); this.error = 'message.bucket.delete.rejected' }
      } finally { if (generation === this.generation) this.loading = false }
    },
    uuid () {
      const bytes = new Uint8Array(16); crypto.getRandomValues(bytes); bytes[6] = bytes[6] & 15 | 64; bytes[8] = bytes[8] & 63 | 128
      return [...bytes].map((v, i) => ([4, 6, 8, 10].includes(i) ? '-' : '') + v.toString(16).padStart(2, '0')).join('')
    },
    async start () {
      if (!this.canPurge) return
      const generation = this.generation; this.loading = true; this.error = ''
      this.requestId = this.requestId || this.uuid()
      try {
        const json = await postAPI('purgeBucket', {
          id: this.resource.id,
          operationid: this.requestId,
          confirmname: this.confirmation,
          includeversions: true,
          expectedexternalid: this.impact.externalid,
          retry: !!this.operation
        }, { preserveOnFailure: true })
        if (generation !== this.generation) return
        this.operation = body(json, 'purgeBucket'); this.acknowledged = false; await this.status()
      } catch (_) { if (generation === this.generation) { this.error = 'message.bucket.purge.request.failed'; this.acknowledged = false } } finally { if (generation === this.generation) this.loading = false }
    },
    async status () {
      if (!this.requestId) return
      clearTimeout(this.timer); const generation = this.generation
      try {
        const json = await postAPI('getBucketPurgeStatus', { id: this.resource.id, operationid: this.requestId }, { preserveOnFailure: true })
        if (generation !== this.generation) return
        this.operation = body(json, 'getBucketPurgeStatus'); this.error = ''
        if (this.running) this.timer = setTimeout(() => this.status(), 2000)
        if (this.finished) this.$notification.success({ message: this.$t('label.bucket.purge.complete') })
      } catch (_) { if (generation === this.generation) this.error = 'message.bucket.purge.status.failed' }
    },
    close () { ++this.generation; clearTimeout(this.timer); this.confirmation = ''; this.acknowledged = false; this.parentFetchData && this.parentFetchData(); this.$emit('close-action') }
  }
}
</script>
<style scoped lang="less">
.bucket-deletion-form {
  .ant-alert { margin-bottom: 16px; }
  .ant-checkbox-wrapper { display: flex; margin: 12px 0; }
  .bucket-purge-progress { margin: 16px 0; overflow-wrap: anywhere; }
  code, li { overflow-wrap: anywhere; }
  :deep(.ant-btn:not(.ant-btn-primary):not(:disabled):hover),
  :deep(.ant-btn:not(.ant-btn-primary):not(:disabled):focus) {
    color: var(--ui-link) !important;
    border-color: var(--ui-link) !important;
  }
  :deep(.ant-input) { background: var(--ui-bg-input); color: var(--ui-text-primary); border-color: var(--ui-border); }
  :deep(.ant-descriptions-item-label) { background: var(--ui-bg-elevated); color: var(--ui-text-secondary); }
  :deep(.ant-descriptions-item-content) { background: var(--ui-bg-surface); color: var(--ui-text-primary); }
}
</style>
