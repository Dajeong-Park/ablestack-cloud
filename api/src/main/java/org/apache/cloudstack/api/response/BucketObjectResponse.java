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

public class BucketObjectResponse extends BaseResponse {
    @SerializedName("versions") @Param(description = "versions") private java.util.List<BucketObjectVersion> versions;
    @SerializedName("istruncated") @Param(description = "istruncated") private boolean truncated;
    @SerializedName("nextkeymarker") @Param(description = "nextkeymarker") private String nextKeyMarker;
    @SerializedName("nextversionidmarker") @Param(description = "nextversionidmarker") private String nextVersionMarker;
    @SerializedName("currentobjects") @Param(description = "currentobjects") private long currentObjects;
    @SerializedName("versioncount") @Param(description = "versioncount") private long versionCount;
    @SerializedName("deletemarkers") @Param(description = "deletemarkers") private long deleteMarkers;
    @SerializedName("complete") @Param(description = "complete") private boolean complete;
    @SerializedName("objectlock") @Param(description = "objectlock") private boolean objectLock;
    @SerializedName("exists") @Param(description = "exists") private boolean exists;
    @SerializedName("blockedreason") @Param(description = "blockedreason") private String blockedReason;
    @SerializedName("checked") @Param(description = "checked") private java.util.Date checked;
    @SerializedName("externalid") @Param(description = "externalid") private String externalId;
    @SerializedName("operationid") @Param(description = "operationid") private String operationId;
    @SerializedName("state") @Param(description = "state") private String state;
    @SerializedName("deletedcount") @Param(description = "deletedcount") private long deletedCount;
    @SerializedName("lastkey") @Param(description = "lastkey") private String lastKey;
    @SerializedName("lastversionid") @Param(description = "lastversionid") private String lastVersion;
    @SerializedName("progressknown") @Param(description = "progressknown") private boolean progressKnown;
    @SerializedName("failures") @Param(description = "failures") private java.util.List<BucketObjectVersion> failures;
    @SerializedName("errorcode") @Param(description = "errorcode") private String errorCode;
    public java.util.List<BucketObjectVersion> getVersions() { return versions; }
    public void setVersions(java.util.List<BucketObjectVersion> value) { versions = value; }
    public boolean getTruncated() { return truncated; }
    public void setTruncated(boolean value) { truncated = value; }
    public String getNextKeyMarker() { return nextKeyMarker; }
    public void setNextKeyMarker(String value) { nextKeyMarker = value; }
    public String getNextVersionMarker() { return nextVersionMarker; }
    public void setNextVersionMarker(String value) { nextVersionMarker = value; }
    public long getCurrentObjects() { return currentObjects; }
    public void setCurrentObjects(long value) { currentObjects = value; }
    public long getVersionCount() { return versionCount; }
    public void setVersionCount(long value) { versionCount = value; }
    public long getDeleteMarkers() { return deleteMarkers; }
    public void setDeleteMarkers(long value) { deleteMarkers = value; }
    public boolean getComplete() { return complete; }
    public void setComplete(boolean value) { complete = value; }
    public boolean getObjectLock() { return objectLock; }
    public void setObjectLock(boolean value) { objectLock = value; }
    public boolean getExists() { return exists; }
    public void setExists(boolean value) { exists = value; }
    public String getBlockedReason() { return blockedReason; }
    public void setBlockedReason(String value) { blockedReason = value; }
    public java.util.Date getChecked() { return checked; }
    public void setChecked(java.util.Date value) { checked = value; }
    public String getExternalId() { return externalId; }
    public void setExternalId(String value) { externalId = value; }
    public String getOperationId() { return operationId; }
    public void setOperationId(String value) { operationId = value; }
    public String getState() { return state; }
    public void setState(String value) { state = value; }
    public long getDeletedCount() { return deletedCount; }
    public void setDeletedCount(long value) { deletedCount = value; }
    public String getLastKey() { return lastKey; }
    public void setLastKey(String value) { lastKey = value; }
    public String getLastVersion() { return lastVersion; }
    public void setLastVersion(String value) { lastVersion = value; }
    public boolean getProgressKnown() { return progressKnown; }
    public void setProgressKnown(boolean value) { progressKnown = value; }
    public java.util.List<BucketObjectVersion> getFailures() { return failures; }
    public void setFailures(java.util.List<BucketObjectVersion> value) { failures = value; }
    public String getErrorCode() { return errorCode; }
    public void setErrorCode(String value) { errorCode = value; }
}
