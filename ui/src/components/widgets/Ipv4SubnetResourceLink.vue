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
  <router-link v-if="location" :to="location">{{ label }}</router-link>
  <span v-else>{{ label }}</span>
</template>

<script>
import { ipv4SubnetResourceLocation } from '@/utils/ipv4Subnet'

export default {
  name: 'Ipv4SubnetResourceLink',
  props: {
    record: { type: Object, required: true },
    field: { type: String, required: true }
  },
  computed: {
    location () { return ipv4SubnetResourceLocation(this.record, this.field, this.$store.getters.apis) },
    label () { return this.record[this.field] || this.record[this.field === 'networkname' ? 'networkid' : 'vpcid'] || '—' }
  }
}
</script>
