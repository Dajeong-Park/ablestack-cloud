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
import org.apache.cloudstack.api.BaseCmd;
import org.apache.cloudstack.api.Parameter;
import org.apache.cloudstack.api.ServerApiException;
import org.apache.cloudstack.api.ApiErrorCode;
import org.apache.cloudstack.api.command.user.UserCmd;
import org.apache.cloudstack.api.response.BucketObjectResponse;
import org.apache.cloudstack.context.CallContext;
public abstract class BucketObjectCmd extends BaseCmd implements UserCmd {
    @Parameter(name = "id", type = CommandType.STRING, required = true, description = "Cloud bucket UUID, including removed metadata for operation status/replay") protected String id;
    @Override public long getEntityOwnerId() { return CallContext.current().getCallingAccount().getId(); }
    protected void respond(BucketObjectResponse response) {
        if (getHttpMethod() != HTTPMethod.POST) throw new ServerApiException(ApiErrorCode.BAD_REQUEST, "Use POST for bucket object operations");
        response.setObjectName("bucketoperation"); response.setResponseName(getCommandName()); setResponseObject(response);
    }
    protected void requirePost() {
        if (getHttpMethod() != HTTPMethod.POST) throw new ServerApiException(ApiErrorCode.BAD_REQUEST, "Use POST for bucket object operations");
    }
}
