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
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.times;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.argThat;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import com.amazonaws.services.s3.AmazonS3;
import com.amazonaws.services.s3.model.VersionListing;
import com.amazonaws.services.s3.model.S3VersionSummary;
import com.amazonaws.services.s3.model.AmazonS3Exception;
import com.amazonaws.services.s3.model.ListVersionsRequest;
import com.amazonaws.services.s3.model.GetObjectLockConfigurationResult;
import com.amazonaws.services.s3.model.ObjectLockConfiguration;
import com.amazonaws.services.s3.model.DeleteObjectsResult;
import com.amazonaws.services.s3.model.MultiObjectDeleteException;
import com.amazonaws.services.s3.model.CopyObjectRequest;
import com.amazonaws.services.s3.model.DeleteObjectsRequest;
import org.junit.Before;
import org.junit.Test;
public class CephBucketObjectClientTest {
    private AmazonS3 s3;
    private CephBucketObjectClient client;
    private VersionListing listing(S3VersionSummary... versions) {
        VersionListing p = new VersionListing(); p.getVersionSummaries().addAll(Arrays.asList(versions)); return p;
    }
    private S3VersionSummary version(String key, String id, boolean marker, boolean latest) {
        S3VersionSummary v = new S3VersionSummary(); v.setKey(key); v.setVersionId(id); v.setIsDeleteMarker(marker); v.setIsLatest(latest); return v;
    }
    private void unlocked() {
        AmazonS3Exception missing = new AmazonS3Exception("not configured"); missing.setStatusCode(404); missing.setErrorCode("ObjectLockConfigurationNotFoundError");
        when(s3.getObjectLockConfiguration(any())).thenThrow(missing);
    }
    @Before public void setup() { s3 = mock(AmazonS3.class); client = new CephBucketObjectClient(s3, "bucket"); unlocked(); }
    @Test public void normalDeleteIsNeverAdministrativePurge() {
        when(s3.listVersions(any(ListVersionsRequest.class))).thenReturn(listing());
        client.deleteEmpty(); verify(s3).deleteBucket("bucket"); verify(s3, never()).deleteObjects(any());
    }
    @Test public void allContentKindsBlockNormalDeletion() {
        for (S3VersionSummary v : List.of(version("current", "v1", false, true), version("history", "v0", false, false), version("deleted", "m1", true, true))) {
            reset(s3); when(s3.listVersions(any(ListVersionsRequest.class))).thenReturn(listing(v));
            assertThrows(RuntimeException.class, () -> client.deleteEmpty()); verify(s3, never()).deleteBucket(anyString()); verify(s3, never()).deleteObjects(any());
        }
    }
    @Test public void atomicDeleteRejectsUploadAfterPreflight() {
        when(s3.listVersions(any(ListVersionsRequest.class))).thenReturn(listing());
        AmazonS3Exception nonempty = new AmazonS3Exception("race"); nonempty.setStatusCode(409);
        doThrow(nonempty).when(s3).deleteBucket("bucket");
        assertThrows(RuntimeException.class, () -> client.deleteEmpty()); verify(s3, never()).deleteObjects(any());
    }
    @Test public void readFailureIsNeverEmpty() {
        when(s3.listVersions(any(ListVersionsRequest.class))).thenThrow(new RuntimeException("read timeout"));
        assertThrows(RuntimeException.class, () -> client.deleteEmpty()); verify(s3, never()).deleteBucket(anyString());
    }
    @Test public void impactCountsHistoricalVersionsAndMarkersAcrossPages() {
        VersionListing first = listing(version("a", "a1", false, true)); first.setTruncated(true); first.setNextKeyMarker("a"); first.setNextVersionIdMarker("a1");
        when(s3.listVersions(any(ListVersionsRequest.class))).thenReturn(first, listing(version("b", "b0", false, false), version("b", "b1", true, true)));
        var impact = client.impact(); assertTrue(impact.getComplete()); assertEquals(1, impact.getCurrentObjects()); assertEquals(2, impact.getVersionCount()); assertEquals(1, impact.getDeleteMarkers());
    }
    @Test public void unknownLockStateAndLockedBucketsNeverPurge() {
        doThrow(new RuntimeException("permission denied")).when(s3).getObjectLockConfiguration(any());
        assertThrows(RuntimeException.class, () -> client.purgeBatch()); verify(s3, never()).deleteObjects(any());
        var response = mock(GetObjectLockConfigurationResult.class); when(response.getObjectLockConfiguration()).thenReturn(new ObjectLockConfiguration().withObjectLockEnabled("Enabled"));
        doReturn(response).when(s3).getObjectLockConfiguration(any());
        assertThrows(RuntimeException.class, () -> client.purgeBatch()); assertThrows(RuntimeException.class, () -> client.mutate("key", "v", "delete"));
        verify(s3, never()).deleteVersion(anyString(), anyString(), anyString());
    }
    @Test public void partialBatchRetainsExactFailuresAndAcknowledgedProgress() {
        when(s3.listVersions(any(ListVersionsRequest.class))).thenReturn(listing(version("a", "v0", false, false), version("a", "m1", true, true)));
        var deleted = new DeleteObjectsResult.DeletedObject(); deleted.setKey("a"); deleted.setVersionId("v0");
        var error = new MultiObjectDeleteException.DeleteError(); error.setKey("a"); error.setVersionId("m1"); error.setCode("AccessDenied");
        when(s3.deleteObjects(any())).thenThrow(new MultiObjectDeleteException(List.of(error), List.of(deleted)));
        var result = client.purgeBatch(); assertEquals(1, result.getDeletedCount()); assertEquals("PARTIAL_DELETE", result.getErrorCode()); assertEquals("m1", result.getFailures().get(0).getVersionId());
        verify(s3, never()).deleteBucket(anyString());
    }
    @Test public void restoreCopiesExactHistoricalVersionAndMarkerRestoreOnlyRemovesMarker() {
        when(s3.listVersions(any(ListVersionsRequest.class))).thenReturn(listing(version("key", "old", false, false)));
        client.mutate("key", "old", "restore");
        verify(s3).copyObject(argThat((CopyObjectRequest q) -> "old".equals(q.getSourceVersionId()) && "key".equals(q.getDestinationKey())));
        when(s3.listVersions(any(ListVersionsRequest.class))).thenReturn(listing(version("key", "marker", true, true)));
        client.mutate("key", "marker", "restore"); verify(s3).deleteVersion("bucket", "key", "marker");
    }
    @Test public void onlyExactVersionIsDeletedAndMissingExactDeleteIsIdempotent() {
        when(s3.listVersions(any(ListVersionsRequest.class))).thenReturn(listing(version("key", "v1", false, true)));
        client.mutate("key", "v1", "delete"); verify(s3).deleteVersion("bucket", "key", "v1");
        client.mutate("key", "missing", "delete"); verify(s3, times(1)).deleteVersion(anyString(), anyString(), anyString());
        assertThrows(RuntimeException.class, () -> client.mutate("key", "missing", "restore"));
    }
    @Test public void repeatedCursorFailsBeforeMutation() {
        VersionListing p = listing(version("key", "id", false, true)); p.setTruncated(true);
        when(s3.listVersions(any(ListVersionsRequest.class))).thenReturn(p);
        assertThrows(RuntimeException.class, () -> client.impact()); verify(s3, never()).deleteObjects(any());
    }
    @Test public void largeBatchesAreCappedAtOneThousandExactVersions() {
        VersionListing p = listing();
        for (int i=0; i<1000; i++) p.getVersionSummaries().add(version("k"+i, "v"+i, false, true));
        p.setTruncated(true); p.setNextKeyMarker("k999"); p.setNextVersionIdMarker("v999");
        when(s3.listVersions(any(ListVersionsRequest.class))).thenReturn(p);
        when(s3.deleteObjects(any())).thenAnswer(call -> {
            DeleteObjectsRequest request = call.getArgument(0); assertEquals(1000, request.getKeys().size());
            List<DeleteObjectsResult.DeletedObject> removed = new ArrayList<>();
            for (var key : request.getKeys()) { var v = new DeleteObjectsResult.DeletedObject(); v.setKey(key.getKey()); v.setVersionId(key.getVersion()); removed.add(v); }
            return new DeleteObjectsResult(removed);
        });
        assertEquals(1000, client.purgeBatch().getDeletedCount());
    }
}
