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

package org.apache.cloudstack.api.command.user.storage.sharedfs;

import javax.inject.Inject;

import org.apache.cloudstack.acl.RoleType;
import org.apache.cloudstack.api.APICommand;
import org.apache.cloudstack.api.ApiConstants;
import org.apache.cloudstack.api.BaseCmd;
import org.apache.cloudstack.api.Parameter;
import org.apache.cloudstack.api.command.user.UserCmd;
import org.apache.cloudstack.api.response.ServiceOfferingResponse;
import org.apache.cloudstack.api.response.SharedFSComputeStatusResponse;
import org.apache.cloudstack.api.response.SharedFSResponse;
import org.apache.cloudstack.context.CallContext;
import org.apache.cloudstack.storage.sharedfs.SharedFSService;

@APICommand(name = "getSharedFileSystemComputeStatus", responseObject = SharedFSComputeStatusResponse.class,
        description = "Check SharedFS online compute readiness, plan an increase, or inspect a durable operation.",
        since = "4.23.0", requestHasSensitiveInfo = false,
        authorized = {RoleType.Admin, RoleType.ResourceAdmin, RoleType.DomainAdmin, RoleType.User})
public class GetSharedFSComputeStatusCmd extends BaseCmd implements UserCmd {
    @Inject
    private SharedFSService service;

    @Parameter(name = ApiConstants.ID, type = CommandType.UUID, required = true, entityType = SharedFSResponse.class)
    private Long id;

    @Parameter(name = ApiConstants.SERVICE_OFFERING_ID, type = CommandType.UUID, entityType = ServiceOfferingResponse.class)
    private Long serviceOfferingId;

    @Parameter(name = ApiConstants.CPU_NUMBER, type = CommandType.INTEGER)
    private Integer cpuNumber;

    @Parameter(name = ApiConstants.CPU_SPEED, type = CommandType.INTEGER)
    private Integer cpuSpeed;

    @Parameter(name = ApiConstants.MEMORY, type = CommandType.INTEGER)
    private Integer memory;

    @Parameter(name = "requestid", type = CommandType.STRING, length = 64)
    private String requestId;

    @Override
    public long getEntityOwnerId() {
        return CallContext.current().getCallingAccount().getId();
    }

    @Override
    public void execute() {
        SharedFSComputeStatusResponse response = new SharedFSComputeStatusResponse(service.getComputeStatus(id, serviceOfferingId,
                ChangeSharedFSServiceOfferingCmd.computeParameters(cpuNumber, cpuSpeed, memory), requestId));
        response.setResponseName(getCommandName());
        setResponseObject(response);
    }
}
