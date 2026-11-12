<!--
Licensed to the Apache Software Foundation (ASF) under one or more
contributor license agreements. See the NOTICE file for ownership information.
Licensed under the Apache License, Version 2.0; http://www.apache.org/licenses/LICENSE-2.0
Distributed on an AS IS BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND.
-->
<template>
  <section class="network-owner-context" :aria-label="$t('label.network.owner.context')" aria-live="polite">
    <p class="owner-title">{{ $t('label.network.owner.context') }}</p>
    <p v-if="!ready" role="status">{{ $t('message.network.owner.select') }}</p>
    <dl v-else>
      <template v-for="row in rows" :key="row.label"><dt>{{ $t(row.label) }}</dt><dd>{{ row.translate ? $t(row.value) : row.value }}</dd></template>
    </dl>
    <p class="owner-note">{{ $t(systemScope ? 'message.network.owner.shared' : fixed ? 'message.network.owner.vm' : 'message.network.owner.scope') }}</p>
  </section>
</template>
<script>
export default {
  name: 'NetworkOwnerContext',
  props: {
    owner: { type: Object, default: () => ({}) },
    ready: Boolean,
    labels: { type: Object, default: () => ({}) },
    resource: { type: Object, default: () => ({}) },
    fixed: Boolean
  },
  computed: {
    systemScope () { return String(this.owner?.acltype).toLowerCase() === 'domain' },
    rows () {
      const owner = this.owner || {}; const caller = this.$store.getters.userInfo || {}; const project = this.$store.getters.project || {}
      const resource = this.fixed ? this.resource : {}; const labels = this.labels; const rows = []
      if (this.systemScope) {
        rows.push({ label: 'label.account', value: 'label.network.owner.system', translate: true })
        rows.push({ label: 'label.scope', value: owner.domainid ? 'label.domain' : 'label.all', translate: true })
        if (owner.domainid) rows.push({ label: 'label.domain', value: labels.domainId === owner.domainid ? labels.domainLabel || owner.domainid : owner.domainid })
        if (owner.domainid) rows.push({ label: 'label.subdomainaccess', value: owner.subdomainaccess ? 'label.yes' : 'label.no', translate: true })
        return rows
      }
      if (owner.projectid) {
        const name = resource.projectid === owner.projectid ? resource.project : project.id === owner.projectid ? project.name : labels.projectId === owner.projectid ? labels.projectLabel : null
        rows.push({ label: 'label.project', value: name || owner.projectid })
      } else {
        rows.push({ label: 'label.account', value: owner.account || resource.account || caller.account || '—' })
      }
      const domainId = owner.domainid || (owner.projectid ? (resource.projectid === owner.projectid ? resource.domainid : project.id === owner.projectid ? project.domainid : null) : resource.domainid || caller.domainid)
      if (domainId) {
        const name = labels.domainId === domainId ? labels.domainLabel : resource.domainid === domainId ? resource.domainpath || resource.domain : caller.domainid === domainId ? caller.domainpath || caller.domain : null
        rows.push({ label: 'label.domain', value: name || domainId })
      }
      return rows
    }
  }
}
</script>
<style scoped lang="scss">
.network-owner-context { margin: 0 0 20px; padding: 12px 16px; border: 1px solid var(--ui-border); border-radius: 4px; background: var(--ui-bg-page); color: var(--ui-text-primary); overflow-wrap: anywhere; }
.owner-title { margin: 0 0 12px; color: var(--ui-text-primary); font-weight: 500; }
dl { display: grid; grid-template-columns: 104px minmax(0, 1fr); gap: 8px 16px; margin: 0; }
dt, dd { margin: 0; }
dt, .owner-note { color: var(--ui-text-secondary); }
.owner-note { margin: 12px 0 0; }
@media (max-width: 600px) { dl { grid-template-columns: 96px minmax(0, 1fr); gap: 8px; } }
</style>
