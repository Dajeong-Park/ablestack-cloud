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
  <MoldDialog :title="$t('label.delete.ipv4.subnet')" size="md" focus-guard
    :after-close="afterClose" :closable="!busy" :keyboard="!busy" @cancel="close">
    <p>{{ $t('message.action.delete.ipv4.subnet') }}</p>
    <p v-if="currentAction.ipv4SubnetDeleteExcluded">
      {{ $t('message.ipv4.subnet.delete.selection', [rows.length, currentAction.ipv4SubnetDeleteExcluded]) }}
    </p>
    <ul class="subnet-delete-list" aria-live="polite">
      <li v-for="row in rows" :key="row.id">
        <strong>{{ row.subnet || row.id }}</strong>
        <a-tag v-if="row.status" :color="statusColors[row.status]">{{ $t(statusLabels[row.status]) }}</a-tag>
        <div v-if="row.error">{{ row.error }}</div>
      </li>
    </ul>
    <template #footer>
      <a-button v-focus="true" :disabled="busy" @click="close">{{ $t(started ? 'label.close' : 'label.cancel') }}</a-button>
      <a-button v-if="!started" type="primary" danger :loading="busy" @click="remove">{{ $t('label.delete') }}</a-button>
    </template>
  </MoldDialog>
</template>

<script>
import { getAPI, postAPI } from '@/api'
import MoldDialog from '@/components/view/MoldDialog'
import { canDeleteIpv4Subnet } from '@/utils/ipv4Subnet'
import { networkError } from '@/utils/networkLifecycle'

const statusLabels = { success: 'label.success', failed: 'label.failed', unknown: 'message.job.result.unknown' }
const statusColors = { success: 'success', failed: 'error', unknown: 'warning' }
const apiOptions = { preserveOnFailure: true }

export default {
  name: 'DeleteIpv4Subnet',
  inheritAttrs: false,
  components: { MoldDialog },
  props: {
    currentAction: { type: Object, required: true },
    afterClose: { type: Function, required: true }
  },
  emits: ['close-action'],
  data () {
    return {
      rows: this.currentAction.ipv4SubnetDeleteTargets.map(row => ({ ...row, error: '', status: '' })),
      started: false,
      busy: false,
      statusLabels,
      statusColors
    }
  },
  methods: {
    close () {
      if (this.busy) return
      this.$emit('close-action', {
        ipv4SubnetDeletion: this.started,
        removed: this.rows.filter(row => row.status === 'success').map(row => row.id)
      })
    },
    async remove () {
      if (this.started || !this.currentAction.ipv4SubnetDeleteCurrent()) return
      this.started = true
      this.busy = true
      try {
        for (const row of this.rows) {
          if (!this.currentAction.ipv4SubnetDeleteCurrent()) return
          await this.removeRow(row)
        }
        if (this.currentAction.ipv4SubnetDeleteCurrent() && this.rows.every(row => row.status === 'success')) {
          this.busy = false
          this.close()
        }
      } finally {
        this.busy = false
      }
    },
    async removeRow (row) {
      const action = { api: this.currentAction.api, isFetchData: false, suppressErrorNotification: true }
      try {
        const data = await getAPI('listIpv4SubnetsForGuestNetwork', { id: row.id }, apiOptions)
        if (!this.currentAction.ipv4SubnetDeleteCurrent()) return
        const record = data.listipv4subnetsforguestnetworkresponse?.ipv4subnetforguestnetwork?.find(item => item.id === row.id)
        if (!canDeleteIpv4Subnet(record)) {
          row.status = 'failed'
          row.error = this.$t('message.ipv4.subnet.delete.changed')
          return
        }
        const response = await postAPI(action.api, { id: row.id }, apiOptions)
        const jobId = response.deleteipv4subnetforguestnetworkresponse?.jobid
        const result = jobId && await this.$pollJob({ jobId, action, showLoading: false, showSuccessMessage: false })
        row.status = result?.jobstatus === 1 ? 'success' : result?.jobstatus === 2 ? 'failed' : 'unknown'
        if (row.status === 'failed') row.error = result.jobresult?.errortext || this.$t('message.request.failed')
      } catch (error) {
        row.status = 'failed'
        row.error = networkError(error).text || this.$t('message.request.failed')
      }
    }
  }
}
</script>

<style scoped>
.subnet-delete-list {
  display: grid;
  padding-inline-start: 20px;
  gap: 8px;
  overflow-wrap: anywhere;
}

.subnet-delete-list .ant-tag {
  margin-inline-start: 8px;
}
</style>
