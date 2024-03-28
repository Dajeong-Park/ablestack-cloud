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

package com.cloud.dr.cluster;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.Table;
import java.util.Date;
import java.util.UUID;

@Entity
@Table(name = "disaster_recovery_cluster")
public class DisasterRecoveryClusterVO implements DisasterRecoveryCluster {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private long id;

    @Column(name = "uuid")
    private String uuid;

    @Column(name = "mshost_id", updatable = false, nullable = false)
    private long msHostId;

    @Column(name = "name")
    private String name;

    @Column(name = "dr_cluster_uuid")
    private String drClusterUuid;

    @Column(name = "dr_cluster_ip")
    private String drClusterIp;

    @Column(name = "dr_cluster_port")
    private String drClusterPort;

    @Column(name = "dr_cluster_protocol")
    private String drClusterProtocol;

    @Column(name = "dr_cluster_type")
    private String drClusterType;

    @Column(name = "dr_cluster_status")
    private String drClusterStatus;

    @Column(name = "mirroring_agent_status")
    private String mirroringAgentStatus;

    @Column(name = "api_key")
    private String apiKey;

    @Column(name = "secret_key")
    private String secretKey;

    @Column(name = "created")
    private Date created;

    @Column(name = "removed")
    private Date removed;

    public long getId() {
        return id;
    }

    @Override
    public String getUuid() {
        return uuid;
    }

    @Override
    public long getMsHostId() {
        return msHostId;
    }

    @Override
    public String getName() {
        return name;
    }

    @Override
    public String getDrClusterUuid() {
        return drClusterUuid;
    }

    @Override
    public String getDrClusterIp() {
        return drClusterIp;
    }

    @Override
    public String getDrClusterPort() {
        return drClusterPort;
    }

    @Override
    public String getDrClusterProtocol() {
        return drClusterProtocol;
    }

    @Override
    public String getDrClusterType() {
        return drClusterType;
    }

    @Override
    public String getDrClusterStatus() {
        return drClusterStatus;
    }

    @Override
    public String getMirroringAgentStatus() {
        return mirroringAgentStatus;
    }

    @Override
    public String getApiKey() {
        return apiKey;
    }

    @Override
    public String getSecretKey() {
        return secretKey;
    }

    @Override
    public Date getCreated() {
        return created;
    }

    @Override
    public Date getRemoved() {
        return removed;
    }

    public DisasterRecoveryClusterVO() {
        this.uuid = UUID.randomUUID().toString();
    }

    public void setId(long id) {
        this.id = id;
    }

    public void setUuid(String uuid) {
        this.uuid = uuid;
    }

    public void setName(String name) {
        this.name = name;
    }

    public void setDrClusterUuid(String drClusterUuid) {
        this.drClusterUuid = drClusterUuid;
    }

    public void setDrClusterIp(String drClusterIp) {
        this.drClusterIp = drClusterIp;
    }

    public void setDrClusterPort(String drClusterPort) {
        this.drClusterPort = drClusterPort;
    }

    public void setDrClusterProtocol(String drClusterProtocol) {
        this.drClusterProtocol = drClusterProtocol;
    }

    public void setDrClusterType(String drClusterType) {
        this.drClusterType = drClusterType;
    }

    public void setDrClusterStatus(String drClusterStatus) {
        this.drClusterStatus = drClusterStatus;
    }

    public void setMirroringAgentStatus(String mirroringAgentStatus) {
        this.mirroringAgentStatus = mirroringAgentStatus;
    }

    public void setApiKey(String apiKey) {
        this.apiKey = apiKey;
    }

    public void setSecretKey(String secretKey) {
        this.secretKey = secretKey;
    }

    public void setCreated(Date created) {
        this.created = created;
    }

    public void setRemoved(Date removed) {
        this.removed = removed;
    }

    public DisasterRecoveryClusterVO(long mshostId, String name, String drClusterType, String drClusterProtocol, String drClusterIp,
                                String drClusterPort, String apiKey, String secretKey, String drClusterStatus, String mirroringAgentStatus) {
        this.uuid = UUID.randomUUID().toString();
        this.msHostId = mshostId;
        this.name = name;
        this.drClusterType = drClusterType;
        this.drClusterProtocol = drClusterProtocol;
        this.drClusterIp = drClusterIp;
        this.drClusterPort = drClusterPort;
        this.apiKey = apiKey;
        this.secretKey = secretKey;
        this.drClusterStatus = drClusterStatus;
        this.mirroringAgentStatus = mirroringAgentStatus;
    }

//    @Override
//    public String toString() {
//        return super.toString() +
//                "- cluster name: " + name +
//                ", check result: " + checkResult +
//                ", check last update: " + lastUpdateTime +
//                ", details: " + getParsedCheckDetails();
//    }
}
