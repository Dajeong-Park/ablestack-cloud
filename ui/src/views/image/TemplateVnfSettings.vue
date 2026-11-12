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
  <div>
    <a-divider/>

    <div class="title">
      <div class="form__label">
        <tooltip-label :title="$t('label.vnf.nics')" :tooltip="apiParams.vnfnics.description"/>
      </div>
    </div>
    <div>
      <a-button
        type="dashed"
        style="width: 100%"
        :disabled="updateBusy || !('updateVnfTemplate' in $store.getters.apis && isAdminOrOwner())"
        @click="onShowAddVnfNic">
        <template #icon><plus-outlined /></template>
        {{ $t('label.vnf.nic.add') }}
      </a-button>
    </div>

    <a-table
      size="small"
      style="overflow-y: auto"
      :loading="loading"
      :columns="columns"
      :dataSource="vnfNics"
      :pagination="false"
      :rowKey="record => record.deviceid">
      <template #deviceid="{record}">
        <span> {{ record.deviceid }} </span>
      </template>
      <template #name="{record}">
        <span> {{ record.name }} </span>
      </template>
      <template #required="{ record }">
        <span v-if="record.required">{{ $t('label.yes') }}</span>
        <span v-else>{{ $t('label.no') }}</span>
      </template>
      <template #management="{ record }">
        <span v-if="record.management">{{ $t('label.yes') }}</span>
        <span v-else>{{ $t('label.no') }}</span>
      </template>
      <template #description="{record}">
        <span> {{ record.description }} </span>
      </template>
      <template #actions="{ record }">
        <div class="shift-btns" v-if="'updateVnfTemplate' in $store.getters.apis && isAdminOrOwner()">
          <a-tooltip placement="top">
            <template #title>{{ $t('label.vnf.nic.edit') }}</template>
            <a-button shape="round" :disabled="updateBusy" @click="onShowEditVnfNic(record, $event)" class="shift-btn">
              <EditOutlined class="shift-btn" />
            </a-button>
          </a-tooltip>
          <a-tooltip placement="top">
            <template #title>{{ $t('label.move.up.row') }}</template>
            <a-button shape="round" :disabled="updateBusy" @click="moveVnfNicUp(record)" class="shift-btn">
              <CaretUpOutlined class="shift-btn" />
            </a-button>
          </a-tooltip>
          <a-tooltip placement="top">
            <template #title>{{ $t('label.move.down.row') }}</template>
            <a-button shape="round" :disabled="updateBusy" @click="moveVnfNicDown(record)" class="shift-btn">
              <CaretDownOutlined class="shift-btn" />
            </a-button>
          </a-tooltip>
          <a-popconfirm
            :disabled="updateBusy"
            :title="$t('label.vnf.nic.delete') + '?'"
            @confirm="deleteVnfNic(record)"
            :okText="$t('label.yes')"
            :cancelText="$t('label.no')"
          >
            <template #title>{{ $t('label.vnf.nic.delete') }}</template>
            <a-button shape="round" :disabled="updateBusy" class="shift-btn" :danger="true" type="primary">
              <DeleteOutlined class="shift-btn" />
            </a-button>
          </a-popconfirm>
        </div>
      </template>
    </a-table>

    <MoldDialog
      class="vnf-template-nic-dialog"
      size="md"
      focus-guard
      :visible="showAddVnfNic || showEditVnfNic"
      :title="$t(showEditVnfNic ? 'label.vnf.nic.edit' : 'label.vnf.nic.add')"
      :closable="!updateBusy"
      :keyboard="!updateBusy"
      :focus-trigger-after-close="false"
      :destroy-on-close="true"
      :after-close="afterVnfNicClose"
      @cancel="closeVnfNicModal">
      <dl class="vnf-nic-context">
        <dt>{{ $t('label.template') }}</dt><dd>{{ resource.name }}</dd>
        <dt>{{ $t(resource.projectid ? 'label.project' : 'label.account') }}</dt><dd>{{ resource.project || resource.account }}</dd>
        <dt>{{ $t('label.domain') }}</dt><dd>{{ resource.domain }}</dd>
      </dl>
      <a-form layout="vertical" class="vnf-nic-fields" @keydown.ctrl.enter.stop.prevent="submitVnfNic">
        <a-form-item :label="$t('label.deviceid')" :html-for="'vnf-nic-deviceid'" required :extra="$t('label.vnf.nic.deviceid')">
          <a-input id="vnf-nic-deviceid" v-model:value="nicDraft.deviceid" type="number" min="0" step="1" :disabled="showEditVnfNic || updateBusy" v-focus="true" />
        </a-form-item>
        <a-form-item :label="$t('label.name')" :html-for="'vnf-nic-name'" required :extra="$t('label.vnf.nic.name')">
          <a-input id="vnf-nic-name" v-model:value="nicDraft.name" :disabled="updateBusy" v-focus="showEditVnfNic" />
        </a-form-item>
        <a-form-item :label="$t('label.required')" :html-for="'vnf-nic-required'" :extra="$t('label.vnf.nic.required')">
          <a-switch id="vnf-nic-required" :aria-label="$t('label.required')" v-model:checked="nicDraft.required" :disabled="updateBusy" />
        </a-form-item>
        <a-form-item :label="$t('label.vnf.nic.management')" :html-for="'vnf-nic-management'" :extra="$t('label.vnf.nic.management.description')">
          <a-switch id="vnf-nic-management" :aria-label="$t('label.vnf.nic.management')" v-model:checked="nicDraft.management" :disabled="updateBusy" />
        </a-form-item>
        <a-form-item :label="$t('label.description')" :html-for="'vnf-nic-description'">
          <a-textarea id="vnf-nic-description" v-model:value="nicDraft.description" :rows="2" :disabled="updateBusy" />
        </a-form-item>
        <a-alert v-if="nicError" type="error" show-icon role="alert" :message="nicError" />
      </a-form>
      <template #footer>
        <a-button :disabled="updateBusy" @click="closeVnfNicModal">{{ $t('label.cancel') }}</a-button>
        <a-button type="primary" :loading="updateBusy" :disabled="updateBusy" @click="submitVnfNic">{{ $t('label.ok') }}</a-button>
      </template>
    </MoldDialog>

    <a-divider/>
    <div class="title">
      <div class="form__label">
        <tooltip-label :title="$t('label.vnf.details')" :tooltip="apiParams.vnfdetails.description"/>
      </div>
    </div>
    <div v-show="!showAddVnfDetail">
      <a-button
        type="dashed"
        style="width: 100%"
        :disabled="updateBusy || !('updateVnfTemplate' in $store.getters.apis && isAdminOrOwner())"
        @click="onShowAddVnfDetail">
        <template #icon><plus-outlined /></template>
        {{ $t('label.vnf.detail.add') }}
      </a-button>
    </div>

    <div v-show="showAddVnfDetail">
      <a-input-group
        type="text"
        compact>
        <a-auto-complete
          class="detail-input"
          ref="keyElm"
          :filterOption="filterOption"
          v-model:value="newKey"
          :options="detailKeys"
          :placeholder="$t('label.name')" />
        <a-input
          class="tag-disabled-input"
          style=" width: 30px; border-left: 0; pointer-events: none; text-align: center"
          placeholder="="
          disabled />
        <a-select
          v-if="newKey === 'access_methods'"
          class="detail-input"
          v-model:value="newValues"
          mode="multiple"
          :placeholder="$t('label.value')"
          :filterOption="filterOption">
          <a-select-option v-for="opt in detailValues" :key="opt.value" :label="opt.value">
              <span>
                {{ opt.value }}
              </span>
          </a-select-option>
        </a-select>
        <a-input
          v-else
          class="detail-input"
          :filterOption="filterOption"
          v-model:value="newValue"
          :options="detailValues"
          :placeholder="$t('label.value')" />
        <tooltip-button :tooltip="$t('label.add.setting')" :shape="null" icon="check-outlined" @onClick="addVnfDetail" buttonClass="detail-button" />
        <tooltip-button :tooltip="$t('label.cancel')" :shape="null" icon="close-outlined" @onClick="closeVnfDetail" buttonClass="detail-button" />
      </a-input-group>
      <p v-if="error" style="color: red"> {{ $t(error) }} </p>
    </div>

    <a-list size="large">
      <a-list-item :key="index" v-for="(item, index) in vnfDetails">
        <a-list-item-meta>
          <template #title>
            {{ item.name }}
          </template>
          <template #description>
            <div v-if="item.edit" style="display: flex">
              <a-select
                v-if="item.name === 'access_methods'"
                class="detail-input"
                v-model:value="item.values"
                mode="multiple"
                :placeholder="$t('label.value')"
                :filterOption="filterOption">
                <a-select-option v-for="opt in getEditDetailOptions(vnfDetailOptions[item.name])" :key="opt.value" :label="opt.value">
                  <span>
                    {{ opt.value }}
                  </span>
                </a-select-option>
              </a-select>
              <a-auto-complete
                v-else
                style="width: 100%"
                v-model:value="item.displayvalue"
                :options="getEditDetailOptions(vnfDetailOptions[item.name])"
                @change="val => handleInputChange(val, index)"
                @pressEnter="e => updateVnfDetail(index)" />
              <tooltip-button
                buttonClass="edit-button"
                :tooltip="$t('label.cancel')"
                @onClick="hideEditVnfDetail(index)"
                v-if="item.edit"
                iconType="close-circle-two-tone"
                iconTwoToneColor="#f5222d" />
              <tooltip-button
                buttonClass="edit-button"
                :tooltip="$t('label.ok')"
                @onClick="updateVnfDetail(index)"
                v-if="item.edit"
                iconType="check-circle-two-tone"
                iconTwoToneColor="#52c41a" />
            </div>
            <span v-else style="word-break: break-all">{{ item.displayvalue }}</span>
          </template>
        </a-list-item-meta>
        <template #actions>
          <div
            v-if="'updateVnfTemplate' in $store.getters.apis && isAdminOrOwner()">
            <tooltip-button
              :tooltip="$t('label.edit')"
              icon="edit-outlined"
              @onClick="showEditVnfDetail(index)" />
          </div>
          <div
            v-if="'updateVnfTemplate' in $store.getters.apis && isAdminOrOwner()">
            <a-popconfirm
              :title="`${$t('label.delete.setting')}?`"
              @confirm="deleteVnfDetail(index)"
              :okText="$t('label.yes')"
              :cancelText="$t('label.no')"
              placement="left"
            >
              <tooltip-button :tooltip="$t('label.delete')" type="primary" :danger="true" icon="delete-outlined" />
            </a-popconfirm>
          </div>
        </template>
      </a-list-item>
    </a-list>
  </div>
</template>

<script>
import { ref, reactive } from 'vue'
import { getAPI, postAPI } from '@/api'
import Status from '@/components/widgets/Status'
import MoldDialog from '@/components/view/MoldDialog'
import TooltipButton from '@/components/widgets/TooltipButton'
import TooltipLabel from '@/components/widgets/TooltipLabel'

export default {
  name: 'TemplateVnfSettings',
  components: {
    MoldDialog,
    TooltipButton,
    TooltipLabel,
    Status
  },
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
      updateBusy: false,
      updateSequence: 0,
      nicError: '',
      resourceType: 'VnfTemplate',
      vnfDetailOptions: {},
      columns: [],
      vnfNics: [],
      previousVnfNics: [],
      showAddVnfNic: false,
      showEditVnfNic: false,
      nicDraft: { deviceid: null, name: '', required: true, management: false, description: '' },
      vnfDetails: [],
      previousVnfDetails: [],
      showAddVnfDetail: false,
      newKey: '',
      newValue: '',
      newValues: [],
      error: false
    }
  },
  beforeCreate () {
    this.apiParams = this.$getApiParams('updateVnfTemplate')
  },
  computed: {
    nicScope () {
      const { project, userInfo } = this.$store.getters
      return JSON.stringify([this.resource.id, project?.id, userInfo?.id, userInfo?.roleid,
        this.$store.state?.user?.token, this.$route?.fullPath])
    },
    detailKeys () {
      return Object.keys(this.vnfDetailOptions).map(key => {
        return { value: key }
      })
    },
    detailValues () {
      if (!this.newKey) {
        return []
      }
      if (!Array.isArray(this.vnfDetailOptions[this.newKey])) {
        if (this.vnfDetailOptions[this.newKey]) {
          return { value: this.vnfDetailOptions[this.newKey] }
        } else {
          return ''
        }
      }
      return this.vnfDetailOptions[this.newKey].map(value => {
        return { value: value }
      })
    }
  },
  created () {
    this.columns = [
      {
        title: this.$t('label.deviceid'),
        dataIndex: 'deviceid',
        slots: { customRender: 'deviceid' }
      },
      {
        title: this.$t('label.name'),
        dataIndex: 'name'
      },
      {
        title: this.$t('label.required'),
        dataIndex: 'required',
        slots: { customRender: 'required' }
      },
      {
        title: this.$t('label.vnf.nic.management'),
        dataIndex: 'management',
        slots: { customRender: 'management' }
      },
      {
        title: this.$t('label.description'),
        dataIndex: 'description',
        slots: { customRender: 'description' }
      },
      {
        title: this.$t('label.action'),
        slots: { customRender: 'actions' }
      }
    ]
    this.columns.push({
      title: '',
      dataIndex: 'action',
      width: 100,
      slots: { customRender: 'action' }
    })

    const userInfo = this.$store.getters.userInfo
    if (!['Admin'].includes(userInfo.roletype) &&
      (userInfo.account !== this.resource.account || userInfo.domain !== this.resource.domain)) {
      this.columns = this.columns.filter(col => { return col.dataIndex !== 'status' })
    }
    this.initForm()
    this.fetchData()
  },
  beforeUnmount () {
    this.updateSequence++
    this.nicTrigger = null
  },
  watch: {
    nicScope () {
      this.updateSequence++
      this.updateBusy = false
      this.showAddVnfNic = this.showEditVnfNic = false
      this.nicTrigger = null
      this.resetNicDraft()
      this.initForm()
      this.fetchData()
    },
    loading (newData, oldData) {
      if (!newData && !this.showGroupActionModal) {
        this.fetchData()
      }
    }
  },
  methods: {
    initForm () {
      this.formRef = ref()
      this.form = reactive({})
      this.rules = reactive({
        zoneid: [{ type: 'array', required: true, message: this.$t('message.error.select') }]
      })
      this.previousVnfNics = this.resource.vnfnics?.slice() || []
      this.previousVnfDetails = []
      if (this.resource.vnfdetails) {
        this.previousVnfDetails = Object.keys(this.resource.vnfdetails).map(k => {
          return {
            name: k,
            value: this.resource.vnfdetails[k],
            displayvalue: this.getDisplayValue(k, this.resource.vnfdetails[k]),
            values: k === 'access_methods' ? this.resource.vnfdetails[k].split(',') : null,
            edit: false
          }
        })
      }
      getAPI('listDetailOptions', { resourcetype: this.resourceType }).then(json => {
        this.vnfDetailOptionsInApi = json.listdetailoptionsresponse.detailoptions.details
        this.vnfDetailOptions = {}
        Object.keys(this.vnfDetailOptionsInApi).sort().forEach(k => {
          this.vnfDetailOptions[k] = this.vnfDetailOptionsInApi[k]
        })
      })
    },
    fetchData () {
      this.vnfNics = this.previousVnfNics.slice() || []
      this.vnfDetails = this.previousVnfDetails.slice() || []
    },
    isAdminOrOwner () {
      return ['Admin'].includes(this.$store.getters.userInfo.roletype) ||
        (this.resource.domainid === this.$store.getters.userInfo.domainid && this.resource.account === this.$store.getters.userInfo.account) ||
        this.resource.project && this.resource.projectid === this.$store.getters.project.id
    },
    resetNicDraft () {
      this.nicDraft = { deviceid: null, name: '', required: true, management: false, description: '' }
      this.nicError = ''
    },
    onShowAddVnfNic (event) {
      if (this.updateBusy || this.showAddVnfNic || this.showEditVnfNic) return
      this.resetNicDraft()
      this.nicTrigger = event?.currentTarget
      this.showAddVnfNic = true
    },
    submitVnfNic () {
      return this.showEditVnfNic ? this.editVnfNic() : this.addVnfNic()
    },
    filterOption (input, option) {
      return (
        option.value.toUpperCase().indexOf(input.toUpperCase()) >= 0
      )
    },
    validNicDraft () {
      const id = Number(this.nicDraft.deviceid)
      const valid = this.nicDraft.deviceid !== null && String(this.nicDraft.deviceid).trim() !== '' &&
        Number.isInteger(id) && id >= 0 && this.nicDraft.name?.trim() &&
        (this.showEditVnfNic || !this.vnfNics.some(n => Number(n.deviceid) === id))
      this.nicError = valid ? '' : this.$t('message.please.enter.valid.value')
      return valid
    },
    addVnfNic () {
      if (!this.showAddVnfNic || this.updateBusy || !this.validNicDraft()) return
      return this.updateVnfTemplateNics([...this.vnfNics, { ...this.nicDraft, deviceid: Number(this.nicDraft.deviceid), name: this.nicDraft.name.trim() }])
    },
    deleteVnfNic (record) {
      if (this.updateBusy) return
      return this.updateVnfTemplateNics(this.vnfNics.filter(n => n.deviceid !== record.deviceid))
    },
    onShowEditVnfNic (record, event) {
      if (this.updateBusy || this.showAddVnfNic || this.showEditVnfNic) return
      this.nicError = ''
      this.nicDraft = { ...record }
      this.nicTrigger = event?.currentTarget
      this.showEditVnfNic = true
    },
    getEditDetailOptions (values) {
      if (!values) {
        return
      }
      var data = values.map(value => { return { value: value } })
      return data
    },
    editVnfNic () {
      if (!this.showEditVnfNic || this.updateBusy || !this.validNicDraft()) return
      const draft = { ...this.nicDraft, name: this.nicDraft.name.trim() }
      return this.updateVnfTemplateNics(this.vnfNics.map(n => n.deviceid === draft.deviceid ? draft : { ...n }))
    },
    moveVnfNicUp (record) { return this.moveVnfNic(record, -1) },
    moveVnfNicDown (record) { return this.moveVnfNic(record, 1) },
    moveVnfNic (record, direction) {
      if (this.updateBusy) return
      const rows = this.vnfNics.map(n => ({ ...n }))
      const current = rows.find(n => n.deviceid === record.deviceid)
      const other = rows.find(n => n.deviceid === record.deviceid + direction)
      if (!current || !other) {
        this.$notification.error({ message: this.$t('message.request.failed'), description: this.$t(direction < 0 ? 'message.vnf.nic.move.up.fail' : 'message.vnf.nic.move.down.fail') })
        return
      }
      const required = current.required
      current.deviceid += direction
      other.deviceid -= direction
      current.required = other.required
      other.required = required
      return this.updateVnfTemplateNics(rows)
    },
    updateVnfTemplateDetails () {
      this.updateVnfTemplate(true, false)
    },
    updateVnfTemplateNics (nics = this.vnfNics) {
      return this.updateVnfTemplate(false, true, nics)
    },
    updateVnfTemplate (areDetailsChanged, areNicsChanged, nics = this.vnfNics) {
      if (this.updateBusy) return
      const scope = this.nicScope
      const sequence = ++this.updateSequence
      const current = () => this.nicScope === scope && sequence === this.updateSequence
      const apiName = 'updateVnfTemplate'
      if (!(apiName in this.$store.getters.apis) || !this.isAdminOrOwner()) {
        this.$notification.error({
          message: this.$t('error.execute.api.failed') + ' ' + apiName,
          description: this.$t('message.user.not.permitted.api')
        })
        return
      }

      const params = { id: this.resource.id }
      if (areDetailsChanged) {
        if (this.vnfDetails.length === 0) {
          params.cleanupvnfdetails = true
        } else {
          this.vnfDetails.forEach(function (item, index) {
            params['vnfdetails[0].' + item.name] = item.value
          })
        }
      }

      if (areNicsChanged) {
        let i = 0
        if (nics.length === 0) {
          params.cleanupvnfnics = true
        }
        for (var index = 0; index < nics.length; index++) {
          var nic = nics[index]
          params['vnfnics[' + i + '].deviceid'] = nic.deviceid
          params['vnfnics[' + i + '].name'] = nic.name
          params['vnfnics[' + i + '].required'] = nic.required
          params['vnfnics[' + i + '].management'] = nic.management
          params['vnfnics[' + i + '].description'] = nic.description
          i++
        }
      }

      this.updateBusy = true
      return postAPI(apiName, params).then(json => {
        if (!current()) return

        this.vnfNics = json.updatetemplateresponse.template.vnfnics || []
        const details = json.updatetemplateresponse.template.vnfdetails || []
        this.vnfDetails = Object.keys(details).map(k => {
          return {
            name: k,
            value: details[k],
            displayvalue: this.getDisplayValue(k, details[k]),
            values: k === 'access_methods' ? details[k].split(',') : null,
            edit: false
          }
        })
        this.previousVnfNics = this.vnfNics.slice()
        this.previousVnfDetails = this.vnfDetails.slice()
        this.closeVnfDetail()
        this.closeVnfNicModal(true)
        return true
      }).catch(error => {
        if (!current()) return
        this.nicError = this.$t('message.request.failed')
        this.$notifyError(error)
        this.fetchData()
        return false
      }).finally(() => {
        if (current()) this.updateBusy = false
      })
    },
    getDisplayValue (name, value) {
      return name.includes('password') ? '********' : value
    },
    showEditVnfDetail (index) {
      this.vnfDetails[index].edit = true
      this.vnfDetails[index].originalValue = this.vnfDetails[index].value
    },
    hideEditVnfDetail (index) {
      this.vnfDetails[index].edit = false
      this.vnfDetails[index].value = this.vnfDetails[index].originalValue
    },
    handleInputChange (val, index) {
      this.vnfDetails[index].value = val
    },
    updateVnfDetail (index) {
      if (Array.isArray(this.vnfDetails[index].values) && this.vnfDetails[index].values.length > 0) {
        this.vnfDetails[index].value = this.vnfDetails[index].values.join(',')
      } else {
        this.vnfDetails[index].value = this.vnfDetails[index].displayvalue
      }
      this.vnfDetails[index].displayvalue = this.getDisplayValue(this.vnfDetails[index].name, this.vnfDetails[index].value)
      this.updateVnfTemplateDetails()
    },
    onShowAddVnfDetail () {
      this.showAddVnfDetail = true
      setTimeout(() => {
        this.$refs.keyElm.focus()
      })
    },
    addVnfDetail () {
      if (this.newKey === '' || (this.newValue === '' && this.newValues.length === 0)) {
        this.error = this.$t('message.error.provide.setting')
        return
      }
      this.error = false
      this.newValueString = ''
      if (this.newValues.length > 0) {
        this.newValueString = this.newValues.join(',')
      } else {
        this.newValueString = this.newValue
      }
      this.vnfDetails.push({ name: this.newKey, value: this.newValueString })
      this.updateVnfTemplateDetails()
    },
    deleteVnfDetail (index) {
      this.vnfDetails.splice(index, 1)
      this.updateVnfTemplateDetails()
    },
    closeVnfDetail () {
      this.newKey = ''
      this.newValue = ''
      this.newValues = []
      this.error = false
      this.showAddVnfDetail = false
    },
    closeVnfNicModal (completed = false) {
      if (this.updateBusy && completed !== true) return
      this.showAddVnfNic = false
      this.showEditVnfNic = false
    },
    afterVnfNicClose () {
      if (this.showAddVnfNic || this.showEditVnfNic) return
      this.resetNicDraft()
      if (this.nicTrigger?.isConnected) this.nicTrigger.focus({ preventScroll: true })
      this.nicTrigger = null
    }
  }
}
</script>

<style lang="less" scoped>
.row-element {
  margin-top: 15px;
  margin-bottom: 15px;
}

.detail-input {
  width: calc(calc(100% / 2) - 45px);
}

.detail-button {
  width: 30px;
}

.shift-btns {
  display: flex;
}

.shift-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  font-size: 12px;

  &:not(:last-child) {
    margin-right: 5px;
  }

  &--rotated {
    font-size: 10px;
    transform: rotate(90deg);
  }
}

.vnf-nic-context {
  display: grid;
  grid-template-columns: minmax(90px, auto) minmax(0, 1fr);
  gap: 8px 16px;
  margin: 0 0 24px;
  dt { font-weight: 600; }
  dd { margin: 0; overflow-wrap: anywhere; }
}
.vnf-nic-fields :deep(.ant-form-item) { margin-bottom: 16px; }
</style>
