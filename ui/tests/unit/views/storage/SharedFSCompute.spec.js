// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements. See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership. The ASF licenses this file
// to you under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and limitations under the License.

import { getAPI, postAPI } from '@/api'
import SharedFSCompute from '@/views/storage/SharedFSCompute.vue'

jest.mock('@/api', () => ({ getAPI: jest.fn(), postAPI: jest.fn() }))

describe('SharedFS compute operation errors', () => {
  afterEach(() => jest.restoreAllMocks())

  it('keeps the async job error when the operation lookup also fails', async () => {
    const wait = jest.spyOn(global, 'setTimeout').mockImplementation(callback => callback())
    postAPI.mockResolvedValueOnce({ changesharedfilesystemserviceofferingresponse: { jobid: 'job-uuid' } })
    getAPI.mockResolvedValueOnce({
      queryasyncjobresultresponse: { jobstatus: 2, jobresult: { errortext: 'Database insert failed' } }
    }).mockRejectedValueOnce({
      response: { data: { errorresponse: { errortext: 'COMPUTE_OPERATION_NOT_FOUND' } } }
    })
    const component = {
      ...SharedFSCompute.data(),
      ...SharedFSCompute.methods,
      resource: { id: 'sharedfs-uuid' },
      plan: { state: 'PLANNED', planfingerprint: 'approved-plan', planexpires: 12345 },
      params: () => ({ id: 'sharedfs-uuid', cpunumber: 4 }),
      canApprove: true,
      approved: true
    }

    await component.submit()

    expect(wait).toHaveBeenCalledTimes(1)
    expect(getAPI).toHaveBeenNthCalledWith(2, 'getSharedFileSystemComputeStatus',
      { id: 'sharedfs-uuid', requestid: component.request.requestid }, { preserveOnFailure: true })
    expect(component.error).toBe('Database insert failed')
    expect(component.busy).toBe(false)
  })
})
