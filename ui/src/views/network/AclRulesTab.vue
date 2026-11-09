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
  <a-spin :spinning="fetchLoading">
    <NetworkRulesToolbar :can-add="can('add')" :loading="fetchLoading" @add="openRule('add')" @refresh="reload">
      <a-button v-if="can('import')" @click="openDialog('import')"><template #icon><upload-outlined /></template>{{ $t('label.acl.import') }}</a-button>
      <a-button :disabled="!acls.length" @click="exportAclList"><template #icon><download-outlined /></template>{{ $t('label.acl.export') }}</a-button>
      <a-input-search class="network-rules-search" :placeholder="$t('label.search')" v-model:value="searchQuery" @search="fetchData" />
    </NetworkRulesToolbar>

    <a-alert v-if="notice" class="acl-access-notice" show-icon :type="notice.type" :message="$t(notice.message)">
      <template v-if="notice.detail || notice.retry" #description>
        <p v-if="notice.detail">{{ notice.detail }}</p>
        <a-button v-if="notice.retry" size="small" @click="reload">{{ $t('label.retry') }}</a-button>
      </template>
    </a-alert>

    <draggable
      v-if="acls.length"
      v-model="acls"
      class="list"
      :disabled="!canMove"
      @start="dragScope = canMove ? scope : null"
      @change="changeOrder"
      handle=".drag-handle"
      animation="200"
      ghost-class="drag-ghost"
      item-key="id">
      <template #item="{element}">
        <div class="list__item">
          <div v-if="canMove && acls.length > 1" class="drag-handle" aria-hidden="true"><drag-outlined /></div>
            <div class="list__container">
              <div class="list__col">
                <div class="list__label">{{ $t('label.rule.number') }}</div>
                <div>{{ element.number }}</div>
              </div>
              <div class="list__col">
                <div class="list__label">{{ $t('label.cidrlist') }}</div>
                <div>{{ element.cidrlist }}</div>
              </div>
              <div class="list__col">
                <div class="list__label">{{ $t('label.action') }}</div>
                <div>{{ element.action }}</div>
              </div>
              <div class="list__col">
                <div class="list__label">{{ $t('label.protocol') }}</div>
                <div>{{ element.protocol }}</div>
              </div>
              <div class="list__col" v-if="element.startport !== undefined">
                <div class="list__label">{{ $t('label.startport') }}</div>
                <div>{{ element.startport }}</div>
              </div>
              <div class="list__col" v-if="element.endport !== undefined">
                <div class="list__label">{{ $t('label.endport') }}</div>
                <div>{{ element.endport }}</div>
              </div>
              <div class="list__col" v-if="element.icmpcode !== undefined">
                <div class="list__label">{{ $t('label.icmpcode') }}</div>
                <div>{{ element.icmpcode }}</div>
              </div>
              <div class="list__col" v-if="element.icmptype !== undefined">
                <div class="list__label">{{ $t('label.icmptype') }}</div>
                <div>{{ element.icmptype }}</div>
              </div>
              <div class="list__col">
                <div class="list__label">{{ $t('label.traffictype') }}</div>
                <div>{{ element.traffictype }}</div>
              </div>
              <div class="list__col">
                <div class="list__label">{{ $t('label.description') }}</div>
                <div>{{ element.reason }}</div>
              </div>
            </div>
          <div v-if="can('readTags') || can('edit') || can('remove') || canMove" class="list__actions">
            <tooltip-button
              v-if="canMove && element.id !== acls[0].id"
              :tooltip="$t('label.move.to.top')"
              icon="vertical-align-top-outlined"
              @onClick="moveRule(element.id, null, acls[0].id)" />
            <tooltip-button
              v-if="canMove && element.id !== acls[acls.length - 1].id"
              :tooltip="$t('label.move.to.bottom')"
              icon="vertical-align-bottom-outlined"
              @onClick="moveRule(element.id, acls[acls.length - 1].id, null)" />
            <tooltip-button v-if="can('readTags')" :tooltip="$t('label.tags')" icon="tag-outlined" @onClick="openTags(element)" />
            <tooltip-button v-if="can('edit')" :tooltip="$t('label.edit')" icon="edit-outlined" @onClick="openRule('edit', element)" />
            <tooltip-button
              v-if="can('remove')"
              :tooltip="$t('label.delete')"
              icon="delete-outlined"
              danger
              @onClick="openDialog('remove', element)" />
          </div>
        </div>
      </template>
    </draggable>
    <a-empty v-else-if="!fetchLoading && !notice" />

    <MoldDialog
      v-if="dialog && dialog.mode !== 'import'"
      :key="dialog.mode"
      size="md"
      focus-guard
      :title="dialogTitle"
      :closable="!busy"
      :keyboard="!busy"
      @cancel="closeDialog">
      <dl class="acl-dialog-context">
        <dt>{{ $t('label.add.acl.name') }}</dt><dd>{{ target?.row.name }}</dd>
        <template v-if="dialog.item">
          <dt>{{ $t('label.rule.number') }}</dt><dd>{{ dialog.item.number }}</dd>
        </template>
      </dl>
      <a-form
        v-if="['add', 'edit'].includes(dialog.mode)"
        ref="ruleForm"
        :model="form"
        :rules="rules"
        layout="vertical"
        :disabled="busy || blocked || !!pending"
        @finish="submitRule"
        v-ctrl-enter="submitRule">
        <a-form-item :label="$t('label.number')" ref="number" name="number">
          <a-input-number v-focus="true" style="width: 100%" v-model:value="form.number" />
        </a-form-item>
        <a-form-item :label="$t('label.cidrlist')" ref="cidrlist" name="cidrlist">
          <a-input v-model:value="form.cidrlist" />
        </a-form-item>
        <a-form-item :label="$t('label.action')" ref="action" name="action">
          <a-select
            v-model:value="form.action"
            showSearch
            optionFilterProp="label"
            :filterOption="(input, option) => {
              return option.label.toLowerCase().indexOf(input.toLowerCase()) >= 0
            }" >
            <a-select-option value="allow" :label="$t('label.allow')">{{ $t('label.allow') }}</a-select-option>
            <a-select-option value="deny" :label="$t('label.deny')">{{ $t('label.deny') }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item :label="$t('label.protocol')" ref="protocol" name="protocol">
          <a-select
           v-model:value="form.protocol"
            showSearch
            optionFilterProp="label"
            :filterOption="(input, option) => {
              return option.label.toLowerCase().indexOf(input.toLowerCase()) >= 0
            }" >
            <a-select-option value="tcp" :label="$t('label.tcp')">{{ capitalise($t('label.tcp')) }}</a-select-option>
            <a-select-option value="udp" :label="$t('label.udp')">{{ capitalise($t('label.udp')) }}</a-select-option>
            <a-select-option value="icmp" :label="$t('label.icmp')">{{ capitalise($t('label.icmp')) }}</a-select-option>
            <a-select-option value="all" :label="$t('label.all')">{{ $t('label.all') }}</a-select-option>
            <a-select-option value="protocolnumber" :label="$t('label.protocol.number')">{{ $t('label.protocol.number') }}</a-select-option>
          </a-select>
        </a-form-item>

        <a-form-item
          v-if="form.protocol === 'protocolnumber'"
          :label="$t('label.protocolnumber')"
          ref="protocolnumber"
          name="protocolnumber">
          <a-select
            v-model:value="form.protocolnumber"
            showSearch
            optionFilterProp="label"
            :filterOption="(input, option) => {
              return option.label.toLowerCase().includes(input.toLowerCase())
            }" >
            <a-select-option v-for="(opt, optIndex) in protocolNumbers" :key="optIndex" :value="opt.index" :label="opt.name">
              {{ opt.index + ' - ' + opt.name }}
            </a-select-option>
          </a-select>
        </a-form-item>

        <div v-if="form.protocol === 'icmp' || (form.protocol === 'protocolnumber' && form.protocolnumber === 1)">
          <a-form-item :label="$t('label.icmptype')" ref="icmptype" name="icmptype">
            <a-select
              v-model:value="form.icmptype"
              @change="val => { updateIcmpCodes(val) }"
              showSearch
              optionFilterProp="label"
              :filterOption="(input, option) => {
              return option.label.toLowerCase().includes(input.toLowerCase())
            }" >
              <a-select-option v-for="(opt) in icmpTypes" :key="opt.index" :value="opt.index" :label="opt.description">
                {{ opt.index + ' - ' + opt.description }}
              </a-select-option>
            </a-select>
          </a-form-item>
          <a-form-item :label="$t('label.icmpcode')" ref="icmpcode" name="icmpcode">
            <a-select
              v-model:value="form.icmpcode"
              showSearch
              optionFilterProp="label"
              :filterOption="(input, option) => {
              return option.label.toLowerCase().includes(input.toLowerCase())
            }" >
              <a-select-option v-for="(opt) in icmpCodes" :key="opt.code" :value="opt.code" :label="opt.description">
                {{ opt.code + ' - ' + opt.description }}
              </a-select-option>
            </a-select>
          </a-form-item>
        </div>

        <div v-if="['tcp', 'udp', 'protocolnumber'].includes(form.protocol) && !(form.protocol === 'protocolnumber' && form.protocolnumber === 1)">
          <a-form-item :label="$t('label.startport')" ref="startport" name="startport">
            <a-input-number style="width: 100%" v-model:value="form.startport" />
          </a-form-item>
          <a-form-item :label="$t('label.endport')" ref="endport" name="endport">
            <a-input-number style="width: 100%" v-model:value="form.endport" />
          </a-form-item>
        </div>

        <a-form-item :label="$t('label.traffictype')" ref="traffictype" name="traffictype">
          <a-select
            v-model:value="form.traffictype"
            showSearch
            optionFilterProp="label"
            :filterOption="(input, option) => {
              return option.label.toLowerCase().indexOf(input.toLowerCase()) >= 0
            }" >
            <a-select-option value="ingress" :label="$t('label.ingress')">{{ $t('label.ingress') }}</a-select-option>
            <a-select-option value="egress" :label="$t('label.egress')">{{ $t('label.egress') }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item :label="$t('label.description')" ref="reason" name="reason">
          <a-textarea
            v-model:value="form.reason"
            :autoSize="{ minRows: 2 }"
            :placeholder="$t('label.acl.reason.description')" />
        </a-form-item>

      </a-form>
      <template v-else-if="dialog.mode === 'tags'">
        <a-form
          v-if="can('addTag')"
          layout="vertical"
          :disabled="busy || blocked || !!pending"
          @finish="addTag"
          v-ctrl-enter="addTag">
          <a-form-item :label="$t('label.key')"><a-input v-focus="true" v-model:value="tagForm.key" /></a-form-item>
          <a-form-item :label="$t('label.value')"><a-input v-model:value="tagForm.value" /></a-form-item>
        </a-form>
        <a-spin :spinning="tagsLoading">
          <a-space wrap>
            <a-tag v-for="tag in tags" :key="tag.key" :closable="can('removeTag') && !busy && !blocked && !pending" @close="removeTag($event, tag)">
              {{ tag.key }} = {{ tag.value }}
            </a-tag>
          </a-space>
          <a-empty v-if="!tagsLoading && !tags.length" />
        </a-spin>
      </template>
      <p v-else>{{ $t('message.delete.acl.rule') }}</p>
      <a-alert v-if="dialogError" class="acl-access-notice" show-icon type="error" :message="$t(dialogError.message)" :description="dialogError.detail" />
      <template #footer>
        <a-button :disabled="busy" @click="closeDialog">{{ $t('label.close') }}</a-button>
        <a-button v-if="blocked" type="primary" @click="reload">{{ $t('label.refresh') }}</a-button>
        <a-button v-else-if="pending" type="primary" :loading="busy" @click="recheck">{{ $t('label.vmvolume.check') }}</a-button>
        <a-button v-else-if="dialog.mode === 'tags' && can('addTag')" type="primary" :loading="busy" :disabled="!tagForm.key.trim() || !tagForm.value.trim()" @click="addTag">{{ $t('label.add') }}</a-button>
        <a-button v-else-if="dialog.mode !== 'tags'" type="primary" :danger="dialog.mode === 'remove'" :loading="busy" @click="submitRule">
          {{ $t(dialog.mode === 'remove' ? 'label.delete' : dialogError ? 'label.retry' : 'label.ok') }}
        </a-button>
      </template>
    </MoldDialog>
    <ImportNetworkACL
      v-if="dialog?.mode === 'import'"
      :resource="target.row"
      :project-args="target.params"
      :can-write="canImport"
      @imported="refreshAfterImport"
      @close-action="closeDialog"
      @refresh-access="reload" />
  </a-spin>
</template>

<script>
import NetworkRulesToolbar from '@/components/view/NetworkRulesToolbar'
import MoldDialog from '@/components/view/MoldDialog'
import { getAPI, postAPI } from '@/api'
import draggable from 'vuedraggable'
import TooltipButton from '@/components/widgets/TooltipButton'
import { networkError } from '@/utils/networkLifecycle'
import { aclCommands, aclDenied, aclRequestOptions, aclResponse, discoverAclAccess, resolveAclScope, runAclWrite } from '@/utils/vpcAclAccess'
import ImportNetworkACL from './ImportNetworkACL'

const messages = {
  add: 'message.success.add.rule',
  edit: 'message.success.edit.acl',
  remove: 'message.success.delete.acl.rule',
  move: 'message.success.move.acl.order',
  addTag: 'message.success.add.tag',
  removeTag: 'message.success.delete.tag'
}

export default {
  name: 'AclListRulesTab',
  components: { NetworkRulesToolbar, MoldDialog, draggable, TooltipButton, ImportNetworkACL },
  props: {
    resource: { type: Object, required: true },
    loading: { type: Boolean, default: false }
  },
  data: () => ({
    active: true,
    epoch: 0,
    ruleRead: 0,
    target: null,
    access: null,
    notice: null,
    searchQuery: '',
    appliedSearch: '',
    acls: [],
    lastRules: [],
    fetchLoading: false,
    protocolNumbers: [],
    icmpTypes: [],
    icmpCodes: [],
    tags: [],
    tagsLoading: false,
    dialog: null,
    form: {},
    tagForm: {},
    rules: {},
    busy: false,
    blocked: false,
    pending: null,
    dialogError: null,
    dragScope: null
  }),
  computed: {
    scope () {
      const getters = this.$store.getters
      return JSON.stringify([this.$route.fullPath, getters.token, getters.userInfo?.id, getters.project?.id,
        this.$store.state.user?.discoveryGeneration, this.resource.id, this.resource.vpcid, this.resource.projectid])
    },
    dialogTitle () {
      return this.$t(({ add: 'label.add.rule', edit: 'label.edit.rule', tags: 'label.tags', remove: 'label.delete' })[this.dialog?.mode])
    },
    canMove () { return this.can('move') && !this.searchQuery && !this.appliedSearch },
    canImport () {
      const dialog = this.dialog
      return () => dialog?.mode === 'import' && this.dialog === dialog && dialog.scope === this.scope && this.can('import')
    }
  },
  watch: {
    scope: { handler () { this.reset(); this.$nextTick(() => { if (this.active && !this.loading) this.reload() }) }, flush: 'sync' },
    loading (loading) { if (!loading && this.active) this.reload() },
    '$store.getters.apis': { handler () { this.reset(); this.$nextTick(() => { if (this.active && !this.loading) this.reload() }) }, flush: 'sync' }
  },
  mounted () { if (!this.loading) this.reload() },
  activated () { if (!this.active) { this.active = true; this.reload() } },
  deactivated () { this.active = false; this.reset() },
  beforeUnmount () { this.active = false; this.reset() },
  methods: {
    reset () {
      this.epoch++
      this.target = null
      this.access = null
      this.acls = []
      this.lastRules = []
      this.fetchLoading = false
      this.notice = null
      this.dragScope = null
      this.protocolNumbers = []
      this.icmpTypes = []
      this.closeDialog(true)
    },
    live (scope, epoch) {
      return this.active && scope === this.scope && epoch === this.epoch
    },
    can (action) {
      return this.active && !this.loading && this.access?.scope === this.scope &&
        this.access.flags[action] && (action === 'readTags' || (!this.blocked && !this.fetchLoading))
    },
    async reload () {
      if (!this.active || this.loading || !this.resource.id || this.busy ||
        (this.$route.name === 'acllist' && this.$route.params.id !== this.resource.id)) return
      this.reset()
      const scope = this.scope
      const epoch = this.epoch
      const current = () => this.live(scope, epoch)
      const project = this.$store.getters.project?.id
      const resource = { ...this.resource }
      this.fetchLoading = true
      try {
        const target = await resolveAclScope(getAPI, resource, project)
        if (!current()) return
        if (!target) {
          this.notice = { type: 'warning', message: 'message.acl.scope.unavailable' }
          return
        }
        this.target = target
        const read = this.fetchData()
        try {
          const flags = await discoverAclAccess(getAPI, target, this.$store.getters.userInfo?.roletype === 'Admin')
          if (await read && current()) {
            this.access = { scope, flags }
            if (!Object.keys(flags).some(key => key !== 'readTags' && flags[key]) && !this.notice) {
              this.notice = { type: 'info', message: 'message.acl.access.readonly' }
            }
          }
        } catch (error) {
          if (current()) this.notice = { type: 'warning', message: 'message.acl.access.failed', retry: true }
        }
        await read
      } catch (error) {
        if (current()) this.notice = { type: 'warning', message: aclDenied(error) ? 'message.acl.scope.unavailable' : 'message.acl.access.failed', retry: !aclDenied(error) }
      } finally {
        if (current()) this.fetchLoading = false
      }
    },
    async fetchData () {
      if (!this.target || !this.active) return
      const scope = this.scope
      const epoch = this.epoch
      const read = ++this.ruleRead
      const current = () => this.live(scope, epoch) && read === this.ruleRead
      const keyword = this.searchQuery
      this.fetchLoading = true
      try {
        const json = await getAPI('listNetworkACLs', { ...this.target.params, aclid: this.target.row.id, keyword }, aclRequestOptions)
        const rows = aclResponse(json, 'listnetworkaclsresponse').networkacl || []
        if (!Array.isArray(rows)) throw new Error('Invalid ACL rules')
        if (current()) {
          this.appliedSearch = keyword
          this.lastRules = rows.slice().sort((a, b) => a.number - b.number)
          this.acls = this.lastRules.slice()
          return true
        }
      } catch (error) {
        if (current()) {
          this.access = null
          this.notice = { type: 'warning', message: 'message.acl.access.failed', retry: true }
        }
      } finally {
        if (current()) this.fetchLoading = false
      }
    },
    openDialog (mode, item) {
      const action = mode === 'tags' ? 'readTags' : mode
      if (this.dialog || !this.can(action) || (item && !this.acls.some(row => row.id === item.id))) return false
      this.dialog = { mode, item, scope: this.scope }
      return true
    },
    closeDialog (force = false) {
      if (this.busy && force !== true) return
      this.dialog = null
      this.form = {}
      this.tagForm = {}
      this.tags = []
      this.tagsLoading = false
      this.pending = null
      this.dialogError = null
      this.blocked = false
      this.busy = false
    },
    async openRule (mode, item) {
      if (!this.openDialog(mode, item)) return
      const protocol = String(item?.protocol || 'tcp').toLowerCase()
      const custom = !['tcp', 'udp', 'icmp', 'all'].includes(protocol)
      const dialog = this.dialog
      this.form = {
        number: item?.number,
        cidrlist: item?.cidrlist,
        action: item?.action?.toLowerCase() || 'allow',
        protocol: custom ? 'protocolnumber' : protocol,
        protocolnumber: custom ? Number(protocol) : undefined,
        startport: item?.startport,
        endport: item?.endport,
        icmptype: item?.icmptype ?? -1,
        icmpcode: item?.icmpcode ?? -1,
        traffictype: item?.traffictype?.toLowerCase() || 'ingress',
        reason: item?.reason
      }
      this.rules = { protocolnumber: [{ required: true, message: this.$t('label.required') }] }
      if (!('listNetworkProtocols' in this.$store.getters.apis)) return
      try {
        const [protocols, icmp] = await Promise.all(['protocolnumber', 'icmptype'].map(option =>
          getAPI('listNetworkProtocols', { ...this.target.params, option }, aclRequestOptions)))
        if (this.dialog !== dialog || dialog.scope !== this.scope) return
        this.protocolNumbers = protocols.listnetworkprotocolsresponse?.networkprotocol || []
        this.icmpTypes = [{ index: -1, description: this.$t('label.all') }, ...(icmp.listnetworkprotocolsresponse?.networkprotocol || [])]
        this.setIcmpCodes(this.form.icmptype)
      } catch { /* TCP, UDP and existing rule values remain available. */ }
    },
    setIcmpCodes (type) {
      const details = this.icmpTypes.find(row => row.index === type)?.details || {}
      this.icmpCodes = [{ code: -1, description: this.$t('label.all') }, ...Object.entries(details).map(([code, description]) => ({ code: Number(code), description }))]
    },
    updateIcmpCodes (type) {
      this.form.icmpcode = -1
      this.setIcmpCodes(type)
    },
    getDataFromForm (values) {
      const data = {
        cidrlist: values.cidrlist || '',
        number: values.number || '',
        protocol: values.protocol || '',
        traffictype: values.traffictype || '',
        action: values.action || '',
        reason: values.reason || ''
      }

      if (values.protocol === 'tcp' || values.protocol === 'udp' || (values.protocol === 'protocolnumber' && values.protocolnumber !== 1)) {
        data.startport = values.startport || ''
        data.endport = values.endport || ''
      }

      if (values.protocol === 'icmp' || (values.protocol === 'protocolnumber' && values.protocolnumber === 1)) {
        data.icmptype = values.icmptype
        data.icmpcode = values.icmpcode
      }

      if (values.protocol === 'protocolnumber') {
        data.protocol = values.protocolnumber
      }

      return data
    },
    async submitRule () {
      const dialog = this.dialog
      if (!dialog || dialog.scope !== this.scope || this.busy || this.pending || !this.can(dialog.mode)) return
      if (dialog.mode === 'remove') return this.write(dialog.mode, { id: dialog.item.id })
      if (!['add', 'edit'].includes(dialog.mode)) return
      this.busy = true
      try {
        await this.$refs.ruleForm.validate()
        if (this.dialog !== dialog || !this.can(dialog.mode)) return
        const data = this.getDataFromForm(this.form)
        this.busy = false
        return await this.write(dialog.mode, dialog.mode === 'edit'
          ? { ...data, id: dialog.item.id, partialupgrade: false }
          : { ...data, aclid: this.target.row.id })
      } catch (error) {
        if (this.dialog === dialog && error.errorFields?.length && this.$refs.ruleForm) {
          this.$refs.ruleForm.scrollToField(error.errorFields[0].name)
        }
      } finally {
        if (this.dialog === dialog) this.busy = false
      }
    },
    openTags (item) {
      if (!this.openDialog('tags', item)) return
      this.tagForm = { key: '', value: '' }
      this.fetchTags()
    },
    async fetchTags () {
      const dialog = this.dialog
      if (dialog?.mode !== 'tags' || !this.can('readTags')) return
      this.tagsLoading = true
      try {
        const json = await getAPI('listTags', { ...this.target.params, resourceId: dialog.item.id, resourceType: 'NetworkACL', listAll: true }, aclRequestOptions)
        if (this.dialog === dialog && dialog.scope === this.scope) this.tags = aclResponse(json, 'listtagsresponse').tag || []
      } catch (error) {
        if (this.dialog === dialog) this.recordError(error)
      } finally {
        if (this.dialog === dialog) this.tagsLoading = false
      }
    },
    addTag () {
      if (this.dialog?.mode !== 'tags' || !this.tagForm.key.trim() || !this.tagForm.value.trim()) return
      return this.writeTag('addTag', this.tagForm)
    },
    removeTag (event, tag) {
      event.preventDefault()
      if (this.dialog?.mode !== 'tags' || !this.tags.includes(tag)) return
      return this.writeTag('removeTag', tag)
    },
    writeTag (action, tag) {
      if (this.dialog?.mode !== 'tags') return
      return this.write(action, { 'tags[0].key': tag.key, 'tags[0].value': tag.value, resourceIds: this.dialog.item.id, resourceType: 'NetworkACL' })
    },
    recordError (error) {
      this.blocked = aclDenied(error)
      this.dialogError = {
        message: this.blocked ? 'message.acl.access.changed' : this.pending ? 'message.acl.job.pending' : 'message.acl.write.failed',
        detail: networkError(error).text
      }
      if (this.blocked) this.access = null
    },
    async write (action, params, receipt = null) {
      if (this.busy || !this.can(action) || (this.pending && !receipt) ||
        (action === 'move' ? this.dialog : this.dialog?.mode !== (action.endsWith('Tag') ? 'tags' : action))) return
      const scope = this.scope
      const epoch = this.epoch
      const dialog = this.dialog
      const current = () => this.live(scope, epoch) && this.dialog === dialog && this.can(action)
      const tag = action === 'addTag' || action === 'removeTag'
      this.busy = true
      this.dialogError = null
      try {
        const ok = await runAclWrite({
          get: getAPI,
          post: postAPI,
          command: aclCommands[action],
          params: { ...params, ...this.target.params },
          pending: receipt,
          current,
          accepted: jobId => { this.pending = jobId ? { jobId, action } : null }
        })
        if (!ok || !current()) return
        this.$message.success(this.$t(messages[action]))
        if (tag) {
          this.tagForm = { key: '', value: '' }
          await this.fetchTags()
        } else {
          this.closeDialog(true)
          await this.fetchData()
        }
      } catch (error) {
        if (!current()) return
        if (dialog) {
          this.recordError(error)
        } else {
          this.acls = this.lastRules.slice()
          this.access = null
          this.notice = { type: 'warning', message: aclDenied(error) ? 'message.acl.access.changed' : 'message.acl.order.failed', detail: networkError(error).text, retry: true }
        }
      } finally {
        if (this.live(scope, epoch)) this.busy = false
      }
    },
    recheck () {
      if (this.pending) return this.write(this.pending.action, {}, this.pending.jobId)
    },
    changeOrder (event) {
      const scope = this.dragScope
      this.dragScope = null
      const moved = event.moved
      if (!moved || scope !== this.scope || !this.canMove || this.busy) {
        this.acls = this.lastRules.slice()
        return
      }
      return this.moveRule(moved.element.id, this.acls[moved.newIndex - 1]?.id, this.acls[moved.newIndex + 1]?.id)
    },
    moveRule (id, previousaclruleid, nextaclruleid) {
      if (!this.canMove || this.dialog || this.busy || (!previousaclruleid && !nextaclruleid) ||
        ![id, previousaclruleid, nextaclruleid].filter(Boolean).every(key => this.lastRules.some(row => row.id === key))) return
      return this.write('move', { id, previousaclruleid, nextaclruleid })
    },
    exportAclList () {
      if (!this.active || !this.target || !this.acls.length) return
      const keys = [...new Set(this.acls.flatMap(item => Object.keys(item)))]
      const csvValue = value => {
        const text = String(value ?? '')
        return /[,\r\n"]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text
      }
      const csv = [keys.join(','), ...this.acls.map(row => keys.map(key => csvValue(
        key === 'tags' ? (row.tags || []).map(tag => '(' + tag.key + ',' + tag.value + ')').join('') : row[key]
      )).join(','))].join('\n') + '\n'
      const download = document.createElement('a')
      download.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv)
      download.download = 'AclRules-' + this.target.row.name + '-' + this.target.row.id + '.csv'
      download.click()
    },
    refreshAfterImport () {
      if (!this.canImport()) return
      this.closeDialog(true)
      this.fetchData()
    },
    capitalise (value) { return value.toUpperCase() }
  }
}
</script>

<style lang="scss" scoped>
.acl-access-notice { margin: 12px 0; }
.list {
  &__item { display: flex; gap: 12px; padding: 16px 0; border-bottom: 1px solid var(--ui-border); }
  &__container { flex: 1; min-width: 0; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
  &__col { overflow-wrap: anywhere; }
  &__label { font-weight: 600; }
  &__actions { display: flex; flex-wrap: wrap; align-content: flex-start; gap: 8px; }
}
.drag-handle { align-self: flex-start; cursor: grab; padding: 6px; }
.drag-ghost { opacity: 0.6; background: var(--ui-bg-elevated); }
.acl-dialog-context {
  display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 4px 16px;
  padding: 12px; background: var(--ui-bg-elevated); border: 1px solid var(--ui-border);
  border-radius: 8px; color: var(--ui-text-primary);
  dd { margin: 0; overflow-wrap: anywhere; font-weight: 600; }
}
@media (max-width: 991px) {
  .list__item { flex-wrap: wrap; }
  .list__container { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .list__actions { flex-basis: 100%; justify-content: flex-end; }
}
</style>
