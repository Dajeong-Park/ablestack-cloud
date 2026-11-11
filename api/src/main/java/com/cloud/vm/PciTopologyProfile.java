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

/** Versioned guest ABI choice shared by VM start and backup metadata. */
public enum PciTopologyProfile {
    WINDOWS_Q35_16("q35-windows-16-v1", 16),
    Q35_HOTPLUG_32("q35-hotplug-32-v1", 32),
    LEGACY_AUTO("q35-legacy-auto-v1", 0);

    public static final String PROFILE_KEY = "kvm.pcie.topology.profile";
    public static final String VERSION_KEY = "kvm.pcie.topology.version";
    public static final String VERSION = "1";
    public static final String PRESERVE_EXISTING_KEY = "kvm.pcie.topology.preserve.existing";
    public static final String OBSERVED_KEY = "kvm.pcie.topology.observed";
    public static final String OBSERVED_MACHINE_KEY = "kvm.pcie.topology.observed.machine";
    private final String id;
    private final int rootPorts;

    PciTopologyProfile(String id, int rootPorts) {
        this.id = id;
        this.rootPorts = rootPorts;
    }

    public String id() { return id; }
    public int rootPorts() { return rootPorts; }

    public static PciTopologyProfile fromDetails(Map<String, String> details) {
        if (details == null || !details.containsKey(PROFILE_KEY)) {
            if (details != null && details.containsKey(VERSION_KEY)) {
                throw new IllegalArgumentException("PCI_TOPOLOGY_PROFILE_INVALID: missing profile");
            }
            return null;
        }
        if (!VERSION.equals(details.get(VERSION_KEY))) {
            throw new IllegalArgumentException("PCI_TOPOLOGY_PROFILE_INVALID: unsupported version");
        }
        for (PciTopologyProfile profile : values()) {
            if (profile.id.equals(details.get(PROFILE_KEY))) return profile;
        }
        throw new IllegalArgumentException("PCI_TOPOLOGY_PROFILE_INVALID: unknown profile");
    }

    public static boolean q35Requested(Map<String, String> details) {
        if (details == null) return false;
        String machine = details.get(VmDetailConstants.KVM_GUEST_OS_MACHINE_TYPE);
        return machine == null ? details.containsKey("UEFI") : "q35".equals(machine) || machine.startsWith("pc-q35-");
    }

    /** Preserve image/source ABI choices; only an unconfigured ISO installation receives a new default. */
    public static void prepareCreationDetails(Map<String, String> details, Map<String, String> template,
            Map<String, String> requested, boolean existingDisks, boolean installingFromIso, CPUArch arch, String os) {
        PciTopologyProfile selected = fromDetails(requested);
        if (selected == null && !existingDisks
                && (requested == null || !requested.containsKey(VmDetailConstants.KVM_Q35_PCIE_TOPOLOGY))) {
            selected = fromDetails(template);
            if (selected == null && installingFromIso
                    && (template == null || !template.containsKey(VmDetailConstants.KVM_Q35_PCIE_TOPOLOGY))) {
                selected = os != null && os.toLowerCase(java.util.Locale.ROOT).startsWith("windows")
                        ? WINDOWS_Q35_16 : Q35_HOTPLUG_32;
            }
        }
        // A restore/import must not inherit a profile from an unrelated provisioning template.
        details.remove(PROFILE_KEY);
        details.remove(VERSION_KEY);
        details.remove(PRESERVE_EXISTING_KEY);
        details.remove(OBSERVED_KEY);
        details.remove(OBSERVED_MACHINE_KEY);
        boolean x86 = arch == null || arch == CPUArch.x86 || arch == CPUArch.amd64;
        if (selected != null && x86 && q35Requested(details)) {
            details.put(PROFILE_KEY, selected.id());
            details.put(VERSION_KEY, VERSION);
        }
    }

    public Map<String, String> withDetails(Map<String, String> original) {
        Map<String, String> details = original == null ? new HashMap<>() : new HashMap<>(original);
        details.put(PROFILE_KEY, id);
        details.put(VERSION_KEY, VERSION);
        return details;
    }
}
