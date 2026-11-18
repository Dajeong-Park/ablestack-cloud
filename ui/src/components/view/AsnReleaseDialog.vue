<!-- Licensed to the Apache Software Foundation (ASF) under one or more
contributor license agreements. See the NOTICE file distributed with this
work for additional information regarding copyright ownership. The ASF
licenses this file under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may
obtain a copy at http://www.apache.org/licenses/LICENSE-2.0 . Unless required
by applicable law or agreed to in writing, software distributed under the
License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS. -->
<template>
  <MoldDialog :visible="true" size="md" formActions focusGuard :title="$t('label.action.release.asnumber')" @cancel="cancel">
    <div class="asn-release-dialog" @keydown.ctrl.enter.prevent="!$event.repeat && submit()">
      <a-descriptions class="mold-dialog-summary" :column="1" size="small">
        <a-descriptions-item :label="$t('label.zone')">{{ target.zonename || '—' }} · {{ target.zoneid }}</a-descriptions-item>
        <a-descriptions-item :label="$t('label.asnumber')">{{ target.asnumber }}</a-descriptions-item>
        <a-descriptions-item :label="$t('label.id')">{{ target.id }}</a-descriptions-item>
        <a-descriptions-item :label="$t('label.allocationstate')">{{ $t('label.asn.state.allocated') }}</a-descriptions-item>
        <a-descriptions-item :label="$t('label.network')">{{ target.associatednetworkname || target.associatednetworkid || '—' }}</a-descriptions-item>
        <a-descriptions-item :label="$t('label.vpc')">{{ target.vpcname || target.vpcid || '—' }}</a-descriptions-item>
      </a-descriptions>
      <a-alert type="warning" show-icon :message="$t('message.asn.release.impact')" />
      <a-alert v-if="message" role="status" type="info" show-icon :message="$t('message.asn.release.' + message)" />
      <a-alert v-if="error || !allowed" role="alert" type="error" show-icon :message="error || $t('message.asn.release.permission')" />
      <a-button v-if="!busy" @click="recheck">{{ $t('label.asn.range.recheck') }}</a-button>
      <template v-if="operation && !operation.accepted && !busy && observedAllocated">
        <a-checkbox v-model:checked="acknowledged">{{ $t('message.asn.release.acknowledge') }}</a-checkbox>
        <a-button :disabled="!acknowledged" @click="endTracking">{{ $t('label.asn.range.endtracking') }}</a-button>
      </template>
      <MoldDialogActions :busy="busy">
        <a-button @click="cancel">{{ $t('label.cancel') }}</a-button>
        <a-button type="primary" danger :loading="busy" :disabled="!ready || !allowed || !!operation" @keydown.ctrl.enter.prevent="!$event.repeat && submit()" @click="submit">{{ $t('label.action.release.asnumber') }}</a-button>
      </MoldDialogActions>
    </div>
  </MoldDialog>
</template>
<script>
import { getAPI, postAPI } from '@/api'
import { asnAuth } from '@/utils/asnSearch'
import { asnCanRelease, asnReleaseReason, asnReleaseRead, asnAllocationMatches, asnReleaseOperation, asnStartRelease, asnClearRelease } from '@/utils/asnOperations'
import MoldDialog from './MoldDialog'
import MoldDialogActions from './MoldDialogActions'
export default {
  components: { MoldDialog, MoldDialogActions },
  props: { target: { type: Object, required: true }, context: { type: String, required: true }, operationKey: { type: String, required: true } },
  emits: ['cancel', 'complete'],
  data () { return { checking: false, ready: false, message: '', error: '', acknowledged: false, observedAllocated: false, disposed: false, auth: asnAuth(this.$store), operation: asnReleaseOperation(this.operationKey) || null } },
  computed: {
    allowed () { return this.$store.getters.userInfo?.roletype === 'Admin' && ['listASNumbers', 'releaseASNumber'].every(k => k in this.$store.getters.apis) },
    busy () { return this.checking || !!this.operation?.busy }
  },
  created () { if (!this.operation?.busy) this.recheck() },
  beforeUnmount () { this.disposed = true },
  methods: {
    current () { return !this.disposed && this.allowed && this.auth === asnAuth(this.$store) && this.context === this.$route.fullPath },
    cancel () { if (!this.busy) this.$emit('cancel') },
    async recheck () {
      if (this.busy || !this.current()) return
      this.checking = true; this.ready = false; this.error = ''; this.acknowledged = false; this.observedAllocated = false
      try {
        const row = await asnReleaseRead(getAPI, this.target, () => this.current())
        if (!this.current()) return
        if (row.allocationstate === 'Free' && this.operation) { const accepted = this.operation.accepted; asnClearRelease(this.operationKey); this.$emit('complete', { accepted }); return }
        this.observedAllocated = row.allocationstate === 'Allocated' && asnAllocationMatches(this.target, row)
        this.ready = asnCanRelease(row, this.$store.getters) && this.observedAllocated && !this.operation
        this.message = this.operation ? this.operation.accepted ? 'refreshfailed' : 'uncertain' : this.observedAllocated ? asnReleaseReason(row) : 'changed'
      } catch (_) { if (this.current()) this.error = this.$t('message.asn.release.lookup') } finally { if (!this.disposed) this.checking = false }
    },
    async submit () {
      if (this.busy || !this.ready || this.operation || !this.current()) return
      this.checking = true; this.ready = false; this.error = ''
      let operation
      try {
        const row = await asnReleaseRead(getAPI, this.target, () => this.current())
        if (!asnCanRelease(row, this.$store.getters) || !asnAllocationMatches(this.target, row)) { this.message = 'changed'; return }
        if (!this.current()) return
        operation = asnStartRelease(this.operationKey); this.operation = operation
        const receipt = await postAPI('releaseASNumber', { zoneid: this.target.zoneid, asnumber: this.target.asnumber }, { preserveOnFailure: true, timeout: 20000 })
        if (receipt?.releaseasnumberresponse?.success !== true) throw Error('receipt')
        operation.accepted = true
        if (!this.current()) return
        const after = await asnReleaseRead(getAPI, this.target, () => this.current())
        if (after.allocationstate !== 'Free') throw Error('unverified')
        if (!this.current()) return
        asnClearRelease(this.operationKey); this.$emit('complete', { accepted: true })
      } catch (error) {
        const failure = error?.response?.data?.releaseasnumberresponse || error?.response?.data?.errorresponse
        if (operation && !operation.accepted && [401, 403, 431, 432, 435, 436].includes(failure?.errorcode)) {
          asnClearRelease(this.operationKey)
          if (this.current()) { this.operation = null; this.error = failure.errortext || this.$t('message.asn.release.rejected') }
        } else if (this.current()) { this.message = operation ? operation.accepted ? 'refreshfailed' : 'uncertain' : 'lookup' }
      } finally { if (operation) operation.busy = false; if (!this.disposed) this.checking = false }
    },
    endTracking () { if (this.current() && !this.busy && this.operation && !this.operation.accepted && this.observedAllocated && this.acknowledged) { asnClearRelease(this.operationKey); this.$emit('cancel') } }
  }
}
</script>
<style scoped>
.asn-release-dialog { overflow-wrap: anywhere; color: var(--ui-text-primary); }
.asn-release-dialog :deep(.ant-alert) { margin-bottom: 16px; }
.asn-release-dialog :deep(.ant-checkbox-wrapper) { display: block; margin: 12px 0; }
</style>
