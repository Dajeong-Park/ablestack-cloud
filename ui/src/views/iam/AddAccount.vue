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
        :rules="rules"
        :loading="loading"
        layout="vertical"
        @finish="handleSubmit">
        <a-alert v-if="optionsFailed" type="error" show-icon :message="$t('message.account.create.options.failed')">
          <template #action>
            <a-button size="small" @click="fetchOptions">{{ $t('label.refresh') }}</a-button>
          </template>
        </a-alert>
        <a-form-item v-if="canChooseDomain" ref="domainid" name="domainid">
          <template #label>
            <tooltip-label :title="$t('label.domainid')" :tooltip="apiParams.domainid.description"/>
          </template>
          <a-select
            :loading="domainLoading"
            v-model:value="form.domainid"
            :placeholder="apiParams.domainid.description"
            showSearch
            optionFilterProp="label"
            :filterOption="(input, option) => {
              return  option.label.toLowerCase().indexOf(input.toLowerCase()) >= 0
            }" >
            <a-select-option v-for="domain in domainsList" :key="domain.id" :label="domain.path || domain.name || domain.description">
              <span>
                <resource-icon v-if="domain && domain.icon" :image="domain.icon.base64image" size="1x" style="margin-right: 5px"/>
                <block-outlined v-else style="margin-right: 5px"/>
                {{ domain.path || domain.name || domain.description }}
              </span>
            </a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item ref="roleid" name="roleid">
          <template #label>
            <tooltip-label :title="$t('label.role')" :tooltip="apiParams.roleid.description"/>
          </template>
          <a-select
            v-model:value="form.roleid"
            :loading="roleLoading"
            :placeholder="apiParams.roleid.description"
            v-focus="true"
            showSearch
            optionFilterProp="label"
            :filterOption="(input, option) => {
              return option.label.toLowerCase().indexOf(input.toLowerCase()) >= 0
            }">
            <a-select-option v-for="role in availableRoles" :key="role.id" :label="role.name + ' (' + role.type + ')'">
              {{ role.name + ' (' + role.type + ')' }}
            </a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item v-if="requiresRoleConfirmation" name="confirmRole">
          <a-checkbox v-model:checked="form.confirmRole">
            {{ $t('message.account.create.confirm.role', { role: selectedRole.name, domain: selectedDomainLabel }) }}
          </a-checkbox>
        </a-form-item>
        <a-form-item ref="username" name="username">
          <template #label>
            <tooltip-label :title="$t('label.username')" :tooltip="apiParams.username.description"/>
          </template>
          <a-input
            v-model:value="form.username"
            :placeholder="apiParams.username.description" />
        </a-form-item>
        <a-row :gutter="12">
          <a-col :md="24" :lg="12">
            <a-form-item ref="password" name="password" :extra="passwordHint">
              <template #label>
                <tooltip-label :title="$t('label.password')" :tooltip="apiParams.password.description"/>
              </template>
              <a-input-password
                v-model:value="form.password"
                :placeholder="apiParams.password.description"/>
            </a-form-item>
          </a-col>
          <a-col :md="24" :lg="12">
            <a-form-item ref="confirmpassword" name="confirmpassword">
              <template #label>
                <tooltip-label :title="$t('label.confirmpassword')" :tooltip="apiParams.password.description"/>
              </template>
              <a-input-password
                v-model:value="form.confirmpassword"
                :placeholder="apiParams.password.description"/>
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item ref="email" name="email">
          <template #label>
            <tooltip-label :title="$t('label.email')" :tooltip="apiParams.email.description"/>
          </template>
          <a-input
            v-model:value="form.email"
            :placeholder="apiParams.email.description" />
        </a-form-item>
        <a-row :gutter="12">
          <a-col :md="24" :lg="12">
            <a-form-item ref="firstname" name="firstname">
              <template #label>
                <tooltip-label :title="$t('label.firstname')" :tooltip="apiParams.firstname.description"/>
              </template>
              <a-input
                v-model:value="form.firstname"
                :placeholder="apiParams.firstname.description" />
            </a-form-item>
          </a-col>
          <a-col :md="24" :lg="12">
            <a-form-item ref="lastname" name="lastname">
              <template #label>
                <tooltip-label :title="$t('label.lastname')" :tooltip="apiParams.lastname.description"/>
              </template>
              <a-input
                v-model:value="form.lastname"
                :placeholder="apiParams.lastname.description" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item ref="account" name="account">
          <template #label>
            <tooltip-label :title="$t('label.account')" :tooltip="apiParams.account.description"/>
          </template>
          <a-input v-model:value="form.account" :placeholder="apiParams.account.description" />
        </a-form-item>
        <a-form-item ref="timezone" name="timezone">
          <template #label>
            <tooltip-label :title="$t('label.timezone')" :tooltip="apiParams.timezone.description"/>
          </template>
          <a-select
            v-model:value="form.timezone"
            :loading="timeZoneLoading"
            :placeholder="apiParams.timezone.description"
            showSearch
            optionFilterProp="label"
            :filterOption="(input, option) => {
              return option.label.toLowerCase().indexOf(input.toLowerCase()) >= 0
            }">
            <a-select-option v-for="opt in timeZoneMap" :key="opt.id" :label="opt.name || opt.description">
              {{ opt.name || opt.description }}
            </a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item ref="networkdomain" name="networkdomain">
          <template #label>
            <tooltip-label :title="$t('label.networkdomain')" :tooltip="apiParams.networkdomain.description"/>
          </template>
          <a-input
            v-model:value="form.networkdomain"
            :placeholder="apiParams.networkdomain.description" />
        </a-form-item>
        <div v-if="samlAllowed">
          <a-form-item :label="$t('label.samlenable')" ref="samlenable" name="samlenable">
            <a-switch v-model:checked="form.samlenable" />
          </a-form-item>
          <a-form-item v-if="form.samlenable" ref="samlentity" name="samlentity">
            <template #label>
              <tooltip-label :title="$t('label.samlentity')" :tooltip="apiParams.entityid.description"/>
            </template>
            <a-select
              v-model:value="form.samlentity"
              :loading="idpLoading"
              :placeholder="apiParams.entityid.description"
              showSearch
              optionFilterProp="label"
              :filterOption="(input, option) => {
                return option.label.toLowerCase().indexOf(input.toLowerCase()) >= 0
              }">
              <a-select-option v-for="idp in idps" :key="idp.id" :label="idp.orgName">
                {{ idp.orgName }}
              </a-select-option>
            </a-select>
          </a-form-item>
        </div>
        <MoldDialogActions :busy="loading">
          <a-button @click="closeAction">{{ $t('label.cancel') }}</a-button>
          <a-button
            :loading="loading"
            :disabled="domainLoading || roleLoading || optionsFailed || (requiresRoleConfirmation && !form.confirmRole)"
            ref="submit"
            type="primary"
            @click="handleSubmit">{{ $t('label.ok') }}</a-button>
        </MoldDialogActions>
      </a-form>
    </a-spin>
  </div>
</template>
<script>
import MoldDialogActions from '@/components/view/MoldDialogActions'
import { ref, reactive, toRaw } from 'vue'
import { getAPI, postAPI } from '@/api'
import { timeZone } from '@/utils/timezone'
import debounce from 'lodash/debounce'
import ResourceIcon from '@/components/view/ResourceIcon'
import TooltipLabel from '@/components/widgets/TooltipLabel'

const roleTypes = ['Admin', 'ResourceAdmin', 'DomainAdmin', 'User']
const passwordLengthKeys = ['password.policy.minimum.length', 'password.policy.maximum.length']

export default {
  name: 'AddAccountForm',
  components: {
    MoldDialogActions,
    TooltipLabel,
    ResourceIcon
  },
  data () {
    this.fetchTimeZone = debounce(this.fetchTimeZone, 800)
    return {
      form: {},
      loading: false,
      domainLoading: false,
      domainsList: [],
      optionsFailed: false,
      passwordBounds: [],
      passwordRequest: 0,
      roleLoading: false,
      roles: [],
      timeZoneLoading: false,
      timeZoneMap: [],
      idpLoading: false,
      idps: []
    }
  },
  beforeCreate () {
    this.apiParams = this.$getApiParams('createAccount', 'authorizeSamlSso')
  },
  created () {
    this.initForm()
    this.fetchData()
  },
  computed: {
    samlAllowed () {
      return 'authorizeSamlSso' in this.$store.getters.apis
    },
    canChooseDomain () {
      const { userInfo, apis } = this.$store.getters
      return roleTypes.slice(0, 3).includes(userInfo.roletype) && 'listDomains' in apis
    },
    selectedDomain () {
      return this.domainsList.find(domain => domain.id === this.form.domainid)
    },
    selectedDomainLabel () {
      return this.selectedDomain?.path || this.selectedDomain?.name || this.$store.getters.userInfo.domain || this.form.domainid
    },
    availableRoles () {
      const caller = roleTypes.indexOf(this.$store.getters.userInfo.roletype)
      if (caller === -1) return []
      return this.roles.filter(role => roleTypes.slice(caller).includes(role.type) &&
        (role.type !== 'Admin' || Number(this.selectedDomain?.level) === 0))
    },
    selectedRole () {
      return this.availableRoles.find(role => role.id === this.form.roleid)
    },
    requiresRoleConfirmation () {
      return this.selectedRole && this.selectedRole.type !== 'User'
    },
    passwordHint () {
      const [min, max] = this.passwordBounds
      return [
        this.$t('message.account.password.policy'),
        min > 0 && this.$t('message.account.password.minimum', { count: min }),
        max > 0 && this.$t('message.account.password.maximum', { count: max })
      ].filter(Boolean).join(' ')
    }
  },
  watch: {
    'form.domainid' () {
      this.form.confirmRole = false
      this.selectDefaultRole()
      this.fetchPasswordBounds()
    },
    'form.roleid' () {
      this.form.confirmRole = false
    }
  },
  methods: {
    initForm () {
      const userDomain = this.$store.getters.userInfo.domainid
      const routeDomain = this.$route.query.domainid
      this.formRef = ref()
      this.form = reactive({
        domainid: this.canChooseDomain && typeof routeDomain === 'string' && routeDomain ? routeDomain : userDomain,
        confirmRole: false
      })
      this.rules = reactive({
        roleid: [{ required: true, message: this.$t('message.error.select') }],
        username: [{ required: true, message: this.$t('message.error.required.input') }],
        password: [
          { required: true, message: this.$t('message.error.required.input') },
          { validator: this.validatePasswordLength }
        ],
        confirmpassword: [
          { required: true, message: this.$t('message.error.required.input') },
          { validator: this.validateConfirmPassword }
        ],
        email: [{ required: true, message: this.$t('message.error.required.input') }],
        firstname: [{ required: true, message: this.$t('message.error.required.input') }],
        lastname: [{ required: true, message: this.$t('message.error.required.input') }],
        domainid: [{ required: true, message: this.$t('message.error.select') }]
      })
    },
    fetchData () {
      this.fetchOptions()
      this.fetchTimeZone()
      if (this.samlAllowed) {
        this.fetchIdps()
      }
    },
    isValidValueForKey (obj, key) {
      return key in obj && obj[key] != null
    },
    selectDefaultRole () {
      if (!this.selectedRole) {
        this.form.roleid = this.availableRoles.find(role => role.type === 'User' && role.isdefault && role.name === 'User')?.id
      }
    },
    async fetchOptions () {
      this.optionsFailed = false
      this.domainLoading = this.canChooseDomain
      this.roleLoading = true
      try {
        const [domains, roles] = await Promise.all([
          this.canChooseDomain ? this.fetchOptionPages('listDomains', 'domain', { listall: true, details: 'min' }) : [],
          this.fetchOptionPages('listRoles', 'role', { state: 'enabled' })
        ])
        this.domainsList = domains
        this.roles = roles
        if (this.canChooseDomain && !this.selectedDomain) {
          this.form.domainid = undefined
        }
        this.selectDefaultRole()
        this.fetchPasswordBounds()
      } catch (error) {
        this.optionsFailed = true
      } finally {
        this.domainLoading = false
        this.roleLoading = false
      }
    },
    async fetchOptionPages (api, key, filters) {
      const options = []
      for (let page = 1; ; page++) {
        const response = await getAPI(api, { ...filters, pagesize: 100, page }, { preserveOnFailure: true })
        const result = response[api.toLowerCase() + 'response'] || {}
        const items = result[key] || []
        options.push(...items)
        if (items.length === 0 || options.length >= (result.count ?? options.length)) return options
      }
    },
    async fetchPasswordBounds () {
      const request = ++this.passwordRequest
      this.passwordBounds = []
      const domainid = this.form.domainid
      if (!domainid || !('listConfigurations' in this.$store.getters.apis)) return
      const bounds = await Promise.all(passwordLengthKeys.map(async name => {
        try {
          const response = await getAPI('listConfigurations', { name, domainid }, { preserveOnFailure: true })
          const value = response.listconfigurationsresponse?.configuration?.find(config => config.name === name)?.value
          return value != null && /^\d+$/.test(value) ? Number(value) : undefined
        } catch {
          return undefined
        }
      }))
      if (request === this.passwordRequest) this.passwordBounds = bounds
    },
    async validatePasswordLength (rule, value) {
      if (!value) return
      const [min, max] = this.passwordBounds
      if (value.length < min) throw new Error(this.$t('message.account.password.minimum', { count: min }))
      if (max !== undefined && value.length > max) throw new Error(this.$t('message.account.password.maximum', { count: max }))
    },
    async validateConfirmPassword (rule, value) {
      if (!value || value.length === 0) {
        return Promise.resolve()
      } else if (rule.field === 'confirmpassword') {
        const messageConfirm = this.$t('error.password.not.match')
        const passwordVal = this.form.password
        if (passwordVal && passwordVal !== value) {
          return Promise.reject(messageConfirm)
        } else {
          return Promise.resolve()
        }
      } else {
        return Promise.resolve()
      }
    },
    fetchTimeZone (value) {
      this.timeZoneMap = []
      this.timeZoneLoading = true

      timeZone(value).then(json => {
        this.timeZoneMap = json
        this.timeZoneLoading = false
      })
    },
    fetchIdps () {
      this.idpLoading = true
      getAPI('listIdps').then(response => {
        this.idps = response.listidpsresponse.idp || []
        this.form.samlentity = this.idps[0]?.id || ''
      }).finally(() => {
        this.idpLoading = false
      })
    },
    handleSubmit (e) {
      if (typeof e?.preventDefault === 'function') e.preventDefault()
      if (this.loading || this.domainLoading || this.roleLoading || this.optionsFailed ||
          (this.requiresRoleConfirmation && !this.form.confirmRole)) return
      this.loading = true
      this.formRef.value.validate().then(() => {
        if (!this.selectedRole || !this.form.domainid || (this.canChooseDomain && !this.selectedDomain)) return
        const values = toRaw(this.form)
        const params = {
          roleid: values.roleid,
          username: values.username,
          password: values.password,
          email: values.email,
          firstname: values.firstname,
          lastname: values.lastname,
          domainid: values.domainid,
          enable: values.samlenable !== undefined ? values.samlenable : false
        }
        if (this.isValidValueForKey(values, 'account') && values.account.length > 0) {
          params.account = values.account
        }
        if (this.isValidValueForKey(values, 'timezone') && values.timezone.length > 0) {
          params.timezone = values.timezone
        }
        if (this.isValidValueForKey(values, 'networkdomain') && values.networkdomain.length > 0) {
          params.networkdomain = values.networkdomain
        }

        return postAPI('createAccount', params).then(response => {
          this.$emit('refresh-data')
          this.$notification.success({
            message: this.$t('label.create.account'),
            description: `${this.$t('message.success.create.account')} ${params.username}`
          })
          const users = response.createaccountresponse.account.user
          if (values.samlenable && users) {
            for (var i = 0; i < users.length; i++) {
              postAPI('authorizeSamlSso', {
                enable: values.samlenable,
                entityid: values.samlentity,
                userid: users[i].id
              }).then(response => {
                this.$notification.success({
                  message: this.$t('label.samlenable'),
                  description: this.$t('message.success.enable.saml.auth')
                })
              }).catch(error => {
                this.$notification.error({
                  message: this.$t('message.request.failed'),
                  description: (error.response && error.response.headers && error.response.headers['x-description']) || error.message,
                  duration: 0
                })
              })
            }
          }
          this.closeAction()
        }).catch(error => {
          const description = error.response?.data?.errorresponse?.errortext ||
            error.response?.headers?.['x-description'] || error.message
          if (/user password/i.test(description || '')) {
            const limit = /password (must be less than|should contain at least) \[(\d+)\] characters\./i.exec(description)
            const key = limit
              ? (limit[1] === 'must be less than' ? 'message.account.password.maximum' : 'message.account.password.minimum')
              : 'message.account.password.rejected'
            this.formRef.value.setFields([{ name: 'password', errors: [this.$t(key, { count: Number(limit?.[2]) })] }])
            this.formRef.value.scrollToField('password')
            return
          }
          this.$notification.error({
            message: this.$t('message.request.failed'),
            description,
            duration: 0
          })
        })
      }).catch(error => {
        if (error.errorFields?.length) this.formRef.value.scrollToField(error.errorFields[0].name)
      }).finally(() => {
        this.loading = false
      })
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
