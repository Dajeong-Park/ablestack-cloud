// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements. See NOTICE for ownership information.
// Licensed under the Apache License, Version 2.0 (the "License");
// http://www.apache.org/licenses/LICENSE-2.0 . Distributed AS IS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND.

import { reactive } from 'vue'
import { getAPI } from '@/api'
import { networkCollection } from './networkLifecycle'
import { createListRefresh, canRefreshList } from './listRefresh'

// Only mounted consumers share a snapshot. Neither a completed lookup nor a failed
// lookup survives navigation/login. NIC refresh also updates the summary immediately.
const entries = new Map()

export function vmNetworkRouteFamily (route) {
  const match = /^\/(vm|vnfapp)\/([^/]+)\/?$/.exec(route?.path || '')
  if (!match || (route.meta?.name && route.meta.name !== match[1]) ||
      (route.params?.id && route.params.id !== match[2])) return ''
  return match[1]
}

export function vmNetworkAccessScope (vm) {
  const resource = vm.resource || {}
  const { project, userInfo, apis } = vm.$store?.getters || {}
  const route = vm.$route
  const family = vmNetworkRouteFamily(route)
  const routeId = route?.path?.split('/')[2]
  if (vm.isStatic || !resource.id || !resource.zoneid || !Array.isArray(resource.nic) ||
      !family || routeId !== resource.id ||
      (project?.id && project.id !== resource.projectid)) return ''
  return JSON.stringify([route?.path, resource.id, resource.zoneid, resource.projectid, project?.id,
    userInfo?.id, userInfo?.accountid, userInfo?.domainid, userInfo?.roleid, userInfo?.roletype,
    vm.$store?.state?.user?.token, Object.keys(apis || {}).sort()])
}

function acquire (key) {
  if (!entries.has(key)) entries.set(key, { key, state: reactive({ networks: {}, status: 'idle' }), refs: 0, generation: 0, pending: null })
  const entry = entries.get(key)
  entry.refs++
  return {
    entry,
    release: () => {
      if (--entry.refs === 0) { entry.generation++; entries.delete(key) }
    }
  }
}

async function read (entry, resource, allowed) {
  if (entry.pending) return entry.pending
  const generation = ++entry.generation
  // Never keep previously allowed links while a refresh is unconfirmed.
  entry.state.networks = {}
  entry.state.status = allowed ? 'loading' : 'unavailable'
  if (!allowed) return
  const current = () => entry.refs > 0 && entry.generation === generation
  entry.pending = (async () => {
    try {
      const rows = await networkCollection(getAPI, 'listNetworks', 'network', {
        zoneid: resource.zoneid,
        listall: true,
        ignoreproject: true,
        ...(resource.projectid ? { projectid: resource.projectid } : {})
      })
      if (current()) { entry.state.networks = Object.fromEntries(rows.map(n => [n.id, n])); entry.state.status = 'ready' }
    } catch (error) {
      if (current()) entry.state.status = 'error'
    } finally { entry.pending = null }
  })()
  return entry.pending
}

export function vmNetworkAccessMixin ({ autoLoad = true } = {}) {
  return {
    data: () => ({ vmNetworkAccessEntry: null, vmNetworkAccessRelease: null }),
    computed: {
      vmNetworkAccessManaged () { return ['vm', 'vnfapp'].includes(this.$route?.meta?.name) || /^\/(vm|vnfapp)(\/|$)/.test(this.$route?.path || '') },
      vmNetworkAccessScope () { return vmNetworkAccessScope(this) },
      vmNetworkAccessStatus () { return this.vmNetworkAccessScope && this.vmNetworkAccessEntry?.key === this.vmNetworkAccessScope ? this.vmNetworkAccessEntry.state.status : undefined },
      vmNetworks () { return this.vmNetworkAccessStatus === 'ready' ? this.vmNetworkAccessEntry.state.networks : {} },
      vmNetworkAccessFailed () { return this.vmNetworkAccessStatus === 'error' }
    },
    watch: {
      vmNetworkAccessScope: {
        immediate: true,
        handler (key) {
          this.vmNetworkAccessRelease && this.vmNetworkAccessRelease()
          this.vmNetworkAccessEntry = null
          this.vmNetworkAccessRelease = null
          if (!key) return
          const { entry, release } = acquire(key)
          this.vmNetworkAccessEntry = entry
          this.vmNetworkAccessRelease = release
          if (autoLoad) this.fetchVmNetworkAccess()
        }
      },
      resource () { if (autoLoad) this.fetchVmNetworkAccess() }
    },
    mounted () {
      if (autoLoad) {
        this.vmNetworkAccessRefresh = createListRefresh({
          active: () => !!this.vmNetworkAccessScope && canRefreshList(this.$el),
          refresh: async () => { await this.fetchVmNetworkAccess(); if (this.vmNetworkAccessFailed) throw new Error('Network lookup failed') }
        })
      }
    },
    beforeUnmount () {
      this.vmNetworkAccessRefresh && this.vmNetworkAccessRefresh.stop()
      this.vmNetworkAccessRelease && this.vmNetworkAccessRelease()
      this.vmNetworkAccessEntry = null
    },
    methods: {
      async fetchVmNetworkAccess (resource = this.resource) {
        const entry = this.vmNetworkAccessEntry
        if (!this.vmNetworkAccessScope || entry?.key !== this.vmNetworkAccessScope) return
        await read(entry, resource, 'listNetworks' in (this.$store?.getters.apis || {}))
      }
    }
  }
}
