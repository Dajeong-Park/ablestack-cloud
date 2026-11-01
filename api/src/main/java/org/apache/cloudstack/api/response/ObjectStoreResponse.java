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

import org.apache.cloudstack.api.ApiConstants;
import org.apache.cloudstack.storage.object.ObjectStore;
import com.google.gson.annotations.SerializedName;
import org.apache.cloudstack.api.BaseResponseWithAnnotations;
import org.apache.cloudstack.api.EntityReference;

@EntityReference(value = ObjectStore.class)
public class ObjectStoreResponse extends BaseResponseWithAnnotations {
    @SerializedName(ApiConstants.ID)
    @Param(description = "the ID of the object store")
    private String id;

    @SerializedName(ApiConstants.NAME)
    @Param(description = "the name of the object store")
    private String name;

    @SerializedName(ApiConstants.URL)
    @Param(description = "the url of the object store")
    private String url;

    @SerializedName("providername")
    @Param(description = "the provider name of the object store")
    private String providerName;

    @SerializedName("storagetotal")
    @Param(description = "the total size of the object store")
    private Long storageTotal;

    @SerializedName("storageallocated")
    @Param(description = "the allocated size of the object store")
    private Long storageAllocated;

    @SerializedName("storageused")
    @Param(description = "the object store currently used size")
    private Long storageUsed;

    @SerializedName("storagereserved")
    @Param(description = "bytes reserved by unfinished bucket quota operations")
    private Long storageReserved;
    public Long getStorageReserved() { return storageReserved; }
    public void setStorageReserved(Long value) { storageReserved = value; storagereservedbytes = value == null ? null : value.toString(); }

    @SerializedName("capabilities") @Param(description = "Verified provider features: Supported, Unsupported or Unknown, and constraints")
    private java.util.Map<String, String> capabilities;
    public void setCapabilities(java.util.Map<String, String> value) { capabilities = value; }
    @SerializedName("storagetotalbytes") @Param(description = "exact total bytes without JSON number precision loss") private String storagetotalbytes;
    public void setStoragetotalbytes(String value) { storagetotalbytes = value; }
    @SerializedName("storageallocatedbytes") @Param(description = "exact allocated bytes") private String storageallocatedbytes;
    public void setStorageallocatedbytes(String value) { storageallocatedbytes = value; }
    @SerializedName("storageusedbytes") @Param(description = "exact last known used bytes") private String storageusedbytes;
    public void setStorageusedbytes(String value) { storageusedbytes = value; }
    @SerializedName("storagereservedbytes") @Param(description = "exact reserved bytes") private String storagereservedbytes;
    public void setStoragereservedbytes(String value) { storagereservedbytes = value; }
    @SerializedName("capacitytracking") @Param(description = "Enabled, Disabled or Unknown; operator tracking limit, not physical capacity") private String capacitytracking;
    public void setCapacitytracking(String value) { capacitytracking = value; }
    @SerializedName("connectionrevision") @Param(description = "opaque connection configuration revision") private String connectionrevision;
    public void setConnectionrevision(String value) { connectionrevision = value; }
    @SerializedName("usagestatus") @Param(description = "Fresh, Stale, Error, Unknown or NoBuckets for managed bucket statistics") private String usagestatus;
    public void setUsagestatus(String value) { usagestatus = value; }
    @SerializedName("usagelastupdated") @Param(description = "oldest known successful managed bucket collection") private java.util.Date usagelastupdated;
    public void setUsagelastupdated(java.util.Date value) { usagelastupdated = value; }
    @SerializedName("usagebucketcount") @Param(description = "active managed bucket count") private Integer usagebucketcount;
    public void setUsagebucketcount(Integer value) { usagebucketcount = value; }
    @SerializedName("usageunknownbuckets") @Param(description = "buckets without known measured usage") private Integer usageunknownbuckets;
    public void setUsageunknownbuckets(Integer value) { usageunknownbuckets = value; }
    @SerializedName("usagefailedbuckets") @Param(description = "buckets whose latest collection failed") private Integer usagefailedbuckets;
    public void setUsagefailedbuckets(Integer value) { usagefailedbuckets = value; }
    @SerializedName("storageallocatedknown") @Param(description = "whether the corresponding capacity value is known") private Boolean storageallocatedknown;
    public void setStorageallocatedknown(Boolean value) { storageallocatedknown = value; }
    @SerializedName("storageusedknown") @Param(description = "whether the corresponding capacity value is known") private Boolean storageusedknown;
    public void setStorageusedknown(Boolean value) { storageusedknown = value; }
    @SerializedName("storagereservedknown") @Param(description = "whether the corresponding capacity value is known") private Boolean storagereservedknown;
    public void setStoragereservedknown(Boolean value) { storagereservedknown = value; }
    public ObjectStoreResponse() {
    }

    @Override
    public String getObjectId() {
        return this.getId();
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getUrl() {
        return url;
    }

    public void setUrl(String url) {
        this.url = url;
    }

    public String getProviderName() {
        return providerName;
    }

    public void setProviderName(String providerName) {
        this.providerName = providerName;
    }

    public Long getStorageTotal() {
        return storageTotal;
    }

    public void setStorageTotal(Long storageTotal) {
        this.storageTotal = storageTotal;
        storagetotalbytes = storageTotal == null ? null : storageTotal.toString();
    }

    public Long getStorageAllocated() {
        return storageAllocated;
    }

    public void setStorageAllocated(Long storageAllocated) {
        this.storageAllocated = storageAllocated;
        storageallocatedbytes = storageAllocated == null ? null : storageAllocated.toString();
    }

    public Long getStorageUsed() {
        return storageUsed;
    }

    public void setStorageUsed(Long storageUsed) {
        this.storageUsed = storageUsed;
        // Legacy storageused remains KiB; the companion is exact bytes without long overflow.
        storageusedbytes = storageUsed == null ? null : java.math.BigInteger.valueOf(storageUsed).shiftLeft(10).toString();
    }
}
