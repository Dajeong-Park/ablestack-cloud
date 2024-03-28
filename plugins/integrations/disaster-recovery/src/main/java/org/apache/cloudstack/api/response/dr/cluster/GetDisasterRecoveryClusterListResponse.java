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

package org.apache.cloudstack.api.response.dr.cluster;

import com.cloud.dr.cluster.DisasterRecoveryCluster;
import com.cloud.serializer.Param;
import com.google.gson.annotations.SerializedName;
import org.apache.cloudstack.api.ApiConstants;
import org.apache.cloudstack.api.BaseResponse;
import org.apache.cloudstack.api.EntityReference;
import org.apache.cloudstack.api.response.UserVmResponse;

import java.util.Date;
import java.util.List;

@SuppressWarnings("unused")
@EntityReference(value = {DisasterRecoveryCluster.class})
public class GetDisasterRecoveryClusterListResponse extends BaseResponse {
    @SerializedName(ApiConstants.ID)
    @Param(description = "the id of the disaster recovery cluster")
    private String id;

    @SerializedName(ApiConstants.NAME)
    @Param(description = "the name of the disaster recovery cluster")
    private String name;

    @SerializedName(ApiConstants.DR_CLUSTER_UUID)
    @Param(description = "the uuid of the disaster recovery cluster")
    private String drClusterUuid;

    @SerializedName(ApiConstants.DR_CLUSTER_IP)
    @Param(description = "the ip of the disaster recovery cluster")
    private String drClusterIp;

    @SerializedName(ApiConstants.DR_CLUSTER_PORT)
    @Param(description = "the port of the disaster recovery cluster")
    private String drClusterPort;

    @SerializedName(ApiConstants.DR_CLUSTER_PROTOCOL)
    @Param(description = "the protocol of the disaster recovery cluster")
    private String drClusterProtocol;

    @SerializedName(ApiConstants.DR_CLUSTER_TYPE)
    @Param(description = "the cluster type of the disaster recovery cluster")
    private String drClusterType;

    @SerializedName(ApiConstants.DR_CLUSTER_STATUS)
    @Param(description = "the dr cluster status of the disaster recovery cluster")
    private String drClusterStatus;

    @SerializedName(ApiConstants.MIRRORING_AGENT_STATUS)
    @Param(description = "the mirroring agent status of the disaster recovery cluster on the mshost")
    private String mirroringAgentStatus;

    @SerializedName(ApiConstants.API_KEY)
    @Param(description = "the api key of the disaster recovery cluster on the mshost")
    private String apiKey;

    @SerializedName(ApiConstants.SECRET_KEY)
    @Param(description = "the secret key of the disaster recovery cluster on the mshost")
    private String secretKey;

    @SerializedName(ApiConstants.CREATED)
    @Param(description = "the creation date of the disaster recovery cluster")
    private Date created;

    @SerializedName(ApiConstants.REMOVED)
    @Param(description = "the remove date of the disaster recovery cluster")
    private Date removed;

    @SerializedName(ApiConstants.DISASTER_RECOVERY_CLUSTER_VM_LIST)
    @Param(description = "the list of virtualmachine associated with this disaster recovery cluster")
    private List<UserVmResponse> disasterRecoveryClusterVms;

    public String getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public String getDrClusterUuid() {
        return drClusterUuid;
    }

    public String getDrClusterIp() {
        return drClusterIp;
    }

    public String getDrClusterPort() {
        return drClusterPort;
    }

    public String getDrClusterProtocol() {
        return drClusterProtocol;
    }

    public String getDrClusterType() {
        return drClusterType;
    }

    public String getDrClusterStatus() {
        return drClusterStatus;
    }

    public String getMirroringAgentStatus() {
        return mirroringAgentStatus;
    }

    public String getApiKey() {
        return apiKey;
    }

    public String getSecretKey() {
        return secretKey;
    }

    public Date getCreated() {
        return created;
    }

    public Date getRemoved() {
        return removed;
    }

    public void setId(String id) {
        this.id = id;
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

    public List<UserVmResponse> getDisasterRecoveryClusterVms() {
        return this.disasterRecoveryClusterVms;
    }

    public void setDisasterRecoveryClusterVms(final List<UserVmResponse> disasterRecoveryClusterVms) {
        this.disasterRecoveryClusterVms = disasterRecoveryClusterVms;
    }
}
