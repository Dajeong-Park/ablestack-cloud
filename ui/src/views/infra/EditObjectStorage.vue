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
  <div class="form-layout object-store-edit" v-ctrl-enter="submit">
    <a-alert type="info" show-icon :message="$t('message.objectstore.capacity.meaning')" />
    <a-alert v-if="legacy" type="warning" show-icon :message="$t('message.objectstore.capacity.legacy')" :description="String(resource.storagetotalbytes ?? resource.storagetotal ?? '—') + ' B'" />
    <a-alert v-if="failed" type="error" show-icon :message="$t('message.objectstore.update.failed')" />
    <a-form layout="vertical" @finish="submit">
      <a-form-item :label="$t('label.name')" html-for="store-edit-name" required><a-input id="store-edit-name" v-model:value="name" :disabled="loading" /></a-form-item>
      <a-form-item :label="$t('label.url')" html-for="store-edit-url" required><a-input id="store-edit-url" v-model:value="url" :disabled="loading" /></a-form-item>
      <a-form-item :label="$t('label.objectstore.capacity.limit')" html-for="store-edit-size" :validate-status="sizeError ? 'error' : ''" :help="sizeError ? $t(sizeError) : $t('message.objectstore.capacity.unchanged')">
        <a-input id="store-edit-size" v-model:value="size" inputmode="numeric" :aria-invalid="!!sizeError" :disabled="loading" :placeholder="legacy ? $t('message.objectstore.capacity.keep.legacy') : ''" />
      </a-form-item>
      <div class="action-button">
        <a-button :disabled="loading" @click="$emit('close-action')">{{ $t('label.cancel') }}</a-button>
        <a-button type="primary" :loading="loading" :disabled="!canSubmit" @click="submit">{{ $t('label.save') }}</a-button>
      </div>
    </a-form>
  </div>
</template>
<script>
import { postAPI } from '@/api'
import { initialGiB, exactBytes, capacityError, validEndpoint } from '@/utils/objectStoreCapacity'
export default {
  name: 'EditObjectStorage',
  props: { resource: { type: Object, required: true } },
  inject: { parentFetchData: { default: null } },
  data () { return { name: this.resource.name || '', url: this.resource.url || '', size: initialGiB(this.resource), loading: false, failed: false } },
  computed: {
    initialSize () { return initialGiB(this.resource) },
    legacy () { return this.initialSize === '' },
    sizeChanged () { return this.size !== this.initialSize },
    sizeError () { return this.sizeChanged ? capacityError(this.size, this.resource) : '' },
    changes () {
      const p = { id: this.resource.id }
      if (this.name !== this.resource.name) p.name = this.name.trim()
      if (this.url !== this.resource.url) p.url = this.url.trim()
      if (this.sizeChanged && !this.sizeError) p.size = this.size
      return p
    },
    canSubmit () { return this.$store.getters.userInfo?.roletype === 'Admin' && !!this.$store.getters.apis?.updateObjectStoragePool && !!this.name.trim() && (!this.changes.url || validEndpoint(this.changes.url)) && !this.sizeError && Object.keys(this.changes).length > 1 },
    context () { return JSON.stringify([this.resource.id, this.resource.url, this.resource.connectionrevision, this.$store.getters.userInfo?.id, this.$store.getters.userInfo?.roleid, !!this.$store.getters.apis?.updateObjectStoragePool, this.$store.state.user?.token, this.$store.getters.project?.id]) }
  },
  watch: { context () { this.$emit('close-action') } },
  methods: {
    exactBytes,
    async submit () {
      if (this.loading || !this.canSubmit) return
      const context = this.context; const params = { ...this.changes }; this.loading = true; this.failed = false
      try {
        await postAPI('updateObjectStoragePool', params, { preserveOnFailure: true, timeout: 20000 })
        if (context !== this.context) return
        this.$notification.success({ message: this.$t('label.action.update.object.storage') })
        this.parentFetchData && this.parentFetchData(); this.$emit('close-action')
      } catch (_) { if (context === this.context) this.failed = true } finally { this.loading = false }
    }
  }
}
</script>
<style scoped>
.object-store-edit { width: 100%; min-width: 0; overflow-wrap: anywhere; }
.object-store-edit .ant-alert { margin-bottom: 16px; }
.object-store-edit :deep(.ant-input) { color: var(--ui-text-primary); background: var(--ui-bg-input); }
</style>
