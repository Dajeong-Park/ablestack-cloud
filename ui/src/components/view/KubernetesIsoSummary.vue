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
  <div class="kubernetes-iso-summary">
    <div class="resource-detail-item">
      <div class="resource-detail-item__label">{{ $t('label.kubernetes.iso.availability') }}</div>
      <kubernetes-iso-status :resource="resource" :observation="observation" inspectable @show-zones="$emit('show-zones')" />
    </div>
    <div class="resource-detail-item">
      <div class="resource-detail-item__label">{{ $t('label.kubernetes.iso.registration.scope') }}</div>
      <kubernetes-iso-scope :resource="resource" />
    </div>
    <div class="resource-detail-item">
      <div class="resource-detail-item__label">{{ $t('label.isoname') }}</div>
      <router-link v-if="isoLink" :to="isoLink">{{ resource.isoname || resource.isoid }}</router-link>
      <span v-else>{{ resource.isoname || resource.isoid || '—' }}</span>
    </div>
  </div>
</template>
<script>
import { getAPI } from '@/api'
import KubernetesIsoStatus from '@/components/widgets/KubernetesIsoStatus'
import KubernetesIsoScope from '@/components/widgets/KubernetesIsoScope'
import { kubernetesIsoDetailContext, kubernetesIsoLink, readKubernetesIsoZones, kubernetesIsoObservationFailure } from '@/utils/kubernetesIsoDetails'
export default {
  name: 'KubernetesIsoSummary',
  components: { KubernetesIsoStatus, KubernetesIsoScope },
  props: { resource: { type: Object, required: true }, loading: Boolean },
  emits: ['observed', 'show-zones'],
  data: () => ({ observation: null, generation: 0, pending: false, disposed: false, paused: false, timer: null, request: null }),
  computed: {
    context () { return kubernetesIsoDetailContext(this.$route, this.resource, this.$store.getters, this.$store.state?.user?.token) },
    active () { return !this.disposed && !this.paused && !this.loading && this.$route.meta?.name === 'kubernetesiso' && this.$route.params?.id === this.resource.id },
    isoLink () { return kubernetesIsoLink(this.resource, this.$store.getters, this.observation) }
  },
  watch: {
    context: { immediate: true, flush: 'sync', handler () { this.reset() } },
    active (value) { if (value) this.refresh() }
  },
  mounted () {
    this.timer = setInterval(() => {
      if (this.active && !this.pending && document.visibilityState !== 'hidden' && !['forbidden', 'expired', 'invalid'].includes(this.observation?.status)) this.refresh()
    }, 10000)
  },
  activated () { if (this.paused) { this.paused = false; this.reset() } },
  deactivated () { this.paused = true; this.generation++; this.pending = false },
  beforeUnmount () { this.disposed = true; this.generation++; clearInterval(this.timer) },
  methods: {
    publish (value) { this.observation = { refreshing: false, ...value, versionid: this.resource.id, isoid: this.resource.isoid, context: this.context }; this.$emit('observed', this.observation) },
    reset () { this.generation++; this.pending = false; this.publish({ status: 'unqueried', rows: [] }); if (this.active) this.refresh() },
    refresh () {
      if (!this.active) return Promise.resolve()
      if (this.pending) return this.request
      const generation = ++this.generation; const context = this.context
      const current = () => !this.disposed && this.active && generation === this.generation && context === this.context
      this.pending = true
      if (this.observation?.status === 'ready' && this.observation.context === context) this.publish({ ...this.observation, refreshing: true })
      else this.publish({ status: 'loading', rows: [] })
      const options = { preserveOnFailure: true, timeout: 20000, readScope: JSON.stringify([this.$store.state?.user?.token, this.$store.getters.userInfo?.id, this.$store.getters.project?.id]) }
      this.request = readKubernetesIsoZones(getAPI, this.resource, this.$store.getters, options, current).then(value => {
        if (current() && value) this.publish(value)
      }).catch(error => { if (current()) this.publish({ status: kubernetesIsoObservationFailure(error), rows: [] }) }).finally(() => {
        if (generation === this.generation) this.pending = false
      })
      return this.request
    }
  }
}
</script>
<style scoped>
.kubernetes-iso-summary { min-width:0; overflow-wrap:anywhere; }
.kubernetes-iso-summary .resource-detail-item:last-child { margin-bottom:0; }
</style>
