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

package org.apache.cloudstack.api.command;

import javax.inject.Inject;

import com.cloud.domain.Domain;
import com.cloud.exception.InvalidParameterValueException;
import com.cloud.user.Account;
import org.apache.cloudstack.acl.RoleType;
import org.apache.cloudstack.api.APICommand;
import org.apache.cloudstack.api.ApiConstants;
import org.apache.cloudstack.api.BaseCmd;
import org.apache.cloudstack.api.Parameter;
import org.apache.cloudstack.api.response.DomainLdapStatusResponse;
import org.apache.cloudstack.api.response.DomainResponse;
import org.apache.cloudstack.context.CallContext;
import org.apache.cloudstack.ldap.LdapConfiguration;
import org.apache.cloudstack.ldap.LdapManager;
import org.apache.commons.lang3.StringUtils;

@APICommand(name = "getDomainLdapStatus", description = "Gets the LDAP configuration and linkage state of a domain",
        responseObject = DomainLdapStatusResponse.class, since = "4.23.0.0", authorized = {RoleType.Admin},
        requestHasSensitiveInfo = false, responseHasSensitiveInfo = false)
public class GetDomainLdapStatusCmd extends BaseCmd {
    @Parameter(name = ApiConstants.DOMAIN_ID, type = CommandType.UUID, entityType = DomainResponse.class,
            required = true, description = "The domain whose LDAP status is requested")
    private Long domainId;

    @Inject
    private LdapManager ldapManager;

    @Override
    public String getCommandName() {
        return "getdomainldapstatusresponse";
    }

    @Override
    public long getEntityOwnerId() {
        return Account.ACCOUNT_ID_SYSTEM;
    }

    @Override
    public void execute() {
        Domain domain = _domainService.getDomain(domainId);
        if (domain == null) {
            throw new InvalidParameterValueException("The specified domain does not exist.");
        }
        _accountService.checkAccess(CallContext.current().getCallingAccount(), domain);
        boolean configured = (ldapManager.isLdapEnabled(domainId) || ldapManager.isLdapEnabled())
                && StringUtils.isNotBlank(LdapConfiguration.getBaseDn(domainId));
        boolean linked = ldapManager.getDomainLinkedToLdap(domainId) != null;
        DomainLdapStatusResponse response = new DomainLdapStatusResponse(domain.getUuid(), configured, linked);
        response.setObjectName("domainldapstatus");
        response.setResponseName(getCommandName());
        setResponseObject(response);
    }
}
