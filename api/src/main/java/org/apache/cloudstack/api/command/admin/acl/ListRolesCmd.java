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

package org.apache.cloudstack.api.command.admin.acl;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

import com.cloud.exception.InvalidParameterValueException;
import org.apache.cloudstack.acl.Role;
import org.apache.cloudstack.acl.RoleType;
import org.apache.cloudstack.api.APICommand;
import org.apache.cloudstack.api.ApiArgValidator;
import org.apache.cloudstack.api.ApiConstants;
import org.apache.cloudstack.api.BaseListCmd;
import org.apache.cloudstack.api.Parameter;
import org.apache.cloudstack.api.response.ListResponse;
import org.apache.cloudstack.api.response.RoleResponse;

import com.cloud.user.Account;
import com.cloud.utils.Pair;

@APICommand(name = "listRoles", description = "Lists dynamic roles in CloudStack", responseObject = RoleResponse.class, requestHasSensitiveInfo = false, responseHasSensitiveInfo = false, since = "4.9.0", authorized = {
        RoleType.Admin, RoleType.ResourceAdmin, RoleType.DomainAdmin })
public class ListRolesCmd extends BaseListCmd {

    /////////////////////////////////////////////////////
    //////////////// API parameters /////////////////////
    /////////////////////////////////////////////////////

    @Parameter(name = ApiConstants.ID, type = CommandType.STRING, validations = {ApiArgValidator.UuidString}, description = "List role by role UUID.")
    private String id;

    @Parameter(name = ApiConstants.NAME, type = CommandType.STRING, description = "List role by role name.")
    private String roleName;

    @Parameter(name = ApiConstants.TYPE, type = CommandType.STRING, description = "List role by role type, valid options are: Admin, ResourceAdmin, DomainAdmin, User.")
    private String roleType;

    @Parameter(name = ApiConstants.KEYWORD, type = CommandType.STRING, description = "List role by role keyword.")
    private String keyword;

    @Parameter(name = ApiConstants.STATE, type = CommandType.STRING, description = "List role by role type status, valid options are: enabled, disabled")
    private String roleState;

    /////////////////////////////////////////////////////
    /////////////////// Accessors ///////////////////////
    /////////////////////////////////////////////////////

    public String getId() {
        return id;
    }

    public String getName() {
        return roleName;
    }

    public String getKeyword() {
        return keyword;
    }

    public RoleType getRoleType() {
        if (roleType == null || roleType.isEmpty()) {
            return null;
        }
        try {
            return RoleType.valueOf(roleType);
        } catch (IllegalArgumentException e) {
            throw new InvalidParameterValueException("Unrecognized role type value");
        }
    }

    public Role.State getRoleState() {
        if (roleState == null) {
            return null;
        }
        try {
            return Role.State.valueOf(roleState.toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw new InvalidParameterValueException("Unrecognized role state value");
        }
    }

    /////////////////////////////////////////////////////
    /////////////// API Implementation///////////////////
    /////////////////////////////////////////////////////

    @Override
    public long getEntityOwnerId() {
        return Account.ACCOUNT_ID_SYSTEM;
    }

    private void setupResponse(final Pair<List<Role>, Integer> roles) {
        final ListResponse<RoleResponse> response = new ListResponse<>();
        final List<RoleResponse> roleResponses = new ArrayList<>();
        for (final Role role : roles.first()) {
            if (role == null) {
                continue;
            }
            final RoleResponse roleResponse = new RoleResponse();
            roleResponse.setId(role.getUuid());
            roleResponse.setRoleName(role.getName());
            roleResponse.setRoleType(role.getRoleType());
            roleResponse.setDescription(role.getDescription());
            roleResponse.setIsDefault(role.isDefault());
            roleResponse.setPublicRole(role.isPublicRole());
            roleResponse.setState(role.getState().toString());
            roleResponse.setObjectName("role");
            roleResponses.add(roleResponse);
        }
        response.setResponses(roleResponses, roles.second());
        response.setResponseName(getCommandName());
        setResponseObject(response);
    }

    @Override
    public void execute() {
        Role.State state = getRoleState();
        setupResponse(roleService.searchRoles(getId(), getName(), getKeyword(), getRoleType(),
                state != null ? state.toString() : null, getStartIndex(), getPageSizeVal()));
    }
}
