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

import org.apache.cloudstack.acl.RoleType;
import org.apache.cloudstack.api.APICommand;
import org.apache.cloudstack.api.ApiConstants;
import org.apache.cloudstack.api.ApiErrorCode;
import org.apache.cloudstack.api.BaseCmd;
import org.apache.cloudstack.api.Parameter;
import org.apache.cloudstack.api.response.SuccessResponse;
import org.apache.cloudstack.api.ServerApiException;
import org.apache.cloudstack.api.command.admin.AdminCmd;
import org.apache.cloudstack.context.CallContext;

import com.cloud.exception.ConcurrentOperationException;
import com.cloud.dr.cluster.DisasterRecoveryClusterService;
import com.cloud.utils.exception.CloudRuntimeException;


@APICommand(name = ConnectivityTestsDisasterRecoveryClusterCmd.APINAME,
        description = "Connectivity Tests Disaster Recovery",
        responseObject = SuccessResponse.class,
        authorized = {RoleType.Admin})
public class ConnectivityTestsDisasterRecoveryClusterCmd extends BaseCmd implements AdminCmd {
    public static final String APINAME = "connectivityTestsDisasterRecovery";

    @Inject
    private DisasterRecoveryClusterService disasterRecoveryClusterService;

    /////////////////////////////////////////////////////
    //////////////// API parameters /////////////////////
    /////////////////////////////////////////////////////
    @Parameter(name = ApiConstants.DR_CLUSTER_PROTOCOL, type = CommandType.STRING, required = true,
            description = "dr cluster protocol")
    private String drClusterProtocol;

    @Parameter(name = ApiConstants.DR_CLUSTER_IP, type = CommandType.STRING, required = true,
            description = "dr cluster ip")
    private String drClusterIp;

    @Parameter(name = ApiConstants.DR_CLUSTER_PORT, type = CommandType.STRING, required = true,
            description = "dr cluster port")
    private String drClusterPort;

    @Parameter(name = ApiConstants.DR_CLUSTER_API_KEY, type = CommandType.STRING, required = true,
            description = "dr cluster api key")
    private String apiKey;

    @Parameter(name = ApiConstants.DR_CLUSTER_SECRET_KEY, type = CommandType.STRING, required = true,
            description = "dr cluster secret key")
    private String secretKey;

    /////////////////////////////////////////////////////
    /////////////////// Accessors ///////////////////////
    /////////////////////////////////////////////////////
    public String getDrClusterProtocol() {
        return drClusterProtocol;
    }

    public String getDrClusterIp() {
        return drClusterIp;
    }

    public String getDrClusterPort() {
        return drClusterPort;
    }

    public String getApiKey() {
        return apiKey;
    }

    public String getSecretKey() {
        return secretKey;
    }

    @Override
    public String getCommandName() {
        return APINAME.toLowerCase() + "response";
    }

    @Override
    public long getEntityOwnerId() {
        return CallContext.current().getCallingAccountId();
    }

    /////////////////////////////////////////////////////
    /////////////// API Implementation///////////////////
    /////////////////////////////////////////////////////
    @Override
    public void execute() throws ServerApiException, ConcurrentOperationException {
        try {
            if (!disasterRecoveryClusterService.connectivityTestsDisasterRecovery(this)) {
                throw new ServerApiException(ApiErrorCode.INTERNAL_ERROR, String.format("Failed to connectivity tests disaster recovery."));
            }
            SuccessResponse response = new SuccessResponse(getCommandName());
            setResponseObject(response);
        } catch (CloudRuntimeException ex) {
            throw new ServerApiException(ApiErrorCode.INTERNAL_ERROR, ex.getMessage());
        }
    }
}
