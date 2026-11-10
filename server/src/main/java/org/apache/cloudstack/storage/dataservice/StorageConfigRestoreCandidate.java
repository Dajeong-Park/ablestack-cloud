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

import com.cloud.storage.VolumeVO;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.apache.cloudstack.storage.dataservice.StorageServiceInstance.AccessResourceType;
import org.apache.cloudstack.storage.dataservice.StorageServiceInstance.Permission;
import org.apache.cloudstack.storage.dataservice.StorageServiceInstance.PrincipalType;
import org.apache.cloudstack.storage.dataservice.StorageServiceInstance.Protocol;
import org.apache.cloudstack.storage.dataservice.StorageServiceInstance.ResourceState;
import org.apache.cloudstack.storage.dataservice.dao.StorageAccessRuleDao;
import org.apache.cloudstack.storage.dataservice.dao.StorageBlockTargetDao;
import org.apache.cloudstack.storage.dataservice.dao.StorageDirectoryPolicyDao;
import org.apache.cloudstack.storage.dataservice.dao.StorageFileShareDao;
import org.apache.cloudstack.storage.dataservice.dao.StorageServiceProtocolDao;

import static org.apache.cloudstack.storage.dataservice.StorageConfigSnapshot.string;

/** Stages the approved portable rows in the normal configuration writer. */
final class StorageConfigRestoreCandidate {
    private final StorageServiceManagerImpl manager;
    private final StorageServiceInstanceVO instance;
    private final StorageServiceConfigurationPlan writer;
    private final Function<String, VolumeVO> volumes;
    private final Map<String, StorageDirectoryPolicyVO> policies = new HashMap<>();
    private final Set<String> adopting = new HashSet<>();
    private final Map<String, Parent> parents = new HashMap<>();
    private final Map<Long, String> passwords = new HashMap<>();
    private final Map<Long, JsonObject> chap = new HashMap<>();
    private final Map<Long, JsonObject> dhChap = new HashMap<>();

    StorageConfigRestoreCandidate(StorageServiceManagerImpl manager, StorageServiceInstanceVO instance,
            StorageServiceConfigurationPlan writer, Function<String, VolumeVO> volumes) {
        this.manager = manager;
        this.instance = instance;
        this.writer = writer;
        this.volumes = volumes;
    }

    void stage(JsonObject approved, Set<Protocol> scope, JsonObject secrets) {
        JsonObject desired = approved.getAsJsonObject("desired");
        manager.guardSmbNameRestore(instance,desired,scope);
        resolvePolicies(approved, desired.getAsJsonArray("directories"));
        Map<String, JsonObject> pathProofs = new HashMap<>();
        if (approved.has("filePathProofs")) {
            for (JsonObject row : rows(approved.getAsJsonArray("filePathProofs"))) {
                pathProofs.put(string(row, "resourceUuid"), row);
            }
        }
        rows(desired.getAsJsonArray("listeners")).forEach(this::listener);
        for (JsonObject row : rows(desired.getAsJsonArray("files"))) {
            file(row, pathProofs.get(string(row, "uuid")));
        }
        List<JsonObject> blocks = rows(desired.getAsJsonArray("blocks"));
        blocks.sort(java.util.Comparator.comparing(row -> !"subsystem".equals(string(settings(row), "type"))));
        blocks.forEach(this::block);

        StorageAccessRuleDao rules = writer.dao(StorageAccessRuleDao.class);
        for (JsonObject change : rows(approved.getAsJsonObject("diff").getAsJsonArray("aclRemovals"))) {
            StorageAccessRuleVO rule = rules.findByUuid(string(change.getAsJsonObject("before"), "uuid"));
            if (rule == null || parents.values().stream().noneMatch(p -> p.id == rule.getResourceId() && p.type == rule.getResourceType())) {
                throw invalid("RESTORE_ACL_CHANGED");
            }
            rules.remove(rule.getId());
        }
        Set<String> consumed = new HashSet<>();
        for (JsonObject row : rows(desired.getAsJsonArray("rules"))) {
            rule(row, secrets, consumed);
        }
        if (!secrets.keySet().equals(consumed)) {
            throw invalid("RESTORE_CREDENTIAL_SCOPE_INVALID");
        }
        for (Protocol protocol : Protocol.values()) {
            if (!scope.contains(protocol)) {
                continue;
            }
            switch (protocol) {
            case NFS: manager.applyNfsDesiredState(instance); break;
            case SMB: manager.applySmbDesiredState(instance, passwords); break;
            case ISCSI: manager.applyIscsiDesiredState(instance, chap); break;
            case NVME_OF: manager.applyNvmeOfDesiredState(instance, dhChap); break;
            default: throw invalid("RESTORE_PROTOCOL_SCOPE_INVALID");
            }
        }
    }

    private void resolvePolicies(JsonObject approved, JsonArray saved) {
        if (saved.size() == 0) {
            return;
        }
        StorageDirectoryPolicyDao dao = writer.dao(StorageDirectoryPolicyDao.class);
        Map<String, JsonObject> bindings = new HashMap<>();
        for (JsonObject binding : rows(StorageConfigSnapshot.array(approved.get("directoryBindings")))) {
            if (bindings.putIfAbsent(string(binding.getAsJsonObject("proof"), "resourceUuid"), binding) != null) {
                throw invalid("RESTORE_DIRECTORY_CONTRACT");
            }
        }
        for (JsonObject row : rows(saved)) {
            String source = string(row, "uuid");
            JsonObject binding = bindings.remove(source);
            if (binding == null) {
                throw invalid("RESTORE_DIRECTORY_OBSERVATION_UNAVAILABLE");
            }
            JsonObject proof = binding.getAsJsonObject("proof");
            Long volume = volume(row);
            String path = string(row, "canonicalPath");
            StorageDirectoryPolicyVO match = dao.listByInstanceId(instance.getId()).stream()
                    .filter(p -> Objects.equals(p.getVolumeId(), volume) && path.equals(p.getCanonicalPath()))
                    .findFirst().orElse(null);
            if (binding.get("adopt").getAsBoolean()) {
                if (match != null || proof.has("registryUuid")) {
                    throw invalid("RESTORE_DIRECTORY_POLICY_CHANGED");
                }
                match = new StorageDirectoryPolicyVO();
                match.setUuid(string(binding, "targetUuid"));
                match.setInstanceId(instance.getId());
                match.setVolumeId(volume);
                match.setCanonicalPath(path);
                match.setCanonicalHash(org.apache.commons.codec.digest.DigestUtils.sha256Hex(path));
                match.setOwnerUid(row.get("ownerUid").getAsLong());
                match.setOwnerGid(row.get("ownerGid").getAsLong());
                match.setMode(string(row, "mode"));
                match.setRevision(1L);
                JsonObject metadata = new JsonObject();
                metadata.add("filesystemuuid", proof.get("filesystemUuid"));
                metadata.add("inode", proof.get("inode"));
                metadata.addProperty("lastOperationUuid", writer.operationUuid);
                match.setMetadataJson(metadata.toString());
                match = dao.persist(match);
                adopting.add(source);
            } else if (match == null || !match.getUuid().equals(string(binding, "targetUuid"))
                    || match.getRevision() != proof.get("registryRevision").getAsLong()
                    || match.getOwnerUid() != row.get("ownerUid").getAsLong()
                    || match.getOwnerGid() != row.get("ownerGid").getAsLong() || !match.getMode().equals(string(row, "mode"))) {
                throw invalid("RESTORE_DIRECTORY_POLICY_CHANGED");
            }
            policies.put(source, match);
        }
        if (!bindings.isEmpty()) {
            throw invalid("RESTORE_DIRECTORY_CONTRACT");
        }
    }

    private void listener(JsonObject row) {
        Protocol protocol = Protocol.valueOf(string(row, "protocol"));
        String ip = string(row, "listenIp");
        if (!ip.isEmpty()) {
            manager.resolveProtocolListenAddress(instance, ip);
        }
        int port = row.has("port") ? row.get("port").getAsInt() : manager.defaultProtocolPort(protocol);
        if (protocol == Protocol.NFS) {
            manager.validateNfsListenerPort(port);
        }
        StorageServiceProtocolDao dao = writer.dao(StorageServiceProtocolDao.class);
        StorageServiceProtocolVO existing = manager.findProtocolEndpoint(instance.getId(), protocol, ip, port);
        manager.validateBlockProtocolListenerConflict(instance, protocol, ip, port, existing);
        boolean enabled = row.get("enabled").getAsBoolean();
        JsonObject config = settings(row);
        if (protocol == Protocol.NFS && existing != null) {
            JsonObject previous = StorageServiceConfigurationCoordinator.parsed(existing.getConfigJson());
            if (previous.has("nfs4IdentityPolicyRevision")) {
                config.add("nfs4IdentityPolicyRevision", previous.get("nfs4IdentityPolicyRevision"));
            }
        }
        if (existing == null) {
            existing = dao.persist(new StorageServiceProtocolVO(instance.getId(), protocol, enabled, ip.isEmpty() ? null : ip, port));
        }
        existing.setEnabled(enabled);
        existing.setState(enabled ? ResourceState.Ready : ResourceState.Disabled);
        existing.setConfigJson(config.toString());
        dao.update(existing.getId(), existing);
    }

    private void file(JsonObject row, JsonObject proof) {
        Protocol protocol = Protocol.valueOf(string(row, "protocol"));
        String name = string(row, "name");
        String path = string(row, "path");
        if (protocol == Protocol.NFS) {
            manager.validateNfsExportName(name);
            manager.validateNfsExportPath(path, name);
        } else {
            manager.validateSmbShareName(name);
            manager.validateSmbSharePath(path, name);
        }
        StorageFileShareDao dao = writer.dao(StorageFileShareDao.class);
        StorageFileShareVO existing = dao.listByInstanceIdAndProtocol(instance.getId(), protocol).stream()
                .filter(v -> protocol == Protocol.SMB ? name.equalsIgnoreCase(v.getName()) : name.equals(v.getName()))
                .findFirst().orElse(null);
        ResourceState state = state(row);
        Long volumeId = volume(row);
        JsonObject config = settings(row);
        if (state != ResourceState.Disabled) {
            if (proof == null || volumeId == null) {
                throw invalid("RESTORE_FILE_PATH_UNCONFIRMED");
            }
            String relative = string(proof, "relativePath");
            String mount = "/srv/ablestack-storage/volumes/" + string(proof, "volumeUuid");
            config.addProperty("volumeMountPath", mount);
            config.addProperty("backingPath", relative.isEmpty() ? mount : mount + "/" + relative);
            config.addProperty("filesystemUuid", string(proof, "filesystemUuid"));
            config.addProperty("createDirectory", false);
            config.addProperty("recursivePermission", false);
            if (proof.get("protected").getAsBoolean()) {
                JsonObject identity = new JsonObject();
                identity.add("filesystemUuid", proof.get("filesystemUuid"));
                identity.add("inode", proof.get("inode"));
                identity.add("volumeRootInode", proof.get("rootInode"));
                config.add("pathIdentity", identity);
            }
        }
        Long policy = null;
        boolean pendingAdoption = false;
        if (config.has("directoryPolicyUuid")) {
            String sourcePolicy = string(config, "directoryPolicyUuid");
            StorageDirectoryPolicyVO mapped = policies.get(sourcePolicy);
            if (mapped == null || proof == null || !Objects.equals(mapped.getVolumeId(), volumeId)
                    || !mapped.getCanonicalPath().equals(string(proof, "relativePath").isEmpty() ? "." : string(proof, "relativePath"))) {
                throw invalid("RESTORE_DIRECTORY_POLICY_CHANGED");
            }
            policy = mapped.getId();
            pendingAdoption = adopting.contains(sourcePolicy);
            if (pendingAdoption) {
                config.addProperty("directoryPolicyUuid", mapped.getUuid());
            } else {
                config.remove("directoryPolicyUuid");
            }
        }
        manager.validateFileSharePathAvailable(instance, path, existing == null ? null : existing.getId(),
                volumeId, "SharedFS restore", StorageFileSharePaths.bound(config));
        String fs = string(row, "filesystem");
        manager.validateFileShareFilesystem(fs, "MOUNT_EXISTING");
        Long quota = row.has("quotaBytes") ? row.get("quotaBytes").getAsLong() : null;
        if (existing == null) {
            existing = dao.persist(new StorageFileShareVO(instance.getId(), protocol, name, path, volumeId, fs, quota, state, config.toString()));
        }
        existing.setName(name);
        existing.setPath(path);
        existing.setVolumeId(volumeId);
        existing.setFilesystem(fs);
        existing.setQuotaBytes(quota);
        existing.setState(state);
        existing.setConfigJson(config.toString());
        manager.guardRestoreFileShare(instance, existing, policy, pendingAdoption);
        dao.update(existing.getId(), existing);
        parents.put(string(row, "uuid"), new Parent(existing.getId(), AccessResourceType.FILE_SHARE, protocol, null));
    }

    private void block(JsonObject row) {
        Protocol protocol = Protocol.valueOf(string(row, "protocol"));
        StorageBlockTargetDao dao = writer.dao(StorageBlockTargetDao.class);
        String name = string(row, "targetName");
        String number = string(row, "lunOrNamespace");
        Long volumeId = volume(row);
        JsonObject config = settings(row);
        boolean subsystem = protocol == Protocol.NVME_OF && "subsystem".equals(string(config, "type"));
        boolean validType = protocol == Protocol.ISCSI ? "target".equals(string(config, "type"))
                : subsystem || "namespace".equals(string(config, "type"));
        if (!validType || !qualified(name, protocol)
                || !subsystem && (!number.matches("[0-9]{1,9}") || volumeId == null)
                || subsystem && (!number.isEmpty() || volumeId != null)
                || protocol == Protocol.NVME_OF && !subsystem && Integer.parseInt(number) == 0) {
            throw invalid("RESTORE_BLOCK_TARGET_INVALID");
        }
        StorageBlockTargetVO existing = dao.listByInstanceIdAndProtocol(instance.getId(), protocol).stream()
                .filter(v -> name.equals(v.getTargetName()) && number.equals(Objects.toString(v.getLunOrNamespace(), "")))
                .findFirst().orElse(null);
        Long existingId = existing == null ? null : existing.getId();
        String ports = config.has("listenerGroupPorts") ? config.getAsJsonArray("listenerGroupPorts").asList()
                .stream().map(JsonElement::getAsString).collect(Collectors.joining(",")) : null;
        if (protocol == Protocol.ISCSI) {
            manager.validateIscsiBlockOnlyBackstore(string(config, "backstoreType"));
            manager.validateIscsiBackingVolumeAvailable(instance, volumeId, existingId);
            manager.validateIscsiEndpointPolicy(string(config, "endpointMode"), ports);
            manager.validateIscsiListenerPortsExist(instance, ports);
        } else if (subsystem) {
            if (!"KERNEL_NVMET".equals(string(config, "engine"))) {
                throw invalid("RESTORE_NVME_ENGINE_UNSUPPORTED");
            }
        } else {
            StorageBlockTargetVO parent = dao.listByInstanceIdAndProtocol(instance.getId(), protocol).stream()
                    .filter(v -> name.equals(v.getTargetName()) && manager.isNvmeOfSubsystem(v))
                    .findFirst().orElseThrow(() -> invalid("RESTORE_NVME_SUBSYSTEM_REQUIRED"));
            manager.validateNvmeOfBackingVolumeAvailable(instance, volumeId, existingId);
            manager.validateNvmeOfEndpointPolicy(ports);
            manager.validateNvmeOfListenerPortsExist(instance, ports);
            manager.validateNvmeOfNamespaceListenerPortsCompatible(instance, parent, ports, existingId);
        }
        ResourceState state = state(row);
        if (existing == null) {
            existing = dao.persist(new StorageBlockTargetVO(instance.getId(), protocol, name, number.isEmpty() ? null : number,
                    volumeId, state, config.toString()));
        }
        existing.setVolumeId(volumeId);
        existing.setState(state);
        existing.setConfigJson(config.toString());
        dao.update(existing.getId(), existing);
        parents.put(string(row, "uuid"), new Parent(existing.getId(), AccessResourceType.BLOCK_TARGET, protocol, existing));
    }

    private void rule(JsonObject row, JsonObject secrets, Set<String> consumed) {
        Parent parent = parents.get(string(row, "resource"));
        if (parent == null || !parent.type.name().equals(string(row, "resourceType"))) {
            throw invalid("RESTORE_ACL_PARENT_INVALID");
        }
        String principal = string(row, "principal");
        PrincipalType type = PrincipalType.valueOf(string(row, "principalType"));
        Permission permission = Permission.valueOf(string(row, "permission"));
        JsonObject config = settings(row);
        switch (parent.protocol) {
        case NFS:
            manager.parseNfsPrincipalType(type.name());
            manager.parseNfsPermission(permission.name());
            if (manager.parseNfsPrincipals(principal, null).size() != 1) {
                throw invalid("RESTORE_ACL_PRINCIPAL_INVALID");
            }
            break;
        case SMB:
            manager.parseSmbPrincipalType(type.name());
            if (type.name().startsWith("AD_")) {
                throw invalid("RESTORE_AD_MEMBERSHIP_NOT_PORTABLE");
            }
            break;
        case ISCSI:
            if (type != PrincipalType.ISCSI_INITIATOR_IQN || !qualified(principal, Protocol.ISCSI)) {
                throw invalid("RESTORE_ACL_PRINCIPAL_INVALID");
            }
            manager.parseBlockPermission(permission.name());
            break;
        case NVME_OF:
            if (type != PrincipalType.NVME_HOST_NQN || !qualified(principal, Protocol.NVME_OF)
                    || permission != Permission.READ_WRITE) {
                throw invalid("RESTORE_ACL_PRINCIPAL_INVALID");
            }
            manager.validateNvmeOfHostAclScope(parent.block);
            break;
        default:
            throw invalid("RESTORE_PROTOCOL_SCOPE_INVALID");
        }
        StorageAccessRuleDao dao = writer.dao(StorageAccessRuleDao.class);
        StorageAccessRuleVO existing = dao.listByResource(parent.type, parent.id).stream()
                .filter(r -> r.getPrincipalType() == type && principal.equals(r.getPrincipal())).findFirst().orElse(null);
        JsonObject supplied = credentials(row, secrets, consumed, parent.protocol, type, config);
        if (parent.protocol == Protocol.ISCSI) {
            manager.validateIscsiChapCredentialRequest(flag(config, "chapEnabled"), string(config, "chapUsername"),
                    optional(supplied, "ISCSI_CHAP"), flag(config, "mutualChapEnabled"),
                    string(config, "mutualChapUsername"), optional(supplied, "ISCSI_MUTUAL_CHAP"));
            manager.validateIscsiAclTargetScope(parent.block, existing == null ? null : existing.getId(), principal, config);
        }
        ResourceState state = state(row);
        if (existing == null) {
            existing = dao.persist(new StorageAccessRuleVO(parent.type, parent.id, type, principal, permission, state, config.toString()));
        }
        existing.setPermission(permission);
        existing.setConfigJson(config.toString());
        existing.setState(state);
        dao.update(existing.getId(), existing);
        String password = optional(supplied, "SMB_LOCAL");
        if (password != null) {
            passwords.put(existing.getId(), password);
        }
        chap.putAll(manager.buildChapSecretMap(existing.getId(), optional(supplied, "ISCSI_CHAP"), optional(supplied, "ISCSI_MUTUAL_CHAP")));
        dhChap.putAll(manager.buildNvmeOfSecretMap(existing.getId(), optional(supplied, "NVME_DH_CHAP"), optional(supplied, "NVME_DH_CHAP_CTRL")));
    }

    private static JsonObject credentials(JsonObject row, JsonObject secrets, Set<String> consumed,
            Protocol protocol, PrincipalType principal, JsonObject config) {
        Set<String> required = new HashSet<>();
        if (protocol == Protocol.SMB && principal == PrincipalType.LOCAL_USER) {
            required.add("SMB_LOCAL");
        }
        if (protocol == Protocol.ISCSI) {
            if (flag(config, "chapEnabled")) required.add("ISCSI_CHAP");
            if (flag(config, "mutualChapEnabled")) required.add("ISCSI_MUTUAL_CHAP");
        }
        if (protocol == Protocol.NVME_OF) {
            if (flag(config, "dhChapEnabled")) required.add("NVME_DH_CHAP");
            if (flag(config, "dhChapCtrlEnabled")) required.add("NVME_DH_CHAP_CTRL");
        }
        Set<String> declared = new HashSet<>();
        row.getAsJsonArray("credentialSlots").forEach(item -> declared.add(item.getAsString()));
        if (!required.equals(declared)) {
            throw invalid("RESTORE_CREDENTIAL_SCOPE_INVALID");
        }
        String id = string(row, "uuid");
        if (required.isEmpty()) {
            return new JsonObject();
        }
        JsonElement value = secrets.get(id);
        if (value == null || !value.isJsonObject() || !required.equals(value.getAsJsonObject().keySet())) {
            throw invalid("RESTORE_CREDENTIAL_REQUIRED");
        }
        JsonObject supplied = value.getAsJsonObject();
        for (String slot : required) {
            String secret = string(supplied, slot);
            if (secret.isBlank() || secret.length() > 256 || secret.contains("PRIVATE KEY-----")
                    || secret.chars().anyMatch(Character::isISOControl)) {
                throw invalid("RESTORE_CREDENTIAL_INVALID");
            }
        }
        consumed.add(id);
        return supplied;
    }

    private Long volume(JsonObject row) {
        String uuid = string(row, "volume");
        if (uuid.isEmpty()) {
            return null;
        }
        VolumeVO data = volumes.apply(uuid);
        if (data == null || !uuid.equals(data.getUuid()) || !Objects.equals(data.getInstanceId(), instance.getVmId())) {
            throw invalid("RESTORE_BACKING_VOLUME_CHANGED");
        }
        return data.getId();
    }

    private static boolean qualified(String value, Protocol protocol) {
        String prefix = protocol == Protocol.ISCSI ? "(?:iqn\\.|eui\\.|naa\\.)" : "nqn\\.";
        return value.matches(prefix + "[A-Za-z0-9.:-]{1,219}");
    }

    private static List<JsonObject> rows(JsonArray values) {
        List<JsonObject> result = new ArrayList<>();
        values.forEach(value -> result.add(value.getAsJsonObject()));
        return result;
    }

    private static JsonObject settings(JsonObject row) {
        return row.getAsJsonObject("settings").deepCopy();
    }

    private static ResourceState state(JsonObject row) {
        String state = string(row, "state");
        if ("Disabled".equals(state)) {
            return ResourceState.Disabled;
        }
        if (!Set.of("Ready", "Updating").contains(state)) {
            throw invalid("RESTORE_RESOURCE_STATE_UNSUPPORTED");
        }
        return ResourceState.Ready;
    }

    private static boolean flag(JsonObject object, String name) {
        return object.has(name) && object.get(name).getAsBoolean();
    }

    private static String optional(JsonObject object, String key) {
        return object.has(key) ? object.get(key).getAsString() : null;
    }

    private static com.cloud.exception.InvalidParameterValueException invalid(String code) {
        return StorageConfigArchiveV1.invalid(code);
    }

    private static final class Parent {
        final long id;
        final AccessResourceType type;
        final Protocol protocol;
        final StorageBlockTargetVO block;

        Parent(long id, AccessResourceType type, Protocol protocol, StorageBlockTargetVO block) {
            this.id = id;
            this.type = type;
            this.protocol = protocol;
            this.block = block;
        }
    }
}
