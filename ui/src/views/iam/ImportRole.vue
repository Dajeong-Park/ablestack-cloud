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
  <div class="form-layout" v-ctrl-enter="handleSubmit">
    <a-spin :spinning="locked">
      <a-form ref="formRef" :model="form" :rules="formRules" layout="vertical" @finish="handleSubmit">
        <a-form-item required>
          <template #label>
            <tooltip-label :title="$t('label.rules.file')" :tooltip="$t('label.rules.file.to.import')" />
          </template>
          <a-upload-dragger
            accept=".csv"
            :multiple="false"
            :file-list="fileList"
            :disabled="loading"
            :before-upload="beforeUpload"
            @remove="removeFile">
            <p class="ant-upload-drag-icon"><cloud-upload-outlined /></p>
            <p class="ant-upload-text" v-if="!fileList.length">{{ $t('label.rules.file.import.description') }}</p>
          </a-upload-dragger>
          <a-alert v-if="csvErrors.length" class="import-notice" type="error" show-icon :message="$t('label.error.rules.file.import')">
            <template #description>
              <ul class="import-errors">
                <li v-for="error in csvErrors" :key="error.line">
                  {{ error.line ? $t('message.role.csv.line', { line: error.line, detail: $t(error.message) }) : $t(error.message) }}
                </li>
              </ul>
            </template>
          </a-alert>
          <p v-else-if="csvRules.length" role="status">{{ $t('message.role.csv.ready', { count: csvRules.length }) }}</p>
        </a-form-item>

        <a-form-item name="name">
          <template #label>
            <tooltip-label :title="$t('label.name')" :tooltip="apiParams.name.description" />
          </template>
          <a-input v-model:value="form.name" :placeholder="apiParams.name.description" :disabled="loading" v-focus="true" />
        </a-form-item>

        <a-form-item name="description">
          <template #label>
            <tooltip-label :title="$t('label.description')" :tooltip="apiParams.description.description" />
          </template>
          <a-input v-model:value="form.description" :placeholder="apiParams.description.description" :disabled="loading" />
        </a-form-item>

        <a-form-item name="type">
          <template #label>
            <tooltip-label :title="$t('label.type')" :tooltip="apiParams.type.description" />
          </template>
          <a-select v-model:value="form.type" :placeholder="apiParams.type.description" show-search :disabled="loading">
            <a-select-option v-for="role in roleTypes" :key="role">
              {{ role }}
            </a-select-option>
          </a-select>
        </a-form-item>

        <a-form-item name="ispublic">
          <template #label>
            <tooltip-label :title="$t('label.ispublic')" :tooltip="apiParams.ispublic.description" />
          </template>
          <a-switch v-model:checked="form.ispublic" :aria-label="$t('label.ispublic')" :disabled="loading" />
        </a-form-item>

        <a-form-item v-if="canReviewForce" name="forced">
          <template #label>
            <tooltip-label :title="$t('label.role.csv.force')" :tooltip="apiParams.forced.description" />
          </template>
          <a-switch v-model:checked="form.forced" :aria-label="$t('label.role.csv.force')" :disabled="loading" />
        </a-form-item>

        <a-alert v-if="error" class="import-notice" type="error" show-icon :message="error" />
        <a-alert v-if="preview" class="import-notice" type="warning" show-icon :message="$t('label.role.csv.review')">
          <template #description>
            {{ preview.role
              ? $t('message.role.csv.replace', { name: preview.role.name, type: preview.role.type, old: preview.rules.length, count: csvRules.length })
              : $t('message.role.csv.new', { name: form.name.trim(), type: form.type, count: csvRules.length }) }}
            <p v-if="preview.role" class="import-impact">
              {{ $t(preview.role.inuse === true ? 'message.role.usage.linked' : preview.role.inuse === false ? 'message.role.usage.unlinked' : 'message.role.usage.unknown') }}
            </p>
          </template>
        </a-alert>

        <mold-dialog-actions :busy="loading" @keydown.ctrl.enter.prevent.stop="!$event.repeat && handleSubmit($event)">
          <a-button :disabled="loading" @click="closeAction">{{ $t('label.cancel') }}</a-button>
          <a-button
            v-if="preview"
            :danger="!!preview.role"
            :disabled="!canImport"
            :loading="loading"
            type="primary"
            @click="confirmForce">
            {{ $t(preview.role ? 'label.role.csv.replace' : 'label.import.role') }}
          </a-button>
          <a-button v-else :disabled="!canImport" :loading="loading" type="primary" @click="handleSubmit">
            {{ $t(form.forced ? 'label.role.csv.review' : 'label.import.role') }}
          </a-button>
        </mold-dialog-actions>
      </a-form>
    </a-spin>
  </div>
</template>

<script>
import { getAPI, postAPI } from '@/api'
import MoldDialogActions from '@/components/view/MoldDialogActions'
import TooltipLabel from '@/components/widgets/TooltipLabel'
import { parseRoleCsv } from '@/utils/roleCsv'
import { roleTypes } from '@/utils/roleSearch'
import { canRoleAction, roleUsageParams } from '@/utils/roleActions'

const requestOptions = { preserveOnFailure: true, timeout: 15000 }

export default {
  name: 'ImportRole',
  components: { TooltipLabel, MoldDialogActions },
  emits: ['close-action', 'refresh-data'],
  data () {
    return {
      roleTypes,
      form: { name: '', description: undefined, type: undefined, ispublic: true, forced: false },
      fileList: [],
      csvRules: [],
      csvErrors: [],
      fileRead: 0,
      reading: false,
      loading: false,
      error: '',
      preview: null,
      active: true
    }
  },
  computed: {
    locked () { return this.loading || this.reading },
    apis () { return this.$store.getters.apis },
    canWrite () { return canRoleAction('importRole', null, this.apis) },
    canReviewForce () { return this.canWrite && !!this.apis.listRoles && !!this.apis.listRolePermissions },
    canImport () {
      return this.canWrite && (!this.form.forced || this.canReviewForce) &&
        !this.locked && !!this.csvRules.length && !this.csvErrors.length
    },
    formRules () {
      return {
        name: [{ required: true, whitespace: true, message: this.$t('message.error.required.input') }],
        type: [{ required: true, message: this.$t('message.error.select') }]
      }
    }
  },
  watch: {
    form: {
      deep: true,
      handler () {
        this.preview = null
        this.error = ''
      }
    }
  },
  beforeCreate () {
    this.apiParams = this.$getApiParams('importRole')
  },
  beforeUnmount () {
    this.active = false
  },
  methods: {
    beforeUpload (file) {
      if (!this.loading) this.readFile(file)
      return false
    },
    async readFile (file) {
      const sequence = ++this.fileRead
      this.fileList = [file]
      this.csvRules = []
      this.csvErrors = []
      this.preview = null
      this.error = ''
      if (!/\.csv$/i.test(file.name)) {
        this.reading = false
        this.csvErrors = [{ message: 'label.error.rules.file.import' }]
        return
      }
      this.reading = true
      try {
        const parsed = parseRoleCsv(await file.text())
        if (this.active && sequence === this.fileRead) {
          this.csvRules = parsed.rules
          this.csvErrors = parsed.errors
        }
      } catch {
        if (this.active && sequence === this.fileRead) this.csvErrors = [{ message: 'label.error.file.read' }]
      } finally {
        if (this.active && sequence === this.fileRead) this.reading = false
      }
    },
    removeFile () {
      if (this.loading) return false
      this.fileRead++
      this.fileList = []
      this.csvRules = []
      this.csvErrors = []
      this.reading = false
      this.preview = null
      this.error = ''
      return true
    },
    closeAction () {
      if (!this.loading) this.$emit('close-action')
    },
    errorText (error) {
      return Object.values(error?.response?.data || {}).find(value => value?.errortext)?.errortext ||
        error?.message || this.$t('message.request.failed')
    },
    async handleSubmit (event) {
      if (event?.preventDefault) event.preventDefault()
      if (!this.canImport || this.preview) return
      this.loading = true
      this.error = ''
      try {
        await this.$refs.formRef.validate()
        const params = this.importParams()
        if (!this.active || !this.canWrite || (params.forced && !this.canReviewForce)) return
        if (params.forced) {
          this.preview = await this.resolveTarget(params)
        } else {
          await this.submitImport(params)
        }
      } catch (error) {
        if (this.active && !error?.errorFields) this.error = this.errorText(error)
      } finally {
        if (this.active) this.loading = false
      }
    },
    importParams () {
      const params = { ...this.form, name: this.form.name.trim() }
      this.csvRules.forEach((row, index) => {
        for (const [key, value] of Object.entries(row)) params['rules[' + index + '].' + key] = value
      })
      return params
    },
    async resolveTarget (params) {
      const result = await getAPI('listRoles', { name: params.name, ...roleUsageParams(this.apis) }, requestOptions)
      const list = result.listrolesresponse
      const roles = list?.role || []
      const matches = roles.filter(role => role.type === params.type)
      if (!list || list.count > roles.length || matches.length > 1 ||
          (matches.length && matches[0].name.toLowerCase() !== params.name.toLowerCase())) {
        throw new Error(this.$t('message.role.csv.ambiguous'))
      }
      const [role = null] = matches
      if (role?.isdefault) throw new Error(this.$t('message.role.csv.default'))
      if (!role) return { role, rules: [] }
      const query = await getAPI('listRolePermissions', { roleid: role.id }, requestOptions)
      if (!query.listrolepermissionsresponse) throw new Error(this.$t('message.request.failed'))
      return { role, rules: query.listrolepermissionsresponse.rolepermission || [] }
    },
    async confirmForce () {
      if (!this.canImport || !this.preview || !this.form.forced) return
      const preview = this.preview
      const params = this.importParams()
      this.loading = true
      this.error = ''
      try {
        const current = await this.resolveTarget(params)
        if (!this.active || !this.canReviewForce || this.preview !== preview) return
        if (JSON.stringify(current) !== JSON.stringify(preview)) {
          this.preview = current
          this.error = this.$t('message.role.csv.changed')
          return
        }
        await this.submitImport(params, current.role)
      } catch (error) {
        if (this.active) this.error = this.errorText(error)
      } finally {
        if (this.active) this.loading = false
      }
    },
    async submitImport (params, expectedRole) {
      if (!this.active || !this.canWrite || (params.forced && !this.canReviewForce)) return
      const response = await postAPI('importRole', params, requestOptions)
      if (!this.active) return
      const imported = response.importroleresponse?.role
      if (!imported?.id) throw new Error(this.$t('message.request.failed'))
      this.$emit('refresh-data')
      if (expectedRole && imported.id !== expectedRole.id) {
        this.preview = null
        throw new Error(this.$t('message.role.csv.target.changed'))
      }
      this.$notification.success({ message: this.$t('label.import.role'), description: this.$t('message.role.csv.imported', { name: imported.name || params.name }) })
      this.$emit('close-action')
    }
  }
}
</script>

<style scoped lang="less">
  .form-layout { min-width: 0; }

  .import-notice {
    margin-block: 8px;
  }

  .import-impact { margin: 8px 0 0; }

  .import-errors {
    max-height: 10em;
    overflow: auto;
    padding-inline-start: 20px;
    margin: 0;
  }
</style>
