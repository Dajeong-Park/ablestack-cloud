<!-- Licensed to the Apache Software Foundation (ASF) under one or more
contributor license agreements. See the NOTICE file distributed with this work
for additional information regarding copyright ownership. The ASF licenses this
file to you under the Apache License, Version 2.0 (the "License"); you may not use
this file except in compliance with the License. You may obtain a copy at
http://www.apache.org/licenses/LICENSE-2.0 . Unless required by applicable law or
agreed to in writing, software distributed under the License is distributed on
an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND. See the License
for the specific language governing permissions and limitations. -->
<template>
  <a-form layout="vertical" :model="form">
    <a-form-item
      v-for="field in fields"
      :key="field"
      :label="$t('label.' + field)"
      :html-for="'oauth-form-' + field">
      <a-input-password
        v-if="field === 'secretkey'"
        id="oauth-form-secretkey"
        v-model:value="form.secretkey"
        autocomplete="new-password"
        :disabled="busy"
        :placeholder="$t('message.oauth.secret.replace')"
        @keydown.enter.prevent="submit" />
      <a-input
        v-else
        :id="'oauth-form-' + field"
        v-model:value="form[field]"
        :disabled="busy"
        @keydown.enter.prevent="submit" />
    </a-form-item>
    <a-form-item :label="$t('label.scope')" html-for="oauth-form-scope">
      <a-select id="oauth-form-scope" v-model:value="form.scope" :disabled="busy" :options="scopes" />
    </a-form-item>
    <a-form-item
      v-if="form.scope === 'domain'"
      :label="$t('label.domain')"
      html-for="oauth-form-domain"
      :validate-status="domainError ? 'error' : undefined"
      :help="domainError ? $t(domainError) : undefined"
      required>
      <a-select
        id="oauth-form-domain"
        v-model:value="form.domainid"
        :options="domains"
        :loading="domainsPending"
        :disabled="busy"
        :filter-option="false"
        :placeholder="$t('label.ldap.domain.placeholder')"
        show-search
        @search="loadDomains" />
    </a-form-item>
    <a-alert v-if="message" type="error" role="alert" show-icon :message="$t(message)" />
    <mold-dialog-actions :busy="busy">
      <a-button @click="$emit('close-action')">{{ $t('label.cancel') }}</a-button>
      <a-button type="primary" :loading="busy" :disabled="!canSubmit" @click="submit">{{ $t('label.ok') }}</a-button>
    </mold-dialog-actions>
  </a-form>
</template>

<script>
import { getAPI, postAPI } from '@/api'
import MoldDialogActions from '@/components/view/MoldDialogActions'

const readOptions = { preserveOnFailure: true, timeout: 10000 }

export default {
  name: 'OAuthProviderForm',
  components: { MoldDialogActions },
  props: { currentAction: { type: Object, required: true } },
  emits: ['close-action', 'refresh-data'],
  data () {
    const target = this.currentAction.oauthTarget
    return {
      form: {
        description: target.description || '',
        clientid: target.clientid || '',
        redirecturi: target.redirecturi || '',
        secretkey: '',
        authorizeurl: target.authorizeurl || '',
        tokenurl: target.tokenurl || '',
        scope: 'keep',
        domainid: target.domainid
      },
      domains: [],
      domainsPending: false,
      domainVersion: 0,
      domainError: '',
      message: '',
      busy: false
    }
  },
  computed: {
    fields () {
      const fields = ['description', 'clientid', 'redirecturi', 'secretkey']
      if (this.currentAction.oauthTarget.provider === 'keycloak') fields.push('authorizeurl', 'tokenurl')
      return fields
    },
    canReadDomains () { return 'listDomains' in this.$store.getters.apis },
    canSubmit () { return this.currentAction.api in this.$store.getters.apis },
    scopes () {
      return [
        { value: 'keep', label: this.$t('label.oauth.scope.keep') },
        { value: 'global', label: this.$t('label.global'), disabled: !this.canReadDomains },
        { value: 'domain', label: this.$t('label.domain'), disabled: !this.canReadDomains }
      ]
    }
  },
  watch: {
    'form.scope' (scope) {
      this.domainError = ''
      this.message = ''
      if (scope === 'domain') this.loadDomains()
      else {
        this.domainVersion++
        this.domainsPending = false
      }
    },
    'form.domainid' () { this.domainError = ''; this.message = '' }
  },
  beforeUnmount () { this.domainVersion++ },
  methods: {
    async loadDomains (keyword) {
      const version = ++this.domainVersion
      this.domainsPending = true
      try {
        const result = await getAPI('listDomains', { listall: true, details: 'min', keyword: keyword || undefined, page: 1, pagesize: 20 }, readOptions)
        const domains = (result.listdomainsresponse?.domain || []).filter(row => row.name !== 'ROOT')
        if (this.form.domainid && !domains.some(row => row.id === this.form.domainid) && !keyword) {
          const selected = await getAPI('listDomains', { id: this.form.domainid, details: 'min' }, readOptions)
          domains.unshift(...(selected.listdomainsresponse?.domain || []))
        }
        if (version === this.domainVersion) this.domains = domains.map(row => ({ value: row.id, label: row.path || row.name || row.id }))
      } catch {
        if (version === this.domainVersion) this.message = 'message.ldap.domain.failed'
      } finally {
        if (version === this.domainVersion) this.domainsPending = false
      }
    },
    async submit (event) {
      const { api, oauthTarget, oauthCurrent } = this.currentAction
      if (event?.repeat || this.busy || !this.canSubmit || !oauthCurrent()) return
      const { scope, domainid } = this.form
      if (scope === 'domain' && !domainid) {
        this.domainError = 'message.oauth.domain.required'
        return
      }
      this.message = ''
      this.busy = true
      try {
        const params = { id: oauthTarget.id }
        for (const field of this.fields) {
          const value = this.form[field].trim()
          if (value) params[field] = value
        }
        if (scope === 'domain') params.domainid = domainid
        if (scope === 'global' && oauthTarget.domainid) {
          const result = await getAPI('listDomains', { name: 'ROOT', details: 'min' }, readOptions)
          const root = result.listdomainsresponse?.domain?.find(row => row.name === 'ROOT')
          if (!root?.id) {
            if (oauthCurrent()) this.message = 'message.ldap.domain.failed'
            return
          }
          params.domainid = root.id
        }
        if (!oauthCurrent() || !this.canSubmit) return
        await postAPI(api, params, { preserveOnFailure: true, timeout: 25000 })
        if (!oauthCurrent()) return
        this.$message.success(this.$t('message.oauth.saved'))
        this.$emit('close-action')
        this.$emit('refresh-data', { irefresh: true })
      } catch (error) {
        if (!oauthCurrent()) return
        const message = Object.values(error.response?.data || {}).find(row => row?.errortext)?.errortext || ''
        this.message = /already registered/i.test(message) ? 'message.oauth.scope.duplicate' : 'message.oauth.save.failed'
      } finally {
        this.busy = false
      }
    }
  }
}
</script>
