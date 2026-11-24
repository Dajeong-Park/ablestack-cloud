// Licensed to the Apache Software Foundation (ASF) under one or more
// contributor license agreements. See the NOTICE file for copyright ownership.
// Licensed under the Apache License, Version 2.0 (the "License"). You may obtain
// a copy of the License at http://www.apache.org/licenses/LICENSE-2.0.

export const runtimeCatalogApi = 'listStorageServiceRuntimeBundles'

export const runtimeCatalogChoices = {
  state: ['AVAILABLE', 'DISABLED', 'DRAFT', 'PUBLISHED', 'SUSPENDED', 'RETIRED', 'REVOKING', 'REVOKED'],
  validationstatus: ['UNVERIFIED', 'RUNNING', 'VERIFIED', 'FAILED', 'UNKNOWN']
}

export function runtimeCatalogFilters (input) {
  const filters = {}
  if (typeof input.keyword === 'string' && input.keyword.trim()) filters.keyword = input.keyword.trim()
  for (const [field, choices] of Object.entries(runtimeCatalogChoices)) {
    if (choices.includes(input[field])) filters[field] = input[field]
  }
  return filters
}

export function runtimeCatalogReadParams ({ id, page, pagesize, ...params }) {
  return { purpose: 'catalog', page, pagesize, ...(id ? { id } : runtimeCatalogFilters(params)) }
}
