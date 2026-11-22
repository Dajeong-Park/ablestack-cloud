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
    :visible="true"
    :title="$t('label.download.events')"
    :doc-help="docHelp"
    :after-close="afterClose"
    :focus-trigger-after-close="false"
    size="md"
    focus-guard
    @cancel="$emit('close')">
    <p>{{ $t('message.events.csv.confirm', [ids.length]) }}</p>
    <a-alert v-if="error" role="alert" type="error" show-icon :message="$t(error)" />
    <template #footer>
      <div @keydown.ctrl.enter.stop.prevent="submit">
        <a-button @click="$emit('close')">{{ $t('label.cancel') }}</a-button>
        <a-button type="primary" :loading="loading" :disabled="!ids.length || loading" @click="submit">
          {{ $t('label.download.csv') }}
        </a-button>
      </div>
    </template>
  </MoldDialog>
</template>

<script>
import { postAPI } from '@/api'
import MoldDialog from '@/components/view/MoldDialog'

export default {
  name: 'EventCsvDialog',
  components: { MoldDialog },
  props: {
    ids: { type: Array, required: true },
    docHelp: { type: String, default: '' },
    afterClose: { type: Function, required: true }
  },
  emits: ['close'],
  data () {
    return { loading: false, error: '', disposed: false }
  },
  beforeUnmount () {
    this.disposed = true
  },
  methods: {
    async submit () {
      if (this.loading || !this.ids.length) return
      this.loading = true
      this.error = ''
      try {
        const { downloadeventsresponse: result } = await postAPI('downloadEvents', { ids: this.ids.join(',') }, { preserveOnFailure: true, timeout: 30000 })
        if (this.disposed) return
        if (result?.success && result.count === 0) {
          this.error = 'message.events.csv.empty'
          return
        }
        if (!result?.success || result.count !== this.ids.length || !result.csv || result.filename !== 'event.csv') {
          this.error = 'message.events.csv.failed'
          return
        }

        const url = URL.createObjectURL(new Blob([result.csv], { type: 'text/csv;charset=utf-8' }))
        const link = document.createElement('a')
        link.href = url
        link.download = result.filename
        document.body.appendChild(link)
        try {
          link.click()
        } finally {
          link.remove()
          setTimeout(() => URL.revokeObjectURL(url), 1000)
        }
        this.$message.success(this.$t('message.events.csv.started'))
        this.$emit('close')
      } catch {
        if (!this.disposed) this.error = 'message.events.csv.failed'
      } finally {
        if (!this.disposed) this.loading = false
      }
    }
  }
}
</script>
