<!-- Licensed to the Apache Software Foundation (ASF) under one or more
contributor license agreements. See the NOTICE file for copyright ownership.
Licensed under the Apache License, Version 2.0 (the "License"); you may obtain
a copy at http://www.apache.org/licenses/LICENSE-2.0 . Distributed on an
"AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND. -->
<template>
  <div class="public-ip-release-summary">
    <a-descriptions v-for="row in rows" :key="row.id" class="mold-dialog-summary" :column="1" size="small">
      <a-descriptions-item :label="$t('label.ipaddress')">{{ row.ipaddress || row.id }}<div class="public-ip-release-summary__id">{{ row.id }}</div></a-descriptions-item>
      <a-descriptions-item :label="$t('label.state')"><public-ip-status :value="row.state" /></a-descriptions-item>
      <a-descriptions-item :label="$t(row.projectid ? 'label.project' : 'label.account')">{{ row.projectid ? row.project || row.projectid : row.account || $t('label.public.ip.value.notprovided') }}</a-descriptions-item>
      <a-descriptions-item :label="$t('label.domain')">{{ row.domain || row.domainid || $t('label.public.ip.value.notprovided') }}</a-descriptions-item>
    </a-descriptions>
  </div>
</template>
<script>
import PublicIpStatus from '@/components/widgets/PublicIpStatus'
export default {
  name: 'PublicIpReleaseSummary',
  components: { PublicIpStatus },
  props: { resources: { type: Array, default: () => [] } },
  computed: { rows () { return this.resources.filter(row => row?.id) } }
}
</script>
<style scoped>
.public-ip-release-summary { min-width: 0; overflow-wrap: anywhere; }
.public-ip-release-summary__id { color: var(--ui-text-secondary); }
</style>
