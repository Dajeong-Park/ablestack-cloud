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
    <p v-if="listRefreshFailed" :role="isPrimaryStorage && !hasPrimaryData ? 'alert' : 'status'">
      {{ $t(isPrimaryStorage && !hasPrimaryData ? 'message.primary.storage.browser.load.failed' : 'message.list.refresh.stale') }}
    </p>
    <a-card class="breadcrumb-card">
      <a-row>
        <a-col :span="24" style="padding-left: 12px">
          <a-breadcrumb :routes="getRoutes()">
            <template #itemRender="{ route }">
              <span v-if="['/', ''].includes(route.path) && route.breadcrumbName === 'root'">
                <a @click="openDir('')">
                  <home-outlined/>
                </a>
              </span>
              <span v-else>
                <a @click="openDir(route.path)">
                {{ route.breadcrumbName }}
                </a>
              </span>
            </template>
          </a-breadcrumb>
          </a-col>
          <a-divider/>
          <a-col :span="24" class="storage-browser-toolbar">
            <a-input-search
              v-if="resourceType === 'PrimaryStorage'"
              class="storage-browser-search"
              allowClear
              size="medium"
              v-model:value="keywordDraft"
              :placeholder="$t('label.objectstore.search')"
              :loading="loading"
              @search="searchPrimaryStore"
              :enter-button="$t('label.search')"/>
            <a-button v-if="canImportVolume" class="storage-browser-action" type="primary" @click="openVolumeImport('')">{{ $t('label.creation.source.import') }}</a-button>
            <a-tooltip placement="bottom">
              <template #title>{{ $t('label.refresh') }}</template>
              <a-button
                class="storage-browser-action"
                :loading="loading"
                shape="round"
                size="medium"
                @click="fetchData()"
              >
                <template #icon><ReloadOutlined /></template>
                {{ $t('label.refresh') }}
              </a-button>
            </a-tooltip>
            <template v-if="canCreateRbdImage">
              <a-button
                type="primary"
                class="storage-browser-action"
                shape="round"
                @click="showAddVolModal"
                :loading="loading">
                <template #icon><plus-outlined /></template> {{ $t('label.create.rbd.image') }}
              </a-button>
            </template>
          </a-col>
      </a-row>
      <a-modal
        v-if="canCreateRbdImage"
        :visible="showAddVolumeModal"
        :title="$t('label.create.rbd.image')"
        :maskClosable="false"
        :closable="true"
        :footer="null"
        @cancel="closeModals">
          <CreateRbdImage :resource="resource" @close-action="closeModals" />
      </a-modal>
    </a-card>

    <a-modal v-if="canImportVolume" :visible="showImportVolumeModal" :title="$t('label.creation.source.import')" :footer="null" :mask-closable="false" @cancel="showImportVolumeModal = false">
      <import-storage-volume v-if="showImportVolumeModal" :key="importVolumePath" :resource="resource" :initial-path="importVolumePath" @close-action="showImportVolumeModal = false" />
    </a-modal>

    <a-modal
      :title="$t('message.data.migration')"
      :visible="showMigrateModal"
      :maskClosable="true"
      :confirmLoading="migrateModalLoading"
      @cancel="showMigrateModal = false"
      :footer="null"
      width="50%"
      :okText="$t('label.ok')"
      :cancelText="$t('label.cancel')">
      <div>
        <migrate-image-store-resource
          :sourceImageStore="resource"
          :templateIdsToMigrate="templateIdsToMigrate"
          :snapshotIdsToMigrate="snapshotIdsToMigrate"
          @close-action="showMigrateModal = false"
        />
      </div>
    </a-modal>

    <div v-if="!isPrimaryStorage || !listRefreshFailed || hasPrimaryData">
      <a-table
        :columns="visibleColumns"
        :row-key="record => record.name"
        :data-source="dataSource"
        :pagination="false" >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key == 'name'">
            <template v-if="record.isdirectory">
              <a @click="openDir(`${this.browserPath}${record.name}/`)">
                <folder-outlined /> {{ record.name }}
              </a>
            </template>
            <template v-else-if="resourceType === 'ImageStore'">
              <a @click="downloadFile(record)">
                <template v-if="record.snapshotid">
                  <build-outlined/>
                </template>
                <template v-else-if="record.volumeid">
                    <hdd-outlined/>
                </template>
                <template v-else-if="record.templateid">
                    <usb-outlined v-if="record.format === 'ISO'"/>
                    <save-outlined v-else />
                </template>
                {{ record.name }}
              </a>
            </template>
            <template v-else>
              <template v-if="record.snapshotid">
                  <build-outlined/>
                </template>
                <template v-else-if="record.volumeid">
                    <hdd-outlined/>
                </template>
                <template v-else-if="record.templateid">
                    <usb-outlined v-if="record.format === 'ISO'"/>
                    <save-outlined v-else />
                </template>
                {{ record.name }}
            </template>
          </template>
          <template v-if="column.key == 'size'">
            <template v-if="!record.isdirectory">
            {{ convertBytes(record.size) }}
            </template>
          </template>
          <template v-if="column.key == 'lastupdated'">
            {{ $toLocaleDate(record.lastupdated) }}
          </template>
          <template v-if="column.key == 'associatedResource'">
            <template v-if="record.snapshotid">
              <router-link :to="{ path: '/snapshot/' + record.snapshotid }" target='_blank' >
                {{ record.snapshotname }}
              </router-link>
            </template>
            <template v-else-if="record.volumeid">
              <router-link :to="{ path: '/volume/' + record.volumeid }" target='_blank' >
                {{ record.volumename }}
              </router-link>
            </template>
            <template v-else-if="record.templateid">
              <router-link v-if="record.format === 'ISO'" :to="{ path: '/iso/' + record.templateid }" target='_blank' >
                {{ record.templatename }}
              </router-link>
              <router-link v-else :to="{ path: '/template/' + record.templateid }" target='_blank'>
                {{ record.templatename }}
              </router-link>
            </template>
            <template v-else>
              {{ $t('label.unknown') }}
            </template>
          </template>
          <template v-else-if="column.key === 'actions' && (record.templateid || record.snapshotid)">
              <tooltip-button
              tooltipPlacement="top"
              :tooltip="$t('label.migrate.data.from.image.store')"
              icon="arrows-alt-outlined"
              :copyResource="String(resource.id)"
              @onClick="openMigrationModal(record)" />
            </template>
            <template v-else-if="column.key === 'deleteactions' && eligibleRbdObject(record)">
              <a-col flex="auto">
              <a-tooltip
              v-if="canImportVolume"
              :title="$t('label.action.create.volume')">
                <a-button
                  type="primary"
                  size="medium"
                  shape="circle"
                  @click="openVolumeImport(browserPath + record.name)"
                  :loading="loading">
                <template #icon><plus-outlined /></template>
              </a-button>
            </a-tooltip>
                <a-popconfirm
                  v-if="canDeleteRbdImage"
                  :title="`${$t('label.delete.rbd.image')}?`"
                  @confirm="deleteRbdImage(record)"
                  :okText="$t('label.yes')"
                  :cancelText="$t('label.no')"
                  placement="left">
                <a-tooltip
                :title="$t('label.delete')">
                <a-button
                  type="primary"
                  size="medium"
                  shape="circle"
                  :loading="deletingRbd"
                  danger="true">
                    <template #icon><delete-outlined /></template>
                  </a-button>
                </a-tooltip>
                </a-popconfirm>
              </a-col>
            </template>
          </template>
      </a-table>
      <a-pagination
        class="row-element"
        style="margin-top: 10px"
        size="small"
        :current="page"
        :pageSize="pageSize"
        :total="total"
        :showTotal="total => this.$localStorage.get('LOCALE') == 'ko_KR' ?
          `${$t('label.total')} ${total} ${$t('label.items')} ${$t('label.of')} ${Math.min(total, 1+((page-1)*pageSize))}-${Math.min(page*pageSize, total)} ${$t('label.showing')}` :
          `${$t('label.showing')} ${Math.min(total, 1+((page-1)*pageSize))}-${Math.min(page*pageSize, total)} ${$t('label.of')} ${total} ${$t('label.items')}`"
        :pageSizeOptions="pageSizeOptions"
        @change="changePage"
        @showSizeChange="changePage"
        showSizeChanger>
        <template #buildOptionText="props">
          <span>{{ props.value }} / {{ $t('label.page') }}</span>
        </template>
      </a-pagination>
      <a-modal
        :visible="showAddTypeModal"
        :title="$t('label.volumetype')"
        @cancel="closeModals"
        @ok="createVolume()">
        <div class="title">{{ $t('label.create.type.rbd.image') }}</div>
        <a-form-item ref="volumetype" name="volumetype">
          <a-select v-model:value="volumetype" @change="volumeTypeChange">
            <a-select-option value='ROOT'>{{ $t('label.rootdisk') }}</a-select-option>
            <a-select-option value='DATADISK'>{{ $t('label.data.disk') }}</a-select-option>
          </a-select>
        </a-form-item>
      </a-modal>
    </div>
  </div>

</template>

<script>
import { listRefreshMixin } from '@/utils/listRefreshMixin'

import { getAPI, postAPI } from '@/api'
import { ref, reactive } from 'vue'
import InfoCard from '@/components/view/InfoCard'
import TooltipButton from '@/components/widgets/TooltipButton'
import MigrateImageStoreResource from '@/views/storage/MigrateImageStoreResource'
import CreateRbdImage from '@/views/storage/CreateRbdImage'
import ImportStorageVolume from '@/views/storage/ImportStorageVolume'

function positiveInteger (value, fallback) {
  const number = Number(value)
  return Number.isSafeInteger(number) && number > 0 ? number : fallback
}

function primaryBrowserQuery (query) {
  return {
    browserPath: typeof query.browserPath === 'string' ? query.browserPath : '',
    page: positiveInteger(query.browserPage, 1),
    pageSize: positiveInteger(query.browserPageSize, 10),
    keyword: typeof query.browserKeyword === 'string' ? query.browserKeyword.trim() : ''
  }
}

export default {
  mixins: [listRefreshMixin(['fetchImageStoreObjects', 'fetchPrimaryStoreObjects'], {
    interval: 60000,
    select: vm => vm.resourceType === 'ImageStore' ? ['fetchImageStoreObjects'] : vm.resourceType === 'PrimaryStorage' ? ['fetchPrimaryStoreObjects'] : [],
    // URL normalization must not invalidate a response for the same listing.
    scopeKey: vm => [vm.$route?.path, vm.$store?.state?.user?.token,
      vm.$store?.getters.userInfo?.id, vm.$store?.getters.project?.id,
      vm.resourceType, vm.resource.id, vm.browserPath, vm.page, vm.pageSize, vm.keyword]
  })],
  name: 'StorageBrowser',
  components: {
    InfoCard,
    MigrateImageStoreResource,
    TooltipButton,
    CreateRbdImage,
    ImportStorageVolume
  },
  props: {
    resource: {
      type: Object,
      required: true
    },
    resourceType: {
      type: String,
      required: true
    }
  },
  data () {
    var columns = [
      {
        key: 'name',
        title: this.$t('label.name')
      },
      {
        key: 'size',
        title: this.$t('label.size')
      },
      {
        key: 'lastupdated',
        title: this.$t('label.last.updated')
      },
      {
        key: 'associatedResource',
        title: this.$t('label.associated.resource')
      }
    ]
    if (this.resourceType === 'ImageStore') {
      columns.push({
        key: 'actions',
        title: this.$t('label.actions')
      })
    }
    if (this.resourceType === 'PrimaryStorage' && this.resource.type === 'RBD') {
      columns.push({
        key: 'deleteactions',
        title: this.$t('label.actions')
      })
    }
    const query = this.$route.query
    const browser = this.resourceType === 'PrimaryStorage' ? primaryBrowserQuery(query) : {
      browserPath: query.browserPath || '',
      page: parseInt(query.browserPage) || 1,
      pageSize: parseInt(query.browserPageSize) || 10,
      keyword: ''
    }
    return {
      loading: false,
      dataSource: [],
      ...browser,
      keywordDraft: browser.keyword,
      hasPrimaryData: false,
      deletingRbd: false,
      total: 0,
      columns: columns,
      migrateModalLoading: false,
      showMigrateModal: false,
      templateIdsToMigrate: [],
      snapshotIdsToMigrate: [],
      showAddVolumeModal: false,
      showImportVolumeModal: false,
      importVolumePath: '',
      showAddTypeModal: false,
      rootSwitch: true,
      dataDiskSwitch: false,
      volumetype: 'ROOT',
      targetName: '',
      targetSize: ''
    }
  },
  computed: {
    isPrimaryStorage () {
      return this.resourceType === 'PrimaryStorage'
    },
    isRbdPool () {
      return this.isPrimaryStorage && this.resource.type === 'RBD'
    },
    canImportVolume () {
      return this.isPrimaryStorage && this.resource.state === 'Up' && this.resource.hypervisor === 'KVM' &&
        ['SharedMountPoint', 'RBD', 'NetworkFilesystem'].includes(this.resource.type) && !!this.$store.getters.apis.importVolume
    },
    canCreateRbdImage () {
      return this.isRbdPool && this.resource.state === 'Up' && !!this.$store.getters.apis.createRbdImage
    },
    canDeleteRbdImage () {
      return this.isRbdPool && this.resource.state === 'Up' && !!this.$store.getters.apis.deleteRbdImage
    },
    visibleColumns () {
      return this.columns.filter(column => column.key !== 'deleteactions' || this.canImportVolume || this.canDeleteRbdImage)
    },
    pageSizeOptions () {
      var sizes = [20, 50, 100, 200, this.$store.getters.defaultListViewPageSize]
      if (this.device !== 'desktop') {
        sizes.unshift(10)
      }
      return [...new Set(sizes)].sort(function (a, b) {
        return a - b
      }).map(String)
    }
  },
  watch: {
    '$route.query' (query) {
      if (!this.isPrimaryStorage || this.$route.params.id !== this.resource.id || query.tab !== 'browser') return
      const next = primaryBrowserQuery(query)
      if (Object.keys(next).every(key => this[key] === next[key])) return
      Object.assign(this, next, { keywordDraft: next.keyword })
      this.fetchPrimaryStoreObjects()
    }
  },
  created () {
    this.initForm()
    this.fetchData()
  },
  methods: {
    eligibleRbdObject (record) {
      return this.isRbdPool && !!record.name && !record.isdirectory && !record.templateid &&
        !record.volumeid && !record.snapshotid && !/MOLD-DR|MOLD-AC|MOLD-HB|ccvm/i.test(record.name)
    },
    openVolumeImport (path) {
      if (!this.canImportVolume) return
      this.importVolumePath = path
      this.showImportVolumeModal = true
    },
    navigatePrimaryBrowser (changes) {
      const state = { browserPath: this.browserPath, page: this.page, pageSize: this.pageSize, keyword: this.keyword, ...changes }
      if (Object.keys(state).every(key => this[key] === state[key])) return this.fetchPrimaryStoreObjects()
      return this.$router.push({
        query: {
          ...this.$route.query,
          tab: 'browser',
          browserPath: state.browserPath || undefined,
          browserPage: String(state.page),
          browserPageSize: String(state.pageSize),
          browserKeyword: state.keyword || undefined
        }
      })
    },
    searchPrimaryStore (keyword) {
      this.keywordDraft = (keyword || '').trim()
      return this.navigatePrimaryBrowser({ keyword: this.keywordDraft, page: 1 })
    },
    initForm () {
      this.formRef = ref()
      this.form = reactive({
      })
      this.rules = reactive({})
    },
    openMigrationModal (record) {
      if (record.snapshotid) {
        this.snapshotIdsToMigrate.push(record.snapshotid)
      } else if (record.templateid) {
        this.templateIdsToMigrate.push(record.templateid)
      }
      this.showMigrateModal = true
    },
    changePage (page, pageSize) {
      if (this.isPrimaryStorage) {
        const size = positiveInteger(pageSize, this.pageSize)
        return this.navigatePrimaryBrowser({ page: size === this.pageSize ? positiveInteger(page, this.page) : 1, pageSize: size })
      }
      this.page = page
      this.pageSize = pageSize
      this.fetchData()
    },
    handleTableChange (pagination, filters, sorter) {
      if (this.isPrimaryStorage) return
      this.page = pagination.current
      this.pageSize = pagination.pageSize
      this.fetchData()
    },
    volumeTypeChange (val) {
      this.volumetype = val
    },
    createVolume () {
      getAPI('listDiskOfferings', { listall: true }).then(json => {
        this.offerings = json.listdiskofferingsresponse.diskoffering || []
        this.customDiskOffering = this.offerings.filter(x => x.iscustomized === true)
        getAPI('createVolume', {
          diskofferingid: this.customDiskOffering[0].id,
          size: this.targetSize / (1024 * 1024 * 1024),
          name: this.targetName,
          zoneid: this.resource.zoneid
        }).then(response => {
          this.$pollJob({
            jobId: response.createvolumeresponse.jobid,
            title: this.$t('message.success.create.volume'),
            successMessage: this.$t('message.success.create.volume'),
            successMethod: (result) => {
              getAPI('updateVolume', {
                id: result.jobresult.volume.id,
                path: this.targetName,
                storageid: this.resource.id,
                state: 'Ready',
                type: this.volumetype
              }).then(json => {
              }).catch(error => {
                this.$notifyError(error)
              }).finally(() => {
                this.fetchData()
                this.loading = false
              })
            },
            errorMessage: this.$t('message.create.volume.failed'),
            loadingMessage: this.$t('message.create.volume.processing'),
            catchMessage: this.$t('error.fetching.async.job.result')
          })
        }).catch(error => {
          this.$notifyError(error)
        })
      }).catch(error => {
        this.$notifyError(error)
      })
    },
    async deleteRbdImage (record) {
      if (!this.canDeleteRbdImage || !this.eligibleRbdObject(record) || this.deletingRbd) return
      const id = this.resource.id
      this.deletingRbd = true
      try {
        await postAPI('deleteRbdImage', { name: record.name, id }, { preserveOnFailure: true })
        if (this.resource.id === id) await this.fetchPrimaryStoreObjects()
      } catch (error) {
        this.$notifyError(error)
      } finally {
        this.deletingRbd = false
      }
    },
    fetchImageStoreObjects () {
      const listRequest = this.listRequestToken('fetchImageStoreObjects')
      this.loading = !listRequest.loaded
      return getAPI('listImageStoreObjects', {
        path: this.browserPath,
        id: this.resource.id,
        page: this.page,
        pagesize: this.pageSize
      }).then(json => {
        if (!this.isListRequestCurrent('fetchImageStoreObjects', listRequest)) return

        this.dataSource = json.listimagestoreobjectsresponse.datastoreobject || []
        this.total = json.listimagestoreobjectsresponse.count || 0
      }).finally(() => {
        if (!this.isListRequestCurrent('fetchImageStoreObjects', listRequest)) return

        this.loading = false
      }).catch(error => {
        if (!this.isListRequestCurrent('fetchImageStoreObjects', listRequest)) return
        listRequest.failed = true
        this.listRefreshFailed = true
        if (!listRequest.loaded) this.$notifyError(error)
      }).finally(() => {
        if (!this.isListRequestCurrent('fetchImageStoreObjects', listRequest)) return
        this.loading = false
      })
    },
    async fetchPrimaryStoreObjects () {
      if (!this.$store.getters.apis.listStoragePoolObjects || !this.resource.id) return
      const listRequest = this.listRequestToken('fetchPrimaryStoreObjects')
      this.loading = !listRequest.loaded
      if (!listRequest.loaded) {
        this.hasPrimaryData = false
        this.dataSource = []
        this.total = 0
        this.listRefreshFailed = false
      }
      try {
        const json = await getAPI('listStoragePoolObjects', {
          path: this.browserPath,
          id: this.resource.id,
          page: this.page,
          pagesize: this.pageSize,
          keyword: this.keyword
        }, { preserveOnFailure: true })
        if (!this.isListRequestCurrent('fetchPrimaryStoreObjects', listRequest)) return
        this.dataSource = json.liststoragepoolobjectsresponse.datastoreobject || []
        this.total = json.liststoragepoolobjectsresponse.count || 0
        this.hasPrimaryData = true
      } catch {
        if (!this.isListRequestCurrent('fetchPrimaryStoreObjects', listRequest)) return
        listRequest.failed = true
        this.listRefreshFailed = true
      } finally {
        if (this.isListRequestCurrent('fetchPrimaryStoreObjects', listRequest)) this.loading = false
      }
    },
    deleteDetail (index) {
      this.details.splice(index, 1)
      this.runApi()
    },
    showAddVolModal () {
      if (this.canCreateRbdImage) this.showAddVolumeModal = true
    },
    showAddTyModal (name, size) {
      this.showAddTypeModal = true
      this.targetName = name
      this.targetSize = size
    },
    closeModals () {
      this.showAddVolumeModal = false
      this.showAddTypeModal = false
      this.fetchData()
    },
    fetchData () {
      if (this.isPrimaryStorage) return this.fetchPrimaryStoreObjects()
      this.$router.replace(
        {
          path: this.$route.path,
          query: {
            ...this.$route.query,
            browserPath: this.browserPath,
            browserPage: this.page,
            browserPageSize: this.pageSize
          }
        }
      )
      if (this.resourceType === 'ImageStore') {
        this.fetchImageStoreObjects()
      }
    },
    getRoutes () {
      let path = ''
      const routeList = [{
        path: path,
        breadcrumbName: 'root'
      }]
      for (const route of this.browserPath.split('/')) {
        if (route) {
          path = `${path}${route}/`
          routeList.push({
            path: path,
            breadcrumbName: route
          })
        }
      }
      return routeList
    },
    convertBytes (val) {
      if (val < 1024 * 1024) return `${(val / 1024).toFixed(2)} KB`
      if (val < 1024 * 1024 * 1024) return `${(val / 1024 / 1024).toFixed(2)} MB`
      if (val < 1024 * 1024 * 1024 * 1024) return `${(val / 1024 / 1024 / 1024).toFixed(2)} GB`
      if (val < 1024 * 1024 * 1024 * 1024 * 1024) return `${(val / 1024 / 1024 / 1024 / 1024).toFixed(2)} TB`
      return val
    },
    openDir (name) {
      if (this.isPrimaryStorage) return this.navigatePrimaryBrowser({ browserPath: name, page: 1 })
      this.browserPath = name
      this.page = 1
      this.pageSize = 10
      this.fetchData()
    },
    downloadFile (record) {
      this.loading = true
      const params = {
        id: this.resource.id,
        path: `${this.browserPath}${record.name}`
      }
      postAPI('downloadImageStoreObject', params).then(response => {
        const jobId = response.downloadimagestoreobjectresponse.jobid
        this.$pollJob({
          jobId: jobId,
          successMethod: (result) => {
            const url = result.jobresult.downloadimagestoreobjectresponse.url
            const name = result.jobresult.downloadimagestoreobjectresponse.name
            var elem = window.document.createElement('a')
            elem.setAttribute('href', new URL(url))
            elem.setAttribute('download', name)
            elem.setAttribute('target', '_blank')
            document.body.appendChild(elem)
            elem.click()
            document.body.removeChild(elem)
            this.loading = false
          },
          errorMethod: () => {
            this.loading = false
          },
          catchMessage: this.$t('error.fetching.async.job.result'),
          catchMethod: () => {
            this.loading = false
          }
        })
      }).catch(error => {
        console.error(error)
        this.$message.error(error)
        this.loading = false
      })
    }
  }
}
</script>

<style scoped>
.storage-browser-toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.storage-browser-search {
  flex: 1 1 240px;
  min-width: 0;
}

.storage-browser-action {
  flex-shrink: 0;
}
</style>
