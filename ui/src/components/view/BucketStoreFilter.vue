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
  <div v-if="canRead" class="bucket-store-filter">
    <label for="bucket-object-store-filter">{{ $t('label.object.storage') }}</label>
    <a-select
id="bucket-object-store-filter"
:value="$route.query.objectstorageid || undefined"
:aria-label="$t('label.bucket.store.filter')"
:placeholder="$t('label.bucket.store.all')"
allow-clear
show-search
option-filter-prop="label"
:loading="loading"
:disabled="loading || !!error"
@change="change">
      <a-select-option v-for="option in options" :key="option.id" :value="option.id" :label="option.name">{{ option.name }}</a-select-option>
    </a-select>
    <a-button :loading="loading" :aria-label="$t('label.bucket.store.reload')" @click="load"><template #icon><reload-outlined /></template>{{ $t('label.refresh') }}</a-button>
    <a-alert v-if="error" show-icon type="error" :message="$t('message.bucket.store.options.failed')" />
    <span v-else-if="!loading && $route.query.objectstorageid && !options.some(option => option.id === $route.query.objectstorageid)" role="status">{{ $t('message.bucket.store.selection.unknown') }}</span>
  </div>
</template>
<script>
import { getAPI } from '@/api'
export default {
  name: 'BucketStoreFilter',
  data () { return { options: [], loading: false, error: false, generation: 0 } },
  computed: {
    canRead () { return this.$store.getters.userInfo?.roletype === 'Admin' && !!this.$store.getters.apis?.listObjectStoragePools },
    context () { return JSON.stringify([this.canRead, this.$store.getters.userInfo?.id, this.$store.getters.userInfo?.roleid, this.$store.state?.user?.token, this.$store.getters.project?.id, this.$route.query.projectid]) }
  },
  watch: {
    context: {
      immediate: true,
      handler (_, previous) {
        this.options = []; this.error = false
        if (previous && this.$route.query.objectstorageid) this.change(undefined, true)
        this.load()
      }
    }
  },
  beforeUnmount () { ++this.generation },
  methods: {
    change (id, replace = false) {
      const query = { ...this.$route.query, page: '1' }
      if (id) query.objectstorageid = id
      else delete query.objectstorageid
      this.$router[replace ? 'replace' : 'push']({ query })
    },
    async load () {
      const generation = ++this.generation
      if (!this.canRead) { this.loading = false; return }
      this.loading = true; this.error = false
      try {
        const options = []; const seen = new Set()
        for (let page = 1; page <= 100; page++) {
          const response = await getAPI('listObjectStoragePools', { page, pagesize: 500, ignoreproject: true }, { preserveOnFailure: true, timeout: 20000 })
          if (generation !== this.generation) return
          const body = response.listobjectstoragepoolsresponse
          if (!body || typeof body !== 'object' || body.errorcode) throw new Error('Invalid store response')
          const rows = body.objectstore || []; const total = Number(body.count ?? (Object.keys(body).length === 0 ? 0 : NaN))
          if (!Array.isArray(rows) || !Number.isInteger(total) || total < options.length + rows.length) throw new Error('Invalid store count')
          for (const row of rows) { if (!row.id || seen.has(row.id)) throw new Error('Duplicate store page'); seen.add(row.id); options.push({ id: row.id, name: row.name || row.id }) }
          if (options.length >= total) { this.options = options; return }
          if (!rows.length || page === 100) throw new Error('Incomplete store list')
        }
      } catch (error) {
        if (generation !== this.generation) return
        this.error = true
        const code = Number(error.response?.status || Object.values(error.response?.data || {}).find(value => value?.errorcode)?.errorcode)
        if ([401, 403, 431, 432, 531].includes(code)) this.options = []
      } finally { if (generation === this.generation) this.loading = false }
    }
  }
}
</script>
<style scoped>
.bucket-store-filter { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; padding: 12px; color: var(--ui-text-primary); }
.bucket-store-filter .ant-select { width: 280px; max-width: 100%; }
.bucket-store-filter .ant-btn { height: 32px; font-size: 14px; border-radius: 4px; }
.bucket-store-filter .ant-alert { flex-basis: 100%; }
@media (max-width: 575px) { .bucket-store-filter .ant-select { flex: 1 1 200px; min-width: 0; } }
</style>
