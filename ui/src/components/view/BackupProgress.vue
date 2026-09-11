<!--
  Licensed to the Apache Software Foundation (ASF) under one
  or more contributor license agreements.  See the NOTICE file
  distributed with this work for additional information
  regarding copyright ownership.  The ASF licenses this file
  to you under the Apache License, Version 2.0 (the
  "License"); you may not use this file except in compliance
  with the License.  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing,
  software distributed under the License is distributed on an
  "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
  KIND, either express or implied.  See the License for the
  specific language governing permissions and limitations
  under the License.
-->
<template>
  <div class="backup-progress">
    <status :text="displayStatus" displayText :styles="{ 'min-width': '80px' }">
      <template #tooltip>
        <div class="backup-progress-tooltip">
          <div class="backup-progress-tooltip-title">{{ displayStatus }}</div>
          <div v-if="hasProgress" class="backup-progress-tooltip-row">
            <span>{{ $t('label.progress') }} :</span>
            <span>{{ progress }}%</span>
          </div>
          <div v-if="jobState" class="backup-progress-tooltip-row">
            <span>{{ $t('label.state') }} :</span>
            <span>{{ jobState }}</span>
          </div>
          <div v-if="step" class="backup-progress-tooltip-row">
            <span>{{ $t('label.step') }} :</span>
            <span>{{ step }}</span>
          </div>
          <div v-if="logPath" class="backup-progress-tooltip-row">
            <span>{{ $t('label.path') }} :</span>
            <span>{{ logPath }}</span>
          </div>
        </div>
      </template>
    </status>
    <div v-if="hasProgress && isActive" class="backup-progress-line">
      <a-progress
        :percent="progress"
        :showInfo="false"
        size="small"
        status="active" />
      <span class="backup-progress-percent">{{ progress }}%</span>
    </div>
  </div>
</template>

<script>
import { getAPI } from '@/api'
import Status from '@/components/widgets/Status'

const POLL_INTERVAL_MS = 5000

export default {
  name: 'BackupProgress',
  components: {
    Status
  },
  props: {
    record: {
      type: Object,
      required: true
    },
    statusText: {
      type: String,
      default: ''
    }
  },
  data () {
    return {
      timer: null,
      localStatus: String(this.record?.status || this.statusText || ''),
      progress: this.normalizeProgress(this.record?.backupjobprogress ?? this.record?.progress),
      jobState: this.record?.backupjobstate || '',
      step: this.record?.backupjobstep || '',
      logPath: this.record?.backupjoblogpath || this.record?.restorejoblogpath || '',
      restoreJobId: this.record?.restorejobid || '',
      restoreFinished: this.isTerminalJobState(this.record?.restorejobstate)
    }
  },
  computed: {
    displayStatus () {
      const status = this.localStatus || String(this.record?.status || this.statusText || '')
      if (this.isRestoring) {
        return 'Restoring'
      }
      return status
    },
    isActive () {
      const status = String(this.localStatus || this.record?.status || '').toLowerCase()
      return ['backingup', 'restoring'].includes(status) || this.hasTrackedRestoreJob
    },
    isRestoring () {
      const status = String(this.localStatus || this.record?.status || '').toLowerCase()
      return status === 'restoring' || (this.hasTrackedRestoreJob && status !== 'backingup')
    },
    hasTrackedRestoreJob () {
      return !!this.restoreJobId && !this.restoreFinished
    },
    hasProgress () {
      return this.progress !== null
    }
  },
  watch: {
    record: {
      deep: true,
      handler () {
        this.syncFromRecord()
        this.restartPolling()
      }
    }
  },
  mounted () {
    this.restartPolling()
  },
  beforeUnmount () {
    this.stopPolling()
  },
  methods: {
    restartPolling () {
      this.stopPolling()
      if (this.shouldPoll()) {
        this.fetchStatus()
        this.timer = window.setInterval(this.fetchStatus, POLL_INTERVAL_MS)
      }
    },
    shouldPoll () {
      const api = this.isRestoring ? 'getBackupRestoreJobStatus' : 'getBackupJobStatus'
      return this.isActive && this.record?.id && (api in this.$store.getters.apis)
    },
    stopPolling () {
      if (this.timer) {
        window.clearInterval(this.timer)
        this.timer = null
      }
    },
    syncFromRecord () {
      this.localStatus = String(this.record?.status || this.statusText || this.localStatus || '')
      this.restoreJobId = this.record?.restorejobid || this.restoreJobId
      if (this.isTerminalJobState(this.record?.restorejobstate)) {
        this.restoreFinished = true
      }
      const progress = this.normalizeProgress(this.record?.backupjobprogress ?? this.record?.progress)
      if (progress !== null) {
        this.progress = progress
      }
      this.jobState = this.record?.restorejobstate || this.record?.backupjobstate || this.jobState
      this.step = this.record?.backupjobstep || this.step
      this.logPath = this.record?.restorejoblogpath || this.record?.backupjoblogpath || this.logPath
    },
    fetchStatus () {
      if (!this.shouldPoll()) {
        this.stopPolling()
        return
      }
      const api = this.isRestoring ? 'getBackupRestoreJobStatus' : 'getBackupJobStatus'
      const responseKey = this.isRestoring ? 'getbackuprestorejobstatusresponse' : 'getbackupjobstatusresponse'
      getAPI(api, {
        id: this.record.id,
        limit: 5
      }).then(json => {
        const response = json?.[responseKey] || {}
        this.applyStatus(response)
      }).catch(() => {
        this.stopPolling()
      })
    },
    applyStatus (response) {
      const wasRestoring = this.isRestoring
      if (wasRestoring) {
        this.localStatus = this.isTerminalJobState(response.state) ? String(response.status || this.record?.status || this.statusText || '') : 'Restoring'
      } else if (response.status) {
        this.localStatus = response.status
      }
      this.jobState = response.state || this.jobState
      this.step = response.step || this.step
      this.logPath = response.logpath || this.logPath
      if (Object.prototype.hasOwnProperty.call(response, 'progress')) {
        this.progress = this.normalizeProgress(response.progress)
      }
      if (wasRestoring && this.isTerminalJobState(response.state)) {
        this.restoreFinished = true
      }
      if (!this.isActive) {
        this.stopPolling()
      }
    },
    isTerminalJobState (state) {
      return ['completed', 'failed', 'canceled', 'cancelled', 'interrupted'].includes(String(state || '').toLowerCase())
    },
    normalizeProgress (value) {
      const progress = Number.parseInt(value, 10)
      if (!Number.isFinite(progress)) {
        return null
      }
      return Math.min(Math.max(progress, 0), 100)
    }
  }
}
</script>

<style scoped>
.backup-progress {
  min-width: 120px;
}

.backup-progress-line {
  align-items: center;
  display: flex;
  gap: 6px;
  margin-top: 4px;
  max-width: 180px;
}

.backup-progress-line :deep(.ant-progress) {
  flex: 1;
  margin: 0;
  min-width: 72px;
}

.backup-progress-percent {
  color: rgba(0, 0, 0, 0.65);
  font-size: 12px;
  line-height: 1;
  white-space: nowrap;
}

.backup-progress-tooltip {
  max-width: 360px;
}

.backup-progress-tooltip-title {
  font-weight: 600;
  margin-bottom: 4px;
}

.backup-progress-tooltip-row {
  display: flex;
  gap: 6px;
}
</style>
