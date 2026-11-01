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
    <a-alert v-if="protectionError" type="error" show-icon :message="protectionError" class="protection-error" />
    <a-spin :spinning="loading">
      <a-form
        :ref="formRef"
        :model="form"
        :rules="rules"
        layout="vertical"
        :disabled="loading || validating"
        @finish="handleSubmit"
       >
        <ownership-selection v-if="canChooseOwner" embedded safe-scope :disabled="loading || validating" @fetch-owner="ownerChanged" />
        <a-form-item name="name" ref="name" :label="$t('label.name')">
          <a-input v-model:value="form.name" :disabled="loading || validating" v-focus="true" />
        </a-form-item>
        <a-form-item name="objectstore" ref="objectstore" :label="$t('label.object.storage')">
          <a-select
            v-model:value="form.objectstore"
            :disabled="loading || validating"
            @change="storeChanged"
            showSearch
            optionFilterProp="value"
            :filterOption="(input, option) => {
              return option.value.toLowerCase().indexOf(input.toLowerCase()) >= 0
            }" >
            <a-select-option :value="objectstore.id" v-for="objectstore in objectstores" :key="objectstore.id" :label="objectstore.name">
              {{ objectstore.name }}
            </a-select-option>
          </a-select>
        </a-form-item>
        <BucketQuotaContext :key="ownerKey" :store-id="form.objectstore || ''" />
        <BucketProtectionCapabilities :capabilities="capabilities" />
        <a-form-item name="quota" ref="quota" :label="$t('label.quotagib')" :validate-status="quotaError ? 'error' : undefined" :help="quotaError || undefined">
          <a-input
            v-model:value="form.quota"
            :disabled="loading || validating"
            @input="quotaError = ''"
inputmode="numeric"
autocomplete="off"
:maxlength="10"
            :placeholder="$t('label.quota')"/>
        </a-form-item>
        <a-form-item name="encryption" ref="encryption" :label="$t('label.encryption')">
          <a-switch
            v-model:checked="form.encryption"
            :disabled="loading || validating || capabilities.encryption !== 'Supported'"/>
        </a-form-item>
        <a-form-item name="versioning" ref="versioning" :label="$t('label.versioning')">
          <a-switch
            v-model:checked="form.versioning"
            :disabled="loading || validating || form.objectlocking || capabilities.versioning !== 'Supported'"/>
        </a-form-item>
        <a-form-item name="objectlocking" ref="objectlocking" :label="$t('label.objectlocking')">
          <a-switch
            v-model:checked="form.objectlocking"
            :disabled="loading || validating || capabilities.objectlocking !== 'Supported'"
            @change="value => { if (value) form.versioning = true }"/>
        </a-form-item>
        <a-form-item name="Bucket Policy" ref="policy" :label="$t('label.bucket.policy')">
          <a-select
            v-model:value="form.policy"
            :disabled="loading || validating"
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
        <BucketOwnerContext :owner="effectiveOwner" :ready="ownerReady" :scope="contextScope" :store-name="selectedStoreName" :quota="form.quota" />
        <div :span="24" class="action-button">
          <a-button :disabled="loading || validating" @click="closeModal">{{ $t('label.cancel') }}</a-button>
          <a-button :loading="loading || validating" :disabled="!ownerReady" type="primary" ref="submit" @click="handleSubmit">{{ $t('label.ok') }}</a-button>
        </div>
      </a-form>
    </a-spin>
  </div>
</template>
<script>
import { ref, reactive, toRaw } from 'vue'
import { getAPI, postAPI } from '@/api'
import { mixinForm } from '@/utils/mixin'
import BucketQuotaContext from '@/components/view/BucketQuotaContext'
import BucketProtectionCapabilities from '@/components/view/BucketProtectionCapabilities'
import { validBucketQuota, quotaErrorField } from '@/utils/bucketQuota'
import OwnershipSelection from '@/views/compute/wizard/OwnershipSelection'
import BucketOwnerContext from '@/components/view/BucketOwnerContext'
import { bucketOwnerParameters } from '@/utils/scopedOwnership'

export default {
  name: 'CreateBucket',
  mixins: [mixinForm],
  props: {
    resource: {
      type: Object,
      required: true
    }
  },
  components: {
    BucketQuotaContext, BucketProtectionCapabilities, OwnershipSelection, BucketOwnerContext
  },
  inject: ['parentFetchData'],
  data () {
    return {
      loading: false,
      validating: false,
      disposed: false,
      submitGeneration: 0,
      storeGeneration: 0,
      ownerSelection: null,
      quotaError: '',
      protectionError: '',
      objectstores: []
    }
  },
  computed: {
    caller () { return this.$store?.getters?.userInfo || {} },
    project () { return this.$store?.getters?.project || {} },
    contextScope () { return JSON.stringify([this.caller.id, this.caller.roleid, this.caller.roletype, this.caller.account, this.caller.domainid, this.$store?.state?.user?.token, !!this.$store?.getters?.apis?.listAccounts, !!this.$store?.getters?.apis?.listDomains, !!this.$store?.getters?.apis?.createBucket, this.project.id, this.project.state]) },
    canChooseOwner () { return !this.project.id && ['Admin', 'DomainAdmin'].includes(this.caller.roletype) && !!this.$store?.getters?.apis?.listAccounts && !!this.$store?.getters?.apis?.listDomains },
    effectiveOwner () {
      if (this.project.id) return { selectedAccountType: 'Project', selectedProject: this.project.id, projectLabel: this.project.name }
      if (this.canChooseOwner) return this.ownerSelection || {}
      return { selectedAccountType: 'Account', selectedAccount: this.caller.account, selectedDomain: this.caller.domainid, domainLabel: this.caller.domain }
    },
    ownerReady () { return !this.disposed && (this.project.id ? !this.project.state || this.project.state === 'Active' : this.canChooseOwner ? !!this.ownerSelection?.ready : !!this.caller.account && !!this.caller.domainid) },
    ownerParams () { return bucketOwnerParameters(this.canChooseOwner ? this.ownerSelection : null, this.caller, this.project) },
    ownerKey () { return JSON.stringify([this.contextScope, this.effectiveOwner.selectedAccountType, this.effectiveOwner.selectedDomain, this.effectiveOwner.selectedAccount, this.effectiveOwner.selectedProject, this.ownerReady]) },
    submissionScope () { return JSON.stringify([this.ownerKey, this.form?.objectstore]) },
    selectedStoreName () { return this.objectstores.find(store => store.id === this.form.objectstore)?.name || '' },
    capabilities () { return this.objectstores.find(store => store.id === this.form.objectstore)?.capabilities || {} }
  },
  watch: {
    contextScope (_, previous) { if (previous) { this.disposed = true; ++this.submitGeneration; ++this.storeGeneration; this.closeModal() } }
  },
  beforeUnmount () { this.disposed = true; ++this.submitGeneration; ++this.storeGeneration },
  created () {
    this.initForm()
    this.policyList = ['Public', 'Private']
    this.fetchData()
  },
  methods: {
    ownerChanged (state) { this.ownerSelection = { ...state }; this.quotaError = ''; this.validating = false; ++this.submitGeneration },
    storeChanged (value) {
      this.form.objectstore = value; this.quotaError = ''; this.protectionError = ''
      for (const key of ['encryption', 'versioning', 'objectlocking']) if (this.capabilities[key] !== 'Supported') this.form[key] = false
    },
    initForm () {
      this.formRef = ref()
      this.form = reactive({ encryption: false, versioning: false, objectlocking: false, policy: 'Private' })
      this.rules = reactive({
        name: [{ required: true, message: this.$t('label.required') }],
        objectstore: [{ required: true, message: this.$t('label.required') }],
        quota: [{ required: true, validator: (_, value) => validBucketQuota(value) ? Promise.resolve() : Promise.reject(new Error(this.$t('message.bucket.quota.validation'))) }]
      })
    },
    fetchData () {
      this.listObjectStores()
    },
    async listObjectStores () {
      const generation = ++this.storeGeneration; const scope = this.contextScope; this.loading = true
      try {
        const json = await getAPI('listObjectStoragePools', { ignoreproject: true }, { preserveOnFailure: true, timeout: 20000 })
        if (this.disposed || generation !== this.storeGeneration || scope !== this.contextScope) return
        this.objectstores = json.listobjectstoragepoolsresponse.objectstore || []
        if (this.objectstores.length > 0) this.form.objectstore = this.objectstores[0].id
      } catch (_) { if (!this.disposed && generation === this.storeGeneration) this.protectionError = this.$t('message.bucket.protection.capabilities.failed') } finally {
        if (!this.disposed && generation === this.storeGeneration) this.loading = false
      }
    },
    closeModal () {
      this.$emit('close-action')
    },
    async handleSubmit (e) {
      if (e?.preventDefault) e.preventDefault()
      if (this.loading || this.validating || !this.ownerReady || this.disposed) return
      const generation = ++this.submitGeneration; const scope = this.submissionScope
      const current = () => !this.disposed && generation === this.submitGeneration && scope === this.submissionScope && this.ownerReady
      this.validating = true; this.quotaError = ''
      try {
        await this.formRef.value.validate()
        if (!current()) return
        const values = this.handleRemoveFields({ ...toRaw(this.form) })
        const data = {
          ...this.ownerParams,
          ignoreproject: true,
          name: values.name,
          objectstorageid: values.objectstore,
          quota: Number(values.quota),
          encryption: values.encryption,
          versioning: values.versioning,
          objectlocking: values.objectlocking,
          policy: values.policy
        }
        if (data.objectlocking && !data.versioning) { this.protectionError = this.$t('message.bucket.protection.lock.versioning'); return }
        if (data.encryption && this.capabilities?.encryption !== 'Supported') { this.protectionError = this.$t('message.bucket.protection.encryption.unknown'); return }
        this.loading = true
        const response = await postAPI('createBucket', data)
        if (!current()) return
        if (!response.createbucketresponse?.jobid) throw new Error(this.$t('message.create.bucket.failed'))
        this.$pollJob({
          jobId: response.createbucketresponse.jobid,
          title: this.$t('label.create.bucket'),
          description: values.name,
          successMessage: this.$t('message.success.create.bucket'),
          errorMessage: this.$t('message.create.bucket.failed'),
          loadingMessage: this.$t('message.create.bucket.processing'),
          catchMessage: this.$t('error.fetching.async.job.result')
        })
        this.closeModal()
      } catch (error) {
        if (!current()) return
        if (error?.errorFields?.length) this.formRef.value.scrollToField(error.errorFields[0].name)
        else if (quotaErrorField(error)) this.quotaError = error.response.data.createbucketresponse.errortext
        else this.$notifyError(error)
      } finally {
        if (generation === this.submitGeneration) { this.loading = false; this.validating = false }
      }
    }
  }
}
</script>
<style lang="scss" scoped>
.form-layout { width: 100%; min-width: 0; }
.protection-error { margin-bottom: 16px; overflow-wrap: anywhere; }
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
