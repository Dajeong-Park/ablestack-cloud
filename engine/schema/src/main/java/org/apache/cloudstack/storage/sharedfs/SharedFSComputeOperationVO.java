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
// specific language govening permissions and limitations
// under the License.

package org.apache.cloudstack.storage.sharedfs;

import java.util.Date;
import java.util.UUID;
import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.Lob;
import javax.persistence.Table;
import javax.persistence.Temporal;
import javax.persistence.TemporalType;

@Entity
@Table(name = "sharedfs_compute_operation")
public class SharedFSComputeOperationVO {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private long id;

    @Column(name = "uuid")
    private String uuid = UUID.randomUUID().toString();

    @Column(name = "sharedfs_id")
    private long sharedFsId;

    @Column(name = "instance_id")
    private long instanceId;

    @Column(name = "vm_id")
    private long vmId;

    @Column(name = "host_id")
    private long hostId;

    @Column(name = "account_id")
    private long accountId;

    @Column(name = "request_id")
    private String requestId;

    @Column(name = "plan_fingerprint")
    private String planFingerprint;

    @Column(name = "state")
    private String state;

    @Lob
    @Column(name = "plan_json", length = 16777215, columnDefinition = "MEDIUMTEXT")
    private String planJson;

    @Lob
    @Column(name = "observed_json", length = 16777215, columnDefinition = "MEDIUMTEXT")
    private String observedJson;

    @Column(name = "first_failure")
    private String firstFailure;

    @Column(name = "cpu_delta")
    private long cpuDelta;

    @Column(name = "core_delta")
    private long coreDelta;

    @Column(name = "memory_delta")
    private long memoryDelta;

    @Column(name = "job_id")
    private Long jobId;

    @Column(name = "created")
    private Date created = new Date();

    @Temporal(TemporalType.TIMESTAMP)
    @Column(name = "updated")
    private Date updated = new Date();

    public long getId() { return id; }
    public String getUuid() { return uuid; }
    public long getSharedFsId() { return sharedFsId; }
    public void setSharedFsId(long value) { sharedFsId = value; }
    public long getInstanceId() { return instanceId; }
    public void setInstanceId(long value) { instanceId = value; }
    public long getVmId() { return vmId; }
    public void setVmId(long value) { vmId = value; }
    public long getHostId() { return hostId; }
    public void setHostId(long value) { hostId = value; }
    public long getAccountId() { return accountId; }
    public void setAccountId(long value) { accountId = value; }
    public String getRequestId() { return requestId; }
    public void setRequestId(String value) { requestId = value; }
    public String getPlanFingerprint() { return planFingerprint; }
    public void setPlanFingerprint(String value) { planFingerprint = value; }
    public String getState() { return state; }
    public void setState(String value) { state = value; }
    public String getPlanJson() { return planJson; }
    public void setPlanJson(String value) { planJson = value; }
    public String getObservedJson() { return observedJson; }
    public void setObservedJson(String value) { observedJson = value; }
    public String getFirstFailure() { return firstFailure; }
    public void setFirstFailure(String value) { firstFailure = value; }
    public long getCpuDelta() { return cpuDelta; }
    public void setCpuDelta(long value) { cpuDelta = value; }
    public long getCoreDelta() { return coreDelta; }
    public void setCoreDelta(long value) { coreDelta = value; }
    public long getMemoryDelta() { return memoryDelta; }
    public void setMemoryDelta(long value) { memoryDelta = value; }
    public Long getJobId() { return jobId; }
    public void setJobId(Long value) { jobId = value; }
    public Date getCreated() { return created; }
    public Date getUpdated() { return updated; }
    public void setUpdated(Date value) { updated = value; }
}
