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

import java.util.Map;
import java.util.HashMap;
import java.util.Objects;
import com.cloud.agent.api.to.VirtualMachineTO;
import com.cloud.hypervisor.Hypervisor.HypervisorType;
import com.cloud.uservm.UserVm;
import com.cloud.utils.db.Transaction;
import com.cloud.utils.exception.CloudRuntimeException;
import com.cloud.vm.dao.VMInstanceDao;
import com.cloud.vm.dao.VMInstanceDetailsDao;
import com.google.gson.Gson;
import com.google.gson.reflect.TypeToken;
import org.apache.cloudstack.api.ApiConstants;
import org.apache.cloudstack.backup.BackupVO;
import org.apache.cloudstack.backup.dao.BackupDao;

/** Writes only the two owned keys; all other VM details remain untouched. */
public final class PciTopologyDetails {
    private PciTopologyDetails() { }

    public static void prepareStartProfile(VirtualMachineTO request, VMInstanceVO vm, VMInstanceDetailsDao details) {
        if (vm.getHypervisorType() != HypervisorType.KVM || vm.getType() != VirtualMachine.Type.User) return;
        Map<String, String> merged = new HashMap<>(request.getDetails() == null ? Map.of() : request.getDetails());
        merged.remove(PciTopologyProfile.OBSERVED_KEY);
        merged.remove(PciTopologyProfile.OBSERVED_MACHINE_KEY);
        merged.remove(PciTopologyProfile.PRESERVE_EXISTING_KEY);
        Map<String, String> stored = details.listDetailsKeyPairs(vm.getId());
        PciTopologyProfile saved = PciTopologyProfile.fromDetails(stored);
        if (saved != null) {
            merged = saved.withDetails(merged);
            String pinnedMachine = stored.get(VmDetailConstants.KVM_GUEST_OS_MACHINE_TYPE);
            if (pinnedMachine != null) merged.put(VmDetailConstants.KVM_GUEST_OS_MACHINE_TYPE, pinnedMachine);
        }
        boolean q35 = PciTopologyProfile.q35Requested(merged);
        boolean x86 = request.getArch() == null || "x86_64".equals(request.getArch()) || "i686".equals(request.getArch());
        if (!q35 || !x86) {
            if (saved != null) throw new CloudRuntimeException("PCI_TOPOLOGY_MACHINE_CHANGED: stored q35 profile cannot change machine family");
            request.setDetails(merged);
            return;
        }
        if (saved == null && !"true".equals(stored.get(VmDetailConstants.DEPLOY_VM))) {
            // Untagged existing instances retain the previous rendering contract.
            merged.put(PciTopologyProfile.PRESERVE_EXISTING_KEY, "true");
            request.setDetails(merged);
            return;
        }
        PciTopologyProfile selected = saved;
        if (selected == null) {
            selected = request.getOs() != null && request.getOs().toLowerCase(java.util.Locale.ROOT).startsWith("windows")
                    ? PciTopologyProfile.WINDOWS_Q35_16 : PciTopologyProfile.Q35_HOTPLUG_32;
            PciTopologyProfile chosen = selected;
            Transaction.execute((com.cloud.utils.db.TransactionCallback<Object>) status -> { save(vm.getId(), chosen, details); return null; });
        }
        request.setDetails(selected.withDetails(merged));
    }

    public static void saveStartedProfile(VirtualMachineTO answer, VMInstanceDao instances, VMInstanceDetailsDao details) {
        if (answer == null) return;
        PciTopologyProfile profile = PciTopologyProfile.fromDetails(answer.getDetails());
        if (profile == null) return;
        VMInstanceVO vm = instances.findById(answer.getId());
        if (vm != null && (vm.getHypervisorType() != HypervisorType.KVM || vm.getType() != VirtualMachine.Type.User)) return;
        if (vm == null || !Objects.equals(vm.getUuid(), answer.getUuid())) {
            throw new CloudRuntimeException("PCI_TOPOLOGY_BINDING_CHANGED: start answer does not match the KVM instance");
        }
        String observed = answer.getDetails().get(PciTopologyProfile.OBSERVED_KEY);
        String observedMachine = answer.getDetails().get(PciTopologyProfile.OBSERVED_MACHINE_KEY);
        if (observed == null || observedMachine == null || !observed.startsWith(profile.id() + ":")
                || !("q35".equals(observedMachine) || observedMachine.startsWith("pc-q35-"))) {
            throw new CloudRuntimeException("PCI_TOPOLOGY_HOST_UNVERIFIED: aligned KVM agent required");
        }
        int ports;
        try { ports = Integer.parseInt(observed.substring(observed.lastIndexOf(':') + 1)); }
        catch (NumberFormatException error) { throw new CloudRuntimeException("PCI_TOPOLOGY_HOST_UNVERIFIED", error); }
        if (ports < 0 || (profile != PciTopologyProfile.LEGACY_AUTO && ports != profile.rootPorts())) {
            throw new CloudRuntimeException("PCI_TOPOLOGY_HOST_UNVERIFIED: observed port count differs");
        }
        Transaction.execute((com.cloud.utils.db.TransactionCallback<Object>) status -> {
            Map<String, String> previous = details.listDetailsKeyPairs(vm.getId());
            PciTopologyProfile saved = PciTopologyProfile.fromDetails(previous);
            if (saved != null && saved != profile) {
                throw new CloudRuntimeException("PCI_TOPOLOGY_PROFILE_CHANGED: host cannot replace the stored guest ABI");
            }
            save(vm.getId(), profile, details);
            String requestedMachine = previous.get(VmDetailConstants.KVM_GUEST_OS_MACHINE_TYPE);
            if (requestedMachine != null && !"q35".equals(requestedMachine) && !requestedMachine.equals(observedMachine)) {
                throw new CloudRuntimeException("PCI_TOPOLOGY_MACHINE_CHANGED: observed machine differs");
            }
            details.addDetail(vm.getId(), VmDetailConstants.KVM_GUEST_OS_MACHINE_TYPE, observedMachine, false);
            return null;
        });
    }

    public static void inheritBackupProfile(UserVm target, long backupId, BackupDao backups, VMInstanceDetailsDao details) {
        if (target == null || target.getHypervisorType() != HypervisorType.KVM) return;
        BackupVO backup = backups.findById(backupId);
        if (backup == null) throw new CloudRuntimeException("PCI_TOPOLOGY_BACKUP_MISSING");
        backups.loadDetails(backup);
        Map<String, String> settings = new HashMap<>();
        String json = backup.getDetail(ApiConstants.VM_SETTINGS);
        if (json != null && !json.isBlank()) {
            Map<String, String> stored = new Gson().fromJson(json, new TypeToken<Map<String, String>>() { }.getType());
            if (stored != null) settings.putAll(stored);
        }
        PciTopologyProfile profile = PciTopologyProfile.fromDetails(settings);
        if (profile == null && !PciTopologyProfile.q35Requested(settings)) return;
        // Pre-profile q35 backups must not acquire today's hotplug topology on restore.
        PciTopologyProfile restored = profile == null ? PciTopologyProfile.LEGACY_AUTO : profile;
        String sourceMachine = settings.get(VmDetailConstants.KVM_GUEST_OS_MACHINE_TYPE);
        if (sourceMachine != null && !("q35".equals(sourceMachine) || sourceMachine.startsWith("pc-q35-"))) {
            throw new CloudRuntimeException("PCI_TOPOLOGY_BACKUP_INVALID: q35 profile conflicts with source machine");
        }
        Transaction.execute((com.cloud.utils.db.TransactionCallback<Object>) status -> {
            save(target.getId(), restored, details);
            if (sourceMachine != null) details.addDetail(target.getId(), VmDetailConstants.KVM_GUEST_OS_MACHINE_TYPE, sourceMachine, false);
            return null;
        });
    }

    private static void save(long id, PciTopologyProfile profile, VMInstanceDetailsDao details) {
        details.addDetail(id, PciTopologyProfile.PROFILE_KEY, profile.id(), false);
        details.addDetail(id, PciTopologyProfile.VERSION_KEY, PciTopologyProfile.VERSION, false);
    }
}
