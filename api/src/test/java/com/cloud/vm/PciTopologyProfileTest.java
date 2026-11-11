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
package com.cloud.vm;

import java.util.HashMap;
import java.util.Map;
import com.cloud.cpu.CPU.CPUArch;
import org.junit.Test;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertThrows;

public class PciTopologyProfileTest {
    @Test public void roundTripCopiesOnlyOwnedKeysWithoutMutatingInput() {
        Map<String, String> source = new HashMap<>(Map.of("UEFI", "LEGACY", "rootDiskController", "scsi"));
        Map<String, String> stored = PciTopologyProfile.WINDOWS_Q35_16.withDetails(source);
        assertNull(PciTopologyProfile.fromDetails(source));
        assertEquals(PciTopologyProfile.WINDOWS_Q35_16, PciTopologyProfile.fromDetails(stored));
        assertEquals("scsi", stored.get("rootDiskController"));
        assertEquals(2, source.size());
    }

    @Test public void unknownAndPartialVersionsCannotSilentlyChooseAnotherAbi() {
        for (Map<String, String> invalid : java.util.List.of(
                Map.of(PciTopologyProfile.VERSION_KEY, "1"),
                Map.of(PciTopologyProfile.PROFILE_KEY, "foreign", PciTopologyProfile.VERSION_KEY, "1"),
                Map.of(PciTopologyProfile.PROFILE_KEY, PciTopologyProfile.LEGACY_AUTO.id()),
                Map.of(PciTopologyProfile.PROFILE_KEY, PciTopologyProfile.LEGACY_AUTO.id(), PciTopologyProfile.VERSION_KEY, "2"))) {
            assertThrows(IllegalArgumentException.class, () -> PciTopologyProfile.fromDetails(invalid));
        }
    }

    @Test public void newIsoInstallationsSelectTheOsCompatibleProfile() {
        assertEquals(PciTopologyProfile.WINDOWS_Q35_16, PciTopologyProfile.fromDetails(
                creation(Map.of(), Map.of(), false, true, CPUArch.amd64, "Windows Server 2025")));
        assertEquals(PciTopologyProfile.Q35_HOTPLUG_32, PciTopologyProfile.fromDetails(
                creation(Map.of(), Map.of(), false, true, CPUArch.amd64, "Rocky Linux 9")));
    }

    @Test public void legacyImagesAndExplicitPoliciesDoNotAcquireNewHardware() {
        assertNull(PciTopologyProfile.fromDetails(creation(Map.of(), Map.of(), false, false, CPUArch.amd64, "Windows")));
        for (String policy : new String[] {"legacy", "reserved32"}) {
            Map<String, String> recorded = Map.of(VmDetailConstants.KVM_Q35_PCIE_TOPOLOGY, policy);
            assertNull(PciTopologyProfile.fromDetails(creation(recorded, Map.of(), false, true, CPUArch.amd64, "Windows")));
            assertNull(PciTopologyProfile.fromDetails(creation(Map.of(), recorded, false, true, CPUArch.amd64, "Windows")));
        }
    }

    @Test public void sourceDisksCannotInheritAnUnrelatedTemplateProfile() {
        Map<String, String> windows = PciTopologyProfile.WINDOWS_Q35_16.withDetails(Map.of());
        assertNull(PciTopologyProfile.fromDetails(creation(windows, Map.of(), true, false, CPUArch.amd64, "Linux")));
        assertEquals(PciTopologyProfile.WINDOWS_Q35_16, PciTopologyProfile.fromDetails(
                creation(Map.of(), windows, true, false, CPUArch.amd64, "Windows")));
        assertEquals(PciTopologyProfile.WINDOWS_Q35_16, PciTopologyProfile.fromDetails(
                creation(windows, Map.of(), false, false, CPUArch.amd64, "Windows")));
        assertNull(PciTopologyProfile.fromDetails(creation(windows,
                Map.of(VmDetailConstants.KVM_Q35_PCIE_TOPOLOGY, "legacy"), false, false, CPUArch.amd64, "Windows")));
    }

    @Test public void biosAndNonX86GuestsDoNotReceiveAQ35Profile() {
        assertNull(PciTopologyProfile.fromDetails(creation(Map.of(), Map.of(), false, true, CPUArch.arm64, "Linux")));
        Map<String, String> bios = new HashMap<>();
        PciTopologyProfile.prepareCreationDetails(bios, Map.of(), Map.of(), false, true, CPUArch.amd64, "Windows");
        assertNull(PciTopologyProfile.fromDetails(bios));
    }

    @Test public void snapshotProfileReachesTheDeploymentDetails() {
        var command = new org.apache.cloudstack.api.command.user.vm.DeployVMCmd();
        command.setSourceBootProfile(PciTopologyProfile.WINDOWS_Q35_16.withDetails(
                Map.of("sourceid", "source", "sourcekind", "snapshot", "boottype", "UEFI", "bootmode", "LEGACY")));
        assertEquals(PciTopologyProfile.WINDOWS_Q35_16, PciTopologyProfile.fromDetails(command.getDetails()));
    }

    private Map<String, String> creation(Map<String, String> template, Map<String, String> requested,
            boolean existingDisks, boolean iso, CPUArch arch, String os) {
        Map<String, String> details = new HashMap<>(Map.of("UEFI", "LEGACY"));
        details.putAll(template);
        details.putAll(requested);
        details.put(VmDetailConstants.KVM_Q35_PCIE_TOPOLOGY,
                KvmQ35PcieTopology.forCreation(template, requested, existingDisks, iso).value());
        PciTopologyProfile.prepareCreationDetails(details, template, requested, existingDisks, iso, arch, os);
        return details;
    }
}
