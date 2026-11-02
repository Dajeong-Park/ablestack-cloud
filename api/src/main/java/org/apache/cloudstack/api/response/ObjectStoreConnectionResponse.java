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
package org.apache.cloudstack.api.response;

import java.util.Date;
import com.cloud.serializer.Param;
import com.google.gson.annotations.SerializedName;
import org.apache.cloudstack.api.BaseResponse;

/** Allowlisted connection outcome; never contains keys, endpoint diagnostics or provider response bodies. */
public class ObjectStoreConnectionResponse extends BaseResponse {
    public enum Status { Connected, AuthFailed, AccessDenied, Unreachable, Unknown }
    public enum Reason { Verified, AuthRejected, PermissionDenied, Timeout, Network, Tls, Unavailable, InvalidEndpoint, UnexpectedResponse, Unsupported, Busy, ConfigurationChanged }
    @SerializedName("id") @Param(description = "registered object store UUID") private String id;
    @SerializedName("status") @Param(description = "connection outcome") private Status status;
    @SerializedName("reason") @Param(description = "safe finite reason code") private Reason reason;
    @SerializedName("checked") @Param(description = "completion time of this check") private Date checked;
    @SerializedName("connectionrevision") @Param(description = "opaque configuration revision") private String revision;
    public static ObjectStoreConnectionResponse result(Status status, Reason reason) {
        ObjectStoreConnectionResponse r = new ObjectStoreConnectionResponse();
        r.status = status; r.reason = reason; r.checked = new Date(); return r;
    }
    public Status getStatus() { return status; }
    public Reason getReason() { return reason; }
    public Date getChecked() { return checked; }
    public void setId(String value) { id = value; }
    public void setConnectionRevision(String value) { revision = value; }
}
