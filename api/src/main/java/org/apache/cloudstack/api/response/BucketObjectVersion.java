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

public class BucketObjectVersion extends BaseResponse {
    @SerializedName("key") @Param(description = "key") private String key;
    @SerializedName("versionid") @Param(description = "versionid") private String versionId;
    @SerializedName("islatest") @Param(description = "islatest") private boolean latest;
    @SerializedName("deletemarker") @Param(description = "deletemarker") private boolean deleteMarker;
    @SerializedName("size") @Param(description = "size") private long size;
    @SerializedName("lastmodified") @Param(description = "lastmodified") private java.util.Date modified;
    @SerializedName("errorcode") @Param(description = "errorcode") private String errorCode;
    public String getKey() { return key; }
    public void setKey(String value) { key = value; }
    public String getVersionId() { return versionId; }
    public void setVersionId(String value) { versionId = value; }
    public boolean getLatest() { return latest; }
    public void setLatest(boolean value) { latest = value; }
    public boolean getDeleteMarker() { return deleteMarker; }
    public void setDeleteMarker(boolean value) { deleteMarker = value; }
    public long getSize() { return size; }
    public void setSize(long value) { size = value; }
    public java.util.Date getModified() { return modified; }
    public void setModified(java.util.Date value) { modified = value; }
    public String getErrorCode() { return errorCode; }
    public void setErrorCode(String value) { errorCode = value; }
}
