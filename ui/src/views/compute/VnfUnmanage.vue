<!--
Licensed to the Apache Software Foundation (ASF) under one
or more contributor license agreements. See the NOTICE file
distributed with this work for additional information
regarding copyright ownership. The ASF licenses this file
to you under the Apache License, Version 2.0 (the
"License"); you may not use this file except in compliance
with the License. You may obtain a copy of the License at
//
http://www.apache.org/licenses/LICENSE-2.0
//
Unless required by applicable law or agreed to in writing,
software distributed under the License is distributed on an
"AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, either express or implied. See the License for the
specific language governing permissions and limitations
under the License.
-->
<template>
  <section class="vnf-unmanage" v-ctrl-enter="submit">
    <p><strong>{{ vmDisplayName(resource) }}</strong> <small>{{ resource.id }}</small></p>
    <a-alert type="warning" show-icon :message="$t('message.vnf.action.unmanage.warning')" />
    <a-alert v-if="error" type="error" show-icon :message="error" />
    <a-alert v-if="succeeded" type="success" show-icon :message="$t('message.vnf.action.unmanage.success')" />
    <a-spin :spinning="loading">
      <template v-if="preview && !operation && !succeeded">
        <dl><dt>{{ $t('label.host') }}</dt><dd>{{ preview.host.name }} / {{ preview.host.id }}</dd>
          <dt>{{ $t('label.volumes') }}</dt><dd v-for="volume in preview.volumes" :key="volume.id">{{ volume.name }} / {{ volume.id }}</dd></dl>
        <p>{{ $t(preview.preserveNics ? 'message.vnf.action.unmanage.nics.preserve' : 'message.vnf.action.unmanage.nics.release') }}</p>
        <p>{{ $t('message.vnf.action.unmanage.limits') }}</p>
        <a-checkbox v-model:checked="acknowledged" :disabled="loading">{{ $t('message.vnf.action.unmanage.ack') }}</a-checkbox>
      </template>
    </a-spin>
    <p v-if="operation" role="status">{{ $t(operation.jobid ? 'message.vnf.reinstall.pending' : 'message.vnf.reinstall.unknown') }} <span v-if="operation.jobid">{{ operation.jobid }}</span></p>
    <p v-if="succeeded">{{ $t('message.vnf.action.unmanage.host.remains') }}</p>
    <mold-dialog-actions :busy="loading || posting">
      <a-button @click="close">{{ $t(succeeded ? 'label.vnf.action.back' : 'label.close') }}</a-button>
      <a-button v-if="!succeeded" :loading="loading || querying" :disabled="posting" @click="recheck">{{ $t(operation ? 'label.vnf.reinstall.track' : 'label.refresh') }}</a-button>
      <a-button v-if="!succeeded" type="primary" danger :disabled="!canSubmit" @click="submit">{{ $t('label.action.unmanage.virtualmachine') }}</a-button>
    </mold-dialog-actions>
  </section>
</template>
<script>
import { getAPI, postAPI } from '@/api'
import MoldDialogActions from '@/components/view/MoldDialogActions'
import { vmDisplayName } from '@/utils/vmIdentity'
import { vnfNoticeScope } from '@/utils/vnfAccess'
import { vnfUnmanageApis, vnfUnmanageJobs, vnfOwner, vnfUnmanageReason, readVnfUnmanagePreview, readVnfUnmanageJobs, vnfUnmanageRevision } from '@/utils/vnfVmActions'

export default {
  name: 'VnfUnmanage',
  components: { MoldDialogActions },
  props: { resource: { type: Object, required: true }, action: { type: Object, default: () => ({}) } },
  inject: { resourceActionReady: { default: () => () => true } },
  data () { return { target: { id: this.resource.id, account: this.resource.account, domainid: this.resource.domainid, projectid: this.resource.projectid }, origin: '', disposed: false, generation: 0, preview: null, acknowledged: false, loading: false, posting: false, querying: false, operation: null, error: '', succeeded: false } },
  computed: {
    actor () { return JSON.stringify([this.$store.getters.userInfo?.id, this.$store.getters.project?.id, vnfOwner(this.target)]) },
    context () { return JSON.stringify([this.resource.id, vnfOwner(this.resource), this.$route.fullPath, vnfNoticeScope(this.$store), this.$store.getters.userInfo?.roletype, vnfUnmanageApis.map(api => !!this.$store.getters.apis?.[api])]) },
    canSubmit () { return this.current() && !this.loading && !this.posting && !this.operation && this.resourceActionReady() && this.acknowledged && this.preview && !vnfUnmanageReason(this.preview.vm, this.$store.getters) }
  },
  watch: { context: { flush: 'sync', handler () { this.invalidate(); this.error = this.$t('message.vnf.reinstall.context') } } },
  created () { this.origin = this.context; this.load() },
  beforeUnmount () { this.invalidate() },
  deactivated () { this.invalidate() },
  methods: {
    vmDisplayName,
    current () { return !this.disposed && this.origin === this.context && this.action.currentAction?.vnfUnmanageCurrent?.() !== false },
    invalidate () { this.disposed = true; this.generation++; clearTimeout(this.timer); this.preview = null; this.acknowledged = false },
    close () { const done = this.succeeded; this.invalidate(); this.$emit('close-action'); if (done) this.$router.replace('/vnfapp') },
    message (e) { return e?.message?.startsWith('message.') ? this.$t(e.message) : e?.response?.data?.errorresponse?.errortext || e?.response?.data?.unmanagevirtualmachineresponse?.errortext || this.$t('message.vnf.action.lookup.failed') },
    async load () {
      if (!this.current() || this.loading || this.posting) return
      const op = vnfUnmanageJobs.get(this.target.id)
      if (op) { if (op.actor !== this.actor) { this.error = this.$t('message.vnf.action.busy'); return }; this.operation = op; return this.recheck() }
      this.loading = true; this.error = ''; this.preview = null; this.acknowledged = false
      const version = this.generation
      try { const p = await readVnfUnmanagePreview(this.target, this.$store.getters); if (this.current() && version === this.generation) this.preview = p } catch (e) { if (this.current()) this.error = this.message(e) } finally { if (this.current()) this.loading = false }
    },
    async submit () {
      if (!this.canSubmit || vnfUnmanageJobs.has(this.target.id)) return
      const op = { phase: 'checking', actor: this.actor }
      vnfUnmanageJobs.set(this.target.id, op); this.operation = op; this.loading = true; this.error = ''
      try {
        const p = await readVnfUnmanagePreview(this.target, this.$store.getters)
        if (vnfUnmanageRevision(p) !== vnfUnmanageRevision(this.preview)) throw new Error('message.vnf.reinstall.changed')
        if (!this.current() || !this.resourceActionReady()) return
        Object.assign(op, { phase: 'sending', hostid: p.vm.hostid, beforeJobs: p.jobs.map(j => j.jobid || j.id) }); this.posting = true
        const json = await postAPI('unmanageVirtualMachine', { id: this.target.id }, { preserveOnFailure: true, timeout: 30000 })
        op.jobid = json?.unmanagevirtualmachineresponse?.jobid; op.phase = op.jobid ? 'accepted' : 'unknown'
        if (!op.jobid) throw new Error('message.vnf.reinstall.unknown')
        if (this.current()) this.query()
      } catch (e) {
        if (op.phase === 'checking' || op.phase === 'sending' && Object.values(e?.response?.data || {}).some(r => r?.errorcode)) vnfUnmanageJobs.delete(this.target.id)
        else if (!op.jobid) op.phase = 'unknown'
        if (this.current()) this.error = this.message(e)
      } finally {
        if (op.phase === 'checking') vnfUnmanageJobs.delete(this.target.id)
        if (this.current()) { this.operation = vnfUnmanageJobs.get(this.target.id) || null; this.loading = false; this.posting = false }
      }
    },
    async query () {
      const op = vnfUnmanageJobs.get(this.target.id)
      if (!this.current() || !op?.jobid || op.actor !== this.actor || this.querying) return
      this.querying = true; this.error = ''; clearTimeout(this.timer)
      try {
        const json = await getAPI('queryAsyncJobResult', { jobid: op.jobid }, { preserveOnFailure: true, backgroundJob: true, timeout: 15000 })
        if (!this.current() || vnfUnmanageJobs.get(this.target.id) !== op) return
        const job = json?.queryasyncjobresultresponse
        if (Number(job?.jobstatus) === 0) { this.timer = setTimeout(() => this.query(), 2000); return }
        if (Number(job?.jobstatus) === 2) { vnfUnmanageJobs.delete(this.target.id); this.operation = null; this.error = job.jobresult?.errortext || this.$t('message.vnf.reinstall.job.failed'); return }
        const result = job?.jobresult?.unmanagevirtualmachineresponse || job?.jobresult
        if (Number(job?.jobstatus) !== 1 || result?.result !== true || result.hostid !== op.hostid || job.jobinstanceid && job.jobinstanceid !== this.target.id) throw new Error('message.vnf.reinstall.result.unknown')
        const params = { id: this.target.id, listall: true, ...(this.target.projectid ? { projectid: this.target.projectid } : {}) }
        const [vms, vnfs] = await Promise.all([getAPI('listVirtualMachines', params, { preserveOnFailure: true }), getAPI('listVnfAppliances', params, { preserveOnFailure: true })])
        if (!this.current()) return
        const bodies = [vms?.listvirtualmachinesresponse, vnfs?.listvnfappliancesresponse]
        if (bodies.some(b => !b || b.errorcode || Number(b.count || 0) !== 0 || b.virtualmachine?.length || b.vnfappliance?.length)) throw new Error('message.vnf.reinstall.result.unknown')
        vnfUnmanageJobs.delete(this.target.id); this.operation = null; this.succeeded = true
      } catch (e) { if (this.current()) this.error = this.message(e) } finally { this.querying = false }
    },
    async recheck () {
      if (!this.current() || this.posting || this.loading || this.querying) return
      const op = vnfUnmanageJobs.get(this.target.id)
      if (!op) return this.load()
      if (op.actor !== this.actor) return
      if (op.jobid) return this.query()
      if (!op.beforeJobs) return
      this.loading = true
      try {
        const jobs = await readVnfUnmanageJobs(this.target)
        if (!this.current()) return
        const matches = jobs.filter(j => !op.beforeJobs.includes(j.jobid || j.id) && /UnmanageVMInstanceCmd/.test(j.cmd || ''))
        if (matches.length !== 1) throw new Error('message.vnf.reinstall.unknown')
        op.jobid = matches[0].jobid || matches[0].id; op.phase = 'accepted'; this.operation = op
      } catch (e) { if (this.current()) this.error = this.message(e) } finally { if (this.current()) this.loading = false }
      if (op.jobid) this.query()
    }
  }
}
</script>
<style scoped>
.vnf-unmanage p, .vnf-unmanage dd { overflow-wrap: anywhere; }
.vnf-unmanage .ant-alert, .vnf-unmanage dl { margin-bottom: 16px; }
</style>
