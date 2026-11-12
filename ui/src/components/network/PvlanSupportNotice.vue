// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements. See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership. The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License. You may obtain a copy of the License at
//
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied. See the License for the
// specific language governing permissions and limitations
// under the License.
<template>
  <section class="pvlan-support-notice" :aria-busy="loading">
    <div class="pvlan-support-heading">
      <strong>{{ $t('label.pvlan.support') }}</strong>
      <a-tooltip :title="$t('label.pvlan.support.refresh')">
        <a-button size="small" shape="circle" :loading="loading" :disabled="loading" :aria-label="$t('label.pvlan.support.refresh')" @click="validate"><template #icon><reload-outlined /></template></a-button>
      </a-tooltip>
    </div>
    <a-alert show-icon :type="loading ? 'info' : report.status === 'ready' ? 'success' : report.status === 'unsupported' ? 'error' : 'warning'" :message="$t('message.pvlan.support.' + (loading ? 'checking' : report.status))">
      <template #description>{{ $t('message.pvlan.support.boundary') }}</template>
    </a-alert>
  </section>
</template>

<script>
import { getAPI } from '@/api'
import { diagnosePvlanSupport, pvlanDiagnosticApis } from '@/utils/pvlanSupport'

export default {
  name: 'PvlanSupportNotice',
  props: {
    zoneId: { type: String, default: '' },
    physicalNetworkId: { type: String, default: '' },
    offering: { type: Object, default: null },
    hostId: { type: String, default: '' }
  },
  emits: ['state'],
  data: () => ({ loading: false, report: { status: 'empty', blocked: true }, request: 0, disposed: false }),
  computed: {
    scope () {
      const g = this.$store?.getters || {}
      return JSON.stringify([this.zoneId, this.physicalNetworkId, this.offering?.id, this.offering?.tags, this.hostId,
        g.project?.id, g.userInfo?.id, g.userInfo?.roleid, this.$store?.state?.user?.token, this.$route?.fullPath,
        pvlanDiagnosticApis.map(api => api in (g.apis || {}))])
    }
  },
  watch: { scope: { immediate: true, handler () { this.validate() } } },
  beforeUnmount () { this.disposed = true; this.request++ },
  methods: {
    async validate () {
      const request = ++this.request; const scope = this.scope
      const current = () => !this.disposed && request === this.request && scope === this.scope
      this.loading = true; this.report = { status: 'checking', blocked: true }; this.$emit('state', { blocked: true, pending: true })
      try {
        const report = await diagnosePvlanSupport(getAPI, this.$store?.getters?.apis, { zoneId: this.zoneId, physicalNetworkId: this.physicalNetworkId, offering: this.offering, hostId: this.hostId })
        if (!current()) return false
        this.report = report
        return !report.blocked
      } catch (_) {
        if (current()) this.report = { status: 'failed', blocked: true }
        return false
      } finally {
        if (current()) { this.loading = false; this.$emit('state', { ...this.report, pending: false }) }
      }
    }
  }
}
</script>

<style scoped>
.pvlan-support-notice { margin: 12px 0 20px; color: var(--ui-text-primary); overflow-wrap: anywhere; }
.pvlan-support-heading { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 8px; }
</style>
