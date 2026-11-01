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
  <section class="bucket-protection-panel" :aria-label="$t('label.bucket.protection')">
    <a-alert v-if="errorText" class="protection-message" type="error" show-icon :message="errorText" />
    <a-alert class="protection-message bucket-info-ribbon" :type="state.protectionverificationstate === 'Verified' ? 'info' : 'warning'" show-icon>
      <template #message>{{ $t('label.bucket.protection.verification') }}: {{ $t('state.bucket.protection.' + (state.protectionverificationstate || 'Unknown').toLowerCase()) }}</template>
      <template #description>
        <p>{{ $t('message.bucket.protection.requested.actual') }}</p>
        <dl class="bucket-info-fields">
          <dt>{{ $t('label.bucket.protection.checked') }}</dt><dd>{{ state.protectioncheckedat ? $toLocaleDate(state.protectioncheckedat) : '—' }}</dd>
          <dt>{{ $t('label.bucket.protection.verified') }}</dt><dd>{{ state.protectionverifiedat ? $toLocaleDate(state.protectionverifiedat) : '—' }}</dd>
          <template v-if="state.operationid"><dt>{{ $t('label.bucket.protection.operation') }}</dt><dd>{{ state.operationid }}</dd></template>
        </dl>
        <p v-if="pending" class="protection-pending-note">{{ $t('message.bucket.protection.pending') }}</p>
      </template>
    </a-alert>
    <BucketProtectionCapabilities :capabilities="state.capabilities || {}" />
    <div class="protection-actions">
      <a-button type="primary" :loading="loading" :disabled="busy" @click="fetchState">{{ $t('label.bucket.protection.verify') }}</a-button>
      <a-button v-if="pending" :loading="busy" :disabled="loading" @click="confirm = 'restore'">{{ $t('label.bucket.protection.restore') }}</a-button>
      <a-button v-if="pending || state.protectionverificationstate === 'Mismatch'" :disabled="loading || busy || !known" @click="confirm = 'adopt'">{{ $t('label.bucket.protection.adopt') }}</a-button>
    </div>
    <a-table :columns="columns" :data-source="rows" :pagination="false" :loading="loading" :scroll="{ x: 560 }" row-key="key" size="middle" />
    <p class="protection-note">{{ $t('message.bucket.protection.scope') }}</p>
    <div v-if="known" class="protection-note">{{ $t('label.bucket.protection.version.status') }}: {{ state.versioningstatus }} · {{ $t('label.bucket.protection.algorithm') }}: {{ state.encryptionalgorithm }}</div>
    <MoldDialog class="storage-standard-dialog object-storage-dialog" size="md" :visible="!!confirm" :destroy-on-close="true" :closable="!busy" :title="$t(confirm === 'adopt' ? 'label.bucket.protection.adopt' : 'label.bucket.protection.restore')" @cancel="confirm = ''">
      <a-alert show-icon type="warning" :message="$t(confirm === 'adopt' ? 'message.bucket.protection.adopt' : 'message.bucket.protection.restore')" />
      <p class="protection-note">{{ resource.name }} · {{ state.operationid }}</p>
      <template #footer>
        <a-button :disabled="busy" @click="confirm = ''">{{ $t('label.cancel') }}</a-button>
        <a-button type="primary" :loading="busy" :disabled="loading || !known" @click="reconcile">{{ $t('label.ok') }}</a-button>
      </template>
    </MoldDialog>
  </section>
</template>
<script>
import { postAPI } from '@/api'
import MoldDialog from '@/components/view/MoldDialog'
import BucketProtectionCapabilities from '@/components/view/BucketProtectionCapabilities'
export default {
  name: 'BucketProtection',
  components: { MoldDialog, BucketProtectionCapabilities },
  props: { resource: { type: Object, required: true } },
  emits: ['state', 'reconciled', 'refresh'],
  data () { return { state: { protectionverificationstate: 'Unknown' }, loading: false, busy: false, errorText: '', confirm: '', generation: 0, activeContext: '', disposed: false } },
  computed: {
    context () { return [this.resource.id, this.$store?.getters?.project?.id, this.$store?.getters?.userInfo?.id, this.$store?.getters?.userInfo?.domainid].join(':') },
    scope () { return JSON.stringify([this.context, ...['objectstorageid', 'credentialrevision', 'encryption', 'versioning', 'objectlocking', 'quotaoperationid', 'quotaoperationstate'].map(key => this.resource[key])]) },
    pending () { return !!this.state.operationid && !['Succeeded', 'Failed'].includes(this.state.operationstate) },
    known () { return ['effectiveencryption', 'effectiveversioning', 'effectiveobjectlocking'].every(k => typeof this.state[k] === 'boolean') },
    columns () { return [{ title: this.$t('label.bucket.protection.option'), dataIndex: 'label' }, { title: this.$t('label.bucket.protection.requested'), dataIndex: 'requested' }, { title: this.$t('label.bucket.protection.actual'), dataIndex: 'actual' }] },
    rows () { return ['encryption', 'versioning', 'objectlocking'].map(key => ({ key, label: this.$t('label.' + key), requested: this.display(this.state['requested' + key] ?? this.resource[key]), actual: this.display(this.state['effective' + key]) })) }
  },
  watch: { scope: { immediate: true, handler () { this.confirm = ''; if (this.activeContext !== this.context) this.busy = false; this.activeContext = this.context; this.loading = false; this.errorText = ''; this.state = { protectionverificationstate: 'Unknown' }; this.fetchState() } } },
  beforeUnmount () { this.disposed = true; ++this.generation },
  methods: {
    display (value) { return typeof value !== 'boolean' ? this.$t('state.bucket.protection.unknown') : this.$t(value ? 'label.enabled' : 'label.disabled') },
    async fetchState () {
      const generation = ++this.generation; const id = this.resource.id
      if (!id) return
      this.loading = true; this.errorText = ''
      try {
        const response = await postAPI('getBucketProtection', { id })
        if (generation !== this.generation) return
        this.state = response.getbucketprotectionresponse.bucketprotection
        if (this.state.protectionverificationstate === 'Unknown') this.errorText = this.$t('message.bucket.protection.read.failed')
      } catch (error) {
        if (generation !== this.generation) return
        this.state = { protectionverificationstate: 'Unknown' }; this.errorText = this.$t('message.bucket.protection.read.failed')
      } finally {
        if (generation === this.generation) { this.loading = false; this.$emit('state', this.state) }
      }
    },
    async reconcile () {
      if (this.busy || !this.confirm) return
      const context = this.context; const id = this.resource.id; const action = this.confirm
      this.busy = true; this.errorText = ''
      try {
        await postAPI('reconcileBucketProtection', { id, operationid: this.state.operationid, acceptactual: action === 'adopt' })
        if (this.disposed || context !== this.context) return
        this.confirm = ''; await this.fetchState(); if (this.disposed || context !== this.context) return; this.$emit('reconciled', this.state); this.$emit('refresh')
      } catch (error) {
        if (this.disposed || context !== this.context) return
        this.confirm = ''; await this.fetchState(); if (this.disposed || context !== this.context) return; this.errorText = this.$t('message.bucket.protection.restore.failed')
      } finally { if (!this.disposed && context === this.context) this.busy = false }
    }
  }
}
</script>
<style scoped>
.bucket-protection-panel { min-width: 0; width: 100%; color: var(--ui-text-primary); }
.protection-message { margin-bottom: 16px; overflow-wrap: anywhere; }
.protection-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
.protection-actions .ant-btn { height: 32px; border-radius: 4px; font-size: 14px; }
.protection-note { margin-top: 16px; overflow-wrap: anywhere; color: var(--ui-text-secondary); }
</style>
