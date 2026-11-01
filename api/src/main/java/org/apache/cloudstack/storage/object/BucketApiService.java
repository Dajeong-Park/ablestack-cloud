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

import com.cloud.exception.ResourceAllocationException;
import com.cloud.user.Account;
import org.apache.cloudstack.api.command.user.bucket.CreateBucketCmd;
import org.apache.cloudstack.api.command.user.bucket.SyncBucketUsageCmd;
import org.apache.cloudstack.api.command.user.bucket.UpdateBucketCmd;
import org.apache.cloudstack.framework.config.ConfigKey;

public interface BucketApiService {


    ConfigKey<Long> DefaultMaxAccountBuckets = new ConfigKey<Long>("Account Defaults", Long.class,
            "max.account.buckets",
            "20",
            "The default maximum number of buckets that can be created for an account",
            false,
            ConfigKey.Scope.Global,
            null);

    ConfigKey<Long> DefaultMaxAccountObjectStorage = new ConfigKey<Long>("Account Defaults", Long.class,
            "max.account.object.storage",
            "400",
            "The default maximum object storage space (in GiB) that can be used for an account",
            false,
            ConfigKey.Scope.Global,
            null);

    ConfigKey<Long> DefaultMaxProjectBuckets = new ConfigKey<Long>("Project Defaults", Long.class,
            "max.project.buckets",
            "20",
            "The default maximum number of buckets that can be created for a project",
            false,
            ConfigKey.Scope.Global,
            null);

    ConfigKey<Long> DefaultMaxProjectObjectStorage = new ConfigKey<Long>("Project Defaults", Long.class,
            "max.project.object.storage",
            "400",
            "The default maximum object storage space (in GiB) that can be used for a project",
            false,
            ConfigKey.Scope.Global,
            null);

    ConfigKey<Long> DefaultMaxDomainBuckets = new ConfigKey<Long>("Domain Defaults", Long.class,
            "max.domain.buckets",
            "20",
            "The default maximum number of buckets that can be created for a domain",
            false,
            ConfigKey.Scope.Global,
            null);

    ConfigKey<Long> DefaultMaxDomainObjectStorage = new ConfigKey<Long>("Domain Defaults", Long.class,
            "max.domain.object.storage",
            "400",
            "The default maximum object storage space (in GiB) that can be used for a domain",
            false,
            ConfigKey.Scope.Global,
            null);

    /**
     * Creates the database object for a Bucket based on the given criteria
     *
     * @param cmd
     *            the API command wrapping the criteria (account/domainId [admin only], zone, diskOffering, snapshot,
     *            name)
     * @return the Bucket object
     */
    Bucket allocBucket(CreateBucketCmd cmd) throws ResourceAllocationException;

    /**
     * Creates the Bucket based on the given criteria
     *
     * @param cmd
     *            the API command wrapping the criteria (account/domainId [admin only], zone, diskOffering, snapshot,
     *            name)
     * @return the Bucket object
     */
    Bucket createBucket(CreateBucketCmd cmd);

    boolean deleteBucket(long bucketId, Account caller) throws ResourceAllocationException;

    boolean updateBucket(UpdateBucketCmd cmd, Account caller) throws ResourceAllocationException;

    Bucket syncBucketUsage(SyncBucketUsageCmd cmd, Account caller);

    org.apache.cloudstack.api.response.BucketCredentialResponse getCredentials(long id, Account caller, boolean reveal);
    org.apache.cloudstack.api.response.BucketCredentialResponse rotateCredentials(long id, Account caller, long revision,
            String operationId, String action, int graceSeconds);
    org.apache.cloudstack.api.response.BucketObjectResponse getDeletionImpact(String id, Account caller);
    org.apache.cloudstack.api.response.BucketObjectResponse listObjectVersions(String id, Account caller, String keyMarker, String versionMarker, int limit);
    org.apache.cloudstack.api.response.BucketObjectResponse manageObjectVersion(String id, Account caller, String key, String version, String action);
    org.apache.cloudstack.api.response.BucketObjectResponse purgeBucket(String id, Account caller, String operation, String name, boolean includeVersions, String externalId, boolean retry);
    org.apache.cloudstack.api.response.BucketObjectResponse getPurgeStatus(String id, Account caller, String operation);
    org.apache.cloudstack.api.response.BucketProtectionResponse getProtection(String id, Account caller);
    org.apache.cloudstack.api.response.BucketProtectionResponse reconcileProtection(String id, Account caller, String operation, boolean acceptActual);
    org.apache.cloudstack.api.response.BucketObjectMetadataResponse getObjectMetadata(String id, Account caller, String objectKey, String versionId);
    void getBucketUsage();
}
