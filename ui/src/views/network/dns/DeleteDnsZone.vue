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
      <div style="margin-bottom: 20px;">
        <a-alert type="warning">
          <template #message>
            <div v-html="$t('message.action.delete.dns.zone')"></div>
          </template>
        </a-alert>
      </div>

      <p v-if="resource.associatednetworks?.length || resource.networkname">
        {{ $t('message.dns.zone.delete.networks', { networks: resource.associatednetworks?.map(network => network.networkname).join(', ') || resource.networkname }) }}
      </p>
      <div style="margin-bottom: 20px; word-break: break-all;">
        Please type <strong>{{ resource.name }}</strong> to confirm.
      </div>

      <a-form
        ref="formRef"
        :model="form"
        :rules="rules"
        layout="vertical"
        @finish="handleSubmit">

        <fieldset class="dns-form-fields" :disabled="jobLoading || !!jobId || jobTracking === 'unconfirmed'">
          <a-form-item name="name" ref="name">
            <a-input
              v-model:value="form.name"
              :placeholder="resource.name"
              v-focus="true" />
          </a-form-item>

          <a-form-item name="unmanage" ref="unmanage">
            <template #label>
              <tooltip-label :title="$t('label.dns.unmanage.zone')" :tooltip="apiParams.unmanage?.description" />
            </template>
            <a-switch v-model:checked="form.unmanage" />
          </a-form-item>
        </fieldset>

        <div class="action-button">
          <a-button :disabled="jobLoading" @click="closeAction">
            {{ $t('label.cancel') }}
          </a-button>
          <a-button
            type="primary"
            danger
            :disabled="jobTracking === 'unconfirmed' || (!jobId && form.name !== resource.name)"
            :loading="jobLoading"
            @click="handleSubmit">
            {{ $t(jobId ? 'label.dns.job.recheck' : 'label.delete') }}
          </a-button>
        </div>
      </a-form>
    </a-spin>
  </div>
</template>

<script>
import { dnsZoneListQuery } from '@/utils/dnsZone'
import { dnsJob } from './dnsJob'
import TooltipLabel from '@/components/widgets/TooltipLabel'

export default {
  name: 'DeleteDnsZone',
  mixins: [dnsJob],
  components: {
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
      apiParams: {},
      form: {
        name: '',
        unmanage: false
      },
      rules: {
        name: [{ required: true, message: this.$t('message.error.required.input') }]
      }
    }
  },
  created () {
    this.apiParams = this.$getApiParams('deleteDnsZone') || {}
  },
  methods: {
    async handleSubmit () {
      if (this.jobLoading || this.jobTracking === 'unconfirmed' || (!this.jobId && this.form.name !== this.resource.name)) return

      const params = { id: this.resource.id, unmanage: this.form.unmanage }
      return this.submitDnsJob('deleteDnsZone', params, 'label.dns.delete.zone', this.resource.name, () => {
        this.closeAction()
        if (this.$route.params.id === params.id) {
          this.$router.push({ path: '/dnszone', query: dnsZoneListQuery(this.$route.query) })
        } else {
          this.$emit('refresh-data')
        }
      })
    },
    closeAction () {
      this.$emit('close-action')
    }
  }
}
</script>

<style lang="less" scoped>
.form-layout {
  width: 80vw;
  @media (min-width: 600px) {
    width: 450px;
  }
}

.dns-form-fields { border: 0; padding: 0; min-width: 0; }
.dns-job-error { margin-bottom: 12px; }
.action-button {
  text-align: right;
  margin-top: 20px;
}
.action-button button {
  margin-left: 8px;
}
</style>
