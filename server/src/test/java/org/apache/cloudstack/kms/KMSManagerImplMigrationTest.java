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

import com.cloud.event.ActionEventUtils;
import com.cloud.exception.InvalidParameterValueException;
import com.cloud.storage.VolumeVO;
import com.cloud.storage.Volume;
import com.cloud.storage.dao.VolumeDao;
import com.cloud.user.Account;
import com.cloud.user.User;
import com.cloud.utils.db.Transaction;
import com.cloud.utils.db.TransactionCallback;
import com.cloud.utils.exception.CloudRuntimeException;
import org.apache.cloudstack.context.CallContext;
import org.apache.cloudstack.framework.kms.KMSException;
import org.apache.cloudstack.framework.kms.KMSProvider;
import org.apache.cloudstack.framework.kms.KeyPurpose;
import org.apache.cloudstack.framework.kms.WrappedKey;
import org.apache.cloudstack.kms.dao.KMSWrappedKeyDao;
import org.apache.cloudstack.secret.PassphraseVO;
import org.apache.cloudstack.secret.dao.PassphraseDao;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.mockito.MockedStatic;
import org.mockito.Mockito;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Base64;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertThrows;
import static org.junit.Assert.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

public class KMSManagerImplMigrationTest {
    private KMSManagerImpl manager;
    private VolumeDao volumes;
    private KMSWrappedKeyDao wrappedKeys;
    private PassphraseDao passphrases;
    private KMSProvider provider;
    private VolumeVO volume;
    private KMSKey key;
    private KMSKekVersionVO version;
    private ExecutorService executor;
    private MockedStatic<Transaction> transactions;
    private MockedStatic<ActionEventUtils> events;
    private byte[] legacy;

    @Before
    public void setUp() {
        manager = spy(new KMSManagerImpl());
        volumes = mock(VolumeDao.class);
        wrappedKeys = mock(KMSWrappedKeyDao.class);
        passphrases = mock(PassphraseDao.class);
        provider = mock(KMSProvider.class);
        key = mock(KMSKey.class);
        version = mock(KMSKekVersionVO.class);
        volume = new VolumeVO(com.cloud.storage.Volume.Type.DATADISK, "fixture", 3L, 1L,
                2L, 1L, com.cloud.storage.Storage.ProvisioningType.THIN, 1024L, null, null, null);
        ReflectionTestUtils.setField(volume, "id", 7L);
        volume.setAccountId(2L);
        volume.setDataCenterId(3L);
        volume.setPassphraseId(11L);
        volume.setEncryptFormat("luks");
        ReflectionTestUtils.setField(volume, "state", Volume.State.Ready);
        ReflectionTestUtils.setField(manager, "accountManager", mock(com.cloud.user.AccountManager.class));
        when(key.getId()).thenReturn(5L);
        when(key.getAccountId()).thenReturn(2L);
        when(key.getZoneId()).thenReturn(3L);
        when(version.getId()).thenReturn(6L);
        when(version.getKekLabel()).thenReturn("test-kek-v1");
        when(version.getHsmProfileId()).thenReturn(4L);
        when(volumes.lockRow(7L, true)).thenReturn(volume);
        when(volumes.update(7L, volume)).thenReturn(true);
        PassphraseVO passphrase = new PassphraseVO(true);
        legacy = passphrase.getPassphrase();
        when(passphrases.findById(11L)).thenReturn(passphrase);
        when(wrappedKeys.persist(any(KMSWrappedKeyVO.class))).thenAnswer(invocation -> {
            KMSWrappedKeyVO value = invocation.getArgument(0);
            ReflectionTestUtils.setField(value, "id", 12L);
            return value;
        });
        ReflectionTestUtils.setField(manager, "volumeDao", volumes);
        ReflectionTestUtils.setField(manager, "passphraseDao", passphrases);
        ReflectionTestUtils.setField(manager, "kmsWrappedKeyDao", wrappedKeys);
        executor = Executors.newSingleThreadExecutor();
        ReflectionTestUtils.setField(manager, "kmsOperationExecutor", executor);
        doReturn(5).when(manager).getOperationTimeoutSec();
        doReturn(0).when(manager).getRetryCount();
        doReturn(0).when(manager).getRetryDelayMs();
        transactions = Mockito.mockStatic(Transaction.class);
        transactions.when(() -> Transaction.execute(any(TransactionCallback.class)))
                .thenAnswer(invocation -> ((TransactionCallback<?>) invocation.getArgument(0)).doInTransaction(null));
        events = Mockito.mockStatic(ActionEventUtils.class);
        CallContext.register(mock(User.class), mock(Account.class));
    }

    @After
    public void tearDown() {
        CallContext.unregister();
        events.close();
        transactions.close();
        executor.shutdownNow();
    }

    @Test
    public void migrationPreservesLegacyLibvirtSecretAndClearsRawBytes() {
        byte[][] seen = new byte[2][];
        when(provider.wrapKey(any(byte[].class), eq(KeyPurpose.VOLUME_ENCRYPTION), eq("test-kek-v1"), eq(4L)))
                .thenAnswer(invocation -> {
                    byte[] raw = invocation.getArgument(0);
                    seen[0] = raw.clone();
                    seen[1] = raw;
                    return new WrappedKey("test-kek-v1", KeyPurpose.VOLUME_ENCRYPTION, "AES/GCM/NoPadding",
                            new byte[]{1, 2, 3}, "database", null, null);
                });
        assertTrue(manager.migrateVolumeToKmsKey(provider, volume, key, version));
        assertEquals(48, seen[0].length);
        assertArrayEquals(legacy, Base64.getEncoder().encode(seen[0]));
        assertArrayEquals(new byte[48], seen[1]);
        assertNull(volume.getPassphraseId());
        assertEquals(Long.valueOf(5), volume.getKmsKeyId());
        assertEquals(Long.valueOf(12), volume.getKmsWrappedKeyId());
        verify(passphrases, never()).remove(anyLong());
    }

    @Test
    public void providerFailurePreservesLegacyReference() {
        when(provider.wrapKey(any(byte[].class), any(), anyString(), anyLong()))
                .thenThrow(KMSException.kekNotFound("unavailable"));
        assertThrows(CloudRuntimeException.class, () -> manager.migrateVolumeToKmsKey(provider, volume, key, version));
        assertEquals(Long.valueOf(11), volume.getPassphraseId());
        assertNull(volume.getKmsWrappedKeyId());
        verify(wrappedKeys, never()).persist(any(KMSWrappedKeyVO.class));
        verify(volumes, never()).update(anyLong(), any(VolumeVO.class));
    }

    @Test
    public void failedVolumeUpdateFailsTransaction() {
        when(provider.wrapKey(any(byte[].class), any(), anyString(), anyLong()))
                .thenReturn(new WrappedKey("test-kek-v1", KeyPurpose.VOLUME_ENCRYPTION, "AES/GCM/NoPadding",
                        new byte[]{1}, "database", null, null));
        when(volumes.update(7L, volume)).thenReturn(false);
        assertThrows(CloudRuntimeException.class, () -> manager.migrateVolumeToKmsKey(provider, volume, key, version));
        events.verifyNoInteractions();
    }

    @Test
    public void otherZoneFailsBeforeProviderAccess() {
        volume.setDataCenterId(99L);
        assertThrows(InvalidParameterValueException.class, () -> manager.migrateVolumeToKmsKey(provider, volume, key, version));
        verifyNoInteractions(provider);
    }

    @Test
    public void otherAccountFailsBeforeProviderAccess() {
        volume.setAccountId(99L);
        assertThrows(InvalidParameterValueException.class, () -> manager.migrateVolumeToKmsKey(provider, volume, key, version));
        verifyNoInteractions(provider);
    }

    @Test
    public void repeatedMigrationDoesNotReplaceExistingKey() {
        volume.setKmsWrappedKeyId(12L);
        volume.setKmsKeyId(5L);
        volume.setPassphraseId(null);
        assertFalse(manager.migrateVolumeToKmsKey(provider, volume, key, version));
        verifyNoInteractions(provider);
    }

    @Test
    public void missingPassphraseFailsBeforeProviderAccess() {
        when(passphrases.findById(11L)).thenReturn(null);
        assertThrows(InvalidParameterValueException.class, () -> manager.migrateVolumeToKmsKey(provider, volume, key, version));
        verifyNoInteractions(provider);
        assertEquals(Long.valueOf(11), volume.getPassphraseId());
    }

    @Test
    public void busyKeyLockFailsBeforeChangingKeys() {
        assertEquals("ELIGIBLE_LEGACY", manager.migrationReason(volume, key));
        com.cloud.utils.db.GlobalLock lock = mock(com.cloud.utils.db.GlobalLock.class);
        try (MockedStatic<com.cloud.utils.db.GlobalLock> locks = Mockito.mockStatic(com.cloud.utils.db.GlobalLock.class)) {
            locks.when(() -> com.cloud.utils.db.GlobalLock.getInternLock("kms.key.5")).thenReturn(lock);
            when(lock.lock(5)).thenReturn(false);
            java.util.function.Supplier<Boolean> operation = mock(java.util.function.Supplier.class);
            assertThrows(KMSException.class, () -> manager.withKmsKeyLock(5L, operation));
            verifyNoInteractions(operation);
            verify(lock).releaseRef();
            verify(lock, never()).unlock();
        }
    }

    @Test
    public void operationFailureAlwaysReleasesKeyLock() {
        com.cloud.utils.db.GlobalLock lock = mock(com.cloud.utils.db.GlobalLock.class);
        try (MockedStatic<com.cloud.utils.db.GlobalLock> locks = Mockito.mockStatic(com.cloud.utils.db.GlobalLock.class)) {
            locks.when(() -> com.cloud.utils.db.GlobalLock.getInternLock("kms.key.5")).thenReturn(lock);
            when(lock.lock(5)).thenReturn(true);
            assertThrows(CloudRuntimeException.class, () -> manager.withKmsKeyLock(5L, () -> {
                throw new CloudRuntimeException("fixture failure");
            }));
            verify(lock).unlock();
            verify(lock).releaseRef();
        }
    }

    @Test
    public void eligibilityRejectsPlaintextAndBusyAndMissingLegacy() {
        volume.setEncryptFormat(null);
        assertEquals("NOT_ENCRYPTED", manager.migrationReason(volume, key));
        volume.setEncryptFormat("luks");
        ReflectionTestUtils.setField(volume, "state", Volume.State.Resizing);
        assertEquals("UNSUPPORTED_STATE", manager.migrationReason(volume, key));
        ReflectionTestUtils.setField(volume, "state", Volume.State.Ready);
        volume.setPassphraseId(null);
        assertEquals("LEGACY_KEY_UNAVAILABLE", manager.migrationReason(volume, key));
    }

    @Test
    public void otherKmsKeyCannotBeRekeyedImplicitly() {
        volume.setKmsKeyId(99L);
        volume.setKmsWrappedKeyId(12L);
        assertEquals("ALREADY_KMS", manager.migrationReason(volume, key));
        assertThrows(InvalidParameterValueException.class, () -> manager.migrateVolumeToKmsKey(provider, volume, key, version));
        verifyNoInteractions(provider);
    }

    @Test
    public void removedVolumeFailsClosed() {
        ReflectionTestUtils.setField(volume, "removed", new java.util.Date());
        assertEquals("NOT_FOUND", manager.migrationReason(volume, key));
        assertThrows(InvalidParameterValueException.class, () -> manager.migrateVolumeToKmsKey(provider, volume, key, version));
        verifyNoInteractions(provider);
    }

    private org.apache.cloudstack.api.command.admin.kms.MigrateVolumesToKMSCmd bulkCommand(java.util.List<Long> ids) {
        KMSKeyVO target = mock(KMSKeyVO.class);
        when(target.getId()).thenReturn(5L);
        when(target.getAccountId()).thenReturn(2L);
        when(target.getZoneId()).thenReturn(3L);
        when(target.isEnabled()).thenReturn(true);
        when(target.getPurpose()).thenReturn(KeyPurpose.VOLUME_ENCRYPTION);
        when(target.getHsmProfileId()).thenReturn(null);
        doReturn(target).when(manager).getVolumeMigrationTarget(5L);
        doReturn(provider).when(manager).getKMSProvider("database");
        org.apache.cloudstack.kms.dao.KMSKekVersionDao versions = mock(org.apache.cloudstack.kms.dao.KMSKekVersionDao.class);
        when(versions.getActiveVersion(5L)).thenReturn(version);
        ReflectionTestUtils.setField(manager, "kmsKekVersionDao", versions);
        org.apache.cloudstack.api.command.admin.kms.MigrateVolumesToKMSCmd cmd = mock(org.apache.cloudstack.api.command.admin.kms.MigrateVolumesToKMSCmd.class);
        when(cmd.getKmsKeyId()).thenReturn(5L);
        when(cmd.getVolumeIds()).thenReturn(ids);
        when(cmd.getDomainId()).thenReturn(null);
        return cmd;
    }

    @Test
    public void batchRejectsMissingUuidBeforeAnyProviderWrite() {
        Object cmd = bulkCommand(java.util.Arrays.asList(7L, 8L));
        when(volumes.listByIds(any())).thenReturn(java.util.Collections.singletonList(volume));
        assertThrows(InvalidParameterValueException.class,
                () -> ReflectionTestUtils.invokeMethod(manager, "migrateVolumesToKMSLocked", cmd));
        verifyNoInteractions(provider);
    }

    @Test
    public void sameTargetBatchSkipsAndReturnsZero() {
        Object cmd = bulkCommand(java.util.Arrays.asList(7L, 7L));
        volume.setKmsKeyId(5L);
        volume.setKmsWrappedKeyId(12L);
        when(volumes.listByIds(any())).thenReturn(java.util.Collections.singletonList(volume));
        assertEquals(Integer.valueOf(0), ReflectionTestUtils.invokeMethod(manager, "migrateVolumesToKMSLocked", cmd));
        verifyNoInteractions(provider);
    }

    @Test
    public void partialFailureRemainsAsyncFailureAfterOneMigration() {
        Object cmd = bulkCommand(java.util.Arrays.asList(7L, 8L));
        VolumeVO second = mock(VolumeVO.class);
        when(second.getAccountId()).thenReturn(2L);
        when(second.getDataCenterId()).thenReturn(3L);
        when(second.getKmsKeyId()).thenReturn(null);
        when(second.getKmsWrappedKeyId()).thenReturn(null);
        // Both candidates pass preflight; the second changes/fails under its row lock.
        when(second.getEncryptFormat()).thenReturn("luks");
        when(second.getState()).thenReturn(Volume.State.Ready);
        when(second.getPassphraseId()).thenReturn(11L);
        when(volumes.listByIds(any())).thenReturn(java.util.Arrays.asList(volume, second));
        doReturn(true).when(manager).migrateVolumeToKmsKey(eq(provider), eq(volume), any(), eq(version));
        org.mockito.Mockito.doThrow(new CloudRuntimeException("fixture second failure")).when(manager)
                .migrateVolumeToKmsKey(eq(provider), eq(second), any(), eq(version));
        assertThrows(KMSException.class, () -> ReflectionTestUtils.invokeMethod(manager, "migrateVolumesToKMSLocked", cmd));
        verify(manager).migrateVolumeToKmsKey(eq(provider), eq(volume), any(), eq(version));
    }

    @Test
    public void migrationContextRequiresAdministratorAndMigrationPermission() {
        com.cloud.user.AccountManager accounts = mock(com.cloud.user.AccountManager.class);
        ReflectionTestUtils.setField(manager, "accountManager", accounts);
        assertThrows(com.cloud.exception.PermissionDeniedException.class, () -> manager.getVolumeMigrationTarget(5L));
        when(accounts.isRootAdmin(anyLong())).thenReturn(true);
        org.mockito.Mockito.doThrow(new com.cloud.exception.PermissionDeniedException("Denied migration API")).when(accounts)
                .checkApiAccessForUser(any(User.class), eq("migrateVolumesToKMS"), eq(null));
        assertThrows(com.cloud.exception.PermissionDeniedException.class, () -> manager.getVolumeMigrationTarget(5L));
    }

    @Test
    public void successResponsePreservesSuccessAndReportsSkippedSeparately() {
        org.apache.cloudstack.api.response.KMSMigrationResponse receipt =
                new org.apache.cloudstack.api.response.KMSMigrationResponse("migration", 3, 1);
        com.google.gson.JsonObject json = new com.google.gson.Gson().toJsonTree(receipt).getAsJsonObject();
        assertTrue(json.get("success").getAsBoolean());
        assertEquals(3, json.get("requested").getAsInt());
        assertEquals(1, json.get("migrated").getAsInt());
        assertEquals(2, json.get("skipped").getAsInt());
        assertFalse(json.has("passphrase"));
    }
}
