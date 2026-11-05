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
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.fail;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.any;
import static org.mockito.Mockito.times;
import com.amazonaws.services.s3.AmazonS3;
import com.amazonaws.services.s3.model.ListVersionsRequest;
import com.amazonaws.services.s3.model.ListMultipartUploadsRequest;
import com.amazonaws.services.s3.model.VersionListing;
import com.amazonaws.services.s3.model.S3VersionSummary;
import com.amazonaws.services.s3.model.MultipartUploadListing;
import com.amazonaws.services.s3.model.MultipartUpload;
import com.cloud.utils.exception.CloudRuntimeException;
import java.util.List;
import org.apache.cloudstack.storage.object.Bucket;
import org.junit.Test;
public class CephBucketUsageTest {
    private final AmazonS3 client = mock(AmazonS3.class);
    private final Bucket bucket = mock(Bucket.class);
    private final CephObjectStoreDriverImpl driver = new CephObjectStoreDriverImpl() {
        @Override protected AmazonS3 getS3Client(long store, long account) { return client; }
    };
    private final VersionListing versions = mock(VersionListing.class);
    private final MultipartUploadListing uploads = mock(MultipartUploadListing.class);
    public CephBucketUsageTest() {
        when(bucket.getName()).thenReturn("bucket");
        when(client.listVersions(any(ListVersionsRequest.class))).thenReturn(versions);
        when(versions.getVersionSummaries()).thenReturn(List.of());
        when(client.listMultipartUploads(any(ListMultipartUploadsRequest.class))).thenReturn(uploads);
        when(uploads.getMultipartUploads()).thenReturn(List.of());
    }
    private void reject() {
        try { driver.verifyZeroUsage(bucket); fail("Accepted unverified zero"); }
        catch (CloudRuntimeException expected) { assertFalse(expected.getMessage().contains("PRIVATE")); }
        verify(client).shutdown();
    }
    @Test public void confirmedEmptyBucketAcceptsZero() { driver.verifyZeroUsage(bucket); verify(client).shutdown(); }
    @Test public void positiveLiveVersionRejectsLaggedZeroStatistics() {
        S3VersionSummary value = new S3VersionSummary(); value.setSize(4096);
        when(versions.getVersionSummaries()).thenReturn(List.of(value)); reject();
    }
    @Test public void verifiedZeroByteObjectsAndMarkersAreNotConfusedWithEmptyOnlyDeletion() {
        S3VersionSummary value = new S3VersionSummary(); value.setSize(0);
        S3VersionSummary marker = mock(S3VersionSummary.class); when(marker.isDeleteMarker()).thenReturn(true);
        when(versions.getVersionSummaries()).thenReturn(List.of(value, marker));
        driver.verifyZeroUsage(bucket); verify(client).shutdown();
    }
    @Test public void incompleteVersionPageCannotProveZero() {
        when(versions.isTruncated()).thenReturn(true); reject();
    }
    @Test public void multipartUploadsPreventZero() {
        when(uploads.getMultipartUploads()).thenReturn(List.of(new MultipartUpload())); reject();
    }
    @Test public void inventoryFailureIsNotZeroAndDoesNotExposeProviderDetail() {
        when(client.listVersions(any(ListVersionsRequest.class))).thenThrow(new CloudRuntimeException("PRIVATE_PROVIDER_DETAIL")); reject();
    }
    @Test public void followsVersionCursorBeforeAcceptingZero() {
        VersionListing last = mock(VersionListing.class); when(last.getVersionSummaries()).thenReturn(List.of());
        when(versions.isTruncated()).thenReturn(true); when(versions.getNextKeyMarker()).thenReturn("key"); when(versions.getNextVersionIdMarker()).thenReturn("version");
        when(client.listVersions(any(ListVersionsRequest.class))).thenReturn(versions, last);
        driver.verifyZeroUsage(bucket); verify(client, times(2)).listVersions(any(ListVersionsRequest.class)); verify(client).shutdown();
    }
}
