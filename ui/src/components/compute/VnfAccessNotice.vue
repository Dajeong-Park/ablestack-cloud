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
  <a-alert v-if="access" class="vnf-access-notice" type="info" show-icon :message="$t('label.vnf.appliance.access.methods')">
    <template #description>
      <ul>
        <li v-for="entry in access.entries" :key="entry.key">
          <a v-if="entry.href" :href="entry.href" target="_blank" rel="noopener noreferrer">{{ entry.href }}</a>
          <span v-else>{{ $t(entry.label, entry.params || {}) }}</span>
        </li>
      </ul>
      <p v-if="access.hasCredentials">{{ $t('message.vnf.credentials.in.template.vnf.details') }}</p>
    </template>
  </a-alert>
</template>
<script>
import { vnfManagementAccess } from '@/utils/vnfAccess'
export default {
  name: 'VnfAccessNotice',
  props: { resource: { type: Object, required: true } },
  computed: { access () { return vnfManagementAccess(this.resource) } }
}
</script>
