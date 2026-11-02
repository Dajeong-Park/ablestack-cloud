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
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.withSettings;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Map;
import java.util.function.Supplier;
import java.util.concurrent.atomic.AtomicLong;
import com.google.gson.Gson;
import com.cloud.configuration.Resource.ResourceType;
import com.cloud.storage.BucketVO;
import com.cloud.storage.dao.BucketDao;
import com.cloud.storage.DataStoreRole;
import com.cloud.user.AccountManager;
import com.cloud.user.AccountVO;
import com.cloud.user.User;
import com.cloud.utils.db.DbUtil;
import com.cloud.exception.InvalidParameterValueException;
import com.cloud.utils.exception.CloudRuntimeException;
import com.cloud.resourcelimit.ResourceLimitManagerImpl;
import org.apache.cloudstack.api.command.user.bucket.CreateBucketCmd;
import org.apache.cloudstack.context.CallContext;
import org.apache.cloudstack.engine.subsystem.api.storage.DataStoreDriver;
import org.apache.cloudstack.engine.subsystem.api.storage.DataStoreManager;
import org.apache.cloudstack.reservation.ReservationVO;
import org.apache.cloudstack.reservation.dao.ReservationDao;
import org.apache.cloudstack.storage.datastore.db.BucketQuotaOperationDao;
import org.apache.cloudstack.storage.datastore.db.BucketQuotaOperationVO;
import org.apache.cloudstack.storage.datastore.db.ObjectStoreDao;
import org.apache.cloudstack.storage.datastore.db.ObjectStoreVO;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.mockito.MockedStatic;
import org.springframework.test.util.ReflectionTestUtils;

public class BucketQuotaCoordinatorTest {
    private static final long G = 1073741824L;
    private final ObjectStoreDao stores = mock(ObjectStoreDao.class);
    private final BucketDao buckets = mock(BucketDao.class);
    private final BucketQuotaOperationDao ops = mock(BucketQuotaOperationDao.class);
    private final DataStoreManager dataStores = mock(DataStoreManager.class);
    private final AccountManager accounts = mock(AccountManager.class);
    private final ResourceLimitManagerImpl limits = mock(ResourceLimitManagerImpl.class);
    private final ReservationDao reservations = mock(ReservationDao.class);
    private final ObjectStoreEntity entity = mock(ObjectStoreEntity.class);
    private final DataStoreDriver driver = mock(DataStoreDriver.class, withSettings().extraInterfaces(ObjectStoreQuotaProvider.class, org.apache.cloudstack.engine.subsystem.api.storage.BucketObjectStoreProvider.class));
    private final ObjectStoreQuotaProvider provider = (ObjectStoreQuotaProvider)driver;
    private final ObjectStoreVO store = mock(ObjectStoreVO.class);
    private final AccountVO owner = mock(AccountVO.class);
    private final Map<Long, BucketQuotaOperationVO> rows = new HashMap<>();
    private final Gson gson = new Gson();
    private BucketVO bucket;
    private BucketQuotaState live;
    private AtomicLong allocated, ledger;
    private BucketQuotaCoordinator service;
    private MockedStatic<DbUtil> locks;

    private BucketQuotaOperationVO copy(BucketQuotaOperationVO op) {
        return op == null ? null : gson.fromJson(gson.toJson(op), BucketQuotaOperationVO.class);
    }
    @Before public void setup() {
        bucket = new BucketVO(7, 1, 3, "qa-quota", 1, false, false, false, "Private");
        ReflectionTestUtils.setField(bucket, "id", 5L); bucket.setState(Bucket.State.Created);
        live = new BucketQuotaState(true, "external-id", true, G, -1, 0, false);
        allocated = new AtomicLong(G); ledger = new AtomicLong(G);
        when(stores.findById(3L)).thenReturn(store); when(store.getId()).thenReturn(3L);
        when(store.getUrl()).thenReturn("http://store"); when(store.getTotalSize()).thenReturn(4 * G);
        when(store.getAllocatedSize()).thenAnswer(i -> allocated.get());
        when(stores.compareAndSetAllocatedSize(eq(3L), anyLong(), anyLong())).thenAnswer(i -> allocated.compareAndSet(i.getArgument(1), i.getArgument(2)));
        when(buckets.findById(5L)).thenAnswer(i -> bucket);
        when(buckets.createForUpdate(5L)).thenAnswer(i -> new BucketVO("projection"));
        when(buckets.update(eq(5L), any(BucketVO.class))).thenAnswer(i -> {
            BucketVO patch = i.getArgument(1);
            if (patch.getQuota() != null) { bucket.setQuota(patch.getQuota()); bucket.setState(patch.getState()); }
            return true;
        });
        when(buckets.persist(any(BucketVO.class))).thenAnswer(i -> {
            bucket = i.getArgument(0); ReflectionTestUtils.setField(bucket, "id", 5L); return bucket;
        });
        when(buckets.remove(5L)).thenAnswer(i -> { bucket = null; return true; });
        when(ops.persist(any())).thenAnswer(i -> {
            BucketQuotaOperationVO op = i.getArgument(0); op.setId(1L); rows.put(1L, copy(op)); return op;
        });
        when(ops.update(anyLong(), any())).thenAnswer(i -> { rows.put(i.getArgument(0), copy(i.getArgument(1))); return true; });
        when(ops.findById(anyLong())).thenAnswer(i -> copy(rows.get(i.getArgument(0))));
        when(ops.findActiveByBucket(anyLong())).thenAnswer(i -> rows.values().stream().filter(BucketQuotaOperationVO::isActive).findFirst().map(this::copy).orElse(null));
        when(ops.listActive()).thenAnswer(i -> new ArrayList<>(rows.values()));
        when(ops.reservedBytesForStore(3L)).thenAnswer(i -> rows.values().stream().filter(BucketQuotaOperationVO::isActive).mapToLong(BucketQuotaOperationVO::getReservedBytes).sum());
        when(dataStores.getDataStore(3L, DataStoreRole.Object)).thenReturn(entity); when(entity.getDriver()).thenReturn(driver);
        when(provider.readBucketQuota(any())).thenAnswer(i -> live);
        var emptyPage = new org.apache.cloudstack.api.response.BucketObjectResponse(); emptyPage.setVersions(new ArrayList<>());
        when(((org.apache.cloudstack.engine.subsystem.api.storage.BucketObjectStoreProvider)driver).objectVersions(any(), any(), any(), anyInt())).thenReturn(emptyPage);
        when(ops.findByUuid(anyString())).thenAnswer(i -> rows.values().stream().filter(x -> x.getUuid().equals(i.getArgument(0))).findFirst().map(this::copy).orElse(null));
        doAnswer(i -> { live = i.getArgument(1); return null; }).when(provider).writeBucketQuota(any(), any());
        doAnswer(i -> { live = BucketQuotaState.missing(); return null; }).when(provider).deleteEmptyBucket(any());
        when(entity.protectionCapabilities()).thenReturn(Map.of("encryption", "Supported", "versioning", "Supported", "objectlocking", "Supported"));
        when(entity.readBucketProtection(any())).thenAnswer(i -> {
            var r = new org.apache.cloudstack.api.response.BucketProtectionResponse();
            r.setEncryption(bucket.isEncryption()); r.setVersioning(bucket.isVersioning()); r.setObjectLock(bucket.isObjectLock());
            r.setAlgorithm(bucket.isEncryption() ? "AES256" : "None"); r.setVersioningStatus(bucket.isVersioning() ? "Enabled" : "Off"); return r;
        });
        when(entity.createUser(7L)).thenReturn(true);
        when(entity.createBucket(any(), anyBoolean())).thenAnswer(i -> { live = new BucketQuotaState(true, "new-id", false, -1, -1, 0, false); return bucket; });
        when(entity.deleteBucket(any())).thenAnswer(i -> { live = BucketQuotaState.missing(); return true; });
        when(accounts.getActiveAccountById(7L)).thenReturn(owner); when(owner.getId()).thenReturn(7L);
        when(owner.getAccountId()).thenReturn(7L); when(owner.getDomainId()).thenReturn(1L);
        when(reservations.persist(any())).thenAnswer(i -> {
            ReservationVO row = i.getArgument(0); ReflectionTestUtils.setField(row, "id", 4L); return row;
        });
        doAnswer(i -> { ledger.addAndGet(i.getArgument(2)); return null; }).when(limits).incrementResourceCount(eq(7L), eq(ResourceType.object_storage), anyLong());
        doAnswer(i -> { ledger.addAndGet(-((Long)i.getArgument(2))); return null; }).when(limits).decrementBucketResourceCount(eq(7L), eq(ResourceType.object_storage), anyLong());
        locks = mockStatic(DbUtil.class);
        locks.when(() -> DbUtil.getGlobalLock(anyString(), anyInt())).thenReturn(true);
        locks.when(() -> DbUtil.releaseGlobalLock(anyString())).thenReturn(true);
        CallContext.register(mock(User.class), owner);
        service = new BucketQuotaCoordinator(stores, buckets, ops, dataStores, accounts, limits, reservations) {
            @Override protected <T> T inTransaction(Supplier<T> action) {
                long oldAllocated = allocated.get(), oldLedger = ledger.get();
                Integer oldQuota = bucket == null ? null : bucket.getQuota();
                Map<Long, BucketQuotaOperationVO> saved = new HashMap<>(); rows.forEach((id, op) -> saved.put(id, copy(op)));
                try { return action.get(); }
                catch (RuntimeException failure) {
                    allocated.set(oldAllocated); ledger.set(oldLedger);
                    if (bucket != null) bucket.setQuota(oldQuota);
                    rows.clear(); rows.putAll(saved); throw failure;
                }
            }
        };
    }
    @After public void close() { locks.close(); CallContext.unregister(); }
    private BucketQuotaOperationVO last() { return rows.get(1L); }
    private void failed(Runnable action, String state) {
        try { action.run(); fail("operation should fail"); } catch (BucketQuotaException expected) { assertFalse(expected.getMessage().contains("PRIVATE")); }
        assertEquals(state, last().getState());
    }
    @Test public void zeroRejected() { try { BucketQuotaCoordinator.quotaBytes(0); fail(); } catch (InvalidParameterValueException expected) { } }
    @Test public void negativeRejected() { try { BucketQuotaCoordinator.quotaBytes(-1); fail(); } catch (InvalidParameterValueException expected) { } }
    @Test public void nullRejected() { try { BucketQuotaCoordinator.quotaBytes(null); fail(); } catch (InvalidParameterValueException expected) { } }
    @Test public void maximumIsExactLongBytes() { assertEquals(2305843008139952128L, BucketQuotaCoordinator.quotaBytes(Integer.MAX_VALUE)); }
    @Test public void positiveUpdateCommitsHoldExactlyOnce() throws Exception {
        assertTrue(service.update(bucket, 2)); assertEquals(2 * G, allocated.get()); assertEquals(2 * G, ledger.get());
        assertEquals(0, last().getReservedBytes()); assertEquals(0, last().getAccountHoldBytes());
        service.recover(); assertEquals(2 * G, ledger.get());
    }
    @Test public void shrinkReleasesCommittedCapacity() throws Exception {
        bucket.setQuota(2); allocated.set(2 * G); ledger.set(2 * G); live = live.withLimitGiB(2);
        assertTrue(service.update(bucket, 1)); assertEquals(G, allocated.get()); assertEquals(G, ledger.get());
    }
    @Test public void liveUsageRejectsShrinkBeforeWrite() throws Exception {
        bucket.setQuota(2); live = new BucketQuotaState(true, "external-id", true, 2 * G, -1, G + 1, false);
        try { service.update(bucket, 1); fail(); } catch (InvalidParameterValueException expected) { }
        verify(provider, never()).writeBucketQuota(any(), any()); assertTrue(rows.isEmpty());
    }
    @Test public void storeCapacityRejectsIncreaseBeforeWrite() throws Exception {
        try { service.update(bucket, 5); fail(); } catch (InvalidParameterValueException expected) { }
        verify(provider, never()).writeBucketQuota(any(), any()); assertEquals(G, ledger.get());
    }
    @Test public void accountLimitRejectsBeforeProviderWrite() throws Exception {
        doThrow(new com.cloud.exception.ResourceAllocationException("limit", ResourceType.object_storage)).when(limits)
            .checkResourceLimitWithTag(owner, 1L, true, ResourceType.object_storage, null, G);
        try { service.update(bucket, 2); fail(); } catch (com.cloud.exception.ResourceAllocationException expected) { }
        verifyNoInteractions(provider); assertTrue(rows.isEmpty());
    }
    @Test public void externalQuotaMismatchDoesNotOverwriteAdministratorChange() throws Exception {
        live = live.withLimitGiB(3);
        try { service.update(bucket, 2); fail(); } catch (InvalidParameterValueException expected) { }
        verify(provider, never()).writeBucketQuota(any(), any());
    }
    @Test public void providerFailureRollsBackHeldCapacity() throws Exception {
        doThrow(new CloudRuntimeException("PRIVATE")).when(provider).writeBucketQuota(any(), any());
        failed(() -> { try { service.update(bucket, 2); } catch (com.cloud.exception.ResourceAllocationException e) { throw new RuntimeException(e); } }, "Failed");
        assertEquals(G, ledger.get()); assertEquals(G, allocated.get()); assertEquals(G, live.getMaxSizeBytes());
    }
    @Test public void dbFailureAfterProviderSuccessRestoresExactPreviousQuota() throws Exception {
        live = new BucketQuotaState(true, "external-id", true, G, 17, 0, true);
        when(stores.compareAndSetAllocatedSize(anyLong(), anyLong(), anyLong())).thenReturn(false);
        failed(() -> { try { service.update(bucket, 2); } catch (com.cloud.exception.ResourceAllocationException e) { throw new RuntimeException(e); } }, "Failed");
        assertEquals(G, live.getMaxSizeBytes()); assertEquals(17, live.getMaxObjects()); assertTrue(live.isCheckOnRaw());
        assertEquals(G, ledger.get()); assertEquals(Integer.valueOf(1), bucket.getQuota());
    }
    @Test public void rollbackFailureKeepsReservationAndExplicitRetryFinishesOnce() throws Exception {
        when(stores.compareAndSetAllocatedSize(anyLong(), anyLong(), anyLong())).thenReturn(false);
        doAnswer(i -> { BucketQuotaState target = i.getArgument(1); if (target.getMaxSizeBytes() == G) throw new CloudRuntimeException("PRIVATE"); live = target; return null; })
            .when(provider).writeBucketQuota(any(), any());
        failed(() -> { try { service.update(bucket, 2); } catch (com.cloud.exception.ResourceAllocationException e) { throw new RuntimeException(e); } }, "NeedsReconcile");
        assertEquals(G, last().getReservedBytes()); assertEquals(2 * G, ledger.get());
        when(stores.compareAndSetAllocatedSize(eq(3L), anyLong(), anyLong())).thenAnswer(i -> allocated.compareAndSet(i.getArgument(1), i.getArgument(2)));
        assertTrue(service.reconcile(bucket, last().getUuid())); assertEquals(2 * G, allocated.get()); assertEquals(2 * G, ledger.get());
        service.recover(); assertEquals(2 * G, ledger.get());
    }
    @Test public void secondOperationIsBlockedWhileRecoveryPending() throws Exception {
        BucketQuotaOperationVO op = new BucketQuotaOperationVO(); op.setBucketId(5L); op.setActiveBucketId(5L); op.setState("NeedsReconcile"); rows.put(1L, op);
        try { service.update(bucket, 2); fail(); } catch (BucketQuotaException expected) { }
        verify(provider, never()).writeBucketQuota(any(), any());
    }
    @Test public void staleRecoveryOperationIdIsRejected() {
        try { service.reconcile(bucket, "old-id"); fail(); } catch (InvalidParameterValueException expected) { }
        verifyNoInteractions(provider);
    }
    @Test public void deleteCommitsCounterAndAllocationOnlyOnce() {
        assertTrue(service.delete(bucket)); assertNull(bucket); assertEquals(0, ledger.get()); assertEquals(0, allocated.get());
        service.recover(); assertEquals(0, ledger.get());
    }
    @Test public void createReservesBeforeExternalUserOrBucketCreation() throws Exception {
        live = BucketQuotaState.missing(); allocated.set(0); ledger.set(0);
        CreateBucketCmd cmd = mock(CreateBucketCmd.class);
        when(cmd.getEntityOwnerId()).thenReturn(7L); when(cmd.getObjectStoragePoolId()).thenReturn(3L);
        when(cmd.getBucketName()).thenReturn("new-bucket"); when(cmd.getQuota()).thenReturn(2);
        BucketVO result = service.allocate(cmd); assertEquals(2 * G, last().getReservedBytes());
        verify(entity, never()).createUser(anyLong()); verify(entity, never()).createBucket(any(), anyBoolean());
        service.create(result.getId()); assertEquals(2 * G, allocated.get()); assertEquals(2 * G, ledger.get()); assertEquals("Succeeded", last().getState());
    }
    private org.apache.cloudstack.engine.subsystem.api.storage.BucketObjectStoreProvider objectProvider() {
        return (org.apache.cloudstack.engine.subsystem.api.storage.BucketObjectStoreProvider)driver;
    }
    private org.apache.cloudstack.api.response.BucketObjectResponse batch(long deleted, boolean complete) {
        var result = new org.apache.cloudstack.api.response.BucketObjectResponse(); result.setDeletedCount(deleted); result.setComplete(complete); result.setProgressKnown(true); return result;
    }
    private String preparePurge() {
        var impact = new org.apache.cloudstack.api.response.BucketObjectResponse(); impact.setComplete(true); impact.setExists(true);
        when(objectProvider().deletionImpact(any())).thenReturn(impact);
        String id = java.util.UUID.randomUUID().toString();
        assertEquals("Prepared", service.startPurge(bucket, id, bucket.getName(), true, "external-id", false).getState()); return id;
    }
    @Test public void normalDeleteRejectsAnyVersionBeforeCreatingAnOperation() {
        var page = new org.apache.cloudstack.api.response.BucketObjectResponse(); page.setVersions(java.util.List.of(new org.apache.cloudstack.api.response.BucketObjectVersion()));
        when(objectProvider().objectVersions(any(), any(), any(), anyInt())).thenReturn(page);
        org.junit.Assert.assertThrows(InvalidParameterValueException.class, () -> service.delete(bucket));
        assertTrue(rows.isEmpty()); assertEquals(G, allocated.get()); verify(entity, never()).deleteBucket(any());
    }
    @Test public void normalDeleteNeverFallsBackWhenUploadRaces() {
        doThrow(new CloudRuntimeException("BUCKET_NOT_EMPTY")).when(provider).deleteEmptyBucket(any());
        failed(() -> service.delete(bucket), "Failed"); assertTrue(live.exists()); assertEquals(G, allocated.get());
        verify(objectProvider(), never()).purgeVersionBatch(any()); verify(entity, never()).deleteBucket(any());
    }
    @Test public void purgeRequiresExactNameAndExplicitVersionConsent() {
        String id = java.util.UUID.randomUUID().toString();
        org.junit.Assert.assertThrows(InvalidParameterValueException.class, () -> service.startPurge(bucket, id, "wrong", true, "external-id", false));
        org.junit.Assert.assertThrows(InvalidParameterValueException.class, () -> service.startPurge(bucket, id, bucket.getName(), false, "external-id", false));
        assertTrue(rows.isEmpty()); verify(objectProvider(), never()).purgeVersionBatch(any());
    }
    @Test public void purgeRejectsStaleExternalIdentityAndIncompleteOrLockedImpact() {
        var impact = new org.apache.cloudstack.api.response.BucketObjectResponse(); impact.setComplete(true);
        when(objectProvider().deletionImpact(any())).thenReturn(impact);
        org.junit.Assert.assertThrows(InvalidParameterValueException.class, () -> service.startPurge(bucket, java.util.UUID.randomUUID().toString(), bucket.getName(), true, "other", false));
        impact.setComplete(false);
        org.junit.Assert.assertThrows(InvalidParameterValueException.class, () -> service.startPurge(bucket, java.util.UUID.randomUUID().toString(), bucket.getName(), true, "external-id", false));
        impact.setComplete(true); impact.setObjectLock(true);
        org.junit.Assert.assertThrows(InvalidParameterValueException.class, () -> service.startPurge(bucket, java.util.UUID.randomUUID().toString(), bucket.getName(), true, "external-id", false));
        assertTrue(rows.isEmpty());
    }
    @Test public void purgeIsDurableAsynchronousAndDuplicateIntentDoesNotCreateAnotherJob() {
        String id = preparePurge(); assertEquals(1, rows.size()); verify(objectProvider(), never()).purgeVersionBatch(any());
        assertEquals(id, service.startPurge(bucket, id, bucket.getName(), true, "external-id", false).getOperationId()); assertEquals(1, rows.size());
        org.junit.Assert.assertThrows(BucketQuotaException.class, () -> service.delete(bucket));
        org.junit.Assert.assertThrows(InvalidParameterValueException.class, () -> service.reconcile(bucket, id));
    }
    @Test public void purgeMultipleBatchesRetainCountersUntilAtomicFinalRemovalAndReplayIsHarmless() {
        String id = preparePurge(); BucketVO target = bucket;
        when(objectProvider().purgeVersionBatch(any())).thenReturn(batch(1000, false), batch(105, false), batch(0, true));
        service.recover(); assertEquals(1000, service.purgeStatus(bucket, id).getDeletedCount()); assertEquals(G, allocated.get()); assertTrue(bucket != null);
        service.recover(); assertEquals(1105, service.purgeStatus(bucket, id).getDeletedCount()); assertEquals(G, ledger.get());
        service.recover(); assertNull(bucket); assertEquals(0, allocated.get()); assertEquals(0, ledger.get());
        assertEquals("Succeeded", service.purgeStatus(target, id).getState());
        assertEquals("Succeeded", service.startPurge(target, id, target.getName(), true, null, false).getState());
        service.recover(); assertEquals(0, ledger.get()); verify(entity, never()).deleteBucket(any());
    }
    @Test public void partialPurgePersistsProgressAndRequiresExplicitSameJobRetry() {
        String id = preparePurge();
        var partial = batch(7, false); partial.setErrorCode("PARTIAL_DELETE");
        when(objectProvider().purgeVersionBatch(any())).thenReturn(partial, batch(0, true));
        service.recover(); assertEquals("NeedsReconcile", last().getState()); assertEquals(7, service.purgeStatus(bucket, id).getDeletedCount()); assertEquals(G, ledger.get());
        service.recover(); verify(objectProvider(), org.mockito.Mockito.times(1)).purgeVersionBatch(any());
        service.startPurge(bucket, id, bucket.getName(), true, null, true); service.recover();
        assertEquals("Succeeded", last().getState()); assertEquals(0, ledger.get());
    }
    @Test public void lostBatchResponseNeverReleasesMetadataAndMarksProgressAsUncertain() {
        String id = preparePurge();
        when(objectProvider().purgeVersionBatch(any())).thenThrow(new CloudRuntimeException("PRIVATE_S3_RESPONSE"));
        service.recover(); assertEquals("NeedsReconcile", last().getState()); assertFalse(service.purgeStatus(bucket, id).getProgressKnown());
        assertEquals("PURGE_RETRY_REQUIRED", last().getErrorCode()); assertEquals(G, allocated.get()); assertTrue(bucket != null);
    }
    @Test public void restartDuringApplyingUsesDurableCheckpointAndOnlyRemainingVersions() {
        String id = preparePurge(); last().setState("Applying");
        when(objectProvider().purgeVersionBatch(any())).thenReturn(batch(3, false), batch(0, true));
        var restarted = new BucketQuotaCoordinator(stores, buckets, ops, dataStores, accounts, limits, reservations) {
            @Override protected <T> T inTransaction(Supplier<T> action) { return action.get(); }
        };
        restarted.recover(); assertEquals(3, restarted.purgeStatus(bucket, id).getDeletedCount()); assertFalse(restarted.purgeStatus(bucket, id).getProgressKnown());
        restarted.recover(); assertEquals("Succeeded", last().getState()); assertEquals(0, allocated.get());
    }
    @Test public void purgeDbFailureAfterExternalDeletionRetainsLedgerAndRetryCommitsOnce() {
        String id = preparePurge(); when(objectProvider().purgeVersionBatch(any())).thenReturn(batch(0, true));
        doThrow(new CloudRuntimeException("db failure")).when(limits).decrementBucketResourceCount(eq(7L), eq(ResourceType.bucket), eq(1L));
        service.recover(); assertEquals("NeedsReconcile", last().getState()); assertFalse(live.exists()); assertTrue(bucket != null); assertEquals(G, allocated.get());
        org.mockito.Mockito.doNothing().when(limits).decrementBucketResourceCount(eq(7L), eq(ResourceType.bucket), eq(1L));
        service.startPurge(bucket, id, bucket.getName(), true, null, true); service.recover();
        assertNull(bucket); assertEquals("Succeeded", last().getState()); assertEquals(0, allocated.get()); assertEquals(0, ledger.get());
    }
    @Test public void foreignOperationIdCannotBeRetriedForAnotherBucket() {
        String id = preparePurge();
        BucketVO foreign = new BucketVO(7, 1, 3, "other", 1, false, false, false, "Private"); ReflectionTestUtils.setField(foreign, "id", 99L);
        org.junit.Assert.assertThrows(InvalidParameterValueException.class, () -> service.startPurge(foreign, id, "other", true, null, true));
        org.junit.Assert.assertThrows(InvalidParameterValueException.class, () -> service.purgeStatus(foreign, id));
    }

}
