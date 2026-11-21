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
  <loading-outlined v-if="loadingTable" class="main-loading-spinner" />
  <section v-else ref="rulesPanel" class="role-rules-panel" :aria-busy="busy">
    <div class="detail-tab-toolbar">
      <a-button
        v-if="canWriteRule('createRolePermission')"
        type="primary"
        :aria-expanded="showRuleForm"
        :disabled="locked"
        @click="showRuleForm = !showRuleForm">
        <template #icon><plus-outlined /></template>
        {{ $t('label.add.rule') }}
      </a-button>
      <a-button :loading="busy" @click="refresh">
        <template #icon><reload-outlined /></template>
        {{ $t('label.refresh') }}
      </a-button>
      <a-button :disabled="locked || !rules.length" @click="exportRolePermissions('all')">
        <template #icon><download-outlined /></template>
        {{ $t('label.role.csv.export.all', { count: rules.length }) }}
      </a-button>
      <a-button v-if="searchQuery" :disabled="locked || !visibleRules.length" @click="exportRolePermissions('search')">
        <template #icon><download-outlined /></template>
        {{ $t('label.role.csv.export.search', { count: visibleRules.length }) }}
      </a-button>
      <a-input-search
        v-model:value="searchRule"
        class="detail-tab-search"
        :placeholder="$t('label.rolepermissiontab.searchbar')"
        :aria-label="$t('label.rolepermissiontab.searchbar')"
        allow-clear />
    </div>

    <a-alert v-if="loadError" class="detail-tab-notice" type="error" show-icon :message="$t('message.role.rules.load.failed')" :description="loadError" />
    <a-alert v-if="!hasWriteActions" class="detail-tab-notice" type="info" show-icon :message="$t('message.role.rules.readonly')" />
    <a-alert v-if="actionError" class="detail-tab-notice" type="error" show-icon :message="actionError" />
    <a-alert
      v-if="searchQuery && canWriteRule('updateRolePermission')"
      class="detail-tab-notice"
      type="info"
      show-icon
      :message="$t('message.role.rules.reorder.search')" />

    <a-form v-if="showRuleForm && canWriteRule('createRolePermission')" class="role-rule-form" layout="vertical" @keydown.ctrl.enter.prevent="!$event.repeat && onRuleSave()">
      <div class="role-rule-fields">
        <a-form-item :label="$t('label.rule')" html-for="role-rule-name" required :validate-status="newRuleSelectError ? 'error' : ''" :help="newRuleSelectError ? $t('message.error.required.input') : undefined">
          <a-auto-complete
            id="role-rule-name"
            v-model:value="newRule"
            v-focus="true"
            :filter-option="filterOption"
            :options="apiOptions"
            :disabled="busy"
            style="width: 100%"
            @change="newRuleSelectError = false" />
        </a-form-item>
        <a-form-item :label="$t('label.permission')" html-for="role-rule-permission">
          <a-select id="role-rule-permission" v-model:value="newRulePermission" :options="permissionOptions" :disabled="busy" />
        </a-form-item>
        <a-form-item :label="$t('label.description')" html-for="role-rule-description">
          <a-textarea id="role-rule-description" v-model:value="newRuleDescription" :disabled="busy" :auto-size="{ minRows: 1, maxRows: 4 }" />
        </a-form-item>
      </div>
      <a-button type="primary" :disabled="locked" @click="onRuleSave">{{ $t('label.save.new.rule') }}</a-button>
    </a-form>

    <a-spin :spinning="busy">
      <div class="role-rule-list">
        <div v-if="visibleRules.length" class="role-rule-row role-rule-heading" aria-hidden="true">
          <span>{{ $t('label.rule') }}</span>
          <span>{{ $t('label.permission') }}</span>
          <span>{{ $t('label.description') }}</span>
          <span>{{ $t('label.actions') }}</span>
        </div>
        <p v-if="ready && !visibleRules.length" class="rules-empty" role="status">{{ $t('label.no.data') }}</p>
        <draggable
          :model-value="visibleRules"
          @update:model-value="changeOrder"
          :disabled="!canReorder"
          handle=".drag-handle"
          animation="200"
          ghost-class="drag-ghost"
          item-key="id"
          role="list"
          :aria-label="$t('label.rules')">
          <template #item="{ element, index }">
            <div class="role-rule-row" role="listitem" :data-rule-id="element.id">
              <div class="role-rule-name" :title="element.rule">
                <span class="role-rule-position" :aria-label="$t('label.role.rule.order')">{{ rulePositions.get(element.id) }}</span>
                <strong>{{ element.rule }}</strong>
              </div>
              <div class="role-rule-permission">
                <a-select
                  v-if="canWriteRule('updateRolePermission')"
                  :value="element.permission"
                  :options="permissionOptions"
                  :aria-label="$t('label.permission') + ' · ' + element.rule"
                  :disabled="locked"
                  @change="onPermissionChange(element, $event)" />
                <a-tag v-else>{{ $t('label.' + element.permission) }}</a-tag>
              </div>
              <div class="role-rule-description">
                {{ element.description || $t('message.no.description') }}
              </div>
              <div class="role-rule-actions" v-if="(!searchQuery && canWriteRule('updateRolePermission')) || canWriteRule('deleteRolePermission')">
                <span v-if="!searchQuery && canWriteRule('updateRolePermission')" class="rule-order-controls">
                  <drag-outlined class="drag-handle" aria-hidden="true" />
                  <a-button
                    v-for="direction in [-1, 1]"
                    :key="direction"
                    type="text"
                    size="small"
                    :data-rule-direction="direction"
                    :title="$t(direction === -1 ? 'label.move.up.row' : 'label.move.down.row')"
                    :aria-label="$t(direction === -1 ? 'label.move.up.row' : 'label.move.down.row') + ' · ' + element.rule"
                    :disabled="!canReorder || index + direction < 0 || index + direction >= rules.length"
                    @click="moveRule(index, direction, $event)">
                    <template #icon>
                      <arrow-up-outlined v-if="direction === -1" />
                      <arrow-down-outlined v-else />
                    </template>
                  </a-button>
                </span>
                <rule-delete v-if="canWriteRule('deleteRolePermission')" :disabled="locked" :record="element" @delete="onRuleDelete(element.id)" />
              </div>
            </div>
          </template>
        </draggable>
      </div>
    </a-spin>
    <p class="rules-feedback" role="status">{{ announcement }}</p>
  </section>
</template>

<script>
import { getAPI, postAPI } from '@/api'
import draggable from 'vuedraggable'
import RuleDelete from './RuleDelete'
import { formatRoleCsv } from '@/utils/roleCsv'
import { canRoleAction, roleRuleActions } from '@/utils/roleActions'

const requestOptions = { preserveOnFailure: true, timeout: 15000 }

export default {
  name: 'RolePermissionTab',
  components: {
    RuleDelete,
    draggable
  },
  props: {
    resource: {
      type: Object,
      required: true
    }
  },
  data () {
    return {
      loadingTable: true,
      busy: false,
      ready: false,
      loadError: '',
      actionError: '',
      announcement: '',
      scopeVersion: 0,
      rules: [],
      showRuleForm: false,
      newRule: '',
      newRulePermission: 'allow',
      newRuleDescription: '',
      newRuleSelectError: false,
      searchRule: ''
    }
  },
  computed: {
    apis () { return this.$store.getters.apis },
    locked () { return this.busy || !this.ready },
    searchQuery () { return this.searchRule.trim().toLowerCase() },
    visibleRules () {
      return this.searchQuery
        ? this.rules.filter(rule => rule.rule.toLowerCase().includes(this.searchQuery))
        : this.rules
    },
    hasWriteActions () { return roleRuleActions.some(this.canWriteRule) },
    canReorder () { return !this.searchQuery && !this.locked && this.canWriteRule('updateRolePermission') },
    apiOptions () {
      const existing = new Set(this.rules.map(rule => rule.rule))
      return Object.keys(this.apis)
        .filter(api => !existing.has(api))
        .sort((a, b) => a.localeCompare(b))
        .map(value => ({ value }))
    },
    rulePositions () { return new Map(this.rules.map((rule, index) => [rule.id, index + 1])) },
    permissionOptions () {
      return ['allow', 'deny'].map(value => ({ value, label: this.$t('label.' + value) }))
    }
  },
  watch: {
    resource: {
      immediate: true,
      handler (resource, previous) {
        if (resource.id !== previous?.id) {
          this.scopeVersion++
          this.busy = false
          this.ready = false
          this.loadingTable = true
          this.rules = []
          this.searchRule = ''
          this.showRuleForm = false
          this.loadError = ''
          this.actionError = ''
          this.announcement = ''
          this.resetNewFields()
        }
        this.refresh()
      }
    }
  },
  beforeUnmount () {
    this.scopeVersion++
  },
  methods: {
    canWriteRule (command) { return canRoleAction(command, this.resource, this.apis) },
    filterOption (input, option) {
      return option.value.toLowerCase().includes(input.toLowerCase())
    },
    resetNewFields () {
      this.newRule = ''
      this.newRulePermission = 'allow'
      this.newRuleDescription = ''
      this.newRuleSelectError = false
    },
    errorText (error) {
      return Object.values(error?.response?.data || {}).find(value => value?.errortext)?.errortext ||
        this.$t('message.request.failed')
    },
    async refresh () {
      if (this.busy || !this.resource.id) return
      const version = this.scopeVersion
      this.busy = true
      await this.fetchRules(version)
      if (version === this.scopeVersion) this.busy = false
    },
    async fetchRules (version) {
      this.ready = false
      try {
        const response = await getAPI('listRolePermissions', { roleid: this.resource.id }, requestOptions)
        if (version !== this.scopeVersion) return
        this.rules = response.listrolepermissionsresponse?.rolepermission || []
        this.ready = true
        this.loadError = ''
      } catch (error) {
        if (version === this.scopeVersion) this.loadError = this.errorText(error)
      } finally {
        if (version === this.scopeVersion) this.loadingTable = false
      }
    },
    async mutate (command, params, onSuccess) {
      if (this.locked || !this.canWriteRule(command)) return
      const version = this.scopeVersion
      this.busy = true
      this.actionError = ''
      this.announcement = ''
      let succeeded = false
      try {
        const response = await postAPI(command, params, requestOptions)
        if (response?.[command.toLowerCase() + 'response']?.success === false) throw new Error()
        if (version === this.scopeVersion) {
          if (onSuccess) onSuccess()
          succeeded = true
        }
      } catch (error) {
        if (version === this.scopeVersion) this.actionError = this.errorText(error)
      } finally {
        if (version === this.scopeVersion) {
          await this.fetchRules(version)
          if (version === this.scopeVersion) this.busy = false
        }
      }
      return succeeded && this.ready && version === this.scopeVersion
    },
    changeOrder (orderedRules) {
      if (!this.canReorder || orderedRules.length !== this.rules.length) return
      return this.mutate('updateRolePermission', {
        roleid: this.resource.id,
        ruleorder: orderedRules.map(rule => rule.id)
      })
    },
    async moveRule (index, direction, event) {
      const next = index + direction
      if (!this.canReorder || next < 0 || next >= this.rules.length) return
      const orderedRules = [...this.rules]
      const [rule] = orderedRules.splice(index, 1)
      orderedRules.splice(next, 0, rule)
      const trigger = event?.currentTarget
      const version = this.scopeVersion
      const saved = await this.changeOrder(orderedRules)
      if (version !== this.scopeVersion) return
      const position = this.rules.findIndex(row => row.id === rule.id)
      if (saved && position >= 0) this.announcement = this.$t('message.project.rule.moved', { rule: rule.rule, position: position + 1 })
      await this.$nextTick()
      if (!trigger || ![trigger, document.body].includes(document.activeElement)) return
      const controls = Array.from(this.$refs.rulesPanel?.querySelectorAll('[data-rule-id]') || [])
        .find(element => element.dataset.ruleId === rule.id)
      const replacement = controls?.querySelector('[data-rule-direction="' + direction + '"]:not(:disabled)') ||
        controls?.querySelector('[data-rule-direction]:not(:disabled)')
      if (replacement) replacement.focus({ preventScroll: true })
    },
    onRuleDelete (id) {
      return this.mutate('deleteRolePermission', { id })
    },
    onPermissionChange (record, permission) {
      return this.mutate('updateRolePermission', {
        roleid: this.resource.id,
        ruleid: record.id,
        permission
      })
    },
    onRuleSave () {
      const rule = this.newRule.trim()
      if (!rule) {
        this.newRuleSelectError = true
        return
      }
      return this.mutate('createRolePermission', {
        roleid: this.resource.id,
        rule,
        permission: this.newRulePermission,
        description: this.newRuleDescription
      }, this.resetNewFields)
    },
    exportRolePermissions (range) {
      const rows = range === 'search' ? this.visibleRules : this.rules
      if (this.locked || !rows.length) return
      const url = URL.createObjectURL(new Blob([formatRoleCsv(rows)], { type: 'text/csv;charset=utf-8' }))
      try {
        const download = document.createElement('a')
        download.href = url
        const suffix = range === 'search' ? '-search' : ''
        download.download = this.resource.name + '_' + this.resource.type + suffix + '.csv'
        download.click()
      } finally {
        setTimeout(() => URL.revokeObjectURL(url), 1000)
      }
    }
  }
}
</script>

<style scoped lang="scss">
@import '@/style/components/view/DetailTab.scss';

.role-rules-panel { min-width: 0; container-type: inline-size; }
.main-loading-spinner { display: flex; justify-content: center; font-size: 30px; }
.role-rule-form {
  margin-bottom: 16px;
  padding: 12px;
  border: 1px solid var(--ui-border);
  border-radius: 6px;
  background: var(--ui-bg-surface);
}
.role-rule-fields { display: grid; gap: 0 12px; }
.role-rule-form :deep(.ant-form-item) { margin-bottom: 12px; min-width: 0; }
.role-rule-list { border: 1px solid var(--ui-border); border-radius: 6px; }
.role-rule-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: start;
  gap: 8px 12px;
  padding: 12px;
  border-bottom: 1px solid var(--ui-border);
}
.role-rule-row:last-child { border-bottom: 0; }
.role-rule-heading { display: none; font-weight: 600; background: var(--ui-bg-surface); }
.role-rule-name { display: flex; align-items: baseline; gap: 8px; overflow-wrap: anywhere; }
.role-rule-name strong { min-width: 0; }
.role-rule-position { color: var(--ui-text-secondary); font-variant-numeric: tabular-nums; }
.role-rule-permission :deep(.ant-select) { min-width: 74px; }
.role-rule-description { grid-column: 1 / -1; overflow-wrap: anywhere; white-space: pre-wrap; color: var(--ui-text-secondary); }
.role-rule-actions { grid-column: 1 / -1; justify-self: end; }
.role-rule-actions, .rule-order-controls { display: flex; align-items: center; flex-wrap: wrap; gap: 4px; }
.drag-handle { cursor: grab; padding: 4px; }
.drag-ghost { opacity: .65; background: var(--ui-bg-surface); }
.rules-empty { padding: 24px 12px; margin: 0; text-align: center; color: var(--ui-text-secondary); }
.rules-feedback { margin: 8px 0 0; }
.rules-feedback:empty { display: none; }

@container (min-width: 530px) {
  .role-rule-fields { grid-template-columns: minmax(0, 4fr) minmax(90px, 1fr) minmax(0, 4fr); }
  .role-rule-row { grid-template-columns: minmax(0, 4fr) minmax(90px, 1fr) minmax(0, 4fr) 130px; align-items: center; }
  .role-rule-heading { display: grid; border-bottom: 1px solid var(--ui-border); }
  .role-rule-description, .role-rule-actions { grid-column: auto; }
}
</style>
