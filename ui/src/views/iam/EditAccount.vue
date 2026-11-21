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
    <a-spin :spinning="loading">
      <a-form
        :ref="formRef"
        :model="form"
        :loading="loading"
        layout="vertical"
        @finish="handleSubmit">
        <a-form-item ref="newname" name="newname">
          <template #label>
            <tooltip-label :title="$t('label.newname')" :tooltip="apiParams.newname.description"/>
          </template>
          <a-input
            v-model:value="form.newname"
            :placeholder="apiParams.newname.description" />
        </a-form-item>
        <a-form-item ref="networkdomain" name="networkdomain" :extra="$t('message.account.networkdomain.clear')">
          <template #label>
            <tooltip-label :title="$t('label.networkdomain')" :tooltip="apiParams.networkdomain.description"/>
          </template>
          <a-input
            v-model:value="form.networkdomain"
            :placeholder="apiParams.networkdomain.description" />
        </a-form-item>
        <a-form-item ref="roleid" name="roleid">
          <template #label>
            <tooltip-label :title="$t('label.role')" :tooltip="apiParams.roleid.description"/>
          </template>
          <a-select
            v-model:value="form.roleid"
            :loading="roleLoading"
            :disabled="roleUnavailable"
            :placeholder="apiParams.roleid.description"
            v-focus="true"
            showSearch
            optionFilterProp="label"
            :filterOption="(input, option) => {
              return option.label.toLowerCase().indexOf(input.toLowerCase()) >= 0
            }">
            <a-select-option v-for="role in roles" :key="role.id" :value="role.id" :label="role.name">{{ role.name }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item v-if="isRootAdmin" ref="apikeyaccess" name="apikeyaccess">
          <template #label>
            <tooltip-label :title="$t('label.apikeyaccess')" :tooltip="apiParams.apikeyaccess.description"/>
          </template>
          <a-radio-group v-model:value="form.apikeyaccess" buttonStyle="solid">
            <a-radio-button value="ENABLED">{{ $t('label.enabled') }}</a-radio-button>
            <a-radio-button value="INHERIT">{{ $t('label.account.apikey.inherit') }}</a-radio-button>
            <a-radio-button value="DISABLED">{{ $t('label.disabled') }}</a-radio-button>
          </a-radio-group>
        </a-form-item>
        <div :span="24" class="action-button">
          <a-button @click="closeAction">{{ $t('label.cancel') }}</a-button>
          <a-button :loading="loading" :disabled="!changed" ref="submit" type="primary" @click="handleSubmit">{{ $t('label.ok') }}</a-button>
        </div>
      </a-form>
    </a-spin>
  </div>
</template>
<script>
import { ref } from 'vue'
import { getAPI, postAPI } from '@/api'
import TooltipLabel from '@/components/widgets/TooltipLabel'

export default {
  name: 'EditAccount',
  components: {
    TooltipLabel
  },
  props: {
    resource: {
      type: Object,
      required: true
    }
  },
  data () {
    return {
      form: {},
      original: {},
      loading: false,
      roleLoading: false,
      roleUnavailable: false,
      roles: []
    }
  },
  beforeCreate () {
    this.apiParams = this.$getApiParams('updateAccount')
  },
  created () {
    this.formRef = ref()
    this.initForm()
    this.fetchRoles()
  },
  activated () {
    this.initForm()
  },
  computed: {
    isRootAdmin () {
      return this.$store.getters.userInfo?.roletype === 'Admin'
    },
    changes () {
      const keys = ['newname', 'networkdomain', 'roleid']
      if (this.isRootAdmin) keys.push('apikeyaccess')
      return Object.fromEntries(keys.filter(key => this.form[key] !== undefined && this.form[key] !== this.original[key])
        .map(key => [key, this.form[key]]))
    },
    changed () {
      return Object.keys(this.changes).length > 0
    }
  },
  watch: {
    'resource.id' () { this.initForm() }
  },
  methods: {
    initForm () {
      this.original = {
        newname: this.resource.name,
        networkdomain: this.resource.networkdomain ?? '',
        roleid: this.resource.roleid,
        apikeyaccess: this.resource.apikeyaccess ?? 'INHERIT'
      }
      this.form = { ...this.original }
    },
    async fetchRoles () {
      this.roleLoading = true
      try {
        const response = await getAPI('listRoles', { state: 'enabled', pagesize: 500 }, { preserveOnFailure: true })
        this.roles = response.listrolesresponse?.role || []
      } catch (error) {
        this.roleUnavailable = true
      } finally {
        this.roleLoading = false
      }
    },
    async handleSubmit (event) {
      if (typeof event?.preventDefault === 'function') event.preventDefault()
      if (this.loading || !this.changed || !this.resource.id) return
      const params = { id: this.resource.id, ...this.changes }
      if (params.newname !== undefined && !params.newname.trim()) {
        this.formRef.value.setFields([{ name: 'newname', errors: [this.$t('message.error.required.input')] }])
        return
      }
      this.loading = true
      try {
        await postAPI('updateAccount', params, { preserveOnFailure: true })
        this.$emit('refresh-data')
        this.$notification.success({
          message: this.$t('label.edit.account'),
          description: this.$t('message.success.update.account') + ' ' + (params.newname || this.resource.name)
        })
        this.closeAction()
      } catch (error) {
        const description = Object.values(error.response?.data || {}).find(value => value?.errortext)?.errortext ||
          error.response?.headers?.['x-description'] || error.message
        this.$notification.error({ message: this.$t('message.request.failed'), description, duration: 0 })
      } finally {
        this.loading = false
      }
    },
    closeAction () {
      this.$emit('close-action')
    }
  }
}
</script>
<style scoped lang="less">
  .form-layout {
    width: 80vw;
    @media (min-width: 600px) {
      width: 450px;
    }
  }
</style>
