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

import org.apache.cloudstack.api.ApiConstants;
import org.apache.cloudstack.api.BaseResponse;
import org.apache.cloudstack.api.EntityReference;

import com.cloud.security.SecurityCheck;
import com.cloud.serializer.Param;
import com.google.gson.annotations.SerializedName;

@EntityReference(value = {SecurityCheck.class})
public class GetSecurityCheckResponse extends BaseResponse {
    @SerializedName(ApiConstants.ID)
    @Param(description = "the id of the integrity verification final result")
    private long id;

    @SerializedName(ApiConstants.MANAGEMENT_SERVER_ID)
    @Param(description = "the id of the management server")
    private String msHostId;

    @SerializedName(ApiConstants.RESULT)
    @Param(description = "result of the security check")
    private boolean checkResult;

    @SerializedName(ApiConstants.LAST_UPDATED)
    @Param(description = "the date this mshost was updated")
    private Date checkDate;

    @SerializedName(ApiConstants.DETAILS)
    @Param(description = "the security check failed list")
    private String checkFailedList;

    @SerializedName(ApiConstants.TYPE)
    @Param(description = "the type of the security check")
    private String type;

    @SerializedName(ApiConstants.SERVICE_NAME)
    @Param(description = "the service of the security check")
    private String service;

    public GetSecurityCheckResponse() {
    }

    public long getId() {
        return id;
    }

    public String getMsHostId() {
        return msHostId;
    }

    public boolean getCheckResult() {
        return checkResult;
    }

    public Date getCheckDate() {
        return checkDate;
    }

    public String getCheckFailedList() {
        return checkFailedList;
    }

    public void setId(long id) {
        this.id = id;
    }

    public void setMsHostId(String msHostId) {
        this.msHostId = msHostId;
    }

    public void setCheckResult(boolean checkResult) {
        this.checkResult = checkResult;
    }

    public void setCheckDate(Date checkDate) {
        this.checkDate = checkDate;
    }

    public void setType(String type) {
        this.type = type;
    }

    public void setService(String service) {
        this.service = service;
    }

    public void setCheckFailedList(String checkFailedList) {
        this.checkFailedList = checkFailedList;
    }
}
