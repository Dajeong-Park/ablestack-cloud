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
          :disabled="loading || blocked || !!pending || !canWrite()"
          :file-list="fileList"
          :before-upload="beforeUpload"
          @remove="handleRemove">
          <p class="ant-upload-drag-icon"><cloud-upload-outlined /></p>
          <p class="ant-upload-text">{{ $t('label.rules.file.import.description') }}</p>
        </a-upload-dragger>
      </a-form-item>
      <a-form-item v-if="csvData.length" :label="$t('label.csv.preview')">
        <div class="csv-preview">
          <a-table
            :columns="columns"
            :data-source="csvData"
            :row-key="record => record.key"
            :pagination="{ pageSize: 5 }"
            :scroll="{ x: 760 }"
            size="small">
            <template #action="{ record }">
              <a-tag :color="record.action?.toLowerCase() === 'allow' ? 'green' : 'red'">{{ record.action?.toUpperCase() || '—' }}</a-tag>
            </template>
            <template #traffictype="{ record }">
              <a-tag :color="record.traffictype?.toLowerCase() === 'ingress' ? 'blue' : 'orange'">{{ record.traffictype?.toUpperCase() || '—' }}</a-tag>
            </template>
          </a-table>
        </div>
      </a-form-item>
      <p>{{ $t('message.network.acl.import.note') }}</p>
    </a-form>
    <a-alert v-if="error" show-icon type="error" :message="$t(error.message)" :description="error.detail" />
    <template #footer>
      <a-button :disabled="loading" @click="closeAction">{{ $t('label.close') }}</a-button>
      <a-button v-if="blocked" type="primary" @click="$emit('refresh-access')">{{ $t('label.refresh') }}</a-button>
      <a-button v-else type="primary" :loading="loading || reading" :disabled="!canWrite() || !csvData.length" @click="handleSubmit">
        {{ $t(pending ? 'label.vmvolume.check' : error && csvData.length ? 'label.retry' : 'label.import') }}
      </a-button>
    </template>
  </MoldDialog>
</template>

<script>
import { getAPI, postAPI } from '@/api'
import MoldDialog from '@/components/view/MoldDialog'
import TooltipLabel from '@/components/widgets/TooltipLabel'
import { networkError } from '@/utils/networkLifecycle'
import { aclCommands, aclDenied, parseAclCsv, runAclWrite } from '@/utils/vpcAclAccess'

export default {
  name: 'ImportNetworkACL',
  components: { MoldDialog, TooltipLabel },
  props: {
    resource: { type: Object, required: true },
    projectArgs: { type: Object, required: true },
    canWrite: { type: Function, required: true }
  },
  emits: ['imported', 'close-action', 'refresh-access'],
  data () {
    return {
      loading: false,
      reading: false,
      disposed: false,
      fileSequence: 0,
      fileList: [],
      csvData: [],
      blocked: false,
      pending: null,
      error: null,
      columns: [
        {
          title: this.$t('label.protocol'),
          dataIndex: 'protocol',
          key: 'protocol',
          width: 100
        },
        {
          title: this.$t('label.action'),
          dataIndex: 'action',
          key: 'action',
          width: 100,
          slots: { customRender: 'action' }
        },
        {
          title: this.$t('label.cidr'),
          dataIndex: 'cidrlist',
          width: 150,
          ellipsis: true
        },
        {
          title: this.$t('label.startport'),
          dataIndex: 'startport',
          width: 100
        },
        {
          title: this.$t('label.endport'),
          dataIndex: 'endport',
          width: 100
        },
        {
          title: this.$t('label.traffictype'),
          dataIndex: 'traffictype',
          key: 'traffictype',
          width: 120,
          slots: { customRender: 'traffictype' }
        },
        {
          title: this.$t('label.number'),
          dataIndex: 'number',
          width: 80
        },
        {
          title: this.$t('label.reason'),
          dataIndex: 'reason',
          ellipsis: true
        }
      ]
    }
  },
  beforeUnmount () { this.disposed = true },
  methods: {
    current () { return !this.disposed && this.canWrite() },
    beforeUpload (file) {
      if (!this.current() || this.loading || this.blocked || this.pending) return false
      this.readFile(file)
      return false
    },
    async readFile (file) {
      if (!this.current() || this.loading || this.blocked || this.pending) return
      const sequence = ++this.fileSequence
      this.fileList = [file]
      this.csvData = []
      this.error = null
      this.reading = true
      try {
        if (!/\.csv$/i.test(file.name)) throw new Error('Invalid ACL CSV file')
        const text = await file.text()
        if (this.current() && sequence === this.fileSequence) this.csvData = parseAclCsv(text)
      } catch {
        if (this.current() && sequence === this.fileSequence) this.error = { message: 'label.error.rules.file.import' }
      } finally {
        if (this.current() && sequence === this.fileSequence) this.reading = false
      }
    },
    handleRemove () {
      if (!this.current() || this.loading || this.blocked || this.pending) return false
      this.fileSequence++
      this.reading = false
      this.fileList = []
      this.csvData = []
      this.error = null
      return true
    },
    closeAction () {
      if (!this.loading) this.$emit('close-action')
    },
    async handleSubmit () {
      if (!this.current() || this.loading || this.reading || this.blocked || !this.csvData.length) return
      const params = { ...this.projectArgs, aclid: this.resource.id }
      this.csvData.forEach(({ key, ...row }, index) => {
        for (const [name, value] of Object.entries(row)) params['rules[' + index + '].' + name] = value
      })
      this.loading = true
      this.error = null
      try {
        const ok = await runAclWrite({
          get: getAPI,
          post: postAPI,
          command: aclCommands.import,
          params,
          pending: this.pending,
          current: this.current,
          accepted: jobId => { this.pending = jobId }
        })
        if (ok && this.current()) {
          this.$message.success(this.$t('message.acl.import.completed'))
          this.$emit('imported')
        }
      } catch (error) {
        if (!this.current()) return
        this.blocked = aclDenied(error)
        this.error = {
          message: this.blocked ? 'message.acl.access.changed' : this.pending ? 'message.acl.job.pending' : 'message.acl.import.failed',
          detail: networkError(error).text
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
</style>
