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
  <section class="bucket-upload-metadata" :aria-label="$t('label.metadata')">
    <p class="metadata-help">{{ $t('message.objectstore.metadata.help') }}</p>
    <div v-for="(row, index) in rows" :key="row.id" class="metadata-row" role="group" :aria-label="$t('label.metadata') + ' ' + (index + 1)">
      <div class="metadata-field"><label :for="'bucket-meta-key-' + row.id">{{ $t('label.key') }}</label><a-input :id="'bucket-meta-key-' + row.id" v-model:value="row.key" :disabled="disabled" :placeholder="$t('label.objectstore.metadata.key.placeholder')" /></div>
      <div class="metadata-field"><label :for="'bucket-meta-value-' + row.id">{{ $t('label.value') }}</label><a-textarea :id="'bucket-meta-value-' + row.id" v-model:value="row.value" :disabled="disabled" :auto-size="{minRows:1,maxRows:3}" :placeholder="$t('label.objectstore.metadata.value.placeholder')" /></div>
      <a-button :disabled="disabled" class="metadata-remove" :aria-label="$t('label.objectstore.metadata.remove') + ' ' + (index + 1)" @click="rows.splice(index, 1)"><delete-outlined /></a-button>
    </div>
    <a-alert v-if="validation.error" type="error" show-icon :message="$t(validation.error)" />
    <div class="metadata-footer"><a-button :disabled="disabled || rows.length >= 64" @click="rows.push({id:nextId++,key:'',value:''})"><plus-outlined />{{ $t('label.add.key.value') }}</a-button><span role="status">{{ rows.length }}/64 · {{ validation.bytes }}/2048 B</span></div>
  </section>
</template>
<script>
import { analyzeMetadata } from '@/utils/bucketUploadMetadata'
export default {
  name: 'BucketUploadMetadata',
  props: { pairs: { type: Object, default: () => ({}) }, disabled: Boolean },
  emits: ['update-pairs', 'validity'],
  data () { return { rows: Object.entries(this.pairs).map(([key, value], id) => ({ id, key, value })), nextId: Object.keys(this.pairs).length } },
  computed: { validation () { return analyzeMetadata(this.rows) } },
  watch: { validation: { immediate: true, handler (value) { this.$emit('update-pairs', value.metadata); this.$emit('validity', value.valid) } } }
}
</script>
<style scoped>
.bucket-upload-metadata { min-width: 0; color: var(--ui-text-primary); }
.metadata-help, .metadata-footer span { color: var(--ui-text-secondary); font-size: 14px; overflow-wrap: anywhere; }
.metadata-row { display: grid; grid-template-columns: minmax(0,1fr) minmax(0,2fr) 32px; align-items: start; gap: 12px; padding: 12px; border: 1px solid var(--ui-border); border-radius: 4px; background: var(--ui-bg-elevated); margin-bottom: 12px; }
.metadata-field { min-width: 0; }
.metadata-field label { display: block; margin-bottom: 6px; color: var(--ui-text-secondary); }
.metadata-field :deep(.ant-input) { width: 100%; color: var(--ui-text-primary) !important; background: var(--ui-bg-input) !important; border-color: var(--ui-border-strong); }
.metadata-field :deep(.ant-input::placeholder) { color: var(--ui-text-muted); opacity: 1; }
.metadata-footer { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; margin-top: 12px; }
.metadata-remove { margin-top: 28px; }
.bucket-upload-metadata .ant-btn { height: 32px; font-size: 14px; border-radius: 4px; }
@media (max-width:575px) { .metadata-row { grid-template-columns: minmax(0,1fr); } .metadata-remove { margin-top: 0; justify-self: end; } }
</style>
