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
package org.apache.cloudstack.storage.datastore.driver;

import java.util.Date;
import com.amazonaws.services.s3.AmazonS3;
import com.amazonaws.services.s3.model.AmazonS3Exception;
import com.amazonaws.services.s3.model.BucketVersioningConfiguration;
import com.amazonaws.services.s3.model.GetObjectLockConfigurationRequest;
import com.amazonaws.services.s3.model.GetBucketEncryptionRequest;
import com.amazonaws.services.s3.model.SetBucketEncryptionRequest;
import com.amazonaws.services.s3.model.DeleteBucketEncryptionRequest;
import com.amazonaws.services.s3.model.ServerSideEncryptionConfiguration;
import com.amazonaws.services.s3.model.ServerSideEncryptionRule;
import com.amazonaws.services.s3.model.ServerSideEncryptionByDefault;
import com.cloud.utils.exception.CloudRuntimeException;
import org.apache.cloudstack.api.response.BucketProtectionResponse;

/** Read all three controls before publishing any effective value. Never infer disabled from an I/O failure. */
public class CephBucketProtectionClient {
    private final AmazonS3 client;
    private final String bucket;
    public CephBucketProtectionClient(AmazonS3 client, String bucket) { this.client = client; this.bucket = bucket; }
    public BucketProtectionResponse read() {
        BucketProtectionResponse result = new BucketProtectionResponse();
        try {
            BucketVersioningConfiguration versioning = client.getBucketVersioningConfiguration(bucket);
            if (versioning == null) throw new CloudRuntimeException("VERSIONING_STATE_UNKNOWN");
            String status = versioning.getStatus();
            if (status == null || status.isEmpty()) status = "Off";
            if (!"Off".equals(status) && !"Enabled".equals(status) && !"Suspended".equals(status)) throw new CloudRuntimeException("VERSIONING_STATE_UNKNOWN");
            result.setVersioning("Enabled".equals(status)); result.setVersioningStatus(status);
            try {
                var lock = client.getObjectLockConfiguration(new GetObjectLockConfigurationRequest().withBucketName(bucket));
                if (lock == null || lock.getObjectLockConfiguration() == null || !"Enabled".equals(lock.getObjectLockConfiguration().getObjectLockEnabled())) throw new CloudRuntimeException("OBJECT_LOCK_STATE_UNKNOWN");
                result.setObjectLock(true);
            } catch (AmazonS3Exception error) {
                if (error.getStatusCode() != 404 || !("ObjectLockConfigurationNotFoundError".equals(error.getErrorCode()) || "NoSuchObjectLockConfiguration".equals(error.getErrorCode()))) throw error;
                result.setObjectLock(false);
            }
            try {
                var response = client.getBucketEncryption(new GetBucketEncryptionRequest().withBucketName(bucket));
                if (response == null || response.getServerSideEncryptionConfiguration() == null || response.getServerSideEncryptionConfiguration().getRules() == null || response.getServerSideEncryptionConfiguration().getRules().size() != 1) throw new CloudRuntimeException("ENCRYPTION_STATE_UNKNOWN");
                var defaults = response.getServerSideEncryptionConfiguration().getRules().get(0).getApplyServerSideEncryptionByDefault();
                if (defaults == null || defaults.getSSEAlgorithm() == null) throw new CloudRuntimeException("ENCRYPTION_STATE_UNKNOWN");
                result.setAlgorithm(defaults.getSSEAlgorithm()); result.setEncryption(true);
            } catch (AmazonS3Exception error) {
                if (error.getStatusCode() != 404 || !("ServerSideEncryptionConfigurationNotFoundError".equals(error.getErrorCode()) || "NoSuchServerSideEncryptionConfiguration".equals(error.getErrorCode()))) throw error;
                result.setEncryption(false); result.setAlgorithm("None");
            }
            result.setCheckedAt(new Date()); result.setVerifiedAt(result.getCheckedAt()); return result;
        } catch (RuntimeException failure) { throw new CloudRuntimeException("PROTECTION_READ_FAILED"); }
    }
    public boolean encryption(boolean enabled) {
        try {
            if (enabled) {
                var defaults = new ServerSideEncryptionByDefault().withSSEAlgorithm("AES256");
                var configuration = new ServerSideEncryptionConfiguration().withRules(new ServerSideEncryptionRule().withApplyServerSideEncryptionByDefault(defaults));
                client.setBucketEncryption(new SetBucketEncryptionRequest().withBucketName(bucket).withServerSideEncryptionConfiguration(configuration));
            } else client.deleteBucketEncryption(new DeleteBucketEncryptionRequest().withBucketName(bucket));
            return true;
        } catch (RuntimeException failure) { throw new CloudRuntimeException("ENCRYPTION_APPLY_FAILED"); }
    }
}
