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
package com.cloud.template;

import java.util.HashMap;
import java.util.Map;
import com.cloud.hypervisor.Hypervisor.HypervisorType;
import com.cloud.storage.Snapshot;
import com.cloud.storage.Volume;
import com.cloud.storage.dao.SnapshotDetailsDao;
import com.cloud.storage.dao.VolumeDetailsDao;
import com.cloud.vm.PciTopologyProfile;
import com.cloud.vm.VmCreationSourceService;
import com.cloud.vm.VmDetailConstants;
import org.junit.Before;
import org.junit.Test;
import org.springframework.test.util.ReflectionTestUtils;
import static org.junit.Assert.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

public class TemplatePciTopologyInheritanceTest {
    private final TemplateManagerImpl manager = new TemplateManagerImpl();
    private final SnapshotDetailsDao snapshots = mock(SnapshotDetailsDao.class);
    private final VolumeDetailsDao volumes = mock(VolumeDetailsDao.class);
    private final Volume volume = mock(Volume.class);
    private final Snapshot snapshot = mock(Snapshot.class);

    @Before public void setup() {
        ReflectionTestUtils.setField(manager, "pciSnapshotDetailsDao", snapshots);
        ReflectionTestUtils.setField(manager, "pciVolumeDetailsDao", volumes);
        when(volume.getId()).thenReturn(1L);
        when(volume.getInstanceId()).thenReturn(77L);
        when(volume.getVolumeType()).thenReturn(Volume.Type.ROOT);
        when(snapshot.getId()).thenReturn(2L);
    }

    private Map<String, String> recorded() {
        Map<String, String> metadata = new HashMap<>();
        PciTopologyProfile.LEGACY_AUTO.withDetails(Map.of(VmDetailConstants.KVM_GUEST_OS_MACHINE_TYPE, "pc-q35-rhel9.4.0"))
                .forEach((key, value) -> metadata.put(VmCreationSourceService.PREFIX + key, value));
        return metadata;
    }

    @Test public void rootSnapshotProfileWinsOverTheCurrentSourceVmProfile() {
        when(snapshots.listDetailsKeyPairs(2L)).thenReturn(recorded());
        Map<String, String> details = PciTopologyProfile.WINDOWS_Q35_16.withDetails(Map.of("UEFI", "LEGACY"));
        manager.inheritSourcePciTopology(details, HypervisorType.KVM, volume, snapshot);
        assertEquals(PciTopologyProfile.LEGACY_AUTO, PciTopologyProfile.fromDetails(details));
        assertEquals("pc-q35-rhel9.4.0", details.get(VmDetailConstants.KVM_GUEST_OS_MACHINE_TYPE));
        assertEquals("LEGACY", details.get("UEFI"));
    }

    @Test public void detachedRootVolumeUsesItsCapturedProfile() {
        when(volume.getInstanceId()).thenReturn(null);
        when(volumes.listDetailsKeyPairs(1L)).thenReturn(recorded());
        Map<String, String> details = PciTopologyProfile.WINDOWS_Q35_16.withDetails(Map.of("UEFI", "LEGACY"));
        manager.inheritSourcePciTopology(details, HypervisorType.KVM, volume, null);
        assertEquals(PciTopologyProfile.LEGACY_AUTO, PciTopologyProfile.fromDetails(details));
    }

    @Test public void historicalQ35SnapshotDoesNotBorrowTheCurrentVmProfile() {
        when(snapshots.listDetailsKeyPairs(2L)).thenReturn(Map.of());
        Map<String, String> details = PciTopologyProfile.WINDOWS_Q35_16.withDetails(Map.of("UEFI", "LEGACY"));
        manager.inheritSourcePciTopology(details, HypervisorType.KVM, volume, snapshot);
        assertEquals(PciTopologyProfile.LEGACY_AUTO, PciTopologyProfile.fromDetails(details));
    }

    @Test public void attachedRootVolumeKeepsItsCurrentFrozenProfile() {
        Map<String, String> details = PciTopologyProfile.WINDOWS_Q35_16.withDetails(Map.of("UEFI", "LEGACY"));
        manager.inheritSourcePciTopology(details, HypervisorType.KVM, volume, null);
        assertEquals(PciTopologyProfile.WINDOWS_Q35_16, PciTopologyProfile.fromDetails(details));
        verifyNoInteractions(snapshots, volumes);
    }

    @Test public void unrelatedDetachedVolumeDetailsDoNotReplaceTheTemplateProfile() {
        when(volume.getInstanceId()).thenReturn(null);
        when(volumes.listDetailsKeyPairs(1L)).thenReturn(Map.of("allocation.mode", "THIN"));
        Map<String, String> details = PciTopologyProfile.WINDOWS_Q35_16.withDetails(Map.of("UEFI", "LEGACY"));
        manager.inheritSourcePciTopology(details, HypervisorType.KVM, volume, null);
        assertEquals(PciTopologyProfile.WINDOWS_Q35_16, PciTopologyProfile.fromDetails(details));
    }

    @Test public void dataDisksAndOtherHypervisorsDoNotChangeTheTargetProfile() {
        Map<String, String> details = PciTopologyProfile.WINDOWS_Q35_16.withDetails(Map.of());
        Map<String, String> before = new HashMap<>(details);
        manager.inheritSourcePciTopology(details, HypervisorType.VMware, volume, snapshot);
        when(volume.getVolumeType()).thenReturn(Volume.Type.DATADISK);
        manager.inheritSourcePciTopology(details, HypervisorType.KVM, volume, snapshot);
        assertEquals(before, details);
        verifyNoInteractions(snapshots, volumes);
    }
}
