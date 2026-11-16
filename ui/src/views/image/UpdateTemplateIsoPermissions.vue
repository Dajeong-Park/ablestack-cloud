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
  <MoldDialog size="md" focus-guard :title="$t(kind === 'iso' ? 'label.action.iso.permission' : 'label.action.template.permission')" :closable="!busy" :keyboard="!busy" @cancel="closeModal">
    <a-alert v-if="error" type="error" show-icon role="alert" :message="error" />
    <a-spin :spinning="loading">
      <section :aria-label="$t('label.image.permissions.current')" class="image-permission-current">
        <h4>{{ $t('label.image.permissions.current') }}</h4>
        <template v-if="permissionValid">
          <dl>
            <dt>{{ $t('label.account') }}</dt>
            <dd><a-tag v-for="name in grants.accounts" :key="name" :title="name">{{ name }}</a-tag><span v-if="!grants.accounts.length">{{ $t('label.none') }}</span></dd>
            <dt>{{ $t('label.project') }}</dt>
            <dd><a-tag v-for="id in grants.projects" :key="id" :title="id">{{ projectLabel(id) }}</a-tag><span v-if="!grants.projects.length">{{ $t('label.none') }}</span></dd>
          </dl>
        </template>
      </section>
      <a-alert v-if="inventoryError" type="warning" show-icon :message="$t('message.image.permissions.inventory.failed')" />
      <a-form layout="vertical" v-ctrl-enter="submitData">
        <a-form-item :label="$t('label.operation')" :html-for="formId + '-operation'">
          <a-select :id="formId + '-operation'" v-model:value="selectedOperation" :disabled="controlsDisabled" @change="clearTargets">
            <a-select-option value="add">{{ $t('label.add') }}</a-select-option>
            <a-select-option value="remove">{{ $t('label.remove') }}</a-select-option>
            <a-select-option value="reset">{{ $t('label.reset') }}</a-select-option>
          </a-select>
        </a-form-item>
        <template v-if="selectedOperation !== 'reset'">
          <a-form-item :label="$t('label.sharewith')" :html-for="formId + '-sharewith'">
            <a-select :id="formId + '-sharewith'" v-model:value="selectedShareWith" :disabled="controlsDisabled" @change="clearTargets">
              <a-select-option value="Account">{{ $t('label.account') }}</a-select-option>
              <a-select-option value="Project">{{ $t('label.project') }}</a-select-option>
            </a-select>
          </a-form-item>
          <a-form-item :label="$t(selectedShareWith === 'Account' ? 'label.account' : 'label.project')" :html-for="formId + '-targets'">
            <a-select
v-if="useTargetSelect"
:id="formId + '-targets'"
v-model:value="selectedTargets"
mode="multiple"
show-search
option-filter-prop="label"
:options="targetOptions"
              :disabled="controlsDisabled" />
            <a-input v-else :id="formId + '-targets'" v-model:value="manualTargets" :disabled="controlsDisabled" :placeholder="$t(selectedShareWith === 'Account' ? 'message.template.permissions.account.names' : 'message.image.permissions.project.ids')" />
          </a-form-item>
        </template>
        <template v-else>
          <a-alert type="warning" show-icon :message="$t('message.image.permissions.reset.confirm')" />
          <a-checkbox v-model:checked="resetConfirmed" :disabled="controlsDisabled">{{ $t('message.image.permissions.reset.ack') }}</a-checkbox>
        </template>
      </a-form>
    </a-spin>
    <a-alert v-if="success" type="success" show-icon :message="$t('message.image.permissions.verified')" />
    <template #footer>
      <a-button :disabled="busy" @click="closeModal">{{ $t('label.close') }}</a-button>
      <a-button v-if="!permissionValid && !verification" :loading="loading" :disabled="busy" @click="fetchData">{{ $t('label.retry') }}</a-button>
      <a-button v-if="verification" :loading="busy" @click="checkResult">{{ $t('label.iso.check.status') }}</a-button>
      <a-button v-else type="primary" :loading="busy" :disabled="controlsDisabled || (selectedOperation === 'reset' && !resetConfirmed)" @click="submitData">{{ $t('label.ok') }}</a-button>
    </template>
  </MoldDialog>
</template>
<script>
import { getAPI, postAPI } from '@/api'
import MoldDialog from '@/components/view/MoldDialog'
import { imagePermissionResponse, imagePermissionScope, canManageImagePermissions, permissionFingerprint, expectedImagePermissions, permissionTargetOptions } from '@/utils/imagePermissions'
import { safeTemplateReason } from '@/utils/templateAvailability'
let formSequence = 0
export default {
  name: 'UpdateTemplateIsoPermissions',
  components: { MoldDialog },
  props: { resource: { type: Object, required: true } },
  inject: { parentFetchData: { default: null } },
  emits: ['close-action', 'refresh-data'],
  data () {
    return { formId: 'image-permissions-' + (++formSequence), grants: null, permissionValid: false, accounts: [], projects: [], selectedTargets: [], manualTargets: '', selectedOperation: 'add', selectedShareWith: 'Account', resetConfirmed: false, loading: false, busy: false, error: '', writeError: '', inventoryError: false, success: false, verification: null, generation: 0, disposed: false }
  },
  computed: {
    kind () { return this.resource.format === 'ISO' || this.$route?.meta?.name === 'iso' ? 'iso' : 'template' },
    scope () { return imagePermissionScope(this.kind, this.resource, this.$store.getters) },
    sessionBoundary () { return this.$store.state?.user?.token },
    allowed () { return canManageImagePermissions(this.kind, this.resource, this.$store.getters) },
    controlsDisabled () { return this.busy || this.loading || !this.permissionValid || !this.allowed || !!this.verification },
    canListAccounts () { return !!this.$store.getters.apis?.listAccounts && (this.$store.getters.userInfo?.roletype !== 'User' || [true, 'true'].includes(this.$store.getters.features?.allowuserviewalldomainaccounts)) },
    useTargetSelect () { return this.selectedOperation === 'remove' || (this.selectedShareWith === 'Account' ? this.canListAccounts && !this.inventoryError : !!this.$store.getters.apis?.listProjects && !this.inventoryError) },
    targetOptions () { return this.grants ? permissionTargetOptions(this.grants, this.selectedShareWith === 'Account' ? this.accounts : this.projects, this.selectedOperation, this.selectedShareWith, this.selectedShareWith === 'Account' ? this.resource.account : this.resource.projectid) : [] }
  },
  watch: { scope () { this.invalidate() }, sessionBoundary () { this.invalidate() } },
  created () { this.fetchData() },
  beforeUnmount () { this.disposed = true; this.generation += 1 },
  methods: {
    current (run) { return !this.disposed && run.generation === this.generation && run.scope === this.scope },
    run () { return { generation: this.generation, scope: this.scope } },
    errorText (e) { return safeTemplateReason(e?.response?.data?.errorresponse?.errortext || e?.response?.headers?.['x-description'] || (e?.message?.startsWith('message.') ? this.$t(e.message) : e?.message) || this.$t('message.request.failed')) },
    invalidate () { this.generation += 1; this.permissionValid = false; this.grants = null; this.accounts = []; this.projects = []; this.loading = false; this.busy = false; this.verification = null; this.writeError = ''; this.clearTargets(); this.error = this.$t('message.image.permissions.scope.changed') },
    clearTargets () { this.selectedTargets = []; this.manualTargets = ''; this.resetConfirmed = false; this.success = false },
    projectLabel (id) { return this.projects.find(p => p.id === id)?.name || id },
    async readPermissions (run) {
      const name = this.kind === 'iso' ? 'listIsoPermissions' : 'listTemplatePermissions'
      const json = await getAPI(name, { id: this.resource.id }, { preserveOnFailure: true })
      if (!this.current(run)) return null
      return imagePermissionResponse(this.kind, json, this.resource.id, this.resource)
    },
    async readInventory (api, field, params, run) {
      const rows = []; let page = 1
      while (page <= 100) {
        const json = await getAPI(api, { ...params, page, pagesize: 100 }, { preserveOnFailure: true })
        if (!this.current(run)) return []
        const root = json[api === 'listAccounts' ? 'listaccountsresponse' : 'listprojectsresponse']
        if (!root || root.errorcode !== undefined || (root[field] !== undefined && !Array.isArray(root[field]))) throw new Error('message.image.permissions.invalid')
        const chunk = root[field] || []; rows.push(...chunk)
        if (root.count === undefined || rows.length >= Number(root.count)) return rows
        if (!chunk.length) throw new Error('message.image.permissions.invalid')
        page += 1
      }
      throw new Error('message.image.permissions.invalid')
    },
    async fetchData () {
      if (this.busy || this.loading || !this.allowed) { if (!this.allowed) this.error = this.$t('message.iso.action.unavailable'); return }
      this.loading = true; this.error = ''; this.inventoryError = false; const run = this.run()
      try {
        const result = await this.readPermissions(run)
        if (!this.current(run) || !result) return
        this.grants = result; this.permissionValid = true
        const work = []
        if (this.canListAccounts) work.push(this.readInventory('listAccounts', 'account', { domainid: this.resource.domainid, showicon: true }, run).then(rows => { if (this.current(run)) this.accounts = rows }))
        if (this.$store.getters.apis?.listProjects) work.push(this.readInventory('listProjects', 'project', { details: 'min', listall: true, showicon: true }, run).then(rows => { if (this.current(run)) this.projects = rows }))
        const inventories = await Promise.allSettled(work)
        if (this.current(run)) this.inventoryError = inventories.some(x => x.status === 'rejected')
      } catch (e) { if (this.current(run)) { this.grants = null; this.permissionValid = false; this.error = this.errorText(e) } } finally { if (this.current(run)) this.loading = false }
    },
    closeModal () { if (!this.busy) this.$emit('close-action') },
    async submitData (event) {
      if (event && typeof event.preventDefault === 'function') event.preventDefault()
      if (this.controlsDisabled) return
      this.error = ''; this.writeError = ''; this.success = false
      const selected = [...new Set((this.useTargetSelect ? this.selectedTargets : this.manualTargets.split(',').map(x => x.trim()).filter(Boolean)))]
      let expected
      try {
        if (this.selectedOperation === 'reset' && !this.resetConfirmed) throw new Error('message.image.permissions.reset.ack')
        expected = expectedImagePermissions(this.grants, this.selectedOperation, this.selectedShareWith, selected)
      } catch (e) { this.error = this.errorText(e); return }
      const run = this.run(); const before = this.grants; const operation = this.selectedOperation; const type = this.selectedShareWith
      this.busy = true
      try {
        const fresh = await this.readPermissions(run)
        if (!this.current(run) || !fresh || !this.allowed) return
        if (permissionFingerprint(before) !== permissionFingerprint(fresh)) { this.grants = fresh; this.clearTargets(); throw new Error('message.image.permissions.changed') }
        const params = { id: this.resource.id, op: operation }
        if (operation !== 'reset') params[type === 'Account' ? 'accounts' : 'projectids'] = selected.join(',')
        this.verification = expected
        try { await postAPI(this.kind === 'iso' ? 'updateIsoPermissions' : 'updateTemplatePermissions', params, { preserveOnFailure: true }) } catch (e) { if (this.current(run)) { this.writeError = this.errorText(e); this.error = this.writeError } }
        if (!this.current(run)) return
        await this.verify(run)
      } catch (e) { if (this.current(run)) this.error = this.errorText(e) } finally { if (this.current(run)) this.busy = false }
    },
    async verify (run) {
      try {
        const actual = await this.readPermissions(run)
        if (!this.current(run) || !actual) return
        this.grants = actual
        if (permissionFingerprint(actual) !== permissionFingerprint(this.verification)) { this.verification = null; this.clearTargets(); throw new Error(this.writeError || 'message.image.permissions.result.unconfirmed') }
        this.verification = null; this.error = ''; this.success = true; this.clearTargets(); this.success = true
        this.$emit('refresh-data'); if (this.parentFetchData) this.parentFetchData()
        this.$notification.success({ message: this.$t('message.image.permissions.verified') })
      } catch (e) { if (this.current(run)) this.error = this.errorText(e) }
    },
    async checkResult () { if (this.busy || !this.verification || !this.allowed) return; this.busy = true; const run = this.run(); try { await this.verify(run) } finally { if (this.current(run)) this.busy = false } }
  }
}
</script>
<style scoped>
.image-permission-current { margin-bottom: 16px; min-width: 0; }
.image-permission-current dl { display: grid; grid-template-columns: minmax(90px, auto) minmax(0, 1fr); gap: 8px 16px; }
.image-permission-current dd { margin: 0; overflow-wrap: anywhere; }
.image-permission-current :deep(.ant-tag) { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; vertical-align: middle; }
:deep(.ant-alert) { margin-bottom: 16px; }
</style>
