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

import { validKubernetesVersion, validKubernetesInteger, validKubernetesChecksum } from '@/utils/kubernetesIsoRegistration'
import { kubernetesIsoCapability, kubernetesIsoRegistrationParams } from '@/utils/kubernetesIsoCapabilities'
import { kubernetesIsoUploadResponse, kubernetesIsoListResponse } from '@/utils/kubernetesIsoModel'
import { uploadTicketExpired } from '@/utils/isoRegistration'
const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value)
export function kubernetesLocalErrors (form, files, zones, capability) {
  const errors = {}
  if (!validKubernetesVersion(form.semanticversion)) errors.semanticversion = 'message.kubernetes.iso.version.invalid'
  if (!String(form.name || '').trim()) errors.name = 'message.error.name'
  if (!validKubernetesInteger(form.mincpunumber, 2)) errors.mincpunumber = 'message.kubernetes.iso.cpu.invalid'
  if (!validKubernetesInteger(form.minmemory, 2048)) errors.minmemory = 'message.kubernetes.iso.memory.invalid'
  if (!validKubernetesChecksum(form.checksum)) errors.checksum = 'message.kubernetes.iso.checksum.invalid'
  if (!uuid(form.zoneid) || !zones.some(z => z.id === form.zoneid && z.type !== 'Edge')) errors.zoneid = 'message.error.select'
  if (!Array.isArray(files) || files.length !== 1 || !(files[0]?.size > 0) || !/\.iso(?:\.(?:gz|bz2|zip|xz))?$/i.test(files[0]?.name || '')) errors.file = 'message.kubernetes.iso.local.file'
  if (!['x86_64', 'aarch64', 's390x'].includes(form.arch) || capability.schemaKnown && !capability.parameters.arch && form.arch !== 'x86_64') errors.arch = 'message.kubernetes.iso.arch.invalid'
  return errors
}
export function kubernetesLocalParams (form, files, zones, getters) {
  const capability = kubernetesIsoCapability('local', getters)
  if (!capability.available) throw new Error('message.kubernetes.iso.read.forbidden')
  const errors = kubernetesLocalErrors(form, files, zones, capability)
  if (Object.keys(errors).length) throw new Error(Object.values(errors)[0])
  return kubernetesIsoRegistrationParams('local', { ...form, name: form.name.trim(), semanticversion: form.semanticversion.trim(), checksum: form.checksum?.trim(), mincpunumber: Number(form.mincpunumber), minmemory: Number(form.minmemory) }, getters)
}
export function kubernetesLocalTicket (json) {
  const ticket = kubernetesIsoUploadResponse(json)
  const url = new URL(ticket.postURL)
  if (!uuid(ticket.id) || !['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('message.kubernetes.iso.read.invalid')
  if (uploadTicketExpired(ticket)) throw new Error('message.iso.ticket.expired')
  return ticket
}
export async function findLocalKubernetesVersion (request, params, isoid, getters, options, current = () => true) {
  if (!kubernetesIsoCapability('read', getters).available) throw new Error('message.kubernetes.iso.read.forbidden')
  const json = await request('listKubernetesSupportedVersions', { keyword: params.name, page: 1, pagesize: 500 }, options)
  if (!current()) return null
  const page = kubernetesIsoListResponse(json, getters)
  if (!page.countKnown || page.count !== page.rows.length) throw new Error('message.kubernetes.iso.read.invalid')
  const rows = page.rows.filter(row => row.isoid === isoid)
  if (rows.length !== 1) throw new Error('message.kubernetes.iso.read.invalid')
  const row = rows[0]
  if (row.name !== params.name || row.semanticversion !== params.semanticversion || row.zoneid !== params.zoneid || row.arch !== (params.arch || 'x86_64') ||
      row.directdownload !== false || Number(row.mincpunumber) !== params.mincpunumber || Number(row.minmemory) !== params.minmemory) throw new Error('message.kubernetes.iso.read.invalid')
  return row
}
