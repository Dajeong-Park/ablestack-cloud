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
  <a-table
    size="small"
    :showHeader="false"
    :columns="columns"
    :dataSource="config"
    :expanded-row-keys="expandedRowKeys"
    @update:expanded-row-keys="$emit('update:expandedRowKeys', $event)"
    :rowKey="record => record.name"
    :pagination="false"
    :rowClassName="getRowClassName"
    style="overflow-y: auto; margin-left: 10px" >

    <template #bodyCell="{ column, record }">
      <template v-if="column.key === 'name'">
        <a-row :style="hierarchyExists ? 'padding-left: 0px;' : 'padding-left: 25px;'">
          <b><span v-if="record.attachedToParent">└─ &nbsp;</span>{{record.displaytext }}&nbsp</b> {{ '(' + record.name + ')' }}
        </a-row>
        <span :style="record.attachedToParent ? 'padding-left: 50px; display:block' : 'padding-left: 25px; display:block'">{{ record.description }}</span>
        <a-button v-if="record.parent && !record.attachedToParent" type="link" @click="$emit('open-parent', record)">
          {{ $t('label.global.setting.parent') }} {{ record.parent }}
        </a-button>
      </template>
      <template v-if="column.key === 'value'">
        <ConfigurationValue :configrecord="record" @refresh="handleConfigRefresh" />
      </template>
    </template>
  </a-table>
</template>

<script>
import ConfigurationValue from './ConfigurationValue'

export default {
  name: 'ConfigurationHierarchy',
  emits: ['refresh-config', 'update:expandedRowKeys', 'open-parent'],
  components: {
    ConfigurationValue
  },
  props: {
    config: {
      type: Array,
      default: () => { return [] }
    },
    expandedRowKeys: {
      type: Array,
      default: () => []
    },
    columns: {
      type: Array,
      default: () => { return [] }
    }
  },
  computed: {
    hierarchyExists () {
      for (var c of this.config) {
        if (c.children) {
          return true
        }
      }
      return false
    }
  },
  data () {
    return {
      apiName: 'listConfigurations',
      configdata: []
    }
  },
  methods: {
    getRowClassName (record, index) {
      if (record.attachedToParent) {
        return 'child-row'
      }
      if (index % 2 === 0) {
        return 'light-row'
      }
      return 'dark-row'
    },
    handleConfigRefresh (name, updatedRecord) {
      this.$emit('refresh-config', name, updatedRecord)
    }
  }
}
</script>
