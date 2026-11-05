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
  <section class="object-store-health">
    <DetailsTab :resource="resource" :loading="loading" />
    <h3>{{ $t('label.objectstore.capacity') }}</h3>
    <p class="store-note">{{ $t('message.objectstore.capacity.meaning') }}</p>
    <dl class="store-capacities">
      <template v-for="item in capacities" :key="item.key"><dt>{{ $t(item.label) }}</dt><dd>{{ item.value }}<small v-if="item.bytes !== null">{{ item.bytes.toLocaleString() }} {{ $t('label.bytes') }}</small></dd></template>
    </dl>
    <div v-if="allocatedPercent !== null" class="store-ratio"><span>{{ $t('label.objectstore.capacity.allocated.percent') }}: {{ allocatedPercent }}%</span><a-progress :percent="Math.min(100, allocatedPercent)" :show-info="false" /></div>
    <div v-if="usedPercent !== null" class="store-ratio"><span>{{ $t('label.objectstore.capacity.used.percent') }}: {{ usedPercent }}%</span><a-progress :percent="Math.min(100, usedPercent)" :show-info="false" /></div>
    <p class="store-note">{{ $t('message.objectstore.capacity.logical') }}</p>
    <dl class="store-fields"><dt>{{ $t('label.objectstore.usage.state') }}</dt><dd>{{ $t('state.objectstore.usage.' + usageState.toLowerCase()) }}</dd><dt>{{ $t('label.objectstore.usage.oldest') }}</dt><dd>{{ resource.usagelastupdated ? $toLocaleDate(resource.usagelastupdated) : '—' }}</dd><dt>{{ $t('label.objectstore.usage.coverage') }}</dt><dd>{{ resource.usagebucketcount ?? '—' }} / {{ resource.usageunknownbuckets ?? '—' }} / {{ resource.usagefailedbuckets ?? '—' }}</dd></dl>
    <router-link v-if="canReadBuckets" :to="{path:$route.path,query:{...$route.query,tab:'buckets'}}">{{ $t('label.objectstore.buckets') }}</router-link>
    <a-divider />
    <div class="store-check-toolbar"><a-button v-if="canCheck" type="primary" :loading="checking" @click="check"><template #icon><reload-outlined /></template>{{ $t('label.objectstore.connection.check') }}</a-button><span role="status" aria-live="polite">{{ $t('state.objectstore.connection.' + status.toLowerCase()) }}</span></div>
    <p class="store-note">{{ $t('message.objectstore.connection.readonly') }}</p>
    <a-alert v-if="status !== 'Connected'" :type="status === 'Unknown' ? 'info' : 'error'" show-icon :message="$t('message.objectstore.connection.' + reason.toLowerCase())" />
    <dl class="store-fields"><dt>{{ $t('label.objectstore.connection.checked') }}</dt><dd>{{ checked ? $toLocaleDate(checked) : '—' }}</dd><dt>{{ $t('label.objectstore.connection.success') }}</dt><dd>{{ lastSuccess ? $toLocaleDate(lastSuccess) : '—' }}</dd></dl>
  </section>
</template>
<script>
import { postAPI } from '@/api'
import DetailsTab from '@/components/view/DetailsTab'
import { exactBytes, formatBytes, capacityPercent } from '@/utils/objectStoreCapacity'
const statuses = ['Connected', 'AuthFailed', 'AccessDenied', 'Unreachable', 'Unknown']
const reasons = ['Verified', 'AuthRejected', 'PermissionDenied', 'Timeout', 'Network', 'Tls', 'Unavailable', 'InvalidEndpoint', 'UnexpectedResponse', 'Unsupported', 'Busy', 'ConfigurationChanged']
export default {
  name: 'ObjectStoreDetails',
  components: { DetailsTab },
  props: { resource: { type: Object, required: true }, loading: Boolean },
  inject: { parentFetchData: { default: null } },
  data () { return { checking: false, status: 'Unknown', reason: 'NotChecked', checked: null, lastSuccess: null, generation: 0 } },
  computed: {
    canCheck () { return this.$store.getters.userInfo?.roletype === 'Admin' && !!this.$store.getters.apis?.checkObjectStoragePool },
    canReadBuckets () { return this.$store.getters.userInfo?.roletype === 'Admin' && !!this.$store.getters.apis?.listBuckets },
    context () { return JSON.stringify([this.$route.path, this.$route.query?.tab, this.resource.id, this.resource.url, this.resource.connectionrevision || 'legacy', this.$store.getters.userInfo?.id, this.$store.getters.userInfo?.roleid, this.$store.state.user?.token, this.canCheck, this.$store.getters.project?.id]) },
    usageState () { return ['Fresh', 'Stale', 'Error', 'Unknown', 'NoBuckets'].includes(this.resource.usagestatus) ? this.resource.usagestatus : 'Unknown' },
    capacities () {
      return ['storagetotal', 'storageallocated', 'storagereserved', 'storageused'].map(key => {
        const bytes = exactBytes(this.resource, key)
        const value = key === 'storagetotal' && this.resource.capacitytracking === 'Disabled' ? this.$t('label.objectstore.capacity.disabled') : formatBytes(bytes)
        return { key, label: 'label.objectstore.' + key, bytes, value }
      })
    },
    allocatedPercent () { const a = exactBytes(this.resource, 'storageallocated'); const r = exactBytes(this.resource, 'storagereserved'); return capacityPercent(a === null || r === null ? null : a + r, exactBytes(this.resource, 'storagetotal')) },
    usedPercent () { return this.usageState === 'Fresh' ? capacityPercent(exactBytes(this.resource, 'storageused'), exactBytes(this.resource, 'storagetotal')) : null }
  },
  watch: { context () { ++this.generation; this.checking = false; this.status = 'Unknown'; this.reason = 'NotChecked'; this.checked = null; this.lastSuccess = null } },
  deactivated () { ++this.generation; this.checking = false },
  beforeUnmount () { ++this.generation },
  methods: {
    async check () {
      if (!this.canCheck || this.checking || !this.resource.id) return
      const generation = ++this.generation; const context = this.context; this.checking = true
      try {
        const response = await postAPI('checkObjectStoragePool', { id: this.resource.id }, { preserveOnFailure: true, timeout: 20000 })
        if (generation !== this.generation || context !== this.context) return
        const r = response.checkobjectstoragepoolresponse?.objectstoreconnection
        if (!r || r.id !== this.resource.id || !statuses.includes(r.status) || !reasons.includes(r.reason) || !r.checked) throw new Error('Invalid check')
        if (r.connectionrevision !== (this.resource.connectionrevision || 'legacy')) { this.status = 'Unknown'; this.reason = 'ConfigurationChanged'; this.lastSuccess = null; this.checked = r.checked; this.parentFetchData && this.parentFetchData(); return }
        this.status = r.status; this.reason = r.reason; this.checked = r.checked
        if (r.status === 'Connected') this.lastSuccess = r.checked
      } catch (_) {
        if (generation === this.generation && context === this.context) { this.status = 'Unreachable'; this.reason = 'Unavailable'; this.checked = new Date().toISOString() }
      } finally { if (generation === this.generation) this.checking = false }
    }
  }
}
</script>
<style scoped>
.object-store-health { min-width: 0; color: var(--ui-text-primary); overflow-wrap: anywhere; }
.object-store-health h3 { color: var(--ui-text-primary); margin-top: 20px; }
.store-note, .store-fields dt, .store-capacities dt { color: var(--ui-text-secondary); }
.store-capacities, .store-fields { display: grid; grid-template-columns: minmax(100px, 1fr) minmax(0, 2fr); gap: 12px; }
.store-capacities dd, .store-fields dd { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; }
.store-capacities small { display: block; color: var(--ui-text-secondary); font-size: 14px; }
.store-check-toolbar { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 12px; }
.store-check-toolbar .ant-btn { height: 32px; font-size: 14px; border-radius: 4px; }
.store-ratio { margin-top: 12px; }
.object-store-health .ant-alert { margin-bottom: 16px; }
@media (max-width: 575px) { .store-capacities, .store-fields { grid-template-columns: 1fr; gap: 6px; } .store-capacities dd, .store-fields dd { margin-bottom: 12px; } }
</style>
