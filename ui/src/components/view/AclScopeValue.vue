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
  <span class="acl-scope-value">
    <a-tag>{{ $t(aclScopeLabel(resource)) }}</a-tag>
    <template v-if="resource.vpcid">
      <router-link v-if="linked && 'listVPCs' in $store.getters.apis" :to="{ path: '/vpc/' + resource.vpcid }">{{ resource.vpcname || resource.vpcid }}</router-link>
      <span v-else>{{ resource.vpcname || resource.vpcid }}</span>
    </template>
  </span>
</template>

<script>
import { aclScopeLabel } from '@/utils/vpcAclAccess'

export default {
  name: 'AclScopeValue',
  props: {
    resource: { type: Object, required: true },
    linked: { type: Boolean, default: true }
  },
  methods: { aclScopeLabel }
}
</script>

<style scoped>
.acl-scope-value { display: inline-flex; align-items: center; flex-wrap: wrap; gap: 4px 8px; min-width: 0; overflow-wrap: anywhere; }
.acl-scope-value :deep(.ant-tag) { margin: 0; }
.acl-scope-value a { color: var(--ui-link); }
</style>
