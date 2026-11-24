// Licensed to the Apache Software Foundation (ASF) under one or more
// contributor license agreements. See the NOTICE file for copyright ownership.
// Licensed under the Apache License, Version 2.0 (the "License"). You may obtain
// a copy of the License at http://www.apache.org/licenses/LICENSE-2.0.

import { runtimeCatalogFilters, runtimeCatalogReadParams } from '@/utils/runtimeCatalog'

test('builds catalogue filters from canonical option values and a trimmed keyword', () => {
  expect(runtimeCatalogFilters({ state: 'DRAFT', validationstatus: 'UNVERIFIED', keyword: '  audit-key  ' }))
    .toEqual({ state: 'DRAFT', validationstatus: 'UNVERIFIED', keyword: 'audit-key' })
  expect(runtimeCatalogFilters({ state: 'draft', validationstatus: ['VERIFIED'], keyword: '' })).toEqual({})
})

test('loads catalogue details by ID and constrains list queries to the catalogue', () => {
  expect(runtimeCatalogReadParams({ id: 'bundle', page: 1, pagesize: 20, state: 'REVOKED' }))
    .toEqual({ purpose: 'catalog', page: 1, pagesize: 20, id: 'bundle' })
  expect(runtimeCatalogReadParams({ purpose: 'apply', sharedfilesystemid: 'other', page: 2, pagesize: 20, state: 'DRAFT' }))
    .toEqual({ purpose: 'catalog', page: 2, pagesize: 20, state: 'DRAFT' })
})
