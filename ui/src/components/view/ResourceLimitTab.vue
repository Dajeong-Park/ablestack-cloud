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
  <a-spin :spinning="formLoading">
    <a-alert
      v-if="$route.meta.name === 'account'"
      class="account-limit-notice"
      type="info"
      show-icon
      :message="$t('message.account.limit.tag.scope')" />
    <a-alert
      v-if="$route.meta.name === 'domain'"
      type="info"
      show-icon
      :message="$t('message.domain.limit.scope', { path: resource.path || resource.name })"
      :description="$t('message.domain.limit.values')" />
    <a-alert
      v-if="saveSummary"
      :type="saveSummary.failed.length ? 'warning' : 'success'"
      show-icon
      :message="$t('message.account.limit.save.result', { success: saveSummary.success, failed: saveSummary.failed.length })"
      :description="saveSummary.failed.join(' · ')" />
    <a-form
      :ref="formRef"
      :model="form"
      :rules="rules"
      @finish="handleSubmit"
      layout="vertical"
      v-ctrl-enter="handleSubmit"
    >
      <div v-for="(item, index) in dataResource" :key="index">
        <a-form-item
          v-if="item.resourcetypename !== 'project' || !$route.path.startsWith('/project')"
          :v-bind="item.resourcetypename"
          :label="$t(item.resourcetypename === 'backup' ? 'label.maxbackups' : 'label.max' + (item.resourcetypename || '').replace('_', '')) + (item.tag ? ' [' + item.tag + ']': '')"
          :name="item.key"
          :ref="item.key">
          <a-input-number
            :disabled="!('updateResourceLimit' in $store.getters.apis)"
            style="width: 100%;"
            v-model:value="form[item.key]"
            v-focus="index === 0"
          />
        </a-form-item>
        <a-collapse
            v-if="item.taggedresource && item.taggedresource.length > 0"
            class="tagged-limit-collapse"
            @change="handleCollapseChange(item.resourcetypename)">
          <a-collapse-panel key="1" :header="collpaseActive[item.resourcetypename] ? $t('label.tagged.limits') : $t('label.tagged.limits') + ' - ' + item.tagsasstring">
            <div v-for="(subItem, subItemIndex) in item.taggedresource" :key="subItemIndex">
              <a-form-item
                :v-bind="subItem.resourcetypename"
                :label="$t('label.max') + ' #' + subItem.tag"
                :name="subItem.key"
                :ref="subItem.key">
                <a-input-number
                  :disabled="!('updateResourceLimit' in $store.getters.apis)"
                  style="width: 100%;"
                  v-model:value="form[subItem.key]"
                />
              </a-form-item>
            </div>
          </a-collapse-panel>
        </a-collapse>
      </div>
      <div class="card-footer">
        <a-button
          :disabled="!('updateResourceLimit' in $store.getters.apis)"
          v-if="!($route.meta.name === 'domain' && resource.level === 0)"
          :loading="formLoading"
          type="primary"
          ref="submit"
          @click="handleSubmit">{{ $t('label.submit') }}</a-button>
      </div>
    </a-form>
  </a-spin>
</template>

<script>
import { ref, reactive, toRaw } from 'vue'
import { getAPI, postAPI } from '@/api'
import _ from 'lodash'

export default {
  name: 'ResourceLimitTab',
  emits: ['refresh'],
  props: {
    resource: {
      type: Object,
      required: true
    },
    loading: {
      type: Boolean,
      default: false
    }
  },
  data () {
    return {
      formLoading: false,
      loadVersion: 0,
      saveSummary: null,
      dataResource: [],
      collpaseActive: {},
      resourceTypeIdNames: {}
    }
  },
  created () {
    this.formRef = ref()
    this.form = reactive({})
    this.rules = reactive({})
    this.origValues = {}
    this.fetchData()
  },
  watch: {
    'resource.id' () {
      this.saveSummary = null
      this.fetchData()
    },
    'resource.name' (name, oldName) {
      if (this.$route.meta.name === 'account' && oldName && name !== oldName) this.fetchData()
    }
  },
  methods: {
    getParams () {
      const params = {}
      if (this.$route.meta.name === 'account') {
        params.account = this.resource.name
        params.domainid = this.resource.domainid
      } else if (this.$route.meta.name === 'domain') {
        params.domainid = this.resource.id
      } else { // project
        params.projectid = this.resource.id
      }
      return params
    },
    async fetchData () {
      const version = ++this.loadVersion
      if (!this.resource?.id) return
      const params = this.getParams()
      const form = reactive({})
      this.formLoading = true
      try {
        const rows = await this.listResourceLimits(params)
        if (version !== this.loadVersion) return
        for (const item of rows) {
          this.resourceTypeIdNames[item.resourcetype] = item.resourcetypename
          item.key = item.resourcetype
          form[item.key] = item.max ?? -1
          for (const subItem of item.taggedresource) {
            subItem.key = subItem.resourcetype + '-' + subItem.tag
            form[subItem.key] = subItem.max ?? -1
          }
        }
        this.dataResource = rows
        this.origValues = { ...form }
        this.form = form
        if (this.formRef.value) this.formRef.value.clearValidate()
      } catch (error) {
        if (version === this.loadVersion) this.$notification.error({ message: this.$t('message.request.failed'), description: error })
      } finally {
        if (version === this.loadVersion) this.formLoading = false
      }
    },
    async handleSubmit (event) {
      if (typeof event?.preventDefault === 'function') event.preventDefault()
      if (this.formLoading || !this.resource.id || !this.validateTaggedLimitsForUntaggedLimits(toRaw(this.form))) return
      const changes = Object.entries(this.form).filter(([key, value]) => value != null && value !== this.origValues[key])
      if (!changes.length) return
      const scope = this.getParams()
      const version = this.loadVersion
      const failed = []
      let success = 0
      this.formLoading = true
      try {
        await this.formRef.value.validate()
        for (const [key, max] of changes) {
          if (version !== this.loadVersion) return
          const separator = key.indexOf('-')
          const resourcetype = separator === -1 ? key : key.slice(0, separator)
          const tag = separator === -1 ? undefined : key.slice(separator + 1)
          try {
            await this.updateResourceLimit({ ...scope, resourcetype, max, ...(tag ? { tag } : {}) })
            if (version !== this.loadVersion) return
            this.origValues[key] = max
            success++
          } catch (error) {
            const type = this.resourceTypeIdNames[resourcetype] || ''
            const label = this.$t(type === 'backup' ? 'label.maxbackups' : 'label.max' + type.replace('_', ''))
            const detail = Object.values(error.response?.data || {}).find(value => value?.errortext)?.errortext
            failed.push([label, tag && '#' + tag, detail].filter(Boolean).join(' '))
          }
        }
        if (version !== this.loadVersion) return
        this.saveSummary = { success, failed }
        if (success) this.$emit('refresh')
        if (!failed.length) await this.fetchData()
      } catch (error) {
        if (error.errorFields?.length) this.formRef.value.scrollToField(error.errorFields[0].name)
      } finally {
        if (version === this.loadVersion) this.formLoading = false
      }
    },
    validateTaggedLimitsForUntaggedLimits (values) {
      for (const key in values) {
        const input = values[key]
        if (input === undefined) {
          continue
        }
        if (key.includes('-')) {
          const idx = key.indexOf('-')
          const resourcetype = key.substring(0, idx)
          const tag = key.substring(idx + 1)
          const untaggedInput = values[resourcetype]
          if (untaggedInput >= 0 && untaggedInput < input) {
            var err = this.$t('message.update.resource.limit.max.untagged.error').replace('%x', this.$t('label.max' + this.resourceTypeIdNames[resourcetype].replace('_', '')))
            err = err.replace('%y', untaggedInput).replace('%z', tag)
            this.$notification.error({
              message: this.$t('message.request.failed'),
              description: err
            })
            return false
          }
        }
      }
      return true
    },
    listResourceLimits (params) {
      return new Promise((resolve, reject) => {
        let dataResource = []
        getAPI('listResourceLimits', params).then(json => {
          if (json.listresourcelimitsresponse.resourcelimit) {
            dataResource = json.listresourcelimitsresponse.resourcelimit
            dataResource.sort((a, b) => a.resourcetype - b.resourcetype)
            var taggedResource = dataResource?.filter(x => x.tag !== null && x.tag !== undefined) || []
            dataResource = dataResource?.filter(x => x.tag === null || x.tag === undefined) || []
            for (var untaggedResource of dataResource) {
              var tagged = taggedResource.filter(x => x.resourcetype === untaggedResource.resourcetype) || []
              tagged.sort((a, b) => a.tag.localeCompare(b.tag))
              untaggedResource.taggedresource = tagged
              var tags = _.map(tagged, 'tag')
              untaggedResource.tags = tags
              untaggedResource.tagsasstring = '#' + tags.join(', #')
            }
          }
          resolve(dataResource)
        }).catch(error => {
          reject(error.response?.headers?.['x-description'] || error.message)
        })
      })
    },
    updateResourceLimit (params) {
      return new Promise((resolve, reject) => {
        postAPI('updateResourceLimit', params).then(json => {
          resolve()
        }).catch(error => {
          reject(error)
        })
      })
    },
    handleCollapseChange (type) {
      if (this.collpaseActive[type]) {
        this.collpaseActive[type] = null
        return
      }
      this.collpaseActive[type] = true
    }
  }
}
</script>

<style lang="less" scoped>
  .card-footer {
    button + button {
      margin-left: 8px;
    }
  }
  .account-limit-notice { margin-bottom: 12px; }
  .tagged-limit-collapse {
    margin-top: 10px;
    margin-bottom: 20px;
  }
</style>
