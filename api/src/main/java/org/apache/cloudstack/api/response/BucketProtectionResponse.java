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
import org.apache.cloudstack.api.BaseResponse;

public class BucketProtectionResponse extends BaseResponse {
    @SerializedName("protectionverificationstate") @Param(description = "Verified, Mismatch or Unknown")
    private String verificationState;
    public String getVerificationState() { return verificationState; }
    public void setVerificationState(String value) { verificationState = value; }
    @SerializedName("protectionverifiedat") @Param(description = "Last successful protection verification")
    private java.util.Date verifiedAt;
    public java.util.Date getVerifiedAt() { return verifiedAt; }
    public void setVerifiedAt(java.util.Date value) { verifiedAt = value; }
    @SerializedName("protectioncheckedat") @Param(description = "Last verification attempt")
    private java.util.Date checkedAt;
    public java.util.Date getCheckedAt() { return checkedAt; }
    public void setCheckedAt(java.util.Date value) { checkedAt = value; }
    @SerializedName("effectiveencryption") @Param(description = "Verified bucket default encryption, not retroactive object encryption")
    private Boolean encryption;
    public Boolean getEncryption() { return encryption; }
    public void setEncryption(Boolean value) { encryption = value; }
    @SerializedName("effectiveversioning") @Param(description = "Verified effective versioning")
    private Boolean versioning;
    public Boolean getVersioning() { return versioning; }
    public void setVersioning(Boolean value) { versioning = value; }
    @SerializedName("effectiveobjectlocking") @Param(description = "Verified object lock enabled at bucket creation")
    private Boolean objectLock;
    public Boolean getObjectLock() { return objectLock; }
    public void setObjectLock(Boolean value) { objectLock = value; }
    @SerializedName("versioningstatus") @Param(description = "Off, Enabled or Suspended")
    private String versioningStatus;
    public String getVersioningStatus() { return versioningStatus; }
    public void setVersioningStatus(String value) { versioningStatus = value; }
    @SerializedName("encryptionalgorithm") @Param(description = "Actual server-side encryption algorithm")
    private String algorithm;
    public String getAlgorithm() { return algorithm; }
    public void setAlgorithm(String value) { algorithm = value; }
    @SerializedName("reason") @Param(description = "Sanitized verification or capability reason")
    private String reason;
    public String getReason() { return reason; }
    public void setReason(String value) { reason = value; }
    @SerializedName("operationid") @Param(description = "Durable protection operation UUID")
    private String operationId;
    public String getOperationId() { return operationId; }
    public void setOperationId(String value) { operationId = value; }
    @SerializedName("operationstate") @Param(description = "Durable operation state")
    private String operationState;
    public String getOperationState() { return operationState; }
    public void setOperationState(String value) { operationState = value; }
    @SerializedName("requestedencryption") @Param(description = "Cloud requested encryption")
    private boolean requestedEncryption;
    public boolean getRequestedEncryption() { return requestedEncryption; }
    public void setRequestedEncryption(boolean value) { requestedEncryption = value; }
    @SerializedName("requestedversioning") @Param(description = "Cloud requested versioning")
    private boolean requestedVersioning;
    public boolean getRequestedVersioning() { return requestedVersioning; }
    public void setRequestedVersioning(boolean value) { requestedVersioning = value; }
    @SerializedName("requestedobjectlocking") @Param(description = "Cloud requested object locking")
    private boolean requestedObjectLock;
    public boolean getRequestedObjectLock() { return requestedObjectLock; }
    public void setRequestedObjectLock(boolean value) { requestedObjectLock = value; }
    @SerializedName("capabilities") @Param(description = "Provider capabilities and constraints")
    private java.util.Map<String, String> capabilities;
    public java.util.Map<String, String> getCapabilities() { return capabilities; }
    public void setCapabilities(java.util.Map<String, String> value) { capabilities = value; }
    public boolean matches(boolean enc, boolean ver, boolean lock) {
        return Boolean.valueOf(enc).equals(encryption) && Boolean.valueOf(ver).equals(versioning) && Boolean.valueOf(lock).equals(objectLock);
    }
    public void compare(boolean enc, boolean ver, boolean lock) {
        requestedEncryption = enc; requestedVersioning = ver; requestedObjectLock = lock;
        if (encryption == null || versioning == null || objectLock == null) verificationState = "Unknown";
        else verificationState = matches(enc, ver, lock) ? "Verified" : "Mismatch";
    }
}
