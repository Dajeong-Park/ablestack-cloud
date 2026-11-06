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
package org.apache.cloudstack.storage.dataservice;

import com.cloud.storage.Volume;
import com.cloud.storage.VolumeVO;
import com.cloud.storage.dao.VolumeDao;
import com.cloud.utils.db.Transaction;
import com.cloud.utils.db.TransactionCallback;
import com.cloud.utils.net.NetUtils;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.google.gson.JsonPrimitive;
import java.util.Collections;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.apache.cloudstack.storage.dataservice.dao.StorageServiceInstanceDao;
import org.apache.cloudstack.storage.dataservice.dao.StorageServiceRuntimeUpgradeDao;

/** Capture committed desired state without mistaking an unobserved runtime for a successful backup. */
final class StorageConfigArtifactService {
    private static final String MISSING = "UNAVAILABLE";
    private static final String OBSERVED = "OBSERVED";
    private static final Map<String, String> RUNTIME = Map.of(
            "NFS", "nfsGaneshaRuntime", "SMB", "smbRuntime", "ISCSI", "iscsiRuntime", "NVME_OF", "nvmeofRuntime");
    private final StorageServiceInstanceDao instances;
    private final StorageServiceRuntimeUpgradeDao upgrades;
    private final VolumeDao volumes;
    private final StorageServiceGuestCommandDispatcher guest;
    private final StorageConfigArtifactStore artifacts;
    private final Function<StorageServiceInstanceVO, StorageServiceConfigurationPlan> plan;
    private final Function<StorageServiceInstanceVO, String> sharedFsUuid;
    private final Consumer<VolumeVO> volumeAccess;

    StorageConfigArtifactService(StorageServiceInstanceDao instances, StorageServiceRuntimeUpgradeDao upgrades,
            VolumeDao volumes, StorageServiceGuestCommandDispatcher guest, StorageConfigArtifactStore artifacts,
            Function<StorageServiceInstanceVO, StorageServiceConfigurationPlan> plan,
            Function<StorageServiceInstanceVO, String> sharedFsUuid, Consumer<VolumeVO> volumeAccess) {
        this.instances = instances;
        this.upgrades = upgrades;
        this.volumes = volumes;
        this.guest = guest;
        this.artifacts = artifacts;
        this.plan = plan;
        this.sharedFsUuid = sharedFsUuid;
        this.volumeAccess = volumeAccess;
    }

    private static final class Capture {
        final StorageServiceInstanceVO instance;
        final JsonObject desired;
        final String sourceFs;
        final JsonObject volumeRequest;

        Capture(StorageServiceInstanceVO instance, JsonObject desired, String sourceFs, JsonObject volumeRequest) {
            this.instance = instance;
            this.desired = desired;
            this.sourceFs = sourceFs;
            this.volumeRequest = volumeRequest;
        }
    }

    StorageConfigArtifactStore.Artifact capture(long instanceId, long creator, JsonObject commitAck, Long expectedRevision) {
        boolean lastGood = commitAck != null;
        Capture capture = Transaction.execute((TransactionCallback<Capture>) status -> {
            StorageServiceInstanceVO locked = lock(instanceId);
            if (expectedRevision != null && expectedRevision != locked.getConfigurationRevision()) {
                throw StorageConfigArchiveV1.invalid("CONFIGURATION_REVISION_CHANGED");
            }
            JsonObject tables = JsonParser.parseString(plan.apply(locked).snapshot()).getAsJsonObject();
            JsonObject desired = StorageConfigSnapshot.project(tables, id -> volumeReference(locked, volumes.findById(id)));
            JsonObject volumeRequest = volumeRequest(desired, false);
            String sourceFs = sharedFsUuid.apply(locked);
            if (!StorageConfigSnapshot.isUuid(sourceFs)) {
                throw StorageConfigArchiveV1.invalid("SHAREDFS_SOURCE_NOT_FOUND");
            }
            return new Capture(locked, desired, sourceFs, volumeRequest);
        });
        StorageServiceInstanceVO instance = capture.instance;
        JsonObject physical = observe(instance, "configuration restore-volumes show", capture.volumeRequest);
        JsonObject inventory = observe(instance, "inventory", null);
        JsonObject runtimeMeta = nested(nested(inventory, "runtimeObservability"), "fileShareVolumes");
        String boot = StorageConfigSnapshot.string(physical, "bootId");
        String inventoryBoot = StorageConfigSnapshot.string(runtimeMeta, "bootId");
        boolean bootVerified = StorageConfigSnapshot.isUuid(boot) && boot.equals(inventoryBoot);
        Set<Integer> nfsPorts = nfsWatchPorts(capture.desired);
        JsonObject nfs = bootVerified && !nfsPorts.isEmpty()
                ? observeNfsBinding(instance, nfsPorts) : new JsonObject();
        inventory.add("nfsBinding", nfs);
        JsonObject coverage = new JsonObject();
        JsonObject effective = new JsonObject();
        for (String protocol : RUNTIME.keySet()) {
            JsonObject observation = protocolObservation(capture.desired, inventory, protocol, bootVerified);
            if (bootVerified && !observation.has("bootId")) {
                observation.addProperty("bootId", boot);
                observation.addProperty("observedAt", StorageConfigSnapshot.string(physical, "observedAt"));
            }
            coverage.add(protocol, observation.get("state"));
            effective.add(protocol, observation);
        }
        if (bootVerified && physical.has("volumes")) {
            Map<String, JsonObject> observations = index(physical.getAsJsonArray("volumes"));
            for (JsonElement element : capture.desired.getAsJsonArray("volumes")) {
                JsonObject reference = element.getAsJsonObject();
                JsonObject observation = observations.get(StorageConfigSnapshot.string(reference, "uuid"));
                if (observation != null && OBSERVED.equals(StorageConfigSnapshot.string(observation, "state"))) {
                    for (String field : Set.of("serial", "filesystem", "filesystemUuid", "fsRoot", "mountSource")) {
                        if (observation.has(field)) {
                            reference.add(field, observation.get(field).deepCopy());
                        }
                    }
                }
            }
        }
        if (lastGood) {
            if (!bootVerified || !"COMMITTED".equals(StorageConfigSnapshot.string(commitAck, "state"))
                    || !instance.getUuid().equals(StorageConfigSnapshot.string(commitAck, "instanceUuid"))
                    || !commitAck.has("targetRevision") || commitAck.get("targetRevision").getAsLong() != instance.getConfigurationRevision()
                    || !boot.equals(StorageConfigSnapshot.string(commitAck, "bootId"))
                    || coverage.entrySet().stream().anyMatch(entry -> MISSING.equals(entry.getValue().getAsString()))
                    || capture.desired.getAsJsonArray("omitted").size() != 0
                    || capture.desired.getAsJsonArray("volumes").asList().stream().anyMatch(entry -> !entry.getAsJsonObject().has("serial"))) {
                return null;
            }
        }
        JsonObject metadata = new JsonObject();
        metadata.addProperty("sourceInstance", instance.getUuid());
        metadata.addProperty("sourceSharedFs", capture.sourceFs);
        metadata.addProperty("revision", instance.getConfigurationRevision());
        metadata.addProperty("createdAt", System.currentTimeMillis());
        metadata.add("coverage", coverage);
        byte[] archive = StorageConfigArchiveV1.create(metadata, capture.desired, effective);
        StorageConfigArchiveV1.Bundle bundle = StorageConfigArchiveV1.read(archive);
        StorageConfigSnapshot.validate(bundle);
        return Transaction.execute((TransactionCallback<StorageConfigArtifactStore.Artifact>) status -> {
            StorageServiceInstanceVO locked = lock(instanceId);
            if (!Objects.equals(locked.getVmId(), instance.getVmId())
                    || locked.getConfigurationRevision() != instance.getConfigurationRevision()) {
                throw StorageConfigArchiveV1.invalid("BACKUP_CONFIGURATION_CHANGED");
            }
            if (lastGood && !artifacts.retireLastGood(locked.getId(), locked.getConfigurationRevision())) {
                return null;
            }
            return artifacts.backup(locked, creator, archive, bundle.manifest, lastGood);
        });
    }

    JsonObject review(long instanceId, long user, String artifactId, String vm, Set<String> ownedIps, JsonObject mapping, Set<String> protocols) {
        StorageConfigArtifactStore.Artifact source = artifacts.find(artifactId, true);
        if ("UPLOAD".equals(source.kind) && source.creator != user) {
            throw StorageConfigArchiveV1.invalid("RESTORE_ARTIFACT_OR_TARGET_INVALID");
        }
        Capture current = Transaction.execute((TransactionCallback<Capture>) status -> {
            StorageServiceInstanceVO locked = lock(instanceId);
            JsonObject rows = JsonParser.parseString(plan.apply(locked).snapshot()).getAsJsonObject();
            JsonObject desired = StorageConfigSnapshot.project(rows, id -> volumeReference(locked, volumes.findById(id)));
            return new Capture(locked, desired, null, null);
        });
        if (current.instance.getVmId() == null) {
            throw StorageConfigArchiveV1.invalid("RESTORE_TARGET_VM_REQUIRED");
        }
        JsonObject network = new JsonObject();
        if (protocols.contains("NFS")) {
            StorageConfigArchiveV1.Bundle bundle = StorageConfigArchiveV1.read(source.body);
            StorageConfigSnapshot.validate(bundle);
            Set<Integer> watched = nfsWatchPorts(current.desired);
            watched.addAll(nfsWatchPorts(bundle.desired));
            network = observeNfsBinding(current.instance, watched);
        }
        JsonObject bootObservation = protocols.contains("NFS") ? network
                : observe(current.instance, "configuration restore-volumes show", emptyVolumeProbe());
        String boot = StorageConfigSnapshot.string(bootObservation, "bootId");
        JsonObject review = StorageConfigRestorePlanner.review(source, current.instance, vm, boot, user, current.desired, ownedIps,
                mapping, protocols, network, desired -> verifyVolumes(current.instance, desired, boot));
        verifyVolumes(current.instance, review.getAsJsonObject("desired"), boot);
        StorageConfigArtifactStore.Artifact saved = Transaction.execute((TransactionCallback<StorageConfigArtifactStore.Artifact>) status -> {
            StorageServiceInstanceVO locked = lock(instanceId);
            if (!Objects.equals(locked.getVmId(), current.instance.getVmId())
                    || locked.getConfigurationRevision() != current.instance.getConfigurationRevision()) {
                throw StorageConfigArchiveV1.invalid("RESTORE_PLAN_STALE_OR_NOT_APPROVED");
            }
            return artifacts.plan(locked, user, StorageConfigSnapshot.string(review, "source"), review);
        });
        JsonObject response = saved.response();
        response.add("diff", review.getAsJsonObject("diff"));
        response.add("addressMapping", review.getAsJsonObject("addressMapping"));
        response.add("protocols", review.getAsJsonArray("protocols"));
        if (review.has("nfsBinding")) {
            response.add("nfsBinding", review.getAsJsonObject("nfsBinding").getAsJsonArray("changes"));
        }
        return response;
    }

    private static JsonObject emptyVolumeProbe() {
        JsonObject request = new JsonObject();
        request.addProperty("requireMatch", true);
        request.add("volumes", new JsonArray());
        return request;
    }

    private static Set<Integer> nfsWatchPorts(JsonObject desired) {
        Set<Integer> ports = new java.util.TreeSet<>(StorageConfigNfsBinding.configuredPorts(desired).keySet());
        ports.addAll(StorageConfigNfsBinding.activePorts(desired).keySet());
        return ports;
    }

    JsonObject observeNfsBinding(StorageServiceInstanceVO instance, Set<Integer> ports) {
        JsonArray watched = new JsonArray();
        ports.forEach(watched::add);
        JsonObject request = new JsonObject();
        request.add("ports", watched);
        return observe(instance, "configuration nfs-binding show", request);
    }

    JsonObject verifyVolumes(StorageServiceInstanceVO target, JsonObject desired, String expectedBoot) {
        JsonObject request = volumeRequest(desired, true);
        for (JsonElement element : request.getAsJsonArray("volumes")) {
            JsonObject row = element.getAsJsonObject();
            VolumeVO current = volumes.findByUuid(StorageConfigSnapshot.string(row, "uuid"));
            JsonObject reference = volumeReference(target, current);
            if (reference.get("bytes").getAsLong() != row.get("bytes").getAsLong()
                    || !reference.get("provisioning").equals(row.get("provisioning"))) {
                throw StorageConfigArchiveV1.invalid("RESTORE_DATA_SIZE_OR_PROVISIONING_CHANGED");
            }
        }
        request.add("paths", StorageConfigFilePaths.requests(desired));
        request.add("directories", StorageConfigDirectoryBindings.requests(desired));
        JsonObject measured = observe(target, "configuration restore-volumes show", request);
        String boot = StorageConfigSnapshot.string(measured, "bootId");
        if (!StorageConfigSnapshot.isUuid(boot) || expectedBoot != null && !expectedBoot.equals(boot)
                || !measured.has("volumes") || measured.getAsJsonArray("volumes").size() != request.getAsJsonArray("volumes").size()) {
            throw StorageConfigArchiveV1.invalid("RESTORE_VOLUME_OBSERVATION_UNAVAILABLE");
        }
        StorageConfigFilePaths.requireProofs(desired, measured, boot);
        StorageConfigDirectoryBindings.proofs(desired, measured, boot);
        return measured;
    }

    private JsonObject volumeReference(StorageServiceInstanceVO instance, VolumeVO volume) {
        if (volume == null || volume.getVolumeType() != Volume.Type.DATADISK
                || volume.getState() != Volume.State.Ready || volume.getSize() == null || volume.getSize() <= 0
                || volume.getAccountId() != instance.getAccountId() || volume.getDomainId() != instance.getDomainId()
                || volume.getDataCenterId() != instance.getDataCenterId() || volume.getPoolId() == null
                || instance.getVmId() == null || !instance.getVmId().equals(volume.getInstanceId())
                || volume.getProvisioningType() == null
                || !Set.of("SPARSE", "FAT").contains(volume.getProvisioningType().name().toUpperCase(java.util.Locale.ROOT))) {
            throw StorageConfigArchiveV1.invalid("BACKING_VOLUME_NOT_READY_OR_OUT_OF_SCOPE");
        }
        volumeAccess.accept(volume);
        JsonObject result = new JsonObject();
        result.addProperty("uuid", volume.getUuid());
        result.addProperty("bytes", volume.getSize());
        result.addProperty("provisioning", volume.getProvisioningType().name().toUpperCase(java.util.Locale.ROOT));
        return result;
    }

    private StorageServiceInstanceVO lock(long id) {
        StorageServiceInstanceVO locked = instances.lockRow(id, true);
        if (locked == null || locked.getRemoved() != null) {
            throw StorageConfigArchiveV1.invalid("SHAREDFS_SOURCE_NOT_FOUND");
        }
        if (locked.getActiveConfigurationOperationId() != null || locked.getActiveLifecycleOperationUuid() != null
                || StorageServiceConfigurationPreflight.runtimeWriting(upgrades.findActiveByInstanceId(id))) {
            throw StorageConfigArchiveV1.invalid("CONFIGURATION_WRITER_ACTIVE");
        }
        return locked;
    }

    private JsonObject observe(StorageServiceInstanceVO instance, String command, JsonObject payload) {
        if (instance.getVmId() == null) {
            return new JsonObject();
        }
        try {
            StorageServiceGuestCommandResult reply = guest.dispatch(new StorageServiceGuestCommand(instance.getVmId(),
                    command, payload == null ? "" : payload.toString(), 20, Collections.emptySet()));
            return reply.isSuccess() ? StorageServiceConfigurationCoordinator.parsed(reply.getResultJson()) : new JsonObject();
        } catch (RuntimeException error) {
            return new JsonObject();
        }
    }

    static JsonObject volumeRequest(JsonObject desired, boolean strict) {
        Map<String, JsonObject> byId = index(desired.getAsJsonArray("volumes"));
        Map<String, String> uses = new LinkedHashMap<>();
        for (String key : Set.of("files", "blocks", "directories")) {
            for (JsonElement entry : desired.getAsJsonArray(key)) {
                String id = StorageConfigSnapshot.string(entry.getAsJsonObject(), "volume");
                if (!id.isEmpty()) {
                    String use = "blocks".equals(key) ? "BLOCK" : "FILE";
                    if (uses.putIfAbsent(id, use) != null && !uses.get(id).equals(use)) {
                        throw StorageConfigArchiveV1.invalid("VOLUME_FILE_BLOCK_CONFLICT");
                    }
                }
            }
        }
        JsonArray rows = new JsonArray();
        for (Map.Entry<String, JsonObject> volume : byId.entrySet()) {
            JsonObject row = volume.getValue().deepCopy();
            if (strict && !row.has("serial")) {
                throw StorageConfigArchiveV1.invalid("SOURCE_VOLUME_NOT_OBSERVED");
            }
            row.addProperty("purpose", uses.get(volume.getKey()));
            rows.add(row);
        }
        JsonObject request = new JsonObject();
        request.addProperty("requireMatch", strict);
        request.add("volumes", rows);
        return request;
    }

    private static Map<String, JsonObject> index(JsonArray rows) {
        Map<String, JsonObject> result = new LinkedHashMap<>();
        for (JsonElement element : rows) {
            JsonObject row = element.getAsJsonObject();
            result.put(StorageConfigSnapshot.string(row, "uuid"), row);
        }
        return result;
    }

    static JsonObject protocolObservation(JsonObject desired, JsonObject inventory, String protocol, boolean bootVerified) {
        JsonObject result = new JsonObject();
        List<JsonObject> enabled = desired.getAsJsonArray("listeners").asList().stream().map(JsonElement::getAsJsonObject)
                .filter(row -> protocol.equals(StorageConfigSnapshot.string(row, "protocol"))
                        && row.has("enabled") && row.get("enabled").getAsBoolean())
                .collect(Collectors.toList());
        String state = "NOT_CONFIGURED";
        if (!enabled.isEmpty() || "NFS".equals(protocol) && !StorageConfigNfsBinding.activePorts(desired).isEmpty()) {
            state = MISSING;
            if (bootVerified) {
                JsonObject runtime = nested(inventory, RUNTIME.get(protocol));
                if ("NFS".equals(protocol)) {
                    JsonObject binding = nested(inventory, "nfsBinding");
                    String boot = StorageConfigSnapshot.string(nested(nested(inventory, "runtimeObservability"), "fileShareVolumes"), "bootId");
                    try {
                        JsonArray ports = StorageConfigNfsBinding.observed(desired, binding, boot);
                        String timestamp = StorageConfigSnapshot.string(binding, "observedAt");
                        if (!timestamp.isEmpty()) {
                            result.add("bindings", ports);
                            result.addProperty("bootId", boot);
                            result.addProperty("observedAt", timestamp);
                            state = OBSERVED;
                        }
                    } catch (com.cloud.exception.InvalidParameterValueException unavailable) {
                        state = MISSING;
                    }
                } else if ("SMB".equals(protocol)) {
                    Optional<JsonArray> listeners = observeSmbListeners(enabled, runtime);
                    if (listeners.isPresent()) {
                        state = OBSERVED;
                        result.add("resources", listeners.get());
                    }
                } else if (listening(runtime)) {
                    state = OBSERVED;
                }
            }
        }
        result.addProperty("state", state);
        return result;
    }

    private static Optional<JsonArray> observeSmbListeners(List<JsonObject> enabled, JsonObject runtime) {
        if (!new JsonPrimitive(true).equals(runtime.get("configured"))
                || !new JsonPrimitive(false).equals(runtime.get("pending"))
                || !runtime.has("listeners") || !runtime.get("listeners").isJsonArray()) {
            return Optional.empty();
        }
        JsonArray listeners = runtime.getAsJsonArray("listeners");
        if (listeners.size() != enabled.size()) {
            return Optional.empty();
        }
        Map<String, JsonObject> observed = new LinkedHashMap<>();
        for (JsonElement element : listeners) {
            if (!element.isJsonObject()) {
                return Optional.empty();
            }
            JsonObject listener = element.getAsJsonObject();
            String id = StorageConfigSnapshot.string(listener, "id");
            if (!StorageConfigSnapshot.isUuid(id) || observed.putIfAbsent(id, listener) != null) {
                return Optional.empty();
            }
        }

        Set<String> bindings = new HashSet<>();
        JsonArray verified = new JsonArray();
        for (JsonObject expected : enabled) {
            String id = StorageConfigSnapshot.string(expected, "uuid");
            JsonObject listener = observed.get(id);
            String address = StorageConfigSnapshot.string(expected, "listenIp").trim();
            if (address.isEmpty()) {
                address = "0.0.0.0";
            }
            long port = expected.has("port") ? listenerPort(expected.get("port")) : 445;
            if (listener == null || !NetUtils.isValidIp4(address) || port < 1
                    || !bindings.add(address + ":" + port)
                    || !address.equals(StorageConfigSnapshot.string(listener, "listenIp"))
                    || port != listenerPort(listener.get("port"))) {
                return Optional.empty();
            }
            String state = StorageConfigSnapshot.string(listener, "state");
            if (!"READY".equals(state) && !("COVERED".equals(state)
                    && smbWildcardCovers(listener, observed, address, port))) {
                return Optional.empty();
            }
            JsonObject resource = new JsonObject();
            resource.addProperty("resource", id);
            resource.addProperty("address", address);
            resource.addProperty("port", port);
            resource.addProperty("state", state);
            verified.add(resource);
        }
        return Optional.of(verified);
    }

    private static boolean smbWildcardCovers(JsonObject listener, Map<String, JsonObject> observed, String address, long port) {
        JsonObject wildcard = observed.get(StorageConfigSnapshot.string(listener, "coveredBy"));
        return !"0.0.0.0".equals(address) && wildcard != null
                && "READY".equals(StorageConfigSnapshot.string(wildcard, "state"))
                && "0.0.0.0".equals(StorageConfigSnapshot.string(wildcard, "listenIp"))
                && port == listenerPort(wildcard.get("port"));
    }

    private static long listenerPort(JsonElement value) {
        if (!StorageConfigSnapshot.isInteger(value)) {
            return -1;
        }
        long port = value.getAsLong();
        return port >= 1 && port <= 65535 ? port : -1;
    }

    private static JsonObject nested(JsonObject value, String field) {
        return value.has(field) && value.get(field).isJsonObject() ? value.getAsJsonObject(field) : new JsonObject();
    }

    private static boolean listening(JsonObject runtime) {
        return runtime.has("listening") && runtime.get("listening").isJsonPrimitive()
                && runtime.get("listening").getAsJsonPrimitive().isBoolean() && runtime.get("listening").getAsBoolean();
    }
}
