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
  <mold-dialog :title="$t('label.action.download.iso')" size="md" focus-guard :closable="!busy" :keyboard="!busy" @cancel="close">
    <div @keydown.ctrl.enter.stop.prevent="prepare">
      <dl class="template-dialog-context"><dt>{{ $t('label.name') }}</dt><dd>{{ resource.name }}</dd><dt>{{ $t('label.id') }}</dt><dd>{{ resource.id }}</dd></dl>
      <a-form-item :label="$t('label.zone')" :html-for="'iso-download-'+resource.id"><a-select :id="'iso-download-'+resource.id" v-model:value="zoneid" :options="zones.map(z=>({value:z.zoneid,label:z.zonename || z.zoneid}))" :disabled="busy || phase!=='confirm'" :loading="loading" /></a-form-item>
      <a-alert v-if="error" type="error" show-icon :message="$t(error)" />
      <a-alert v-if="phase!=='confirm'" type="info" show-icon :message="$t('message.iso.download.'+phase)" />
      <a-alert v-if="requested" type="info" show-icon :message="$t('message.iso.download.requested')" />
    </div>
    <template #footer>
      <a-button :disabled="busy" @click="close">{{ $t('label.close') }}</a-button>
      <a-button v-if="phase==='confirm' || phase==='failed' || phase==='ready'" :loading="busy" :disabled="loading || !allowed || !zoneid || !zones.length" @click="prepare">{{ $t(phase==='confirm'?'label.iso.download.prepare':'label.iso.download.reprepare') }}</a-button>
      <a-button v-if="phase==='unknown' && jobid" :loading="busy" @click="check">{{ $t('label.iso.check.status') }}</a-button>
      <a-button v-if="phase==='ready' && result" type="primary" :href="result.url" target="_blank" rel="noopener noreferrer" @click="requested=true">{{ $t('label.iso.download.receive') }}</a-button>
    </template>
  </mold-dialog>
</template>
<script>
import { getAPI, postAPI } from '@/api'
import MoldDialog from '@/components/view/MoldDialog'
import { canIsoAction, isoContext, isoBoolean } from '@/utils/isoModel'
import { readOwnedIsoZones } from '@/utils/isoZoneOperations'
import { isoDownloadResult } from '@/utils/isoConsumption'
export default {
  name: 'IsoDownload',
  components: { MoldDialog },
  props: { resource: { type: Object, required: true } },
  emits: ['close-action'],
  data () { return { phase: 'confirm', loading: true, busy: false, zones: [], zoneid: '', error: '', jobid: '', result: null, requested: false, epoch: 0 } },
  computed: {
    allowed () { return canIsoAction('download', this.resource, this.$store.getters) },
    context () { return JSON.stringify([isoContext(this.resource, this.$store.getters), this.$store.state.user.token]) }
  },
  watch: { context () { this.invalidate(); this.$emit('close-action') } },
  created () { this.load() },
  beforeUnmount () { this.invalidate() },
  methods: {
    invalidate () { this.epoch++; this.result = null; this.jobid = ''; this.busy = false },
    current (epoch) { return epoch === this.epoch && this.allowed },
    close () { if (!this.busy) { this.invalidate(); this.$emit('close-action') } },
    async load () {
      const epoch = this.epoch
      try {
        if (!this.allowed) return
        const rows = await readOwnedIsoZones(getAPI, this.resource, this.$store.getters, () => this.current(epoch))
        if (!this.current(epoch)) return
        this.zones = [...new Map(rows.filter(r => r.zoneid && canIsoAction('download', r, this.$store.getters)).map(r => [r.zoneid, r])).values()]
        this.zoneid = this.zones.find(z => z.zoneid === this.resource.zoneid)?.zoneid || this.zones[0]?.zoneid || ''
        if (!this.zoneid) this.error = 'message.iso.action.unavailable'
      } catch (_) { if (this.current(epoch)) this.error = 'message.iso.download.read.failed' } finally { if (epoch === this.epoch) this.loading = false }
    },
    async prepare () {
      if (this.busy || this.loading || !this.allowed || !['confirm', 'failed', 'ready'].includes(this.phase) || !this.zones.some(z => z.zoneid === this.zoneid)) return
      const epoch = this.epoch; this.busy = true; this.error = ''; this.result = null; this.requested = false; this.jobid = ''; this.phase = 'preparing'
      let posted = false
      try {
        const rows = await readOwnedIsoZones(getAPI, this.resource, this.$store.getters, () => this.current(epoch)); if (!this.current(epoch)) return
        if (!rows.some(r => r.zoneid === this.zoneid && isoBoolean(r.isready) === true && canIsoAction('download', r, this.$store.getters))) throw new Error('unavailable')
        posted = true
        const response = await postAPI('extractIso', { id: this.resource.id, zoneid: this.zoneid, mode: 'HTTP_DOWNLOAD' }, { preserveOnFailure: true })
        if (!this.current(epoch)) return
        this.jobid = response.extractisoresponse?.jobid || ''
        if (!this.jobid) { this.phase = 'unknown'; return }
        await this.observe(epoch)
      } catch (e) {
        if (this.current(epoch)) {
          const d = e.response?.data; const rejected = Object.values(d || {}).some(v => v?.errorcode) || (e.response?.status >= 400 && e.response?.status < 500 && e.response.status !== 408)
          this.phase = this.jobid ? 'unknown' : !posted || rejected ? 'failed' : 'unknown'; this.error = 'message.iso.download.failed'
        }
      } finally { if (this.current(epoch)) this.busy = false }
    },
    async observe (epoch) {
      const deadline = Date.now() + 60000
      while (this.current(epoch)) {
        const d = (await getAPI('queryAsyncJobResult', { jobid: this.jobid }, { preserveOnFailure: true, timeout: 10000 })).queryasyncjobresultresponse
        if (!this.current(epoch)) return
        if (d?.jobstatus === 2) { this.phase = 'failed'; this.error = 'message.iso.download.failed'; return }
        if (d?.jobstatus === 1) {
          this.result = isoDownloadResult(d.jobresult?.iso, this.resource.id, this.zoneid)
          this.phase = this.result ? 'ready' : 'failed'; this.error = this.result ? '' : 'message.iso.download.invalid'; return
        }
        if (d?.jobstatus !== 0 || Date.now() >= deadline) { this.phase = 'unknown'; return }
        await new Promise(resolve => setTimeout(resolve, 1500))
      }
    },
    async check () {
      if (this.busy || !this.jobid || !this.allowed) return
      const epoch = this.epoch; this.busy = true; this.error = ''
      try { await this.observe(epoch) } catch (_) { if (this.current(epoch)) this.phase = 'unknown' } finally { if (this.current(epoch)) this.busy = false }
    }
  }
}
</script>
<style scoped>
.ant-select {width:100%;}
.ant-alert {margin-bottom:12px;}
dd {overflow-wrap:anywhere;}
</style>
