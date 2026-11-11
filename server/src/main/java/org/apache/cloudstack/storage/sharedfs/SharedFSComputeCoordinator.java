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
// specific language govening permissions and limitations
// under the License.

package org.apache.cloudstack.storage.sharedfs;

import java.util.Date;
import java.util.Map;
import java.util.Objects;
import java.util.TreeMap;
import javax.inject.Inject;

import com.cloud.agent.AgentManager;
import com.cloud.agent.api.Answer;
import com.cloud.agent.api.SharedFSComputeAnswer;
import com.cloud.agent.api.SharedFSComputeCommand;
import com.cloud.agent.api.StorageServiceHostAnswer;
import com.cloud.agent.api.StorageServiceHostCommand;
import com.cloud.capacity.CapacityManager;
import com.cloud.capacity.dao.CapacityDao;
import com.cloud.dc.DataCenter;
import com.cloud.dc.dao.DataCenterDao;
import com.cloud.exception.ResourceAllocationException;
import com.cloud.host.HostVO;
import com.cloud.host.dao.HostDao;
import com.cloud.hypervisor.Hypervisor.HypervisorType;
import com.cloud.offering.ServiceOffering;
import com.cloud.service.ServiceOfferingVO;
import com.cloud.service.dao.ServiceOfferingDao;
import com.cloud.storage.Storage;
import com.cloud.storage.Storage.ProvisioningType;
import com.cloud.storage.VMTemplateVO;
import com.cloud.storage.Volume;
import com.cloud.storage.VolumeVO;
import com.cloud.storage.dao.VMTemplateDao;
import com.cloud.storage.dao.VolumeDao;
import com.cloud.user.Account;
import com.cloud.user.AccountManager;
import com.cloud.user.ResourceLimitService;
import com.cloud.user.dao.AccountDao;
import com.cloud.utils.db.GlobalLock;
import com.cloud.utils.db.Transaction;
import com.cloud.utils.db.TransactionCallback;
import com.cloud.utils.exception.CloudRuntimeException;
import com.cloud.vm.UserVmManager;
import com.cloud.vm.UserVmVO;
import com.cloud.vm.VirtualMachine;
import com.cloud.vm.VirtualMachineManager;
import com.cloud.vm.dao.UserVmDao;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import org.apache.cloudstack.api.command.user.storage.sharedfs.ChangeSharedFSServiceOfferingCmd;
import org.apache.cloudstack.context.CallContext;
import org.apache.cloudstack.framework.jobs.AsyncJobExecutionContext;
import org.apache.cloudstack.reservation.dao.ReservationDao;
import org.apache.cloudstack.storage.dataservice.StorageServiceInstanceVO;
import org.apache.cloudstack.storage.dataservice.dao.StorageServiceInstanceDao;
import org.apache.cloudstack.storage.dataservice.dao.StorageServiceRuntimeUpgradeDao;
import org.apache.cloudstack.storage.sharedfs.dao.SharedFSComputeOperationDao;
import org.apache.cloudstack.storage.sharedfs.dao.SharedFSDao;
import org.apache.commons.codec.digest.DigestUtils;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

public class SharedFSComputeCoordinator {
    private static final Logger LOGGER = LogManager.getLogger(SharedFSComputeCoordinator.class);
    private static final long PLAN_TTL = 120_000;
    private static final long DIMM_MIB = 4096;
    private static final long BLOCK_BYTES = 128 * 1024 * 1024;

    @Inject SharedFSComputeOperationDao operations;
    @Inject StorageServiceInstanceDao instances;
    @Inject StorageServiceRuntimeUpgradeDao upgrades;
    @Inject SharedFSDao sharedFiles;
    @Inject UserVmDao vms;
    @Inject VolumeDao volumes;
    @Inject HostDao hosts;
    @Inject DataCenterDao zones;
    @Inject VMTemplateDao templates;
    @Inject ServiceOfferingDao offerings;
    @Inject AccountManager accounts;
    @Inject AccountDao accountDao;
    @Inject UserVmManager userVmManager;
    @Inject VirtualMachineManager vmManager;
    @Inject AgentManager agents;
    @Inject ResourceLimitService limits;
    @Inject ReservationDao quota;
    @Inject CapacityDao capacities;
    @Inject CapacityManager capacityManager;

    public JsonObject status(long sharedFsId, Long offeringId, Map<String, String> custom, String requestId) {
        SharedFSVO fs = accessible(sharedFsId);
        if (requestId != null) {
            SharedFSComputeOperationVO operation = operations.findByRequest(fs.getId(), requestId);
            require(operation != null, "COMPUTE_OPERATION_NOT_FOUND");
            return operationStatus(operation);
        }
        try {
            Context context = context(fs);
            String owner = context.instance.getActiveLifecycleOperationUuid();
            if (owner != null) {
                SharedFSComputeOperationVO active = operations.findByUuid(owner);
                require(active != null && active.getSharedFsId() == fs.getId(), "COMPUTE_LIFECYCLE_ACTIVE");
                return operationStatus(active);
            }
            JsonObject result = new JsonObject();
            result.addProperty("state", "READY");
            result.addProperty("currentcpu", context.current.getCpu());
            result.addProperty("currentmemory", context.current.getRamSize());
            result.addProperty("currentspeed", context.current.getSpeed());
            JsonObject observation = observeHost(context);
            JsonObject guest = observeGuest(context);
            checkInitialObservation(context, observation, guest);
            result.addProperty("maxcpu", observation.get("maxCpus").getAsInt());
            result.addProperty("maxmemory", observation.get("maxMemoryKiB").getAsLong() / 1024);
            if (offeringId != null) {
                long expires = System.currentTimeMillis() + PLAN_TTL;
                JsonObject plan = makePlan(context, offeringId, custom, observation, guest, expires);
                result.addProperty("state", "PLANNED");
                result.addProperty("planfingerprint", fingerprint(plan));
                result.addProperty("planexpires", expires);
                result.addProperty("targetcpu", plan.get("targetCpu").getAsInt());
                result.addProperty("targetmemory", plan.get("targetMemory").getAsInt());
            }
            return result;
        } catch (CloudRuntimeException error) {
            JsonObject result = new JsonObject();
            result.addProperty("state", "BLOCKED");
            result.addProperty("reason", safeCode(error));
            return result;
        }
    }

    public SharedFSVO execute(ChangeSharedFSServiceOfferingCmd command) {
        SharedFSVO fs = accessible(command.getId());
        String requestId = command.getRequestId();
        String approved = command.getPlanFingerprint();
        require(requestId != null && requestId.matches("[A-Za-z0-9_-]{1,64}")
                && approved != null && approved.matches("[0-9a-f]{64}"), "COMPUTE_APPROVAL_REQUIRED");
        GlobalLock lock = GlobalLock.getInternLock("sharedfs-deletion-" + fs.getId());
        try {
            require(lock.lock(1), "COMPUTE_LIFECYCLE_ACTIVE");
            try {
                return run(fs.getId(), command, requestId, approved);
            } finally {
                lock.unlock();
            }
        } finally {
            lock.releaseRef();
        }
    }

    private SharedFSVO run(long sharedFsId, ChangeSharedFSServiceOfferingCmd command, String requestId, String approved) {
        SharedFSVO fs = accessible(sharedFsId);
        SharedFSComputeOperationVO operation = operations.findByRequest(sharedFsId, requestId);
        if (operation != null) {
            checkReplay(operation, command, approved);
            if ("COMMITTED".equals(operation.getState())) {
                return fs;
            }
            require(!"FAILED_UNCHANGED".equals(operation.getState()), operation.getFirstFailure());
        }
        Context context = context(fs);
        if (operation == null) {
            long now = System.currentTimeMillis();
            require(command.getPlanExpires() != null && command.getPlanExpires() >= now
                    && command.getPlanExpires() <= now + PLAN_TTL, "COMPUTE_PLAN_EXPIRED");
            JsonObject observed = observeHost(context);
            JsonObject guest = observeGuest(context);
            checkInitialObservation(context, observed, guest);
            JsonObject plan = makePlan(context, command.getServiceOfferingId(), command.getCustomComputeParameters(),
                    observed, guest, command.getPlanExpires());
            require(approved.equals(fingerprint(plan)), "COMPUTE_PLAN_CHANGED");
            operation = reserve(context, requestId, approved, plan);
            context = context(fs);
        }
        return reconcile(context, operation);
    }

    private Context context(SharedFSVO fs) {
        require(fs.getVmId() != null, "COMPUTE_VM_UNAVAILABLE");
        UserVmVO vm = vms.findById(fs.getVmId());
        require(vm != null && UserVmManager.SHAREDFSVM.equals(vm.getUserVmType()), "COMPUTE_VM_IDENTITY_CHANGED");
        require(fs.getState() == SharedFS.State.Ready && vm.getState() == VirtualMachine.State.Running
                && vm.getHostId() != null, "COMPUTE_VM_NOT_RUNNING");
        require(HypervisorType.KVM.equals(vm.getHypervisorType()), "COMPUTE_HYPERVISOR_UNVERIFIED");
        require(UserVmManager.EnableDynamicallyScaleVm.valueIn(vm.getDataCenterId()), "COMPUTE_ZONE_DYNAMIC_DISABLED");
        VMTemplateVO template = templates.findByIdIncludingRemoved(vm.getTemplateId());
        require(template != null && template.isDynamicallyScalable(), "COMPUTE_TEMPLATE_DYNAMIC_DISABLED");
        require(Storage.TemplateType.SHAREDFS.equals(template.getTemplateType()), "COMPUTE_TEMPLATE_NOT_DEDICATED");
        ServiceOfferingVO current = offerings.findByIdIncludingRemoved(vm.getId(), vm.getServiceOfferingId());
        require(current != null && current.isDynamicScalingEnabled() && vm.isDynamicallyScalable(),
                "COMPUTE_VM_DYNAMIC_DISABLED");
        StorageServiceInstanceVO instance = instances.findByVmId(vm.getId());
        HostVO host = hosts.findById(vm.getHostId());
        require(instance != null && host != null && Objects.equals(fs.getServiceOfferingId(), vm.getServiceOfferingId())
                && Objects.equals(instance.getServiceOfferingId(), vm.getServiceOfferingId()), "COMPUTE_BINDING_CHANGED");
        VolumeVO root = volumes.findByInstance(vm.getId()).stream()
                .filter(volume -> Volume.Type.ROOT.equals(volume.getVolumeType())).findFirst().orElse(null);
        require(root != null && (root.getProvisioningType() == ProvisioningType.SPARSE
                || root.getProvisioningType() == ProvisioningType.FAT), "COMPUTE_ROOT_PROVISIONING_UNSUPPORTED");
        return new Context(fs, instance, vm, host, template, current, root);
    }

    private SharedFSVO accessible(long id) {
        SharedFSVO fs = sharedFiles.findById(id);
        require(fs != null, "COMPUTE_SHAREDFS_NOT_FOUND");
        accounts.checkAccess(CallContext.current().getCallingAccount(), null, false, fs);
        return fs;
    }

    private JsonObject makePlan(Context context, long targetId, Map<String, String> custom,
                                JsonObject host, JsonObject guest, long expires) {
        require(context.instance.getActiveLifecycleOperationUuid() == null, "COMPUTE_LIFECYCLE_ACTIVE");
        ServiceOfferingVO target = targetOffering(context, targetId, custom);
        int cpus = target.getCpu();
        int memory = target.getRamSize();
        int oldCpus = context.current.getCpu();
        int oldMemory = context.current.getRamSize();
        require((cpus > oldCpus && memory == oldMemory && cpus <= host.get("maxCpus").getAsInt())
                || (cpus == oldCpus && memory - oldMemory == DIMM_MIB
                    && memory * 1024L <= host.get("maxMemoryKiB").getAsLong()
                    && host.getAsJsonObject("dimms").size() < host.get("slots").getAsInt()), "COMPUTE_TARGET_UNSUPPORTED");
        require(capacityManager.checkIfHostHasCpuCapability(context.host, cpus, target.getSpeed()),
                "COMPUTE_HOST_CAPABILITY_EXCEEDED");

        JsonObject plan = new JsonObject();
        plan.addProperty("targetOffering", targetId);
        plan.addProperty("targetOfferingUuid", target.getUuid());
        plan.addProperty("currentOffering", context.current.getId());
        plan.addProperty("targetCpu", cpus);
        plan.addProperty("targetMemory", memory);
        plan.addProperty("speed", target.getSpeed());
        plan.addProperty("expires", expires);
        plan.addProperty("hostId", context.host.getId());
        plan.addProperty("vmUuid", context.vm.getUuid());
        plan.addProperty("templateUuid", context.template.getUuid());
        plan.addProperty("rootUuid", context.root.getUuid());
        plan.addProperty("rootBytes", context.root.getSize());
        plan.addProperty("rootProvisioning", context.root.getProvisioningType().name());
        plan.addProperty("revision", context.instance.getConfigurationRevision());
        plan.add("custom", jsonMap(custom));
        plan.add("host", host);
        plan.add("guest", guest);
        return plan;
    }

    private ServiceOfferingVO targetOffering(Context context, long targetId, Map<String, String> custom) {
        ServiceOfferingVO requested = offerings.findById(targetId);
        require(requested != null && ServiceOffering.State.Active.equals(requested.getState())
                && requested.isDynamicScalingEnabled() && requested.isOfferHA(), "COMPUTE_OFFERING_UNSUPPORTED");
        DataCenter zone = zones.findById(context.vm.getDataCenterId());
        accounts.checkAccess(CallContext.current().getCallingAccount(), requested, zone);
        hosts.loadHostTags(context.host);
        require(context.host.checkHostServiceOfferingAndTemplateTags(requested, context.template, UserVmManager.getStrictHostTags()),
                "COMPUTE_HOST_TAGS_MISMATCH");
        if (requested.isDynamic()) {
            userVmManager.validateCustomParameters(requested, custom);
            requested = offerings.getComputeOffering(requested, custom);
        } else {
            require(custom.isEmpty(), "COMPUTE_CUSTOM_VALUES_UNSUPPORTED");
        }
        require(Objects.equals(context.current.getSpeed(), requested.getSpeed())
                && Objects.equals(context.current.getLimitCpuUse(), requested.getLimitCpuUse())
                && Objects.equals(context.current.getDiskOfferingId(), requested.getDiskOfferingId())
                && Objects.equals(context.current.getDiskOfferingStrictness(), requested.getDiskOfferingStrictness())
                && Objects.equals(context.current.getGpuCount(), requested.getGpuCount()),
                "COMPUTE_ROOT_OR_CPU_POLICY_CHANGED");
        return requested;
    }

    private SharedFSComputeOperationVO reserve(Context context, String requestId, String approved, JsonObject plan) {
        return withCapacityLock(context.host.getId(), () -> Transaction.execute((TransactionCallback<SharedFSComputeOperationVO>) status -> {
            StorageServiceInstanceVO locked = instances.lockRow(context.instance.getId(), true);
            require(locked != null && locked.getConfigurationRevision() == plan.get("revision").getAsLong()
                    && locked.getActiveLifecycleOperationUuid() == null && locked.getActiveConfigurationOperationId() == null
                    && upgrades.findActiveByInstanceId(locked.getId()) == null, "COMPUTE_LIFECYCLE_ACTIVE");
            SharedFSComputeOperationVO operation = new SharedFSComputeOperationVO();
            operation.setSharedFsId(context.fs.getId());
            operation.setInstanceId(locked.getId());
            operation.setVmId(context.vm.getId());
            operation.setHostId(context.host.getId());
            operation.setAccountId(context.fs.getAccountId());
            operation.setRequestId(requestId);
            operation.setPlanFingerprint(approved);
            operation.setState("RESERVED");
            operation.setPlanJson(plan.toString());
            long cpuDelta = plan.get("targetCpu").getAsLong() - context.current.getCpu();
            long memoryDelta = plan.get("targetMemory").getAsLong() - context.current.getRamSize();
            operation.setCpuDelta(cpuDelta * context.current.getSpeed());
            operation.setCoreDelta(cpuDelta);
            operation.setMemoryDelta(memoryDelta * 1024 * 1024);
            AsyncJobExecutionContext job = AsyncJobExecutionContext.getCurrentExecutionContext();
            if (job != null && job.getJob() != null) {
                operation.setJobId(job.getJob().getId());
            }
            try {
                ServiceOfferingVO target = targetOffering(context, plan.get("targetOffering").getAsLong(),
                        stringMap(plan.getAsJsonObject("custom")));
                Account owner = accountDao.findById(context.fs.getAccountId());
                limits.reserveSharedFSCompute(owner, operation.getUuid(), cpuDelta, memoryDelta, context.current, target, context.template);
            } catch (ResourceAllocationException error) {
                throw new CloudRuntimeException("COMPUTE_QUOTA_EXCEEDED", error);
            }
            new SharedFSComputeCapacity(capacities, capacityManager).reserve(context.host, operation);
            SharedFSComputeOperationVO persisted = operations.persist(operation);
            require(persisted != null, "COMPUTE_OPERATION_SAVE_FAILED");
            locked.setActiveLifecycleOperationUuid(persisted.getUuid());
            require(instances.update(locked.getId(), locked), "COMPUTE_LIFECYCLE_SAVE_FAILED");
            return persisted;
        }));
    }

    private SharedFSVO reconcile(Context context, SharedFSComputeOperationVO operation) {
        JsonObject plan = JsonParser.parseString(operation.getPlanJson()).getAsJsonObject();
        try {
            verifyBound(context, operation, plan);
            JsonObject beforeHost = plan.getAsJsonObject("host");
            JsonObject beforeGuest = plan.getAsJsonObject("guest");
            JsonObject liveHost = observeHost(context);
            JsonObject liveGuest = observeGuest(context);
            require(sameGuestBoot(beforeGuest, liveGuest), "COMPUTE_BOOT_OR_VM_CHANGED");

            int targetCpu = plan.get("targetCpu").getAsInt();
            long targetKiB = plan.get("targetMemory").getAsLong() * 1024;
            if (liveHost.equals(beforeHost)) {
                require(liveGuest.equals(beforeGuest), "COMPUTE_GUEST_OBSERVATION_CHANGED");
                save(operation, "HOST_APPLYING", liveHost, null);
                SharedFSComputeCommand command = new SharedFSComputeCommand(context.vm.getInstanceName(),
                        context.vm.getUuid(), operation.getUuid(), beforeGuest.get("bootId").getAsString(),
                        beforeHost, targetCpu, targetKiB);
                Answer answer = agents.easySend(context.host.getId(), command);
                if (!(answer instanceof SharedFSComputeAnswer) || !answer.getResult()) {
                    throw new CloudRuntimeException(answer == null ? "COMPUTE_HOST_RESPONSE_LOST" : answer.getDetails());
                }
                liveHost = ((SharedFSComputeAnswer)answer).getObservation();
            }
            JsonObject guestRequest = verifyHostEffect(beforeHost, liveHost, operation.getUuid(), targetCpu, targetKiB);
            save(operation, "GUEST_ONLINING", liveHost, null);
            guestRequest.addProperty("operationUuid", operation.getUuid());
            guestRequest.add("before", beforeGuest);
            JsonObject receipt = guest(context, "reconcile", guestRequest);
            require(operation.getUuid().equals(receipt.get("operationUuid").getAsString())
                    && fingerprint(guestRequest).equals(receipt.get("planSha256").getAsString()), "COMPUTE_RECEIPT_IDENTITY_CHANGED");
            JsonObject verified = receipt.getAsJsonObject("observation");
            require(sameGuestBoot(beforeGuest, verified) && verified.equals(observeGuest(context)),
                    "COMPUTE_GUEST_OBSERVATION_CHANGED");
            verifyGuestEffect(beforeGuest, verified, guestRequest, targetCpu);
            require(liveHost.equals(observeHost(context)), "COMPUTE_HOST_OBSERVATION_CHANGED");
            return settle(context, operation, plan, liveHost, receipt);
        } catch (RuntimeException error) {
            String failure = safeCode(error);
            LOGGER.warn("SharedFS compute operation {} awaits observation: {}", operation.getUuid(), failure, error);
            save(operation, "RECOVERY_REQUIRED", null, failure);
            throw new CloudRuntimeException(failure + " (" + operation.getUuid() + ")", error);
        }
    }

    private void verifyBound(Context context, SharedFSComputeOperationVO operation, JsonObject plan) {
        require(context.host.getId() == operation.getHostId() && context.vm.getId() == operation.getVmId()
                && context.instance.getId() == operation.getInstanceId()
                && context.fs.getAccountId() == operation.getAccountId()
                && operation.getUuid().equals(context.instance.getActiveLifecycleOperationUuid())
                && context.instance.getActiveConfigurationOperationId() == null
                && context.instance.getConfigurationRevision() == plan.get("revision").getAsLong()
                && context.vm.getUuid().equals(plan.get("vmUuid").getAsString())
                && context.template.getUuid().equals(plan.get("templateUuid").getAsString())
                && context.root.getUuid().equals(plan.get("rootUuid").getAsString())
                && context.root.getSize() == plan.get("rootBytes").getAsLong()
                && context.root.getProvisioningType().name().equals(plan.get("rootProvisioning").getAsString())
                && context.current.getId() == plan.get("currentOffering").getAsLong(),
                "COMPUTE_BINDING_CHANGED");
    }

    static JsonObject verifyHostEffect(JsonObject before, JsonObject after, String operationUuid, int cpus, long memoryKiB) {
        require(after != null, "COMPUTE_HOST_OBSERVATION_FAILED");
        for (String key : new String[] {"domainId", "diskFingerprint", "maxCpus", "maxMemoryKiB", "slots"}) {
            require(Objects.equals(before.get(key), after.get(key)), "COMPUTE_HOST_IDENTITY_CHANGED");
        }
        JsonObject oldCpus = before.getAsJsonObject("cpus");
        JsonObject newCpus = after.getAsJsonObject("cpus");
        JsonObject oldDimms = before.getAsJsonObject("dimms");
        JsonObject newDimms = after.getAsJsonObject("dimms");
        require(after.get("memoryKiB").getAsLong() == memoryKiB && newCpus.size() == cpus,
                "COMPUTE_HOST_TARGET_NOT_REACHED");
        require(containsAll(newCpus, oldCpus) && containsAll(newDimms, oldDimms), "COMPUTE_EXISTING_HARDWARE_CHANGED");
        JsonObject guestRequest = new JsonObject();
        if (oldCpus.size() != cpus) {
            require(oldDimms.equals(newDimms), "COMPUTE_MEMORY_UNEXPECTED");
            JsonArray cores = new JsonArray();
            newCpus.keySet().stream().filter(core -> !oldCpus.has(core)).sorted().forEach(core -> {
                JsonObject slot = newCpus.getAsJsonObject(core);
                require(slot.get("qom-path").getAsString().endsWith("/vcpu" + core), "COMPUTE_CPU_HOST_TOPOLOGY_UNVERIFIED");
                cores.add(Integer.parseInt(core));
            });
            guestRequest.add("cores", cores);
        } else {
            String alias = "ua-sharedfs-" + operationUuid;
            JsonObject dimm = newDimms.getAsJsonObject(alias);
            require(newDimms.size() == oldDimms.size() + 1 && dimm != null && !oldDimms.has(alias)
                    && dimm.get("hotplugged").getAsBoolean() && dimm.get("node").getAsInt() == 0
                    && dimm.get("size").getAsLong() == DIMM_MIB * 1024 * 1024, "COMPUTE_DIMM_IDENTITY_UNVERIFIED");
            JsonObject range = new JsonObject();
            range.add("address", dimm.get("addr"));
            range.add("bytes", dimm.get("size"));
            guestRequest.add("memory", range);
        }
        return guestRequest;
    }

    static void verifyGuestEffect(JsonObject before, JsonObject after, JsonObject request, int cpus) {
        JsonObject oldCpus = before.getAsJsonObject("cpus");
        JsonObject newCpus = after.getAsJsonObject("cpus");
        JsonObject oldBlocks = before.getAsJsonObject("blocks");
        JsonObject newBlocks = after.getAsJsonObject("blocks");
        require(containsAll(newCpus, oldCpus) && containsAll(newBlocks, oldBlocks)
                && newCpus.size() == cpus && newCpus.entrySet().stream()
                   .allMatch(row -> row.getValue().getAsJsonObject().get("online").getAsBoolean()), "COMPUTE_GUEST_PARTIAL");
        if (!request.has("memory")) {
            require(oldBlocks.equals(newBlocks), "COMPUTE_MEMORY_UNEXPECTED");
            return;
        }
        JsonObject range = request.getAsJsonObject("memory");
        long address = range.get("address").getAsLong();
        long bytes = range.get("bytes").getAsLong();
        require(address % BLOCK_BYTES == 0 && bytes == DIMM_MIB * 1024 * 1024
                && newBlocks.size() - oldBlocks.size() == bytes / BLOCK_BYTES, "COMPUTE_GUEST_MEMORY_UNVERIFIED");
        for (long index = address / BLOCK_BYTES; index < (address + bytes) / BLOCK_BYTES; index++) {
            String key = Long.toString(index);
            require(!oldBlocks.has(key) && newBlocks.has(key) && "online".equals(newBlocks.get(key).getAsString()),
                    "COMPUTE_GUEST_PARTIAL");
        }
        long usable = after.get("memoryKiB").getAsLong() - before.get("memoryKiB").getAsLong();
        require(usable >= (bytes - BLOCK_BYTES) / 1024 && usable <= bytes / 1024, "COMPUTE_MEMORY_TOTAL_MISMATCH");
    }

    private static boolean containsAll(JsonObject actual, JsonObject baseline) {
        return baseline.entrySet().stream().allMatch(row -> row.getValue().equals(actual.get(row.getKey())));
    }

    private static boolean sameGuestBoot(JsonObject before, JsonObject after) {
        return after != null && before.get("bootId").equals(after.get("bootId"))
                && before.get("vmUuid").equals(after.get("vmUuid")) && before.get("profile").equals(after.get("profile"));
    }

    private static void checkInitialObservation(Context context, JsonObject host, JsonObject guest) {
        checkInitialObservation(context.vm, context.current, host, guest);
    }

    private static void checkInitialObservation(UserVmVO vm, ServiceOfferingVO offering, JsonObject host, JsonObject guest) {
        JsonObject cpus = guest.getAsJsonObject("cpus");
        require(offering != null && vm.getUuid().equals(guest.get("vmUuid").getAsString())
                && "kvm-x86-64-acpi-v1".equals(guest.get("profile").getAsString())
                && cpus.size() == offering.getCpu() && host.getAsJsonObject("cpus").size() == offering.getCpu()
                && host.get("memoryKiB").getAsLong() == offering.getRamSize() * 1024L
                && cpus.entrySet().stream().allMatch(row -> row.getValue().getAsJsonObject().get("online").getAsBoolean()),
                "COMPUTE_BASELINE_UNVERIFIED");
    }

    private SharedFSVO settle(Context original, SharedFSComputeOperationVO operation, JsonObject plan,
                              JsonObject host, JsonObject receipt) {
        return withCapacityLock(original.host.getId(), () -> Transaction.execute((TransactionCallback<SharedFSVO>) status -> {
            SharedFSComputeOperationVO lockedOperation = operations.lockRow(operation.getId(), true);
            require(lockedOperation != null && !"COMMITTED".equals(lockedOperation.getState()), "COMPUTE_OPERATION_ALREADY_SETTLED");
            StorageServiceInstanceVO lockedInstance = instances.lockRow(original.instance.getId(), true);
            require(lockedInstance != null && operation.getUuid().equals(lockedInstance.getActiveLifecycleOperationUuid()),
                    "COMPUTE_LIFECYCLE_CHANGED");
            SharedFSVO lockedFs = sharedFiles.lockRow(original.fs.getId(), true);
            require(lockedFs != null, "COMPUTE_SHAREDFS_NOT_FOUND");
            require(vms.lockRow(original.vm.getId(), true) != null, "COMPUTE_VM_UNAVAILABLE");
            Context context = context(lockedFs);
            verifyBound(context, operation, plan);
            ServiceOfferingVO target = targetOffering(context, plan.get("targetOffering").getAsLong(),
                    stringMap(plan.getAsJsonObject("custom")));
            require(target.getCpu().equals(plan.get("targetCpu").getAsInt())
                    && target.getRamSize().equals(plan.get("targetMemory").getAsInt())
                    && target.getSpeed().equals(plan.get("speed").getAsInt()), "COMPUTE_OFFERING_CHANGED");
            require(vmManager.upgradeVmDb(context.vm.getId(), target, context.current), "COMPUTE_VM_OFFERING_WRITE_FAILED");
            lockedFs.setServiceOfferingId(target.getId());
            require(sharedFiles.update(lockedFs.getId(), lockedFs), "COMPUTE_SHAREDFS_OFFERING_WRITE_FAILED");
            lockedInstance.setServiceOfferingId(target.getId());
            lockedInstance.setActiveLifecycleOperationUuid(null);
            require(instances.update(lockedInstance.getId(), lockedInstance), "COMPUTE_INSTANCE_OFFERING_WRITE_FAILED");
            limits.updateVmResourceCountForServiceOfferingChange(operation.getAccountId(), context.vm.isDisplay(),
                    context.current.getCpu().longValue(), target.getCpu().longValue(),
                    context.current.getRamSize().longValue(), target.getRamSize().longValue(),
                    context.current, target, context.template);
            require(quota.removeForSharedFSCompute(operation.getUuid()) > 0, "COMPUTE_QUOTA_RESERVATION_MISSING");
            new SharedFSComputeCapacity(capacities, capacityManager).settle(context.host, operation, true);
            JsonObject verified = new JsonObject();
            verified.add("host", host);
            verified.add("receipt", receipt);
            save(lockedOperation, "COMMITTED", verified, null);
            return lockedFs;
        }));
    }

    private void save(SharedFSComputeOperationVO operation, String state, JsonObject observation, String failure) {
        operation.setState(state);
        operation.setUpdated(new Date());
        if (observation != null) {
            operation.setObservedJson(observation.toString());
        }
        if (failure != null && operation.getFirstFailure() == null) {
            operation.setFirstFailure(failure);
        }
        require(operations.update(operation.getId(), operation), "COMPUTE_OPERATION_SAVE_FAILED");
    }

    static void requireSparseAllocation(ProvisioningType type) {
        require(type == ProvisioningType.SPARSE || type == ProvisioningType.FAT, "COMPUTE_PROVISIONING_UNSUPPORTED");
    }

    void verifyPreparedVm(UserVmVO vm, String templateUuid) {
        require(vm != null && vm.getHostId() != null && vm.getState() == VirtualMachine.State.Running
                && vm.isDynamicallyScalable(), "COMPUTE_VM_DYNAMIC_DISABLED");
        VMTemplateVO template = templates.findById(vm.getTemplateId());
        require(template != null && templateUuid.equals(template.getUuid()) && template.isDynamicallyScalable()
                && Storage.TemplateType.SHAREDFS.equals(template.getTemplateType()), "COMPUTE_TEMPLATE_NOT_DEDICATED");
        volumes.findByInstance(vm.getId()).forEach(volume -> requireSparseAllocation(volume.getProvisioningType()));
        ServiceOfferingVO offering = offerings.findByIdIncludingRemoved(vm.getId(), vm.getServiceOfferingId());
        JsonObject host = observeHost(vm);
        JsonObject guest = guest(vm, "inspect", new JsonObject()).getAsJsonObject("observation");
        checkInitialObservation(vm, offering, host, guest);
        require(host.get("maxCpus").getAsInt() > offering.getCpu()
                && host.get("maxMemoryKiB").getAsLong() - host.get("memoryKiB").getAsLong() >= DIMM_MIB * 1024
                && host.get("slots").getAsInt() > host.getAsJsonObject("dimms").size(), "COMPUTE_HEADROOM_UNAVAILABLE");
    }

    private JsonObject observeHost(Context context) {
        return observeHost(context.vm);
    }

    private JsonObject observeHost(UserVmVO vm) {
        Answer answer = agents.easySend(vm.getHostId(), new SharedFSComputeCommand(vm.getInstanceName(), vm.getUuid()));
        require(answer instanceof SharedFSComputeAnswer && answer.getResult(),
                answer == null ? "COMPUTE_HOST_UNREACHABLE" : answer.getDetails());
        return ((SharedFSComputeAnswer)answer).getObservation();
    }

    private JsonObject observeGuest(Context context) {
        return guest(context, "inspect", new JsonObject()).getAsJsonObject("observation");
    }

    private JsonObject guest(Context context, String action, JsonObject request) {
        return guest(context.vm, action, request);
    }

    private JsonObject guest(UserVmVO vm, String action, JsonObject request) {
        Answer answer = agents.easySend(vm.getHostId(),
                new StorageServiceHostCommand(vm.getInstanceName(), "compute " + action, request.toString(), 140));
        require(answer instanceof StorageServiceHostAnswer, "COMPUTE_GUEST_UNREACHABLE");
        String payload = ((StorageServiceHostAnswer)answer).getResultJson();
        require(payload != null && !payload.isEmpty(), "COMPUTE_GUEST_RESPONSE_LOST");
        JsonObject result = JsonParser.parseString(payload).getAsJsonObject();
        require(answer.getResult() && result.has("success") && result.get("success").getAsBoolean(),
                result.has("errorCode") ? result.get("errorCode").getAsString() : "COMPUTE_GUEST_REJECTED");
        return result;
    }

    private static JsonObject operationStatus(SharedFSComputeOperationVO operation) {
        JsonObject plan = JsonParser.parseString(operation.getPlanJson()).getAsJsonObject();
        JsonObject result = new JsonObject();
        result.addProperty("state", operation.getState());
        result.addProperty("operationid", operation.getUuid());
        result.addProperty("requestid", operation.getRequestId());
        result.addProperty("planfingerprint", operation.getPlanFingerprint());
        result.add("targetcpu", plan.get("targetCpu"));
        result.add("serviceofferingid", plan.get("targetOfferingUuid"));
        JsonObject custom = new JsonObject();
        plan.getAsJsonObject("custom").entrySet().forEach(row -> custom.add(row.getKey().toLowerCase(java.util.Locale.ROOT), row.getValue()));
        result.add("custom", custom);
        result.add("targetmemory", plan.get("targetMemory"));
        if (operation.getFirstFailure() != null) {
            result.addProperty("reason", operation.getFirstFailure());
        }
        return result;
    }

    private static void checkReplay(SharedFSComputeOperationVO operation, ChangeSharedFSServiceOfferingCmd command, String approved) {
        JsonObject plan = JsonParser.parseString(operation.getPlanJson()).getAsJsonObject();
        require(approved.equals(operation.getPlanFingerprint()) && plan.get("targetOffering").getAsLong() == command.getServiceOfferingId()
                && plan.getAsJsonObject("custom").equals(jsonMap(command.getCustomComputeParameters())), "COMPUTE_REQUEST_CONFLICT");
    }

    private static JsonObject jsonMap(Map<String, String> values) {
        JsonObject result = new JsonObject();
        new TreeMap<>(values).forEach(result::addProperty);
        return result;
    }

    private static Map<String, String> stringMap(JsonObject json) {
        Map<String, String> result = new TreeMap<>();
        json.entrySet().forEach(row -> result.put(row.getKey(), row.getValue().getAsString()));
        return result;
    }

    private static String fingerprint(JsonObject plan) {
        return DigestUtils.sha256Hex(canonical(plan).toString());
    }

    private static JsonElement canonical(JsonElement value) {
        if (value.isJsonObject()) {
            JsonObject sorted = new JsonObject();
            value.getAsJsonObject().keySet().stream().sorted()
                    .forEach(key -> sorted.add(key, canonical(value.getAsJsonObject().get(key))));
            return sorted;
        }
        if (value.isJsonArray()) {
            JsonArray array = new JsonArray();
            value.getAsJsonArray().forEach(item -> array.add(canonical(item)));
            return array;
        }
        return value;
    }

    private static String safeCode(RuntimeException error) {
        String reason = error.getMessage();
        return reason != null && reason.matches("COMPUTE_[A-Z_]+") ? reason : "COMPUTE_OBSERVATION_FAILED";
    }

    private static void require(boolean condition, String reason) {
        if (!condition) {
            throw new CloudRuntimeException(reason == null ? "COMPUTE_OBSERVATION_FAILED" : reason);
        }
    }

    private static <T> T withCapacityLock(long hostId, java.util.function.Supplier<T> task) {
        GlobalLock lock = SharedFSComputeCapacity.lockForHost(hostId);
        try {
            require(lock.lock(15), "COMPUTE_HOST_CAPACITY_LOCKED");
            try {
                return task.get();
            } finally {
                lock.unlock();
            }
        } finally {
            lock.releaseRef();
        }
    }

    private static final class Context {
        final SharedFSVO fs;
        final StorageServiceInstanceVO instance;
        final UserVmVO vm;
        final HostVO host;
        final VMTemplateVO template;
        final ServiceOfferingVO current;
        final VolumeVO root;

        Context(SharedFSVO fs, StorageServiceInstanceVO instance, UserVmVO vm, HostVO host,
                VMTemplateVO template, ServiceOfferingVO current, VolumeVO root) {
            this.fs = fs;
            this.instance = instance;
            this.vm = vm;
            this.host = host;
            this.template = template;
            this.current = current;
            this.root = root;
        }
    }
}
