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
import org.apache.cloudstack.api.Parameter;
import org.apache.cloudstack.api.BaseAsyncCreateCmd;
import org.apache.cloudstack.api.ResponseObject.ResponseView;
import org.apache.cloudstack.api.response.UserVmResponse;
import org.apache.cloudstack.api.response.dr.cluster.GetDisasterRecoveryClusterVmListResponse;
import org.apache.cloudstack.api.ServerApiException;
import org.apache.cloudstack.context.CallContext;

import com.cloud.dr.cluster.DisasterRecoveryClusterVmMap;
import com.cloud.dr.cluster.DisasterRecoveryCluster;
import com.cloud.dr.cluster.DisasterRecoveryClusterEventTypes;
import com.cloud.dr.cluster.DisasterRecoveryClusterService;
import com.cloud.dr.cluster.DisasterRecoveryClusterVmMapVO;
import com.cloud.dr.cluster.dao.DisasterRecoveryClusterVmMapDao;
import com.cloud.utils.exception.CloudRuntimeException;

@APICommand(name = CreateDisasterRecoveryClusterVmCmd.APINAME,
        description = "Create Disaster Recovery Cluster Virtual Machine",
        responseObject = GetDisasterRecoveryClusterVmListResponse.class,
        responseView = ResponseView.Restricted,
        entityType = {DisasterRecoveryClusterVmMap.class},
        requestHasSensitiveInfo = false,
        responseHasSensitiveInfo = true,
        authorized = {RoleType.Admin})
public class CreateDisasterRecoveryClusterVmCmd extends BaseAsyncCreateCmd {
    public static final String APINAME = "createDisasterRecoveryClusterVm";

    @Inject
    private DisasterRecoveryClusterService disasterRecoveryClusterService;
    @Inject
    private DisasterRecoveryClusterVmMapDao disasterRecoveryClusterVmMapDao;

    /////////////////////////////////////////////////////
    //////////////// API parameters /////////////////////
    /////////////////////////////////////////////////////
    @Parameter(name = ApiConstants.DR_CLUSTER_ID,
                type = CommandType.UUID,
                entityType = DisasterRecoveryCluster.class,
                required = true,
                description = "dr cluster id")
    private Long drClusterId;

    @Parameter(name = ApiConstants.VIRTUAL_MACHINE_ID,
                type = CommandType.UUID,
                entityType = UserVmResponse.class,
                required = true,
                description = "the virtual machine ID used by dr cluster")
    private Long vmId;

    @Parameter(name = ApiConstants.SERVICE_OFFERING_ID,
                type = CommandType.UUID,
                required = true,
                description = "the service offering ID used by dr cluster")
    private Long serviceOfferingId;

    @Parameter(name = ApiConstants.NETWORK_ID,
                type = CommandType.UUID,
                required = true,
                description = "the network ID used by dr cluster")
    private Long networkId;


    /////////////////////////////////////////////////////
    /////////////////// Accessors ///////////////////////
    /////////////////////////////////////////////////////
    public Long getDrClusterId() {
        return drClusterId;
    }

    public Long getVmId() {
        return vmId;
    }

    public Long getServiceOfferingId() {
        return serviceOfferingId;
    }

    public Long getNetworkId() {
        return networkId;
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
        return DisasterRecoveryClusterEventTypes.EVENT_DR_VM_CREATE;
    }

    @Override
    public String getEventDescription() {
        return "creating a disaster recovery cluster virtual machine";
    }

    /////////////////////////////////////////////////////
    /////////////// API Implementation///////////////////
    /////////////////////////////////////////////////////

    @Override
    public void create() throws CloudRuntimeException {
        try {
            DisasterRecoveryClusterVmMap result = disasterRecoveryClusterService.createDisasterRecoveryClusterVm(this);
            if (result != null) {
                setEntityId(result.getId());
            } else {
                throw new ServerApiException(ApiErrorCode.INTERNAL_ERROR, "Failed to create disaster recovery cluster vm entity : " + vmId);
            }
        } catch (CloudRuntimeException e) {
            throw new ServerApiException(ApiErrorCode.INTERNAL_ERROR, e.getMessage());
        }
    }

    @Override
    public void execute() throws CloudRuntimeException {
        try {
            DisasterRecoveryClusterVmMapVO clusterVm = disasterRecoveryClusterVmMapDao.findById(getEntityId());
            if (!disasterRecoveryClusterService.setupDisasterRecoveryClusterVm(getEntityId())) {
                throw new ServerApiException(ApiErrorCode.INTERNAL_ERROR, "Failed to setup disaster recovery cluster vm");
            }
            GetDisasterRecoveryClusterVmListResponse response = disasterRecoveryClusterService.createDisasterRecoveryClusterVmResponse(getEntityId());
            response.setResponseName(getCommandName());
            setResponseObject(response);
        } catch (CloudRuntimeException ex) {
            throw new ServerApiException(ApiErrorCode.INTERNAL_ERROR, ex.getMessage());
        }
    }
}