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
  <div class="bucket-usage-status" role="status" aria-live="polite">
    <div><span>{{ $t('label.bucket.usage.status') }}: </span><strong>{{ $t('label.bucket.usage.' + status.toLowerCase()) }}</strong></div>
    <div>{{ $t('label.bucket.usage.updated') }}: <span>{{ resource.usagelastupdated ? $toLocaleDate(resource.usagelastupdated) : $t('label.bucket.usage.unknown') }}</span></div>
    <div v-if="resource.usagelastattempt && status === 'Error'">{{ $t('label.bucket.usage.attempt') }}: {{ $toLocaleDate(resource.usagelastattempt) }}</div>
    <p v-if="!compact">{{ $t('message.bucket.usage.freshness') }}</p>
    <p v-if="!compact && resource.usagesource === 'StoreFallback'">{{ $t('message.bucket.usage.fallback') }}</p>
  </div>
</template>
<script>
export default {
  props: { resource: { type: Object, default: () => ({}) }, compact: { type: Boolean, default: false } },
  computed: { status () { return ['Fresh', 'Stale', 'Error', 'Unknown'].includes(this.resource.usagestatus) ? this.resource.usagestatus : 'Unknown' } }
}
</script>
<style lang="scss" scoped>
.bucket-usage-status { color: var(--ui-text-primary); min-width: 0; overflow-wrap: anywhere; }
.bucket-usage-status > div { margin-bottom: 4px; }
.bucket-usage-status p { margin: 4px 0 0; color: var(--ui-text-secondary); }
</style>
