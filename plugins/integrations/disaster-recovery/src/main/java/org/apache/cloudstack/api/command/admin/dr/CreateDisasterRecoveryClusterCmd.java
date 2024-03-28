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

package org.apache.cloudstack.api.command.admin.dr;

import javax.inject.Inject;

import java.io.File;

import org.apache.cloudstack.acl.RoleType;
import org.apache.cloudstack.api.APICommand;
import org.apache.cloudstack.api.ApiConstants;
import org.apache.cloudstack.api.ApiErrorCode;
import org.apache.cloudstack.api.Parameter;
import org.apache.cloudstack.api.BaseAsyncCreateCmd;
import org.apache.cloudstack.api.ResponseObject.ResponseView;
import org.apache.cloudstack.api.response.dr.cluster.GetDisasterRecoveryClusterListResponse;
import org.apache.cloudstack.api.ServerApiException;
import org.apache.cloudstack.context.CallContext;

import com.cloud.dr.cluster.DisasterRecoveryCluster;
import com.cloud.dr.cluster.DisasterRecoveryClusterEventTypes;
import com.cloud.dr.cluster.DisasterRecoveryClusterService;
import com.cloud.utils.exception.CloudRuntimeException;
import com.cloud.exception.ResourceAllocationException;

@APICommand(name = CreateDisasterRecoveryClusterCmd.APINAME,
        description = "Create Disaster Recovery Cluster",
        responseObject = GetDisasterRecoveryClusterListResponse.class,
        responseView = ResponseView.Restricted,
        entityType = {DisasterRecoveryCluster.class},
        requestHasSensitiveInfo = false,
        responseHasSensitiveInfo = true,
        authorized = {RoleType.Admin})
public class CreateDisasterRecoveryClusterCmd extends BaseAsyncCreateCmd {
    public static final String APINAME = "createDisasterRecoveryCluster";

    @Inject
    private DisasterRecoveryClusterService disasterRecoveryClusterService;

    /////////////////////////////////////////////////////
    //////////////// API parameters /////////////////////
    /////////////////////////////////////////////////////
    @Parameter(name = ApiConstants.DR_CLUSTER_NAME, type = CommandType.STRING, required = true,
            description = "dr cluster name")
    private String name;

    @Parameter(name = ApiConstants.DR_CLUSTER_TYPE, type = CommandType.STRING, required = true,
            description = "dr cluster type")
    private String drClusterType;

    @Parameter(name = ApiConstants.DR_CLUSTER_IP, type = CommandType.STRING, required = true,
            description = "dr cluster ip")
    private String drClusterIp;

    @Parameter(name = ApiConstants.DR_CLUSTER_PROTOCOL, type = CommandType.STRING, required = true,
            description = "dr cluster protocol")
    private String drClusterProtocol;

    @Parameter(name = ApiConstants.DR_CLUSTER_PORT, type = CommandType.STRING, required = true,
            description = "dr cluster port")
    private String drClusterPort;

    @Parameter(name = ApiConstants.DR_CLUSTER_API_KEY, type = CommandType.STRING, required = true,
            description = "dr cluster api key")
    private String apiKey;

    @Parameter(name = ApiConstants.DR_CLUSTER_SECRET_KEY, type = CommandType.STRING, required = true,
            description = "dr cluster secret key")
    private String secretKey;

    @Parameter(name = ApiConstants.DR_CLUSTER_PRIVATE_KEY, type = CommandType.OBJECT, required = false,
            description = "The private key for the attached disaster cluster.",
            length = 65535)
    private File privateKey;

    /////////////////////////////////////////////////////
    /////////////////// Accessors ///////////////////////
    /////////////////////////////////////////////////////
    public String getName() {
        return name;
    }

    public String getDrClusterType() {
        return drClusterType;
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

    public String getApiKey() {
        return apiKey;
    }

    public String getSecretKey() {
        return secretKey;
    }

    public File getPrivateKey() {
        return privateKey;
    }

    @Override
    public String getCommandName() {
        return APINAME.toLowerCase() + "response";
    }

    @Override
    public long getEntityOwnerId() {
        return CallContext.current().getCallingAccountId();
    }

    @Override
    public String getEventType() {
        return DisasterRecoveryClusterEventTypes.EVENT_DR_CREATE;
    }

    @Override
    public String getEventDescription() {
        return "creating a disaster recovery cluster";
    }

    /////////////////////////////////////////////////////
    /////////////// API Implementation///////////////////
    /////////////////////////////////////////////////////

    @Override
    public void create() throws ResourceAllocationException {
        DisasterRecoveryCluster result = disasterRecoveryClusterService.createDisasterRecoveryCluster(this);
        if (result != null) {
            setEntityId(result.getId());
            setEntityUuid(result.getUuid());
        } else {
            throw new ServerApiException(ApiErrorCode.INTERNAL_ERROR, "Failed to create disaster recovery cluster entity : " + name);
        }

    }

    @Override
    public void execute() throws CloudRuntimeException {
        try {
            GetDisasterRecoveryClusterListResponse response = disasterRecoveryClusterService.createDisasterRecoveryClusterResponse(getEntityId());
            if (response == null) {
                throw new ServerApiException(ApiErrorCode.INTERNAL_ERROR, "Failed to create disaster recovery cluster");
            }
            response.setResponseName(getCommandName());
            setResponseObject(response);
        } catch (CloudRuntimeException ex) {
            throw new ServerApiException(ApiErrorCode.INTERNAL_ERROR, ex.getMessage());
        }
    }
}
