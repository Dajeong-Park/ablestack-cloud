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

import java.util.Date;

public class GetIntegrityVerificationResponse extends BaseResponse {
    @SerializedName(ApiConstants.INTEGRITY_VERIFICATIONS_PATH)
    @Param(description = "the path of the integrity verification on the mshost")
    private String filePath;

    @SerializedName(ApiConstants.RESULT)
    @Param(description = "result of the integrity verification")
    private boolean verificationResult;

    @SerializedName(ApiConstants.LAST_UPDATED)
    @Param(description = "the date this mshost was updated")
    private Date lastUpdated;

    @SerializedName(ApiConstants.DETAILS)
    @Param(description = "detailed response generated on running integrity verification")
    private String details;

    public String getFilePath() {
        return filePath;
    }

    public boolean getVerificationResult() {
        return verificationResult;
    }

    public Date getLastUpdated() {
        return lastUpdated;
    }

    public String getDetails() {
        return details;
    }

    public void setFilePath(String filePath) {
        this.filePath = filePath;
    }

    public void setVerificationResult(boolean verificationResult) {
        this.verificationResult = verificationResult;
    }

    public void setVerificationDate(Date verificationDate) {
        this.lastUpdated = verificationDate;
    }

    public void setVerificationDetails(String verificationDetails) {
        this.details = verificationDetails;
    }
}
