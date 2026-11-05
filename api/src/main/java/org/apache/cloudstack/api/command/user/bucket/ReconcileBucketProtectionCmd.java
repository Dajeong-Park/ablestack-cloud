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
package org.apache.cloudstack.api.command.user.bucket;
import org.apache.cloudstack.acl.RoleType;
import org.apache.cloudstack.api.APICommand;
import org.apache.cloudstack.api.response.BucketProtectionResponse;
import org.apache.cloudstack.context.CallContext;
@APICommand(name = "reconcileBucketProtection", description = "Explicitly restore prior settings or acknowledge verified actual protection with durable operation identity", responseObject = BucketProtectionResponse.class,
        httpMethod = "POST", requestHasSensitiveInfo = true, responseHasSensitiveInfo = true, since = "4.23.0",
        authorized = {RoleType.Admin, RoleType.ResourceAdmin, RoleType.DomainAdmin, RoleType.User})
public class ReconcileBucketProtectionCmd extends BucketProtectionCmd {
    @org.apache.cloudstack.api.Parameter(name = "operationid", type = CommandType.STRING, description = "Expected active protection operation UUID") private String operationId;
    @org.apache.cloudstack.api.Parameter(name = "acceptactual", type = CommandType.BOOLEAN, description = "Explicitly adopt verified actual values without modifying provider protection; required when exact prior restoration is impossible") private Boolean acceptActual;
    @Override public String getCommandName() { return "reconcilebucketprotectionresponse"; }
    @Override public void execute() { requirePost(); var caller = CallContext.current().getCallingAccount(); respond(_bucketService.reconcileProtection(id, caller, operationId, Boolean.TRUE.equals(acceptActual))); }
}
