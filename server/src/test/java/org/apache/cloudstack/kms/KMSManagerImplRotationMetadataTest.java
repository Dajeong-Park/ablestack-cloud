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

package org.apache.cloudstack.kms;

import com.cloud.api.ApiDBUtils;
import com.cloud.api.ApiResponseHelper;
import com.cloud.event.ActionEventUtils;
import com.cloud.exception.InvalidParameterValueException;
import com.cloud.exception.PermissionDeniedException;
import com.cloud.user.Account;
import com.cloud.user.AccountManager;
import com.cloud.user.User;
import com.cloud.utils.db.GlobalLock;
import com.cloud.utils.db.Transaction;
import com.cloud.utils.db.TransactionCallbackWithException;
import org.apache.cloudstack.api.command.user.kms.RotateKMSKeyCmd;
import org.apache.cloudstack.context.CallContext;
import org.apache.cloudstack.framework.kms.KMSException;
import org.apache.cloudstack.framework.kms.KMSProvider;
import org.apache.cloudstack.framework.kms.KeyPurpose;
import org.apache.cloudstack.kms.dao.HSMProfileDao;
import org.apache.cloudstack.kms.dao.KMSKekVersionDao;
import org.apache.cloudstack.kms.dao.KMSKeyDao;
import org.apache.cloudstack.kms.dao.KMSWrappedKeyDao;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.mockito.MockedStatic;
import org.mockito.Mockito;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertThrows;
import static org.junit.Assert.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

public class KMSManagerImplRotationMetadataTest {
    private KMSManagerImpl manager;
    private KMSKeyDao keys;
    private KMSKekVersionDao versions;
    private HSMProfileDao profiles;
    private KMSProvider provider;
    private KMSKeyVO key;
    private HSMProfileVO profile;
    private KMSKekVersionVO original;
    private Account caller;
    private GlobalLock lock;
    private final List<KMSKekVersionVO> storedVersions = new ArrayList<>();
    private final AtomicBoolean inTransaction = new AtomicBoolean();
    private ExecutorService executor;
    private MockedStatic<Transaction> transactions;
    private MockedStatic<GlobalLock> locks;
    private MockedStatic<ActionEventUtils> events;

    @Before
    public void setUp() {
        manager = Mockito.spy(new KMSManagerImpl());
        keys = mock(KMSKeyDao.class);
        versions = mock(KMSKekVersionDao.class);
        profiles = mock(HSMProfileDao.class);
        provider = mock(KMSProvider.class);
        caller = mock(Account.class);
        when(caller.getId()).thenReturn(2L);
        when(caller.getDomainId()).thenReturn(1L);
        CallContext.register(mock(User.class), caller);

        key = new KMSKeyVO("rotation-fixture", "metadata", "old-kek", KeyPurpose.VOLUME_ENCRYPTION,
                2L, 1L, 3L, "AES/GCM/NoPadding", 256);
        key.setId(5L);
        key.setHsmProfileId(4L);
        profile = new HSMProfileVO("database", "database", 2L, 1L, 3L, null);
        ReflectionTestUtils.setField(profile, "id", 4L);
        original = new KMSKekVersionVO(5L, 1, "old-kek");
        ReflectionTestUtils.setField(original, "id", 10L);
        original.setHsmProfileId(4L);
        storedVersions.add(original);

        ReflectionTestUtils.setField(manager, "kmsKeyDao", keys);
        ReflectionTestUtils.setField(manager, "kmsKekVersionDao", versions);
        ReflectionTestUtils.setField(manager, "kmsWrappedKeyDao", mock(KMSWrappedKeyDao.class));
        ReflectionTestUtils.setField(manager, "hsmProfileDao", profiles);
        ReflectionTestUtils.setField(manager, "accountManager", mock(AccountManager.class));
        executor = Executors.newSingleThreadExecutor();
        ReflectionTestUtils.setField(manager, "kmsOperationExecutor", executor);
        doReturn(5).when(manager).getOperationTimeoutSec();
        doReturn(0).when(manager).getRetryCount();
        doReturn(0).when(manager).getRetryDelayMs();
        doReturn(provider).when(manager).getKMSProvider("database");
        when(keys.findById(5L)).thenReturn(key);
        when(profiles.findById(4L)).thenReturn(profile);
        when(versions.listByKmsKeyId(5L)).thenAnswer(i -> new ArrayList<>(storedVersions));
        when(versions.getActiveVersion(5L)).thenAnswer(i -> storedVersions.stream()
                .filter(v -> v.getStatus() == KMSKekVersionVO.Status.Active).findFirst().orElse(null));
        when(versions.update(anyLong(), any(KMSKekVersionVO.class))).thenAnswer(i -> {
            assertTrue("Version updates belong to the metadata transaction", inTransaction.get());
            return true;
        });
        when(versions.persist(any(KMSKekVersionVO.class))).thenAnswer(i -> {
            assertTrue("New version belongs to the metadata transaction", inTransaction.get());
            KMSKekVersionVO value = i.getArgument(0);
            ReflectionTestUtils.setField(value, "id", 10L + storedVersions.size());
            storedVersions.add(value);
            return value;
        });
        when(keys.update(eq(5L), any(KMSKeyVO.class))).thenAnswer(i -> {
            assertTrue("Key bits, label and profile are saved in the same transaction", inTransaction.get());
            return true;
        });
        when(provider.createKek(any(KeyPurpose.class), anyString(), anyInt(), anyLong()))
                .thenAnswer(i -> i.getArgument(1));

        transactions = Mockito.mockStatic(Transaction.class);
        transactions.when(() -> Transaction.execute(any(TransactionCallbackWithException.class))).thenAnswer(i -> {
            inTransaction.set(true);
            try {
                return ((TransactionCallbackWithException<?, ?>) i.getArgument(0)).doInTransaction(null);
            } finally {
                inTransaction.set(false);
            }
        });
        lock = mock(GlobalLock.class);
        when(lock.lock(5)).thenReturn(true);
        locks = Mockito.mockStatic(GlobalLock.class);
        locks.when(() -> GlobalLock.getInternLock("kms.key.5")).thenReturn(lock);
        events = Mockito.mockStatic(ActionEventUtils.class);
    }

    @After
    public void tearDown() {
        events.close();
        locks.close();
        transactions.close();
        executor.shutdownNow();
        CallContext.unregister();
        storedVersions.clear();
    }

    private RotateKMSKeyCmd command(Integer bits, Long profileId) {
        RotateKMSKeyCmd cmd = mock(RotateKMSKeyCmd.class);
        when(cmd.getId()).thenReturn(5L);
        when(cmd.getKeyBits()).thenReturn(bits);
        when(cmd.getHsmProfileId()).thenReturn(profileId);
        return cmd;
    }

    private void assertOriginalMetadata() {
        assertEquals(Integer.valueOf(256), key.getKeyBits());
        assertEquals("old-kek", key.getKekLabel());
        assertEquals(Long.valueOf(4), key.getHsmProfileId());
        assertEquals(KMSKekVersionVO.Status.Active, original.getStatus());
    }

    @Test
    public void consecutiveRotationsPersistEverySupportedLengthAndOmissionKeepsCurrentLength() {
        for (Integer bits : new Integer[]{128, 192, 256, null}) {
            int expected = bits == null ? key.getKeyBits() : bits;
            manager.rotateKMSKey(command(bits, null));
            assertEquals(Integer.valueOf(expected), key.getKeyBits());
            KMSKekVersionVO active = storedVersions.get(storedVersions.size() - 1);
            assertEquals(key.getKekLabel(), active.getKekLabel());
            assertEquals(key.getHsmProfileId(), active.getHsmProfileId());
            verify(provider).createKek(KeyPurpose.VOLUME_ENCRYPTION, active.getKekLabel(), expected, 4L);
            try (MockedStatic<ApiDBUtils> zones = Mockito.mockStatic(ApiDBUtils.class);
                    MockedStatic<ApiResponseHelper> owners = Mockito.mockStatic(ApiResponseHelper.class)) {
                assertEquals(Integer.valueOf(expected), manager.createKMSKeyResponse(key).getKeyBits());
            }
        }
        assertEquals(5, storedVersions.size());
        assertEquals(Integer.valueOf(5), storedVersions.get(4).getVersionNumber());
    }

    @Test
    public void crossProfileRotationSavesBitsLabelAndProfileTogether() {
        HSMProfileVO target = new HSMProfileVO("other", "database", 2L, 1L, 3L, null);
        ReflectionTestUtils.setField(target, "id", 6L);
        when(profiles.findById(6L)).thenReturn(target);
        manager.rotateKMSKey(command(192, 6L));
        assertEquals(Integer.valueOf(192), key.getKeyBits());
        assertEquals(Long.valueOf(6), key.getHsmProfileId());
        assertEquals(Long.valueOf(6), storedVersions.get(1).getHsmProfileId());
        verify(provider).createKek(KeyPurpose.VOLUME_ENCRYPTION, key.getKekLabel(), 192, 6L);
    }

    @Test
    public void invalidLengthsNeverCallProviderOrWriteVersions() {
        for (int bits : new int[]{0, 129, -1, 257}) {
            assertThrows(KMSException.class, () -> manager.rotateKMSKey(command(bits, null)));
        }
        verify(provider, never()).createKek(any(), anyString(), anyInt(), anyLong());
        verify(versions, never()).persist(any(KMSKekVersionVO.class));
        assertOriginalMetadata();
    }

    @Test
    public void disabledKeyDoesNotRotate() {
        key.setEnabled(false);
        assertThrows(InvalidParameterValueException.class, () -> manager.rotateKMSKey(command(128, null)));
        verify(provider, never()).createKek(any(), anyString(), anyInt(), anyLong());
        assertOriginalMetadata();
    }

    @Test
    public void disabledCurrentProfileDoesNotBypassValidationWhenTargetOmitted() {
        profile.setEnabled(false);
        assertThrows(InvalidParameterValueException.class, () -> manager.rotateKMSKey(command(128, null)));
        verify(provider, never()).createKek(any(), anyString(), anyInt(), anyLong());
        assertOriginalMetadata();
    }

    @Test
    public void disabledTargetProfileDoesNotRotate() {
        profile.setEnabled(false);
        assertThrows(InvalidParameterValueException.class, () -> manager.rotateKMSKey(command(128, 4L)));
        verify(provider, never()).createKek(any(), anyString(), anyInt(), anyLong());
        assertOriginalMetadata();
    }

    @Test
    public void missingCurrentProfileDoesNotRotate() {
        when(profiles.findById(4L)).thenReturn(null);
        assertThrows(InvalidParameterValueException.class, () -> manager.rotateKMSKey(command(128, null)));
        verify(provider, never()).createKek(any(), anyString(), anyInt(), anyLong());
        assertOriginalMetadata();
    }

    @Test
    public void profileOutsideKeyOwnerScopeDoesNotRotate() {
        HSMProfileVO target = new HSMProfileVO("other-owner", "database", 99L, 1L, 3L, null);
        ReflectionTestUtils.setField(target, "id", 6L);
        when(profiles.findById(6L)).thenReturn(target);
        assertThrows(InvalidParameterValueException.class, () -> manager.rotateKMSKey(command(128, 6L)));
        verify(provider, never()).createKek(any(), anyString(), anyInt(), anyLong());
        assertOriginalMetadata();
    }

    @Test
    public void deniedCurrentProfileAccessDoesNotRotate() {
        doThrow(new PermissionDeniedException("denied")).when(manager).checkHSMProfileAccess(caller, profile, false);
        assertThrows(PermissionDeniedException.class, () -> manager.rotateKMSKey(command(128, null)));
        verify(provider, never()).createKek(any(), anyString(), anyInt(), anyLong());
        assertOriginalMetadata();
    }

    @Test
    public void busyKeyDoesNotEnterRotationAndReleasesLockReference() {
        when(lock.lock(5)).thenReturn(false);
        assertThrows(KMSException.class, () -> manager.rotateKMSKey(command(128, null)));
        verify(lock, never()).unlock();
        verify(lock).releaseRef();
        verify(provider, never()).createKek(any(), anyString(), anyInt(), anyLong());
        assertOriginalMetadata();
    }

    @Test
    public void providerFailureLeavesOriginalMetadataAndVersionsUntouched() {
        when(provider.createKek(any(), anyString(), anyInt(), anyLong()))
                .thenThrow(KMSException.kekOperationFailed("provider unavailable", null));
        assertThrows(KMSException.class, () -> manager.rotateKMSKey(command(128, null)));
        verify(versions, never()).persist(any(KMSKekVersionVO.class));
        verify(provider, never()).deleteKek(anyString());
        assertOriginalMetadata();
    }

    @Test
    public void falseKeyUpdateFailsAndCompensatesNewKek() {
        when(keys.update(eq(5L), any(KMSKeyVO.class))).thenReturn(false);
        assertThrows(KMSException.class, () -> manager.rotateKMSKey(command(128, null)));
        verify(provider).deleteKek(anyString());
        assertOriginalMetadata();
    }

    @Test
    public void uncheckedDatabaseFailureAlsoCompensatesNewKek() {
        when(keys.update(eq(5L), any(KMSKeyVO.class))).thenThrow(new IllegalStateException("database failure"));
        assertThrows(KMSException.class, () -> manager.rotateKMSKey(command(128, null)));
        verify(provider).deleteKek(anyString());
        assertOriginalMetadata();
    }

    @Test
    public void falsePreviousVersionUpdateFailsAndCompensatesNewKek() {
        when(versions.update(eq(10L), any(KMSKekVersionVO.class))).thenReturn(false);
        assertThrows(KMSException.class, () -> manager.rotateKMSKey(command(128, null)));
        verify(provider).deleteKek(anyString());
        assertOriginalMetadata();
    }

    @Test
    public void failedVersionInsertCompensatesNewKek() {
        when(versions.persist(any(KMSKekVersionVO.class))).thenReturn(null);
        assertThrows(KMSException.class, () -> manager.rotateKMSKey(command(128, null)));
        verify(provider).deleteKek(anyString());
        assertOriginalMetadata();
    }

    @Test
    public void compensationFailurePreservesOriginalMetadataAndReportsRotationFailure() {
        when(keys.update(eq(5L), any(KMSKeyVO.class))).thenReturn(false);
        doThrow(KMSException.kekOperationFailed("cleanup unavailable", null)).when(provider).deleteKek(anyString());
        assertThrows(KMSException.class, () -> manager.rotateKMSKey(command(128, null)));
        assertOriginalMetadata();
    }
}

