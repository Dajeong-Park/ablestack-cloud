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
import java.util.Map;
import com.cloud.serializer.Param;
import com.google.gson.annotations.SerializedName;
import org.apache.cloudstack.api.BaseResponse;

/** Allowlisted HEAD data only; never serialize the provider response or its headers. */
public class BucketObjectMetadataResponse extends BaseResponse {
    public enum Status { Available, NotFound, Forbidden, Timeout, Unavailable, Unsupported }
    @SerializedName("key") @Param(description = "Exact UTF-8 object key") private String key;
    @SerializedName("versionid") @Param(description = "Selected or effective S3 object version") private String versionId;
    @SerializedName("sizebytes") @Param(description = "Object length in bytes") private Long sizeBytes;
    @SerializedName("lastmodified") @Param(description = "S3 object modification time") private Date lastModified;
    @SerializedName("etag") @Param(description = "S3 entity tag without surrounding quotes") private String etag;
    @SerializedName("contenttype") @Param(description = "Object content type") private String contentType;
    @SerializedName("metadata") @Param(description = "User-defined object metadata") private Map<String, String> metadata;
    @SerializedName("status") @Param(description = "HEAD lookup result") private Status status;
    @SerializedName("checked") @Param(description = "Cloud lookup time, not the object modification time") private Date checked;
    public BucketObjectMetadataResponse() { }
    public BucketObjectMetadataResponse(String key, String version, Status status) {
        this.key = key; this.versionId = version; this.status = status; this.checked = new Date();
    }
    public String getKey() { return key; }
    public String getVersionId() { return versionId; }
    public void setVersionId(String value) { versionId = value; }
    public Long getSizeBytes() { return sizeBytes; }
    public void setSizeBytes(long value) { sizeBytes = value; }
    public Date getLastModified() { return lastModified; }
    public void setLastModified(Date value) { lastModified = value; }
    public String getEtag() { return etag; }
    public void setEtag(String value) { etag = value; }
    public String getContentType() { return contentType; }
    public void setContentType(String value) { contentType = value; }
    public Map<String, String> getMetadata() { return metadata; }
    public void setMetadata(Map<String, String> value) { metadata = value; }
    public Status getStatus() { return status; }
    public Date getChecked() { return checked; }
}
