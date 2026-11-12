// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements. See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership. The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License. You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied. See the License for the
// specific language governing permissions and limitations
// under the License.

import { getAPI, postAPI } from '@/api'
import eventBus from '@/config/eventBus'
import { networkError } from './networkLifecycle'

export const lbBackendRemovalMixin = {
  data: () => ({ lbBackendOperation: null, lbBackendVersion: 0, lbBackendDisposed: false, lbBackendSuspended: false }),
  computed: {
    lbBackendScope () {
      const user = this.$store.getters.userInfo || {}
      return JSON.stringify([this.$route.path, this.$route.query?.tab, this.resource?.id, this.resource?.networkid, this.resource?.projectid,
        user.id, user.roleid, user.roletype, user.domainid, this.$store.state?.user?.token,
        this.$store.getters.project?.id, Object.keys(this.$store.getters.apis || {}).sort()])
    },
    lbBackendBusy () { return ['submitting', 'running'].includes(this.lbBackendOperation?.status) },
    lbBackendBlocked () { return this.lbBackendBusy || this.lbBackendOperation?.status === 'unknown' },
    lbBackendAllowed () {
      const apis = this.$store.getters.apis || {}
      const projectId = this.$store.getters.project?.id
      return !this.lbBackendDisposed && !this.lbBackendSuspended && !this.lbBackendBlocked &&
        (!projectId || !this.resource?.projectid || projectId === this.resource.projectid) &&
        ['removeFromLoadBalancerRule', 'queryAsyncJobResult'].every(api => api in apis)
    }
  },
  watch: {
    lbBackendScope () {
      this.lbBackendVersion++
      this.lbBackendOperation = null
      if (!this.lbBackendSuspended) this.refreshLbBackends()
    },
    'resource.id' () { this.lbBackendSuspended = false }
  },
  created () {
    eventBus.on('project-switch-start', this.suspendLbBackends)
    eventBus.on('project-switch-end', this.resumeLbBackends)
  },
  beforeUnmount () {
    this.lbBackendDisposed = true
    this.lbBackendVersion++
    eventBus.off('project-switch-start', this.suspendLbBackends)
    eventBus.off('project-switch-end', this.resumeLbBackends)
  },
  methods: {
    suspendLbBackends () {
      this.lbBackendSuspended = true
      this.lbBackendVersion++
      this.lbBackendOperation = null
    },
    resumeLbBackends () {
      this.lbBackendSuspended = false
      this.lbBackendVersion++
      if (this.onLbBackendProjectEnd) this.onLbBackendProjectEnd()
      this.refreshLbBackends()
    },
    currentLbBackendRemoval (operation) {
      return !this.lbBackendDisposed && !this.lbBackendSuspended && this.lbBackendOperation === operation &&
        operation.scope === this.lbBackendScope && operation.version === this.lbBackendVersion
    },
    async removeLbBackend (params) {
      if (!this.lbBackendAllowed) return false
      this.lbBackendOperation = { params: { ...params }, scope: this.lbBackendScope, version: ++this.lbBackendVersion, status: 'submitting', error: '', code: '', jobId: '' }
      const operation = this.lbBackendOperation
      try {
        const json = await postAPI('removeFromLoadBalancerRule', { ...params, ignoreproject: true, ...(this.resource.projectid ? { projectid: this.resource.projectid } : {}) }, { preserveOnFailure: true })
        if (!this.currentLbBackendRemoval(operation)) return false
        operation.jobId = json?.removefromloadbalancerruleresponse?.jobid || ''
        if (!operation.jobId) {
          operation.status = 'unknown'; operation.error = this.$t('message.lb.backend.remove.unknown'); return false
        }
      } catch (error) {
        if (this.currentLbBackendRemoval(operation)) {
          const detail = networkError(error)
          operation.status = detail.definitive ? 'failed' : 'unknown'
          operation.code = detail.code
          operation.error = detail.text || this.$t('message.request.failed')
          if (!detail.definitive) operation.error += ' ' + this.$t('message.lb.backend.remove.unknown')
        }
        return false
      }
      return this.pollLbBackendRemoval(operation)
    },
    async pollLbBackendRemoval (operation) {
      if (!operation?.jobId || !this.currentLbBackendRemoval(operation)) return false
      operation.status = 'running'; operation.error = ''; let failures = 0
      for (let reads = 0; reads < 150 && this.currentLbBackendRemoval(operation); reads++) {
        try {
          const json = await getAPI('queryAsyncJobResult', { jobid: operation.jobId, ignoreproject: true }, { preserveOnFailure: true, timeout: 15000 })
          if (!this.currentLbBackendRemoval(operation)) return false
          const job = json?.queryasyncjobresultresponse
          if (!job || job.jobid !== operation.jobId || ![0, 1, 2].includes(job.jobstatus) ||
            (job.cmd && job.cmd.split('.').pop().toLowerCase() !== 'removefromloadbalancerrulecmd')) throw new Error('LB backend removal job scope mismatch')
          failures = 0
          if (job.jobstatus === 2) {
            operation.status = 'failed'; operation.code = job.jobresult?.errorcode || job.jobresultcode || ''
            operation.error = job.jobresult?.errortext || this.$t('message.remove.instance.failed'); return false
          }
          if (job.jobstatus === 1) {
            operation.status = 'success'
            try { await this.refreshLbBackends() } catch (error) { if (this.currentLbBackendRemoval(operation)) operation.error = this.$t('message.network.lifecycle.mutation.refresh') }
            return true
          }
        } catch (error) {
          if (!this.currentLbBackendRemoval(operation)) return false
          operation.error = networkError(error).text
          if (++failures >= 3) break
        }
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
      if (this.currentLbBackendRemoval(operation)) { operation.status = 'unknown'; operation.error = this.$t('message.network.lifecycle.pending') }
      return false
    },
    recheckLbBackendRemoval () { return this.pollLbBackendRemoval(this.lbBackendOperation) }
  }
}
