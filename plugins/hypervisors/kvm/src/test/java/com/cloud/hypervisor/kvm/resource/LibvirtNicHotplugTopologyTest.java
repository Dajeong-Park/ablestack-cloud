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

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class LibvirtNicHotplugTopologyTest {
    private String domain(
            String machine,
            String emulator,
            LibvirtVMDef.GuestDef.GuestType type,
            boolean reverse) {
        LibvirtVMDef vm = new LibvirtVMDef();
        vm.setHvsType("kvm");
        vm.setDomainName("nic-test");
        LibvirtVMDef.GuestDef guest = new LibvirtVMDef.GuestDef();
        guest.setGuestType(type);
        guest.setMachineType(machine);
        LibvirtVMDef.DevicesDef devices = new LibvirtVMDef.DevicesDef();
        devices.setGuestType(type);
        devices.setEmulatorPath(emulator);
        if (reverse) {
            vm.addComp(devices);
            vm.addComp(guest);
        } else {
            vm.addComp(guest);
            vm.addComp(devices);
        }
        String xml = vm.toString();
        assertEquals(xml, vm.toString());
        return xml;
    }

    private int ports(String xml) {
        return xml.split("model='pcie-root-port'", -1).length - 1;
    }

    @Test
    public void x86Q35ReservesPortsBeyondBootDevices() {
        String xml =
                domain("q35", "/usr/libexec/qemu-kvm", LibvirtVMDef.GuestDef.GuestType.KVM, false);
        assertEquals(32, ports(xml));
        assertTrue(xml.contains("model='pcie-root'"));
        assertTrue(xml.contains("model='pcie-to-pci-bridge'"));
    }

    @Test
    public void canonicalVersionedQ35AlsoReservesPorts() {
        assertEquals(
                32,
                ports(
                        domain(
                                "pc-q35-rhel9.8.0",
                                "/usr/libexec/qemu-kvm",
                                LibvirtVMDef.GuestDef.GuestType.KVM,
                                false)));
    }

    @Test
    public void componentInsertionOrderCannotLoseMachineType() {
        assertEquals(32, ports(domain("q35", null, LibvirtVMDef.GuestDef.GuestType.KVM, true)));
    }

    @Test
    public void i440fxPciTopologyIsUnchanged() {
        assertEquals(
                0,
                ports(
                        domain(
                                "pc-i440fx-rhel7.6.0",
                                "/usr/libexec/qemu-kvm",
                                LibvirtVMDef.GuestDef.GuestType.KVM,
                                false)));
    }

    @Test
    public void pcDefaultIsUnchanged() {
        assertEquals(
                0,
                ports(
                        domain(
                                "pc",
                                "/usr/libexec/qemu-kvm",
                                LibvirtVMDef.GuestDef.GuestType.KVM,
                                false)));
    }

    @Test
    public void lxcDoesNotReceiveX86PcieControllers() {
        assertEquals(
                0,
                ports(
                        domain(
                                "q35",
                                "/usr/bin/qemu-system-x86_64",
                                LibvirtVMDef.GuestDef.GuestType.LXC,
                                false)));
    }

    @Test
    public void aarch64ExistingPortsAreNotDuplicated() {
        assertEquals(
                32,
                ports(
                        domain(
                                "virt",
                                "/usr/bin/qemu-system-aarch64",
                                LibvirtVMDef.GuestDef.GuestType.KVM,
                                false)));
    }

    @Test
    public void s390xExistingPortsAreUnchanged() {
        assertEquals(
                32,
                ports(
                        domain(
                                "virt",
                                "/usr/bin/qemu-system-s390x",
                                LibvirtVMDef.GuestDef.GuestType.KVM,
                                false)));
    }
}
