<!--
Licensed to the Apache Software Foundation (ASF) under one or more
contributor license agreements. See the NOTICE file distributed with this work
for additional information regarding copyright ownership. The ASF licenses this
file to you under the Apache License, Version 2.0 (the "License"); you may not use
this file except in compliance with the License. You may obtain a copy at
http://www.apache.org/licenses/LICENSE-2.0
Unless required by applicable law or agreed to in writing, software distributed
under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
CONDITIONS OF ANY KIND, either express or implied. See the License for the
specific language governing permissions and limitations under the License.
-->
<template>
  <a-alert
v-if="reason"
:type="reason === 'error' || reason === 'stale' ? 'error' : 'info'"
:message="$t(kmsAvailabilityLabel(reason))"
show-icon
:role="reason === 'error' || reason === 'stale' ? 'alert' : 'status'">
    <template v-if="canRefresh || showHsmHelp" #description>
      <a-space wrap>
        <a-button v-if="canRefresh" size="small" :loading="loading" :disabled="loading" @click="$emit('refresh')">
          <template #icon><reload-outlined /></template>
          {{ $t('label.refresh') }}
        </a-button>
        <router-link v-if="showHsmHelp && admin && hsmReadable" to="/hsmprofile">{{ $t('label.kms.availability.manageHsm') }}</router-link>
        <span v-else-if="showHsmHelp">{{ $t('message.kms.availability.contactAdmin') }}</span>
      </a-space>
    </template>
  </a-alert>
</template>

<script>
import { kmsAvailabilityLabel } from '@/utils/kmsAvailability'

export default {
  name: 'KmsAvailabilityNotice',
  props: {
    reason: { type: String, default: '' },
    loading: Boolean,
    refreshable: Boolean,
    hsmHelp: Boolean
  },
  emits: ['refresh'],
  computed: {
    admin () { return this.$store.getters.userInfo?.roletype === 'Admin' },
    hsmReadable () { return 'listHSMProfiles' in (this.$store.getters.apis || {}) },
    canRefresh () { return this.refreshable && !['stale', 'keyDisabled'].includes(this.reason) },
    showHsmHelp () { return this.hsmHelp && ['empty', 'forbidden', 'profileMissing', 'profileDisabled', 'profileScope', 'profileZone'].includes(this.reason) }
  },
  methods: { kmsAvailabilityLabel }
}
</script>
