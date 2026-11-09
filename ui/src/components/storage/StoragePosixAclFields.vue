<!-- Licensed to the Apache Software Foundation (ASF) under one or more
contributor license agreements. See NOTICE. Apache License, Version 2.0. -->
<template>
  <div class="posix-acl-fields">
    <div class="section-heading">{{ $t('label.storage.directory.acl') }}</div>
    <a-alert type="info" show-icon :message="$t('message.storage.directory.acl.scope')" />
    <a-table :columns="observedColumns" :data-source="observedRows" :row-key="r=>r.scope+':'+r.tag+':'+r.id" :pagination="false" size="small" />
    <a-row :gutter="16" class="mask-fields">
      <a-col :span="12"><a-form-item :label="$t('label.storage.directory.acl.access.mask')"><a-select :value="value.accessMask" allow-clear :disabled="disabled" @change="mask('accessMask',$event)"><a-select-option v-for="p in ['---','--x','-w-','-wx','r--','r-x','rw-','rwx']" :key="p" :value="p">{{ p }}</a-select-option></a-select></a-form-item></a-col>
      <a-col :span="12"><a-form-item :label="$t('label.storage.directory.acl.default.mask')"><a-select :value="value.defaultMask" allow-clear :disabled="disabled" @change="mask('defaultMask',$event)"><a-select-option v-for="p in ['---','--x','-w-','-wx','r--','r-x','rw-','rwx']" :key="p" :value="p">{{ p }}</a-select-option></a-select></a-form-item></a-col>
    </a-row>
    <div class="toolbar">
      <a-button :disabled="disabled || entries.length >= 16" @click="add"><PlusOutlined />{{ $t('label.storage.directory.acl.add') }}</a-button>
      <span>{{ $t('message.storage.directory.acl.nonrecursive') }}</span>
    </div>
    <a-table :columns="columns" :data-source="entries" :row-key="(r,i)=>i" :pagination="false" size="small" :scroll="{x:850}">
      <template #bodyCell="{column,record,index}">
        <a-select v-if="column.key==='scope'" :value="record.scope" :disabled="disabled" @change="update(index,'scope',$event)">
          <a-select-option v-for="scope in ['ACCESS','DEFAULT','BOTH']" :key="scope" :value="scope">{{ scope === 'BOTH' ? $t('label.storage.directory.acl.both') : scope }}</a-select-option>
        </a-select>
        <a-select v-else-if="column.key==='kind'" :value="record.principalType" :disabled="disabled" @change="update(index,'principalType',$event)">
          <a-select-option v-for="kind in kinds" :key="kind" :value="kind">{{ kind }}</a-select-option>
        </a-select>
        <a-input v-else-if="column.key==='principal'" :value="record.principal" :disabled="disabled" :maxlength="255" @update:value="update(index,'principal',$event)" />
        <a-select v-else-if="column.key==='permissions'" :value="record.permissions" :disabled="disabled" @change="update(index,'permissions',$event)">
          <a-select-option v-for="p in ['---','--x','-w-','-wx','r--','r-x','rw-','rwx']" :key="p" :value="p">{{ p }}</a-select-option>
        </a-select>
        <a-button v-else-if="column.key==='remove'" :disabled="disabled" @click="remove(index)">{{ $t('label.remove') }}</a-button>
      </template>
    </a-table>
  </div>
</template>
<script>
import { PlusOutlined } from '@ant-design/icons-vue'
export default {
  name: 'StoragePosixAclFields',
  components: { PlusOutlined },
  props: { value: { type: Object, default: () => ({ ...this.value, version: 1, entries: [] }) }, observation: { type: Object, default: () => ({}) }, disabled: Boolean },
  emits: ['update:value'],
  computed: {
    entries () { return this.value?.entries || [] },
    kinds () { return ['UID', 'GID', 'LOCAL_USER', 'LOCAL_GROUP', 'AD_USER', 'AD_GROUP'] },
    observedRows () { return [...(this.observation.accessAcl || []).map(e => ({ ...e, scope: 'ACCESS' })), ...(this.observation.defaultAcl || []).map(e => ({ ...e, scope: 'DEFAULT' }))] },
    observedColumns () { return [{ title: this.$t('label.storage.directory.acl.scope'), dataIndex: 'scope' }, { title: this.$t('label.storage.directory.acl.kind'), dataIndex: 'tag' }, { title: 'UID / GID', dataIndex: 'id' }, { title: this.$t('label.storage.directory.acl.permissions'), dataIndex: 'permissions' }] },
    columns () { return [{ title: this.$t('label.storage.directory.acl.scope'), key: 'scope', width: 130 }, { title: this.$t('label.storage.directory.acl.kind'), key: 'kind', width: 160 }, { title: this.$t('label.storage.service.principal'), key: 'principal', width: 230 }, { title: this.$t('label.storage.directory.acl.permissions'), key: 'permissions', width: 110 }, { title: this.$t('label.actions'), key: 'remove', width: 90 }] }
  },
  methods: {
    mask (key, value) {
      const result = { ...this.value, entries: [...this.entries] }
      if (value) result[key] = value
      else delete result[key]
      this.$emit('update:value', result)
    },
    update (index, key, value) { this.$emit('update:value', { ...this.value, version: 1, entries: this.entries.map((row, i) => i === index ? { ...row, [key]: value } : { ...row }) }) },
    add () { this.$emit('update:value', { ...this.value, version: 1, entries: [...this.entries, { action: 'UPSERT', scope: 'ACCESS', principalType: 'UID', principal: '', permissions: 'r-x' }] }) },
    remove (index) { this.$emit('update:value', { ...this.value, version: 1, entries: this.entries.filter((row, i) => i !== index) }) }
  }
}
</script>
<style scoped>
.posix-acl-fields { color: var(--ui-text-primary); }
.section-heading { margin: 20px 0 12px; font-weight: 600; }
.mask-fields { margin-top: 16px; }
.toolbar { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin: 16px 0; }
.toolbar span { color: var(--ui-text-secondary); }
:deep(.ant-select) { width: 100%; }
:deep(.ant-alert) { margin-bottom: 16px; }
</style>
