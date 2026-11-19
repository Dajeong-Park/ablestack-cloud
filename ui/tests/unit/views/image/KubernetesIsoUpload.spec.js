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

import { kubernetesLocalErrors, kubernetesLocalParams, kubernetesLocalTicket, findLocalKubernetesVersion } from '@/utils/kubernetesIsoUpload'
import Upload from '@/views/image/UploadKubernetesIso'
import { getAPI, postAPI } from '@/api'
import { axios } from '@/utils/request'
import { probeSsvmCert } from '@/utils/ssvmProbe'
jest.mock('@/api', () => ({ getAPI: jest.fn(), postAPI: jest.fn() }))
jest.mock('@/utils/request', () => ({ axios: { post: jest.fn() } }))
jest.mock('@/utils/ssvmProbe', () => ({ probeSsvmCert: jest.fn() }))
const zone = '11111111-1111-4111-8111-111111111111'
const id = '22222222-2222-4222-8222-222222222222'
const iso = '33333333-3333-4333-8333-333333333333'
const row = { id, name: 'Local', semanticversion: '1.30.0', isoid: iso, zoneid: zone, zonename: 'Zone', arch: 'aarch64', mincpunumber: 2, minmemory: 2048, directdownload: false }
const ticket = extra => ({ getuploadparamsforkubernetessupportedversionresponse: { getuploadparams: { id: iso, postURL: 'https://upload.invalid/path', signature: 'test-signature', expires: new Date(Date.now() + 600000).toISOString(), metadata: 'test-metadata', ...extra } } })
let actorSequence = 0
function context () {
  const c = {
    ...Upload.data(),
    $store: { getters: { userInfo: { id: 'actor-' + (++actorSequence), roletype: 'Admin' }, apis: { listZones: {}, listIsos: {}, listKubernetesSupportedVersions: {}, getUploadParamsForKubernetesSupportedVersion: { params: ['name', 'semanticversion', 'zoneid', 'arch', 'checksum', 'format', 'mincpunumber', 'minmemory'].map(name => ({ name })) } } }, state: { user: { token: 'session' } } },
    $refs: { uploadForm: { validate: jest.fn().mockResolvedValue(), scrollToField: jest.fn() } },
    $t: k => k,
    $emit: jest.fn(),
    $router: { push: jest.fn() }
  }
  Object.entries(Upload.methods).forEach(([k, f]) => { c[k] = f.bind(c) })
  Object.entries(Upload.computed).forEach(([k, f]) => Object.defineProperty(c, k, { get: () => f.call(c), configurable: true }))
  Object.assign(c.form, { name: 'Local', semanticversion: '1.30.0', zoneid: zone, arch: 'aarch64' })
  c.zones = [{ id: zone, name: 'Zone', type: 'Advanced' }]
  c.files = [new File(['fixture'], 'fixture.iso')]
  return c
}
beforeEach(() => {
  jest.clearAllMocks(); probeSsvmCert.mockResolvedValue(true); axios.post.mockResolvedValue({})
  postAPI.mockResolvedValue(ticket())
  getAPI.mockImplementation(async api => api === 'listKubernetesSupportedVersions' ? { listkubernetessupportedversionsresponse: { count: 1, kubernetessupportedversion: [row] } } : { listisosresponse: { count: 1, iso: [{ id: iso, zoneid: zone, arch: 'aarch64', isready: true }] } })
})
test.each([[], [new File([], 'empty.iso')], [new File(['data'], 'wrong.txt')], [new File(['a'], 'a.iso'), new File(['b'], 'b.iso')]].map(files => ({ files })))('exactly one nonempty ISO is validated before ticket allocation', ({ files }) => {
  const c = context(); c.files = files
  expect(kubernetesLocalErrors(c.form, files, c.zones, c.capability)).toHaveProperty('file')
  expect(() => kubernetesLocalParams(c.form, files, c.zones, c.$store.getters)).toThrow()
  expect(postAPI).not.toHaveBeenCalled()
})
test('replace/remove/multiple selection remains local and clears the previous draft file', () => {
  const c = context(); const a = new File(['A'], 'a.iso'); const b = new File(['B'], 'b.iso')
  c.beforeUpload(a); c.beforeUpload(b); expect(c.files).toEqual([b])
  c.removeFile(); expect(c.files).toEqual([]); expect(c.form.file).toBeUndefined()
  c.beforeUpload(a, [a, b]); c.beforeUpload(b, [a, b]); expect(c.files).toEqual([])
  expect(postAPI).not.toHaveBeenCalled()
})
test('CPU/RAM/checksum and unsupported architecture are field errors, false ownership is not inferred', () => {
  const c = context(); Object.assign(c.form, { mincpunumber: 1, minmemory: 2047, checksum: '0'.repeat(64), arch: 'unknown' })
  expect(kubernetesLocalErrors(c.form, c.files, c.zones, c.capability)).toMatchObject({ mincpunumber: 'message.kubernetes.iso.cpu.invalid', minmemory: 'message.kubernetes.iso.memory.invalid', checksum: 'message.kubernetes.iso.checksum.invalid', arch: 'message.kubernetes.iso.arch.invalid' })
})
test('arch payload is preserved and inherited project/account fields cannot own the catalog', () => {
  const c = context(); c.form.projectid = id; c.form.account = 'other'
  expect(kubernetesLocalParams(c.form, c.files, c.zones, c.$store.getters)).toMatchObject({ arch: 'aarch64', format: 'ISO' })
  expect(kubernetesLocalParams(c.form, c.files, c.zones, c.$store.getters).projectid).toBeUndefined()
})
test('double submission while validating or transferring allocates/transfers once and awaits the actual Promise', async () => {
  const c = context(); let validate, transfer
  c.$refs.uploadForm.validate.mockImplementation(() => new Promise(resolve => { validate = resolve }))
  axios.post.mockImplementationOnce(() => new Promise(resolve => { transfer = resolve }))
  const pending = c.handleSubmit(); await c.handleSubmit(); validate()
  for (let i = 0; i < 20; i++) await Promise.resolve()
  expect(c.phase).toBe('uploading'); expect(c.busy).toBe(true); expect(c.phase).not.toBe('done')
  transfer({}); await pending
  expect(postAPI).toHaveBeenCalledTimes(1); expect(axios.post).toHaveBeenCalledTimes(1); expect(c.phase).toBe('done'); expect(c.receipt.id).toBe(id); expect(c.ticket).toBeNull()
})
test('100 percent sent and parent Ready cannot substitute for server ISO readiness', async () => {
  const c = context()
  getAPI.mockImplementation(async api => api === 'listKubernetesSupportedVersions' ? { listkubernetessupportedversionsresponse: { count: 1, kubernetessupportedversion: [{ ...row, isostate: 'Ready' }] } } : { listisosresponse: { count: 1, iso: [{ id: iso, zoneid: zone, isready: false, status: 'Download Complete' }] } })
  await c.handleSubmit(); expect(c.phase).toBe('pending')
  expect(postAPI).toHaveBeenCalledTimes(1)
})
test('preflight retry reuses one unattempted ticket, expiration never sends the file', async () => {
  const c = context(); probeSsvmCert.mockResolvedValueOnce(false)
  await c.handleSubmit(); expect(c.phase).toBe('preflight')
  await c.retryUpload(); expect(c.phase).toBe('done'); expect(postAPI).toHaveBeenCalledTimes(1)
  const expired = context(); postAPI.mockResolvedValueOnce(ticket({ expires: '2000-01-01T00:00:00Z' }))
  await expired.handleSubmit(); expect(expired.phase).toBe('expired'); expect(expired.isoId).toBe(iso)
  expect(axios.post).toHaveBeenCalledTimes(1)
})
test.each(['interrupted', 'checksum mismatch'])('a %s consumes the client transfer attempt; retry only reads the same IDs', async message => {
  const c = context(); axios.post.mockRejectedValueOnce(new Error(message))
  await c.handleSubmit(); expect(c.phase).toBe('transferFailed'); expect(c.ticket).toBeNull()
  await c.retryUpload(); await c.handleSubmit(); await c.checkAccepted()
  expect(postAPI).toHaveBeenCalledTimes(1); expect(axios.post).toHaveBeenCalledTimes(1); expect(c.receipt.id).toBe(id)
})
test('a partial or empty ticket cannot start a file transfer or be silently registered again', async () => {
  const c = context(); postAPI.mockResolvedValueOnce({})
  await c.handleSubmit(); await c.handleSubmit()
  expect(c.phase).toBe('uncertain'); expect(axios.post).not.toHaveBeenCalled(); expect(postAPI).toHaveBeenCalledTimes(1)
})
test('parent lookup is tied to the actual allocated child ISO and cannot accept another same-name version', async () => {
  const c = context(); getAPI.mockResolvedValueOnce({ listkubernetessupportedversionsresponse: { count: 1, kubernetessupportedversion: [{ ...row, isoid: id }] } })
  await expect(findLocalKubernetesVersion(getAPI, { ...row, arch: 'aarch64' }, iso, c.$store.getters, {})).rejects.toThrow()
})
test('a context change prevents a delayed ticket from transmitting or refreshing the next account', async () => {
  const c = context(); let finish; postAPI.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const pending = c.handleSubmit(); for (let i = 0; i < 10; i++) await Promise.resolve()
  c.$store.getters.userInfo.id = 'next'; Upload.watch.registrationScope.handler.call(c); finish(ticket()); await pending
  expect(c.phase).toBe('contextChanged'); expect(c.isoId).toBe(''); expect(axios.post).not.toHaveBeenCalled()
})
test('read-only account cannot allocate even from a standalone modal', async () => {
  const c = context(); c.$store.getters.userInfo.roletype = 'User'; await c.handleSubmit()
  expect(postAPI).not.toHaveBeenCalled(); expect(c.$refs.uploadForm.validate).not.toHaveBeenCalled()
})
test('ticket origin checks preserve normal certificate verification and reject userinfo', () => {
  expect(() => kubernetesLocalTicket(ticket({ postURL: 'https://user:password@upload.invalid/path' }))).toThrow()
  const c = context(); c.ticket = kubernetesLocalTicket(ticket()); expect(c.uploadOrigin).toBe('https://upload.invalid')
})

test('reopening an unfinished local attempt never allocates another ticket or reuses its transfer URL', async () => {
  const c = context(); probeSsvmCert.mockResolvedValueOnce(false); await c.handleSubmit()
  const reopened = context(); reopened.$store = c.$store; reopened.files = c.files
  await reopened.handleSubmit()
  expect(postAPI).toHaveBeenCalledTimes(1); expect(reopened.isoId).toBe(iso); expect(reopened.ticket).toBeNull()
})
