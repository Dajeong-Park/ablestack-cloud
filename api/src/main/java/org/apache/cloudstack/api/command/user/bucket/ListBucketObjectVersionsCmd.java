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
import org.apache.cloudstack.api.Parameter;
import org.apache.cloudstack.api.response.BucketObjectResponse;
import org.apache.cloudstack.context.CallContext;
@APICommand(name = "listBucketObjectVersions", description = "List an authorized S3 version page without returning credentials.", responseObject = BucketObjectResponse.class,
        httpMethod = "POST", requestHasSensitiveInfo = true, responseHasSensitiveInfo = true, since = "4.23.0",
        authorized = {RoleType.Admin, RoleType.ResourceAdmin, RoleType.DomainAdmin, RoleType.User})
public class ListBucketObjectVersionsCmd extends BucketObjectCmd {
    @Parameter(name = "keymarker", type = CommandType.STRING, required = false, description = "keymarker") private String keyMarker;
    @Parameter(name = "versionidmarker", type = CommandType.STRING, required = false, description = "versionidmarker") private String versionMarker;
    @Parameter(name = "limit", type = CommandType.INTEGER, required = false, description = "limit") private Integer limit;
    @Override public String getCommandName() { return "listbucketobjectversionsresponse"; }
    @Override public void execute() { requirePost(); var caller = CallContext.current().getCallingAccount(); respond(_bucketService.listObjectVersions(id, caller, keyMarker, versionMarker, limit == null ? 100 : limit)); }
}
