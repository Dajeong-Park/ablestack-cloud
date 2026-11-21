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
    class="vpn-customer-gateway-delete"
    :title="$t(currentAction.label)"
    :doc-help="currentAction.docHelp"
    size="md"
    focus-guard
    :closable="!running"
    :keyboard="!running"
    :after-close="afterClose"
    :focus-trigger-after-close="false"
    @cancel="close">
    <p>{{ $t('message.delete.vpn.customer.gateway') }}</p>
    <p>{{ $t('message.vpn.customer.gateway.delete.impact') }}</p>
    <p v-if="rows.length > 1">{{ $t('label.vpn.customer.gateway.delete.count', [rows.length]) }}</p>
    <ul class="vpn-customer-gateway-targets" aria-live="polite">
      <li v-for="row in rows" :key="row.id">
        <strong>{{ row.name || row.id }}</strong>
        <div>{{ row.gateway }}</div>
        <div>{{ [row.project || row.account, row.domain].filter(Boolean).join(' · ') }}</div>
        <a-tag v-if="row.status" :color="colors[row.status]">{{ $t(labels[row.status]) }}</a-tag>
        <div v-if="row.error">{{ row.error }}</div>
        <code v-if="row.status === 'unknown' && row.jobId">{{ row.jobId }}</code>
      </li>
    </ul>
    <template #footer>
      <a-button :disabled="running" @click="close">{{ $t(started ? 'label.close' : 'label.cancel') }}</a-button>
      <a-button v-if="!started" type="primary" danger @click="submit">{{ $t(currentAction.label) }}</a-button>
      <a-button v-else-if="canRecheck" type="primary" :loading="running" @click="recheck">
        {{ $t('label.vpn.customer.gateway.job.recheck') }}
      </a-button>
    </template>
  </MoldDialog>
</template>

<script>
import { postAPI } from '@/api'
import MoldDialog from '@/components/view/MoldDialog'
import { gatewayJobTracker, gatewayRequestError, gatewayRequestOptions } from '@/utils/vpnCustomerGatewayJobs'

const labels = { pending: 'label.in.progress', success: 'label.success', failed: 'label.failed', unknown: 'message.vpn.customer.gateway.job.unknown' }
const colors = { pending: 'processing', success: 'success', failed: 'error', unknown: 'warning' }

export default {
  name: 'VpnCustomerGatewayDeleteDialog',
  components: { MoldDialog },
  props: {
    currentAction: { type: Object, required: true },
    afterClose: { type: Function, default: undefined }
  },
  emits: ['close-action'],
  data () {
    return {
      rows: this.currentAction.vpnCustomerGatewayTargets.map(target => ({ ...target, status: '', error: '', jobId: '' })),
      labels,
      colors,
      started: false,
      running: false,
      active: true
    }
  },
  computed: {
    canRecheck () { return this.rows.some(row => row.status === 'unknown' && row.jobId) }
  },
  created () { this.tracker = gatewayJobTracker() },
  beforeUnmount () {
    this.active = false
    this.tracker.clear()
  },
  methods: {
    close () {
      if (this.running) return
      this.$emit('close-action', {
        gatewayDeletion: this.started,
        removed: this.rows.filter(row => row.status === 'success').map(row => row.id)
      })
    },
    finish () {
      this.running = false
      if (!this.rows.every(row => row.status === 'success')) return
      this.$message.success(this.$t('label.success'))
      this.close()
    },
    async track (row, retry = false) {
      const job = await this.tracker.track(row.jobId, {}, retry)
      if (!this.active) return
      row.status = job.jobstatus === 1 ? 'success' : job.jobstatus === 2 ? 'failed' : 'unknown'
      row.error = row.status === 'failed' ? job.jobresult?.errortext || this.$t('message.request.failed') : ''
    },
    async remove (row) {
      row.status = 'pending'
      try {
        const response = await postAPI('deleteVpnCustomerGateway', { id: row.id, ignoreproject: true }, gatewayRequestOptions)
        if (!this.active) return
        row.jobId = response?.deletevpncustomergatewayresponse?.jobid || ''
        if (row.jobId) await this.track(row)
        else row.status = 'unknown'
      } catch (error) {
        if (!this.active) return
        row.error = gatewayRequestError(error)
        row.status = row.error ? 'failed' : 'unknown'
      }
    },
    async submit () {
      if (this.started || !this.active) return
      this.started = true
      this.running = true
      for (const row of this.rows) {
        if (!this.active) return
        await this.remove(row)
      }
      if (this.active) this.finish()
    },
    async recheck () {
      if (this.running || !this.active) return
      this.running = true
      await Promise.all(this.rows.filter(row => row.status === 'unknown' && row.jobId).map(row => this.track(row, true)))
      if (this.active) this.finish()
    }
  }
}
</script>

<style scoped>
.vpn-customer-gateway-targets {
  display: grid;
  gap: 12px;
  padding-inline-start: 20px;
  overflow-wrap: anywhere;
}
</style>
