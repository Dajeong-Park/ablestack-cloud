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
  <a-alert class="bucket-protection-capabilities bucket-info-ribbon" type="info" show-icon>
    <template #message>{{ $t('label.bucket.protection.capabilities') }}</template>
    <template #description>
      <dl class="bucket-info-fields">
        <template v-for="key in ['encryption', 'versioning', 'objectlocking']" :key="key">
          <dt>{{ $t('label.' + key) }}</dt><dd>{{ $t('state.bucket.capability.' + (capabilities[key] || 'Unknown').toLowerCase()) }}</dd>
        </template>
      </dl>
      <ul class="bucket-info-notes">
        <li v-if="capabilities.encryption !== 'Supported'">{{ $t(capabilities.encryptionreason === 'ENCRYPTION_REQUIRES_HTTPS' ? 'message.bucket.protection.https' : 'message.bucket.protection.encryption.unknown') }}</li>
        <li>{{ $t('message.bucket.protection.create.only') }}</li>
      </ul>
    </template>
  </a-alert>
</template>
<script>
export default { props: { capabilities: { type: Object, default: () => ({}) } } }
</script>
<style scoped>
.bucket-protection-capabilities { margin-bottom: 16px; overflow-wrap: anywhere; }
</style>
