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
  <MoldDialog size="md" focus-guard :title="$t(currentForm === 'Create' ? 'label.action.register.iso' : 'label.upload.iso.from.local')" :closable="!busy" :keyboard="!busy" @cancel="closeAction">
    <div class="iso-registration-content">
      <a-alert v-if="submitError" type="error" show-icon role="alert" :message="submitError" />
      <template v-if="phase === 'draft'">
      <a-form
        :ref="formRef"
        :model="form"
        :rules="rules"
        @finish="handleSubmit"
        v-ctrl-enter="handleSubmit"
        layout="vertical">
        <a-form-item
          v-if="currentForm === 'Create'"
          ref="url"
          name="url">
          <template #label>
            <tooltip-label :title="$t('label.url')" :tooltip="apiParams.url.description"/>
          </template>
          <a-input
            :disabled="busy"
            v-focus="currentForm === 'Create'"
            v-model:value="form.url"
            :placeholder="apiParams.url.description" />
        </a-form-item>
        <a-form-item
          v-if="currentForm === 'Upload'"
          ref="file"
          name="file"
          :label="$t('label.templatefileupload')">
          <a-upload-dragger
            :disabled="busy"
            :multiple="false"
            accept=".iso,.iso.gz,.iso.bz2,.iso.zip,.iso.xz"
            :fileList="fileList"
            @remove="handleRemove"
            :beforeUpload="beforeUpload"
            v-model:value="form.file">
            <p class="ant-upload-drag-icon">
              <cloud-upload-outlined />
            </p>
            <p class="ant-upload-text" v-if="fileList.length === 0">
              {{ $t('label.volume.volumefileupload.description') }}
            </p>
          </a-upload-dragger>
        </a-form-item>
        <a-form-item ref="name" name="name">
          <template #label>
            <tooltip-label :title="$t('label.name')" :tooltip="apiParams.name.description"/>
          </template>
          <a-input
            :disabled="busy"
            v-model:value="form.name"
            :placeholder="apiParams.name.description"
            v-focus="currentForm !== 'Create'" />
        </a-form-item>
        <a-form-item ref="displaytext" name="displaytext">
          <template #label>
            <tooltip-label :title="$t('label.displaytext')" :tooltip="apiParams.displaytext.description"/>
          </template>
          <a-input
            :disabled="busy"
            v-model:value="form.displaytext"
            :placeholder="apiParams.displaytext.description" />
        </a-form-item>

        <a-form-item ref="directdownload" name="directdownload" v-if="isAdmin && supportsParam('directdownload') && currentForm === 'Create'">
          <template #label>
            <tooltip-label :title="$t('label.directdownload')" :tooltip="apiParams.directdownload.description"/>
          </template>
          <a-switch :disabled="busy" v-model:checked="form.directdownload" @change="handleDirectDownloadChange"/>
        </a-form-item>

        <a-form-item ref="checksum" name="checksum">
          <template #label>
            <tooltip-label :title="$t('label.checksum')" :tooltip="apiParams.checksum.description"/>
          </template>
          <a-input
            :disabled="busy"
            v-model:value="form.checksum"
            :placeholder="apiParams.checksum.description" />
        </a-form-item>

        <a-form-item ref="zoneid" name="zoneid">
          <template #label>
            <tooltip-label :title="$t('label.zoneid')" :tooltip="apiParams.zoneid.description"/>
          </template>
          <a-select
            :disabled="busy"
            v-model:value="form.zoneid"
            showSearch
            optionFilterProp="label"
            :filterOption="(input, option) => {
              return  option.label.toLowerCase().indexOf(input.toLowerCase()) >= 0
            }"
            :loading="zoneLoading"
            :placeholder="apiParams.zoneid.description">
            <a-select-option :value="opt.id" v-for="opt in zoneList" :key="opt.id" :label="opt.name || opt.description">
              <span>
                <resource-icon v-if="opt.icon" :image="opt.icon.base64image" size="1x" style="margin-right: 5px"/>
                <global-outlined v-else style="margin-right: 5px" />
                {{ opt.name || opt.description }}
              </span>
            </a-select-option>
          </a-select>
        </a-form-item>

        <a-form-item name="domainid" ref="domainid" v-if="canChooseOwner">
          <template #label>
            <tooltip-label :title="$t('label.domainid')" :tooltip="apiParams.domainid.description"/>
          </template>
          <a-select
            :disabled="busy"
            v-model:value="form.domainid"
            showSearch
            optionFilterProp="label"
            :filterOption="(input, option) => {
              return option.label.toLowerCase().indexOf(input.toLowerCase()) >= 0
            }"
            :loading="domainLoading"
            :placeholder="apiParams.domainid.description"
            @change="val => { handleDomainChange(val) }">
            <a-select-option v-for="(opt, optIndex) in this.domains" :key="optIndex" :label="opt.path || opt.name || opt.description" :value="opt.id">
              <span>
                <resource-icon v-if="opt && opt.icon" :image="opt.icon.base64image" size="1x" style="margin-right: 5px"/>
                <block-outlined v-else style="margin-right: 5px" />
                {{ opt.path || opt.name || opt.description }}
              </span>
            </a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item name="account" ref="account" v-if="canChooseOwner && form.domainid">
          <template #label>
            <tooltip-label :title="$t('label.account')" :tooltip="apiParams.account.description"/>
          </template>
          <a-select
            :disabled="busy"
            v-model:value="form.account"
            showSearch
            optionFilterProp="label"
            :filterOption="(input, option) => {
              return option.value.toLowerCase().indexOf(input.toLowerCase()) >= 0
            }"
            :placeholder="apiParams.account.description"
            @change="fetchUserData">
            <a-select-option v-for="(acc, index) in accounts" :value="acc.name" :key="index">
              {{ acc.name }}
            </a-select-option>
          </a-select>
        </a-form-item>

        <a-form-item ref="bootable" name="bootable">
          <template #label>
            <tooltip-label :title="$t('label.bootable')" :tooltip="apiParams.bootable.description"/>
          </template>
          <a-switch :disabled="busy" v-model:checked="form.bootable" />
        </a-form-item>

        <a-form-item ref="ostypeid" name="ostypeid" v-if="form.bootable">
          <template #label>
            <tooltip-label :title="$t('label.ostypeid')" :tooltip="apiParams.ostypeid.description"/>
          </template>
          <a-select
            :disabled="busy"
            v-model:value="form.ostypeid"
            showSearch
            optionFilterProp="label"
            :filterOption="(input, option) => {
              return  option.label.toLowerCase().indexOf(input.toLowerCase()) >= 0
            }"
            :loading="osTypeLoading"
            :placeholder="apiParams.ostypeid.description">
            <a-select-option :value="opt.id" v-for="(opt, optIndex) in osTypes" :key="optIndex" :label="opt.name">
              <span>
                <resource-icon v-if="opt.icon" :image="opt.icon.base64image" size="1x" style="margin-right: 5px"/>
                <global-outlined v-else style="margin-right: 5px" />
                {{ opt.name }}
              </span>
            </a-select-option>
          </a-select>
        </a-form-item>

        <a-form-item
          name="arch"
          ref="arch"
          :help="!registrationCapability.schemaKnown ? $t('message.iso.metadata.unavailable') : !registrationCapability.parameters.arch ? $t('message.iso.arch.unsupported') : undefined">
          <template #label>
            <tooltip-label :title="$t('label.arch')" :tooltip="apiParams.arch.description"/>
          </template>
          <a-select
            :disabled="busy || !supportsParam('arch')"
            showSearch
            optionFilterProp="label"
            :filterOption="optionMatches"
            v-model:value="form.arch"
            :placeholder="apiParams.arch.description">
            <a-select-option v-for="opt in architectureTypes.opts" :key="opt.id" :value="opt.id" :label="opt.name || opt.description">
              {{ opt.name || opt.description }}
            </a-select-option>
          </a-select>
        </a-form-item>

        <div v-if="canLinkUserData" class="iso-userdata-fields">
          <a-form-item :label="$t('label.user.data')" name="userdataid">
            <a-select
v-model:value="userdataid"
:disabled="busy"
:loading="userDataLoading"
allow-clear
show-search
option-filter-prop="label"
:filter-option="optionMatches"
:placeholder="$t('label.user.data')">
              <a-select-option v-for="item in userDataOptions" :key="item.id" :value="item.id" :label="item.name">{{ item.name }}</a-select-option>
            </a-select>
          </a-form-item>
          <a-form-item :label="$t('label.user.data.policy')" name="userdatapolicy">
            <a-select v-model:value="userdatapolicy" :disabled="busy || !userdataid" :filter-option="optionMatches" show-search option-filter-prop="label">
              <a-select-option v-for="policy in ['allowoverride', 'append', 'denyoverride']" :key="policy" :value="policy" :label="policy">{{ policy }}</a-select-option>
            </a-select>
          </a-form-item>
        </div>
        <a-row :gutter="12">
          <a-col :md="24" :lg="12">
            <a-form-item ref="isextractable" name="isextractable" v-if="supportsParam('isextractable')">
              <template #label>
                <tooltip-label :title="$t('label.isextractable')" :tooltip="apiParams.isextractable.description"/>
              </template>
              <a-switch :disabled="busy" v-model:checked="form.isextractable" />
            </a-form-item>
          </a-col>
          <a-col :md="24" :lg="12">
            <a-form-item
              ref="ispublic"
              name="ispublic"
v-if="canPublish"
              >
              <template #label>
                <tooltip-label :title="$t('label.ispublic')" :tooltip="apiParams.ispublic.description"/>
              </template>
              <a-switch :disabled="busy" v-model:checked="form.ispublic" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="12">
          <a-col :md="24" :lg="12">
            <a-form-item ref="isfeatured" name="isfeatured" v-if="isAdmin && supportsParam('isfeatured')">
              <template #label>
                <tooltip-label :title="$t('label.isfeatured')" :tooltip="apiParams.isfeatured.description"/>
              </template>
              <a-switch :disabled="busy" v-model:checked="form.isfeatured" />
            </a-form-item>
          </a-col>
          <a-col :md="24" :lg="12">
            <a-form-item ref="isdynamicallyscalable" name="isdynamicallyscalable" v-if="supportsParam('isdynamicallyscalable')">
              <template #label>
                <tooltip-label :title="$t('label.isdynamicallyscalable')" :tooltip="apiParams.isdynamicallyscalable.description"/>
              </template>
              <a-switch :disabled="busy" v-model:checked="form.isdynamicallyscalable" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="12">
          <a-col :md="24" :lg="12">
            <a-form-item ref="passwordenabled" name="passwordenabled" v-if="supportsParam('passwordenabled')">
              <template #label>
                <tooltip-label :title="$t('label.passwordenabled')" :tooltip="apiParams.passwordenabled.description"/>
              </template>
              <a-switch :disabled="busy" v-model:checked="form.passwordenabled" />
            </a-form-item>
          </a-col>
          <a-col :md="24" :lg="12">
          </a-col>
        </a-row>
        <button type="submit" hidden tabindex="-1" aria-hidden="true"></button>
      </a-form>
      </template>
      <template v-else>
        <div v-if="acceptedId" class="iso-registration-resource">
          <strong class="iso-registration-name" :title="form.name">{{ form.name }}</strong>
          <span>{{ acceptedId }}</span>
        </div>
        <a-steps v-if="phase !== 'contextChanged'" direction="vertical" size="small" :current="stepIndex" :status="['failed', 'transferFailed', 'expired', 'linkFailed'].includes(phase) ? 'error' : 'process'">
          <a-step v-for="step in steps" :key="step" :title="$t(step)" />
        </a-steps>
        <a-progress v-if="phase === 'uploading'" :percent="uploadPercentage" />
        <a-alert v-if="phaseMessage" :type="phase === 'done' ? 'success' : ['failed', 'contextChanged'].includes(phase) ? 'error' : 'info'" show-icon :message="$t(phaseMessage)" />
        <a-form v-if="phase === 'linkFailed'" layout="vertical">
        <div v-if="canLinkUserData" class="iso-userdata-fields">
          <a-form-item :label="$t('label.user.data')" name="userdataid">
            <a-select
v-model:value="userdataid"
:disabled="busy"
:loading="userDataLoading"
allow-clear
show-search
option-filter-prop="label"
:filter-option="optionMatches"
:placeholder="$t('label.user.data')">
              <a-select-option v-for="item in userDataOptions" :key="item.id" :value="item.id" :label="item.name">{{ item.name }}</a-select-option>
            </a-select>
          </a-form-item>
          <a-form-item :label="$t('label.user.data.policy')" name="userdatapolicy">
            <a-select v-model:value="userdatapolicy" :disabled="busy || !userdataid" :filter-option="optionMatches" show-search option-filter-prop="label">
              <a-select-option v-for="policy in ['allowoverride', 'append', 'denyoverride']" :key="policy" :value="policy" :label="policy">{{ policy }}</a-select-option>
            </a-select>
          </a-form-item>
        </div>
        </a-form>
      </template>
    </div>
    <template #footer>
      <a-button v-if="!busy" @click="closeAction">{{ $t(acceptedId || phase !== 'draft' ? 'label.close' : 'label.cancel') }}</a-button>
      <a-button v-if="phase === 'draft'" type="primary" :loading="busy" :disabled="optionsLoading || !registrationCapability.available || !registrationCapability.schemaKnown" @click="handleSubmit">{{ $t('label.ok') }}</a-button>
      <a-button v-if="phase === 'preflight' && uploadOrigin" :href="uploadOrigin" target="_blank" rel="noopener noreferrer">{{ $t('label.ssvm.open.cert.page') }}</a-button>
      <a-popconfirm v-if="phase === 'uploading'" :title="$t('message.iso.transfer.stop.confirm')" :ok-text="$t('label.yes')" :cancel-text="$t('label.no')" @confirm="interruptTransfer">
        <a-button :disabled="transferInterrupted">{{ $t('label.iso.transfer.stop') }}</a-button>
      </a-popconfirm>
      <a-button v-if="phase === 'preflight'" type="primary" :loading="busy" @click="retryUpload">{{ $t('label.retry.upload') }}</a-button>
      <a-button v-if="phase === 'linkFailed'" type="primary" :loading="busy" :disabled="!userdataid" @click="retryUserdataLink">{{ $t('label.template.retry.userdata') }}</a-button>
      <a-button v-if="['pending', 'checkFailed', 'transferFailed'].includes(phase)" :loading="busy" @click="checkAccepted">{{ $t('label.iso.check.status') }}</a-button>
      <a-button v-if="acceptedId && !busy" @click="viewAcceptedIso">{{ $t('label.iso.view.accepted') }}</a-button>
      <a-button v-if="phase === 'uncertain' && !busy" @click="viewIsoList">{{ $t('label.isos') }}</a-button>
    </template>
  </MoldDialog>
</template>

<script>
import { ref, reactive } from 'vue'
import { getAPI, postAPI } from '@/api'
import { axios } from '@/utils/request'
import { probeSsvmCert } from '@/utils/ssvmProbe'
import { isoParameterHelp, isoRegistrationCapability, isoContext, isoBoolean } from '@/utils/isoModel'
import { acceptedIsoId, isoUploadTicket, uploadTicketExpired, isoRegistrationParams, isoReadiness, validIsoUrl } from '@/utils/isoRegistration'
import { validTemplateChecksum, templateOptionMatches } from '@/utils/templateForm'
import { safeTemplateReason } from '@/utils/templateAvailability'
import ResourceIcon from '@/components/view/ResourceIcon'
import TooltipLabel from '@/components/widgets/TooltipLabel'
import MoldDialog from '@/components/view/MoldDialog'

export default {
  name: 'RegisterIso',
  components: { ResourceIcon, TooltipLabel, MoldDialog },
  props: { resource: { type: Object, default: () => ({}) }, action: { type: Object, default: () => ({}) }, currentAction: { type: Object, default: () => ({}) } },
  emits: ['close-action', 'refresh-data'],
  data () {
    return {
      currentForm: ['plus-outlined', 'PlusOutlined'].includes(this.action?.currentAction?.icon || this.currentAction?.icon || 'plus-outlined') ? 'Create' : 'Upload',
      phase: 'draft',
      busy: false,
      submitError: '',
      acceptedId: '',
      acceptedParams: null,
      fileList: [],
      uploadPercentage: 0,
      uploadParams: null,
      transferAttempted: false,
      transferInterrupted: false,
      zones: [],
      osTypes: [],
      domains: [],
      accounts: [],
      userDataOptions: [],
      architectureTypes: { opts: [] },
      userdataid: undefined,
      userdatapolicy: 'allowoverride',
      zoneLoading: false,
      osTypeLoading: false,
      domainLoading: false,
      userDataLoading: false,
      optionsLoading: false,
      userDataRequest: 0,
      generation: 0,
      disposed: false,
      lastRows: []
    }
  },
  beforeCreate () {
    const getters = this.$store.getters
    this.apiParams = isoParameterHelp({ ...isoRegistrationCapability('url', getters).parameters, ...isoRegistrationCapability('local', getters).parameters })
    const schema = getters.apis?.linkUserDataToTemplate?.params
    this.linkUserDataParams = isoParameterHelp(Object.fromEntries((Array.isArray(schema) ? schema : []).filter(param => param && typeof param.name === 'string').map(param => [param.name, param])))
  },
  created () {
    this.apiParams = isoParameterHelp(this.registrationCapability.parameters)
    this.formRef = ref()
    this.form = reactive({ bootable: true, isextractable: false, ispublic: false, isfeatured: false, passwordenabled: false, isdynamicallyscalable: false, arch: this.supportsParam('arch') ? 'x86_64' : undefined })
    this.rules = reactive({
      url: [{ required: true, message: this.$t('message.error.required.input') }, { validator: async (rule, value) => { if (value && !validIsoUrl(value)) throw new Error(this.$t('message.iso.url.invalid')) } }],
      file: [{ required: true, validator: async () => { if (this.fileList.length !== 1 || !this.fileList[0]?.size) throw new Error(this.$t('message.iso.file.required')) } }],
      name: [{ required: true, whitespace: true, message: this.$t('message.error.required.input') }],
      zoneid: [{ required: true, message: this.$t('message.error.select') }],
      ostypeid: [{ required: true, message: this.$t('message.error.select') }],
      checksum: [{ validator: async (rule, value) => { if (!validTemplateChecksum(value)) throw new Error(this.$t('message.template.checksum.invalid')) } }]
    })
    this.fetchData()
  },
  mounted () {
    this.beforeUnload = event => { if (this.busy) { event.preventDefault(); event.returnValue = '' } }
    window.addEventListener('beforeunload', this.beforeUnload)
  },
  beforeUnmount () {
    this.disposed = true; this.generation += 1; if (this.uploadAbort) this.uploadAbort.abort(); this.clearWait(); this.uploadParams = null
    window.removeEventListener('beforeunload', this.beforeUnload)
  },
  watch: {
    registrationScope () {
      this.generation += 1; if (this.uploadAbort) this.uploadAbort.abort(); this.clearWait(); this.uploadParams = null; this.acceptedId = ''; this.acceptedParams = null; this.userDataOptions = []; this.fileList = []; this.busy = false; this.phase = 'contextChanged'; this.submitError = ''
    }
  },
  computed: {
    registrationCapability () { return isoRegistrationCapability(this.currentForm === 'Create' ? 'url' : 'local', this.$store.getters) },
    registrationScope () { return isoContext({}, this.$store.getters) + '|' + this.currentForm + '|' + String(this.$store.state?.user?.token || '') },
    uploadOrigin () { try { const url = this.uploadParams && new URL(this.uploadParams.postURL); return url?.protocol === 'https:' ? url.origin : '' } catch (_) { return '' } },
    blocksNavigation () { return this.busy },
    isAdmin () { return this.$store.getters.userInfo.roletype === 'Admin' },
    canPublish () { return this.supportsParam('ispublic') && (this.isAdmin || isoBoolean(this.$store.getters.features?.userpublictemplateenabled) === true) },
    canChooseOwner () { return !this.$store.getters.project?.id && ['Admin', 'DomainAdmin', 'ResourceAdmin'].includes(this.$store.getters.userInfo.roletype) && this.supportsParam('domainid') && 'listDomains' in this.$store.getters.apis },
    canLinkUserData () { return ['listUserData', 'linkUserDataToTemplate'].every(api => api in this.$store.getters.apis) },
    zoneList () { return this.form?.directdownload ? this.zones : this.zones.filter(zone => zone.type !== 'Edge') },
    steps () { return ['label.iso.stage.request', ...(this.currentForm === 'Upload' ? ['label.iso.stage.transfer'] : []), 'label.iso.stage.ready', 'label.iso.stage.userdata', 'label.iso.stage.done'] },
    stepIndex () { const local = this.currentForm === 'Upload'; return this.phase === 'done' ? this.steps.length - 1 : ['linking', 'linkFailed'].includes(this.phase) ? (local ? 3 : 2) : ['checking', 'pending', 'checkFailed', 'failed'].includes(this.phase) ? (local ? 2 : 1) : ['preparing', 'preflight', 'uploading', 'transferFailed', 'expired'].includes(this.phase) ? 1 : 0 },
    phaseMessage () { return ({ preflight: 'message.iso.preflight.retry', transferFailed: 'message.iso.transfer.check', pending: 'message.iso.ready.pending', checkFailed: 'message.iso.ready.check.failed', linkFailed: 'message.userdata.image.partial', done: 'message.iso.registration.done', expired: 'message.iso.ticket.expired', uncertain: 'message.iso.request.uncertain', contextChanged: 'message.iso.context.changed', failed: 'message.iso.registration.failed' })[this.phase] || '' }
  },
  methods: {
    optionMatches: templateOptionMatches,
    supportsParam (name) { return !!this.registrationCapability.parameters[name] },
    errorText (error) { const text = error?.response?.headers?.['x-description'] || error?.response?.data?.errorresponse?.errortext || error?.message || this.$t('message.request.failed'); return safeTemplateReason(text.startsWith('message.') ? this.$t(text) : text) },
    current (run) { return !this.disposed && this.phase !== 'contextChanged' && run.generation === this.generation && run.scope === this.registrationScope },
    run () { return { generation: this.generation, scope: this.registrationScope } },
    clearWait () { if (this.pollTimer) clearTimeout(this.pollTimer); this.pollTimer = null; if (this.pollResolve) this.pollResolve(); this.pollResolve = null },
    wait () { return new Promise(resolve => { this.pollResolve = resolve; this.pollTimer = setTimeout(() => { this.pollTimer = null; this.pollResolve = null; resolve() }, 2000) }) },
    async fetchData () {
      this.optionsLoading = true; this.architectureTypes.opts = this.$fetchCpuArchitectureTypes()
      const work = [this.fetchZoneData(), this.fetchOsType(), this.fetchUserData()]
      if (this.canChooseOwner) work.push(this.fetchDomains())
      await Promise.allSettled(work); if (!this.disposed) this.optionsLoading = false
    },
    async fetchZoneData () {
      if (!('listZones' in this.$store.getters.apis)) return
      const run = this.run(); this.zoneLoading = true
      try { const json = await getAPI('listZones', { showicon: true }); if (!this.current(run)) return; this.zones = [...(this.isAdmin && this.currentForm === 'Create' ? [{ id: '-1', name: this.$t('label.all.zone') }] : []), ...(json.listzonesresponse?.zone || [])]; if (!this.form.zoneid) this.form.zoneid = this.zoneList.find(zone => zone.id !== '-1')?.id || '' } catch (error) { if (this.current(run)) this.submitError = this.errorText(error) } finally { if (this.current(run)) this.zoneLoading = false }
    },
    async fetchOsType () {
      if (!('listOsTypes' in this.$store.getters.apis)) return
      const run = this.run(); this.osTypeLoading = true
      try { const json = await getAPI('listOsTypes'); if (!this.current(run)) return; this.osTypes = json.listostypesresponse?.ostype || []; if (!this.form.ostypeid) this.form.ostypeid = this.osTypes[0]?.id } catch (error) { if (this.current(run)) this.submitError = this.errorText(error) } finally { if (this.current(run)) this.osTypeLoading = false }
    },
    async fetchDomains () {
      const run = this.run(); this.domainLoading = true
      try { const json = await getAPI('listDomains', { listall: true, details: 'min' }); if (this.current(run)) this.domains = json.listdomainsresponse?.domain || [] } catch (error) { if (this.current(run)) this.submitError = this.errorText(error) } finally { if (this.current(run)) this.domainLoading = false }
    },
    async fetchAccounts () {
      if (!('listAccounts' in this.$store.getters.apis) || !this.form.domainid) return
      const domain = this.form.domainid; const run = this.run()
      try { const json = await getAPI('listAccounts', { domainid: domain }); if (this.current(run) && this.form.domainid === domain) this.accounts = json.listaccountsresponse?.account || [] } catch (error) { if (this.current(run)) this.submitError = this.errorText(error) }
    },
    async fetchUserData () {
      if (!this.canLinkUserData) return
      const token = ++this.userDataRequest; const run = this.run(); const owner = { domainid: this.form.domainid || this.$store.getters.userInfo.domainid, account: this.form.account || this.$store.getters.userInfo.account, projectid: this.$store.getters.project?.id }
      this.userDataLoading = true
      try { const json = await getAPI('listUserData', owner.projectid ? { projectid: owner.projectid, listall: true } : { domainid: owner.domainid, account: owner.account, listall: true }); if (this.current(run) && token === this.userDataRequest) this.userDataOptions = (json.listuserdataresponse?.userdata || []).filter(row => owner.projectid ? row.projectid === owner.projectid : !row.projectid && row.account === owner.account && row.domainid === owner.domainid) } catch (error) { if (this.current(run)) this.submitError = this.errorText(error) } finally { if (this.current(run) && token === this.userDataRequest) this.userDataLoading = false }
    },
    handleDomainChange () { this.form.account = undefined; this.accounts = []; this.userdataid = undefined; this.fetchAccounts(); this.fetchUserData() },
    handleDirectDownloadChange () { if (!this.zoneList.some(zone => zone.id === this.form.zoneid)) this.form.zoneid = this.zoneList[0]?.id },
    beforeUpload (file) { this.fileList = [file]; this.form.file = file; if (!this.form.name) this.form.name = file.name; return false },
    handleRemove () { if (this.busy || this.acceptedId) return false; this.fileList = []; this.form.file = undefined; return true },
    async handleSubmit (event) {
      if (event && typeof event.preventDefault === 'function') event.preventDefault()
      if (this.busy || this.optionsLoading || this.acceptedId || this.phase !== 'draft') return
      this.busy = true; this.submitError = ''; const run = this.run()
      try {
        await this.formRef.value.validate()
        if (!this.current(run)) return
        const params = isoRegistrationParams(this.form, this.registrationCapability, this.$store.getters)
        if (this.currentForm === 'Upload' && (this.fileList.length !== 1 || !this.fileList[0]?.size)) throw new Error(this.$t('message.iso.file.required'))
        this.phase = 'requesting'
        let json
        try { json = this.currentForm === 'Create' ? await postAPI('registerIso', params, { preserveOnFailure: true }) : await getAPI('getUploadParamsForIso', params) } catch (error) { if (this.current(run)) { this.phase = 'uncertain'; this.submitError = this.errorText(error) } return }
        if (!this.current(run)) return
        this.acceptedId = acceptedIsoId(this.currentForm, json); this.acceptedParams = { ...params }; this.$emit('refresh-data')
        if (this.currentForm === 'Upload') {
          try { this.uploadParams = isoUploadTicket(json) } catch (error) { this.phase = 'checkFailed'; this.submitError = this.$t(error.message); return }
          await this.sendFile(run)
        } else await this.finishRegistration(run)
      } catch (error) {
        if (!this.current(run)) return
        if (error?.errorFields) this.formRef.value.scrollToField(error.errorFields[0].name)
        else { this.submitError = this.$t(error.message); if (this.phase === 'requesting') this.phase = 'uncertain' }
      } finally { if (this.current(run)) this.busy = false }
    },
    async retryUpload () {
      if (this.busy || this.phase !== 'preflight' || !this.acceptedId || this.transferAttempted) return
      this.busy = true; this.submitError = ''; const run = this.run()
      try { await this.sendFile(run) } finally { if (this.current(run)) this.busy = false }
    },
    interruptTransfer () {
      if (this.phase !== 'uploading' || !this.uploadAbort || this.transferInterrupted) return
      this.transferInterrupted = true
      this.uploadAbort.abort()
    },
    async sendFile (run) {
      if (!this.current(run)) return
      if (uploadTicketExpired(this.uploadParams)) { this.phase = 'expired'; this.uploadParams = null; return }
      this.phase = 'preparing'
      if (!await probeSsvmCert(new URL(this.uploadParams.postURL).origin)) { if (this.current(run)) this.phase = 'preflight'; return }
      if (!this.current(run)) return
      if (uploadTicketExpired(this.uploadParams)) { this.phase = 'expired'; this.uploadParams = null; return }
      const ticket = this.uploadParams; const data = new FormData(); data.append('files[]', this.fileList[0]); this.phase = 'uploading'; this.transferAttempted = true; this.transferInterrupted = false; this.uploadPercentage = 0
      this.uploadAbort = new AbortController()
      try {
        await axios.post(ticket.postURL, data, { headers: { 'x-signature': ticket.signature, 'x-expires': ticket.expires, 'x-metadata': ticket.metadata, 'x-host': new URL(ticket.postURL).host }, signal: this.uploadAbort.signal, timeout: 86400000, onUploadProgress: event => { if (this.current(run) && event.total > 0) this.uploadPercentage = Math.min(100, Math.round(100 * event.loaded / event.total)) } })
        if (this.current(run)) { this.uploadParams = null; await this.finishRegistration(run) }
      } catch (error) { if (this.current(run)) { this.uploadParams = null; this.phase = 'transferFailed'; this.submitError = this.transferInterrupted ? this.$t('message.iso.transfer.stopped') : this.errorText(error); this.$emit('refresh-data') } }
    },
    async readAccepted (run) {
      const rows = []; let count; let countKnown = false; let page = 1
      do {
        const json = await getAPI('listIsos', { id: this.acceptedId, isofilter: this.isAdmin ? 'all' : 'self', showunique: false, listall: true, page, pagesize: 100, ...(this.acceptedParams.zoneid !== '-1' ? { zoneid: this.acceptedParams.zoneid } : {}), ...(this.$store.getters.project?.id ? { projectid: this.$store.getters.project.id } : {}) })
        if (!this.current(run)) return null
        const result = isoReadiness(json, this.acceptedId, this.acceptedParams.zoneid); rows.push(...result.rows); count = result.count; countKnown = result.countKnown; if (!result.rows.length || !result.countKnown) break
        page += 1
      } while (rows.length < count && page <= 100)
      this.lastRows = rows
      return isoReadiness({ listisosresponse: { iso: rows, ...(countKnown ? { count } : {}) } }, this.acceptedId, this.acceptedParams.zoneid)
    },
    async finishRegistration (run) {
      this.phase = 'checking'
      try {
        for (let attempt = 0; attempt < 12; attempt += 1) {
          const result = await this.readAccepted(run); if (!this.current(run) || !result) return
          if (result.ready) { await this.completeUserdata(run); return }
          if (result.failed) { this.phase = 'failed'; this.submitError = result.reasons.join(' · '); this.$emit('refresh-data'); return }
          if (attempt < 11) await this.wait()
        }
        if (this.current(run)) this.phase = 'pending'
      } catch (error) { if (this.current(run)) { this.phase = 'checkFailed'; this.submitError = this.errorText(error) } }
    },
    async completeUserdata (run) {
      if (!this.current(run)) return
      if (this.userdataid) {
        this.phase = 'linking'
        try {
          await postAPI('linkUserDataToTemplate', { userdataid: this.userdataid, templateid: this.acceptedId, userdatapolicy: this.userdatapolicy }, { preserveOnFailure: true })
          if (!this.current(run)) return
          const result = await this.readAccepted(run); if (!this.current(run)) return
          if (!result?.rows.some(row => row.userdataid === this.userdataid && String(row.userdatapolicy || '').toLowerCase() === this.userdatapolicy.toLowerCase())) throw new Error(this.$t('message.iso.userdata.unconfirmed'))
        } catch (error) { if (this.current(run)) { this.phase = 'linkFailed'; this.submitError = this.errorText(error); this.fetchUserData() } return }
      }
      if (this.current(run)) { this.phase = 'done'; this.submitError = ''; this.$emit('refresh-data'); this.$notification.success({ message: this.$t('message.iso.registration.done'), description: this.form.name }) }
    },
    async retryUserdataLink () { if (this.busy || this.phase !== 'linkFailed' || !this.userdataid || !this.acceptedId) return; this.busy = true; this.submitError = ''; const run = this.run(); try { await this.completeUserdata(run) } finally { if (this.current(run)) this.busy = false } },
    async checkAccepted () { if (this.busy || !this.acceptedId) return; this.busy = true; this.submitError = ''; const run = this.run(); try { await this.finishRegistration(run) } finally { if (this.current(run)) this.busy = false } },
    viewAcceptedIso () { if (this.busy || !this.acceptedId) return; this.$emit('close-action'); this.$router.push({ path: '/iso/' + encodeURIComponent(this.acceptedId) }) },
    viewIsoList () { if (this.busy) return; this.$emit('close-action'); this.$router.push({ path: '/iso', query: { keyword: this.form.name } }) },
    closeAction () { if (this.busy) return; this.uploadParams = null; this.$emit('refresh-data'); this.$emit('close-action') }
  }
}
</script>
<style scoped>
.iso-registration-content { min-width: 0; }
.iso-registration-content :deep(.ant-alert) { margin-bottom: 16px; }
.iso-registration-resource { display: flex; flex-direction: column; gap: 6px; margin-bottom: 16px; overflow-wrap: anywhere; }
.iso-registration-name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.iso-userdata-fields { min-width: 0; }
</style>
