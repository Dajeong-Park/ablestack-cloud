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
  <template-detail-value v-if="copyable" :field="field" :value="value" :label="label" />
  <a-tooltip v-else-if="bytes" :title="value == null ? '—' : String(value) + ' B'" :trigger="['hover', 'focus']"><span tabindex="0" class="iso-detail-value">{{ isoSize(value) }}</span></a-tooltip>
  <span v-else class="iso-detail-value">{{ booleanValue }}</span>
</template>
<script>
import TemplateDetailValue from '@/components/widgets/TemplateDetailValue'
import { isoBoolean } from '@/utils/isoModel'
import { isoSize } from '@/utils/isoZoneOperations'
export default {
  name: 'IsoDetailValue',
  components: { TemplateDetailValue },
  props: { field: { type: String, required: true }, value: { default: undefined }, label: { type: String, required: true } },
  computed: {
    copyable () { return ['id', 'checksum', 'url'].includes(this.field) },
    bytes () { return ['size', 'physicalsize', 'virtualsize'].includes(this.field) },
    booleanValue () { const value = isoBoolean(this.value); return this.$t(value === true ? 'label.yes' : value === false ? 'label.no' : 'label.unknown') }
  },
  methods: { isoSize }
}
</script>
<style scoped>
.iso-detail-value { overflow-wrap:anywhere; }
.iso-detail-value:focus-visible { outline:2px solid var(--ui-color-primary, #1890ff); }
</style>
