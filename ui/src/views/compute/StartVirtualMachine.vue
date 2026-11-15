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
  <section class="vm-start form-layout" v-ctrl-enter="handleSubmit">
    <p ref="targetHeading" tabindex="-1" class="vm-action-target"><strong>{{ vmDisplayName(resource) }}</strong><br /><code>{{ resource.id }}</code></p>
    <a-alert type="warning" show-icon :message="$t('message.action.start.instance')" />
    <a-alert v-if="error" class="vm-start-error" type="error" show-icon :message="error" />
    <p v-if="unknown" role="status">{{ $t('message.vm.start.unknown') }}</p>
    <p v-if="!canStart && !unknown" role="status">{{ $t('message.vm.start.unavailable') }}</p>
    <a-form ref="startForm" :model="form" layout="vertical" @finish="handleSubmit">
      <template v-if="$store.getters.userInfo?.roletype === 'Admin'">
        <a-form-item v-for="key in ['podid', 'clusterid', 'hostid']" :key="key" :name="key" v-show="supports(key)" :label="$t('label.' + key)" :extra="$t('message.vm.start.' + key)">
          <a-select
            :id="'vm-start-' + key"
            :value="form[key]"
            allow-clear
            show-search
            option-filter-prop="label"
            :loading="lookup[key] === 'loading'"
            :disabled="busy || unknown || lookup[key] !== 'ready'"
            :placeholder="$t('message.vm.start.automatic')"
            :options="options[key].map(row => ({ value: row.id, label: row.name || row.id }))"
            @change="value => select(key, value)" />
          <div v-if="['error', 'empty', 'forbidden'].includes(lookup[key])" role="status">{{ $t('message.vm.start.lookup.' + lookup[key]) }}</div>
          <a-button v-if="lookup[key] === 'error'" size="small" :disabled="busy || unknown" @click="fetchPlacement">{{ $t('label.retry') }}</a-button>
        </a-form-item>
        <a-form-item v-if="supports('considerlasthost')" name="considerlasthost" :label="$t('label.considerlasthost')" :extra="$t('message.vm.start.considerlasthost')">
          <a-switch v-model:checked="form.considerlasthost" :disabled="busy || unknown" />
        </a-form-item>
      </template>
      <a-form-item v-if="resource.hypervisor === 'VMware' && supports('bootintosetup')" name="bootintosetup" :label="$t('label.bootintosetup')" :extra="$t('message.vm.start.bootintosetup')">
        <a-switch v-model:checked="form.bootintosetup" :disabled="busy || unknown" />
      </a-form-item>
    </a-form>
    <mold-dialog-actions :busy="busy">
      <a-button @click="closeAction">{{ $t('label.cancel') }}</a-button>
      <a-button type="primary" :loading="busy" :disabled="!canStart || unknown || !selectionReady" @click="handleSubmit">{{ $t('label.action.start.instance') }}</a-button>
    </mold-dialog-actions>
  </section>
</template>
<script>
import { getAPI, postAPI } from '@/api'
import MoldDialogActions from '@/components/view/MoldDialogActions'
import { vmDisplayName, vmEditScope } from '@/utils/vmIdentity'
const descriptors = { podid: ['listPods', 'listpodsresponse', 'pod'], clusterid: ['listClusters', 'listclustersresponse', 'cluster'], hostid: ['listHosts', 'listhostsresponse', 'host'] }
export default {
  name: 'StartVirtualMachine',
  components: { MoldDialogActions },
  props: { resource: { type: Object, required: true }, action: { type: Object, default: () => ({}) } },
  data () { return { form: {}, apiParams: {}, options: { podid: [], clusterid: [], hostid: [] }, lookup: {}, lookupVersion: {}, active: true, generation: 0, submitting: false, error: '', unknown: false } },
  computed: {
    startScope () { return JSON.stringify([vmEditScope(this.resource, this.$route, this.$store), this.resource.zoneid]) },
    busy () { return this.submitting },
    canStart () { return this.active && !!this.$store.state?.user?.token && !!this.resource.id && this.resource.state === 'Stopped' && 'startVirtualMachine' in (this.$store.getters.apis || {}) && (!this.action.currentAction?.vmStartCurrent || this.action.currentAction.vmStartCurrent()) },
    selectionReady () { return Object.keys(descriptors).every(key => !this.form[key] || this.lookup[key] === 'ready' && this.options[key].some(row => row.id === this.form[key])) }
  },
  watch: { startScope () { if (this.active) this.initForm() } },
  created () { this.initForm() },
  mounted () { this.$nextTick(() => { if (this.active && this.$refs.targetHeading) this.$refs.targetHeading.focus() }) },
  activated () { if (!this.active) { this.active = true; this.initForm() } },
  deactivated () { this.invalidate() },
  beforeUnmount () { this.invalidate() },
  methods: {
    vmDisplayName,
    supports (key) { return !!this.apiParams[key] },
    invalidate () { this.active = false; this.generation++; this.submitting = false },
    initForm () {
      this.generation++; this.submitting = false; this.error = ''; this.unknown = false
      this.apiParams = this.$getApiParams('startVirtualMachine') || {}
      this.form = this.supports('considerlasthost') ? { considerlasthost: true } : {}
      this.options = { podid: [], clusterid: [], hostid: [] }; this.lookupVersion = {}; this.lookup = {}
      this.fetchPlacement()
    },
    fetchPlacement () { return Promise.all(Object.keys(descriptors).map(key => this.load(key))) },
    async load (key) {
      const [api, root, field] = descriptors[key]
      const scope = this.startScope; const generation = this.generation; const version = (this.lookupVersion[key] || 0) + 1
      this.lookupVersion[key] = version; this.options[key] = []
      if (!this.active || !this.$store.state?.user?.token || this.$store.getters.userInfo?.roletype !== 'Admin' || !this.supports(key) || !(api in (this.$store.getters.apis || {}))) { this.lookup[key] = 'forbidden'; return }
      const current = () => this.active && scope === this.startScope && generation === this.generation && version === this.lookupVersion[key]
      this.lookup[key] = 'loading'
      const params = { zoneid: this.resource.zoneid, page: 1, pagesize: 500, ignoreproject: true }
      if (key !== 'podid' && this.form.podid) params.podid = this.form.podid
      if (key === 'hostid') { Object.assign(params, { type: 'Routing', state: 'Up' }); if (this.form.clusterid) params.clusterid = this.form.clusterid }
      try {
        const r = (await getAPI(api, params, { preserveOnFailure: true, timeout: 20000 }))?.[root]
        if (!current()) return
        if (!r || r.errorcode || (r.count && !Array.isArray(r[field])) || Number(r.count || 0) > (r[field] || []).length) throw new Error('incomplete lookup')
        this.options[key] = (r[field] || []).filter(row => row.id && (!row.zoneid || row.zoneid === params.zoneid) && (!params.podid || !row.podid || row.podid === params.podid) && (!params.clusterid || !row.clusterid || row.clusterid === params.clusterid))
        this.lookup[key] = this.options[key].length ? 'ready' : 'empty'
      } catch (_) { if (current()) this.lookup[key] = 'error' }
    },
    select (key, value) {
      this.form[key] = value
      if (key === 'podid') { this.form.clusterid = undefined; this.form.hostid = undefined; this.load('clusterid'); this.load('hostid') }
      if (key === 'clusterid') { this.form.hostid = undefined; this.load('hostid') }
    },
    async handleSubmit (event) {
      if (event && typeof event.preventDefault === 'function') event.preventDefault()
      if (this.busy || this.unknown || !this.canStart || !this.selectionReady) return
      if (typeof this.$refs.startForm?.validate !== 'function') return
      const scope = this.startScope; const generation = this.generation
      const current = () => this.active && scope === this.startScope && generation === this.generation && (!this.action.currentAction?.vmStartCurrent || this.action.currentAction.vmStartCurrent())
      this.submitting = true; this.error = ''
      try {
        await this.$refs.startForm?.validate?.()
        if (!current() || !this.canStart || !this.selectionReady) return
        const params = { id: this.resource.id }
        for (const [key, value] of Object.entries(this.form)) if (this.supports(key) && (value || value === false || value === 0)) params[key] = value
        const name = vmDisplayName(this.resource)
        const json = await postAPI('startVirtualMachine', params)
        if (!current()) return
        const jobId = json?.startvirtualmachineresponse?.jobid
        if (!jobId) { this.unknown = true; this.error = this.$t('message.vm.start.unknown'); return }
        this.$pollJob({ jobId, title: this.$t('label.action.start.instance'), description: name, resourceId: params.id, loadingMessage: `${this.$t('label.action.start.instance')} ${name}`, successMessage: `${this.$t('label.action.start.instance')} ${name}`, catchMessage: this.$t('error.fetching.async.job.result') })
        this.$emit('close-action')
      } catch (error) {
        if (!current()) return
        if (error.errorFields?.length) { if (this.$refs.startForm?.scrollToField) this.$refs.startForm.scrollToField(error.errorFields[0].name) } else {
          this.unknown = !error.response || error.response.status >= 500
          this.error = this.unknown ? this.$t('message.vm.start.unknown') : Object.values(error.response?.data || {}).find(value => value?.errortext)?.errortext || this.$t('error.fetching.data')
        }
      } finally { if (current()) this.submitting = false }
    },
    closeAction () { if (!this.busy) { this.invalidate(); this.$emit('close-action') } }
  }
}
</script>
<style scoped>
.form-layout { width: 100%; min-width: 0; max-width: 100%; }
.vm-action-target, .vm-start-error { overflow-wrap: anywhere; margin-bottom: 12px; }
.vm-start .ant-form { margin-top: 16px; }
</style>
