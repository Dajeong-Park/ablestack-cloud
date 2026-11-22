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
    :title="$t('label.action.delete.domain') + ': ' + domain.name"
    size="md"
    form-actions
    focus-guard
    @cancel="emitClose">

    <a-alert
      type="warning"
      show-icon
      style="margin-bottom: 16px">
      <template #message>
        <div v-html="$t('message.delete.domain.warning')"></div>
      </template>
    </a-alert>

    <a-alert v-if="impactError || deletionError" type="error" show-icon :message="deletionError || impactError" style="margin-bottom: 16px">
      <template v-if="impactError" #description><a-button :disabled="deleting" @click="fetchDomainImpact">{{ $t('label.retry') }}</a-button></template>
    </a-alert>
    <a-spin v-if="loading" />

    <a-table
      v-else
      size="small"
      :columns="columns"
      :dataSource="accountVmSummary"
      :pagination="false"
      rowKey="account" />

    <div style="margin-top: 16px">
      <a-alert style="margin-bottom: 10px">
        <template #message>
          <div v-html="$t('message.delete.domain.confirm')"></div>
        </template>
      </a-alert>
      <a-input
        v-model:value="confirmText"
        :disabled="loading || deleting"
        :placeholder="$t('label.enter.domain.name')"
        @press-enter="emitConfirm" />
    </div>

    <MoldDialogActions :busy="deleting">
      <a-button :disabled="deleting" @click="emitClose">{{ $t('label.cancel') }}</a-button>
      <a-button type="primary" danger :disabled="!canDelete" :loading="deleting" @click="emitConfirm">{{ $t('label.delete.domain') }}</a-button>
    </MoldDialogActions>
  </MoldDialog>
</template>

<script>
import { getAPI } from '@/api'
import MoldDialog from '@/components/view/MoldDialog'
import MoldDialogActions from '@/components/view/MoldDialogActions'

export default {
  name: 'DomainDeleteConfirm',
  components: { MoldDialog, MoldDialogActions },
  props: {
    deleting: Boolean,
    deletionError: { type: String, default: '' },
    domain: {
      type: Object,
      required: true
    }
  },
  data () {
    return {
      loading: false,
      confirmText: '',
      accountVmSummary: [],
      impactReady: false,
      impactError: '',
      requestGeneration: 0,
      requestAbort: null,
      closed: false
    }
  },
  computed: {
    impactScope () { return JSON.stringify([this.domain.id, this.$store.state?.user?.token, this.$store.getters.userInfo?.id, this.$store.getters.userInfo?.roleid, this.$store.getters.project?.id]) },
    canDelete () {
      return !this.closed && !this.loading && !this.deleting && this.impactReady &&
        !!this.domain.name?.trim() && this.confirmText.trim() === this.domain.name.trim()
    },
    columns () {
      return [
        { title: this.$t('label.account'), dataIndex: 'account' },
        { title: this.$t('label.total') + ' VMs', dataIndex: 'total' },
        { title: this.$t('label.running') + ' VMs', dataIndex: 'running' },
        { title: this.$t('label.stopped') + ' VMs', dataIndex: 'stopped' }
      ]
    }
  },
  watch: { impactScope () { this.confirmText = ''; this.fetchDomainImpact() } },
  mounted () { this.fetchDomainImpact() },
  beforeUnmount () { this.closed = true; this.cancelImpact() },
  methods: {
    cancelImpact () { this.requestGeneration++; if (this.requestAbort) this.requestAbort.abort(); this.requestAbort = null; this.loading = false; this.impactReady = false },
    emitClose () {
      if (this.deleting) return
      this.closed = true; this.cancelImpact()
      this.$emit('close')
    },
    emitConfirm () {
      if (this.canDelete) {
        this.$emit('confirm')
      }
    },
    async fetchDomainImpact () {
      if (this.closed || this.deleting) return
      this.cancelImpact()
      const generation = this.requestGeneration; const scope = this.impactScope; const domainid = this.domain.id
      const current = () => !this.closed && generation === this.requestGeneration && scope === this.impactScope
      this.requestAbort = new AbortController()
      const options = { preserveOnFailure: true, timeout: 20000, signal: this.requestAbort.signal }
      this.loading = true; this.impactError = ''; this.accountVmSummary = []
      try {
        const accResp = await getAPI('listAccounts', {
          domainid,
          listall: true
        }, options)
        if (!current()) return

        const accounts =
          accResp.listaccountsresponse &&
          accResp.listaccountsresponse.account
            ? accResp.listaccountsresponse.account
            : []

        const vmResp = await getAPI('listVirtualMachines', {
          domainid,
          listall: true
        }, options)
        if (!current()) return

        const vms =
          vmResp.listvirtualmachinesresponse &&
          vmResp.listvirtualmachinesresponse.virtualmachine
            ? vmResp.listvirtualmachinesresponse.virtualmachine
            : []

        if (!accResp.listaccountsresponse || !vmResp.listvirtualmachinesresponse || !Array.isArray(accounts) || !Array.isArray(vms)) throw new Error('Invalid domain impact response')
        this.accountVmSummary = accounts.map(account => {
          const accountVms = vms.filter(vm => vm.account === account.name)
          const running = accountVms.filter(vm => vm.state === 'Running').length
          const stopped = accountVms.length - running

          return {
            account: account.name,
            total: accountVms.length,
            running,
            stopped
          }
        })
        this.impactReady = true
      } catch (e) {
        if (current()) this.impactError = this.$t('message.request.failed')
      } finally {
        if (current()) this.loading = false
      }
    }
  }
}
</script>

<style scoped>
</style>
