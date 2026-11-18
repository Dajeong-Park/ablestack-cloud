<!-- Licensed to the Apache Software Foundation (ASF) under one or more
contributor license agreements. See the NOTICE file distributed with this
work for additional information regarding copyright ownership. The ASF
licenses this file under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may
obtain a copy at http://www.apache.org/licenses/LICENSE-2.0 . Unless required
by applicable law or agreed to in writing, software distributed under the
License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS. -->
<template>
  <span class="asn-list-tools">
    <a-tooltip :title="rangeAllowed ? '' : $t('message.asn.management.permission')">
      <span><a-button ref="rangeButton" type="primary" :disabled="!rangeAllowed" :loading="checking" @click="openRanges"><setting-outlined />{{ $t('label.asn.manage') }}</a-button></span>
    </a-tooltip>
    <a-tooltip v-if="canRelease" :title="$t('message.asn.release.' + releaseReason)">
      <span><a-button ref="releaseButton" danger :disabled="!ready || selected.length !== 1 || releaseReason !== 'eligible'" @click="openRelease"><disconnect-outlined />{{ $t('label.action.release.asnumber') }}</a-button></span>
    </a-tooltip>
    <AsnReleaseDialog v-if="target" :key="operationKey" :target="target" :context="$route.fullPath" :operation-key="operationKey" @cancel="closeRelease" @complete="completeRelease" />
    <MoldDialog v-if="rangeVisible" :visible="true" size="sm" formActions focusGuard :title="$t('label.asn.manage')" @cancel="closeRanges">
      <a-form class="asn-zone-form" layout="vertical" @keydown.ctrl.enter.prevent="!$event.repeat && chooseZone()">
        <a-alert v-if="error" role="alert" type="error" show-icon :message="$t('message.asn.management.' + error)" />
        <a-alert v-else-if="!checking && !zones.length" type="info" show-icon :message="$t('message.asn.management.nozone')" />
        <a-form-item :label="$t('label.zone')" html-for="asn-management-zone">
          <a-select id="asn-management-zone" v-model:value="zoneid" :loading="checking" :disabled="checking || !zones.length" show-search option-filter-prop="label">
            <a-select-option v-for="zone in zones" :key="zone.id" :value="zone.id" :label="zone.name + ' ' + zone.id"><span class="asn-zone-option">{{ zone.name }} · {{ zone.id }}</span></a-select-option>
          </a-select>
        </a-form-item>
        <a-button v-if="error" :disabled="checking" @click="loadZones">{{ $t('label.retry') }}</a-button>
        <MoldDialogActions :busy="checking">
          <a-button @click="closeRanges">{{ $t('label.cancel') }}</a-button>
          <a-button type="primary" :disabled="!zoneid || checking || !!error" @keydown.ctrl.enter.prevent="!$event.repeat && chooseZone()" @click="chooseZone">{{ $t('label.asn.manage') }}</a-button>
        </MoldDialogActions>
      </a-form>
    </MoldDialog>
  </span>
</template>
<script>
import { getAPI } from '@/api'
import { asnAuth } from '@/utils/asnSearch'
import { asnReleaseReason, asnReleaseTarget, asnZoneLocation } from '@/utils/asnOperations'
import MoldDialog from './MoldDialog'
import MoldDialogActions from './MoldDialogActions'
import AsnReleaseDialog from './AsnReleaseDialog'
export default {
  components: { MoldDialog, MoldDialogActions, AsnReleaseDialog },
  props: { selected: { type: Array, default: () => [] }, ready: { type: Boolean, default: false }, scope: { type: String, required: true } },
  emits: ['refresh'],
  data () { return { target: null, rangeVisible: false, checking: false, error: '', zones: [], zoneid: '', version: 0, disposed: false } },
  computed: {
    auth () { return asnAuth(this.$store) },
    canRelease () { return this.$store.getters.userInfo?.roletype === 'Admin' && 'releaseASNumber' in this.$store.getters.apis },
    rangeAllowed () { return this.$store.getters.userInfo?.roletype === 'Admin' && ['listZones', 'listASNRanges', 'listASNumbers'].every(k => k in this.$store.getters.apis) && (!this.$store.getters.project?.id || this.$store.getters.project.id === '0') && !this.$store.getters.listAllProjects },
    releaseReason () { return !this.ready ? 'refreshfailed' : this.selected.length !== 1 ? 'selectone' : asnReleaseReason(this.selected[0]) },
    operationKey () { return this.target ? JSON.stringify([this.auth, this.target.zoneid, this.target.asnumber, this.target.id]) : '' }
  },
  watch: {
    scope () { this.version++; this.target = null; this.rangeVisible = false; this.checking = false },
    auth () { this.version++; this.target = null; this.rangeVisible = false; this.checking = false }
  },
  beforeUnmount () { this.disposed = true; this.version++ },
  methods: {
    openRelease () { if (this.canRelease && this.ready && this.selected.length === 1 && this.releaseReason === 'eligible') this.target = asnReleaseTarget(this.selected[0]) },
    closeRelease () { this.target = null; this.$nextTick(() => this.$refs.releaseButton?.$el?.focus()) },
    completeRelease ({ accepted }) { this.closeRelease(); this.$emit('refresh'); this.$notification[accepted ? 'success' : 'info']({ message: this.$t('message.asn.release.completed') }) },
    closeRanges () { if (!this.checking) { this.rangeVisible = false; this.$nextTick(() => this.$refs.rangeButton?.$el?.focus()) } },
    async loadZones () {
      if (!this.rangeAllowed) return
      const version = ++this.version; const auth = this.auth; const scope = this.scope
      const current = () => !this.disposed && version === this.version && auth === this.auth && scope === this.scope && this.rangeAllowed
      this.checking = true; this.error = ''; this.zones = []; this.zoneid = ''
      try {
        let all = []; let count = 0; let page = 1
        do {
          const json = await getAPI('listZones', { ...(this.$route.query.zoneid ? { id: this.$route.query.zoneid } : {}), page, pagesize: 500 }, { preserveOnFailure: true, timeout: 20000 })
          if (!current()) return
          const body = json?.listzonesresponse; const rows = body?.zone || []
          if (!body || body.errorcode || !Array.isArray(rows) || !Number.isSafeInteger(body.count ?? (rows.length ? NaN : 0))) throw Error('lookup')
          count = body.count || 0
          if (count < all.length + rows.length || count > 10000 || rows.some(r => !r.id || all.some(old => old.id === r.id)) || !rows.length && all.length < count) throw Error('lookup')
          all = [...all, ...rows]; page++
        } while (all.length < count)
        this.zones = all.filter(z => z.routedmodeenabled === true && (!this.$route.query.zoneid || z.id === this.$route.query.zoneid))
        if (this.zones.length === 1) this.zoneid = this.zones[0].id
      } catch (_) { if (current()) this.error = 'lookup' } finally { if (current()) this.checking = false }
    },
    async openRanges () { if (!this.rangeAllowed || this.checking) return; this.rangeVisible = true; await this.loadZones(); if (this.zones.length === 1 && !this.error && this.rangeVisible) await this.chooseZone() },
    async chooseZone () {
      if (this.checking || !this.rangeAllowed || !this.zoneid || this.error) return
      const version = ++this.version; const zoneid = this.zoneid; const auth = this.auth; const scope = this.scope
      this.checking = true
      try {
        const json = await getAPI('listZones', { id: zoneid }, { preserveOnFailure: true, timeout: 20000 })
        if (this.disposed || version !== this.version || auth !== this.auth || scope !== this.scope || !this.rangeAllowed) return
        const rows = json?.listzonesresponse?.zone
        if (!Array.isArray(rows) || rows.length !== 1 || rows[0].id !== zoneid || rows[0].routedmodeenabled !== true) throw Error('zone')
        await this.$router.push(asnZoneLocation(rows[0], this.$route, this.$store.getters))
      } catch (_) { if (!this.disposed && version === this.version) this.error = 'lookup' } finally { if (!this.disposed && version === this.version) this.checking = false }
    }
  }
}
</script>
<style scoped>
.asn-list-tools { display: inline-flex; flex-wrap: wrap; gap: 8px; margin: 0 0 5px 8px; vertical-align: top; }
.asn-zone-form { color: var(--ui-text-primary); }
.asn-zone-option { white-space: normal; overflow-wrap: anywhere; }
</style>
