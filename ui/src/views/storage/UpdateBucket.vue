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
  <div class="form-layout bucket-quota-form" v-ctrl-enter="handleSubmit">
    <a-form
      :disabled="loading || pending"
      :ref="formRef"
      :model="form"
      :rules="rules"
      layout="vertical"
      @finish="handleSubmit"
    >
      <div class="bucket-update-general-fields">
        <a-form-item name="quota" ref="quota" :label="$t('label.quotagib')" :validate-status="quotaError ? 'error' : undefined" :help="quotaError || undefined">
          <a-input
            v-model:value="form.quota"
  inputmode="numeric"
  autocomplete="off"
  :maxlength="10"
  @input="quotaTouched = true; quotaError = ''"
            :placeholder="$t('label.quota')"/>
          <p v-if="legacy" class="bucket-update-note">{{ $t('message.bucket.quota.legacy') }}</p>
          <BucketQuotaContext compact :store-id="resource.objectstorageid || ''" />
        </a-form-item>
        <a-form-item name="Bucket Policy" ref="policy" :label="$t('label.bucket.policy')">
          <a-select
            v-model:value="form.policy"
            @change="val => { form.policy = val }"
            showSearch
            optionFilterProp="value"
            :filterOption="(input, option) => String(option.label || option.value).toLowerCase().includes(input.toLowerCase())" >
            <a-select-option
              :value="policy"
                :label="$t('label.bucket.policy.' + policy.toLowerCase())"
              v-for="(policy,idx) in policyList"
              :key="idx"
            >{{ $t('label.bucket.policy.' + policy.toLowerCase()) }}</a-select-option>
          </a-select>
        </a-form-item>
      </div>
      <div class="bucket-update-protection-options">
        <a-form-item name="encryption" ref="encryption" :label="$t('label.encryption')">
          <a-switch
            v-model:checked="form.encryption"
            :disabled="!canChangeProtection || protectionState.capabilities?.encryption !== 'Supported'"/>
          <p v-if="protectionHint('encryption')" class="bucket-update-note">{{ protectionHint('encryption') }}</p>
        </a-form-item>
        <a-form-item name="versioning" ref="versioning" :label="$t('label.versioning')">
          <a-switch
            v-model:checked="form.versioning"
            :disabled="!canChangeProtection || protectionState.effectiveobjectlocking || protectionState.capabilities?.versioning !== 'Supported'"/>
          <p v-if="protectionHint('versioning')" class="bucket-update-note">{{ protectionHint('versioning') }}</p>
        </a-form-item>
        <a-form-item :label="$t('label.objectlocking')">
          <span class="bucket-update-readonly">{{ protectionDisplay(protectionState.effectiveobjectlocking) }}</span>
          <p v-if="protectionHint('objectlocking')" class="bucket-update-note">{{ protectionHint('objectlocking') }}</p>
        </a-form-item>
      </div>
    </a-form>
    <section v-if="quotaPending" class="bucket-quota-recovery">
      <div class="quota-recovery-actions"><a-button :loading="loading" :disabled="loading || !canReconcile" @click="reconcile">{{ $t('label.bucket.quota.reconcile') }}</a-button></div>
      <p class="bucket-update-note" role="status">{{ $t('message.bucket.quota.pending') }}</p>
      <dl class="quota-recovery-details">
        <dt>{{ $t('label.state') }}</dt><dd><Status text="Pending" :display-label="$t('state.bucket.quota.' + resource.quotaoperationstate.toLowerCase())" display-text /></dd>
        <dt>{{ $t('label.bucket.protection.operation') }}</dt><dd>{{ resource.quotaoperationid }}</dd>
        <dt>{{ $t('label.bucket.quota.checked') }}</dt><dd>{{ $toLocaleDate(resource.quotaoperationupdated) }}</dd>
      </dl>
    </section>
    <BucketProtection compact :resource="resource" @state="value => { protectionState = value }" @reconciled="protectionReconciled" />
    <a-alert v-if="errorText && errorText !== quotaError" type="error" show-icon class="quota-message" :message="errorText" />
    <div class="action-button">
      <a-button :disabled="loading" @click="closeModal">{{ $t('label.cancel') }}</a-button>
      <a-button :loading="loading" :disabled="pending" type="primary" ref="submit" @click="handleSubmit">{{ $t('label.ok') }}</a-button>
    </div>
  </div>
</template>
<script>
import { ref, reactive } from 'vue'
import { postAPI } from '@/api'
import { mixinForm } from '@/utils/mixin'
import BucketQuotaContext from '@/components/view/BucketQuotaContext'
import BucketProtection from '@/views/storage/BucketProtection'
import Status from '@/components/widgets/Status'
import { validBucketQuota, pendingBucketQuota, bucketChanges, quotaErrorField } from '@/utils/bucketQuota'

export default {
  name: 'updateBucket',
  mixins: [mixinForm],
  components: { BucketQuotaContext, Status, BucketProtection },
  props: {
    resource: {
      type: Object,
      required: true
    }
  },
  data () { return { loading: false, quotaTouched: false, errorText: '', quotaError: '', protectionState: { protectionverificationstate: 'Unknown' } } },
  computed: {
    quotaPending () { return pendingBucketQuota(this.resource) && this.resource.quotaoperationtype !== 'PROTECTION' },
    canChangeProtection () { return this.protectionState.protectionverificationstate === 'Verified' && !this.pending },
    pending () { return pendingBucketQuota(this.resource) || (!!this.protectionState.operationid && !['Succeeded', 'Failed'].includes(this.protectionState.operationstate)) },
    canReconcile () { return !!this.$getApiParams('updateBucket')?.reconcile },
    legacy () { return !validBucketQuota(this.resource.quota) }
  },
  created () {
    this.initForm()
    this.policyList = ['Public', 'Private']
    this.fetchData()
  },
  methods: {
    protectionDisplay (value) { return typeof value === 'boolean' ? this.$t(value ? 'label.enabled' : 'label.disabled') : this.$t('state.bucket.protection.unknown') },
    protectionHint (key) {
      const notes = []; const capability = this.protectionState.capabilities?.[key]
      if (capability !== 'Supported') notes.push(this.$t('label.bucket.protection.supported') + ': ' + this.$t('state.bucket.capability.' + (capability || 'Unknown').toLowerCase()))
      const actual = this.protectionState['effective' + key]
      const requested = key === 'objectlocking' ? this.resource.objectlocking : this.form[key]
      if (typeof actual === 'boolean' && typeof requested === 'boolean' && actual !== requested) {
        const label = key === 'objectlocking' ? 'label.bucket.protection.requested' : 'label.bucket.protection.actual'
        notes.push(this.$t(label) + ': ' + this.protectionDisplay(key === 'objectlocking' ? requested : actual))
      }
      if (key === 'versioning' && this.protectionState.effectiveobjectlocking) notes.push(this.$t('message.bucket.protection.lock.versioning'))
      return notes.join(' · ')
    },
    protectionReconciled (value) {
      this.form.encryption = value.requestedencryption; this.form.versioning = value.requestedversioning
      this.$emit('refresh-data')
    },
    initForm () {
      this.formRef = ref()
      this.form = reactive({})
      this.rules = reactive({
        quota: [{
          required: true,
          validator: (_, value) => this.legacy && !this.quotaTouched && String(value) === String(this.resource.quota)
            ? Promise.resolve()
            : validBucketQuota(value) ? Promise.resolve() : Promise.reject(new Error(this.$t('message.bucket.quota.validation')))
        }]
      })
    },
    fetchData () {
      for (const key of ['quota', 'encryption', 'versioning', 'policy']) this.form[key] = this.resource[key]
    },
    async reconcile () {
      if (this.loading || !this.pending || !this.canReconcile) return
      this.loading = true; this.errorText = ''
      try {
        await postAPI('updateBucket', { id: this.resource.id, reconcile: true, expectedquotaoperationid: this.resource.quotaoperationid })
        this.$emit('refresh-data'); this.closeModal()
      } catch (error) {
        this.errorText = error?.response?.data?.updatebucketresponse?.errortext || this.$t('message.bucket.quota.retry.failed')
        this.$emit('refresh-data')
      } finally { this.loading = false }
    },
    handleSubmit (e) {
      if (e?.preventDefault) e.preventDefault()
      if (this.loading || this.pending) return
      this.quotaError = ''
      this.formRef.value.validate().then(async () => {
        const changes = bucketChanges(this.form, this.resource, this.quotaTouched)
        const protection = Object.keys(changes).some(key => ['encryption', 'versioning'].includes(key))
        if (protection && (!this.canChangeProtection || this.protectionState.effectiveobjectlocking && changes.versioning === false)) {
          this.errorText = this.$t('message.bucket.protection.verify.required'); return
        }
        if ((changes.quota !== undefined ? 1 : 0) + (protection ? 1 : 0) + (changes.policy !== undefined ? 1 : 0) > 1) {
          this.errorText = this.$t('message.bucket.quota.separate')
          return
        }
        if (!Object.keys(changes).length) { this.closeModal(); return }
        this.loading = true; this.errorText = ''
        try {
          await postAPI('updateBucket', { id: this.resource.id, ...changes })
          this.$notification.success({ message: this.$t('label.bucket.update'), description: this.$t('message.success.update.bucket') })
          this.closeModal()
        } catch (error) {
          this.errorText = error?.response?.data?.updatebucketresponse?.errortext || this.$t('message.bucket.quota.retry.failed')
          if (quotaErrorField(error)) this.quotaError = this.errorText
          this.$emit('refresh-data')
        } finally { this.loading = false }
      }).catch(error => {
        if (error?.errorFields?.length) this.formRef.value.scrollToField(error.errorFields[0].name)
      })
    },
    closeModal () {
      this.$emit('refresh-data')
      this.$emit('close-action')
    }
  }
}
</script>
<style lang="scss" scoped>
.form-layout { width: 100%; min-width: 0; }
.quota-message { margin-bottom: 16px; overflow-wrap: anywhere; }
.quota-message .ant-btn { margin-top: 8px; height: 32px; border-radius: 4px; }
.bucket-update-general-fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 16px; }
.bucket-update-protection-options { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0 16px; }
.bucket-update-general-fields > .ant-form-item, .bucket-update-protection-options > .ant-form-item { display: block; min-width: 0; }
.bucket-update-general-fields, .bucket-update-protection-options {
  :deep(.ant-form-item-label), :deep(.ant-form-item-control) { width: 100%; max-width: 100%; min-width: 0; }
}
.bucket-update-note { margin: 6px 0 0; font-size: 12px; color: var(--ui-text-secondary); overflow-wrap: anywhere; }
.bucket-update-readonly { display: inline-flex; align-items: center; min-height: 32px; }
.bucket-quota-recovery { margin-bottom: 16px; }
.quota-recovery-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.quota-recovery-details { display: grid; grid-template-columns: max-content minmax(0, 1fr); gap: 4px 12px; margin: 8px 0 0; font-size: 12px; }
.quota-recovery-details dt { color: var(--ui-text-secondary); }
.quota-recovery-details dd { margin: 0; overflow-wrap: anywhere; }
@media (max-width: 575px) { .bucket-update-general-fields, .bucket-update-protection-options, .quota-recovery-details { grid-template-columns: minmax(0, 1fr); } }
.bucket-quota-form {
  :deep(.ant-input:not([disabled])),
  :deep(.ant-select:not(.ant-select-disabled) .ant-select-selector) {
    color: var(--ui-text-primary) !important;
    background: var(--ui-bg-input) !important;
  }
  :deep(.ant-select:not(.ant-select-disabled) .ant-select-selection-item) {
    color: var(--ui-text-primary) !important;
  }
}
</style>
