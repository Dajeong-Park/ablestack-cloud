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
  <MoldDialog class="image-userdata-dialog" size="md" focus-guard :title="$t('label.action.edit.iso')" :closable="!loading" :keyboard="!loading" @cancel="closeAction">
    <a-alert v-if="submitError" ref="error" tabindex="-1" type="error" show-icon role="alert" :message="submitError" />
    <a-alert v-if="linkPending" type="warning" show-icon :message="$t(metadataWritten ? 'message.userdata.image.partial' : 'message.iso.edit.link.failed')" />
    <a-spin :spinning="loading">
      <a-form ref="editForm" :model="form" :rules="rules" layout="vertical" @keydown.ctrl.enter.stop.prevent="handleSubmit">
        <a-form-item v-for="key in ['name', 'displaytext']" :key="key" :name="key" :label="$t('label.' + key)" :html-for="formId + '-' + key">
          <a-input :id="formId + '-' + key" v-model:value="form[key]" :disabled="metadataLocked || !supports(key)" :placeholder="help(key)" />
        </a-form-item>
        <a-form-item v-for="key in ['bootable', 'passwordenabled', 'isdynamicallyscalable']" :key="key" :name="key" :html-for="formId + '-' + key">
          <template #label><tooltip-label :title="$t('label.' + key)" :tooltip="help(key)" /></template>
          <a-switch :id="formId + '-' + key" v-model:checked="form[key]" :disabled="metadataLocked || !supports(key)" />
          <span v-if="form[key] === undefined">{{ $t('label.unknown') }}</span>
        </a-form-item>
        <a-form-item name="arch" :label="$t('label.arch')" :html-for="formId + '-arch'">
          <a-select :id="formId + '-arch'" v-model:value="form.arch" show-search option-filter-prop="label" :options="archOptions" :filter-option="filterOption" :disabled="metadataLocked || !supports('arch')" />
        </a-form-item>
        <a-form-item name="ostypeid" :required="form.bootable === true" :label="$t('label.ostypeid')" :html-for="formId + '-os'">
          <a-select
            :id="formId + '-os'"
            v-model:value="form.ostypeid"
            show-search
            option-filter-prop="label"
            :options="osOptions"
            :filter-option="filterOption"
            :loading="osLoading"
            :disabled="metadataLocked || !supports('ostypeid') || !canListOs" />
        </a-form-item>
        <a-alert v-if="osError" type="warning" show-icon :message="$t('message.iso.edit.os.read.failed')" />
        <a-form-item v-if="osChanged && supports('forceupdateostype')" :label="$t('label.force.update.os.type')" :html-for="formId + '-force'">
          <a-alert type="warning" show-icon :message="help('forceupdateostype') || $t('message.iso.edit.os.force')" />
          <a-switch :id="formId + '-force'" v-model:checked="form.forceupdateostype" :disabled="metadataLocked" />
        </a-form-item>
        <a-form-item :label="$t('label.user.data')">
          <UserDataSelection v-if="canLinkUserData" :scope="boundResource" :value="userdataid || '0'" :disabled="loading || !!unknownStage || conflict" @select-user-data-item="id => { userdataid = id === '0' ? '' : id }" @ready="userDataSelectionReady = $event" />
          <span v-else>{{ resource.userdataname || resource.userdataid || '—' }}</span>
        </a-form-item>
        <a-form-item :label="$t('label.user.data.policy')" :html-for="formId + '-policy'">
          <a-select :id="formId + '-policy'" v-model:value="userdatapolicy" :options="policyOptions" :disabled="loading || !canLinkUserData || !userdataid || !!unknownStage || conflict" />
        </a-form-item>
      </a-form>
    </a-spin>
    <template #footer>
      <a-button :disabled="loading" @click="closeAction">{{ $t('label.cancel') }}</a-button>
      <a-button v-if="unknownStage" type="primary" :loading="loading" @click="checkStatus">{{ $t('label.iso.check.status') }}</a-button>
      <a-button v-else type="primary" :loading="loading" :disabled="!allowed || !capability.known || conflict || (linkChanged && !userDataSelectionReady)" @click="handleSubmit">{{ $t(linkPending ? 'label.iso.edit.retry.userdata' : 'label.ok') }}</a-button>
    </template>
  </MoldDialog>
</template>
<script>
import { getAPI, postAPI } from '@/api'
import MoldDialog from '@/components/view/MoldDialog'
import TooltipLabel from '@/components/widgets/TooltipLabel'
import UserDataSelection from '@/views/compute/wizard/UserDataSelection'
import { canIsoAction, isoContext, readIsoResource, isoListResponse } from '@/utils/isoModel'
import { safeTemplateReason } from '@/utils/templateAvailability'
import { isoEditCapability, isoEditValues, isoEditLink, isoEditFingerprint, isoEditMatches, isoOptionFilter, isoEditParams, isoEditLinkTarget, isoLinkParams } from '@/utils/isoEdit'
let sequence = 0
export default {
  name: 'UpdateIso',
  components: { MoldDialog, TooltipLabel, UserDataSelection },
  props: { resource: { type: Object, required: true } },
  emits: ['close-action', 'refresh-data'],
  data () {
    const baseline = { ...this.resource }
    return { formId: 'iso-edit-' + (++sequence), form: { ...isoEditValues(baseline), forceupdateostype: false }, baseline, boundResource: baseline, userdataid: baseline.userdataid || '', userdatapolicy: isoEditLink(baseline).policy || 'ALLOWOVERRIDE', userDataSelectionReady: false, osTypes: [], osLoading: false, osError: false, loading: false, submitError: '', metadataDone: false, metadataWritten: false, linkPending: false, conflict: false, unknownStage: '', intent: null, disposed: false }
  },
  computed: {
    capability () { return isoEditCapability(this.$store.getters) },
    allowed () { return canIsoAction('edit', this.boundResource, this.$store.getters) },
    canLinkUserData () { return ['listUserData', 'linkUserDataToTemplate'].every(api => !!this.$store.getters.apis?.[api]) },
    canListOs () { return !!this.$store.getters.apis?.listOsTypes },
    scope () { return JSON.stringify([isoContext(this.resource, this.$store.getters), this.resource.account, this.resource.domainid, this.resource.projectid, this.$store.state?.user?.token]) },
    metadataLocked () { return this.loading || this.metadataDone || !!this.unknownStage || this.conflict },
    osChanged () { return this.form.ostypeid !== this.baseline.ostypeid },
    linkChanged () { return this.canLinkUserData && JSON.stringify({ id: this.userdataid || '', policy: this.userdataid ? String(this.userdatapolicy || 'ALLOWOVERRIDE').toUpperCase() : '' }) !== JSON.stringify(isoEditLink(this.baseline)) },
    archOptions () { const rows = [{ value: 'x86_64', label: 'Intel/AMD 64 bits (x86_64)' }, { value: 'aarch64', label: 'ARM 64 bits (aarch64)' }, { value: 's390x', label: 'IBM Z (s390x)' }]; if (this.form.arch && !rows.some(r => r.value === this.form.arch)) rows.push({ value: this.form.arch, label: this.form.arch }); return rows },
    osOptions () { const rows = this.osTypes.map(r => ({ value: r.id, label: r.description || r.name || r.id })); if (this.form.ostypeid && !rows.some(r => r.value === this.form.ostypeid)) rows.push({ value: this.form.ostypeid, label: this.resource.ostypename || this.form.ostypeid }); return rows },
    policyOptions () { const values = ['ALLOWOVERRIDE', 'APPEND', 'DENYOVERRIDE']; if (this.userdatapolicy && !values.includes(this.userdatapolicy)) values.push(this.userdatapolicy); return values.map(value => ({ value, label: value })) },
    rules () { return { name: [{ required: true, whitespace: true, message: this.$t('message.error.required.input') }] } },
    blocksNavigation () { return this.loading }
  },
  watch: { scope () { this.conflict = true; this.unknownStage = ''; this.loading = false; this.submitError = this.$t('message.iso.edit.context.changed') } },
  created () { this.fetchOsTypes() },
  beforeUnmount () { this.disposed = true },
  methods: {
    filterOption: isoOptionFilter,
    supports (key) { return !!this.capability.parameters[key] },
    help (key) { return this.capability.parameters[key]?.description || '' },
    current (scope) { return !this.disposed && scope === this.scope },
    errorText (e) { return safeTemplateReason(e?.response?.data?.errorresponse?.errortext || e?.response?.headers?.['x-description'] || (e?.message?.startsWith('message.') ? this.$t(e.message) : e?.message) || this.$t('message.request.failed')) },
    actorParams () { const id = this.$store.getters.project?.id; return { ignoreproject: true, ...(id && !this.$store.getters.listAllProjects ? { projectid: id } : {}) } },
    async fetchOsTypes () { if (!this.canListOs) return; const scope = this.scope; this.osLoading = true; try { const j = await getAPI('listOsTypes', { listall: true, ignoreproject: true }, { preserveOnFailure: true }); if (!this.current(scope)) return; if (!Array.isArray(j.listostypesresponse?.ostype)) throw new Error('options'); this.osTypes = j.listostypesresponse.ostype } catch (e) { if (this.current(scope)) this.osError = true } finally { if (this.current(scope)) this.osLoading = false } },
    async read (scope) { const json = await readIsoResource(getAPI, { id: this.boundResource.id, listall: true, ...this.actorParams() }, this.$store.getters, () => this.current(scope)); if (!this.current(scope)) return null; const rows = isoListResponse(json).rows; if (!rows.length || rows.some(r => r.id !== this.boundResource.id)) throw new Error('message.iso.edit.read.failed'); return rows.find(r => r.zoneid === this.boundResource.zoneid) || rows[0] },
    closeAction () { if (this.loading) return; if (this.intent) this.$emit('refresh-data'); this.$emit('close-action') },
    finish () { this.$message.success(this.$t('message.success.update.iso') + ': ' + this.form.name); this.$emit('refresh-data'); this.$emit('close-action') },
    failConflict () { this.conflict = true; this.submitError = this.$t('message.iso.edit.changed') },
    async handleSubmit (event) {
      if (event?.preventDefault) event.preventDefault()
      if (this.loading || this.unknownStage || this.conflict || !this.allowed || !this.capability.known || (this.linkChanged && !this.userDataSelectionReady)) return
      this.loading = true; this.submitError = ''; const scope = this.scope
      try {
        if (this.linkPending) { await this.link(scope); return }
        await this.$refs.editForm.validate()
        const params = isoEditParams(this.form, this.baseline, this.capability, this.osTypes)
        const linkChanged = this.linkChanged
        const desired = linkChanged ? isoEditLinkTarget(this.userdataid, this.userdatapolicy) : isoEditLink(this.baseline)
        const fresh = await this.read(scope); if (!this.current(scope) || !fresh || !this.allowed) return
        if (isoEditFingerprint(fresh) !== isoEditFingerprint(this.baseline)) { this.failConflict(); return }
        this.intent = { params, desired, linkChanged, before: fresh }
        if (Object.keys(params).length > 1) {
          let error
          try { await postAPI('updateIso', { ...params, ...this.actorParams() }, { preserveOnFailure: true }) } catch (e) { error = e }
          if (!this.current(scope)) return
          let actual
          try { actual = await this.read(scope) } catch (e) { this.unknownStage = 'metadata'; this.submitError = this.errorText(e); return }
          if (!this.current(scope) || !actual) return
          if (!isoEditMatches(actual, params)) {
            if (error && isoEditFingerprint(actual) === isoEditFingerprint(fresh)) this.submitError = this.errorText(error)
            else { this.unknownStage = 'metadata'; this.submitError = this.$t('message.iso.edit.unconfirmed') }
            return
          }
          this.metadataWritten = true; this.baseline = actual; this.$emit('refresh-data')
        }
        this.metadataDone = true
        if (linkChanged) await this.link(scope)
        else this.finish()
      } catch (e) { if (this.current(scope)) this.submitError = this.errorText(e) } finally { if (this.current(scope)) this.loading = false }
    },
    async link (scope) {
      if (!this.canLinkUserData || !this.allowed) return
      this.linkPending = true
      const desired = isoEditLinkTarget(this.userdataid, this.userdatapolicy)
      let actual = await this.read(scope); if (!this.current(scope) || !actual) return
      if (!isoEditMatches(actual, this.intent.params)) { this.failConflict(); return }
      if (JSON.stringify(isoEditLink(actual)) === JSON.stringify(desired)) { this.finish(); return }
      if (JSON.stringify(isoEditLink(actual)) !== JSON.stringify(isoEditLink(this.intent.before))) { this.failConflict(); return }
      this.intent.desired = desired
      let error
      try { await postAPI('linkUserDataToTemplate', isoLinkParams(this.boundResource, desired), { preserveOnFailure: true }) } catch (e) { error = e }
      if (!this.current(scope)) return
      try { actual = await this.read(scope) } catch (e) { this.unknownStage = 'userdata'; this.submitError = this.errorText(e); return }
      if (!this.current(scope) || !actual) return
      if (JSON.stringify(isoEditLink(actual)) === JSON.stringify(desired)) this.finish()
      else if (JSON.stringify(isoEditLink(actual)) === JSON.stringify(isoEditLink(this.intent.before))) this.submitError = error ? this.errorText(error) : this.$t('message.iso.edit.unconfirmed')
      else this.failConflict()
    },
    async checkStatus () {
      if (this.loading || !this.unknownStage || !this.allowed) return
      this.loading = true; const scope = this.scope
      try {
        const actual = await this.read(scope); if (!this.current(scope) || !actual) return
        const stage = this.unknownStage
        if (stage === 'metadata' && isoEditMatches(actual, this.intent.params)) { this.metadataDone = true; this.metadataWritten = true; this.baseline = actual; this.unknownStage = ''; if (this.intent.linkChanged) { this.linkPending = true; this.submitError = this.$t('message.iso.edit.link.not.started') } else this.finish() } else if (stage === 'userdata' && isoEditMatches(actual, this.intent.params) && JSON.stringify(isoEditLink(actual)) === JSON.stringify(this.intent.desired)) { this.unknownStage = ''; this.finish() } else if (isoEditFingerprint(actual) === isoEditFingerprint(this.intent.before) || (stage === 'userdata' && JSON.stringify(isoEditLink(actual)) === JSON.stringify(isoEditLink(this.intent.before)))) { this.unknownStage = ''; this.submitError = this.$t('message.iso.edit.retry.review') } else this.failConflict()
      } catch (e) { if (this.current(scope)) this.submitError = this.errorText(e) } finally { if (this.current(scope)) this.loading = false }
    }
  }
}
</script>
<style scoped lang="less">
.image-userdata-dialog :deep(.ant-alert) { margin-bottom: 16px; }
</style>
