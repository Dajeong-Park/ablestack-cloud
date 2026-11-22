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
    size="md"
    focus-guard
    :title="$t('label.acl.import')"
    :closable="!loading"
    :keyboard="!loading"
    @cancel="closeAction">
    <dl class="acl-import-context">
      <dt>{{ $t('label.add.acl.name') }}</dt><dd>{{ resource.name }}</dd>
      <dt>{{ $t('label.acl.id') }}</dt><dd>{{ resource.id }}</dd>
    </dl>
    <a-form layout="vertical" @finish="handleSubmit" v-ctrl-enter="handleSubmit">
      <a-form-item>
        <template #label><tooltip-label :title="$t('label.rules.file')" :tooltip="$t('label.rules.file.to.import')" /></template>
        <a-upload-dragger
          accept=".csv,text/csv"
          :multiple="false"
          :disabled="locked || !canWrite()"
          :file-list="fileList"
          :before-upload="beforeUpload"
          @remove="handleRemove">
          <p class="ant-upload-drag-icon"><cloud-upload-outlined /></p>
          <p class="ant-upload-text">{{ $t('label.rules.file.import.description') }}</p>
        </a-upload-dragger>
      </a-form-item>
      <a-alert
        v-if="report"
        class="csv-report"
        show-icon
        :type="reportType"
        :message="$t(reportMessage, report)"
        :description="report.saved && !report.applied ? $t('message.acl.csv.apply.failed') : undefined" />
      <a-form-item v-if="csvData.length" :label="$t('label.csv.preview')">
        <div class="csv-preview">
          <a-table
            :columns="columns"
            :data-source="csvData"
            :row-key="record => record.line"
            :pagination="{ pageSize: 5 }"
            :scroll="{ x: 1040 }"
            size="small">
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'validation'">
                <span>{{ rowMessage(record) }}</span>
                <a-button
                  v-if="rowMessage(record)"
                  size="small"
                  type="link"
                  :disabled="locked"
                  :aria-label="$t('label.acl.csv.edit.line', { line: record.line })"
                  @click="editor = { ...record }">
                  {{ $t('label.edit') }}
                </a-button>
              </template>
            </template>
          </a-table>
        </div>
      </a-form-item>
      <section v-if="editor" class="csv-editor" aria-labelledby="acl-csv-edit-title">
        <h3 id="acl-csv-edit-title">{{ $t('label.acl.csv.edit.line', { line: editor.line }) }}</h3>
        <a-form-item v-for="(label, field) in fields" :key="field" :label="$t(label)">
          <a-textarea
            v-if="field === 'reason'"
            v-model:value="editor[field]"
            :aria-label="$t(label)"
            :disabled="locked"
            :auto-size="{ minRows: 2 }" />
          <a-input v-else v-model:value="editor[field]" :aria-label="$t(label)" :disabled="locked" />
        </a-form-item>
        <a-space>
          <a-button @click="editor = null">{{ $t('label.cancel') }}</a-button>
          <a-button type="primary" :disabled="locked" @click="saveEdit">{{ $t('label.apply') }}</a-button>
        </a-space>
      </section>
      <p>{{ $t('message.acl.csv.fields') }}</p>
    </a-form>
    <a-alert v-if="error" show-icon type="error" :message="$t(error.message, error)" :description="error.detail" />
    <template #footer>
      <a-button :disabled="loading" @click="closeAction">{{ $t('label.close') }}</a-button>
      <a-button v-if="blocked" type="primary" @click="$emit('refresh-access')">{{ $t('label.refresh') }}</a-button>
      <a-button
        v-else-if="pending || csvData.length || !report"
        type="primary"
        :loading="loading || reading"
        :disabled="!canWrite() || uncertain || !!editor || (!pending && !validRows.length)"
        @click="handleSubmit">
        {{ $t(pending ? 'label.vmvolume.check' : report ? 'label.acl.csv.retry.failed' : 'label.import') }}
      </a-button>
    </template>
  </MoldDialog>
</template>

<script>
import { getAPI, postAPI } from '@/api'
import MoldDialog from '@/components/view/MoldDialog'
import TooltipLabel from '@/components/widgets/TooltipLabel'
import { networkError } from '@/utils/networkLifecycle'
import { aclCommands, aclDenied, runAclWrite } from '@/utils/vpcAclAccess'
import { aclCsvError, aclCsvFields, aclCsvRule, aclImportReport, parseAclCsv } from '@/utils/aclCsv'

export default {
  name: 'ImportNetworkACL',
  components: { MoldDialog, TooltipLabel },
  props: {
    resource: { type: Object, required: true },
    projectArgs: { type: Object, required: true },
    canWrite: { type: Function, required: true }
  },
  emits: ['imported', 'close-action', 'refresh-access'],
  data: () => ({
    loading: false,
    reading: false,
    disposed: false,
    fileSequence: 0,
    fileList: [],
    csvData: [],
    blocked: false,
    uncertain: false,
    pending: null,
    batch: [],
    error: null,
    report: null,
    savedRules: false,
    editor: null,
    fields: aclCsvFields
  }),
  computed: {
    locked () {
      return this.loading || this.blocked || this.uncertain || !!this.pending
    },
    validRows () {
      return this.csvData.filter(row => !aclCsvError(row))
    },
    columns () {
      return [
        { title: this.$t('label.acl.csv.line'), dataIndex: 'line', width: 64 },
        { title: this.$t('label.acl.csv.validation'), key: 'validation', width: 230 },
        ...['protocol', 'action', 'cidrlist', 'traffictype', 'number', 'reason'].map(field => ({
          title: this.$t(aclCsvFields[field]), dataIndex: field, width: field === 'cidrlist' || field === 'reason' ? 185 : 100
        }))
      ]
    },
    reportMessage () {
      if (!this.report.saved) return 'message.acl.csv.none'
      return this.report.failed ? 'message.acl.csv.partial' : 'message.acl.csv.success'
    },
    reportType () {
      if (!this.report.saved) return 'error'
      return this.report.failed || !this.report.applied ? 'warning' : 'success'
    }
  },
  beforeUnmount () { this.disposed = true },
  methods: {
    current () { return !this.disposed && this.canWrite() },
    rowMessage (row) {
      const error = aclCsvError(row)
      return error ? this.$t(error) : row.serverError || ''
    },
    saveEdit () {
      if (!this.current() || this.locked || !this.editor) return
      const { line } = this.editor
      const replacement = { ...aclCsvRule(this.editor), line }
      this.csvData = this.csvData.map(row => row.line === line ? replacement : row)
      this.editor = null
    },
    beforeUpload (file) {
      this.readFile(file)
      return false
    },
    async readFile (file) {
      if (!this.current() || this.locked) return
      const sequence = ++this.fileSequence
      this.fileList = [file]
      this.csvData = []
      this.error = null
      this.report = null
      this.editor = null
      this.reading = true
      try {
        if (!/\.csv$/i.test(file.name)) throw new Error('Invalid ACL CSV file')
        const text = await file.text()
        if (this.current() && sequence === this.fileSequence) this.csvData = parseAclCsv(text)
      } catch (error) {
        if (this.current() && sequence === this.fileSequence) {
          this.error = { message: error.line ? 'message.acl.csv.file.line' : 'label.error.rules.file.import', line: error.line }
        }
      } finally {
        if (this.current() && sequence === this.fileSequence) this.reading = false
      }
    },
    handleRemove () {
      if (!this.current() || this.locked) return false
      this.fileSequence++
      this.reading = false
      this.fileList = []
      this.csvData = []
      this.error = null
      this.report = null
      this.editor = null
      return true
    },
    closeAction () {
      if (!this.loading) this.$emit(this.savedRules || this.pending || this.uncertain ? 'imported' : 'close-action')
    },
    async handleSubmit () {
      if (!this.current() || this.loading || this.reading || this.blocked || this.uncertain || this.editor ||
          (!this.pending && !this.validRows.length)) return
      if (!this.pending) this.batch = this.validRows
      const params = { ...this.projectArgs, aclid: this.resource.id, reportdetails: true }
      for (const row of this.batch) {
        for (const [name, value] of Object.entries(aclCsvRule(row))) params['rules[' + row.line + '].' + name] = value
      }
      this.loading = true
      this.error = null
      try {
        let result
        const ok = await runAclWrite({
          get: getAPI,
          post: postAPI,
          command: aclCommands.import,
          params,
          pending: this.pending,
          current: this.current,
          accepted: jobId => { this.pending = jobId },
          completed: jobResult => { result = aclImportReport(jobResult, this.batch) }
        })
        if (ok && this.current()) {
          this.savedRules ||= result.successcount > 0
          this.csvData = this.csvData
            .filter(row => aclCsvError(row) || Object.hasOwn(result.failedrows, row.line))
            .map(row => ({ ...row, serverError: result.failedrows[row.line] }))
          this.report = { saved: result.successcount, failed: this.csvData.length, applied: result.applied }
          this.batch = []
        }
      } catch (error) {
        if (!this.current()) return
        this.blocked = aclDenied(error)
        const failure = networkError(error)
        this.uncertain = !this.blocked && !this.pending && !(failure.definitive && error.response?.status === 431)
        this.error = {
          message: this.blocked ? 'message.acl.access.changed'
            : this.pending ? 'message.acl.job.pending'
              : this.uncertain ? 'message.acl.csv.uncertain' : 'message.acl.import.failed',
          detail: failure.text
        }
      } finally {
        if (!this.disposed) this.loading = false
      }
    }
  }
}
</script>

<style scoped>
.acl-import-context {
  display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 4px 16px;
  padding: 12px; border: 1px solid var(--ui-border); border-radius: 8px;
  background: var(--ui-bg-elevated); color: var(--ui-text-primary);
}
.acl-import-context dd { margin: 0; overflow-wrap: anywhere; font-weight: 600; }
.csv-preview { max-width: 100%; overflow: auto; border: 1px solid var(--ui-border); border-radius: 4px; }
.csv-report, .csv-editor { margin-bottom: 16px; }
.csv-editor { padding: 12px; border: 1px solid var(--ui-border); border-radius: 8px; }
</style>
