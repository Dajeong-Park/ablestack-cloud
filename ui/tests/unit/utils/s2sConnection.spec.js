// Licensed to the Apache Software Foundation (ASF) under one or more
// contributor license agreements. See NOTICE for copyright ownership.
// Licensed under the Apache License, Version 2.0 (the "License");
// http://www.apache.org/licenses/LICENSE-2.0 . Distributed AS IS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND.
import { vpnCandidateChanged, vpnCandidateConflict, vpnCandidateOwner, vpnConnectionState } from '@/utils/s2sConnection'

test.each([
  ['Pending', true, 'connecting'],
  ['Connecting', true, 'connecting'],
  ['Connected', true, 'connected'],
  ['Disconnected', true, 'waiting'],
  ['Disconnected', 'true', 'waiting'],
  ['Disconnected', false, 'disconnected'],
  ['Error', true, 'error'],
  ['Removed', false, 'removed']
])('uses the reported %s state with passive=%s', (state, passive, expected) => {
  expect(vpnConnectionState({ state, passive })).toBe('label.s2s.connection.state.' + expected)
})

test('CIDR comparison handles noncanonical host bits, adjacent ranges, /32, and /0', () => {
  const peer = { id: 'peer', cidrlist: '198.51.100.129/25, 203.0.113.3/32' }
  expect(vpnCandidateConflict(peer, '198.51.100.0/25', [])).toBeNull()
  expect(vpnCandidateConflict(peer, '', [{ cidrlist: '203.0.113.0/29' }])).toEqual({
    code: 'peer.overlap', remote: '203.0.113.3/32', existing: '203.0.113.0/29'
  })
  expect(vpnCandidateConflict(peer, '0.0.0.0/0', []).code).toBe('vpc.overlap')
  expect(vpnCandidateConflict(peer, '0.0.0.0/0', [{ s2scustomergatewayid: 'peer' }])).toEqual({ code: 'duplicate' })
  expect(vpnCandidateConflict({ id: 'peer', cidrlist: '2001:db8::/64' }, '0.0.0.0/0', [])).toBeNull()
})

test('matches the entire owner and ignores CIDR ordering when checking for changes', () => {
  const owner = { account: 'root', domainid: 'domain' }
  const a = { ...owner, id: 'same', cidrlist: '192.0.2.0/24,198.51.100.0/24' }
  expect(vpnCandidateOwner(a, { ...owner, domainid: 'other' })).toBe(false)
  expect(vpnCandidateOwner({ projectid: 'one' }, { projectid: 'two' })).toBe(false)
  expect(vpnCandidateChanged(a, { ...a, cidrlist: '198.51.100.0/24, 192.0.2.0/24' })).toBe(false)
  expect(vpnCandidateChanged(a, { ...a, gateway: '192.0.2.1' })).toBe(true)
})
