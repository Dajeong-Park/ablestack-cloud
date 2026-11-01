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
package org.apache.cloudstack.storage.datastore.db;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.CALLS_REAL_METHODS;
import java.util.Date;
import java.util.List;
import java.util.Map;
import com.cloud.storage.BucketVO;
import com.cloud.storage.dao.BucketDao;
import org.apache.cloudstack.storage.object.Bucket;
import org.junit.Test;
import org.springframework.test.util.ReflectionTestUtils;
public class ObjectStoreCapacityResponseTest {
    private final ObjectStoreDaoImpl dao = mock(ObjectStoreDaoImpl.class, CALLS_REAL_METHODS);
    private final BucketDao buckets = mock(BucketDao.class);
    private final ObjectStoreVO store = mock(ObjectStoreVO.class);
    public ObjectStoreCapacityResponseTest() {
        ReflectionTestUtils.setField(dao, "buckets", buckets); ReflectionTestUtils.setField(dao, "quotaOperations", mock(BucketQuotaOperationDao.class));
        ObjectStoreDetailsDao details = mock(ObjectStoreDetailsDao.class); ReflectionTestUtils.setField(dao, "details", details);
        when(store.getAllocatedSize()).thenReturn(null); when(store.getId()).thenReturn(7L); when(store.getUuid()).thenReturn("uuid"); when(details.getDetails(7L)).thenReturn(Map.of("connectionrevision", "revision", "secretkey", "private"));
        when(buckets.listByObjectStoreId(7L)).thenReturn(List.of());
    }
    private com.google.gson.JsonObject json() { return new com.google.gson.Gson().toJsonTree(dao.newObjectStoreResponse(store)).getAsJsonObject(); }
    @Test public void exactLegacyBytesAndTrackingModesRemainDistinct() {
        when(store.getTotalSize()).thenReturn(Long.MAX_VALUE); assertEquals("9223372036854775807", json().get("storagetotalbytes").getAsString()); assertEquals("Enabled", json().get("capacitytracking").getAsString());
        when(store.getTotalSize()).thenReturn(0L); assertEquals("Disabled", json().get("capacitytracking").getAsString()); assertEquals(0, json().get("storagetotal").getAsLong());
        when(store.getTotalSize()).thenReturn(null); assertEquals("Unknown", json().get("capacitytracking").getAsString()); assertFalse(json().has("storagetotal")); assertFalse(json().toString().contains("private"));
    }
    @Test public void missingUsageIsNotAVerifiedZero() {
        when(store.getUsedSize()).thenReturn(null); assertFalse(json().get("storageusedknown").getAsBoolean()); assertEquals("NoBuckets", json().get("usagestatus").getAsString());
        when(store.getUsedSize()).thenReturn(0L); assertTrue(json().get("storageusedknown").getAsBoolean());
    }
    private BucketVO bucket(Date date, String status) {
        BucketVO b = mock(BucketVO.class); when(b.getState()).thenReturn(Bucket.State.Created); when(b.getSize()).thenReturn(0L); when(b.getUsageStatus()).thenReturn(status); when(b.getUsageLastUpdated()).thenReturn(date); return b;
    }
    @Test public void aggregatesManagedBucketFreshnessAndFailures() {
        org.mockito.Mockito.doReturn(List.of(bucket(new Date(), "Fresh"))).when(buckets).listByObjectStoreId(7L); assertEquals("Fresh", json().get("usagestatus").getAsString());
        org.mockito.Mockito.doReturn(List.of(bucket(new Date(1), "Fresh"))).when(buckets).listByObjectStoreId(7L); assertEquals("Stale", json().get("usagestatus").getAsString());
        org.mockito.Mockito.doReturn(List.of(bucket(null, "Unknown"))).when(buckets).listByObjectStoreId(7L); assertEquals("Unknown", json().get("usagestatus").getAsString()); assertEquals(1, json().get("usageunknownbuckets").getAsInt()); assertFalse(json().get("storageallocatedknown").getAsBoolean());
        org.mockito.Mockito.doReturn(List.of(bucket(new Date(1), "Error"), bucket(null, "Unknown"))).when(buckets).listByObjectStoreId(7L); assertEquals("Error", json().get("usagestatus").getAsString()); assertEquals(1, json().get("usagefailedbuckets").getAsInt());
    }
}
