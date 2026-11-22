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
  <MoldDialog
    :title="$t('label.action.update.resource.count')"
    size="sm"
    form-actions
    focus-guard
    @cancel="$emit('close')">
    <a-alert
      :type="result === null ? 'info' : 'success'"
      show-icon
      :message="$t('message.domain.count.scope', { path: resource.path || resource.name })"
      :description="result === null ? $t('message.update.resource.count.domain') : $t('message.domain.count.done', { count: result.length })" />
    <a-form v-if="result === null" :model="form" layout="vertical" class="domain-count-form" @finish="submit">
      <a-form-item :label="$t('label.resourcetype')" name="type">
        <a-select
          v-model:value="form.type"
          :aria-label="$t('label.resourcetype')"
          :options="typeOptions"
          :loading="loadingTypes"
          :disabled="busy" />
      </a-form-item>
    </a-form>
    <a-alert v-if="typeError" type="warning" :message="typeError">
      <template #description><a-button size="small" @click="loadTypes">{{ $t('label.retry') }}</a-button></template>
    </a-alert>
    <a-alert v-if="error" type="error" show-icon :message="error" />
    <ul v-if="result?.length" class="domain-count-result">
      <li v-for="item in result" :key="item.resourcetype">
        {{ typeOptions.find(option => option.value === String(item.resourcetype))?.label || item.resourcetypename }} · {{ item.resourcecount }}
      </li>
    </ul>
    <MoldDialogActions :busy="busy">
      <a-button :disabled="busy" @click="$emit('close')">{{ $t(result === null ? 'label.cancel' : 'label.close') }}</a-button>
      <a-button v-if="result === null" type="primary" :loading="busy" @click="submit">{{ $t('label.ok') }}</a-button>
    </MoldDialogActions>
  </MoldDialog>
</template>

<script>
import { getAPI, postAPI } from '@/api'
import MoldDialog from '@/components/view/MoldDialog'
import MoldDialogActions from '@/components/view/MoldDialogActions'

export default {
  name: 'DomainResourceCount',
  components: { MoldDialog, MoldDialogActions },
  props: { resource: { type: Object, required: true } },
  emits: ['close', 'refresh'],
  data () {
    return { form: { type: 'all' }, types: [], result: null, loadingTypes: false, busy: false, error: '', typeError: '' }
  },
  computed: {
    typeOptions () {
      return [
        { value: 'all', label: this.$t('label.all') },
        ...this.types.map(item => ({
          value: String(item.resourcetype),
          label: this.$t(item.resourcetypename === 'backup' ? 'label.maxbackups' : 'label.max' + item.resourcetypename.replace('_', ''))
        }))
      ]
    }
  },
  created () { this.loadTypes() },
  methods: {
    async loadTypes () {
      if (!('listResourceLimits' in this.$store.getters.apis) || this.loadingTypes) return
      this.loadingTypes = true
      this.typeError = ''
      try {
        const response = await getAPI('listResourceLimits', { domainid: this.resource.id }, { preserveOnFailure: true })
        this.types = (response.listresourcelimitsresponse?.resourcelimit || []).filter(item => !item.tag && item.resourcetypename)
      } catch (error) {
        this.typeError = this.$t('message.request.failed')
      } finally {
        this.loadingTypes = false
      }
    },
    async submit () {
      if (this.busy || this.result !== null || !this.resource.id) return
      this.busy = true
      this.error = ''
      const params = { domainid: this.resource.id }
      if (this.form.type !== 'all') params.resourcetype = this.form.type
      try {
        const response = await postAPI('updateResourceCount', params, { preserveOnFailure: true })
        this.result = response.updateresourcecountresponse?.resourcecount || []
        this.$emit('refresh')
      } catch (error) {
        this.error = Object.values(error.response?.data || {}).find(value => value?.errortext)?.errortext ||
          error.response?.headers?.['x-description'] || this.$t('message.request.failed')
      } finally {
        this.busy = false
      }
    }
  }
}
</script>

<style scoped>
.domain-count-form, .domain-count-result { margin-top: 16px; }
</style>
