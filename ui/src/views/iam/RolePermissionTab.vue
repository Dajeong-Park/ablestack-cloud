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
  <div v-else ref="rulesPanel" :aria-busy="busy">
    <div style="width: 100%; display: flex; margin-bottom: 20px">
      <a-button type="dashed" @click="exportRolePermissions" style="width: 100%">
        <template #icon><download-outlined /></template>
        {{ $t('label.export.rules') }}
      </a-button>
    </div>
    <a-input-search
      v-model:value="searchRule"
      :placeholder="$t('label.rolepermissiontab.searchbar')"
      :aria-label="$t('label.rolepermissiontab.searchbar')"
      allow-clear
      style="width: 100%; margin-bottom: 10px"
    />
    <a-alert
      v-if="loadError"
      class="rules-notice"
      type="error"
      show-icon
      :message="$t('message.role.rules.load.failed')"
      :description="loadError">
      <template #action>
        <a-button size="small" :loading="busy" @click="refresh">{{ $t('label.retry') }}</a-button>
      </template>
    </a-alert>
    <a-alert v-if="actionError" class="rules-notice" type="error" show-icon :message="actionError" />
    <a-alert
      v-if="searchQuery && apis.updateRolePermission"
      class="rules-notice"
      type="info"
      show-icon
      :message="$t('message.role.rules.reorder.search')" />
    <a-spin :spinning="busy">
      <div class="rules-list ant-list ant-list-bordered">
        <div class="rules-table-item ant-list-item">
          <div class="rules-table__col rules-table__col--grab rules-table__col--grab-empty"></div>
          <div class="rules-table__col rules-table__col--rule rules-table__col--new">
            <a-auto-complete
              v-focus="true"
              v-model:value="newRule"
              :filter-option="filterOption"
              :options="apiOptions"
              :placeholder="$t('label.rule')"
              :aria-label="$t('label.rule')"
              :disabled="busy"
              :class="{ 'rule-dropdown-error': newRuleSelectError }"
              @change="newRuleSelectError = false" />
          </div>
          <div class="rules-table__col rules-table__col--permission">
            <a-select
              v-model:value="newRulePermission"
              :options="permissionOptions"
              :aria-label="$t('label.permission')"
              :disabled="busy"
              show-search
              option-filter-prop="label" />
          </div>
          <div class="rules-table__col rules-table__col--description">
            <a-input v-model:value="newRuleDescription" :placeholder="$t('label.description')" :disabled="busy" />
          </div>
          <div class="rules-table__col rules-table__col--actions">
            <tooltip-button
              tooltipPlacement="bottom"
              :tooltip="$t('label.save.new.rule')"
              :disabled="locked || !apis.createRolePermission"
              icon="plus-outlined"
              type="primary"
              @onClick="onRuleSave" />
          </div>
        </div>
        <p v-if="ready && !visibleRules.length" class="rules-empty" role="status">{{ $t('label.no.data') }}</p>
        <draggable
          :model-value="visibleRules"
          @update:model-value="changeOrder"
          :disabled="!canReorder"
          handle=".drag-handle"
          animation="200"
          ghostClass="drag-ghost"
          :component-data="{ type: 'transition' }"
          item-key="id">
          <template #item="{ element, index }">
            <div class="rules-table-item ant-list-item">
              <div
                class="rules-table__col rules-table__col--grab"
                :class="{ 'rules-table__col--grab-empty': searchQuery || !apis.updateRolePermission }"
                :data-rule-id="element.id">
                <span v-if="!searchQuery && apis.updateRolePermission" class="rule-order-controls">
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
              </div>
              <div class="rules-table__col rules-table__col--rule">
                {{ element.rule }}
              </div>
              <div class="rules-table__col rules-table__col--permission">
                <a-select
                  :value="element.permission"
                  :options="permissionOptions"
                  :aria-label="$t('label.permission') + ' · ' + element.rule"
                  :disabled="locked || !apis.updateRolePermission"
                  show-search
                  option-filter-prop="label"
                  @change="onPermissionChange(element, $event)" />
              </div>
              <div class="rules-table__col rules-table__col--description">
                <div v-if="element.description">
                  {{ element.description }}
                </div>
                <div v-else class="no-description">
                  {{ $t('message.no.description') }}
                </div>
              </div>
              <div class="rules-table__col rules-table__col--actions">
                <rule-delete
                  :disabled="locked || !apis.deleteRolePermission"
                  :record="element"
                  @delete="onRuleDelete(element.id)" />
              </div>
            </div>
          </template>
        </draggable>
      </div>
    </a-spin>
    <p class="rules-feedback" role="status">{{ announcement }}</p>
  </div>
</template>

<script>
import { getAPI, postAPI } from '@/api'
import draggable from 'vuedraggable'
import RuleDelete from './RuleDelete'
import TooltipButton from '@/components/widgets/TooltipButton'
import { toCsv } from '@/utils/util.js'

const requestOptions = { preserveOnFailure: true, timeout: 15000 }

export default {
  name: 'RolePermissionTab',
  components: {
    RuleDelete,
    draggable,
    TooltipButton
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
    canReorder () { return !this.searchQuery && !this.locked && !!this.apis.updateRolePermission },
    apiOptions () {
      const existing = new Set(this.rules.map(rule => rule.rule))
      return Object.keys(this.apis)
        .filter(api => !existing.has(api))
        .sort((a, b) => a.localeCompare(b))
        .map(value => ({ value }))
    },
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
      if (this.locked || !this.apis[command]) return
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
    exportRolePermissions () {
      const rulesCsvData = toCsv({ keys: ['rule', 'permission', 'description'], data: this.visibleRules })
      const hiddenElement = document.createElement('a')
      hiddenElement.href = 'data:text/csv;charset=utf-8,' + encodeURI(rulesCsvData)
      hiddenElement.target = '_blank'
      hiddenElement.download = this.resource.name + '_' + this.resource.type + '.csv'
      hiddenElement.click()
      hiddenElement.remove()
    }
  }
}
</script>

<style lang="scss" scoped>
  .main-loading-spinner {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 30px;
  }
  .rules-notice {
    margin-bottom: 10px;
  }

  .rules-empty {
    padding: 24px 12px;
    margin: 0;
    text-align: center;
    color: var(--ui-text-secondary);
  }

  .rules-feedback {
    margin: 8px 0 0;

    &:empty {
      display: none;
    }
  }

  .rules-list {
    max-height: 600px;
    overflow: auto;
  }

  .rules-table {

    &-item {
      position: relative;
      display: flex;
      align-items: stretch;
      padding: 0;
      flex-wrap: wrap;

      @media (min-width: 760px) {
        flex-wrap: nowrap;
        padding-right: 25px;
      }

    }

    &__col {
      display: flex;
      align-items: center;
      padding: 15px;

      @media (min-width: 760px) {
        padding: 15px 0;

        &:not(:first-child) {
          padding-left: 20px;
        }

        &:not(:last-child) {
          border-right: 1px solid #e8e8e8;
          padding-right: 20px;
        }
      }

      &--grab {
        width: 100%;
        padding-block: 4px;

        @media (max-width: 759px) {
          &-empty {
            display: none;
          }
        }

        @media (min-width: 760px) {
          width: 35px;
          padding-left: 25px;
          justify-content: center;
        }

      }

      &--rule,
      &--description {
        word-break: break-all;
        flex: 1;
        width: 100%;

        @media (min-width: 760px) {
          width: auto;
        }

      }

      &--rule {
        background-color: rgba(#e6f7ff, 0.7);

        @media (min-width: 760px) {
          padding-left: 0;
          background: none;
        }

      }

      &--permission {
        justify-content: center;
        width: 100%;

        .ant-select {
          width: 100%;
        }

        @media (min-width: 760px) {
          width: auto;

          .ant-select {
            width: auto;
          }

        }

      }

      &--actions {
        max-width: 60px;
        width: 100%;
        padding-right: 0;

        @media (min-width: 760px) {
          width: auto;
          max-width: 70px;
          padding-right: 15px;
        }

      }

      &--new {
        padding-left: 15px;
        background-color: transparent;

        div {
          width: 100%;
        }

      }

    }

  }

  .no-description {
    opacity: 0.4;
    font-size: 0.7rem;

    @media (min-width: 760px) {
      display: none;
    }

  }

  .rule-order-controls {
    display: flex;
    align-items: center;
    gap: 4px;

    @media (min-width: 760px) {
      flex-direction: column;
    }
  }

  .drag-handle {
    cursor: grab;
  }

  .drag-ghost {
    opacity: 0.5;
    background: #f0f2f5;
  }

</style>

<style lang="scss">
  .rules-table__col--new {
    .ant-select {
      width: 100%;
    }
  }
  .rule-dropdown-error {
    .ant-input {
      border-color: #ff0000
    }
  }
</style>
