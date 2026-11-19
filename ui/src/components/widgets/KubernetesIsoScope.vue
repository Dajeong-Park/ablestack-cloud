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
  <router-link v-if="path" :to="path" :title="scope.id">{{ scope.name || scope.id }}</router-link>
  <span v-else>{{ scope.kind === 'all' ? $t('label.kubernetes.iso.scope.all') : scope.kind === 'zone' ? scope.name || scope.id : $t('label.kubernetes.iso.scope.unknown') }}</span>
</template>
<script>
import { kubernetesIsoScope } from '@/utils/kubernetesIsoDetails'
export default {
  name: 'KubernetesIsoScope',
  props: { resource: { type: Object, required: true } },
  computed: {
    scope () { return kubernetesIsoScope(this.resource) },
    path () {
      if (this.scope.kind !== 'zone' || !this.$store.getters.apis?.listZones) return ''
      const prefixes = this.$store.getters.userInfo?.roletype === 'Admin' ? ['/zone/', '/zones/'] : ['/zones/', '/zone/']
      for (const prefix of prefixes) {
        const path = prefix + this.scope.id
        const match = this.$router.resolve(path).matched
        if (match?.length && match[0].redirect !== '/exception/404') return path
      }
      return ''
    }
  }
}
</script>
