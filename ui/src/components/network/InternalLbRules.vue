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
  <div class="internal-lb-rules">
    <span v-if="!rows.length">—</span>
    <dl v-for="(rule, index) in rows" :key="index" class="internal-lb-rules__row">
      <div><dt>{{ $t('label.sourceport') }}</dt><dd>{{ rule.sourcePort }}</dd></div>
      <div><dt>{{ $t('label.instanceport') }}</dt><dd>{{ rule.instancePort }}</dd></div>
      <div>
        <dt>{{ $t('label.state') }}</dt>
        <dd><status v-if="rule.state" :text="rule.state" display-text /><span v-else>—</span></dd>
      </div>
    </dl>
  </div>
</template>
<script>
import Status from '@/components/widgets/Status'
import eventBus from '@/config/eventBus'

const port = value => {
  if (!['number', 'string'].includes(typeof value) || !/^\d+$/.test(String(value).trim())) return '—'
  const number = Number(value)
  return Number.isInteger(number) && number > 0 && number <= 65535 ? number : '—'
}
export default {
  name: 'InternalLbRules',
  components: { Status },
  inject: {
    resourceReadPending: { default: () => () => false },
    resourceReadFailed: { default: () => () => false }
  },
  props: {
    record: { type: Object, default: () => ({}) },
    loading: { type: Boolean, default: false }
  },
  data: () => ({ projectSwitching: false }),
  computed: {
    rows () {
      const getters = this.$store?.getters || {}
      const project = getters.project?.id
      const recordProject = this.record.projectid
      if (this.loading || this.resourceReadPending() || this.resourceReadFailed() || this.projectSwitching ||
          (getters.apis && !('listLoadBalancers' in getters.apis)) ||
          (this.$route?.params?.id && this.$route.params.id !== this.record.id) ||
          (project && project !== '-1' && project !== recordProject) ||
          (!project && !getters.listAllProjects && recordProject)) return []
      if (!Array.isArray(this.record.loadbalancerrule)) return []
      return this.record.loadbalancerrule.filter(rule => rule && typeof rule === 'object' && !Array.isArray(rule)).map(rule => ({
        sourcePort: port(rule.sourceport),
        instancePort: port(rule.instanceport),
        state: typeof rule.state === 'string' ? rule.state.trim() : ''
      }))
    }
  },
  mounted () {
    eventBus.on('project-switch-start', this.switchStart)
    eventBus.on('project-switch-end', this.switchEnd)
  },
  beforeUnmount () {
    eventBus.off('project-switch-start', this.switchStart)
    eventBus.off('project-switch-end', this.switchEnd)
  },
  methods: {
    switchStart () { this.projectSwitching = true },
    switchEnd () { this.projectSwitching = false }
  }
}
</script>
<style scoped>
.internal-lb-rules { min-width: 0; color: var(--ui-text-primary); }
.internal-lb-rules__row { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px 16px; margin: 8px 0; }
.internal-lb-rules__row + .internal-lb-rules__row { border-top: 1px solid var(--ui-border); padding-top: 8px; }
.internal-lb-rules__row > div { min-width: 0; }
.internal-lb-rules dt { color: var(--ui-text-secondary); font-size: 12px; font-weight: normal; overflow-wrap: anywhere; }
.internal-lb-rules dd { margin: 2px 0 0; overflow-wrap: anywhere; }
@media (max-width: 767px) {
  .internal-lb-rules__row { grid-template-columns: minmax(0, 1fr); gap: 8px; }
}
</style>
