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

import com.cloud.serializer.Param;
import com.google.gson.annotations.SerializedName;
import org.apache.cloudstack.api.ApiConstants;
import org.apache.cloudstack.api.BaseResponse;

import java.util.List;

public class GetIntegrityVerificationListResponse extends BaseResponse {
    @SerializedName(ApiConstants.MANAGEMENT_SERVER_ID)
    @Param(description = "the id of the management server")
    private String msHostId;

    @SerializedName(ApiConstants.INTEGRITY_VERIFICATIONS_RESULT)
    @Param(description = "integrity verification")
    private List<GetIntegrityVerificationResponse> integrityVerifications;

    public String getMsHostId() {
        return msHostId;
    }

    public List<GetIntegrityVerificationResponse> getIntegrityVerifications() {
        return integrityVerifications;
    }

    public void setMsHostId(String msHostId) {
        this.msHostId = msHostId;
    }

    public void setIntegrityVerifications(List<GetIntegrityVerificationResponse> integrityVerifications) {
        this.integrityVerifications = integrityVerifications;
    }
}
