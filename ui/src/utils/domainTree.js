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

export function domainTreeNodes (records, matchingOnly = false) {
  const nodes = new Map()
  for (const record of records) {
    const { icon, ...domain } = record
    nodes.set(domain.id, {
      ...domain,
      key: domain.id,
      title: domain.name,
      resourceIcon: icon || {},
      isLeaf: matchingOnly || !domain.haschild
    })
  }
  const roots = []
  for (const node of nodes.values()) {
    const parent = matchingOnly && nodes.get(node.parentdomainid)
    if (!parent || parent === node) {
      roots.push(node)
      continue
    }
    if (!parent.children) parent.children = []
    parent.children.push(node)
    parent.isLeaf = false
  }
  return roots
}

export function domainTreePath (nodes, id) {
  for (const node of nodes) {
    if (node.id === id) return [node]
    const path = domainTreePath(node.children || [], id)
    if (path.length) return [node, ...path]
  }
  return []
}
