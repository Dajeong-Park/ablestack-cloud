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

import { kmsUsage } from './kmsRelated'

export function kmsDeleteBlock (kind, resource) {
  const usage = kmsUsage(kind, resource)
  if (!usage) return 'usageUnavailable'
  if (kind === 'kmskey') {
    if (usage.volumecount > 0) return 'usedVolumes'
    if (usage.wrappedkeycount > 0) return 'wrappedKeys'
  } else {
    if (usage.kmskeycount > 0) return 'usedKeys'
    if (usage.versionwrappedkeycount > 0) return 'versionWrappedKeys'
  }
  return ''
}

export function kmsRiskTargetChanged (reviewed, latest) {
  return ['name', 'enabled', 'version', 'keybits', 'hsmprofileid', 'protocol', 'ispublic'].some(field => (reviewed[field] ?? null) !== (latest[field] ?? null))
}

export function kmsReferenceName (name, id) {
  return [name, id && id !== name ? id : null].filter(Boolean).join(' · ')
}
