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
  <vm-iso-manager v-if="selectedVm" :resource="selectedVm" :initial-iso="resource" dialog-only :current-action="{api:'attachIso'}" @close-action="close" />
  <mold-dialog v-else :title="$t('label.iso.attach.vm')" size="md" focus-guard @cancel="close">
    <dl class="template-dialog-context"><dt>{{ $t('label.iso.name') }}</dt><dd>{{ resource.name }}</dd><dt>{{ $t('label.id') }}</dt><dd>{{ resource.id }}</dd></dl>
    <a-alert v-if="error" type="error" show-icon :message="$t('message.iso.consume.read.failed')" />
    <a-form-item :label="$t('label.vm')" :html-for="'iso-target-vm-'+resource.id">
      <a-select :id="'iso-target-vm-'+resource.id" v-model:value="vmid" :loading="loading" show-search option-filter-prop="label" :disabled="loading || error" :options="options" />
    </a-form-item>
    <a-alert v-if="!loading && !error && !vms.length" type="info" show-icon :message="$t('message.iso.consume.vm.empty')" />
    <template #footer><a-button @click="close">{{ $t('label.cancel') }}</a-button><a-button :disabled="loading || error || !vmid || !allowed" type="primary" @click="choose">{{ $t('label.next') }}</a-button></template>
  </mold-dialog>
</template>
<script>
import { getAPI } from '@/api'
import MoldDialog from '@/components/view/MoldDialog'
import VmIsoManager from '@/views/compute/VmIsoManager'
import { canIsoAction, isoContext, isoListResponse, isoBoolean, readIsoResource } from '@/utils/isoModel'
import { attachedIsos, isoActionReason } from '@/utils/vmIsoActions'
export default {
  name: 'IsoVmAttach',
  components: { MoldDialog, VmIsoManager },
  props: { resource: { type: Object, required: true } },
  emits: ['close-action'],
  data () { return { loading: true, error: false, vms: [], vmid: '', selectedVm: null, epoch: 0 } },
  computed: {
    allowed () { return canIsoAction('attach', this.resource, this.$store.getters) },
    context () { return JSON.stringify([isoContext(this.resource, this.$store.getters), this.$store.state.user.token]) },
    options () { return this.vms.map(vm => { const reason = this.reason(vm); return { value: vm.id, label: (vm.displayname || vm.name || vm.id) + ' · ' + (vm.zonename || vm.zoneid) + (reason ? ' · ' + this.$t(reason) : ''), disabled: !!reason } }) }
  },
  watch: { context () { this.epoch++; this.selectedVm = null; this.$emit('close-action') } },
  created () { this.load() },
  beforeUnmount () { this.epoch++ },
  methods: {
    close () { this.epoch++; this.selectedVm = null; this.$emit('close-action') },
    reason (vm) { return attachedIsos(vm).some(i => i.id === this.resource.id) ? 'message.iso.consume.attached' : isoActionReason(vm, true) },
    async load () {
      const epoch = this.epoch; const current = () => epoch === this.epoch && this.allowed
      try {
        if (!this.allowed) return
        const json = await readIsoResource(getAPI, { id: this.resource.id, listall: true, showunique: false }, this.$store.getters, current)
        if (!current()) return
        const zones = new Set(isoListResponse(json).rows.filter(i => i.id === this.resource.id && isoBoolean(i.isready) === true && (!this.resource.zoneid || i.zoneid === this.resource.zoneid)).map(i => i.zoneid).filter(Boolean))
        if (!zones.size) throw new Error('ISO unavailable')
        const rows = []; let count
        for (let page = 1; page <= 100; page++) {
          const d = (await getAPI('listVirtualMachines', { listall: true, page, pagesize: 500, ...(this.$store.getters.project?.id ? { projectid: this.$store.getters.project.id } : {}) }, { preserveOnFailure: true })).listvirtualmachinesresponse
          if (!current()) return
          if (!d || d.errorcode || (d.virtualmachine !== undefined && !Array.isArray(d.virtualmachine))) throw new Error('VM unavailable')
          const batch = d.virtualmachine || []; const total = d.count === undefined ? batch.length : Number(d.count)
          if (!Number.isSafeInteger(total) || total < batch.length || (count !== undefined && count !== total)) throw new Error('Invalid VM count')
          count = total; rows.push(...batch)
          if (rows.length >= count) { this.vms = rows.filter(vm => zones.has(vm.zoneid)); return }
          if (!batch.length || page === 100) throw new Error('Incomplete VM list')
        }
      } catch (_) { if (current()) this.error = true } finally { if (epoch === this.epoch) this.loading = false }
    },
    choose () { const vm = this.vms.find(v => v.id === this.vmid); if (!this.loading && !this.error && this.allowed && vm && !this.reason(vm)) this.selectedVm = vm }
  }
}
</script>
<style scoped>
.ant-select {width:100%;}
.ant-alert {margin-bottom:12px;}
dd {overflow-wrap:anywhere;}
</style>
