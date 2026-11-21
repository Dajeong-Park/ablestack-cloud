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
  <a-alert
    :type="result === null ? 'info' : 'success'"
    show-icon
    :message="$t('message.account.count.scope', { account: resource.name, domain: resource.domainpath || resource.domain })"
    :description="result === null ? $t('message.update.resource.count') : $t('message.account.count.result', { count: result })" />
  <a-alert v-if="error" type="error" show-icon :message="error" />
  <MoldDialogActions :busy="busy">
    <a-button :disabled="busy" @click="$emit('close-action')">{{ $t(result === null ? 'label.cancel' : 'label.close') }}</a-button>
    <a-button v-if="result === null" type="primary" :loading="busy" @click="submit">{{ $t('label.ok') }}</a-button>
  </MoldDialogActions>
</template>

<script>
import MoldDialogActions from '@/components/view/MoldDialogActions'
import { postAPI } from '@/api'

export default {
  components: { MoldDialogActions },
  name: 'AccountResourceCount',
  props: { resource: { type: Object, required: true } },
  emits: ['refresh-data', 'close-action'],
  data () { return { busy: false, error: '', result: null } },
  activated () { this.result = null; this.error = '' },
  methods: {
    async submit () {
      const { id, name: account, domainid, state } = this.resource
      if (this.busy || state !== 'enabled' || !id || !account || !domainid) return
      this.busy = true
      this.error = ''
      try {
        const response = await postAPI('updateResourceCount', { account, domainid }, { preserveOnFailure: true })
        this.result = response.updateresourcecountresponse?.resourcecount?.length || 0
        this.$emit('refresh-data')
      } catch (error) {
        this.error = Object.values(error.response?.data || {}).find(item => item?.errortext)?.errortext || this.$t('message.request.failed')
      } finally {
        this.busy = false
      }
    }
  }
}
</script>
