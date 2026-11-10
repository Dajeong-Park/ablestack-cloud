/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
package org.apache.cloudstack.storage.object;

import com.cloud.agent.api.to.BucketTO;
import org.apache.cloudstack.engine.subsystem.api.storage.DataStore;

import java.util.List;
import java.util.Map;

public interface ObjectStoreEntity extends DataStore, ObjectStore {
    default java.util.Map<String, String> protectionCapabilities() {
        return getDriver() instanceof BucketProtectionProvider ? ((BucketProtectionProvider)getDriver()).protectionCapabilities(getId()) :
                java.util.Map.of("encryption", "Unknown", "versioning", "Unknown", "objectlocking", "Unknown", "reason", "PROVIDER_NOT_VERIFIED");
    }
    default org.apache.cloudstack.api.response.BucketProtectionResponse readBucketProtection(Bucket bucket) {
        if (!(getDriver() instanceof BucketProtectionProvider)) throw new com.cloud.utils.exception.CloudRuntimeException("PROTECTION_READ_UNSUPPORTED");
        return ((BucketProtectionProvider)getDriver()).readBucketProtection(bucket);
    }
    Bucket createBucket(Bucket bucket, boolean objectLock);

    List<Bucket> listBuckets();

    boolean createUser(long accountId);

    boolean deleteBucket(BucketTO bucket);

    boolean setBucketEncryption(BucketTO bucket);

    boolean deleteBucketEncryption(BucketTO bucket);

    boolean setBucketVersioning(BucketTO bucket);

    boolean deleteBucketVersioning(BucketTO bucket);

    void setBucketPolicy(BucketTO bucket, String policy);

    void setQuota(BucketTO bucket, int quota);

    Map<String, Long> getAllBucketsUsage();
}
