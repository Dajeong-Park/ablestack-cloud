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
    <a-spin :spinning="loading">
      <a-form
        ref="formRef"
        :model="form"
        :rules="rules"
        layout="vertical"
        @finish="handleSubmit">

        <a-form-item name="name" ref="name">
          <template #label>
            <tooltip-label
              :title="$t('label.name')"
              :tooltip="apiParams.name?.description" />
          </template>
          <a-input
            v-model:value="form.name"
            :placeholder="apiParams.name?.description"
            v-focus="true" />
        </a-form-item>

        <a-form-item name="url" ref="url">
          <template #label>
            <tooltip-label
              :title="$t('label.url')"
              :tooltip="apiParams.url?.description" />
          </template>
          <a-input
            v-model:value="form.url"
            :placeholder="apiParams.url?.description" />
        </a-form-item>

        <a-form-item name="provider" ref="provider">
          <template #label>
            <tooltip-label
              :title="$t('label.provider')"
              :tooltip="apiParams.provider?.description" />
          </template>
          <a-select
            v-model:value="form.provider"
            :placeholder="$t('label.provider')"
            :loading="providerStatus === 'loading'"
            :disabled="providerStatus !== 'ready'"
            showSearch>
            <a-select-option
              v-for="provider in providers"
              :key="provider.name"
              :value="provider.name">
              {{ provider.description || provider.name }}
            </a-select-option>
          </a-select>
          <a-alert v-if="providerStatus === 'error'" class="provider-status" type="error" show-icon :message="$t('message.dns.provider.load.failed')">
            <template #description><a-button size="small" @click="fetchProviders">{{ $t('label.retry') }}</a-button></template>
          </a-alert>
          <a-alert v-else-if="providerStatus === 'empty'" class="provider-status" type="info" show-icon :message="$t('message.dns.provider.empty')" />
        </a-form-item>

        <a-form-item name="port" ref="port">
          <template #label>
            <tooltip-label
              :title="$t('label.port')"
              :tooltip="apiParams.port?.description" />
          </template>
          <a-input-number
            v-model:value="form.port"
            :min="1"
            :max="65535"
            style="width: 100%" />
        </a-form-item>

        <a-form-item name="dnsapikey" ref="dnsapikey">
          <template #label>
            <tooltip-label
              :title="$t('label.dns.dnsapikey')"
              :tooltip="apiParams.dnsapikey?.description" />
          </template>
          <a-input-password
            v-model:value="form.dnsapikey"
            :placeholder="$t('label.dns.dnsapikey')" />
        </a-form-item>

        <a-form-item v-if="form.provider === 'PowerDNS'" name="pdnsserverid" ref="pdnsserverid">
          <template #label>
            <tooltip-label
              :title="$t('label.dns.pdnsserverid')"
              :tooltip="'PowerDNS Server ID'" />
          </template>
          <a-input
            v-model:value="form.pdnsserverid"
            :placeholder="$t('message.dns.provider.server.id.placeholder')" />
        </a-form-item>

        <Transition name="slide-down">
          <a-form-item v-if="isAdminOrDomainAdmin() && form.ispublic" name="publicdomainsuffix" ref="publicdomainsuffix">
            <template #label>
              <tooltip-label
                :title="$t('label.dns.publicdomainsuffix')"
                :tooltip="apiParams.publicdomainsuffix?.description" />
            </template>
            <a-input
              v-model:value="form.publicdomainsuffix"
              :placeholder="'example.com'" />
          </a-form-item>
        </Transition>

        <a-form-item name="nameservers" ref="nameservers">
          <template #label>
            <tooltip-label
              :title="$t('label.nameservers')"
              :tooltip="apiParams.nameservers?.description" />
          </template>

          <a-select
            v-model:value="form.nameservers"
            mode="tags"
            style="width: 100%"
            :token-separators="[',', ' ']"
            :placeholder="apiParams.nameservers?.description"
            @change="onNameserversChange" />
        </a-form-item>

        <a-form-item v-if="isAdminOrDomainAdmin()" name="ispublic" ref="ispublic">
          <template #label>
            <tooltip-label :title="$t('label.ispublic')" :tooltip="apiParams.ispublic?.description" />
          </template>
          <a-switch v-model:checked="form.ispublic" />
        </a-form-item>

        <MoldDialogActions :busy="loading">
          <a-button @click="closeAction">
            {{ $t('label.cancel') }}
          </a-button>
          <a-button
            type="primary"
            :loading="loading"
            :disabled="!providerSelected"
            @click="handleSubmit">
            {{ $t('label.ok') }}
          </a-button>
        </MoldDialogActions>
      </a-form>
    </a-spin>
  </div>
</template>

<script>
import { getAPI, postAPI } from '@/api'
import { dnsNameserverError, normalizeDnsNameservers } from '@/utils/dnsServer'
import MoldDialogActions from '@/components/view/MoldDialogActions'
import TooltipLabel from '@/components/widgets/TooltipLabel'

const FQDN_REGEX = /^(?=.{1,253}$)(?:(?!-)[A-Za-z0-9-]{1,63}(?<!-)\.)+[A-Za-z]{2,63}$/

export default {
  name: 'AddDnsServer',
  components: {
    MoldDialogActions,
    TooltipLabel
  },
  data () {
    return {
      loading: false,
      apiParams: {},
      form: {
        name: '',
        url: '',
        provider: '',
        port: 8081,
        nameservers: [],
        ispublic: false,
        publicdomainsuffix: '',
        pdnsserverid: ''
      },
      rules: {},
      providerStatus: 'loading',
      providers: []
    }
  },
  computed: {
    providerSelected () {
      return this.providerStatus === 'ready' && this.providers.some(provider => provider.name === this.form.provider)
    }
  },
  created () {
    this.apiParams = this.$getApiParams('addDnsServer') || {}
    this.rules = {
      name: [{ required: true, message: this.$t('message.error.required.input') }],
      url: [
        { required: true, message: this.$t('message.error.required.input') },
        { validator: this.validateUrl }
      ],
      port: [
        { required: true, message: this.$t('message.error.required.input') },
        { validator: this.validatePort }
      ],
      provider: [{ required: true, message: this.$t('message.error.required.input') }],
      dnsapikey: [{ required: true, message: this.$t('message.error.required.input') }],
      nameservers: [
        { required: true, type: 'array', min: 1, message: this.$t('message.error.required.input') },
        { validator: this.validateNameservers }
      ]
    }
    if (this.isAdminOrDomainAdmin()) {
      this.rules.publicdomainsuffix = [{
        required: true,
        validator: this.validatePublicDomainSuffix
      }]
    }
    this.fetchProviders()
  },
  methods: {
    async handleSubmit () {
      if (this.loading || !this.providerSelected || !this.$store.getters.apis?.addDnsServer) return
      try {
        await this.$refs.formRef.validate()
      } catch (error) {
        if (error.errorFields && error.errorFields.length > 0) {
          this.$refs.formRef.scrollToField(error.errorFields[0].name)
        }
        return
      }
      this.loading = true
      try {
        const params = {
          name: this.form.name.trim(),
          url: this.form.url?.trim().replace(/\/+$/, ''),
          port: this.form.port,
          provider: this.form.provider,
          dnsapikey: this.form.dnsapikey?.trim(),
          nameservers: normalizeDnsNameservers(this.form.nameservers),
          ispublic: this.form.ispublic
        }
        if (this.form.publicdomainsuffix) {
          params.publicdomainsuffix = this.form.publicdomainsuffix?.toLowerCase().trim()
        }
        if (this.form.pdnsserverid) {
          params['details[0].pdnsServerId'] = this.form.pdnsserverid?.trim()
        }
        const response = await postAPI('addDnsServer', params, { preserveOnFailure: true })
        const serverData = response?.adddnsserverresponse?.dnsserver || response?.adddnsserverresponse
        if (!serverData?.id) {
          this.$notification.error({
            message: this.$t('message.request.failed'),
            description: this.$t('error.fetching.data'),
            duration: 0
          })
          this.loading = false
          return
        }
        this.$notification.success({
          message: this.$t('label.dns.add.server'),
          description: `${this.$t('message.success.add.dns.server')} ${params.name}`
        })
        this.loading = false
        this.$emit('refresh-data')
        this.closeAction()
      } catch (error) {
        this.$notification.error({
          message: this.$t('message.request.failed'),
          description: error?.response?.headers['x-description'] || error.message,
          duration: 0
        })
        this.loading = false
      }
    },
    closeAction () {
      this.$emit('close-action')
    },
    async fetchProviders () {
      this.providerStatus = 'loading'
      try {
        const response = await getAPI('listDnsProviders', { pagesize: -1 }, { preserveOnFailure: true })
        const body = response?.listdnsprovidersresponse
        if (!body || body.errorcode) throw new Error('Invalid DNS provider response')
        this.providers = (body.dnsprovider || []).filter(provider => typeof provider.name === 'string' && provider.name)
        if (!this.providers.some(provider => provider.name === this.form.provider)) {
          this.form.provider = this.providers[0]?.name ?? ''
        }
        this.providerStatus = this.providers.length ? 'ready' : 'empty'
      } catch {
        this.providerStatus = 'error'
      }
    },
    validateUrl (rule, value) {
      if (!value) return Promise.resolve()
      try {
        const parsed = new URL(value)
        if (!['http:', 'https:'].includes(parsed.protocol)) {
          return Promise.reject(new Error(this.$t('message.dns.server.url.protocol')))
        }
        if (parsed.port) {
          return Promise.reject(new Error(this.$t('message.dns.server.url.port')))
        }
      } catch (e) {
        return Promise.reject(new Error(this.$t('message.dns.server.url.invalid')))
      }
      return Promise.resolve()
    },
    validatePort (rule, value) {
      if (value === undefined || value === null) {
        return Promise.resolve()
      }

      if (value < 1 || value > 65535) {
        return Promise.reject(new Error(this.$t('message.dns.server.port.invalid')))
      }

      return Promise.resolve()
    },
    async validateNameservers (rule, value) {
      const error = dnsNameserverError(value)
      if (error) throw new Error(this.$t(error))
    },
    validatePublicDomainSuffix (rule, value) {
      const normalized = value?.toLowerCase().trim()
      if (!normalized) {
        return Promise.reject(new Error(this.$t('message.error.required.input')))
      }
      if (!FQDN_REGEX.test(normalized)) {
        return Promise.reject(new Error(this.$t('message.dns.server.suffix.invalid')))
      }

      return Promise.resolve()
    },
    isAdminOrDomainAdmin () {
      return ['Admin', 'DomainAdmin'].includes(this.$store.getters.userInfo.roletype)
    },
    onNameserversChange (value) {
      this.form.nameservers = (value || [])
        .map(ns => ns?.toLowerCase().trim())
        .filter(Boolean)
    }
  }
}
</script>

<style scoped>
.provider-status { margin-top: 8px; }
</style>
