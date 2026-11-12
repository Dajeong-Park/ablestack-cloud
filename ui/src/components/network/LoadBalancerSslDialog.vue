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
  <MoldDialog size="md" class="lb-ssl-dialog" :title="$t('label.manage.ssl.cert')" :closable="!networkMutationBusy" :keyboard="!networkMutationBusy" @cancel="close">
    <NetworkMutationStatus :operation="networkMutation" @recheck="recheckNetworkMutation" />
    <a-alert v-if="readFailed" type="warning" show-icon :message="$t('message.guest.feature.load.failed')" />
    <a-spin :spinning="loading">
      <a-form layout="vertical">
        <a-form-item v-if="rule" :label="$t('label.current') + ' ' + $t('label.sslcertificate')">
          <div class="lb-ssl-dialog__value">{{ currentCert?.name || '—' }}</div>
          <div v-if="currentCert?.fingerprint" class="lb-ssl-dialog__fingerprint">{{ currentCert.fingerprint }}</div>
        </a-form-item>
        <a-form-item v-if="canAssign || !rule" :label="$t('label.new') + ' ' + $t('label.sslcertificate')">
          <a-select v-model:value="selectedId" :aria-label="$t('label.sslcertificate')" :disabled="locked" show-search option-filter-prop="label" :options="certs.map(cert => ({ value: cert.id, label: cert.name }))" />
        </a-form-item>
      </a-form>
    </a-spin>
    <template #footer>
      <div class="lb-ssl-dialog__actions">
        <a-button :disabled="networkMutationBusy" @click="close">{{ $t('label.close') }}</a-button>
        <a-button :loading="loading" :disabled="loading || networkMutationBlocked || !canRead" @click="refresh"><template #icon><reload-outlined /></template>{{ $t('label.refresh') }}</a-button>
        <a-button v-if="rule && canRemove" danger :disabled="locked || !currentCert" @click="remove">{{ $t('label.delete') }}</a-button>
        <a-button v-if="canAssign || !rule" type="primary" :loading="networkMutationBusy" :disabled="locked || !selectedId || selectedId === currentCert?.id" @click="assign">{{ $t(!rule ? 'label.select' : currentCert ? 'label.replace' : 'label.assign') }}</a-button>
      </div>
    </template>
  </MoldDialog>
</template>
<script>
import { getAPI } from '@/api'
import eventBus from '@/config/eventBus'
import MoldDialog from '@/components/view/MoldDialog'
import NetworkMutationStatus from '@/components/view/NetworkMutationStatus'
import { networkMutationMixin } from '@/utils/networkMutation'
import { networkCollection } from '@/utils/networkLifecycle'

export default {
  components: { MoldDialog, NetworkMutationStatus },
  mixins: [networkMutationMixin],
  props: { resource: { type: Object, required: true }, rule: { type: Object, default: null }, selected: { type: Object, default: () => ({}) } },
  emits: ['cancel', 'select', 'refresh'],
  data () { return { certs: [], currentCert: null, selectedId: this.selected.id, loading: false, readFailed: false, readVersion: 0, suspended: false } },
  computed: {
    networkMutationScope () {
      const user = this.$store.getters.userInfo || {}
      return JSON.stringify([this.$route.path, this.$route.query?.tab, this.resource.id, this.resource.projectid, this.rule?.id,
        user.id, user.roleid, user.roletype, user.domainid, this.$store.state?.user?.token,
        this.$store.getters.project?.id, Object.keys(this.$store.getters.apis || {}).sort()])
    },
    canRead () { return !this.suspended && 'listSslCerts' in (this.$store.getters.apis || {}) },
    canAssign () { return this.canRead && this.can('assignCertToLoadBalancer') },
    canRemove () { return this.canRead && this.can('removeCertFromLoadBalancer') },
    locked () { return !this.canRead || this.loading || this.readFailed || this.networkMutationBlocked }
  },
  watch: { networkMutationScope () { this.invalidate() } },
  created () { eventBus.on('project-switch-start', this.invalidate); this.refresh() },
  beforeUnmount () { this.readVersion++; eventBus.off('project-switch-start', this.invalidate) },
  methods: {
    can (api) { return [api, 'queryAsyncJobResult'].every(name => name in (this.$store.getters.apis || {})) },
    invalidate () {
      this.suspended = true; this.readVersion++; this.networkMutationVersion++
      this.certs = []; this.currentCert = null; this.selectedId = undefined; this.networkMutation = null
      this.$emit('cancel')
    },
    close () { if (!this.networkMutationBusy) this.$emit('cancel') },
    async refresh () {
      if (!this.canRead || this.loading || this.networkMutationBlocked) return
      const version = ++this.readVersion; const scope = this.networkMutationScope
      const active = () => !this.networkMutationDisposed && !this.suspended && version === this.readVersion && scope === this.networkMutationScope
      this.loading = true
      try {
        const params = { ignoreproject: true }
        if (this.resource.projectid) params.projectid = this.resource.projectid
        else if (this.resource.accountid) params.accountid = this.resource.accountid
        else if (this.resource.account && this.resource.account !== this.$store.getters.userInfo?.account) {
          if (!('listAccounts' in (this.$store.getters.apis || {}))) throw new Error('Account lookup unavailable')
          const json = await getAPI('listAccounts', { name: this.resource.account, domainid: this.resource.domainid, ignoreproject: true }, { preserveOnFailure: true })
          if (!active()) return
          const accounts = json?.listaccountsresponse?.account || []
          if (accounts.length !== 1) throw new Error('Account lookup failed')
          params.accountid = accounts[0].id
        }
        const [certs, assigned] = await Promise.all([
          networkCollection(getAPI, 'listSslCerts', 'sslcert', params),
          this.rule ? networkCollection(getAPI, 'listSslCerts', 'sslcert', { ...params, lbruleid: this.rule.id }) : []
        ])
        if (!active()) return
        if (assigned.length > 1) throw new Error('Invalid SSL assignment')
        // Retain only public display metadata; never keep certificate/key material in the dialog.
        const metadata = ({ id, name, fingerprint }) => ({ id, name, fingerprint })
        this.certs = certs.map(metadata); this.currentCert = assigned[0] ? metadata(assigned[0]) : null
        if (!this.certs.some(cert => cert.id === this.selectedId)) this.selectedId = undefined
        this.readFailed = false
      } catch (error) { if (active()) this.readFailed = true } finally { if (active()) this.loading = false }
    },
    async assign () {
      if (this.locked || !this.canAssign || !this.certs.some(cert => cert.id === this.selectedId) || this.selectedId === this.currentCert?.id) return false
      if (!this.rule) { this.$emit('select', this.certs.find(cert => cert.id === this.selectedId)); this.$emit('cancel'); return true }
      this.resetNetworkMutation()
      return this.submitNetworkMutation('assignCertToLoadBalancer', { lbruleid: this.rule.id, certid: this.selectedId, forced: true }, this.completed)
    },
    async remove () {
      if (this.locked || !this.canRemove || !this.rule?.id || !this.currentCert) return false
      this.resetNetworkMutation()
      return this.submitNetworkMutation('removeCertFromLoadBalancer', { lbruleid: this.rule.id }, this.completed)
    },
    async completed () { await this.refresh(); this.$emit('refresh') }
  }
}
</script>
<style scoped lang="less">
.lb-ssl-dialog__value, .lb-ssl-dialog__fingerprint { overflow-wrap: anywhere; }
.lb-ssl-dialog__fingerprint { margin-top: 8px; font-family: monospace; }
.lb-ssl-dialog__actions { display: flex; justify-content: flex-end; flex-wrap: wrap; gap: 8px; }
.lb-ssl-dialog__actions :deep(.ant-btn) { margin: 0; }
@media (max-width: 575px) { .lb-ssl-dialog__actions :deep(.ant-btn) { flex: 1 1 calc(50% - 8px); } }
</style>
