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
  <span class="public-ip-network-reference">
    <router-link v-if="reference.path" :to="{ path: reference.path }" :title="reference.text">{{ reference.text }}</router-link>
    <span v-else>{{ reference.text || '—' }}</span>
  </span>
</template>

<script>
import { publicIpField } from '@/utils/publicIpDetails'

export default {
  name: 'PublicIpNetworkLink',
  props: { record: { type: Object, required: true } },
  computed: {
    reference () { return publicIpField(this.record, 'associatednetworkname', this.$store.getters.apis) }
  }
}
</script>

<style scoped>
.public-ip-network-reference { overflow-wrap: anywhere; }
</style>
