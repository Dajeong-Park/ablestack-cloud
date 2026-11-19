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
  <mold-dialog :visible="true" size="md" formActions focusGuard :title="$t('label.delete.asnrange')" @cancel="cancel">
    <div class="asn-range-delete" @keydown.ctrl.enter.prevent="!$event.repeat && submit()">
      <a-descriptions class="mold-dialog-summary" :column="1" size="small">
        <a-descriptions-item :label="$t('label.zone')">{{ target.zonename }}</a-descriptions-item>
        <a-descriptions-item :label="$t('label.asn.delete.zoneid')">{{ target.zoneid }}</a-descriptions-item>
        <a-descriptions-item :label="$t('label.id')">{{ target.id }}</a-descriptions-item>
        <a-descriptions-item :label="$t('label.asn.range.start')">{{ target.startasn }}</a-descriptions-item>
        <a-descriptions-item :label="$t('label.asn.range.end')">{{ target.endasn }}</a-descriptions-item>
        <a-descriptions-item :label="$t('label.asn.delete.total')">{{ target.count }}</a-descriptions-item>
        <a-descriptions-item :label="$t('label.asn.delete.allocated')"><span role="status">{{ allocated === null ? $t('label.asn.delete.unknown') : allocated }}</span></a-descriptions-item>
      </a-descriptions>
      <a-alert type="warning" show-icon :message="$t('message.asn.delete.impact')" />
      <a-alert v-if="message" role="status" :type="operation?.accepted ? 'warning' : 'info'" show-icon :message="$t('message.asn.delete.' + message)" />
      <a-alert v-if="!allowed" role="alert" type="error" show-icon :message="$t('message.asn.delete.lookup')" />
      <a-alert v-if="error" role="alert" type="error" show-icon :message="error" />
      <a-button v-if="!busy" @click="recheck">{{ $t('label.asn.delete.recheck') }}</a-button>
      <template v-if="operation && exists && !busy && !operation.accepted">
        <a-checkbox v-model:checked="acknowledged">{{ $t('message.asn.delete.acknowledge') }}</a-checkbox>
        <a-button :disabled="!acknowledged" @click="endTracking">{{ $t('label.asn.range.endtracking') }}</a-button>
      </template>
      <mold-dialog-actions :busy="busy">
        <a-button @click="cancel">{{ $t('label.cancel') }}</a-button>
        <a-button type="primary" danger :disabled="!ready || !allowed || !!operation" :loading="busy" @keydown.ctrl.enter.prevent="!$event.repeat && submit()" @click="submit">{{ $t('label.asn.delete.confirm') }}</a-button>
      </mold-dialog-actions>
    </div>
  </mold-dialog>
</template>
<script>
import { getAPI, postAPI } from '@/api'
import { asnCreationContext } from '@/utils/asnRange'
import { deletionOperation, trackDeletion, clearDeletion, deletionPreview, deletionReconciliation } from '@/utils/asnRangeDeletion'
import MoldDialog from '@/components/view/MoldDialog'
import MoldDialogActions from '@/components/view/MoldDialogActions'
export default {
  components: { MoldDialog, MoldDialogActions },
  props: { target: { type: Object, required: true }, context: { type: String, required: true } },
  emits: ['cancel', 'complete'],
  data () {
    return { checking: false, allocated: null, exists: false, ready: false, message: '', error: '', acknowledged: false, disposed: false, operation: deletionOperation(this.context, this.target.id) || null }
  },
  computed: {
    allowed () { return ['deleteASNRange', 'listASNumbers', 'listASNRanges', 'listZones'].every(command => command in this.$store.getters.apis) },
    busy () { return this.checking || !!this.operation?.busy }
  },
  created () { if (!this.operation?.busy) this.recheck() },
  beforeUnmount () { this.disposed = true },
  methods: {
    current () { return !this.disposed && this.allowed && this.context === asnCreationContext(this.$store.getters, this.$store.state?.user?.token, this.target.zoneid) },
    cancel () { if (!this.busy) this.$emit('cancel') },
    async recheck () {
      if (this.busy || !this.current()) return
      this.checking = true; this.ready = false; this.allocated = null; this.error = ''; this.acknowledged = false
      try {
        const observed = await deletionReconciliation(getAPI, this.target, () => this.current())
        if (!this.current()) return
        this.exists = !observed.absent
        if (observed.absent) {
          const accepted = !!this.operation?.accepted
          clearDeletion(this.context, this.target.id)
          this.$emit('complete', { ranges: observed.ranges, accepted })
        } else {
          this.allocated = observed.allocated
          this.ready = observed.allocated === 0
          this.message = this.operation ? (this.operation.accepted ? 'refreshfailed' : 'unknown') : (this.ready ? '' : 'allocated')
        }
      } catch (_) { if (this.current()) this.error = this.$t('message.asn.delete.lookup') } finally { if (!this.disposed) this.checking = false }
    },
    async submit () {
      if (this.busy || !this.ready || this.operation || !this.current()) return
      this.checking = true; this.ready = false; this.error = ''; this.message = ''
      let operation
      try {
        const observed = await deletionPreview(getAPI, this.target, () => this.current())
        if (!this.current()) return
        if (observed.absent) { this.message = 'absent'; return }
        this.allocated = observed.allocated
        if (observed.allocated !== 0) { this.message = 'allocated'; return }
        operation = trackDeletion(this.context, this.target.id); this.operation = operation
        const receipt = await postAPI('deleteASNRange', { id: this.target.id }, { preserveOnFailure: true })
        if (receipt?.deleteasnrangeresponse?.success !== true) throw Error('receipt')
        operation.accepted = true; operation.status = 'accepted'
        if (!this.current()) return
        const after = await deletionReconciliation(getAPI, this.target, () => this.current())
        if (!this.current()) return
        if (!after.absent) throw Error('still exists')
        clearDeletion(this.context, this.target.id)
        this.$emit('complete', { ranges: after.ranges, accepted: true })
      } catch (error) {
        const failure = error?.response?.data?.deleteasnrangeresponse || error?.response?.data?.errorresponse
        if (operation && !operation.accepted && [401, 403, 431, 432, 435, 436].includes(failure?.errorcode)) {
          clearDeletion(this.context, this.target.id)
          if (this.current()) { this.operation = null; this.error = failure.errortext || this.$t('message.asn.delete.rejected') }
        } else if (operation) {
          operation.status = 'unknown'
          if (this.current()) this.message = operation.accepted ? 'refreshfailed' : 'unknown'
        } else if (this.current()) this.error = this.$t('message.asn.delete.lookup')
      } finally {
        if (operation) operation.busy = false
        if (!this.disposed) this.checking = false
      }
    },
    endTracking () {
      if (this.busy || !this.current() || !this.exists || !this.acknowledged || !this.operation || this.operation.accepted) return
      clearDeletion(this.context, this.target.id); this.$emit('cancel')
    }
  }
}
</script>
<style scoped>
.asn-range-delete { overflow-wrap: anywhere; }
.asn-range-delete :deep(.ant-alert) { margin-bottom: 16px; }
.asn-range-delete :deep(.ant-checkbox-wrapper) { display: block; margin: 12px 0; }
</style>
