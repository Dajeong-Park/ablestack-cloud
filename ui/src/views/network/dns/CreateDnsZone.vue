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
          <a-form-item name="dnsserverid" ref="dnsserverid">
            <template #label>
              <tooltip-label
                :title="$t('label.dns.server')"
                :tooltip="apiParams.dnsserverid?.description" />
            </template>
            <a-select
              v-model:value="form.dnsserverid"
              :placeholder="$t('label.dns.server')"
              :loading="serverStatus === 'loading'"
              :disabled="serverStatus !== 'ready' || !!jobId"
              showSearch
              optionFilterProp="label">
              <a-select-option
                v-for="server in dnsServers"
                :key="server.id"
                :value="server.id"
                :label="server.name">
                {{ server.name }}
              </a-select-option>
            </a-select>
            <a-alert v-if="serverStatus === 'error'" type="error" show-icon :message="$t('error.fetching.data')">
              <template #description><a-button size="small" @click="fetchDnsServers">{{ $t('label.retry') }}</a-button></template>
            </a-alert>
            <a-alert v-else-if="serverStatus === 'empty'" type="info" show-icon :message="$t('message.dns.no.enabled.servers')" />
          </a-form-item>

          <a-form-item name="name" ref="name">
            <template #label>
              <tooltip-label
                :title="$t('label.name')"
                :tooltip="apiParams.name?.description" />
            </template>
            <a-input
              v-model:value="form.name"
              :placeholder="'example.com'"
              v-focus="true" />
          </a-form-item>

          <a-form-item name="description" ref="description">
            <template #label>
              <tooltip-label :title="$t('label.description')" :tooltip="apiParams.description?.description"/>
            </template>
            <a-input
              v-model:value="form.description"
              :placeholder="apiParams.description?.description"/>
          </a-form-item>

          <a-form-item name="type" :label="$t('label.type')">
            <a-select v-model:value="form.type" :disabled="jobLoading || !!jobId">
              <a-select-option value="Public">{{ $t('label.public') }}</a-select-option>
              <a-select-option value="Private">{{ $t('label.role.visibility.private') }}</a-select-option>
            </a-select>
          </a-form-item>

          <a-form-item name="existing" ref="existing">
            <template #label>
              <tooltip-label :title="$t('label.existing')" :tooltip="apiParams.existing?.description" />
            </template>
            <a-switch v-model:checked="form.existing" />
          </a-form-item>
        </fieldset>

        <MoldDialogActions :busy="jobLoading">
          <a-button :disabled="jobLoading" @click="closeAction">
            {{ $t('label.cancel') }}
          </a-button>
          <a-button
            type="primary"
            :loading="jobLoading"
            :disabled="jobTracking === 'unconfirmed' || (!jobId && !canSelectServer)"
            @click="handleSubmit">
            {{ $t(jobId ? 'label.dns.job.recheck' : 'label.ok') }}
          </a-button>
        </MoldDialogActions>
      </a-form>
    </a-spin>
  </div>
</template>

<script>
import { getAPI } from '@/api'
import { dnsJob } from './dnsJob'
import MoldDialogActions from '@/components/view/MoldDialogActions'
import TooltipLabel from '@/components/widgets/TooltipLabel'

export default {
  name: 'CreateDnsZone',
  mixins: [dnsJob],
  components: {
    MoldDialogActions,
    TooltipLabel
  },
  data () {
    return {
      apiParams: {},
      form: {
        name: '',
        dnsserverid: undefined,
        description: '',
        type: 'Public',
        existing: false
      },
      rules: {},
      serverStatus: 'loading',
      dnsServers: []
    }
  },
  computed: {
    canSelectServer () {
      return this.serverStatus === 'ready' && this.dnsServers.some(server => server.id === this.form.dnsserverid)
    }
  },
  created () {
    this.apiParams = this.$getApiParams('createDnsZone') || {}
    this.rules = {
      name: [{ required: true, message: this.$t('message.error.required.input') }],
      dnsserverid: [{ required: true, message: this.$t('message.error.required.input') }]
    }
    this.fetchDnsServers()
  },
  methods: {
    async handleSubmit () {
      if (!this.$store.getters.apis?.createDnsZone) return
      if (this.jobLoading || this.jobTracking === 'unconfirmed' || (!this.jobId && !this.canSelectServer)) return

      try {
        if (!this.jobId) await this.$refs.formRef.validate()
      } catch (error) {
        const field = error?.errorFields?.[0]?.name
        if (field) {
          this.$refs.formRef.scrollToField(field)
        }
        return
      }

      const params = {
        name: this.form.name.trim(),
        dnsserverid: this.form.dnsserverid,
        description: this.form.description?.trim(),
        type: this.form.type,
        existing: this.form.existing
      }
      return this.submitDnsJob('createDnsZone', params, 'label.dns.create.zone', params.name, () => {
        this.$emit('refresh-data')
        this.closeAction()
      })
    },
    closeAction () {
      this.$emit('close-action')
    },
    async fetchDnsServers () {
      this.serverStatus = 'loading'
      try {
        const response = await getAPI('listDnsServers', { pagesize: -1 }, { preserveOnFailure: true })
        const body = response?.listdnsserversresponse
        if (!body || body.errorcode) throw new Error('listDnsServers')
        this.dnsServers = (body.dnsserver || []).filter(server => server.state === 'Enabled')
        if (!this.dnsServers.some(server => server.id === this.form.dnsserverid)) this.form.dnsserverid = undefined
        this.serverStatus = this.dnsServers.length ? 'ready' : 'empty'
      } catch {
        this.serverStatus = 'error'
      }
    }
  }
}
</script>

<style scoped>
.dns-form-fields { border: 0; padding: 0; min-width: 0; }
.dns-job-error { margin-bottom: 12px; }
</style>
