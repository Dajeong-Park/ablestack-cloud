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
package org.apache.cloudstack.storage.object;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.eq;
import static org.mockito.Mockito.isNull;
import static org.mockito.Mockito.any;
import static org.mockito.Mockito.anyLong;
import static org.mockito.Mockito.withSettings;
import static org.mockito.Mockito.CALLS_REAL_METHODS;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.function.Supplier;
import com.cloud.storage.BucketVO;
import com.cloud.storage.dao.BucketDao;
import com.cloud.usage.BucketStatisticsVO;
import com.cloud.usage.dao.BucketStatisticsDao;
import com.cloud.utils.exception.CloudRuntimeException;
import org.apache.cloudstack.engine.subsystem.api.storage.DataStoreManager;
import org.apache.cloudstack.engine.subsystem.api.storage.BucketUsageProvider;
import org.apache.cloudstack.storage.datastore.db.ObjectStoreDao;
import org.apache.cloudstack.storage.datastore.db.ObjectStoreVO;
import org.junit.Test;
import org.springframework.test.util.ReflectionTestUtils;

public class BucketUsageCoordinatorTest {
    private final BucketDao buckets = mock(BucketDao.class);
    private final BucketStatisticsDao statistics = mock(BucketStatisticsDao.class);
    private final ObjectStoreDao stores = mock(ObjectStoreDao.class);
    private final DataStoreManager manager = mock(DataStoreManager.class);
    private final ObjectStoreEntity entity = mock(ObjectStoreEntity.class);
    private final BucketUsageProvider driver = mock(BucketUsageProvider.class, withSettings().extraInterfaces(org.apache.cloudstack.engine.subsystem.api.storage.DataStoreDriver.class));
    private final BucketVO bucket = bucket(1, 4);
    private final BucketVO other = bucket(2, 7);
    private final ObjectStoreVO storePatch = mock(ObjectStoreVO.class);
    private final BucketStatisticsVO stat = new BucketStatisticsVO(11, 1);
    private class Collector extends BucketUsageCoordinator {
        Collector() { super(buckets, statistics, stores, manager); }
        @Override protected <T> T inTransaction(Supplier<T> action) { return action.get(); }
        @Override protected <T> T withStoreLock(long id, Supplier<T> action) { return action.get(); }
    }
    private static BucketVO bucket(long id, long size) {
        BucketVO row = new BucketVO(11, 12, 13, "bucket-" + id, 1, false, false, false, "Private");
        ReflectionTestUtils.setField(row, "id", id); row.setState(Bucket.State.Created); row.setSize(size); return row;
    }
    public BucketUsageCoordinatorTest() {
        ReflectionTestUtils.setField(stat, "id", 1L);
        when(buckets.findById(1L)).thenReturn(bucket);
        when(buckets.createForUpdate(1L)).thenAnswer(a -> new BucketVO());
        when(buckets.update(eq(1L), any())).thenReturn(true);
        when(buckets.listByObjectStoreId(13L)).thenReturn(List.of(bucket, other));
        when(statistics.findBy(11, 1)).thenReturn(stat); when(statistics.update(anyLong(), any())).thenReturn(true);
        when(stores.createForUpdate(13L)).thenReturn(storePatch); when(stores.update(eq(13L), any())).thenReturn(true);
        when(manager.getDataStore(13L, com.cloud.storage.DataStoreRole.Object)).thenReturn(entity);
        when(entity.getDriver()).thenReturn((org.apache.cloudstack.engine.subsystem.api.storage.DataStoreDriver) driver); when(driver.getBucketUsageSource()).thenReturn("Bucket");
    }
    @Test public void successUsesSnapshotSumInsteadOfIncrementingAndDoesNotChangeAllocation() {
        when(driver.getBucketUsage(bucket)).thenReturn(9L);
        try (Collector collector = new Collector()) { collector.collect(bucket); collector.collect(bucket); }
        verify(storePatch, times(2)).setUsedSize(16L); assertEquals(9L, stat.getSize());
        verify(statistics, never()).persist(any()); verifyNoMoreInteractionsExceptUsage();
    }
    private void verifyNoMoreInteractionsExceptUsage() { assertEquals(Integer.valueOf(1), bucket.getQuota()); assertEquals(11L, bucket.getAccountId()); }
    @Test public void failureNeverZeroesBucketStatisticsOrStore() {
        when(driver.getBucketUsage(bucket)).thenThrow(new CloudRuntimeException("SECRET_PROVIDER_DETAIL"));
        try (Collector collector = new Collector()) {
            try { collector.collect(bucket); fail(); } catch (CloudRuntimeException expected) { assertFalse(expected.getMessage().contains("SECRET")); }
        }
        var patch = org.mockito.ArgumentCaptor.forClass(BucketVO.class); verify(buckets).update(eq(1L), patch.capture());
        assertEquals("Error", patch.getValue().getUsageStatus()); assertNull(patch.getValue().getSize());
        assertNull(patch.getValue().getUsageLastUpdated()); assertNotNull(patch.getValue().getUsageLastAttempt());
        verifyNoInteractions(statistics); verify(stores, never()).update(anyLong(), any());
    }
    @Test public void actualEmptySuccessIsAllowedAndOtherLastKnownUsageIsPreserved() {
        when(driver.getBucketUsage(bucket)).thenReturn(0L);
        try (Collector collector = new Collector()) { collector.collect(bucket); }
        verify(storePatch).setUsedSize(7L); assertEquals(0, stat.getSize());
    }
    @Test public void firstCollectionCreatesExactlyOneStatisticsRow() {
        when(driver.getBucketUsage(bucket)).thenReturn(5L); when(statistics.findBy(11, 1)).thenReturn(null);
        when(statistics.persist(any())).thenAnswer(a -> a.getArgument(0));
        try (Collector collector = new Collector()) { collector.collect(bucket); }
        verify(statistics, times(1)).persist(any()); verify(storePatch).setUsedSize(12L);
    }
    @Test public void overlappingRequestsShareOneProviderReadAndCommit() throws Exception {
        CountDownLatch started = new CountDownLatch(1), finish = new CountDownLatch(1);
        when(driver.getBucketUsage(bucket)).thenAnswer(a -> { started.countDown(); assertTrue(finish.await(5, TimeUnit.SECONDS)); return 4L; });
        var pool = (java.util.concurrent.ThreadPoolExecutor) Executors.newFixedThreadPool(2);
        try (Collector collector = new Collector()) {
            var first = pool.submit(() -> collector.collect(bucket)); assertTrue(started.await(5, TimeUnit.SECONDS));
            var second = pool.submit(() -> collector.collect(bucket));
            // Wait until the second request is waiting on the shared future before releasing provider I/O.
            long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(3);
            while (pool.getActiveCount() < 2 && System.nanoTime() < deadline) Thread.yield();
            Thread.sleep(50); finish.countDown(); first.get(5, TimeUnit.SECONDS); second.get(5, TimeUnit.SECONDS);
            verify(driver, times(1)).getBucketUsage(bucket); verify(statistics, times(1)).update(anyLong(), any());
        } finally { finish.countDown(); pool.shutdownNow(); }
    }
    @Test public void removedBucketDoesNotCallProviderOrChangeTelemetry() {
        bucket.setState(Bucket.State.Destroyed);
        try (Collector collector = new Collector()) { try { collector.collect(bucket); fail(); } catch (CloudRuntimeException expected) { } }
        verifyNoInteractions(driver, statistics); verify(buckets, never()).update(anyLong(), any());
    }
    @Test public void negativeProviderResultIsFailure() {
        when(driver.getBucketUsage(bucket)).thenReturn(-1L);
        try (Collector collector = new Collector()) { try { collector.collect(bucket); fail(); } catch (CloudRuntimeException expected) { } }
        verifyNoInteractions(statistics); verify(stores, never()).update(anyLong(), any());
    }
    @Test public void explicitSyncChecksOwnerBeforeJoiningCollection() {
        var accounts = mock(com.cloud.user.AccountManager.class);
        var usage = mock(BucketUsageCoordinator.class);
        var service = new BucketApiServiceImpl() { @Override protected BucketUsageCoordinator usageCoordinator() { return usage; } };
        ReflectionTestUtils.setField(service, "_bucketDao", buckets); ReflectionTestUtils.setField(service, "_accountMgr", accounts);
        var caller = mock(com.cloud.user.Account.class);
        doThrow(new com.cloud.exception.PermissionDeniedException("Forbidden")).when(accounts).checkAccess(eq(caller), isNull(), eq(true), eq(bucket));
        var cmd = mock(org.apache.cloudstack.api.command.user.bucket.SyncBucketUsageCmd.class); when(cmd.getId()).thenReturn(1L);
        try { service.syncBucketUsage(cmd, caller); fail(); } catch (com.cloud.exception.PermissionDeniedException expected) { }
        verifyNoInteractions(usage);
    }
    @Test public void periodicCollectionUsesSamePathAndSkipsAllocatedRows() {
        var usage = mock(BucketUsageCoordinator.class);
        var service = new BucketApiServiceImpl() { @Override protected BucketUsageCoordinator usageCoordinator() { return usage; } };
        ReflectionTestUtils.setField(service, "_bucketDao", buckets); ReflectionTestUtils.setField(service, "_objectStoreDao", stores);
        var store = mock(ObjectStoreVO.class); when(store.getId()).thenReturn(13L); when(stores.listObjectStores()).thenReturn(List.of(store));
        other.setState(Bucket.State.Allocated); service.getBucketUsage();
        verify(usage).collect(bucket); verify(usage, never()).collect(other);
    }
    @Test public void fallbackRequiresExplicitBucketEntry() {
        BucketUsageProvider fallback = mock(BucketUsageProvider.class, CALLS_REAL_METHODS);
        when(fallback.getAllBucketsUsage(13)).thenReturn(java.util.Map.of("other", 1L));
        try { fallback.getBucketUsage(bucket); fail(); } catch (CloudRuntimeException expected) { }
        when(fallback.getAllBucketsUsage(13)).thenReturn(java.util.Map.of(bucket.getName(), 0L));
        assertEquals(0L, fallback.getBucketUsage(bucket)); assertEquals("StoreFallback", fallback.getBucketUsageSource());
    }
}
