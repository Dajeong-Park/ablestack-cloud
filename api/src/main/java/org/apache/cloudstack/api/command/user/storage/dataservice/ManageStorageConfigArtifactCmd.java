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

import com.cloud.user.Account;
import javax.inject.Inject;
import org.apache.cloudstack.acl.RoleType;
import org.apache.cloudstack.api.APICommand;
import org.apache.cloudstack.api.BaseCmd;
import org.apache.cloudstack.api.Parameter;
import org.apache.cloudstack.api.command.user.UserCmd;
import org.apache.cloudstack.api.response.StorageConfigArtifactResponse;
import org.apache.cloudstack.api.response.StorageServiceInstanceResponse;
import org.apache.cloudstack.storage.dataservice.StorageService;

@APICommand(name = "manageStorageConfigArtifact", responseObject = StorageConfigArtifactResponse.class,
        description = "Capture or transfer a SharedFS configuration bundle",
        requestHasSensitiveInfo = true, responseHasSensitiveInfo = true,
        authorized = {RoleType.Admin, RoleType.ResourceAdmin, RoleType.DomainAdmin, RoleType.User})
public final class ManageStorageConfigArtifactCmd extends BaseCmd implements UserCmd {
    @Inject private StorageService storageService;

    @Parameter(name = "action", type = CommandType.STRING, required = true, length = 16,
            description = "LIST, CAPTURE, DOWNLOAD, BEGIN_UPLOAD, APPEND_UPLOAD, INSPECT or PLAN")
    private String action;
    @Parameter(name = "instanceid", type = CommandType.UUID, entityType = StorageServiceInstanceResponse.class,
            description = "Authorized source or restore target")
    private Long instanceId;
    @Parameter(name = "source", type = CommandType.STRING, length = 36,
            description = "Source instance UUID for listing retained backups after source removal")
    private String source;
    @Parameter(name = "artifactid", type = CommandType.STRING, length = 36, description = "Configuration artifact UUID")
    private String artifact;
    @Parameter(name = "bytes", type = CommandType.INTEGER, description = "Declared archive size")
    private Integer bytes;
    @Parameter(name = "sha256", type = CommandType.STRING, length = 64, description = "Archive or chunk SHA-256")
    private String digest;
    @Parameter(name = "chunkindex", type = CommandType.INTEGER, description = "Zero-based 64 KiB chunk index")
    private Integer index;
    @Parameter(name = "page", type = CommandType.INTEGER, description = "One-based backup page")
    private Integer page;
    @Parameter(name = "payload", type = CommandType.STRING, length = 87384, description = "Base64-encoded raw chunk")
    private String payload;

    @Parameter(name = "protocols", type = CommandType.STRING, length = 32, description = "Comma-separated restore protocol scope")
    private String protocols;
    @Parameter(name = "addressmapping", type = CommandType.STRING, length = 4096,
            description = "JSON object mapping original client service addresses to addresses owned by the target")
    private String addressMapping;

    public String getProtocols() { return protocols; }
    public String getAddressMapping() { return addressMapping; }

    public String getAction() { return action; }
    public Long getInstanceId() { return instanceId; }
    public String getSource() { return source; }
    public String getArtifact() { return artifact; }
    public Integer getBytes() { return bytes; }
    public String getDigest() { return digest; }
    public Integer getIndex() { return index; }
    public Integer getPage() { return page; }
    public String getPayload() { return payload; }

    @Override
    public long getEntityOwnerId() { return Account.ACCOUNT_ID_SYSTEM; }

    @Override
    public void execute() {
        StorageConfigArtifactResponse response = storageService.manageStorageConfigArtifact(this);
        response.setResponseName(getCommandName());
        setResponseObject(response);
    }
}
