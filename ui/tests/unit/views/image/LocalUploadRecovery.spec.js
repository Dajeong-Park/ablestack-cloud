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

import { api } from '@/api'
import { axios } from '@/utils/request'
import { probeSsvmCert } from '@/utils/ssvmProbe'
import TemplateForm from '@/views/image/RegisterOrUploadTemplate'
import IsoForm from '@/views/image/RegisterOrUploadIso'
import VolumeForm from '@/views/storage/UploadLocalVolume'

jest.mock('@/api', () => ({ api: jest.fn() }))
jest.mock('@/store', () => ({ getters: { userInfo: { roletype: 'Admin' } } }))
jest.mock('@/utils/request', () => ({ axios: { post: jest.fn() } }))
jest.mock('@/utils/ssvmProbe', () => ({ probeSsvmCert: jest.fn() }))

const context = () => ({
  fileList: [new Blob(['data'])],
  uploadParams: { id: 'template-id', postURL: 'https://ssvm/upload', signature: 'signed', expires: 'later', metadata: 'metadata' },
  userdataid: null,
  ssvmOrigin: 'https://ssvm',
  ssvmCertUntrusted: true,
  loading: false,
  uploading: false,
  $t: key => key,
  $notification: { success: jest.fn(), error: jest.fn() },
  $message: { warning: jest.fn() },
  $notifyError: jest.fn(),
  closeAction: jest.fn(),
  $emit: jest.fn(),
  handleUpload: jest.fn()
})

beforeEach(() => jest.clearAllMocks())

describe.each([['template', TemplateForm], ['ISO', IsoForm], ['volume', VolumeForm]])('%s upload recovery', (name, component) => {
  it('leaves progress mode and permits another attempt after a POST failure', async () => {
    const ctx = context()
    axios.post.mockImplementationOnce((url, data, options) => {
      options.onUploadProgress({ loaded: 100, total: 100 })
      return Promise.reject(new Error('connection lost'))
    })
    const result = component.methods.handleUpload.call(ctx)
    expect(ctx.uploading).toBe(true)
    expect(ctx.uploadPercentage).toBe(100)
    await result
    expect(ctx.uploading).toBe(false)
    expect(ctx.closeAction).not.toHaveBeenCalled()
    expect(ctx.$notification.success).not.toHaveBeenCalled()
  })

  it('does not POST until the retry probe succeeds', async () => {
    const ctx = context()
    probeSsvmCert.mockResolvedValueOnce(false)
    await component.methods.retryUpload.call(ctx)
    expect(ctx.handleUpload).not.toHaveBeenCalled()
    expect(ctx.ssvmCertUntrusted).toBe(true)
    probeSsvmCert.mockResolvedValueOnce(true)
    await component.methods.retryUpload.call(ctx)
    expect(ctx.handleUpload).toHaveBeenCalledTimes(1)
    expect(ctx.ssvmCertUntrusted).toBe(false)
  })

  it('blocks duplicate form submission while a POST is running', () => {
    const ctx = context()
    ctx.uploading = true
    ctx.formRef = { value: { validate: jest.fn() } }
    component.methods.handleSubmit.call(ctx, { preventDefault: jest.fn() })
    expect(ctx.formRef.value.validate).not.toHaveBeenCalled()
  })
})

it.each([TemplateForm, IsoForm])('links userdata with the ID returned by the upload API', async component => {
  const ctx = context()
  ctx.userdataid = 'userdata-id'
  ctx.userdatapolicy = 'allowoverride'
  axios.post.mockResolvedValue({})
  api.mockResolvedValue({})
  await component.methods.handleUpload.call(ctx)
  expect(api).toHaveBeenCalledWith('linkUserDataToTemplate', {
    userdataid: 'userdata-id', templateid: 'template-id', userdatapolicy: 'allowoverride'
  })
  expect(ctx.closeAction).toHaveBeenCalledTimes(1)
})
