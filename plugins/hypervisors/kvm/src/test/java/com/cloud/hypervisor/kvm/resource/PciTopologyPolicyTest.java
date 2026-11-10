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
package com.cloud.hypervisor.kvm.resource;

import com.cloud.agent.api.to.VirtualMachineTO;
import com.cloud.vm.VirtualMachine;
import com.cloud.vm.PciTopologyProfile;
import java.util.Map;
import org.junit.Test;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertThrows;
import static org.junit.Assert.assertTrue;

public class PciTopologyPolicyTest {
    private VirtualMachineTO guest(String os) {
        VirtualMachineTO spec = new VirtualMachineTO(1, "i-2-1-VM", VirtualMachine.Type.User,
                4, 1000, 8192, 8192, null, os, false, false, null);
        spec.setDetails(Map.of("UEFI", "LEGACY"));
        return spec;
    }

    private String devices(int nics, int disks) {
        StringBuilder xml = new StringBuilder("<domain><os><type arch='x86_64' machine='pc-q35-rhel9.8.0'>hvm</type></os><devices>"
                + "<controller type='usb' model='qemu-xhci'/><controller type='scsi' model='virtio-scsi'>"
                + "<address type='pci' bus='0' slot='9' function='0'/></controller><channel type='unix'/>"
                + "<video><model type='virtio'/></video>");
        for (int i=0;i<nics;i++) xml.append("<interface type='bridge'><model type='virtio'/></interface>");
        for (int i=0;i<disks;i++) xml.append("<disk><target bus='scsi'/></disk>");
        return xml.append("</devices></domain>").toString();
    }

    @Test public void windowsPlanMeetsNicHeadroomAndScsiDisksShareAController() {
        var first = PciTopologyPolicy.plan(guest("Windows Server 2025 (64-bit)"), devices(1, 1));
        var more = PciTopologyPolicy.plan(guest("Windows Server 2025 (64-bit)"), devices(1, 12));
        assertEquals(PciTopologyProfile.WINDOWS_Q35_16, first.profile());
        assertEquals(first.bootPortDemand(), more.bootPortDemand());
        assertTrue(first.rootPorts() - first.bootPortDemand() >= 3);
        assertThrows(IllegalArgumentException.class,
                () -> PciTopologyPolicy.plan(guest("Windows Server 2025"), devices(15, 1)));
    }

    @Test public void savedProfileWinsAndUnsafeWindowsProfileIsNotAccepted() {
        VirtualMachineTO linux = guest("Rocky Linux 9");
        assertEquals(PciTopologyProfile.Q35_HOTPLUG_32, PciTopologyPolicy.plan(linux, devices(1, 1)).profile());
        linux.setDetails(PciTopologyProfile.WINDOWS_Q35_16.withDetails(linux.getDetails()));
        assertEquals(PciTopologyProfile.WINDOWS_Q35_16, PciTopologyPolicy.plan(linux, devices(1, 1)).profile());
        var windows = guest("Windows Server 2025");
        windows.setDetails(PciTopologyProfile.Q35_HOTPLUG_32.withDetails(windows.getDetails()));
        assertThrows(IllegalArgumentException.class, () -> PciTopologyPolicy.plan(windows, devices(1, 1)));
    }

    @Test public void restoredLegacyAndUntaggedExistingGuestsDoNotAcquireNewPorts() {
        VirtualMachineTO restored = guest("Windows Server 2025");
        restored.setDetails(PciTopologyProfile.LEGACY_AUTO.withDetails(restored.getDetails()));
        var plan = PciTopologyPolicy.plan(restored, devices(1, 1));
        LibvirtVMDef vm = domain();
        vm.setPciTopologyPlan(plan);
        String xml = vm.toString();
        assertEquals(0, PciTopologyInspector.rootPorts(PciTopologyInspector.parse(xml)));
        PciTopologyPolicy.validateFinalXml(plan, xml);
        assertEquals(xml, vm.toString());
        restored.setDetails(Map.of(PciTopologyProfile.PRESERVE_EXISTING_KEY, "true"));
        assertNull(PciTopologyPolicy.plan(restored, devices(1, 1)));
        assertNull(PciTopologyPolicy.plan(guest("Windows"), devices(1, 1).replace("pc-q35-rhel9.8.0", "pc-i440fx-rhel7.6.0")));
    }

    @Test public void completeModelRendersOnePlanAndRejectsTransformedTopology() {
        LibvirtVMDef vm = domain();
        var plan = PciTopologyPolicy.plan(guest("Windows Server 2025"), vm);
        vm.setPciTopologyPlan(plan);
        String xml = vm.toString();
        PciTopologyPolicy.validateFinalXml(plan, xml);
        assertEquals(xml, vm.toString());
        assertEquals(16, PciTopologyInspector.rootPorts(PciTopologyInspector.parse(xml)));
        assertThrows(IllegalArgumentException.class,
                () -> PciTopologyPolicy.validateFinalXml(plan, xml.replaceFirst("<controller type='pci' model='pcie-root-port'/>", "")));
    }

    @Test public void systemVmDoesNotAcquireAUserVmPolicy() {
        VirtualMachineTO router = new VirtualMachineTO(1,"r-1-VM",VirtualMachine.Type.DomainRouter,
                2,1000,1024,1024,null,"Debian",false,false,null);
        assertNull(PciTopologyPolicy.plan(router, devices(1,1)));
    }

    private LibvirtVMDef domain() {
        LibvirtVMDef vm = new LibvirtVMDef();
        vm.setHvsType("kvm");vm.setDomainName("topology-contract");
        var guest = new LibvirtVMDef.GuestDef();
        guest.setGuestType(LibvirtVMDef.GuestDef.GuestType.KVM);guest.setMachineType("q35");
        var devices = new LibvirtVMDef.DevicesDef();devices.setGuestType(LibvirtVMDef.GuestDef.GuestType.KVM);
        vm.addComp(guest);vm.addComp(devices);
        return vm;
    }
}
