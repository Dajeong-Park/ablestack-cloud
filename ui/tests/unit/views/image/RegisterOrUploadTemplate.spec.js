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

import { flushPromises } from '@vue/test-utils'
import { api } from '@/api'
import { probeSsvmCert } from '@/utils/ssvmProbe'
import TemplateForm from '@/views/image/RegisterOrUploadTemplate'

jest.mock('@/api', () => ({ api: jest.fn() }))
jest.mock('@/utils/ssvmProbe', () => ({ probeSsvmCert: jest.fn() }))
jest.mock('@/store', () => ({ getters: { userInfo: { roletype: 'Admin' } } }))
jest.mock('@/utils/request', () => ({ axios: { post: jest.fn() } }))

const zones = [
  { id: 'zone-1', name: 'First zone', type: 'Core' },
  { id: 'zone-2', name: 'Second zone', type: 'Core' },
  { id: 'edge-1', name: 'Edge zone', type: 'Edge' }
]

const context = mode => {
  const ctx = {
    currentForm: mode,
    rootAdmin: 'Admin',
    $t: key => key,
    zones: { opts: [], loading: false },
    form: {},
    fetchHyperVisor: jest.fn()
  }
  Object.defineProperty(ctx, 'filteredZones', {
    get: () => TemplateForm.computed.filteredZones.call(ctx)
  })
  return ctx
}

beforeEach(() => {
  jest.clearAllMocks()
  probeSsvmCert.mockResolvedValue(true)
  api.mockResolvedValue({ listzonesresponse: { zone: zones } })
})

describe('Template local upload zones', () => {
  it('offers All Zones and non-edge zones and defaults to a concrete upload zone', async () => {
    const ctx = context('Upload')
    TemplateForm.methods.fetchZone.call(ctx)
    await flushPromises()

    expect(ctx.filteredZones.map(zone => zone.id)).toEqual(['label.all.zone', 'zone-1', 'zone-2'])
    expect(ctx.form.zoneid).toBe('zone-1')
    expect(ctx.fetchHyperVisor).toHaveBeenCalledWith({ zoneid: 'zone-1' })
  })

  it('keeps All Zones available for URL registration', async () => {
    const ctx = context('Create')
    TemplateForm.methods.fetchZone.call(ctx)
    await flushPromises()

    expect(ctx.zones.opts[0].id).toBe('label.all.zone')
    expect(ctx.form.zoneid).toBe('zone-1')
  })

  it('keeps All Zones available when switching to upload', () => {
    const ctx = context('Upload')
    ctx.zones.opts = [{ id: 'label.all.zone' }, ...zones]
    expect(ctx.filteredZones.map(zone => zone.id)).toEqual(['label.all.zone', 'zone-1', 'zone-2'])
  })

  it('sends the selected SYSTEM type and actual zone to the upload API', async () => {
    const ctx = {
      ...context('Upload'),
      form: { zoneid: 'zone-1', templatetype: 'SYSTEM', name: 'systemvm', hypervisor: 0 },
      formRef: { value: { validate: jest.fn().mockResolvedValue(), scrollToField: jest.fn() } },
      handleRemoveFields: values => values,
      hyperVisor: { opts: [{ name: 'KVM' }] },
      fileList: [{}],
      userdataid: null,
      handleUpload: jest.fn(),
      $notifyError: jest.fn()
    }
    api.mockResolvedValue({ postuploadtemplateresponse: { getuploadparams: { postURL: 'https://ssvm/upload' } } })
    TemplateForm.methods.handleSubmit.call(ctx, { preventDefault: jest.fn() })
    await flushPromises()

    expect(api).toHaveBeenCalledWith('getUploadParamsForTemplate', expect.objectContaining({
      zoneid: 'zone-1', templatetype: 'SYSTEM', hypervisor: 'KVM'
    }))
    expect(ctx.handleUpload).toHaveBeenCalledTimes(1)
    expect(ctx.$notifyError).not.toHaveBeenCalled()
  })

  it('serializes All Zones as -1 and pauses before POST when the server is unreachable', async () => {
    const ctx = {
      ...context('Upload'),
      form: { zoneid: 'label.all.zone', templatetype: 'SYSTEM', name: 'systemvm', hypervisor: 0 },
      formRef: { value: { validate: jest.fn().mockResolvedValue(), scrollToField: jest.fn() } },
      handleRemoveFields: values => values,
      hyperVisor: { opts: [{ name: 'KVM' }] },
      fileList: [{}],
      userdataid: null,
      handleUpload: jest.fn(),
      $notifyError: jest.fn()
    }
    probeSsvmCert.mockResolvedValue(false)
    api.mockResolvedValue({ postuploadtemplateresponse: { getuploadparams: { postURL: 'https://ssvm/upload' } } })
    TemplateForm.methods.handleSubmit.call(ctx, { preventDefault: jest.fn() })
    await flushPromises()
    expect(api).toHaveBeenCalledWith('getUploadParamsForTemplate', expect.objectContaining({ zoneid: '-1', templatetype: 'SYSTEM' }))
    expect(ctx.ssvmCertUntrusted).toBe(true)
    expect(ctx.handleUpload).not.toHaveBeenCalled()
    expect(ctx.loading).toBe(false)
  })
})
