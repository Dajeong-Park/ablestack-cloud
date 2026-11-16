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
  <kubernetes-iso-scope v-if="field === 'zonename'" :resource="resource" />
  <kubernetes-iso-status v-else :resource="resource" :mode="field === 'state' ? 'version' : 'iso'" compact />
</template>
<script>
import KubernetesIsoScope from '@/components/widgets/KubernetesIsoScope'
import KubernetesIsoStatus from '@/components/widgets/KubernetesIsoStatus'
export default {
  name: 'KubernetesIsoListCell',
  components: { KubernetesIsoScope, KubernetesIsoStatus },
  props: { resource: { type: Object, required: true }, field: { type: String, required: true } }
}
</script>
