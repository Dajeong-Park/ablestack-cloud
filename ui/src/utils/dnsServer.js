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

const listKeys = ['keyword', 'q', 'providertype', 'page', 'pagesize']

export function dnsServerListQuery (query = {}) {
  return Object.fromEntries(listKeys.filter(key => typeof query[key] === 'string' && query[key].trim()).map(key => [key, query[key]]))
}

export function dnsServerSearchQuery (current, options, pageSize) {
  const query = dnsServerListQuery(current)
  if (Object.hasOwn(options, 'searchQuery')) {
    const keyword = options.searchQuery?.trim()
    delete query.keyword
    delete query.q
    if (keyword) query.keyword = query.q = keyword
  } else if (options.dnsServerReset) {
    delete query.keyword
    delete query.q
    delete query.providertype
  } else if (options.providertype) {
    query.providertype = options.providertype
  } else {
    delete query.providertype
  }
  return { ...query, page: '1', pagesize: String(pageSize) }
}

const FQDN_REGEX = /^(?=.{1,253}$)(?:(?!-)[A-Za-z0-9-]{1,63}(?<!-)\.)+[A-Za-z]{2,63}$/

export function normalizeDnsNameservers (values) {
  return (Array.isArray(values) ? values : []).map(value => value.toLowerCase().trim()).filter(Boolean)
}

export function dnsNameserverError (values) {
  const names = normalizeDnsNameservers(values).map(name => name.replace(/\.$/, ''))
  if (names.some(name => !FQDN_REGEX.test(name))) return 'message.dns.server.nameserver.invalid'
  if (names.length !== new Set(names).size) return 'message.dns.server.nameserver.duplicate'
  return ''
}
