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
  <span class="vpc-tier-acl-value" :data-state="target ? 'linked' : 'missing'">
    <router-link v-if="target" :to="{ path: '/acllist/' + target.id }">{{ target.label }}</router-link>
    <span v-else>—</span>
  </span>
</template>
<script>
const uuid = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i
export default {
  name: 'VpcTierAclValue',
  props: { acl: { type: Object, default: () => ({}) } },
  computed: {
    target () {
      const id = typeof this.acl?.aclid === 'string' ? this.acl?.aclid.trim() : ''
      if (!uuid.test(id)) return null
      const name = typeof this.acl?.aclname === 'string' ? this.acl?.aclname.trim() : ''
      return { id, label: name || id }
    }
  }
}
</script>
<style scoped>
.vpc-tier-acl-value { min-width: 0; overflow-wrap: anywhere; }
</style>
