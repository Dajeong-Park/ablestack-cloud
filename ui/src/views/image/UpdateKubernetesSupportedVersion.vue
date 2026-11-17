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
  <mold-dialog size="md" focus-guard :title="$t(deletion ? 'label.kubernetes.version.delete' : 'label.kubernetes.version.update')" :closable="!blocksNavigation" :keyboard="!blocksNavigation" @cancel="close">
    <div class="kiso-mutation" v-ctrl-enter="submit">
      <a-alert v-if="errorKey" type="error" show-icon role="alert" :message="$t(errorKey)" />
      <a-alert v-if="receipt && !blocksNavigation && errorKey !== 'message.kubernetes.iso.mutation.uncertain'" type="warning" show-icon :message="$t('message.kubernetes.iso.mutation.uncertain')" />
      <a-spin :spinning="reading || blocksNavigation">
        <dl class="kiso-mutation-target">
          <dt>{{ $t('label.name') }}</dt><dd>{{ shown.name || '—' }}</dd>
          <dt>{{ $t('label.semanticversion') }}</dt><dd>{{ shown.semanticversion || '—' }}</dd>
          <dt>{{ $t('label.id') }}</dt><dd>{{ resource.id }}</dd>
          <dt>{{ $t('label.state') }}</dt><dd>{{ shown.state ? stateLabel(shown.state) : '—' }}</dd>
          <template v-if="deletion">
            <dt>{{ $t('label.kubernetes.iso.child.id') }}</dt><dd>{{ shown.isoid || '—' }}</dd>
            <dt>{{ $t('label.kubernetes.iso.mutation.references') }}</dt><dd>{{ $t(!snapshot ? 'message.kubernetes.iso.mutation.references.unknown' : snapshot.isreferenced ? 'message.kubernetes.iso.mutation.references.used' : 'message.kubernetes.iso.mutation.references.free') }}</dd>
          </template>
        </dl>
        <a-alert v-if="deletion" type="warning" show-icon :message="$t('message.kubernetes.iso.mutation.delete.impact')" />
        <a-form v-else layout="vertical">
          <a-form-item :label="$t('label.kubernetes.iso.mutation.next.state')" html-for="kiso-next-state">
            <a-select id="kiso-next-state" v-model:value="nextState" :disabled="reading || blocksNavigation || !!receipt || !snapshot" :aria-label="$t('label.kubernetes.iso.mutation.next.state')">
              <a-select-option v-for="state in ['Enabled', 'Disabled']" :key="state" :value="state" :label="stateLabel(state)">{{ stateLabel(state) }}</a-select-option>
            </a-select>
          </a-form-item>
        </a-form>
      </a-spin>
    </div>
    <template #footer>
      <a-button :disabled="blocksNavigation" @click="close">{{ $t('label.cancel') }}</a-button>
      <a-button :loading="reading" :disabled="blocksNavigation || reading" @click="refresh">{{ $t(receipt ? 'label.kubernetes.iso.mutation.check' : 'label.refresh') }}</a-button>
      <a-button type="primary" :danger="deletion" :disabled="!canSubmit" :loading="blocksNavigation" @click="submit">{{ $t(deletion ? 'label.delete' : 'label.ok') }}</a-button>
    </template>
  </mold-dialog>
</template>
<script>
import { getAPI, postAPI } from '@/api'
import MoldDialog from '@/components/view/MoldDialog.vue'
import { canKubernetesIsoAction, kubernetesIsoCapability } from '@/utils/kubernetesIsoCapabilities'
import { kubernetesIsoFailure, kubernetesIsoWriteResponse } from '@/utils/kubernetesIsoModel'
import { saveKubernetesMutation, kubernetesMutationScope, kubernetesMutationReceipt, beginKubernetesMutation, finishKubernetesMutation, kubernetesMutationSnapshot, kubernetesMutationParams, kubernetesMutationJob } from '@/utils/kubernetesIsoMutation'
export default {
  name: 'UpdateKubernetesSupportedVersion',
  components: { MoldDialog },
  props: { resource: { type: Object, required: true }, currentAction: { type: Object, default: () => ({}) } },
  emits: ['refresh-data', 'close-action'],
  data: () => ({ snapshot: null, nextState: '', reading: false, blocksNavigation: false, receipt: null, errorKey: '', generation: 0, disposed: false, pollTimer: null }),
  computed: {
    deletion () { return this.currentAction.api === 'deleteKubernetesSupportedVersion' },
    operation () { return this.deletion ? 'delete' : 'update' },
    context () { return kubernetesMutationScope(this.$store.getters, this.$store.state?.user?.token, this.resource.id) },
    shown () { return this.snapshot || this.resource },
    canSubmit () {
      if (this.reading || this.blocksNavigation || this.receipt || !this.snapshot) return false
      try { kubernetesMutationParams(this.operation, this.snapshot, this.nextState, this.$store.getters); return true } catch (_) { return false }
    }
  },
  watch: { context () { this.generation++; clearTimeout(this.pollTimer); this.snapshot = null; this.receipt = null; this.blocksNavigation = false; this.reading = false; this.nextState = ''; this.refresh() } },
  mounted () { this.refresh() },
  beforeUnmount () { this.disposed = true; this.generation++; clearTimeout(this.pollTimer) },
  methods: {
    stateLabel (state) { return this.$t('label.kubernetes.iso.version.' + (state === 'Enabled' ? 'enabled' : state === 'Disabled' ? 'disabled' : 'unknown')) },
    current (scope, generation) { return !this.disposed && this.context === scope && this.generation === generation },
    readOptions () { return { preserveOnFailure: true, timeout: 30000, readScope: JSON.stringify([this.$store.state?.user?.token, this.$store.getters.userInfo?.id, this.$store.getters.project?.id]) } },
    failure (error) { return error?.message?.startsWith('message.kubernetes.iso.') ? error.message : 'message.kubernetes.iso.read.' + kubernetesIsoFailure(error) },
    async read () {
      if (!canKubernetesIsoAction('read', this.resource, this.$store.getters) || !canKubernetesIsoAction(this.operation, this.resource, this.$store.getters)) throw new Error('message.kubernetes.iso.read.forbidden')
      if (this.deletion && !kubernetesIsoCapability('read', this.$store.getters).parameters.showreferences) throw new Error('message.kubernetes.iso.mutation.references.unknown')
      const json = await getAPI('listKubernetesSupportedVersions', { id: this.resource.id, ...(this.deletion ? { showreferences: true } : {}) }, this.readOptions())
      return kubernetesMutationSnapshot(json, this.$store.getters, this.resource.id, this.deletion)
    },
    async refresh () {
      if (this.reading || this.blocksNavigation) return
      const scope = this.context; const generation = ++this.generation
      this.reading = true; this.errorKey = ''; this.snapshot = null
      this.receipt = kubernetesMutationReceipt(scope) || null
      try {
        if (this.receipt?.jobid) {
          this.blocksNavigation = true
          return await this.poll(scope, generation, this.receipt)
        }
        const record = await this.read()
        if (!this.current(scope, generation)) return
        if (this.receipt) {
          if (this.receipt.operation === 'delete' && !record || this.receipt.operation === 'update' && record?.state === this.receipt.state) return this.complete(scope, this.receipt)
          this.errorKey = 'message.kubernetes.iso.mutation.uncertain'
        }
        if (!record) { this.errorKey = 'message.kubernetes.iso.read.missing'; return }
        this.snapshot = record; this.nextState = record.state
      } catch (error) { if (this.current(scope, generation)) this.errorKey = this.failure(error) } finally { if (this.current(scope, generation)) { this.reading = false; this.blocksNavigation = false } }
    },
    async submit (event) {
      if (event?.preventDefault) event.preventDefault()
      if (!this.canSubmit) return
      const scope = this.context; const generation = ++this.generation
      const previous = this.snapshot; const desired = this.nextState
      this.blocksNavigation = true; this.errorKey = ''
      let receipt
      try {
        const record = await this.read()
        if (!this.current(scope, generation)) return
        if (!record) { this.snapshot = null; throw new Error('message.kubernetes.iso.read.missing') }
        this.snapshot = record
        if (record.state !== previous.state || record.isoid !== previous.isoid) { this.nextState = record.state; throw new Error('message.kubernetes.iso.mutation.changed') }
        const params = kubernetesMutationParams(this.operation, record, desired, this.$store.getters)
        receipt = beginKubernetesMutation(scope, this.operation, record, desired); this.receipt = receipt
        const json = await postAPI(this.deletion ? 'deleteKubernetesSupportedVersion' : 'updateKubernetesSupportedVersion', params, this.readOptions())
        if (!this.current(scope, generation)) return
        if (this.deletion) {
          const id = json?.deletekubernetessupportedversionresponse?.jobid
          if (typeof id !== 'string' || !/^[a-f0-9-]{36}$/i.test(id)) throw new Error('message.kubernetes.iso.read.invalid')
          receipt.jobid = id; receipt.status = 'pending'; saveKubernetesMutation(scope, receipt)
          await this.poll(scope, generation, receipt)
        } else {
          const updated = kubernetesIsoWriteResponse(json, 'update', this.$store.getters)
          if (updated.id !== record.id || updated.state !== desired) throw new Error('message.kubernetes.iso.read.invalid')
          const fresh = await this.read()
          if (!this.current(scope, generation)) return
          if (!fresh || fresh.state !== desired) throw new Error('message.kubernetes.iso.mutation.uncertain')
          this.complete(scope, receipt)
        }
      } catch (error) {
        if (!this.current(scope, generation)) return
        const root = Object.values(error?.response?.data || {}).find(body => body && typeof body === 'object' && body.errorcode)
        const changed = typeof root?.errortext === 'string' && root.errortext.startsWith('Kubernetes version state changed;')
        // A validated explicit command rejection is a known failure. Transport,
        // malformed receipts and lost reads remain blocked until reconciled.
        if (receipt && (changed || [401, 403, 431, 432, 531].includes(Number(root?.errorcode))) && !receipt.jobid) { finishKubernetesMutation(scope, receipt); this.receipt = null }
        if (changed) {
          try {
            const latest = await this.read()
            if (!this.current(scope, generation)) return
            this.snapshot = latest; this.nextState = latest?.state || ''
          } catch (_) { if (!this.current(scope, generation)) return; this.snapshot = null }
        }
        this.errorKey = changed ? 'message.kubernetes.iso.mutation.changed' : receipt && this.receipt ? 'message.kubernetes.iso.mutation.uncertain' : this.failure(error)
        if (receipt && this.receipt) { receipt.status = 'uncertain'; saveKubernetesMutation(scope, receipt) }
      } finally { if (this.current(scope, generation)) this.blocksNavigation = false }
    },
    async poll (scope, generation, receipt) {
      for (let attempt = 0; attempt < 60 && this.current(scope, generation); attempt++) {
        if (!this.$store.getters.apis?.queryAsyncJobResult) throw new Error('message.kubernetes.iso.read.forbidden')
        const json = await getAPI('queryAsyncJobResult', { jobid: receipt.jobid }, this.readOptions())
        if (!this.current(scope, generation)) return
        const job = kubernetesMutationJob(json, receipt.jobid)
        if (job.status !== 0) {
          const record = await this.read()
          if (!this.current(scope, generation)) return
          if (!record) return this.complete(scope, receipt)
          this.snapshot = record; this.nextState = record.state
          if (job.status === 2) {
            finishKubernetesMutation(scope, receipt); this.receipt = null
            this.errorKey = 'message.kubernetes.iso.mutation.delete.failed'
            this.$emit('refresh-data')
            return
          }
          throw new Error('message.kubernetes.iso.mutation.uncertain')
        }
        await new Promise(resolve => { this.pollTimer = setTimeout(resolve, 2000) })
      }
      if (this.current(scope, generation)) { receipt.status = 'uncertain'; saveKubernetesMutation(scope, receipt); this.errorKey = 'message.kubernetes.iso.mutation.uncertain' }
    },
    complete (scope, receipt) {
      finishKubernetesMutation(scope, receipt); this.receipt = null
      this.$message.success(this.$t(receipt.operation === 'delete' ? 'message.kubernetes.iso.mutation.deleted' : 'message.success.update.kubeversion'))
      this.$emit('close-action', receipt.operation === 'delete' ? { removed: [receipt.id] } : undefined)
      this.$emit('refresh-data')
    },
    close () { if (!this.blocksNavigation) this.$emit('close-action') }
  }
}
</script>
<style scoped lang="less">
.kiso-mutation { display: grid; gap: 16px; }
.kiso-mutation-target { display: grid; grid-template-columns: minmax(100px, 1fr) minmax(0, 3fr); gap: 12px 20px; margin: 0 0 20px; }
.kiso-mutation-target dt { color: var(--ui-text-secondary); }
.kiso-mutation-target dd { margin: 0; overflow-wrap: anywhere; }
@media (max-width: 575px) { .kiso-mutation-target { grid-template-columns: 1fr; gap: 6px; } .kiso-mutation-target dd { margin-bottom: 10px; } }
</style>
