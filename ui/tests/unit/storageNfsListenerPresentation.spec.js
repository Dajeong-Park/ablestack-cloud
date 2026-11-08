// Licensed to the Apache Software Foundation (ASF) under one or more
// contributor license agreements. See NOTICE. Apache License, Version 2.0.
import { buildNfsListenerPresentation as build, nfsEndpoint } from '@/utils/storageNfsListenerPresentation'
import actual from '../fixtures/storage-1463-observed.json'

const copy = value => JSON.parse(JSON.stringify(value))
const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value) }; return value }
const input = (index = 0) => {
  const row = copy(actual[index])
  return { ...row, now: Date.parse(row.inventory.generatedAt) + 1000 }
}
const changeObservations = (data, change) => {
  data.inventory.nfsGaneshaExports.forEach(change)
  data.health.nfsGanesha.endpoints.forEach(change)
}

describe('NFS presentation from captured cluster 13 API serialization', () => {
  test('uses structured addresses and actual observation without changing input or command identity', () => {
    const raw = freeze(input()); const before = JSON.stringify(raw)
    const result = build(raw)
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0]).toMatchObject({ endpoint: '10.10.13.227:2049', role: 'PRIMARY', observedMode: 'V4_ONLY', state: 'READY' })
    expect(result.groups[0]).toMatchObject({ linkedResourceCount: 2, canDelete: false })
    expect(result.groups[0].deleteRecord.raw).toBe(raw.protocols[0])
    expect(JSON.stringify(raw)).toBe(before)
    expect(() => JSON.stringify(result)).not.toThrow()
  })
  test('keeps the configured dedicated address separate from the actual wildcard bind on port 2050', () => {
    const result = build(input(1))
    expect(result.rows).toHaveLength(2)
    expect(result.rows[1]).toMatchObject({ configuredBind: '10.10.13.186:2050', actualBind: '0.0.0.0:2050', state: 'READY' })
    expect(result.groups.map(x => x.linkedResourceCount)).toEqual([1, 1])
  })
  test('preserves the observed DUAL mode and never derives versions from DB Ready', () => {
    expect(build(input(2)).rows[0].observedMode).toBe('V3V4_DUAL')
    const raw = input()
    raw.inventory.nfsGaneshaExports = []; raw.health.nfsGanesha.endpoints = []
    expect(build(raw).rows[0]).toMatchObject({ state: 'NOT_OBSERVED', observedMode: 'UNKNOWN' })
  })
  test('does not discard a registered same-port dedicated group covered by wildcard', () => {
    const raw = input()
    raw.protocols.push({ ...raw.protocols[0], id: 'dedicated', listenip: '10.10.13.227', listenertype: 'DEDICATED' })
    const model = build(raw)
    expect(model.groups).toHaveLength(2)
    expect(model.rows).toHaveLength(2)
    expect(model.groups.every(group => group.observation.state === 'READY')).toBe(true)
    expect(new Set(model.rows.map(row => row.key)).size).toBe(2)
  })
  test('keeps each address and stable keys; IPv6 is bracketed and needs family evidence', () => {
    const raw = input()
    raw.protocols[0].effectiveendpoints.push({ ipaddress: '10.10.13.228', port: 2049, role: 'ALIAS' }, { ipaddress: '2001:db8::227', port: 2049, role: 'ALIAS' })
    let model = build(raw)
    expect(model.rows.map(row => row.endpoint)).toEqual(['10.10.13.227:2049', '10.10.13.228:2049', '[2001:db8::227]:2049'])
    expect(model.rows[2].state).toBe('NOT_OBSERVED')
    changeObservations(raw, entry => { entry.families = ['IPv4', 'IPv6'] })
    model = build(raw)
    expect(model.rows[2].state).toBe('READY')
    raw.protocols[0].effectiveendpoints.reverse()
    expect(build(raw).rows.map(x => x.key).sort()).toEqual(model.rows.map(x => x.key).sort())
    expect(nfsEndpoint('[2001:db8::1]', 2050)).toBe('[2001:db8::1]:2050')
  })
  test('freshness has a deadline, rejects future/broken time and honors explicit stale', () => {
    const raw = input()
    raw.now += 40000
    expect(build(raw).rows[0].state).toBe('STALE')
    raw.now -= 40000
    changeObservations(raw, entry => { entry.observedAt = 'bad-time' })
    expect(build(raw).rows[0].state).toBe('STALE')
    changeObservations(raw, entry => { entry.observedAt = new Date(raw.now + 60000).toISOString() })
    expect(build(raw).rows[0].state).toBe('STALE')
    changeObservations(raw, entry => { delete entry.observedAt })
    raw.inventory.stale = true; raw.health.stale = true
    expect(build(raw).rows[0].state).toBe('STALE')
  })
  test('one listener failure does not become a whole-service failure', () => {
    const raw = input(1)
    changeObservations(raw, entry => { if (entry.port === 2050) entry.listening = false })
    expect(build(raw).rows.map(row => row.state)).toEqual(['READY', 'FAILED'])
    raw.readState = { errors: { health: 'network' } }
    expect(build(raw).rows[0]).toMatchObject({ state: 'READY', partial: true })
    raw.readState.errors.nvme = 'timeout'
    expect(build(raw).rows.every(row => row.state === 'UNAVAILABLE')).toBe(true)
    raw.readState = { errors: { instance: 'network' } }
    expect(build(raw).rows.every(row => row.state === 'UNAVAILABLE' && !row.canDelete)).toBe(true)
  })
  test('conflicting fresh sources and an ambiguous port cannot silently choose a winner', () => {
    const raw = input()
    raw.health.nfsGanesha.endpoints[0].listening = false
    expect(build(raw).rows[0].state).toBe('CONFLICT')
    raw.health.nfsGanesha.endpoints[0].listening = true
    raw.health.nfsGanesha.endpoints.push({ ...raw.health.nfsGanesha.endpoints[0], listenIp: '::' })
    raw.protocols[0].listenip = '10.10.13.227'
    expect(build(raw).rows[0].state).toBe('CONFLICT')
  })
  test('unknown modes stay unknown and do not become V4_ONLY', () => {
    const raw = input()
    raw.protocols[0].protocolmode = 'FUTURE_MODE'
    changeObservations(raw, entry => { delete entry.protocolMode })
    expect(build(raw).groups[0]).toMatchObject({ configuredMode: 'UNKNOWN', configuredModeRaw: 'FUTURE_MODE' })
    expect(build(raw).rows[0].observedMode).toBe('UNKNOWN')
  })
  test('runtime-only listeners have no delete target and unknown reference counts never become zero', () => {
    const raw = input()
    changeObservations(raw, entry => { entry.port = 2055 })
    const model = build(raw)
    expect(model.groups).toHaveLength(2)
    expect(model.groups[1]).toMatchObject({ registered: false, deleteRecord: null, canDelete: false })
    delete raw.protocols[0].linkedresourcecount
    expect(build(raw).groups[0]).toMatchObject({ linkedResourceCount: null, canDelete: false })
  })
  test('deduplicates Export identity and counts groups separately from addresses', () => {
    const raw = input(1)
    raw.exports[0].listenerports = '2049,2050'
    raw.exports.push(copy(raw.exports[0]))
    const model = build(raw)
    expect(model.exportGroups[raw.exports[0].id]).toMatchObject({ groupCount: 2, addressCount: 2, incomplete: false })
    expect(model.groups[0].exportNames).toHaveLength(1)
  })
  test('deletion uses the original group only after known fresh reference-free state', () => {
    const raw = input()
    raw.exports = []; raw.protocols[0].linkedresourcecount = 0
    const model = build(raw)
    expect(model.rows[0].canDelete).toBe(true)
    expect(model.groups[0].deleteRecord).toMatchObject({ listenIp: '0.0.0.0', port: 2049, protocol: 'NFS' })
    for (const readState of [{ protected: true }, { refreshing: true }, { errors: { nfsExports: 'network' } }, { pending: ['protocols'] }]) {
      expect(build({ ...raw, readState }).rows[0].canDelete).toBe(false)
    }
    raw.protocols[0].enabled = false
    expect(build(raw).rows[0].state).toBe('CONFLICT')
  })
  test('100 groups keep their complete addresses and do not default missing legacy mappings', () => {
    const raw = input()
    const protocol = raw.protocols[0]; const observed = raw.inventory.nfsGaneshaExports[0]
    raw.protocols = Array.from({ length: 100 }, (_, n) => ({ ...protocol, id: 'group-' + n, port: 2049 + n, effectiveendpoints: [{ ipaddress: '10.10.13.227', port: 2049 + n, role: 'PRIMARY' }] }))
    raw.inventory.nfsGaneshaExports = raw.protocols.map(x => ({ ...observed, port: x.port }))
    raw.health.nfsGanesha.endpoints = copy(raw.inventory.nfsGaneshaExports)
    const model = build(raw)
    expect(model.rows).toHaveLength(100)
    expect(new Set(model.rows.map(x => x.key)).size).toBe(100)
    raw.exports[0].listenerports = undefined
    expect(build(raw).exportGroups[raw.exports[0].id].incomplete).toBe(true)
  })
})
