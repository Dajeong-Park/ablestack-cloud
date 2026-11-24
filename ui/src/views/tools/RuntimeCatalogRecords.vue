<!-- Licensed under the Apache License, Version 2.0. See the NOTICE file. -->
<template>
  <div class="runtime-catalog-records">
    <a-space class="catalog-toolbar" wrap>
      <a-button :loading="busy" @click="load()"><template #icon><ReloadOutlined /></template>{{ $t('label.refresh') }}</a-button>
    </a-space>
    <a-alert v-if="error" type="error" show-icon :message="$t('message.runtime.catalog.records.load.failed')">
      <template #description>
        <a-space wrap>
          <span v-if="hasSuccessfulRead">{{ $t('message.runtime.catalog.records.previous.result') }}</span>
          <a-button size="small" :loading="busy" @click="load()">{{ $t('label.retry') }}</a-button>
        </a-space>
      </template>
    </a-alert>
    <a-alert
      v-if="tab === 'runtime.usages' && hasSuccessfulRead && !error"
      :type="total ? 'warning' : 'info'"
      show-icon
      :message="$t(total ? 'message.runtime.catalog.used' : 'message.runtime.catalog.unused')" />
    <a-table
      v-if="hasSuccessfulRead || busy"
      :columns="columns"
      :data-source="rows"
      row-key="id"
      :loading="busy && !hasSuccessfulRead"
      :pagination="false"
      :scroll="{ x: 700 }"
      size="small">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'state'"><a-tag>{{ record.state }}</a-tag></template>
        <template v-else-if="column.key === 'target'">
          <router-link v-if="record.sharedfilesystemid" :to="'/sharedfs/' + record.sharedfilesystemid + '?tab=runtime'">{{ record.name }}</router-link>
          <router-link v-else-if="record.vmid" :to="'/vm/' + record.vmid">{{ record.name }}</router-link><span v-else>{{ record.name }}</span>
        </template>
        <template v-else-if="column.key === 'view'"><a-button size="small" @click="detail = record">{{ $t('label.details') }}</a-button></template>
      </template>
    </a-table>
    <a-pagination v-if="total > 0" :current="page" :page-size="pagesize" :total="total" :disabled="busy" show-size-changer @change="changePage" />
    <MoldDialog class="sharedfs-standard-dialog" v-if="detail" :visible="true" :title="$t('label.details')" size="lg" @cancel="detail = null">
      <a-descriptions bordered size="small" :column="1">
        <a-descriptions-item v-for="field in ['requestid','state','phase','compatibility','errorcode','errormessage','reason','created','completed']" :key="field" :label="$t('label.' + field)">{{ detail[field] || '-' }}</a-descriptions-item>
      </a-descriptions>
      <pre>{{ pretty(detail.detailsjson) }}</pre>
    </MoldDialog>
  </div>
</template>
<script>
import SharedFSTablePagination from '@/components/storage/SharedFSTablePagination.vue'
import SharedFSTable from '@/components/storage/SharedFSTable.vue'
import { getAPI } from '@/api'
import { ReloadOutlined } from '@ant-design/icons-vue'
import MoldDialog from '@/components/view/MoldDialog'

const recordApis = {
  'runtime.validations': 'listStorageServiceRuntimeBundleValidations',
  'runtime.usages': 'listStorageServiceRuntimeBundleUsages',
  'runtime.events': 'listStorageServiceRuntimeBundleEvents'
}

export default {
  name: 'RuntimeCatalogRecords',
  components: { APagination: SharedFSTablePagination, ATable: SharedFSTable, MoldDialog, ReloadOutlined },
  props: {
    resource: { type: Object, required: true },
    tab: { type: String, required: true },
    active: { type: Boolean, default: true }
  },
  data () { return { rows: [], total: 0, page: 1, pagesize: 10, busy: false, hasSuccessfulRead: false, error: false, epoch: 0, detail: null } },
  computed: {
    scope () { return this.resource.id + ':' + this.tab },
    columns () {
      const names = this.tab === 'runtime.usages' ? ['type', 'target', 'state', 'created'] : this.tab === 'runtime.events' ? ['created', 'action', 'state', 'reason', 'revision', 'view'] : ['created', 'state', 'compatibility', 'errorcode', 'view']
      return names.map(key => ({ key, dataIndex: key, title: this.$t('label.' + (key === 'target' ? 'resource' : key === 'view' ? 'details' : key)), width: key === 'target' || key === 'reason' ? 280 : 150 }))
    }
  },
  watch: {
    scope: 'resetScope',
    active (active) {
      if (active) {
        if (!this.hasSuccessfulRead) this.load()
      } else {
        this.epoch++
        this.busy = false
        this.detail = null
      }
    }
  },
  created () { this.load() },
  beforeUnmount () { this.epoch++ },
  methods: {
    pretty (value) { try { return JSON.stringify(JSON.parse(value || '{}'), null, 2) } catch (_) { return value } },
    changePage (page, size) {
      if (this.page === page && this.pagesize === size) return
      this.detail = null
      this.load(page, size)
    },
    resetScope () {
      this.epoch++
      this.rows = []
      this.total = 0
      this.detail = null
      this.hasSuccessfulRead = false
      this.error = false
      this.busy = false
      this.page = 1
      this.pagesize = 10
      this.load()
    },
    async load (page = this.page, pagesize = this.pagesize) {
      const api = recordApis[this.tab]
      if (!this.active || !api || !this.resource.id || this.busy) return
      this.busy = true
      const epoch = ++this.epoch
      try {
        const response = await getAPI(api, { bundleid: this.resource.id, page, pagesize })
        if (epoch !== this.epoch) return
        const data = response[api.toLowerCase() + 'response']
        if (!data) throw new Error('Missing runtime catalogue records')
        this.rows = data.storageserviceruntimecatalogrecord || []
        this.total = data.count || 0
        this.page = page
        this.pagesize = pagesize
        this.hasSuccessfulRead = true
        this.error = false
      } catch {
        if (epoch === this.epoch) this.error = true
      } finally {
        if (epoch === this.epoch) this.busy = false
      }
    }
  }
}
</script>
<style scoped lang="less">
.catalog-toolbar { display:flex; margin-bottom:16px !important; }
.ant-alert, .ant-descriptions, .ant-pagination { margin-bottom:16px; }
.ant-pagination { margin-top:16px; }
pre { white-space:pre-wrap; overflow-wrap:anywhere; color:var(--ui-text-primary); background:var(--ui-bg-surface); padding:16px; }
</style>
