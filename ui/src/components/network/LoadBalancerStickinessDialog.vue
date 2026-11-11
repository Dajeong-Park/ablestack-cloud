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
  <section class="lb-stickiness">
    <NetworkMutationStatus v-if="!visible && networkMutationBlocked" :operation="networkMutation" @recheck="recheck" />
    <MoldDialog
      class="network-rule-dialog appcookie-dialog"
      size="md"
      form-actions
      :visible="visible"
      :closable="!busy"
      :keyboard="!busy"
      focus-guard
      @cancel="close">

      <template #title>
        <span>{{ $t('label.configure.sticky.policy') }}</span>
        <a
          style="margin-left: 5px"
          :href="$config.docBase + '/adminguide/networking/external_firewalls_and_load_balancers.html#sticky-session-policies-for-load-balancer-rules'"
          target="_blank">
          <question-circle-outlined />
        </a>
      </template>

      <NetworkMutationStatus :operation="networkMutation" @recheck="recheck" />
      <dl class="lb-stickiness-context">
        <dt>{{ $t('label.name') }}</dt><dd>{{ rule.name || rule.id }}</dd>
        <dt>{{ $t('label.current') }}</dt><dd>{{ selectedStickinessPolicy?.name || '—' }}</dd>
      </dl>

      <a-alert v-if="stickinessLookupError" type="error" :message="$t('message.lb.stickiness.lookup')" show-icon>
        <template #description><a-button :disabled="loading || networkMutationBlocked" @click="refresh"><reload-outlined />{{ $t('label.retry') }}</a-button></template>
      </a-alert>
      <a-form
        ref="formRef"
        :model="form"
        :disabled="locked"
        :rules="rules"
        @finish="handleSubmitStickinessForm"
        v-ctrl-enter="handleSubmitStickinessForm"
        layout="vertical"
        :name="stickinessFormName"
        class="appcookie-form"
        >
        <a-form-item name="methodname" ref="methodname">
          <template #label>
            <tooltip-label :title="$t('label.stickiness.method')" :tooltip="apiParams.methodname?.description" :tooltip-placement="'right'"/>
          </template>
          <a-select
            v-focus="true"
            :disabled="locked"
            v-model:value="form.methodname"
            @change="handleStickinessMethodSelectChange"
            showSearch
            optionFilterProp="label"
            :filterOption="(input, option) => {
              return option.label.toLowerCase().indexOf(input.toLowerCase()) >= 0
            }" >
            <a-select-option :disabled="!canCreate" value="LbCookie" :label="$t('label.lb.cookie')">{{ $t('label.lb.cookie') }}</a-select-option>
            <a-select-option :disabled="!stickinessContract?.available || !canCreate" value="AppCookie" :label="$t('label.app.cookie')">{{ $t('label.app.cookie') }}</a-select-option>
            <a-select-option :disabled="!canCreate" value="SourceBased" :label="$t('label.source.based')">{{ $t('label.source.based') }}</a-select-option>
            <a-select-option :disabled="!canDelete || !selectedStickinessPolicy" value="none" :label="$t('label.none')">{{ $t('label.none') }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item
          name="name"
          ref="name"
          v-show="form.methodname === 'LbCookie' || form.methodname ===
            'AppCookie' || form.methodname === 'SourceBased'">
          <a-input :disabled="locked" v-model:value="form.name" />
          <template #label>
            <tooltip-label :title="$t('label.sticky.name')" :tooltip="apiParams.name?.description" :tooltip-placement="'right'"/>
          </template>
        </a-form-item>
        <fieldset :disabled="locked" class="lb-stickiness-fields" v-if="form.methodname !== 'none'">
          <a-alert v-if="form.methodname === 'AppCookie' && stickinessContract?.exact" type="info" :message="$t('message.appcookie.exact')" show-icon />
          <a-card>
            <a-form-item
              name="cookieName"
              ref="cookieName"
              :label="$t('label.sticky.cookie-name')"
              v-show="form.methodname === 'LbCookie' || form.methodname ===
                'AppCookie'">
              <a-input :disabled="locked" v-model:value="form.cookieName" />
            </a-form-item>
            <a-form-item
              name="mode"
              ref="mode"
              :label="$t('label.sticky.mode')"
              v-show="form.methodname === 'LbCookie' || (form.methodname === 'AppCookie' && stickinessContract?.params.includes('mode'))">
              <a-input :disabled="locked" v-model:value="form.mode" />
            </a-form-item>
            <a-form-item name="nocache" ref="nocache" :label="$t('label.sticky.nocache')" v-show="form.methodname === 'LbCookie'">
              <a-checkbox :disabled="locked" v-model:checked="form.nocache"></a-checkbox>
            </a-form-item>
            <a-form-item name="indirect" ref="indirect" :label="$t('label.sticky.indirect')" v-show="form.methodname === 'LbCookie'">
              <a-checkbox :disabled="locked" v-model:checked="form.indirect"></a-checkbox>
            </a-form-item>
            <a-form-item name="postonly" ref="postonly" :label="$t('label.sticky.postonly')" v-show="form.methodname === 'LbCookie'">
              <a-checkbox :disabled="locked" v-model:checked="form.postonly"></a-checkbox>
            </a-form-item>
            <a-form-item name="domain" ref="domain" :label="$t('label.domain')" v-show="form.methodname === 'LbCookie'">
              <a-input :disabled="locked" v-model:value="form.domain" />
            </a-form-item>
            <a-form-item name="length" ref="length" :label="$t('label.sticky.length')" v-show="form.methodname === 'AppCookie'">
              <a-input :disabled="locked" v-model:value="form.length" type="number" :min="1" :max="256" placeholder="52" />
            </a-form-item>
            <a-form-item name="holdtime" ref="holdtime" :label="$t('label.sticky.holdtime')" v-show="form.methodname === 'AppCookie'">
              <a-input :disabled="locked" v-model:value="form.holdtime" placeholder="3h" />
            </a-form-item>
            <a-form-item name="requestLearn" ref="requestLearn" :label="$t('label.sticky.request-learn')" v-show="form.methodname === 'AppCookie'">
              <a-checkbox :disabled="locked" v-model:checked="form.requestLearn"></a-checkbox>
            </a-form-item>
            <a-form-item name="prefix" ref="prefix" :label="$t('label.sticky.prefix')" v-show="form.methodname === 'AppCookie' && stickinessContract?.params.includes('prefix')">
              <a-checkbox :disabled="locked" v-model:checked="form.prefix"></a-checkbox>
            </a-form-item>
            <a-form-item name="tablesize" ref="tablesize" :label="$t('label.sticky.tablesize')" v-show="form.methodname === 'SourceBased'">
              <a-input :disabled="locked" v-model:value="form.tablesize" />
            </a-form-item>
            <a-form-item name="expire" ref="expire" :label="$t('label.sticky.expire')" v-show="form.methodname === 'SourceBased'">
              <a-input :disabled="locked" v-model:value="form.expire" />
            </a-form-item>
          </a-card>
        </fieldset>
        <MoldDialogActions :busy="busy">
          <a-button :disabled="busy" @click="close">{{ $t('label.cancel') }}</a-button>
          <a-button type="primary" ref="submit" :loading="busy" :disabled="!canSubmit" @click="handleSubmitStickinessForm">{{ $t('label.ok') }}</a-button>
        </MoldDialogActions>
      </a-form>
    </MoldDialog>

  </section>
</template>
<script>
import { getAPI } from '@/api'
import eventBus from '@/config/eventBus'
import MoldDialog from '@/components/view/MoldDialog'
import MoldDialogActions from '@/components/view/MoldDialogActions'
import NetworkMutationStatus from '@/components/view/NetworkMutationStatus'
import TooltipLabel from '@/components/widgets/TooltipLabel'
import { networkMutationMixin } from '@/utils/networkMutation'
import { appCookieContract, appCookieError, appCookieRequestLearning } from '@/utils/appCookie'
import { loadBalancerIsProtected } from '@/utils/networkRuleForm'

let formSequence = 0
const emptyForm = () => ({ methodname: 'LbCookie', name: '', cookieName: '', mode: '', domain: '', length: '', holdtime: '', tablesize: '', expire: '', nocache: false, indirect: false, postonly: false, requestLearn: false, prefix: false })
const fields = { LbCookie: ['cookieName', 'mode', 'nocache', 'indirect', 'postonly', 'domain'], AppCookie: ['cookieName', 'length', 'holdtime', 'requestLearn', 'mode', 'prefix'], SourceBased: ['tablesize', 'expire'] }
const parameterName = key => ({ cookieName: 'cookie-name', requestLearn: 'request-learn' }[key] || key)

export default {
  name: 'LoadBalancerStickinessDialog',
  components: { MoldDialog, MoldDialogActions, NetworkMutationStatus, TooltipLabel },
  mixins: [networkMutationMixin],
  props: { resource: { type: Object, required: true }, rule: { type: Object, required: true }, visible: { type: Boolean, default: true }, protectedRule: { type: Boolean, default: false } },
  emits: ['cancel', 'invalidated', 'refresh'],
  data () {
    return { form: emptyForm(), stickinessFormName: 'lb-stickiness-' + (++formSequence), selectedStickinessPolicy: null, stickinessContract: null, stickinessLookupError: false, loading: false, validating: false, initialized: false, readVersion: 0, suspended: false }
  },
  computed: {
    apiParams () { return this.$getApiParams('createLBStickinessPolicy') || {} },
    networkMutationScope () {
      const user = this.$store.getters.userInfo || {}
      return JSON.stringify([this.$route.path, this.$route.query?.tab, this.resource.id, this.resource.projectid, this.resource.associatednetworkid, this.rule.id, this.rule.networkid, this.protectedRule,
        user.id, user.roleid, user.roletype, user.domainid, this.$store.state?.user?.token, this.$store.getters.project?.id, Object.keys(this.$store.getters.apis || {}).sort()])
    },
    canRead () { return !this.suspended && !this.protectedRule && ['listLoadBalancerRules', 'listLBStickinessPolicies', 'listNetworks', 'queryAsyncJobResult'].every(api => api in (this.$store.getters.apis || {})) },
    canCreate () { return this.canRead && 'createLBStickinessPolicy' in this.$store.getters.apis },
    canDelete () { return this.canRead && 'deleteLBStickinessPolicy' in this.$store.getters.apis },
    busy () { return this.validating || this.networkMutationBusy },
    locked () { return this.busy || this.loading || this.networkMutationBlocked || this.stickinessLookupError || !this.canRead },
    canSubmit () { return !this.locked && !!this.stickinessContract && (this.form.methodname === 'none' ? this.canDelete && !!this.selectedStickinessPolicy : this.canCreate) },
    rules () {
      return { methodname: [{ required: true, message: this.$t('message.error.specify.stickiness.method') }], name: [{ required: this.form.methodname !== 'none', whitespace: true, message: this.$t('message.error.specify.sticky.name') }] }
    }
  },
  watch: {
    networkMutationScope () { this.invalidate() },
    visible (visible) { if (visible && !this.networkMutationBlocked) { this.resetNetworkMutation(); this.initialized = false; this.form = emptyForm(); this.refresh() } }
  },
  created () { eventBus.on('project-switch-start', this.invalidate); this.refresh() },
  beforeUnmount () { this.readVersion++; eventBus.off('project-switch-start', this.invalidate) },
  methods: {
    invalidate () { this.suspended = true; this.readVersion++; this.networkMutationVersion++; this.$emit('invalidated') },
    close () {
      if (this.busy) return false
      this.readVersion++; this.loading = false
      // Keep an uncertain receipt and its draft mounted when the dialog is hidden.
      this.$emit('cancel'); return true
    },
    currentRead (version, scope) { return !this.networkMutationDisposed && !this.suspended && this.visible && version === this.readVersion && scope === this.networkMutationScope },
    async readContext () {
      const params = { projectid: this.resource.projectid, ignoreproject: true }
      const [rules, networks, policies] = await Promise.all([
        getAPI('listLoadBalancerRules', { ...params, id: this.rule.id }, { preserveOnFailure: true }),
        getAPI('listNetworks', { ...params, id: this.rule.networkid || this.resource.associatednetworkid }, { preserveOnFailure: true }),
        getAPI('listLBStickinessPolicies', { ...params, lbruleid: this.rule.id }, { preserveOnFailure: true })
      ])
      const row = rules?.listloadbalancerrulesresponse?.loadbalancerrule?.find(row => row.id === this.rule.id)
      const network = networks?.listnetworksresponse?.network?.find(n => n.id === (this.rule.networkid || this.resource.associatednetworkid))
      const body = policies?.listlbstickinesspoliciesresponse
      const groups = body?.stickinesspolicies || []
      if (!row || row.publicipid !== this.resource.id || row.networkid !== network?.id || loadBalancerIsProtected(row) || !body || body.errorcode || !Array.isArray(groups) || groups.length > 1 || groups.some(g => g.lbruleid !== this.rule.id || !Array.isArray(g.stickinesspolicy))) throw new Error(this.$t('message.network.lifecycle.reason.missing'))
      const current = groups.flatMap(g => g.stickinesspolicy).filter(p => String(p.state || '').toLowerCase() !== 'revoked')
      if (current.length > 1 || current.some(p => !p.id || !fields[p.methodname] || !p.params)) throw new Error(this.$t('message.network.lifecycle.reason.missing'))
      return { network, policy: current[0] || null }
    },
    loadPolicy (policy) {
      const form = emptyForm(); form.methodname = policy?.methodname || 'LbCookie'; form.name = policy?.name || ''
      for (const key of fields[form.methodname]) {
        const value = policy?.params?.[parameterName(key)]
        if (typeof form[key] === 'boolean') form[key] = appCookieRequestLearning(value)
        else if (value !== undefined) form[key] = value
      }
      this.form = form
    },
    async refresh () {
      if (!this.canRead || this.loading || this.networkMutationBlocked) return
      const version = ++this.readVersion; const scope = this.networkMutationScope; this.loading = true
      try {
        const context = await this.readContext()
        if (!this.currentRead(version, scope)) return
        this.selectedStickinessPolicy = context.policy; this.stickinessContract = appCookieContract(context.network)
        if (!this.initialized) { this.loadPolicy(context.policy); this.initialized = true }
        this.stickinessLookupError = false
      } catch (error) { if (this.currentRead(version, scope)) this.stickinessLookupError = true } finally { if (this.currentRead(version, scope)) this.loading = false }
    },
    networkMutationReceipt (api, json) {
      if (api === 'createLBStickinessPolicy') return json?.createLBStickinessPolicy || json?.createlbstickinesspolicyresponse
      if (api === 'deleteLBStickinessPolicy') return json?.deleteLBstickinessrruleresponse || json?.deletelbstickinesspolicyresponse
      return null
    },
    networkMutationEntityMatches (operation, job) {
      // Stickiness jobs advertise None, not the policy ID, as their instance type.
      if (job?.cmd?.split('.').pop().toLowerCase() !== operation.api.toLowerCase() + 'cmd') return false
      if (job.jobstatus !== 1) return true
      if (operation.api === 'deleteLBStickinessPolicy') return job.jobresult?.success === true
      const group = job.jobresult?.stickinesspolicies
      return group?.lbruleid === operation.params.lbruleid && !!operation.entityId && group.stickinesspolicy?.some(p => p.id === operation.entityId && p.methodname === operation.params.methodname && p.name === operation.params.name)
    },
    async recheck () {
      if (!this.canRead || !this.networkMutation || !(this.networkMutation.api in this.$store.getters.apis)) return false
      return this.recheckNetworkMutation()
    },
    fail (message) { this.networkMutation = { status: 'failed', error: this.$t(message) }; return false },
    async handleSubmitStickinessForm (event) {
      if (event?.preventDefault) event.preventDefault()
      if (!this.visible || !this.canSubmit) return false
      this.validating = true
      const version = this.readVersion; const scope = this.networkMutationScope
      try {
        await this.$refs.formRef.validate()
        if (!this.currentRead(version, scope)) return false
        const values = { ...this.form }; const removing = values.methodname === 'none'
        if (!(removing ? this.canDelete : this.canCreate)) return false
        if (!removing && !fields[values.methodname]) return false
        if (values.methodname === 'AppCookie') {
          const error = !this.stickinessContract.available ? 'message.appcookie.unsupported' : this.stickinessContract.exact && appCookieError(values)
          if (error) return this.fail(error)
        }
        const context = await this.readContext()
        if (!this.currentRead(version, scope)) return false
        if ((context.policy?.id || '') !== (this.selectedStickinessPolicy?.id || '')) {
          this.stickinessLookupError = true
          return this.fail('message.lb.stickiness.changed')
        }
        this.resetNetworkMutation()
        if (removing) return await this.submitNetworkMutation('deleteLBStickinessPolicy', { id: context.policy.id }, this.completed)
        const params = { lbruleid: this.rule.id, name: values.name, methodname: values.methodname }; let index = 0
        for (const key of fields[values.methodname]) {
          const wire = parameterName(key)
          if (values.methodname === 'AppCookie' && !this.stickinessContract.params.includes(wire)) continue
          const value = key === 'requestLearn' && this.stickinessContract.exact ? String(values[key]) : values[key]
          if (value === '' || value === false || value === undefined || value === null) continue
          params[`param[${index}].name`] = wire; params[`param[${index++}].value`] = value
        }
        return await this.submitNetworkMutation('createLBStickinessPolicy', params, this.completed)
      } catch (error) {
        if (this.currentRead(version, scope)) {
          if (error?.errorFields?.length) this.$refs.formRef.scrollToField(error.errorFields[0].name)
          else this.fail(error?.message || 'message.request.failed')
        }
        return false
      } finally { if (!this.networkMutationDisposed && scope === this.networkMutationScope) this.validating = false }
    },
    handleStickinessMethodSelectChange (method) {
      if (this.locked) return
      const name = this.form.name; this.form = { ...emptyForm(), methodname: method, name }
    },
    completed () {
      this.$notification.success({ message: this.$t(this.networkMutation.api === 'deleteLBStickinessPolicy' ? 'message.success.remove.sticky.policy' : 'message.success.config.sticky.policy') })
      this.$emit('refresh'); this.$emit('cancel')
    }
  }
}

</script>
<style scoped lang="less">
.lb-stickiness-context { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 6px 12px; margin: 0 0 16px; }
.lb-stickiness-context dt { color: var(--ui-text-secondary); }
.lb-stickiness-context dd { margin: 0; overflow-wrap: anywhere; }
.lb-stickiness-fields { min-width: 0; border: 0; padding: 0; margin: 0; }
.appcookie-form :deep(.ant-input), .appcookie-form :deep(.ant-select) { width: 100%; }
</style>
