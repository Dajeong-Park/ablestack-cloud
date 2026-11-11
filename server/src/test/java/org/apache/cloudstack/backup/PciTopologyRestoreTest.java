// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements. See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership. The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License. You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied. See the License for the
// specific language governing permissions and limitations
// under the License.
package org.apache.cloudstack.backup;

import java.util.HashMap;
import java.util.Map;
import com.cloud.event.ActionEventUtils;
import com.cloud.hypervisor.Hypervisor.HypervisorType;
import com.cloud.hypervisor.HypervisorGuru;
import com.cloud.hypervisor.HypervisorGuruManager;
import com.cloud.utils.db.Transaction;
import com.cloud.utils.db.TransactionCallback;
import com.cloud.utils.exception.CloudRuntimeException;
import com.cloud.vm.PciTopologyDetails;
import com.cloud.vm.PciTopologyProfile;
import com.cloud.vm.VMInstanceVO;
import com.cloud.vm.VmDetailConstants;
import com.cloud.vm.dao.VMInstanceDetailsDao;
import com.google.gson.Gson;
import org.apache.cloudstack.api.ApiConstants;
import org.apache.cloudstack.backup.dao.BackupDao;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.mockito.MockedStatic;
import org.mockito.Mockito;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertThrows;
import static org.junit.Assert.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

public class PciTopologyRestoreTest {
    private final BackupManagerImpl manager = new BackupManagerImpl();
    private final BackupDao backups = mock(BackupDao.class);
    private final VMInstanceDetailsDao details = mock(VMInstanceDetailsDao.class);
    private final VMInstanceVO vm = mock(VMInstanceVO.class);
    private final HypervisorGuru guru = mock(HypervisorGuru.class);
    private final BackupOffering offering = mock(BackupOffering.class);
    private final BackupVO backup = new BackupVO();
    private final Map<String, String> stored = new HashMap<>();
    private MockedStatic<Transaction> transactions;
    private MockedStatic<ActionEventUtils> events;

    @Before public void setup() {
        transactions = mockStatic(Transaction.class);
        transactions.when(() -> Transaction.execute(Mockito.<TransactionCallback<Object>>any()))
                .thenAnswer(call -> call.<TransactionCallback<Object>>getArgument(0).doInTransaction(null));
        events = mockStatic(ActionEventUtils.class);
        when(vm.getId()).thenReturn(77L);
        when(vm.getHypervisorType()).thenReturn(HypervisorType.KVM);
        when(details.listDetailsKeyPairs(77L)).thenReturn(stored);
        doAnswer(call -> { stored.put(call.getArgument(1), call.getArgument(2)); return null; })
                .when(details).addDetail(eq(77L), anyString(), anyString(), eq(false));
        stored.put("backup.guard", "retain");
        backup.setVmId(77L);
        backup.setAccountId(1L);
        backup.setDetails(new HashMap<>());
        HypervisorGuruManager gurus = mock(HypervisorGuruManager.class);
        when(gurus.getGuru(HypervisorType.KVM)).thenReturn(guru);
        ReflectionTestUtils.setField(manager, "hypervisorGuruManager", gurus);
        ReflectionTestUtils.setField(manager, "backupDao", backups);
        ReflectionTestUtils.setField(manager, "vmInstanceDetailsDao", details);
        Map<String, BackupProvider> providers = new HashMap<>();
        for (String name : java.util.List.of("ablestack-nas", "ablestack-veeam", "ablestack-netbackup", "ablestack-commvault")) {
            providers.put(name, mock(BackupProvider.class));
        }
        ReflectionTestUtils.setField(manager, "backupProvidersMap", providers);
        when(offering.getProvider()).thenReturn("ablestack-nas");
    }

    @After public void close() { events.close(); transactions.close(); }

    private boolean finish() {
        return manager.importRestoredVM(1, 1, 1, 1, "i-2-77-VM", HypervisorType.KVM, backup, offering);
    }

    private void source(Map<String, String> settings) {
        backup.getDetails().put(ApiConstants.VM_SETTINGS, new Gson().toJson(settings));
    }

    @Test public void originalVmRestoreAppliesFrozenSourceProfileForEveryAblestackProvider() throws Exception {
        source(PciTopologyProfile.WINDOWS_Q35_16.withDetails(Map.of(
                VmDetailConstants.KVM_GUEST_OS_MACHINE_TYPE, "pc-q35-rhel9.4.0")));
        when(guru.importVirtualMachineFromBackup(anyLong(), anyLong(), anyLong(), anyLong(), anyString(), eq(backup), any()))
                .thenReturn(vm);
        for (String provider : java.util.List.of("ablestack-nas", "ablestack-veeam", "ablestack-netbackup", "ablestack-commvault")) {
            stored.putAll(PciTopologyProfile.Q35_HOTPLUG_32.withDetails(Map.of()));
            when(offering.getProvider()).thenReturn(provider);
            assertTrue(finish());
            assertEquals(PciTopologyProfile.WINDOWS_Q35_16, PciTopologyProfile.fromDetails(stored));
            assertEquals("pc-q35-rhel9.4.0", stored.get(VmDetailConstants.KVM_GUEST_OS_MACHINE_TYPE));
            assertEquals("retain", stored.get("backup.guard"));
        }
    }

    @Test public void originalVmRestoreOfPreProfileQ35BackupUsesTheEuropaLegacyFallback() throws Exception {
        source(Map.of("UEFI", "LEGACY", "rootDiskController", "scsi"));
        stored.putAll(PciTopologyProfile.WINDOWS_Q35_16.withDetails(Map.of()));
        when(guru.importVirtualMachineFromBackup(anyLong(), anyLong(), anyLong(), anyLong(), anyString(), eq(backup), any()))
                .thenReturn(vm);
        assertTrue(finish());
        assertEquals(PciTopologyProfile.LEGACY_AUTO, PciTopologyProfile.fromDetails(stored));
        assertFalse(stored.containsKey("rootDiskController"));
    }

    @Test public void failedImportDoesNotChangeTheExistingProfile() throws Exception {
        source(PciTopologyProfile.LEGACY_AUTO.withDetails(Map.of()));
        stored.putAll(PciTopologyProfile.WINDOWS_Q35_16.withDetails(Map.of()));
        Map<String, String> before = new HashMap<>(stored);
        when(guru.importVirtualMachineFromBackup(anyLong(), anyLong(), anyLong(), anyLong(), anyString(), eq(backup), any()))
                .thenThrow(new CloudRuntimeException("Disk import failed"));
        assertThrows(CloudRuntimeException.class, this::finish);
        assertEquals(before, stored);
    }

    @Test public void missingImportedVmDoesNotChangeTheExistingProfile() {
        source(PciTopologyProfile.LEGACY_AUTO.withDetails(Map.of()));
        assertFalse(finish());
        assertEquals(Map.of("backup.guard", "retain"), stored);
    }

    @Test public void malformedSourceProfileIsRejectedWithoutWritingVmDetails() {
        source(Map.of(PciTopologyProfile.PROFILE_KEY, "unknown", PciTopologyProfile.VERSION_KEY, "1"));
        assertThrows(IllegalArgumentException.class, () -> PciTopologyDetails.backupProfile(backup));
        verifyNoInteractions(details);
    }

    @Test public void manifestSourceConfigurationSuppliesMissingLogicalBackupSettings() {
        ThirdPartyBackupManifest manifest = ThirdPartyBackupManifest.create("ablestack-veeam", "backup-1", "vm", "point", "FULL",
                "host-4", "/staging/ablestack-veeam/vm/point", "QCOW2", java.util.List.of(new Backup.VolumeInfo(
                        "volume-1", "root", com.cloud.storage.Volume.Type.ROOT, 1L << 30, 0L, null, null, null)), null, null);
        ThirdPartyBackupManifest.SourceConfiguration source = new ThirdPartyBackupManifest.SourceConfiguration();
        source.vmUuid = "source-vm";
        source.details.put(ApiConstants.VM_SETTINGS, new Gson().toJson(PciTopologyProfile.WINDOWS_Q35_16.withDetails(Map.of())));
        manifest.setSourceConfiguration(source);
        backup.getDetails().put(ThirdPartyBackupManifest.DETAIL_KEY, manifest.toJson());
        assertEquals(PciTopologyProfile.WINDOWS_Q35_16, PciTopologyProfile.fromDetails(PciTopologyDetails.backupProfile(backup)));
    }

    @Test public void metadataWithoutPciInformationRetainsTheCurrentVmConfiguration() {
        stored.putAll(PciTopologyProfile.WINDOWS_Q35_16.withDetails(Map.of()));
        Map<String, String> before = new HashMap<>(stored);
        PciTopologyDetails.inheritSourceProfile(vm, Map.of("rootDiskController", "scsi"), details);
        assertEquals(before, stored);
        verifyNoInteractions(details);
    }

    @Test public void onlyOwnedProfileKeysAreInheritedFromSnapshotMetadata() {
        Map<String, String> snapshot = new HashMap<>();
        String prefix = com.cloud.vm.VmCreationSourceService.PREFIX;
        PciTopologyProfile.LEGACY_AUTO.withDetails(Map.of(VmDetailConstants.KVM_GUEST_OS_MACHINE_TYPE, "pc-q35-rhel9.4.0"))
                .forEach((key, value) -> snapshot.put(prefix + key, value));
        snapshot.put(prefix + "backup.guard", "foreign");
        snapshot.put(prefix + PciTopologyProfile.OBSERVED_KEY, "foreign");
        PciTopologyDetails.inheritSourceProfile(vm, PciTopologyDetails.sourceProfile(snapshot, prefix), details);
        assertEquals(4, stored.size());
        assertEquals("retain", stored.get("backup.guard"));
        assertFalse(stored.containsKey(PciTopologyProfile.OBSERVED_KEY));
    }
}
