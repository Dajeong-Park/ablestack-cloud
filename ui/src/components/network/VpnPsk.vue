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
  <span class="vpn-psk">
    <span class="vpn-psk-value" :aria-label="present && !shown ? $t('label.vpn.psk.hidden') : undefined">{{ present ? (shown ? value : '••••••••') : '—' }}</span>
    <span v-if="!maskedOnly && canRead" class="vpn-psk-actions">
      <a-button size="small" :aria-label="$t(shown ? 'label.public.ip.vpn.hide.key' : 'label.public.ip.vpn.show.key')" :aria-pressed="shown" @click="toggle">
        <template #icon><eye-invisible-outlined v-if="shown" /><eye-outlined v-else /></template>
        {{ $t(shown ? 'label.public.ip.vpn.hide.key' : 'label.public.ip.vpn.show.key') }}
      </a-button>
      <a-button size="small" :aria-label="$t('label.vpn.psk.copy')" @click="copy"><template #icon><copy-outlined /></template></a-button>
    </span>
  </span>
</template>
<script>
import { CopyOutlined, EyeOutlined, EyeInvisibleOutlined } from '@ant-design/icons-vue'
import { copyText } from 'vue3-clipboard'
import { vpnPskContext } from '@/utils/vpnPsk'
import eventBus from '@/config/eventBus'

export default {
  name: 'VpnPsk',
  components: { CopyOutlined, EyeOutlined, EyeInvisibleOutlined },
  props: {
    value: { type: String, default: '' },
    resource: { type: Object, default: () => ({}) },
    permission: { type: String, default: '' },
    maskedOnly: { type: Boolean, default: false }
  },
  data () { return { acceptedContext: '', revealedScope: '', revealedValue: '', disposed: false } },
  computed: {
    present () { return typeof this.value === 'string' && this.value.length > 0 },
    context () { return vpnPskContext(this, [this.permission]) },
    scope () { return JSON.stringify([this.context, this.resource.id, this.resource.projectid, this.resource.account, this.resource.domainid, this.$route.fullPath || this.$route.path]) },
    ownerMatches () {
      const project = this.$store.getters.project?.id
      return !project || String(project) === '0' || String(project) === String(this.resource.projectid)
    },
    routeMatches () {
      const parts = this.$route.path.split('/')
      try { return ['s2svpnconn', 'vpncustomergateway', 'publicip'].includes(parts[1]) && decodeURIComponent(parts[2] || '') === this.resource.id } catch (_) { return false }
    },
    canRead () {
      return !this.disposed && !this.maskedOnly && this.present && !!this.$store.getters.userInfo?.id && this.permission in (this.$store.getters.apis || {}) && this.acceptedContext === this.context && this.ownerMatches && this.routeMatches
    },
    shown () { return this.canRead && this.revealedScope === this.scope && this.revealedValue === this.value }
  },
  watch: {
    context: { flush: 'sync', handler () { this.acceptedContext = ''; this.hide() } },
    scope: { flush: 'sync', handler () { this.hide() } },
    value: { flush: 'sync', handler () { this.hide() } },
    resource () { this.hide(); this.acceptedContext = this.context }
  },
  created () { this.acceptedContext = this.context; eventBus.on('project-switch-start', this.onProjectSwitch) },
  activated () { this.hide() },
  deactivated () { this.hide() },
  beforeUnmount () { eventBus.off('project-switch-start', this.onProjectSwitch); this.disposed = true; this.hide() },
  methods: {
    onProjectSwitch () { this.acceptedContext = ''; this.hide() },
    hide () { this.revealedScope = ''; this.revealedValue = '' },
    toggle () {
      if (!this.canRead) return
      if (this.shown) this.hide()
      else { this.revealedScope = this.scope; this.revealedValue = this.value }
    },
    copy () {
      if (!this.canRead) return
      const scope = this.scope
      const value = this.value
      const finish = (error, event) => {
        if (event && event.clearSelection) event.clearSelection()
        if (!this.canRead || this.scope !== scope || this.value !== value) return
        if (error) this.$message.error(this.$t('message.vpn.psk.copy.failed'))
        else this.$message.success(this.$t('label.copied.clipboard'))
      }
      const fallback = () => {
        if (!this.canRead || this.scope !== scope || this.value !== value) return
        try { copyText(value, this.$el, finish) } catch (_) { finish(true) }
      }
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        try { navigator.clipboard.writeText(value).then(() => finish(false), fallback) } catch (_) { fallback() }
      } else fallback()
    }
  }
}
</script>
<style scoped>
.vpn-psk { display: inline-flex; align-items: center; flex-wrap: wrap; gap: 8px; max-width: 100%; }
.vpn-psk-value { font-family: monospace; overflow-wrap: anywhere; white-space: pre-wrap; max-width: 100%; }
.vpn-psk-actions { display: inline-flex; gap: 4px; flex-wrap: wrap; }
</style>
