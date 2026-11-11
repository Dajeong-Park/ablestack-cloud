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
// KIND, either express or implied. See the License for the
// specific language governing permissions and limitations
// under the License.
package com.cloud.vm;

import java.util.HashMap;
import java.util.Map;

import com.cloud.agent.api.to.VirtualMachineTO;
import com.cloud.hypervisor.Hypervisor.HypervisorType;
import com.cloud.uservm.UserVm;
import com.cloud.utils.db.Transaction;
import com.cloud.utils.db.TransactionCallback;
import com.cloud.vm.dao.VMInstanceDetailsDao;
import com.google.gson.Gson;
import org.apache.cloudstack.api.ApiConstants;
import org.apache.cloudstack.backup.BackupVO;
import org.apache.cloudstack.backup.dao.BackupDao;
import org.junit.Before;
import org.junit.Test;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

public class PciTopologyCompatibilityTest {
    private final Map<String, String> stored = new HashMap<>();
    private VMInstanceDetailsDao details;
    private VMInstanceVO vm;

    @Before public void setup() {
        details = mock(VMInstanceDetailsDao.class);
        when(details.listDetailsKeyPairs(1L)).thenAnswer(call -> new HashMap<>(stored));
        doAnswer(call -> {
            stored.put(call.getArgument(1), call.getArgument(2));
            return null;
        }).when(details).addDetail(eq(1L), anyString(), anyString(), anyBoolean());
        doAnswer(call -> {
            stored.remove(call.getArgument(1));
            return null;
        }).when(details).removeDetail(eq(1L), anyString());
        stored.put(VmDetailConstants.DEPLOY_VM, "true");
        stored.put("rootDiskController", "scsi");
        vm = mock(VMInstanceVO.class);
        when(vm.getId()).thenReturn(1L);
        when(vm.getType()).thenReturn(VirtualMachine.Type.User);
        when(vm.getHypervisorType()).thenReturn(HypervisorType.KVM);
    }

    @Test public void recordedLegacyPoliciesWinOverAStaleRequestEvenAtFirstStart() {
        for (String policy : new String[] {"legacy", "reserved32"}) {
            stored.put(VmDetailConstants.KVM_Q35_PCIE_TOPOLOGY, policy);
            VirtualMachineTO request = request();
            request.setDetails(PciTopologyProfile.WINDOWS_Q35_16.withDetails(Map.of("UEFI", "LEGACY",
                    VmDetailConstants.KVM_Q35_PCIE_TOPOLOGY, "legacy")));
            PciTopologyDetails.prepareStartProfile(request, vm, details);
            assertNull(PciTopologyProfile.fromDetails(request.getDetails()));
            assertEquals(policy, request.getDetails().get(VmDetailConstants.KVM_Q35_PCIE_TOPOLOGY));
            assertEquals("true", request.getDetails().get(PciTopologyProfile.PRESERVE_EXISTING_KEY));
        }
        verify(details, never()).addDetail(eq(1L), anyString(), anyString(), anyBoolean());
    }

    @Test public void aSavedWindows16ProfileAndCanonicalMachineSurviveRestart() {
        stored.putAll(PciTopologyProfile.WINDOWS_Q35_16.withDetails(Map.of(
                VmDetailConstants.KVM_Q35_PCIE_TOPOLOGY, "reserved32",
                VmDetailConstants.KVM_GUEST_OS_MACHINE_TYPE, "pc-q35-rhel9.8.0")));
        VirtualMachineTO request = request();
        PciTopologyDetails.prepareStartProfile(request, vm, details);
        assertEquals(PciTopologyProfile.WINDOWS_Q35_16, PciTopologyProfile.fromDetails(request.getDetails()));
        assertEquals("pc-q35-rhel9.8.0", request.getDetails().get(VmDetailConstants.KVM_GUEST_OS_MACHINE_TYPE));
        assertNull(request.getDetails().get(PciTopologyProfile.PRESERVE_EXISTING_KEY));
    }

    @Test public void oldBackupsKeepCapturedOrVerifiedSourcePoliciesInsteadOfAcquiringANewProfile() {
        for (String policy : new String[] {"legacy", "reserved32"}) {
            for (boolean captured : new boolean[] {false, true}) {
                stored.put(VmDetailConstants.KVM_Q35_PCIE_TOPOLOGY, captured ? "legacy" : policy);
                Map<String, String> settings = new HashMap<>(Map.of("UEFI", "LEGACY",
                        VmDetailConstants.KVM_GUEST_OS_MACHINE_TYPE, "pc-q35-rhel9.6.0"));
                if (captured) settings.put(VmDetailConstants.KVM_Q35_PCIE_TOPOLOGY, policy);
                inherit(settings);
                assertEquals(policy, stored.get(VmDetailConstants.KVM_Q35_PCIE_TOPOLOGY));
                assertNull(PciTopologyProfile.fromDetails(stored));
                VirtualMachineTO restored = request();
                PciTopologyDetails.prepareStartProfile(restored, vm, details);
                assertEquals(policy, restored.getDetails().get(VmDetailConstants.KVM_Q35_PCIE_TOPOLOGY));
                assertEquals("true", restored.getDetails().get(PciTopologyProfile.PRESERVE_EXISTING_KEY));
            }
        }
    }

    @Test public void versionedBackupRestoresItsOriginal16PortProfileAndMachineVersion() {
        stored.put(VmDetailConstants.KVM_Q35_PCIE_TOPOLOGY, "reserved32");
        inherit(PciTopologyProfile.WINDOWS_Q35_16.withDetails(Map.of(
                VmDetailConstants.KVM_Q35_PCIE_TOPOLOGY, "reserved32",
                VmDetailConstants.KVM_GUEST_OS_MACHINE_TYPE, "pc-q35-rhel9.8.0")));
        assertEquals(PciTopologyProfile.WINDOWS_Q35_16, PciTopologyProfile.fromDetails(stored));
        assertEquals("pc-q35-rhel9.8.0", stored.get(VmDetailConstants.KVM_GUEST_OS_MACHINE_TYPE));
        assertEquals("scsi", stored.get("rootDiskController"));
    }

    private VirtualMachineTO request() {
        VirtualMachineTO request = new VirtualMachineTO(1, "i-2-1-VM", VirtualMachine.Type.User,
                4, 1000, 8192, 8192, null, "Windows Server 2025", false, false, null);
        request.setDetails(Map.of("UEFI", "LEGACY"));
        return request;
    }

    private void inherit(Map<String, String> settings) {
        BackupDao backups = mock(BackupDao.class);
        BackupVO backup = mock(BackupVO.class);
        when(backups.findById(1L)).thenReturn(backup);
        when(backup.getDetail(ApiConstants.VM_SETTINGS)).thenReturn(new Gson().toJson(settings));
        UserVm target = mock(UserVm.class);
        when(target.getId()).thenReturn(1L);
        when(target.getHypervisorType()).thenReturn(HypervisorType.KVM);
        try (var transactions = mockStatic(Transaction.class)) {
            transactions.when(() -> Transaction.execute(any(TransactionCallback.class)))
                    .thenAnswer(call -> ((TransactionCallback<?>) call.getArgument(0)).doInTransaction(null));
            PciTopologyDetails.inheritBackupProfile(target, 1L, backups, details);
        }
    }
}
