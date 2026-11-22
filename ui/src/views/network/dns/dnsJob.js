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

import { postAPI } from '@/api'
import { networkError } from '@/utils/networkLifecycle'

export const dnsJob = {
  data () {
    return { jobId: '', jobTracking: '', jobError: '', jobLoading: false }
  },
  methods: {
    async submitDnsJob (api, params, title, description, onSuccess) {
      if (this.jobLoading) return
      this.jobLoading = true
      this.jobError = ''
      const retry = !!this.jobId
      try {
        if (!retry) {
          const response = await postAPI(api, params, { preserveOnFailure: true })
          this.jobId = response?.[api.toLowerCase() + 'response']?.jobid
          if (!this.jobId) {
            this.jobError = this.$t('message.dns.job.no.id')
            this.jobTracking = 'unconfirmed'
            return
          }
        }
        const result = await this.$pollJob({
          jobId: this.jobId,
          title: this.$t(title),
          description,
          retry,
          showSuccessMessage: true,
          action: { isFetchData: false, suppressErrorNotification: true }
        })
        if (result.jobstatus === 1) {
          this.jobId = ''
          this.jobTracking = ''
          onSuccess()
        } else if (result.jobstatus === 2) {
          this.jobId = ''
          this.jobTracking = ''
          this.jobError = result.jobresult?.errortext || this.$t('message.request.failed')
        } else {
          this.jobTracking = 'unknown'
          this.jobError = this.$t('message.dns.job.unknown', { id: this.jobId })
        }
      } catch (error) {
        const result = networkError(error)
        const status = error?.response?.status
        this.jobTracking = this.jobId ? 'unknown' : result.definitive || (status >= 400 && status < 500) ? '' : 'unconfirmed'
        this.jobError = result.text || this.$t('message.request.failed')
        if (this.jobTracking === 'unconfirmed') this.jobError += ' ' + this.$t('message.dns.job.no.id')
      } finally {
        this.jobLoading = false
      }
    }
  }
}
