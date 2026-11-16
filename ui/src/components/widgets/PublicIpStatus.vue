<!-- Licensed to the Apache Software Foundation (ASF) under one or more
contributor license agreements. See the NOTICE file for copyright ownership.
Licensed under the Apache License, Version 2.0 (the "License"); you may obtain
a copy at http://www.apache.org/licenses/LICENSE-2.0 . Distributed on an
"AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND. -->
<template>
  <span class="public-ip-status" :data-public-ip-state="presentation.state || 'unknown'">
    <status :text="presentation.state || 'unknown'" :display-label="$t(presentation.key)" display-text>
      <template #tooltip>{{ $t(presentation.key) }}<template v-if="presentation.raw"> · {{ $t('label.public.ip.value.raw') }}: {{ presentation.raw }}</template></template>
    </status>
    <span v-if="!presentation.state && presentation.raw" class="public-ip-status__raw">{{ $t('label.public.ip.value.raw') }}: {{ presentation.raw }}</span>
  </span>
</template>
<script>
import Status from '@/components/widgets/Status'
import { publicIpState } from '@/utils/publicIpPresentation'
export default {
  name: 'PublicIpStatus',
  components: { Status },
  props: { value: { type: [String, Number, Boolean, Object, Array], default: null } },
  computed: { presentation () { return publicIpState(this.value) } }
}
</script>
<style scoped>
.public-ip-status { display: inline-flex; flex-wrap: wrap; gap: 4px 8px; min-width: 0; max-width: 100%; overflow-wrap: anywhere; }
.public-ip-status :deep(.ant-badge-status-text) { white-space: normal; word-break: keep-all; overflow-wrap: anywhere; }
.public-ip-status__raw { color: var(--ui-text-secondary); overflow-wrap: anywhere; }
</style>
