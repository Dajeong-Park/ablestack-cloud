<!--
Licensed to the Apache Software Foundation (ASF) under one
or more contributor license agreements. See the NOTICE file
distributed with this work for additional information
regarding copyright ownership. The ASF licenses this file
to you under the Apache License, Version 2.0 (the
"License"); you may not use this file except in compliance
with the License. You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing,
software distributed under the License is distributed on an
"AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, either express or implied. See the License for the
specific language governing permissions and limitations
under the License.
-->
<template>
  <div class="vnf-credentials">
    <div class="vnf-credential-values" tabindex="0" role="note">
      <dl><template v-for="row in rows" :key="row.key"><dt>{{ row.prefix }}{{ translate(row.label) }}</dt><dd>{{ row.value }}</dd></template></dl>
    </div>
    <p v-if="rows.some(row => row.secret)">{{ translate('message.vnf.credentials.change') }}</p>
    <button type="button" class="ant-btn ant-btn-sm" @click="$emit('close')">{{ translate('label.close') }}</button>
  </div>
</template>
<script>
export default { name: 'VnfCredentials', props: { rows: { type: Array, required: true }, translate: { type: Function, required: true } }, emits: ['close'] }
</script>
<style scoped>
.vnf-credential-values { max-height: min(30vh, 280px); overflow: auto; overflow-wrap: anywhere; }
.vnf-credentials dt { font-weight: 600; }
.vnf-credentials dd { margin: 0 0 8px; }
</style>
