<!--
Licensed to the Apache Software Foundation (ASF) under one
or more contributor license agreements. See the NOTICE file
distributed with this work for additional information
regarding copyright ownership. The ASF licenses this file
to you under the Apache License, Version 2.0 (the
"License"); you may not use this file except in compliance
with the License. You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing,
software distributed under the License is distributed on an
"AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, either express or implied. See the License for the
specific language governing permissions and limitations
under the License.
-->
<template>
  <InternalLbDialog v-if="target && !closed" ref="dialog" mode="create" :resource="target.vpc" :tier-id="target.network.id" @cancel="close" @success="$emit('refresh-data')" />
  <MoldDialog v-else-if="!closed" :title="$t('label.add.internal.lb')" size="md" focus-guard :closable="!loading" :keyboard="!loading" @cancel="close">
    <a-alert v-if="error" type="error" show-icon :message="error" role="alert" />
    <a-button :loading="loading" :disabled="loading || !allowed" @click="load"><template #icon><reload-outlined /></template>{{ $t('label.internal.lb.reload') }}</a-button>
    <a-form layout="vertical" class="internal-lb-tier-picker">
      <a-form-item :label="$t('label.network')"><a-select v-model:value="selected" show-search option-filter-prop="label" :disabled="loading || !allowed" :aria-label="$t('label.network')"><a-select-option v-for="network in networks" :key="network.id" :value="network.id" :label="network.vpcname + ' · ' + network.name + ' · ' + network.cidr">{{ network.vpcname }} · {{ network.name }} · {{ network.cidr }}</a-select-option></a-select></a-form-item>
    </a-form>
    <template #footer><a-button :disabled="loading" @click="close">{{ $t('label.cancel') }}</a-button><a-button type="primary" :loading="loading" :disabled="loading || !allowed || !selected || !!error" @click="choose">{{ $t('label.next') }}</a-button></template>
  </MoldDialog>
</template>
<script>
import { getAPI } from '@/api'
import eventBus from '@/config/eventBus'
import MoldDialog from '@/components/view/MoldDialog'
import InternalLbDialog from './InternalLbDialog'
import { internalLbApis, internalLbScope } from '@/utils/internalLb'
import { vpcVpnOwner, vpcVpnSameOwner } from '@/utils/vpcVpn'
export default {
  name: 'InternalLbCreateForm',
  components: { MoldDialog, InternalLbDialog },
  props: { resource: { type: Object, default: () => ({}) } },
  emits: ['close-action', 'refresh-data'],
  data: () => ({ mode: 'create', networks: [], selected: '', target: null, loading: false, error: '', closed: false, disposed: false, origin: '' }),
  computed: {
    scope () { return internalLbScope(this) },
    allowed () { return this.current() && !!this.$store.getters.userInfo?.id && internalLbApis('create').every(api => api in (this.$store.getters.apis || {})) },
    blocksNavigation () { return !this.closed && (this.loading || !!this.$refs.dialog?.blocksNavigation) }
  },
  watch: { scope: { flush: 'sync', handler () { this.invalidate() } } },
  created () { this.origin = this.scope; eventBus.on('project-switch-start', this.invalidate); this.load() },
  beforeUnmount () { this.disposed = true; eventBus.off('project-switch-start', this.invalidate) },
  methods: {
    current () { return !this.closed && !this.disposed && this.origin === this.scope },
    invalidate () { if (this.closed) return; this.closed = true; this.$emit('close-action') },
    close () { if (!this.loading) this.invalidate() },
    async rows (api, key, params) {
      const rows = []; const seen = new Set()
      for (let page = 1; page <= 100; page++) {
        const json = await getAPI(api, { listall: true, ignoreproject: true, ...params, page, pagesize: 100 }, { preserveOnFailure: true, timeout: 15000 })
        if (!this.current()) return []
        const body = json?.[api.toLowerCase() + 'response']; if (!body || body.errorcode) throw new Error(this.$t('message.internal.lb.changed'))
        const batch = body[key] || []
        for (const row of batch) { if (!row.id || seen.has(row.id)) throw new Error(this.$t('message.internal.lb.changed')); seen.add(row.id); rows.push(row) }
        if (batch.length < 100 || (Number.isInteger(body.count) && rows.length >= body.count)) return rows
      }
      throw new Error(this.$t('message.internal.lb.changed'))
    },
    async load () {
      if (this.loading || !this.allowed) return
      this.loading = true; this.error = ''
      try {
        const project = this.$store.getters.project?.id
        const rows = await this.rows('listNetworks', 'network', { forvpc: true, projectid: project && String(project) !== '0' ? project : -1 })
        if (!this.current()) return
        this.networks = rows.filter(n => n.vpcid && (!project || String(project) === '0' || n.projectid === project) && (n.service || []).some(s => s.name === 'Lb' && (s.capability || []).some(c => c.name === 'LbSchemes' && String(c.value).split(',').map(s => s.trim()).includes('Internal'))))
        if (!this.networks.some(n => n.id === this.selected)) this.selected = ''
      } catch (error) { if (this.current()) this.error = error?.message || this.$t('message.request.failed') } finally { if (this.current()) this.loading = false }
    },
    async choose () {
      if (this.loading || !this.allowed || this.error) return
      const network = this.networks.find(n => n.id === this.selected); if (!network) return
      this.loading = true; this.error = ''
      try { const vpc = (await this.rows('listVPCs', 'vpc', { id: network.vpcid, ...vpcVpnOwner(network) })).find(v => v.id === network.vpcid); if (!this.current()) return; if (!vpc || !vpcVpnSameOwner(vpc, network)) throw new Error(this.$t('message.internal.lb.changed')); this.target = { vpc, network } } catch (error) { if (this.current()) this.error = error?.message || this.$t('message.request.failed') } finally { if (this.current()) this.loading = false }
    }
  }
}
</script>
<style scoped>
.internal-lb-tier-picker { margin-top: 16px; }
.internal-lb-tier-picker :deep(.ant-select) { width: 100%; }
.ant-alert { margin-bottom: 16px; }
</style>
