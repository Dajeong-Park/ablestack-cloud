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

export function isEventMutation (api) {
  return api === 'archiveEvents' || api === 'deleteEvents'
}

export function canMutateEvents (api, rows, getters) {
  return isEventMutation(api) &&
    !!getters.apis?.[api] &&
    (api !== 'deleteEvents' || getters.features?.eventdeleteenabled === true) &&
    rows.length > 0 && rows.every(row => row?.id && !row.archived)
}

export function eventMutationError (error) {
  const responses = Object.values(error?.response?.data || {})
  const description = responses.find(response => response?.errortext)?.errortext
  switch (description) {
    case 'Archived events cannot be deleted.':
    case 'Archived events cannot be archived again.':
      return 'message.events.action.archived'
    case 'Event deletion is disabled.':
      return 'message.events.action.delete.disabled'
    case 'One or more selected events are unavailable.':
      return 'message.events.action.unavailable'
    default:
      return 'message.events.action.failed'
  }
}
