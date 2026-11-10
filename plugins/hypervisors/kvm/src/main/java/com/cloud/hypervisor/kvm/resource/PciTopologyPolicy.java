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

import java.util.Locale;
import com.cloud.agent.api.to.VirtualMachineTO;
import com.cloud.vm.PciTopologyProfile;

/** Select an explicit guest compatibility profile before rendering final XML. */
public final class PciTopologyPolicy {
    private static final int EXTRA_NIC_PORTS = 3;
    private PciTopologyPolicy() { }

    public static PciTopologyPlan plan(VirtualMachineTO spec, LibvirtVMDef vm) {
        if (!"kvm".equalsIgnoreCase(vm.getHvsType())) return null;
        if (vm.getGuestDefinition() == null || vm.getDevices() == null) return null;
        return plan(spec, "<domain>" + vm.getGuestDefinition().toString() + vm.getDevices().bootstrapDevicesXml() + "</domain>");
    }

    public static PciTopologyPlan plan(VirtualMachineTO spec, String draftXml) {
        if (spec.getType() != com.cloud.vm.VirtualMachine.Type.User) return null;
        var document = PciTopologyInspector.parse(draftXml);
        if (!PciTopologyInspector.q35(document)) return null;
        if (spec.getDetails() != null && "true".equals(spec.getDetails().get(PciTopologyProfile.PRESERVE_EXISTING_KEY))) return null;
        PciTopologyProfile profile = PciTopologyProfile.fromDetails(spec.getDetails());
        if (profile == null) {
            String os = spec.getOs() == null ? "" : spec.getOs().toLowerCase(Locale.ROOT);
            profile = os.startsWith("windows") ? PciTopologyProfile.WINDOWS_Q35_16 : PciTopologyProfile.Q35_HOTPLUG_32;
        }
        if (spec.getOs() != null && spec.getOs().toLowerCase(Locale.ROOT).startsWith("windows")
                && profile == PciTopologyProfile.Q35_HOTPLUG_32) {
            throw new IllegalArgumentException("PCI_TOPOLOGY_PROFILE_UNSUPPORTED: Windows q35 requires its compatible profile");
        }
        int demand = PciTopologyInspector.bootPortDemand(document);
        if (profile != PciTopologyProfile.LEGACY_AUTO) demand++; // planned PCIe-to-PCI bridge
        int reserve = profile == PciTopologyProfile.LEGACY_AUTO ? 0 : EXTRA_NIC_PORTS;
        return new PciTopologyPlan(profile, demand, reserve);
    }

    public static void validateFinalXml(PciTopologyPlan plan, String xml) {
        if (plan == null) return;
        var document = PciTopologyInspector.parse(xml);
        if (!PciTopologyInspector.q35(document) || PciTopologyInspector.rootPorts(document) != plan.rootPorts()) {
            throw new IllegalArgumentException("PCI_TOPOLOGY_HOOK_CHANGED: machine or root-port plan changed");
        }
        PciTopologyInspector.validateAddresses(document);
        if (plan.profile() != PciTopologyProfile.LEGACY_AUTO
                && PciTopologyInspector.bootPortDemand(document) + plan.nicHeadroom() > plan.rootPorts()) {
            throw new IllegalArgumentException("PCI_TOPOLOGY_CAPACITY: final devices exceed the selected profile");
        }
    }
}
