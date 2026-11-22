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
    :title="$t(currentAction.label)"
    :visible="!closed"
    :closable="!busy"
    :keyboard="!busy"
    :after-close="finishClose"
    size="md"
    form-actions
    @cancel="close">
    <a-alert :message="$t(currentAction.message)" type="warning" show-icon />
    <a-alert v-if="!allowed" :message="$t('message.account.action.scope.changed')" type="warning" show-icon />
    <ul class="account-state-targets">
      <li v-for="item in entries" :key="item.row.id">
        <strong>{{ item.row.name }}</strong>
        <span> · {{ item.row.domainpath || item.row.domain || item.row.domainid }}</span>
        <span> · {{ $t('label.' + item.row.state) }}</span>
        <a-tag>{{ $t('label.account.action.' + item.status) }}</a-tag>
        <p v-if="item.detail">{{ item.detail }}</p>
      </li>
    </ul>
    <MoldDialogActions :busy="busy">
      <a-button :disabled="busy" @click="close">{{ $t(attempted ? 'label.close' : 'label.cancel') }}</a-button>
      <a-button v-if="!attempted" type="primary" :loading="busy" :disabled="!allowed || !canSubmit" @click="submit">
        {{ $t('label.ok') }}
      </a-button>
    </MoldDialogActions>
  </MoldDialog>
</template>

<script>
import { getAPI, postAPI } from '@/api'
import MoldDialog from '@/components/view/MoldDialog'
import MoldDialogActions from '@/components/view/MoldDialogActions'
import { accountTransitionAllowed } from '@/utils/accountState'
import { createJobTracker } from '@/utils/jobTracker'

export default {
  name: 'AccountStateDialog',
  inheritAttrs: false,
  components: { MoldDialog, MoldDialogActions },
  props: { currentAction: { type: Object, required: true } },
  emits: ['close-action'],
  data () {
    return {
      attempted: false,
      busy: false,
      closed: false,
      entries: this.currentAction.accountTargets.map(row => {
        const allowed = accountTransitionAllowed(this.currentAction, row, this.$store.getters)
        return { row, status: allowed ? 'ready' : 'skipped', detail: allowed ? '' : this.$t('message.account.action.unavailable') }
      })
    }
  },
  computed: {
    allowed () { return !this.closed && this.currentAction.accountCurrent() },
    blocksNavigation () { return this.busy && this.allowed },
    canSubmit () { return this.entries.some(item => item.status === 'ready') }
  },
  created () {
    this.tracker = createJobTracker({
      query: async jobid => (await getAPI('queryAsyncJobResult', { jobid }, { backgroundJob: true, preserveOnFailure: true })).queryasyncjobresultresponse,
      onState: () => {},
      maxDuration: 120000
    })
  },
  beforeUnmount () { this.tracker.clear() },
  methods: {
    close () { if (!this.busy) this.closed = true },
    finishClose () { this.$emit('close-action', { refreshAccountList: this.attempted }) },
    async submit () {
      if (!this.allowed || this.busy || !this.canSubmit) return
      this.attempted = true
      this.busy = true
      try {
        await Promise.all(this.entries.filter(item => item.status === 'ready').map(item => this.submitTarget(item)))
      } finally {
        this.busy = false
      }
    },
    async submitTarget (item) {
      item.status = 'working'
      const { currentAction } = this
      const id = item.row.id
      try {
        const response = await getAPI('listAccounts', { id, listall: true }, { preserveOnFailure: true })
        const record = response.listaccountsresponse?.account?.find(account => account.id === id)
        if (!this.allowed || record?.domainid !== item.row.domainid ||
            !accountTransitionAllowed(currentAction, record, this.$store.getters)) {
          item.status = 'skipped'
          item.detail = this.$t('message.account.action.unavailable')
          return
        }
        const params = currentAction.api === 'disableAccount' ? { id, lock: currentAction.accountState === 'locked' } : { id }
        const request = await postAPI(currentAction.api, params, { preserveOnFailure: true })
        const responseKey = currentAction.api.toLowerCase() + 'response'
        const jobid = request[responseKey]?.jobid
        if (!this.allowed) {
          item.status = 'unknown'
          return
        }
        if (!jobid && currentAction.api === 'enableAccount') {
          const verified = await getAPI('listAccounts', { id, listall: true }, { preserveOnFailure: true })
          const enabled = verified.listaccountsresponse?.account?.some(account => account.id === id && account.state === 'enabled')
          item.status = this.allowed && enabled ? 'success' : 'unknown'
          return
        }
        if (!jobid) {
          item.status = 'unknown'
          return
        }
        const result = await this.tracker.track(jobid)
        item.status = { 1: 'success', 2: 'failed' }[result.jobstatus] || 'unknown'
        item.detail = result.jobresult?.errortext || ''
      } catch (error) {
        item.status = error.response ? 'failed' : 'unknown'
        item.detail = Object.values(error.response?.data || {}).find(value => value?.errortext)?.errortext || ''
      }
    }
  }
}
</script>

<style scoped>
.account-state-targets { padding: 12px 0 0; list-style: none; }
.account-state-targets li + li { margin-top: 8px; }
.account-state-targets .ant-tag { margin-inline-start: 8px; }
</style>
