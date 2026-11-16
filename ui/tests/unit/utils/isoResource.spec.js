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

import { readIsoResource, isoListResponse } from '@/utils/isoModel'
const id = 'iso'; const zone = 'zone'
const row = { id, zoneid: zone, isready: true }
test('shared private ISO uses the shared filter when executable lookup is empty, preserving scope and pagination', async () => {
  const request = jest.fn().mockResolvedValueOnce({ listisosresponse: { count: 1 } }).mockResolvedValueOnce({ listisosresponse: { count: 1, iso: [row] } })
  const response = await readIsoResource(request, { id, page: 2, pagesize: 10 }, { userInfo: { roletype: 'User' }, project: { id: 'project' } })
  expect(request.mock.calls[1][1]).toEqual({ id, page: 2, pagesize: 10, showunique: false, projectid: 'project', isofilter: 'shared' })
  const result = isoListResponse(response); expect(result.count).toBe(1); expect(result.rows).toHaveLength(1); expect(result.rows[0].downloaddetails).toEqual([])
})
test.each(['Admin', 'DomainAdmin', 'ResourceAdmin'])('%s lookup uses all and never widens an empty scope with another request', async roletype => {
  const request = jest.fn().mockResolvedValue({ listisosresponse: {} })
  await readIsoResource(request, { id }, { userInfo: { roletype }, project: { id: 'p' } })
  expect(request.mock.calls[0][1]).toMatchObject({ id, isofilter: 'all', projectid: 'p', showunique: false }); expect(request).toHaveBeenCalledTimes(1)
})
test('a revoked ISO can produce a verified empty shared result without retaining an old row', async () => {
  const request = jest.fn().mockResolvedValue({ listisosresponse: { count: 0 } })
  expect(isoListResponse(await readIsoResource(request, { id }))).toMatchObject({ rows: [], count: 0 })
})
test.each([{}, { errorresponse: { errorcode: 530 } }, { listisosresponse: { iso: {} } }])('malformed/denied payload is not converted into shared/empty success', async reply => {
  const request = jest.fn().mockResolvedValue(reply); await expect(readIsoResource(request, { id })).rejects.toThrow(); expect(request).toHaveBeenCalledTimes(1)
})
test('a read error never retries an unauthorized command automatically', async () => {
  const request = jest.fn().mockRejectedValue(new Error('permission denied')); await expect(readIsoResource(request, { id })).rejects.toThrow('permission denied'); expect(request).toHaveBeenCalledTimes(1)
})
test('late responses after actor/project changes cannot start a fallback request', async () => {
  const request = jest.fn().mockResolvedValue({ listisosresponse: {} }); expect(await readIsoResource(request, { id }, {}, () => false)).toBeNull(); expect(request).toHaveBeenCalledTimes(1)
})
