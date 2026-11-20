// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements. See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership. The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License. You may obtain a copy of the License at
//
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied. See the License for the
// specific language governing permissions and limitations
// under the License.

<template>
  <router-link v-if="field === 'publicip' && list && resource.id && resource.publicip" :to="s2sGatewayDetailLocation($route, resource, $store.getters)">{{ resource.publicip }}</router-link>
  <router-link v-else-if="['vpcname','vpcid'].includes(field) && resource.vpcid" :to="{ path: '/vpc/' + resource.vpcid }">{{ resource.vpcname || resource.vpcid }}</router-link>
  <router-link v-else-if="field === 'account' && resource.projectid" :to="{ path: '/project/' + resource.projectid }">{{ resource.project || resource.projectid }} ({{ $t('label.project') }})</router-link>
  <router-link v-else-if="field === 'account' && resource.account && resource.domainid && !resource.projectid" :to="{ path: '/account', query: { name: resource.account, domainid: resource.domainid, dataView: true } }">{{ resource.account }}</router-link>
  <router-link v-else-if="field === 'domain' && resource.domainid" :to="{ path: '/domain/' + resource.domainid }">{{ resource.domain || resource.domainid }}</router-link>
  <router-link v-else-if="field === 'project' && resource.projectid" :to="{ path: '/project/' + resource.projectid }">{{ resource.project || resource.projectid }}</router-link>
  <copy-label v-else-if="field === 'id' && resource.id" :label="resource.id" />
  <span v-else-if="field === 'fordisplay'">{{ $store.getters.userInfo?.roletype === 'Admin' && typeof resource.fordisplay === 'boolean' ? $t(resource.fordisplay ? 'label.yes' : 'label.no') : '-' }}</span>
  <span v-else>{{ resource[field] || '-' }}</span>
</template>
<script>
import CopyLabel from '@/components/widgets/CopyLabel'
import { s2sGatewayDetailLocation } from '@/utils/s2sGatewaySearch'
export default {
  name: 'S2sGatewayValue',
  components: { CopyLabel },
  props: { resource: { type: Object, required: true }, field: { type: String, required: true }, list: Boolean },
  methods: { s2sGatewayDetailLocation }
}
</script>
