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
package com.cloud.vm;

import java.util.HashMap;
import java.util.Map;
import com.cloud.hypervisor.Hypervisor.HypervisorType;
import com.cloud.vm.dao.UserVmDao;
import com.cloud.vm.dao.VMInstanceDetailsDao;
import org.junit.Before;
import org.junit.Test;
import org.springframework.test.util.ReflectionTestUtils;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

public class ClonePciTopologyInheritanceTest {
    private final UserVmManagerImpl manager = new UserVmManagerImpl();
    private final VMInstanceDetailsDao details = mock(VMInstanceDetailsDao.class);
    private final Map<String, String> sourceDetails = new HashMap<>();

    @Before public void setup() {
        UserVmDao vms = mock(UserVmDao.class);
        UserVmVO source = mock(UserVmVO.class);
        when(source.getHypervisorType()).thenReturn(HypervisorType.KVM);
        when(vms.findById(77L)).thenReturn(source);
        when(details.listDetailsKeyPairs(77L)).thenReturn(sourceDetails);
        ReflectionTestUtils.setField(manager, "_vmDao", vms);
        ReflectionTestUtils.setField(manager, "vmInstanceDetailsDao", details);
    }

    @Test public void oldQ35CloneUsesLegacyAutoWithoutChangingItsSource() {
        sourceDetails.put("UEFI", "LEGACY");
        sourceDetails.put("clone.fast.phase", "READY");
        Map<String, String> before = new HashMap<>(sourceDetails);
        Map<String, String> clone = manager.getCloneVmCustomParameters(77L);
        assertEquals(PciTopologyProfile.LEGACY_AUTO, PciTopologyProfile.fromDetails(clone));
        assertFalse(clone.containsKey("clone.fast.phase"));
        assertEquals(before, sourceDetails);
    }

    @Test public void cloneKeepsTheFrozenProfileAndMachineType() {
        sourceDetails.putAll(PciTopologyProfile.WINDOWS_Q35_16.withDetails(
                Map.of(VmDetailConstants.KVM_GUEST_OS_MACHINE_TYPE, "pc-q35-rhel9.4.0")));
        Map<String, String> clone = manager.getCloneVmCustomParameters(77L);
        assertEquals(PciTopologyProfile.WINDOWS_Q35_16, PciTopologyProfile.fromDetails(clone));
        assertEquals("pc-q35-rhel9.4.0", clone.get(VmDetailConstants.KVM_GUEST_OS_MACHINE_TYPE));
    }
}
