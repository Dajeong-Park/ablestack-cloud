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
  <div class="role-action-confirmation" :aria-busy="loading">
    <a-alert
      type="warning"
      show-icon
      :message="$t('message.role.action.target', { name: target.name, type: target.type })">
      <template #description>
        <p>{{ $t('message.role.action.' + api) }}</p>
        <p>{{ $t(target.inuse === true ? 'message.role.usage.linked' : target.inuse === false ? 'message.role.usage.unlinked' : 'message.role.usage.unknown') }}</p>
      </template>
    </a-alert>
    <a-alert v-if="error" type="error" show-icon :message="error" />
    <mold-dialog-actions :busy="loading" @keydown.ctrl.enter.prevent.stop="!$event.repeat && confirm()">
      <a-button :disabled="loading" @click="$emit('close-action')">{{ $t('label.cancel') }}</a-button>
      <a-button
        type="primary"
        :danger="api === 'deleteRole'"
        :loading="loading"
        :disabled="!canConfirm"
        @click="confirm">
        {{ $t(currentAction.label) }}
      </a-button>
    </mold-dialog-actions>
  </div>
</template>

<script>
import { getAPI, postAPI } from '@/api'
import MoldDialogActions from '@/components/view/MoldDialogActions'
import { canRoleAction, roleActionTarget, roleUsageParams } from '@/utils/roleActions'
import { roleListLocation } from '@/utils/roleSearch'

const requestOptions = { preserveOnFailure: true, timeout: 15000 }

export default {
  name: 'RoleLifecycleDialog',
  components: { MoldDialogActions },
  props: {
    resource: { type: Object, required: true },
    currentAction: { type: Object, required: true }
  },
  emits: ['refresh-data', 'close-action'],
  data () {
    return {
      api: this.currentAction.api,
      target: roleActionTarget(this.resource),
      path: this.$route.path,
      token: this.$store.state?.user?.token,
      active: true,
      stale: false,
      loading: false,
      error: ''
    }
  },
  computed: {
    apis () { return this.$store.getters.apis },
    current () {
      return this.active && this.path === this.$route.path && this.target.id === this.resource.id &&
        this.token === this.$store.state?.user?.token && this.api === this.currentAction.api
    },
    canConfirm () { return this.current && !this.stale && canRoleAction(this.api, this.target, this.apis) }
  },
  beforeUnmount () { this.active = false },
  deactivated () { this.active = false },
  methods: {
    async confirm () {
      if (this.loading || !this.canConfirm) return
      this.loading = true
      this.error = ''
      try {
        const { id } = this.target
        const { listrolesresponse } = await getAPI('listRoles', { id, ...roleUsageParams(this.apis) }, requestOptions)
        if (!this.canConfirm) return
        const latest = listrolesresponse?.role?.find(role => role.id === id)
        if (!canRoleAction(this.api, latest, this.apis) ||
            JSON.stringify(roleActionTarget(latest)) !== JSON.stringify(this.target)) {
          this.stale = true
          this.error = this.$t('message.role.action.changed')
          this.$emit('refresh-data', { irefresh: true })
          return
        }
        const result = await postAPI(this.api, { id }, requestOptions)
        if (!this.current) return
        if (result?.[this.api.toLowerCase() + 'response']?.success !== true) {
          this.error = this.$t('message.request.failed')
          return
        }
        this.$message.success(this.$t('message.role.action.completed', { name: this.target.name }))
        if (this.api === 'deleteRole') {
          const location = roleListLocation(this.$route, this.$router.options.history.state, this.$store.getters, this.token)
          this.$emit('close-action')
          this.$router.replace(location)
        } else {
          this.$emit('close-action')
          this.$emit('refresh-data', { irefresh: true })
        }
      } catch (error) {
        if (this.current) {
          this.error = Object.values(error.response?.data || {}).find(value => value?.errortext)?.errortext ||
            this.$t('message.request.failed')
        }
      } finally {
        this.loading = false
      }
    }
  }
}
</script>

<style scoped>
.role-action-confirmation { min-width: 0; }
.role-action-confirmation :deep(.ant-alert) { margin-bottom: 12px; }
.role-action-confirmation p:last-child { margin-bottom: 0; }
</style>
