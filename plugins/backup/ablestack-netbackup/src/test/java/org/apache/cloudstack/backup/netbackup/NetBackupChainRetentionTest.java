// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements. See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership. The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License. You may obtain a copy of the License at
//
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied. See the License for the
// specific language governing permissions and limitations
// under the License.
package org.apache.cloudstack.backup.netbackup;

import java.time.Instant;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.apache.cloudstack.backup.Backup;
import org.apache.cloudstack.backup.BackupDetailVO;
import org.apache.cloudstack.backup.BackupVO;
import org.apache.cloudstack.backup.ThirdPartyBackupManifest;
import org.apache.cloudstack.backup.dao.BackupDao;
import org.apache.cloudstack.backup.dao.BackupDetailsDao;
import org.junit.Before;
import org.junit.After;
import org.junit.Test;
import org.mockito.MockedStatic;
import org.springframework.test.util.ReflectionTestUtils;

import com.cloud.storage.Volume;
import com.cloud.utils.exception.CloudRuntimeException;
import com.cloud.utils.db.GlobalLock;
import com.google.gson.Gson;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertThrows;
import static org.junit.Assert.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

public class NetBackupChainRetentionTest {
    private final AblestackNetBackupClient client = mock(AblestackNetBackupClient.class);
    private final BackupDao backups = mock(BackupDao.class);
    private final BackupDetailsDao details = mock(BackupDetailsDao.class);
    private final Map<String, BackupVO> points = new HashMap<>();
    private final Map<String, Map<Integer, Instant>> expirations = new LinkedHashMap<>();
    private final Instant early = Instant.now().truncatedTo(java.time.temporal.ChronoUnit.MILLIS).plusSeconds(86400);
    private final Instant later = early.plusSeconds(7 * 86400);
    private final NetBackupChainRetention protection = new NetBackupChainRetention(client, backups, details);
    private final GlobalLock lock = mock(GlobalLock.class);
    private MockedStatic<GlobalLock> locks;

    @Before public void setup() {
        locks = mockStatic(GlobalLock.class);
        locks.when(() -> GlobalLock.getInternLock(anyString())).thenReturn(lock);
        when(lock.lock(1)).thenReturn(true);
        when(backups.findByUuid(anyString())).thenAnswer(call -> points.get(call.getArgument(0)));
        when(backups.listByVmId(1L, 10L)).thenAnswer(call -> new java.util.ArrayList<Backup>(points.values()));
        when(details.listDetailsForResourceIdsAndKey(anyList(), eq(ThirdPartyBackupManifest.RETENTION_PROTECTION_KEY))).thenAnswer(call -> {
            List<Long> ids = call.getArgument(0);
            List<BackupDetailVO> receipts = new java.util.ArrayList<>();
            for (BackupVO point : points.values()) {
                String value = point.getDetail(ThirdPartyBackupManifest.RETENTION_PROTECTION_KEY);
                if (ids.contains(point.getId()) && value != null) {
                    receipts.add(new BackupDetailVO(point.getId(), ThirdPartyBackupManifest.RETENTION_PROTECTION_KEY, value, false));
                }
            }
            return receipts;
        });
        when(client.imageRetention(any(), anyBoolean(), anyString())).thenAnswer(call -> {
            ThirdPartyBackupManifest.Artifact artifact = call.getArgument(0);
            Map<Integer, Instant> copies = expirations.get(artifact.externalId);
            if (copies == null) { throw new CloudRuntimeException("Missing image"); }
            return new AblestackNetBackupClient.ImageRetention(artifact.externalId, "host", copies);
        });
        when(client.extendImageRetention(any(), anyBoolean(), anyString(), anyInt(), any())).thenAnswer(call -> {
            ThirdPartyBackupManifest.Artifact artifact = call.getArgument(0);
            expirations.get(artifact.externalId).put(call.getArgument(3), call.getArgument(4));
            return new AblestackNetBackupClient.ExpireImageResult(true, null);
        });
    }

    @After public void closeLocks() { locks.close(); }

    @Test public void fullPreparationDoesNotReadOrExtendAnyPreviousChain() {
        point(1, null, early);
        BackupVO nextFull = point(2, null, later);
        ThirdPartyBackupManifest m = manifest(nextFull);
        m.getOwnedArtifacts().forEach(artifact -> { artifact.completed = false; artifact.externalId = null; });
        m.setComplete(false);
        nextFull.getDetails().put(ThirdPartyBackupManifest.DETAIL_KEY, m.toJson());
        protection.protect(nextFull, 43200, false);
        verify(client, never()).imageRetention(any(), anyBoolean(), anyString());
        verify(client, never()).extendImageRetention(any(), anyBoolean(), anyString(), anyInt(), any());
    }

    @Test public void completedReceiptDoesNotNeedPollingButUnverifiedAndForeignReceiptsDo() {
        BackupVO full = point(1, null, early);
        BackupVO child = point(2, full, later);
        assertTrue(NetBackupChainRetention.needsReconciliation(child));
        protection.protect(child, 0, true);
        assertFalse(NetBackupChainRetention.needsReconciliation(child));
        NetBackupChainRetention.State state = state(child);
        state.state = "WAITING";
        child.getDetails().put(ThirdPartyBackupManifest.RETENTION_PROTECTION_KEY, new Gson().toJson(state));
        assertTrue(NetBackupChainRetention.needsReconciliation(child));
        state.state = "COMPLETED"; state.backupUuid = "foreign-backup";
        child.getDetails().put(ThirdPartyBackupManifest.RETENTION_PROTECTION_KEY, new Gson().toJson(state));
        assertTrue(NetBackupChainRetention.needsReconciliation(child));
    }

    @Test public void concurrentProtectionDefersWithoutCallingNetBackup() {
        BackupVO full = point(1, null, early);
        when(lock.lock(1)).thenReturn(false);
        assertThrows(CloudRuntimeException.class, () -> protection.protect(full, 0, true));
        verify(client, never()).imageRetention(any(), anyBoolean(), anyString());
        verify(lock, never()).unlock();
        verify(lock).releaseRef();
    }

    @Test public void anotherBackupCannotOverlapAnUnconfirmedRequestForTheSameFull() {
        BackupVO full = point(1, null, early);
        BackupVO first = point(2, full, later);
        BackupVO second = point(3, full, later.plusSeconds(86400));
        doReturn(new AblestackNetBackupClient.ExpireImageResult(false, "ticket-1"))
                .when(client).extendImageRetention(any(), anyBoolean(), anyString(), anyInt(), any());
        assertThrows(CloudRuntimeException.class, () -> protection.protect(first, 0, true));
        assertThrows(CloudRuntimeException.class, () -> protection.protect(second, 0, true));
        verify(client).extendImageRetention(any(), anyBoolean(), anyString(), anyInt(), any());
        assertTrue(state(second).reason.contains(first.getUuid()));
    }

    @Test public void allFullIntermediateAndMetadataCopiesOutliveTheLatestIncremental() {
        BackupVO full = point(1, null, early);
        BackupVO intermediate = point(2, full, early.plusSeconds(86400));
        BackupVO leaf = point(3, intermediate, later);
        protection.protect(leaf, 0, true);
        for (Map<Integer, Instant> copies : expirations.values()) { assertTrue(copies.values().stream().allMatch(later::equals)); }
        assertEquals("COMPLETED", state(leaf).state);
        verify(client, times(8)).extendImageRetention(any(), anyBoolean(), anyString(), anyInt(), any());
    }

    @Test public void longerParentRetentionIsNeverShortenedOrCopiedBackIntoTheChild() {
        BackupVO full = point(1, null, later.plusSeconds(86400));
        BackupVO child = point(2, full, later);
        protection.protect(child, 0, true);
        verify(client, never()).extendImageRetention(any(), anyBoolean(), anyString(), anyInt(), any());
        assertEquals(later.toString(), state(child).protectedUntil);
    }

    @Test public void repeatedReconciliationUsesAbsoluteDatesWithoutExtendingForever() {
        BackupVO full = point(1, null, early);
        BackupVO child = point(2, full, later);
        protection.protect(child, 0, true);
        protection.protect(child, 0, true);
        verify(client, times(4)).extendImageRetention(any(), anyBoolean(), anyString(), anyInt(), any());
        assertEquals(later.toString(), state(child).protectedUntil);
    }

    @Test public void approvedTicketResumesWithoutCreatingAnotherApprovalRequest() {
        BackupVO full = point(1, null, early);
        BackupVO child = point(2, full, later);
        doReturn(new AblestackNetBackupClient.ExpireImageResult(false, "ticket-1"))
                .when(client).extendImageRetention(any(), anyBoolean(), anyString(), anyInt(), any());
        assertThrows(CloudRuntimeException.class, () -> protection.protect(child, 0, true));
        assertThrows(CloudRuntimeException.class, () -> protection.protect(child, 0, true));
        verify(client).extendImageRetention(any(), anyBoolean(), anyString(), anyInt(), any());
        assertTrue(state(child).reason.contains("ticket-1"));
        expirations.values().forEach(copies -> copies.replaceAll((copy, date) -> later));
        protection.protect(child, 0, true);
        assertEquals("COMPLETED", state(child).state);
        assertTrue(state(child).pending.isEmpty());
    }

    @Test public void responseLossPreservesIntentAndDoesNotResubmitIt() {
        BackupVO full = point(1, null, early);
        BackupVO child = point(2, full, later);
        doThrow(new CloudRuntimeException("Response lost"))
                .when(client).extendImageRetention(any(), anyBoolean(), anyString(), anyInt(), any());
        assertThrows(CloudRuntimeException.class, () -> protection.protect(child, 0, true));
        assertThrows(CloudRuntimeException.class, () -> protection.protect(child, 0, true));
        verify(client).extendImageRetention(any(), anyBoolean(), anyString(), anyInt(), any());
        assertEquals("WAITING", state(child).state);
        assertFalse(state(child).pending.isEmpty());
    }

    @Test public void definiteRejectionCanBeRetriedAfterPermissionsAreRepaired() {
        BackupVO full = point(1, null, early);
        BackupVO child = point(2, full, later);
        doThrow(new AblestackNetBackupClient.RetentionUpdateRejected("HTTP 403"))
                .when(client).extendImageRetention(any(), anyBoolean(), anyString(), anyInt(), any());
        assertThrows(CloudRuntimeException.class, () -> protection.protect(child, 0, true));
        assertTrue(state(child).pending.isEmpty());
        assertThrows(CloudRuntimeException.class, () -> protection.protect(child, 0, true));
        verify(client, times(2)).extendImageRetention(any(), anyBoolean(), anyString(), anyInt(), any());
    }

    @Test public void successResponseWithoutCatalogChangeDoesNotCompleteProtection() {
        BackupVO full = point(1, null, early);
        BackupVO child = point(2, full, later);
        doReturn(new AblestackNetBackupClient.ExpireImageResult(true, null))
                .when(client).extendImageRetention(any(), anyBoolean(), anyString(), anyInt(), any());
        assertThrows(CloudRuntimeException.class, () -> protection.protect(child, 0, true));
        assertEquals("WAITING", state(child).state);
        assertFalse(state(child).pending.isEmpty());
    }

    @Test public void missingInventoryFailsBeforeUpdatingAnyOtherImages() {
        BackupVO full = point(1, null, early);
        BackupVO child = point(2, full, later);
        expirations.remove(manifest(child).getMetadata().externalId);
        assertThrows(CloudRuntimeException.class, () -> protection.protect(child, 0, true));
        verify(client, never()).extendImageRetention(any(), anyBoolean(), anyString(), anyInt(), any());
    }

    @Test public void foreignVmOwnershipIsRejectedBeforeExternalCalls() {
        BackupVO full = point(1, null, early);
        BackupVO child = point(2, full, later);
        full.setVmId(999L);
        assertThrows(CloudRuntimeException.class, () -> protection.protect(child, 0, true));
        verify(client, never()).imageRetention(any(), anyBoolean(), anyString());
    }

    @Test public void preparationPinsAncestorsEvenBeforeAnyNewImageExists() {
        BackupVO full = point(1, null, Instant.now().plusSeconds(3600));
        BackupVO child = point(2, full, later);
        ThirdPartyBackupManifest m = manifest(child);
        m.getOwnedArtifacts().forEach(artifact -> { artifact.completed = false; artifact.externalId = null; });
        m.setComplete(false);
        child.getDetails().put(ThirdPartyBackupManifest.DETAIL_KEY, m.toJson());
        protection.protect(child, 43200, false);
        String until = state(child).preparationUntil;
        protection.protect(child, 43200, false);
        assertEquals(until, state(child).preparationUntil);
        assertTrue(Instant.parse(until).isAfter(Instant.now().plusSeconds(40000)));
        verify(client, times(4)).extendImageRetention(any(), anyBoolean(), anyString(), anyInt(), any());
    }

    @Test public void multiVolumePreparationIncludesExportAndTransferTimeoutsBeforeAnyChildImageExists() {
        BackupVO full = point(1, null, early, 2);
        BackupVO child = point(2, full, later, 2);
        ThirdPartyBackupManifest m = manifest(child);
        m.getOwnedArtifacts().forEach(artifact -> { artifact.completed = false; artifact.externalId = null; });
        m.setComplete(false);
        child.getDetails().put(ThirdPartyBackupManifest.DETAIL_KEY, m.toJson());
        Instant before = Instant.now();
        protection.protect(child, 43200, false);
        Instant deadline = Instant.parse(state(child).preparationUntil);
        assertFalse(deadline.isBefore(before.plusSeconds(7 * 43200L)));
        assertTrue(deadline.isBefore(Instant.now().plusSeconds(7 * 43200L + 1)));
        verify(client, times(6)).extendImageRetention(any(), anyBoolean(), anyString(), anyInt(), any());
    }

    private BackupVO point(long id, BackupVO parent, Instant expiration) {
        return point(id, parent, expiration, 1);
    }

    private BackupVO point(long id, BackupVO parent, Instant expiration, int volumeCount) {
        BackupVO backup = new BackupVO();
        ReflectionTestUtils.setField(backup, "id", id);
        backup.setVmId(10L);
        backup.setZoneId(1L);
        backup.setStatus(Backup.Status.BackedUp);
        backup.setDetails(new HashMap<>());
        String path = "/mnt/staging/ablestack-netbackup/i-2-10-VM/point-" + id;
        List<Backup.VolumeInfo> volumes = new java.util.ArrayList<>();
        for (int index = 0; index < volumeCount; index++) {
            volumes.add(new Backup.VolumeInfo("volume-" + index, "disk-" + index + ".raw",
                    index == 0 ? Volume.Type.ROOT : Volume.Type.DATADISK, 100L << 30, (long) index, null, null, null));
        }
        ThirdPartyBackupManifest m = ThirdPartyBackupManifest.create("ablestack-netbackup", backup.getUuid(), "i-2-10-VM", "point-" + id,
                parent == null ? "FULL" : "INCREMENTAL", "host", path, "RBD_DIFF",
                volumes,
                parent == null ? null : manifest(parent).toJson(), parent == null ? null : manifest(parent).getTimestamp());
        ThirdPartyBackupManifest.Artifact metadata = new ThirdPartyBackupManifest.Artifact();
        metadata.backupUuid = backup.getUuid(); metadata.path = path; m.setMetadata(metadata);
        int index = 0;
        for (ThirdPartyBackupManifest.Artifact artifact : m.getOwnedArtifacts()) {
            artifact.completed = true; artifact.sourceHost = "host"; artifact.jobId = String.valueOf(id);
            artifact.externalId = "host_" + id + "_" + index++;
            expirations.put(artifact.externalId, new LinkedHashMap<>(Map.of(1, expiration, 2, expiration)));
        }
        m.setComplete(true);
        backup.getDetails().put(ThirdPartyBackupManifest.DETAIL_KEY, m.toJson());
        backup.getDetails().put("netbackup.transfer.mode", "USER_BACKUP");
        backup.getDetails().put("netbackup.policy.name", "host-policy");
        points.put(backup.getUuid(), backup);
        return backup;
    }

    private ThirdPartyBackupManifest manifest(Backup backup) {
        return ThirdPartyBackupManifest.fromJson(backup.getDetail(ThirdPartyBackupManifest.DETAIL_KEY));
    }

    private NetBackupChainRetention.State state(Backup backup) {
        return new Gson().fromJson(backup.getDetail(ThirdPartyBackupManifest.RETENTION_PROTECTION_KEY), NetBackupChainRetention.State.class);
    }
}
