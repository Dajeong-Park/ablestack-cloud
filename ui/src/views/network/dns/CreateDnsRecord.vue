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
  <div class="form-layout" v-ctrl-enter="handleSubmit">
    <a-alert v-if="jobError" :message="jobError" type="error" show-icon class="dns-job-error" />
    <a-spin :spinning="jobLoading">
      <a-form
        ref="formRef"
        :model="form"
        :rules="rules"
        layout="vertical"
        @finish="handleSubmit">

        <fieldset class="dns-form-fields" :disabled="jobLoading || !!jobId || jobTracking === 'unconfirmed'">
          <a-form-item name="name" ref="name">
            <template #label>
              <tooltip-label
                :title="$t('label.name')"
                :tooltip="$t('label.dns.record.name.tooltip')" />
            </template>
            <a-input
              v-model:value="form.name"
              :placeholder="$t('placeholder.dns.record.name')"
              v-focus="true" />
          </a-form-item>

          <a-form-item name="type" ref="type">
            <template #label>
              <tooltip-label
                :title="$t('label.type')"
                :tooltip="$t('label.dns.record.type.tooltip')" />
            </template>
            <a-select
              v-model:value="form.type"
              :disabled="jobLoading || !!jobId"
              :placeholder="$t('placeholder.dns.record.type')"
              showSearch>
              <a-select-option
                v-for="rtype in recordTypes"
                :key="rtype"
                :value="rtype">
                {{ rtype }}
              </a-select-option>
            </a-select>
          </a-form-item>

          <a-form-item name="contents" ref="contents">
            <template #label>
              <tooltip-label
                :title="$t('label.contents')"
                :tooltip="$t('label.dns.record.contents.tooltip')" />
            </template>
            <a-textarea
              v-model:value="form.contents"
              :placeholder="$t('message.dns.record.one.value.per.line')"
              :auto-size="{ minRows: 2, maxRows: 6 }" />
          </a-form-item>

          <a-form-item name="ttl" ref="ttl">
            <template #label>
              <tooltip-label
                :title="$t('label.ttl')"
                :tooltip="$t('label.dns.record.ttl.tooltip')" />
            </template>
            <a-input-number
              v-model:value="form.ttl"
              :min="1"
              :max="2147483647"
              style="width: 100%" />
          </a-form-item>
        </fieldset>

        <MoldDialogActions :busy="jobLoading">
          <a-button :disabled="jobLoading" @click="$emit('close-action')">
            {{ $t('label.cancel') }}
          </a-button>
          <a-button
            type="primary"
            :loading="jobLoading"
            :disabled="jobTracking === 'unconfirmed'"
            @click="handleSubmit">
            {{ $t(jobId ? 'label.dns.job.recheck' : 'label.ok') }}
          </a-button>
        </MoldDialogActions>
      </a-form>
    </a-spin>
  </div>
</template>

<script>
import { dnsJob } from './dnsJob'
import MoldDialogActions from '@/components/view/MoldDialogActions'
import TooltipLabel from '@/components/widgets/TooltipLabel'

export default {
  name: 'CreateDnsRecord',
  mixins: [dnsJob],
  components: {
    MoldDialogActions,
    TooltipLabel
  },
  props: {
    resource: {
      type: Object,
      required: true
    }
  },
  data () {
    return {
      form: {
        name: '',
        type: 'A',
        contents: '',
        ttl: 3600
      },
      rules: {},
      recordTypes: ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'SRV', 'PTR', 'NS']
    }
  },
  computed: {
    recordValues () { return this.form.contents.split(/\r?\n/).filter(value => value.trim()) },
    supportsStructuredContents () { return !!this.$getApiParams('createDnsRecord')?.contentsjson }
  },
  created () {
    this.rules = {
      name: [{ required: true, message: this.$t('message.error.required.input') }],
      type: [{ required: true, message: this.$t('message.error.required.input') }],
      contents: [{ required: true, validator: this.validateContents }],
      ttl: [
        { required: true, message: this.$t('message.error.required.input') },
        { type: 'number', validator: this.validateNumber }
      ]
    }
  },
  methods: {
    async handleSubmit () {
      if (!this.$store.getters.apis?.listDnsRecords || !this.$store.getters.apis?.createDnsRecord) return
      if (this.jobLoading || this.jobTracking === 'unconfirmed') return
      try {
        if (!this.jobId) await this.$refs.formRef.validate()
      } catch (error) {
        if (error.errorFields && error.errorFields.length > 0) {
          this.$refs.formRef.scrollToField(error.errorFields[0].name)
        }
        return
      }
      const params = {
        dnszoneid: this.resource.id,
        name: this.form.name,
        type: this.form.type,
        ...this.contentsParams(),
        ttl: this.form.ttl
      }
      return this.submitDnsJob('createDnsRecord', params, 'label.dns.create.record', params.name, () => {
        this.$emit('close-action', { saved: true })
      })
    },
    contentsParams () {
      return this.supportsStructuredContents
        ? { contentsjson: JSON.stringify(this.recordValues) }
        : { contents: this.recordValues.join(',') }
    },
    async validateContents () {
      if (!this.recordValues.length) throw new Error(this.$t('message.error.required.input'))
      if (!this.supportsStructuredContents && this.recordValues.some(value => value.includes(','))) {
        throw new Error(this.$t('message.dns.record.comma.unsupported'))
      }
    },
    async validateNumber (rule, value) {
      if (value && (isNaN(value) || value <= 0)) {
        return Promise.reject(this.$t('message.error.number'))
      }
      return Promise.resolve()
    }
  }
}
</script>

<style scoped>
.dns-form-fields { border: 0; padding: 0; min-width: 0; }
.dns-job-error { margin-bottom: 12px; }
</style>
