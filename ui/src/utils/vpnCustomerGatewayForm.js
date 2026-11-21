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
import { isValidIPv4Cidr } from '@/utils/util'

export function validGatewayPeer (peer) {
  if (!peer || peer.length > 190) return false
  if (/^(?:\d+\.){3}\d+$/.test(peer)) {
    return peer.split('.').every(part => /^(?:0|[1-9]\d{0,2})$/.test(part) && Number(part) <= 255)
  }
  return peer.split('.').every(part => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(part))
}

export function gatewayCidrParts (value) {
  return String(value || '').split(',').map(part => part.trim())
}

export function validateGatewayCidrs (value) {
  return Promise.all(gatewayCidrParts(value).map(part => isValidIPv4Cidr(null, part)))
}

export function validGatewayLifetime (value) {
  const text = String(value ?? '').trim()
  return text === '' || /^\d+$/.test(text) && Number(text) <= 86400
}
