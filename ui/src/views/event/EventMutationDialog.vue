<!-- Licensed to the Apache Software Foundation (ASF) under one or more
contributor license agreements. See the NOTICE file distributed with this work
for additional information regarding copyright ownership. The ASF licenses this
file to you under the Apache License, Version 2.0 (the "License"); you may not use
this file except in compliance with the License. You may obtain a copy at
http://www.apache.org/licenses/LICENSE-2.0 . Unless required by applicable law or
agreed to in writing, software distributed under the License is distributed on
an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND. See the License
for the specific language governing permissions and limitations. -->
<template>
  <MoldDialog
    :visible="true"
    :title="$t(actionLabel)"
    :doc-help="docHelp"
    :after-close="afterClose"
    :focus-trigger-after-close="false"
    :closable="!loading"
    :keyboard="!loading"
    size="md"
    focus-guard
    @cancel="$emit('close')">
    <a-alert
      show-icon
      :type="deleting ? 'warning' : 'info'"
      :message="$t(deleting ? 'message.events.delete.confirm.count' : 'message.events.archive.confirm.count', [targets.length])"
    />
    <ul class="event-action-targets">
      <li v-for="target in targets" :key="target.id">{{ target.type }} <code>{{ target.id }}</code></li>
    </ul>
    <a-alert v-if="error" role="alert" type="error" show-icon :message="$t(error)" />
    <template #footer>
      <a-button :disabled="loading" @click="$emit('close')">{{ $t('label.cancel') }}</a-button>
      <a-button v-if="error" type="primary" @click="$emit('refresh')">{{ $t('label.refresh') }}</a-button>
      <a-button v-else type="primary" :danger="deleting" :loading="loading" :disabled="!targets.length || loading" @click="submit">
        {{ $t(actionLabel) }}
      </a-button>
    </template>
  </MoldDialog>
</template>

<script>
import { postAPI } from '@/api'
import MoldDialog from '@/components/view/MoldDialog'
import { eventMutationError, isEventMutation } from '@/utils/eventActions'

export default {
  name: 'EventMutationDialog',
  components: { MoldDialog },
  props: {
    api: { type: String, required: true, validator: isEventMutation },
    targets: { type: Array, required: true },
    docHelp: { type: String, default: '' },
    afterClose: { type: Function, required: true }
  },
  emits: ['close', 'completed', 'refresh'],
  data () {
    return { loading: false, error: '', disposed: false }
  },
  computed: {
    deleting () { return this.api === 'deleteEvents' },
    actionLabel () { return this.deleting ? 'label.delete.events' : 'label.archive.events' }
  },
  beforeUnmount () {
    this.disposed = true
  },
  methods: {
    async submit () {
      if (this.loading || this.error || !this.targets.length) return
      this.loading = true
      try {
        const ids = this.targets.map(target => target.id).join(',')
        const response = await postAPI(this.api, { ids }, { preserveOnFailure: true, timeout: 30000 })
        if (this.disposed) return
        if (response?.[this.api.toLowerCase() + 'response']?.success !== true) {
          this.error = 'message.events.action.failed'
          return
        }
        this.$message.success(this.$t(this.deleting ? 'label.event.deleted' : 'label.event.archived'))
        this.$emit('completed')
      } catch (error) {
        if (!this.disposed) this.error = eventMutationError(error)
      } finally {
        if (!this.disposed) this.loading = false
      }
    }
  }
}
</script>

<style scoped>
.event-action-targets { margin: 16px 0; overflow-wrap: anywhere; }
</style>
