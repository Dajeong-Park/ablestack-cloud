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
import static org.junit.Assert.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.withSettings;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.eq;
import java.util.Map;
import java.util.HashMap;
import java.util.ArrayList;
import java.util.Date;
import java.util.function.Supplier;
import com.google.gson.Gson;
import com.cloud.storage.BucketVO;
import com.cloud.storage.dao.BucketDao;
import com.cloud.storage.DataStoreRole;
import com.cloud.utils.db.DbUtil;
import com.cloud.utils.exception.CloudRuntimeException;
import org.apache.cloudstack.api.response.BucketProtectionResponse;
import org.apache.cloudstack.engine.subsystem.api.storage.DataStoreManager;
import org.apache.cloudstack.engine.subsystem.api.storage.DataStoreDriver;
import org.apache.cloudstack.storage.datastore.db.BucketQuotaOperationDao;
import org.apache.cloudstack.storage.datastore.db.BucketQuotaOperationVO;
import org.apache.cloudstack.storage.datastore.db.ObjectStoreDao;
import org.apache.cloudstack.storage.datastore.db.ObjectStoreVO;
import org.junit.Before;
import org.junit.After;
import org.junit.Test;
import org.mockito.MockedStatic;
import org.springframework.test.util.ReflectionTestUtils;

public class BucketProtectionCoordinatorTest {
    final BucketDao buckets = mock(BucketDao.class);
    final ObjectStoreDao stores = mock(ObjectStoreDao.class);
    final BucketQuotaOperationDao ops = mock(BucketQuotaOperationDao.class);
    final DataStoreManager data = mock(DataStoreManager.class);
    final ObjectStoreEntity entity = mock(ObjectStoreEntity.class);
    final DataStoreDriver driver = mock(DataStoreDriver.class, withSettings().extraInterfaces(ObjectStoreQuotaProvider.class));
    final ObjectStoreVO store = mock(ObjectStoreVO.class);
    final Gson gson = new Gson();
    BucketVO bucket;
    BucketProtectionResponse live;
    Map<Long, BucketQuotaOperationVO> rows = new HashMap<>();
    BucketProtectionCoordinator service;
    MockedStatic<DbUtil> locks;
    String external = "original";
    boolean readFailure;
    boolean metadataFailure;
    boolean restoreFailure;
    int writes;
    private <T> T copy(T value, Class<T> type) { return value == null ? null : gson.fromJson(gson.toJson(value), type); }
    private BucketProtectionResponse config(boolean enc, String version, boolean lock) {
        var r = new BucketProtectionResponse(); r.setEncryption(enc); r.setAlgorithm(enc ? "AES256" : "None");
        r.setVersioning("Enabled".equals(version)); r.setVersioningStatus(version); r.setObjectLock(lock); r.setCheckedAt(new Date()); r.setVerifiedAt(r.getCheckedAt()); return r;
    }
    @Before public void setup() {
        bucket = new BucketVO(7, 1, 3, "qa-protection", 1, false, false, false, "Private");
        ReflectionTestUtils.setField(bucket, "id", 5L); bucket.setState(Bucket.State.Created); live = config(false, "Off", false);
        when(buckets.findById(5L)).thenAnswer(i -> copy(bucket, BucketVO.class));
        when(buckets.createForUpdate(5L)).thenAnswer(i -> copy(bucket, BucketVO.class));
        when(buckets.update(eq(5L), any())).thenAnswer(i -> {
            BucketVO update = i.getArgument(1);
            if (metadataFailure && update.isVersioning()) { metadataFailure = false; throw new CloudRuntimeException("DB_FAIL_PRIVATE"); }
            bucket = copy(update, BucketVO.class); return true;
        });
        when(stores.findById(3L)).thenReturn(store); when(store.getUrl()).thenReturn("http://test");
        when(data.getDataStore(3L, DataStoreRole.Object)).thenReturn(entity); when(entity.getDriver()).thenReturn(driver);
        when(((ObjectStoreQuotaProvider)driver).readBucketQuota(any())).thenAnswer(i -> new BucketQuotaState(true, external, true, 1073741824L, -1, 0, false));
        when(entity.protectionCapabilities()).thenReturn(Map.of("encryption", "Supported", "versioning", "Supported", "objectlocking", "Supported"));
        when(entity.readBucketProtection(any())).thenAnswer(i -> { if (readFailure) throw new CloudRuntimeException("PRIVATE_READ_FAILURE"); return copy(live, BucketProtectionResponse.class); });
        when(entity.setBucketEncryption(any())).thenAnswer(i -> { writes++; live.setEncryption(true); live.setAlgorithm("AES256"); return true; });
        when(entity.deleteBucketEncryption(any())).thenAnswer(i -> { writes++; if (restoreFailure) throw new CloudRuntimeException("PRIVATE_RESTORE_FAILURE"); live.setEncryption(false); live.setAlgorithm("None"); return true; });
        when(entity.setBucketVersioning(any())).thenAnswer(i -> { writes++; live.setVersioning(true); live.setVersioningStatus("Enabled"); return true; });
        when(entity.deleteBucketVersioning(any())).thenAnswer(i -> { writes++; if (restoreFailure) throw new CloudRuntimeException("PRIVATE_RESTORE_FAILURE"); live.setVersioning(false); live.setVersioningStatus("Suspended"); return true; });
        when(ops.persist(any())).thenAnswer(i -> { BucketQuotaOperationVO op = i.getArgument(0); op.setId(1L); rows.put(1L, copy(op, BucketQuotaOperationVO.class)); return op; });
        when(ops.update(anyLong(), any())).thenAnswer(i -> { rows.put(i.getArgument(0), copy(i.getArgument(1), BucketQuotaOperationVO.class)); return true; });
        when(ops.findById(anyLong())).thenAnswer(i -> copy(rows.get(i.getArgument(0)), BucketQuotaOperationVO.class));
        when(ops.findActiveByBucket(anyLong())).thenAnswer(i -> rows.values().stream().filter(BucketQuotaOperationVO::isActive).findFirst().map(x -> copy(x, BucketQuotaOperationVO.class)).orElse(null));
        when(ops.findLatestByBucket(anyLong())).thenAnswer(i -> copy(rows.get(1L), BucketQuotaOperationVO.class));
        when(ops.findByUuid(anyString())).thenAnswer(i -> rows.values().stream().filter(x -> x.getUuid().equals(i.getArgument(0))).findFirst().map(x -> copy(x, BucketQuotaOperationVO.class)).orElse(null));
        when(ops.listActive()).thenAnswer(i -> new ArrayList<>(rows.values()));
        locks = mockStatic(DbUtil.class); locks.when(() -> DbUtil.getGlobalLock(anyString(), anyInt())).thenReturn(true); locks.when(() -> DbUtil.releaseGlobalLock(anyString())).thenReturn(true);
        service = new BucketProtectionCoordinator(buckets, stores, ops, data, null) {
            @Override protected <T> T transaction(Supplier<T> action) {
                BucketVO previous = copy(bucket, BucketVO.class); var old = copy(rows.get(1L), BucketQuotaOperationVO.class);
                try { return action.get(); } catch (RuntimeException failure) { bucket = previous; if (old != null) rows.put(1L, old); throw failure; }
            }
        };
    }
    @After public void close() { locks.close(); }
    @Test public void unknownReadsNeverPublishDisabledOrOverwriteRequestedValues() {
        bucket.setEncryption(true); readFailure = true;
        var result = service.get(bucket); assertEquals("Unknown", result.getVerificationState()); assertNull(result.getEncryption()); assertTrue(bucket.isEncryption()); assertFalse(bucket.getProtectionSnapshot().contains("PRIVATE"));
    }
    @Test public void legacyMismatchIsDisplayedWithoutSilentlyChangingCloudOrProvider() {
        bucket.setEncryption(true); var state = service.get(bucket); assertEquals("Mismatch", state.getVerificationState()); assertFalse(state.getEncryption()); assertTrue(state.getRequestedEncryption()); assertTrue(bucket.isEncryption()); assertEquals(0, writes);
    }
    @Test public void explicitAdoptionChangesMetadataOnlyAndCannotAdoptUnknown() {
        bucket.setEncryption(true); service.reconcile(bucket, null, true); assertFalse(bucket.isEncryption()); assertEquals(0, writes);
        readFailure = true; assertThrows(RuntimeException.class, () -> service.reconcile(bucket, null, true));
    }
    @Test public void objectLockRequiresVersioningBeforeCreation() {
        assertThrows(RuntimeException.class, () -> BucketProtectionCoordinator.validateCreate(entity, false, false, true)); verify(entity, never()).createBucket(any(), anyBoolean());
    }
    @Test public void unsupportedEncryptionFailsBeforeCreatingAnOperation() {
        when(entity.protectionCapabilities()).thenReturn(Map.of("encryption", "Unsupported", "encryptionreason", "ENCRYPTION_REQUIRES_HTTPS"));
        assertThrows(RuntimeException.class, () -> service.update(bucket, true, null)); assertTrue(rows.isEmpty()); assertEquals(0, writes);
    }
    @Test public void lockingCannotBeBypassedBySuspendingVersioning() {
        bucket.setObjectLock(true); bucket.setVersioning(true); live = config(false, "Enabled", true);
        assertThrows(RuntimeException.class, () -> service.update(bucket, null, false)); assertTrue(rows.isEmpty()); assertEquals(0, writes);
    }
    @Test public void successfulVerifiedChangeCommitsOneDurableOperationWithoutTouchingQuotaOrPolicy() {
        assertTrue(service.update(bucket, null, true)); assertTrue(bucket.isVersioning()); assertEquals(Integer.valueOf(1), bucket.getQuota()); assertEquals("Private", bucket.getPolicy()); assertEquals("Succeeded", rows.get(1L).getState()); assertEquals(0, rows.get(1L).getReservedBytes()); assertEquals(1, writes);
        assertTrue(service.update(bucket, null, true)); assertEquals(1, rows.size()); assertEquals(1, writes);
    }
    @Test public void falseProviderReturnIsNotSavedAsSuccess() {
        doReturn(false).when(entity).setBucketVersioning(any()); assertThrows(RuntimeException.class, () -> service.update(bucket, null, true)); assertFalse(bucket.isVersioning()); assertEquals("Failed", rows.get(1L).getState());
    }
    @Test public void successfulReturnWithoutActualApplicationIsNotSavedAsSuccess() {
        doReturn(true).when(entity).setBucketVersioning(any()); assertThrows(RuntimeException.class, () -> service.update(bucket, null, true)); assertFalse(bucket.isVersioning()); assertEquals("Failed", rows.get(1L).getState());
    }
    @Test public void exactRestorationAfterDbFailureIsVerified() {
        live = config(false, "Suspended", false); metadataFailure = true;
        var error = assertThrows(RuntimeException.class, () -> service.update(bucket, null, true)); assertFalse(error.getMessage().contains("PRIVATE")); assertFalse(bucket.isVersioning()); assertEquals("Suspended", live.getVersioningStatus()); assertEquals("Failed", rows.get(1L).getState());
    }
    @Test public void irreversibleOffToSuspendedIsNotReportedAsExactRollback() {
        metadataFailure = true; assertThrows(RuntimeException.class, () -> service.update(bucket, null, true)); assertEquals("Suspended", live.getVersioningStatus()); assertEquals("NeedsReconcile", rows.get(1L).getState()); assertFalse(bucket.isVersioning());
        String id = rows.get(1L).getUuid(); service.reconcile(bucket, id, true); assertEquals("Failed", rows.get(1L).getState()); assertFalse(bucket.isVersioning()); assertEquals("Verified", service.get(bucket).getVerificationState());
    }
    @Test public void failedRestorationBlocksFurtherChangesAndRequiresTheOriginalOperationId() {
        live = config(false, "Suspended", false); metadataFailure = true; restoreFailure = true;
        assertThrows(RuntimeException.class, () -> service.update(bucket, null, true)); String id = rows.get(1L).getUuid();
        assertEquals("NeedsReconcile", rows.get(1L).getState()); assertThrows(RuntimeException.class, () -> service.update(bucket, null, true));
        assertThrows(RuntimeException.class, () -> service.reconcile(bucket, "wrong", true)); restoreFailure = false;
        service.reconcile(bucket, id, false); assertFalse(bucket.isVersioning()); assertEquals("Failed", rows.get(1L).getState());
        int count = writes; service.reconcile(bucket, id, false); assertEquals(count, writes); assertEquals(1, rows.size());
    }
    @Test public void changedExternalBucketIdentityIsNeverMutatedOnRecovery() {
        live = config(false, "Suspended", false); metadataFailure = true; restoreFailure = true; assertThrows(RuntimeException.class, () -> service.update(bucket, null, true));
        external = "replacement"; int count = writes; assertThrows(RuntimeException.class, () -> service.reconcile(bucket, rows.get(1L).getUuid(), false)); assertEquals(count, writes);
    }
    @Test public void restartLeavesInterruptedChangesForExplicitRecoveryWithoutProviderWrites() {
        live = config(false, "Suspended", false); metadataFailure = true; restoreFailure = true; assertThrows(RuntimeException.class, () -> service.update(bucket, null, true));
        rows.get(1L).setState("Applying"); int count = writes; service.recoverInterrupted(); assertEquals("NeedsReconcile", rows.get(1L).getState()); assertEquals(count, writes);
    }
    @Test public void creationVerifiesActualObjectLockRatherThanTrustingRequestedTrue() {
        bucket.setObjectLock(true); bucket.setVersioning(true); assertThrows(RuntimeException.class, () -> BucketProtectionCoordinator.initialize(entity, bucket));
    }
    @Test public void freshPersistedOperationIsReloadedBeforeGenericDaoUpdates() {
        var plain = new java.util.concurrent.atomic.AtomicReference<BucketQuotaOperationVO>();
        org.mockito.Mockito.doAnswer(i -> {
            BucketQuotaOperationVO created = i.getArgument(0); created.setId(1L); plain.set(created);
            rows.put(1L, copy(created, BucketQuotaOperationVO.class)); return created;
        }).when(ops).persist(any());
        org.mockito.Mockito.doAnswer(i -> {
            if (i.getArgument(1) == plain.get()) throw new ClassCastException("Plain entities are not DAO enhanced");
            rows.put(i.getArgument(0), copy(i.getArgument(1), BucketQuotaOperationVO.class)); return true;
        }).when(ops).update(anyLong(), any());
        assertTrue(service.update(bucket, null, true)); assertTrue(bucket.isVersioning()); assertEquals("Succeeded", rows.get(1L).getState());
    }
    @Test public void creationCannotConfirmAFalseVersioningWrite() {
        bucket.setVersioning(true); doReturn(false).when(entity).setBucketVersioning(any());
        assertThrows(RuntimeException.class, () -> BucketProtectionCoordinator.initialize(entity, bucket));
    }
}
