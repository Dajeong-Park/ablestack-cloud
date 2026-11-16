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
  <span class="public-ip-search-control" @keydown.esc.stop="visible = false">
    <span class="filter-group">
      <a-input-search v-model:value="keyword" class="input-search" :placeholder="$t('label.search')" allow-clear @search="$emit('search', { searchQuery: keyword })">
        <template #addonBefore>
          <a-popover placement="bottomRight" trigger="click" :visible="visible" @visibleChange="open">
            <template #content>
              <a-form v-if="visible" :model="form" layout="vertical" class="storage-standard-search-form guest-network-search-form public-ip-search-form" @finish="apply" @keydown.esc.stop.prevent="visible = false" v-ctrl-enter="apply">
                <a-alert v-if="root && ['all', 'free'].includes($route.query.filter)" type="info" show-icon :message="$t('message.public.ip.search.pool')" />
                <a-alert v-if="error" type="error" show-icon :message="$t(error)" />
                <a-form-item v-if="supported.ipaddress" :label="$t('label.ipaddress')" html-for="pip-search-ipaddress"><a-input id="pip-search-ipaddress" v-model:value="form.ipaddress" /></a-form-item>
                <a-form-item v-for="field in pickers" :key="field" :label="$t(config(field).label)" :html-for="'pip-search-candidate-' + field">
                  <PublicIpSearchSelect :key="field + ':' + generation" v-model:value="form[field]" :kind="field" :scope="scope" @update:value="changed(field)" @blocked="blocked[field] = $event" />
                  <template v-if="field === 'vlanid'" #extra>{{ $t('message.public.ip.search.vlan') }}</template>
                </a-form-item>
                <a-form-item v-for="field in booleans" :key="field" :label="$t(field === 'fordisplay' ? 'label.public.ip.display' : 'label.' + field)" :html-for="'pip-search-' + field">
                  <a-select :id="'pip-search-' + field" v-model:value="form[field]" allow-clear :placeholder="$t(field === 'fordisplay' ? 'label.public.ip.search.display.default' : 'label.all')">
                    <a-select-option v-if="field === 'fordisplay' && supported.displayall" value="all">{{ $t('label.all') }}</a-select-option>
                    <a-select-option value="true">{{ $t('label.yes') }}</a-select-option>
                    <a-select-option value="false">{{ $t('label.no') }}</a-select-option>
                  </a-select>
                </a-form-item>
                <a-form-item v-if="supported.tags" :label="$t('label.tags')">
                  <div v-for="(tag, i) in tags" :key="i" class="public-ip-search-tag">
                    <a-input v-model:value="tag.key" :aria-label="$t('label.key') + ' ' + (i + 1)" :placeholder="$t('label.key')" />
                    <a-input v-model:value="tag.value" :aria-label="$t('label.value') + ' ' + (i + 1)" :placeholder="$t('label.value')" />
                    <a-button :aria-label="$t('label.remove') + ' ' + (i + 1)" @click="tags.splice(i, 1)"><close-outlined /></a-button>
                  </div>
                  <a-button size="small" @click="tags.push({ key: '', value: '' })"><plus-outlined />{{ $t('label.add') }}</a-button>
                </a-form-item>
                <div class="filter-group-button">
                  <a-button class="filter-group-button-clear" size="small" @click="reset"><stop-outlined />{{ $t('label.reset') }}</a-button>
                  <a-button class="filter-group-button-search" type="primary" size="small" html-type="submit" :disabled="Object.values(blocked).some(Boolean)"><search-outlined />{{ $t('label.search') }}</a-button>
                </div>
              </a-form>
            </template>
            <a-button class="filter-button" size="small" :aria-label="$t('label.advanced.search')" :aria-expanded="visible"><filter-two-tone v-if="chips.length" /><filter-outlined v-else /></a-button>
          </a-popover>
        </template>
      </a-input-search>
    </span>
  </span>
</template>
<script>
import PublicIpSearchSelect from '@/components/view/PublicIpSearchSelect'
import { publicIpPickerConfig, publicIpProject, publicIpRoot, publicIpKeys, publicIpSearchError } from '@/utils/publicIpSearch'
import { publicIpReadAuth } from '@/utils/publicIpDetails'
export default {
  name: 'PublicIpSearch',
  components: { PublicIpSearchSelect },
  emits: ['search'],
  data () { return { visible: false, keyword: '', form: {}, tags: [], blocked: {}, error: '', generation: 0 } },
  computed: {
    supported () { return this.$getApiParams('listPublicIpAddresses') || {} },
    root () { return publicIpRoot(this.$store.getters) },
    scope () { return { ...this.form, projectid: this.$route.query.projectid || publicIpProject(this.$store.getters) } },
    context () { return publicIpReadAuth(this.$store) },
    pickers () { return ['zoneid', 'domainid', 'account', 'vpcid', 'associatednetworkid', 'networkid', 'physicalnetworkid', 'vlanid'].filter(k => this.supported[k] && (!['networkid', 'physicalnetworkid', 'vlanid'].includes(k) || this.root) && (!['domainid', 'account'].includes(k) || this.scope.projectid === '0')) },
    booleans () { return ['issourcenat', 'isstaticnat', ...(this.root ? ['fordisplay'] : [])].filter(k => this.supported[k]) },
    chips () { return Object.entries(this.$route.query).filter(([k]) => publicIpKeys.includes(k) && k !== 'keyword' || /^tags\[\d+\]\.key$/.test(k)).map(([key, value]) => ({ key, value: ['true', 'false'].includes(value) ? this.$t(value === 'true' ? 'label.yes' : 'label.no') : value, label: this.$t(publicIpPickerConfig(key)?.label || (key === 'fordisplay' ? 'label.public.ip.display' : 'label.' + (/^tags/.test(key) ? 'tags' : key))) })) }
  },
  watch: {
    context: { flush: 'sync', handler () { this.visible = false; this.form = {}; this.tags = []; this.blocked = {}; this.error = ''; this.generation++ } },
    '$route.fullPath': { immediate: true, handler () { this.keyword = this.$route.query.keyword || ''; this.visible = false } }
  },
  methods: {
    config: publicIpPickerConfig,
    open (value) { this.visible = value; if (!value) return; this.form = Object.fromEntries(Object.entries(this.$route.query).filter(([k]) => publicIpKeys.includes(k))); this.tags = []; for (const [key, val] of Object.entries(this.$route.query)) { const match = /^tags\[(\d+)\]\.key$/.exec(key); if (match) this.tags.push({ key: val, value: this.$route.query['tags[' + match[1] + '].value'] || '' }) } this.error = ''; this.blocked = {}; this.generation++ },
    changed (field) { const children = { zoneid: ['vpcid', 'associatednetworkid', 'networkid', 'physicalnetworkid', 'vlanid'], domainid: ['account', 'vpcid', 'associatednetworkid', 'vlanid'], account: ['vpcid', 'associatednetworkid', 'vlanid'], vpcid: ['associatednetworkid'], networkid: ['vlanid'], physicalnetworkid: ['vlanid'] }; for (const key of children[field] || []) { delete this.form[key]; delete this.blocked[key] } },
    apply () { if (Object.values(this.blocked).some(Boolean)) return; const values = { ...this.form }; this.tags.filter(t => t.key.trim()).forEach((t, i) => { values['tags[' + i + '].key'] = t.key.trim(); values['tags[' + i + '].value'] = t.value }); if (this.keyword.trim()) values.keyword = this.keyword.trim(); this.error = publicIpSearchError({ ...values, state: this.$route.query.state || undefined, filter: this.$route.query.filter || 'allocated', projectid: this.scope.projectid }, this.$store.getters, this.supported); if (this.error) return; this.$emit('search', values); this.visible = false },
    reset () { this.keyword = ''; this.visible = false; this.$emit('search', { filter: 'allocated', state: 'Allocated' }) },
    remove (key) { const values = { ...this.$route.query }; delete values[key]; if (key === 'domainid') delete values.account; if (/^tags/.test(key)) delete values[key.replace('.key', '.value')]; this.form = values; this.changed(key); this.$emit('search', this.form) }
  }
}
</script>
<style scoped>
.public-ip-search-control { display: inline-flex; flex-direction: column; max-width: 100%; min-width: 0; }
.public-ip-search-control .input-search { width: 240px; max-width: 100%; }
.public-ip-search-chips { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
.public-ip-search-chips :deep(.ant-tag) { white-space: normal; overflow-wrap: anywhere; max-width: 100%; }
.public-ip-search-tag { display: flex; gap: 4px; margin-bottom: 4px; }
.public-ip-search-form { max-height: 65vh; overflow-y: auto; width: min(340px, calc(100vw - 64px)); }
</style>
