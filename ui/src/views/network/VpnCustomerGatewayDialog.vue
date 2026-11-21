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
  <MoldDialog
    class="vpn-customer-gateway-dialog"
    :title="$t(currentAction.label)"
    :doc-help="currentAction.docHelp"
    size="md"
    focus-guard
    :closable="!running"
    :keyboard="!running"
    :after-close="afterClose"
    :focus-trigger-after-close="false"
    @cancel="close">
    <a-alert
      v-if="result"
      class="gateway-result"
      show-icon
      :type="running ? 'info' : result === 'unknown' ? 'warning' : 'error'"
      :message="result === 'failed' ? errorText : $t('message.vpn.customer.gateway.job.' + result)">
      <template v-if="jobId && result === 'unknown'" #description><code>{{ jobId }}</code></template>
    </a-alert>
    <div :inert="locked || undefined">
      <VpnCustomerGateway
        ref="gateway"
        :initial-values="initialValues"
        :api-params="apiParams"
        @ready="policyReady = $event"
        @submit="submit"
        @cancel="$emit('close-action')" />
    </div>
    <template #footer>
      <a-button :disabled="running" @click="close">{{ $t('label.cancel') }}</a-button>
      <a-button v-if="result === 'unknown' && jobId" type="primary" @click="track(true)">
        {{ $t('label.vpn.customer.gateway.job.recheck') }}
      </a-button>
      <a-button v-else type="primary" :disabled="locked || !policyReady" :loading="running" @click="$refs.gateway.handleSubmit()">
        {{ $t('label.ok') }}
      </a-button>
    </template>
  </MoldDialog>
</template>

<script>
import { postAPI } from '@/api'
import MoldDialog from '@/components/view/MoldDialog'
import VpnCustomerGateway from './VpnCustomerGateway.vue'
import { gatewayErrorText, gatewayJobTracker, gatewayRequestError, gatewayRequestOptions } from '@/utils/vpnCustomerGatewayJobs'

function policyParts (policy = '') {
  const [cipherHash, dh] = policy.split(';')
  const [encryption, hash] = cipherHash.split('-')
  return { encryption, hash, dh }
}

export default {
  name: 'VpnCustomerGatewayDialog',
  components: { MoldDialog, VpnCustomerGateway },
  props: {
    currentAction: { type: Object, required: true },
    resource: { type: Object, default: () => ({}) },
    afterClose: { type: Function, default: undefined }
  },
  emits: ['close-action', 'refresh-data'],
  data () {
    return { result: '', errorText: '', jobId: '', policyReady: false, active: true }
  },
  computed: {
    editing () { return this.currentAction.api === 'updateVpnCustomerGateway' },
    apiParams () { return this.$getApiParams(this.currentAction.api) },
    running () { return ['submitting', 'pending'].includes(this.result) },
    locked () { return this.running || this.result === 'unknown' },
    initialValues () {
      if (!this.editing) return {}
      const { name, domainid, gateway, cidrlist, ipsecpsk, ikepolicy, esppolicy, ikelifetime, esplifetime, dpd, splitconnections, forceencap, ikeversion, id } = this.resource
      const ike = policyParts(ikepolicy)
      const esp = policyParts(esppolicy)
      return {
        id,
        name,
        domainid,
        gateway,
        cidrlist,
        ipsecpsk,
        ikelifetime,
        esplifetime,
        dpd,
        splitconnections,
        forceencap,
        ikeversion,
        ikeEncryption: ike.encryption,
        ikeHash: ike.hash,
        ikeDh: ike.dh,
        espEncryption: esp.encryption,
        espHash: esp.hash,
        espDh: esp.dh
      }
    }
  },
  created () { this.tracker = gatewayJobTracker() },
  beforeUnmount () {
    this.active = false
    this.tracker.clear()
  },
  methods: {
    close () {
      if (this.running) return
      if (this.result === 'unknown') this.$emit('refresh-data', { irefresh: true })
      this.$emit('close-action')
    },
    fail (text) {
      const psk = this.$refs.gateway?.form.ipsecpsk
      this.errorText = gatewayErrorText(text, psk) || this.$t('message.request.failed')
      this.result = 'failed'
      if (this.$refs.gateway) this.$refs.gateway.resetSubmission()
    },
    async track (retry = false) {
      if (retry && this.result !== 'unknown') return
      this.result = 'pending'
      const job = await this.tracker.track(this.jobId, {}, retry)
      if (!this.active) return
      if (job.jobstatus === 1) {
        this.$message.success(this.$t(this.editing ? 'message.success.update.vpn.customer.gateway' : 'message.success.add.vpn.customer.gateway'))
        this.$emit('refresh-data', { irefresh: true })
        this.$emit('close-action')
      } else if (job.jobstatus === 2) {
        this.fail(job.jobresult?.errortext)
      } else {
        this.result = 'unknown'
      }
    },
    async submit ({ payload }) {
      if (!this.active || this.locked || !this.policyReady) return
      this.result = 'submitting'
      this.jobId = ''
      const request = this.editing ? { ...payload, id: this.resource.id, ignoreproject: true } : payload
      try {
        const response = await postAPI(this.currentAction.api, request, gatewayRequestOptions)
        if (!this.active) return
        this.jobId = response?.[this.currentAction.api.toLowerCase() + 'response']?.jobid || ''
        if (this.jobId) await this.track()
        else this.result = 'unknown'
      } catch (error) {
        if (!this.active) return
        const detail = gatewayRequestError(error)
        if (detail) this.fail(detail)
        else this.result = 'unknown'
      }
    }
  }
}
</script>

<style scoped>
.gateway-result { margin-bottom: 16px; }
</style>
