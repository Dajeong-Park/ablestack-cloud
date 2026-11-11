// Licensed to the Apache Software Foundation (ASF) under one or more
// contributor license agreements. See NOTICE. Apache License, Version 2.0.
const array = value => Array.isArray(value) ? value : []
const text = value => String(value ?? '').trim()
const object = value => {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value
  try { const parsed = JSON.parse(value); return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {} } catch (_) { return {} }
}
const numberPort = value => { const n = Number(value); return Number.isInteger(n) && n > 0 && n <= 65535 ? n : null }
const address = value => text(value).replace(/^\[|\]$/g, '')
const wildcard = ip => !ip || ['0.0.0.0', '::', '*'].includes(ip)
const mode = value => ['V4_ONLY', 'V3V4_DUAL'].includes(text(value).toUpperCase()) ? text(value).toUpperCase() : 'UNKNOWN'
const configuredMode = raw => {
  const config = object(raw.config)
  return text(raw.protocolmode ?? raw.protocolMode ?? config.protocolMode ?? config.protocolmode)
}
const stamp = value => {
  if (!value) return null
  const n = Number(value)
  if (Number.isFinite(n)) return n > 1e12 ? n : n > 1e9 ? n * 1000 : null
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}
export const nfsEndpoint = (ip, port) => {
  const host = address(ip)
  return host && port ? (host.includes(':') ? '[' + host + ']:' + port : host + ':' + port) : host || '—'
}
const ports = value => {
  const values = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : value === undefined ? [] : [value]
  return [...new Set(values.map(numberPort).filter(Boolean))]
}
const endpointKey = entry => JSON.stringify([entry.listenIp, entry.port])
const parseRuntime = (root, entries, source, error, now) => array(entries).map(raw => {
  const listenIp = address(raw.listenIp ?? raw.listenip)
  const port = numberPort(raw.port)
  const observedAt = raw.observedAt ?? raw.observedat ?? root.generatedAt ?? root.timestamp
  const time = stamp(observedAt)
  const ttl = Number(root.staleAfterSeconds ?? root.cache?.staleAfterSeconds ?? 30)
  const fresh = time !== null && time <= now + 5000 && now - time <= (Number.isFinite(ttl) && ttl > 0 ? ttl : 30) * 1000
  const unavailable = !!error || root.success === false || ['error', 'failed'].includes(text(root.status).toLowerCase())
  const stale = !fresh || root.stale === true || root.cache?.stale === true
  let state = 'UNKNOWN'
  if (unavailable) state = 'UNAVAILABLE'
  else if (stale) state = 'STALE'
  else if (raw.listening === false || raw.processRunning === false || ['error', 'failed', 'inactive'].includes(text(raw.status).toLowerCase())) state = 'FAILED'
  else if (raw.listening === true && raw.processRunning === true) state = 'READY'
  return { ...raw, listenIp, port, observedAt, time, source, state, observedMode: mode(raw.protocolMode ?? raw.protocolmode) }
}).filter(entry => entry.port)

function observe (group, all) {
  const byPort = all.filter(entry => entry.port === group.port)
  const exact = byPort.filter(entry => entry.listenIp === group.listenIp)
  const candidates = exact.length ? exact : byPort.filter(entry => wildcard(entry.listenIp))
  const identities = new Set(candidates.map(endpointKey))
  if (identities.size > 1) return { state: 'CONFLICT', observedMode: 'UNKNOWN', observations: candidates }
  if (!candidates.length) return { state: 'NOT_OBSERVED', observedMode: 'UNKNOWN', observations: [] }
  const fresh = candidates.filter(entry => !['STALE', 'UNAVAILABLE'].includes(entry.state))
  const chosen = [...(fresh.length ? fresh : candidates)].sort((a, b) => (b.time || 0) - (a.time || 0))[0]
  const states = new Set(fresh.map(entry => entry.state))
  const modes = new Set(fresh.map(entry => entry.observedMode).filter(value => value !== 'UNKNOWN'))
  const boots = new Set(fresh.map(entry => entry.bootId).filter(Boolean))
  const conflict = states.size > 1 || modes.size > 1 || boots.size > 1
  return {
    ...chosen,
    state: conflict ? 'CONFLICT' : chosen.state,
    partial: candidates.some(entry => entry.state === 'UNAVAILABLE'),
    observations: candidates
  }
}

/** Display only. Never returns a replacement command payload or changes raw API objects. */
export function buildNfsListenerPresentation ({ protocols = [], inventory = {}, health = {}, exports = [], readState = {}, now = Date.now() } = {}) {
  const errors = readState.errors || {}
  const pending = readState.pending || []
  const runtimes = [
    ...parseRuntime(inventory, inventory.nfsGaneshaExports, 'inventory', errors.inventory || errors.nvme, now),
    ...parseRuntime(health, health.nfsGanesha?.endpoints, 'health', errors.health, now)
  ]
  const registered = array(protocols).filter(raw => text(raw.protocol || raw.name).toUpperCase() === 'NFS')
  const groups = registered.map(raw => {
    const listenIp = address(raw.listenip ?? raw.listenIp) || '0.0.0.0'
    const port = numberPort(raw.port)
    const key = raw.id || JSON.stringify(['NFS', listenIp, port])
    const rawMode = configuredMode(raw)
    return { key, id: raw.id, raw, listenIp, port, registered: true, enabled: raw.enabled !== false && raw.enabled !== 'false', configuredMode: mode(rawMode), configuredModeRaw: rawMode || 'UNKNOWN' }
  })
  const used = new Set()
  groups.forEach(group => {
    group.observation = observe(group, runtimes)
    group.observation.observations.forEach(entry => used.add(endpointKey(entry)))
  })
  // Keep unexpected runtime listeners visible, without making them mutation targets.
  const orphanKeys = new Set()
  runtimes.filter(entry => !used.has(endpointKey(entry))).forEach(entry => {
    const key = endpointKey(entry)
    if (orphanKeys.has(key)) return
    orphanKeys.add(key)
    const group = { key: 'runtime:' + key, listenIp: entry.listenIp, port: entry.port, registered: false, enabled: true, configuredMode: 'UNKNOWN', configuredModeRaw: 'UNKNOWN' }
    group.observation = observe(group, runtimes)
    groups.push(group)
  })
  const shares = [...new Map(array(exports).map(share => [share.id || JSON.stringify([share.name, share.volumeid, share.path]), share])).values()]
  const exportGroups = {}
  const exportPorts = new Map()
  shares.forEach(share => {
    const config = object(share.config)
    let configured = ports(share.listenerports ?? share.listenerPorts ?? config.listenerGroupPorts ?? config.listenergroupports)
    if (!configured.length && mode(configuredMode(share)) === 'V3V4_DUAL') configured = [2049]
    exportPorts.set(share.id, configured)
  })
  const network = array(inventory.network?.addresses)
  const rows = []
  groups.forEach(group => {
    const obs = group.observation
    const linked = shares.filter(share => exportPorts.get(share.id)?.includes(group.port))
    const rawCount = group.raw?.linkedresourcecount ?? group.raw?.linkedResourceCount
    const count = rawCount !== undefined && rawCount !== null && Number.isInteger(Number(rawCount)) && Number(rawCount) >= 0 ? Number(rawCount) : null
    const referencesAvailable = !errors.instance && !errors.protocols && !errors.nfsExports && !pending.includes('protocols') && !pending.includes('nfsExports')
    group.linkedResourceCount = count
    group.exportNames = [...new Set(linked.map(share => text(share.name) || share.id))]
    group.referenceMismatch = referencesAvailable && count !== null && count !== linked.length
    const readError = !!errors.instance || (!!errors.health && !!(errors.inventory || errors.nvme))
    group.state = readError ? 'UNAVAILABLE' : obs.state
    if (readState.initialLoading && !obs.observations.length) group.state = 'LOADING'
    if (!group.enabled) group.state = obs.state === 'READY' ? 'CONFLICT' : 'DISABLED'
    group.modeConflict = obs.observedMode !== 'UNKNOWN' && group.configuredMode !== 'UNKNOWN' && obs.observedMode !== group.configuredMode
    group.canDelete = group.registered && referencesAvailable && !readState.protected && !readState.refreshing &&
      !group.referenceMismatch && count === 0 && linked.length === 0 && !group.modeConflict &&
      ((group.state === 'READY' && obs.observedMode !== 'UNKNOWN') || (group.state === 'DISABLED' && obs.observations.length === 0 && !errors.health && !errors.nvme && !errors.inventory))
    group.deleteRecord = group.registered
      ? { id: group.id, listenIp: group.listenIp, port: group.port, protocol: 'NFS', linkedResourceCount: count, canDelete: group.canDelete, raw: group.raw }
      : null
    const supplied = array(group.raw?.effectiveendpoints ?? group.raw?.effectiveEndpoints)
    let candidates = supplied.map(value => ({ address: address(value.ipaddress ?? value.ipAddress ?? value.ip), port: numberPort(value.port ?? group.port), role: text(value.role) || 'UNKNOWN', addressSource: 'API' }))
    if (!candidates.length && !wildcard(group.listenIp)) candidates = [{ address: group.listenIp, port: group.port, role: 'DEDICATED', addressSource: 'CONFIGURED' }]
    if (!candidates.length) candidates = network.map(value => ({ address: address(value.ipaddress), port: group.port, role: text(value.role).toUpperCase() || 'UNKNOWN', addressSource: 'RUNTIME' }))
    if (!candidates.length) candidates = [{ address: '', port: group.port, role: 'UNKNOWN', addressSource: 'UNKNOWN' }]
    const seen = new Set()
    group.rows = candidates.filter(value => value.port && !wildcard(value.address) && !seen.has(nfsEndpoint(value.address, value.port)) && seen.add(nfsEndpoint(value.address, value.port)))
    if (!group.rows.length) group.rows = [{ address: '', port: group.port, role: 'UNKNOWN', addressSource: 'UNKNOWN' }]
    group.rows = group.rows.map(value => {
      const actualBind = obs.listenIp ? nfsEndpoint(obs.listenIp, obs.port) : '—'
      // An IPv4 wildcard observation alone cannot prove an IPv6 listener.
      const familyUnverified = value.address.includes(':') && obs.listenIp === '0.0.0.0' && !array(obs.families).includes('IPv6')
      const state = familyUnverified && group.state === 'READY' ? 'NOT_OBSERVED' : group.state
      return {
        ...value,
        key: JSON.stringify([group.key, value.address, value.port]),
        groupKey: group.key,
        family: value.address ? value.address.includes(':') ? 'IPv6' : 'IPv4' : 'UNKNOWN',
        endpoint: nfsEndpoint(value.address, value.port),
        actualBind,
        state,
        configuredBind: nfsEndpoint(group.listenIp, group.port),
        observedMode: obs.observedMode || 'UNKNOWN',
        observedAt: obs.observedAt || null,
        partial: !!obs.partial || !!errors.instance || !!errors.protocols || !!errors.nfsExports,
        canDelete: group.canDelete && !familyUnverified
      }
    })
    rows.push(...group.rows)
  })
  shares.forEach(share => {
    const matched = groups.filter(group => group.registered && exportPorts.get(share.id)?.includes(group.port))
    exportGroups[share.id] = {
      groups: matched,
      groupCount: matched.length,
      addressCount: new Set(matched.flatMap(group => group.rows.map(row => row.endpoint).filter(value => value !== '—'))).size,
      incomplete: !!errors.protocols || !!errors.nfsExports || pending.includes('protocols') || !exportPorts.get(share.id)?.length ||
        exportPorts.get(share.id).some(port => !matched.some(group => group.port === port))
    }
  })
  return { groups, rows, exportGroups, groupCount: groups.length, registeredCount: registered.length }
}
