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
package org.apache.cloudstack.api.command.user.storage.dataservice;

import javax.inject.Inject;
import org.apache.cloudstack.acl.RoleType;
import org.apache.cloudstack.api.APICommand;
import org.apache.cloudstack.api.Parameter;
import org.apache.cloudstack.api.command.user.UserCmd;
import org.apache.cloudstack.api.response.StorageServiceConfigurationOperationResponse;
import org.apache.cloudstack.api.response.StorageServiceInstanceResponse;
import org.apache.cloudstack.storage.dataservice.StorageService;

@APICommand(name = "applyStorageConfigRestore", responseObject = StorageServiceConfigurationOperationResponse.class,
        description = "Apply an approved SharedFS configuration restore plan",
        requestHasSensitiveInfo = true, responseHasSensitiveInfo = false,
        authorized = {RoleType.Admin, RoleType.ResourceAdmin, RoleType.DomainAdmin, RoleType.User})
public class ApplyStorageConfigRestoreCmd extends BaseStorageServiceConfigurationCmd implements UserCmd {
    @Inject private StorageService storageService;

    @Parameter(name = "instanceid", type = CommandType.UUID, entityType = StorageServiceInstanceResponse.class,
            required = true, description = "Target Storage Service instance")
    private Long instanceId;
    @Parameter(name = "planid", type = CommandType.STRING, required = true, length = 36, description = "Saved restore plan UUID")
    private String planId;
    @Parameter(name = "sha256", type = CommandType.STRING, required = true, length = 64, description = "Approved plan SHA-256")
    private String digest;
    @Parameter(name = "acceptaclremoval", type = CommandType.BOOLEAN, description = "Approve ACL removals shown in the plan")
    private Boolean acceptAclRemoval;
    @Parameter(name = "acceptnfsservicewide", type = CommandType.BOOLEAN, description = "Approve the planned service-wide NFS binding")
    private Boolean acceptNfsServiceWide;
    @Parameter(name = "restoresecrets", type = CommandType.STRING, length = 32768, description = "Ephemeral JSON credential slots keyed by rule UUID")
    private String restoreSecrets;

    public Long getInstanceId() { return instanceId; }
    public String getPlanId() { return planId; }
    public String getDigest() { return digest; }
    public boolean acceptAclRemoval() { return Boolean.TRUE.equals(acceptAclRemoval); }
    public boolean acceptNfsServiceWide() { return Boolean.TRUE.equals(acceptNfsServiceWide); }
    public String getRestoreSecrets() { return restoreSecrets; }

    @Override public String getEventType() { return "STORAGE.CONFIGURATION.RESTORE"; }
    @Override public String getEventDescription() { return "Applying an approved SharedFS configuration restore"; }
    @Override public long getEntityOwnerId() { return 0; }

    @Override
    public void execute() {
        StorageServiceConfigurationOperationResponse response = storageService.applyStorageConfigRestore(this);
        response.setResponseName(getCommandName());
        setResponseObject(response);
    }
}
