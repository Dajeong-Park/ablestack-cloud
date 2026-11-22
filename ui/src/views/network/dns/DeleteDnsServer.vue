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
    <a-alert type="warning" show-icon :message="$t('message.action.delete.dns.server')" />
    <a-alert v-if="jobError" class="dns-delete-message" type="error" show-icon :message="jobError" />

    <a-spin :spinning="impactStatus === 'loading' || jobLoading">
      <a-alert v-if="impactStatus === 'error'" class="dns-delete-message" type="error" show-icon :message="$t('message.dns.server.impact.failed')">
        <template #description><a-button size="small" @click="fetchDnsZones">{{ $t('label.retry') }}</a-button></template>
      </a-alert>
      <a-alert v-else-if="impactStatus === 'ready'" class="dns-delete-message" :type="totalDnsZones ? 'warning' : 'info'" show-icon
        :message="$t('message.dns.server.impact.count', { count: totalDnsZones })">
        <template v-if="dnsZones.length" #description>
          <ul><li v-for="zone in dnsZones" :key="zone.id">{{ zone.name }}</li></ul>
          <span v-if="totalDnsZones > dnsZones.length">{{ $t('message.dns.server.impact.more', { count: totalDnsZones - dnsZones.length }) }}</span>
        </template>
      </a-alert>

      <a-form layout="vertical" @finish="handleSubmit">
        <fieldset class="dns-delete-fields" :disabled="jobLoading || !!jobId || jobTracking === 'unconfirmed'">
          <a-form-item :label="$t('message.confirm.type') + ' ' + resource.name">
            <a-input v-model:value="confirmName" :placeholder="resource.name" v-focus="true" />
          </a-form-item>
          <a-form-item :label="$t('label.cleanup')">
            <a-switch v-model:checked="cleanup" @change="onCleanupChange" />
          </a-form-item>
          <a-form-item v-if="cleanup" :label="$t('label.dns.unmanage.zone')">
            <a-switch v-model:checked="unmanage" />
          </a-form-item>
        </fieldset>
        <p>{{ $t(deleteEffect) }}</p>
        <div class="action-button">
          <a-button :disabled="jobLoading" @click="$emit('close-action')">{{ $t('label.cancel') }}</a-button>
          <a-button type="primary" danger :disabled="!canSubmit" :loading="jobLoading" @click="handleSubmit">
            {{ $t(jobId ? 'label.dns.job.recheck' : 'label.delete') }}
          </a-button>
        </div>
      </a-form>
    </a-spin>
  </div>
</template>

<script>
import { getAPI } from '@/api'
import { dnsJob } from './dnsJob'

export default {
  name: 'DeleteDnsServer',
  mixins: [dnsJob],
  props: { resource: { type: Object, required: true } },
  emits: ['close-action', 'refresh-data'],
  data () {
    return { impactStatus: 'loading', dnsZones: [], totalDnsZones: 0, confirmName: '', cleanup: true, unmanage: false }
  },
  computed: {
    deleteEffect () {
      if (!this.cleanup) return this.totalDnsZones ? 'message.dns.server.cleanup.required' : 'message.dns.server.delete.registration'
      return this.unmanage ? 'message.dns.server.delete.retain' : 'message.dns.server.delete.provider'
    },
    canSubmit () {
      return !this.jobLoading && this.jobTracking !== 'unconfirmed' && !!this.$store.getters.apis?.deleteDnsServer &&
        (!!this.jobId || (this.impactStatus === 'ready' && this.confirmName === this.resource.name && (this.cleanup || !this.totalDnsZones)))
    }
  },
  created () {
    this.fetchDnsZones()
  },
  methods: {
    onCleanupChange (checked) {
      if (!checked) this.unmanage = false
    },
    async fetchDnsZones () {
      const id = this.resource.id
      this.impactStatus = 'loading'
      try {
        if (!this.$getApiParams('listDnsZones')?.deleteimpact) throw new Error('Deletion preview unavailable')
        const response = await getAPI('listDnsZones', { dnsserverid: id, deleteimpact: true, page: 1, pagesize: 5 }, { preserveOnFailure: true })
        const payload = response?.listdnszonesresponse
        const rows = payload?.dnszone ?? []
        const total = Number(payload?.count ?? rows.length)
        if (!payload || payload.errorcode || !Array.isArray(rows) || !Number.isSafeInteger(total) || total < rows.length || (total > 0 && !rows.length)) {
          throw new Error('Invalid deletion preview response')
        }
        if (id !== this.resource.id) return
        this.dnsZones = rows
        this.totalDnsZones = total
        this.impactStatus = 'ready'
      } catch {
        if (id === this.resource.id) this.impactStatus = 'error'
      }
    },
    handleSubmit () {
      if (!this.canSubmit) return
      const params = { id: this.resource.id, cleanup: this.cleanup, ...(this.cleanup && { unmanage: this.unmanage }) }
      return this.submitDnsJob('deleteDnsServer', params, 'label.dns.delete.server', this.resource.name, () => {
        this.$emit('close-action')
        if (this.$route.params.id === params.id) {
          this.$router.push({ path: '/dnsserver' })
        } else {
          this.$emit('refresh-data')
        }
      })
    }
  }
}
</script>

<style scoped>
.form-layout { width: min(80vw, 480px); }
.dns-delete-message { margin-block: 12px; }
.dns-delete-fields { border: 0; padding: 0; min-width: 0; }
.action-button { display: flex; justify-content: flex-end; gap: 8px; }
</style>
