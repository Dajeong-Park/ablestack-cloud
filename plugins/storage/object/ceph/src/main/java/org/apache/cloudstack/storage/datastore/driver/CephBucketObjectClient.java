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

import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Objects;
import java.util.HashSet;
import java.util.Set;
import com.amazonaws.services.s3.AmazonS3;
import com.amazonaws.services.s3.model.VersionListing;
import com.amazonaws.services.s3.model.S3VersionSummary;
import com.amazonaws.services.s3.model.ListVersionsRequest;
import com.amazonaws.services.s3.model.GetObjectLockConfigurationRequest;
import com.amazonaws.services.s3.model.GetObjectLockConfigurationResult;
import com.amazonaws.services.s3.model.AmazonS3Exception;
import com.amazonaws.services.s3.model.DeleteObjectsRequest;
import com.amazonaws.services.s3.model.DeleteObjectsResult;
import com.amazonaws.services.s3.model.MultiObjectDeleteException;
import com.amazonaws.services.s3.model.CopyObjectRequest;
import com.cloud.utils.exception.CloudRuntimeException;
import org.apache.cloudstack.api.response.BucketObjectResponse;
import org.apache.cloudstack.api.response.BucketObjectVersion;

/** Tenant-authenticated S3 only. No admin deletion or governance-retention bypass. */
public class CephBucketObjectClient {
    private final AmazonS3 s3;
    private final String bucket;
    public CephBucketObjectClient(AmazonS3 client, String name) { s3 = client; bucket = name; }

    public BucketObjectResponse page(String key, String version, int limit) {
        if (limit < 1 || limit > 1000 || version != null && key == null) throw failure("INVALID_PAGE");
        VersionListing page = s3.listVersions(new ListVersionsRequest().withBucketName(bucket)
                .withKeyMarker(key).withVersionIdMarker(version).withMaxResults(limit));
        if (page == null) throw failure("VERSION_READ_FAILED");
        BucketObjectResponse result = new BucketObjectResponse();
        List<BucketObjectVersion> entries = new ArrayList<>();
        for (S3VersionSummary item : page.getVersionSummaries()) {
            BucketObjectVersion row = new BucketObjectVersion();
            row.setKey(item.getKey()); row.setVersionId(item.getVersionId()); row.setLatest(item.isLatest());
            row.setDeleteMarker(item.isDeleteMarker()); row.setSize(item.getSize()); row.setModified(item.getLastModified()); entries.add(row);
        }
        if (entries.size() > limit) throw failure("VERSION_READ_FAILED");
        result.setVersions(entries); result.setTruncated(page.isTruncated());
        result.setNextKeyMarker(page.getNextKeyMarker()); result.setNextVersionMarker(page.getNextVersionIdMarker());
        result.setChecked(new Date()); result.setExists(true);
        if (result.getTruncated() && (result.getNextKeyMarker() == null ||
                Objects.equals(key, result.getNextKeyMarker()) && Objects.equals(version, result.getNextVersionMarker()))) throw failure("INVALID_CURSOR");
        return result;
    }

    public boolean locked() {
        try {
            GetObjectLockConfigurationResult response = s3.getObjectLockConfiguration(new GetObjectLockConfigurationRequest().withBucketName(bucket));
            if (response == null || response.getObjectLockConfiguration() == null) throw failure("LOCK_STATE_UNKNOWN");
            String enabled = response.getObjectLockConfiguration().getObjectLockEnabled();
            if (!"Enabled".equals(enabled)) throw failure("LOCK_STATE_UNKNOWN");
            return true;
        } catch (AmazonS3Exception error) {
            if (error.getStatusCode() == 404 && ("ObjectLockConfigurationNotFoundError".equals(error.getErrorCode()) ||
                    "NoSuchObjectLockConfiguration".equals(error.getErrorCode()))) return false;
            throw failure("LOCK_READ_FAILED");
        }
    }

    public BucketObjectResponse impact() {
        BucketObjectResponse result = new BucketObjectResponse();
        result.setObjectLock(locked()); result.setExists(true); result.setChecked(new Date());
        String key = null, version = null;
        long deadline = System.nanoTime() + 10_000_000_000L;
        for (int i = 0; i < 100; i++) {
            BucketObjectResponse page = page(key, version, 1000);
            for (BucketObjectVersion entry : page.getVersions()) {
                if (entry.getDeleteMarker()) result.setDeleteMarkers(result.getDeleteMarkers() + 1);
                else {
                    result.setVersionCount(result.getVersionCount() + 1);
                    if (entry.getLatest()) result.setCurrentObjects(result.getCurrentObjects() + 1);
                }
            }
            if (!page.getTruncated()) { result.setComplete(true); break; }
            key = page.getNextKeyMarker(); version = page.getNextVersionMarker();
            if (System.nanoTime() >= deadline) break;
        }
        if (result.getObjectLock()) result.setBlockedReason("OBJECT_LOCK_ENABLED");
        else if (!result.getComplete()) result.setBlockedReason("INCOMPLETE_SCAN");
        return result;
    }

    public void deleteEmpty() {
        if (!page(null, null, 1).getVersions().isEmpty()) throw failure("BUCKET_NOT_EMPTY");
        // The final atomic S3 operation also rejects a concurrent upload. No purge fallback.
        s3.deleteBucket(bucket);
    }

    public void mutate(String key, String version, String action) {
        if (key == null || key.isEmpty() || key.getBytes(java.nio.charset.StandardCharsets.UTF_8).length > 1024 ||
                version == null || version.isEmpty() || version.length() > 1024 ||
                !List.of("delete", "restore").contains(action)) throw failure("INVALID_VERSION");
        if (locked()) throw failure("OBJECT_LOCK_ENABLED");
        String marker = null, versionMarker = null;
        BucketObjectVersion found = null;
        boolean fullyScanned = false;
        long deadline = System.nanoTime() + 10_000_000_000L;
        for (int i = 0; i < 100; i++) {
            VersionListing listing = s3.listVersions(new ListVersionsRequest().withBucketName(bucket).withPrefix(key)
                    .withKeyMarker(marker).withVersionIdMarker(versionMarker).withMaxResults(1000));
            if (listing == null) throw failure("VERSION_READ_FAILED");
            for (S3VersionSummary item : listing.getVersionSummaries()) {
                if (key.equals(item.getKey()) && version.equals(item.getVersionId())) {
                    found = new BucketObjectVersion(); found.setDeleteMarker(item.isDeleteMarker()); break;
                }
            }
            if (found != null) break;
            if (!listing.isTruncated()) { fullyScanned = true; break; }
            if (System.nanoTime() >= deadline) break;
            if (Objects.equals(marker, listing.getNextKeyMarker()) && Objects.equals(versionMarker, listing.getNextVersionIdMarker())) throw failure("INVALID_CURSOR");
            marker = listing.getNextKeyMarker(); versionMarker = listing.getNextVersionIdMarker();
            if (marker == null) throw failure("INVALID_CURSOR");
        }
        if (found == null) {
            if (!fullyScanned) throw failure("INCOMPLETE_SCAN");
            if ("delete".equals(action)) return; // Exact-version deletion is idempotent.
            throw failure("VERSION_NOT_FOUND");
        }
        if ("delete".equals(action) || found.getDeleteMarker()) s3.deleteVersion(bucket, key, version);
        else s3.copyObject(new CopyObjectRequest(bucket, key, bucket, key).withSourceVersionId(version));
    }

    public BucketObjectResponse purgeBatch() {
        if (locked()) throw failure("OBJECT_LOCK_ENABLED");
        BucketObjectResponse page = page(null, null, 1000);
        BucketObjectResponse result = new BucketObjectResponse(); result.setProgressKnown(true);
        result.setComplete(page.getVersions().isEmpty()); result.setFailures(new ArrayList<>());
        if (result.getComplete()) return result;
        List<DeleteObjectsRequest.KeyVersion> targets = new ArrayList<>();
        for (BucketObjectVersion version : page.getVersions()) targets.add(new DeleteObjectsRequest.KeyVersion(version.getKey(), version.getVersionId()));
        BucketObjectVersion last = page.getVersions().get(page.getVersions().size() - 1);
        result.setLastKey(last.getKey()); result.setLastVersion(last.getVersionId());
        try {
            DeleteObjectsResult deleted = s3.deleteObjects(new DeleteObjectsRequest(bucket).withKeys(targets).withQuiet(false));
            if (deleted == null || deleted.getDeletedObjects().size() != targets.size()) throw failure("AMBIGUOUS_BATCH");
            Set<List<String>> expected = new HashSet<>();
            for (DeleteObjectsRequest.KeyVersion target : targets) expected.add(List.of(target.getKey(), target.getVersion()));
            for (DeleteObjectsResult.DeletedObject item : deleted.getDeletedObjects()) {
                if (item.getKey() == null || item.getVersionId() == null ||
                        !expected.remove(List.of(item.getKey(), item.getVersionId()))) throw failure("AMBIGUOUS_BATCH");
            }
            if (!expected.isEmpty()) throw failure("AMBIGUOUS_BATCH");
            result.setDeletedCount(deleted.getDeletedObjects().size());
        } catch (MultiObjectDeleteException partial) {
            result.setDeletedCount(partial.getDeletedObjects().size());
            for (MultiObjectDeleteException.DeleteError error : partial.getErrors()) {
                BucketObjectVersion item = new BucketObjectVersion(); item.setKey(error.getKey()); item.setVersionId(error.getVersionId());
                item.setErrorCode("DELETE_REJECTED"); if (result.getFailures().size() < 20) result.getFailures().add(item);
            }
            result.setErrorCode("PARTIAL_DELETE"); // Keep metadata/counters and retry only remaining exact versions.
        }
        return result;
    }
    private CloudRuntimeException failure(String code) { return new CloudRuntimeException(code); }
}
