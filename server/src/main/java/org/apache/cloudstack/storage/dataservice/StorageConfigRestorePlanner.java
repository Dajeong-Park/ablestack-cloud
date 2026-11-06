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

import com.cloud.utils.net.NetUtils;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import java.nio.charset.StandardCharsets;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;

/** Builds a revision/BOOT-bound review from portable rows. Never writes live configuration. */
final class StorageConfigRestorePlanner {
    private static final Set<String> PROTOCOLS = Set.of("NFS", "SMB", "ISCSI", "NVME_OF");

    private StorageConfigRestorePlanner() { }

    static JsonObject review(StorageConfigArtifactStore.Artifact artifact, StorageServiceInstanceVO target,
            String vm, String boot, long user, JsonObject targetState, Set<String> ownedIps,
            JsonObject addressMapping, Set<String> protocols, JsonObject targetNfsObservation,
            Function<JsonObject, JsonObject> observeTargetFiles) {
        if (!"VALIDATED".equals(artifact.state) && !Set.of("BACKUP", "LKG").contains(artifact.kind)
                || artifact.body == null || artifact.length != artifact.body.length
                || !artifact.sha.equals(StorageConfigArchiveV1.digest(artifact.body))
                || artifact.account != target.getAccountId() || artifact.domain != target.getDomainId()
                || artifact.zone != target.getDataCenterId() || artifact.target != null && !artifact.target.equals(target.getUuid())
                || !StorageConfigSnapshot.isUuid(vm) || !StorageConfigSnapshot.isUuid(boot)
                || protocols.isEmpty() || !PROTOCOLS.containsAll(protocols)) {
            throw StorageConfigArchiveV1.invalid("RESTORE_ARTIFACT_OR_TARGET_INVALID");
        }
        StorageConfigArchiveV1.Bundle backup = StorageConfigArchiveV1.read(artifact.body);
        StorageConfigSnapshot.validate(backup);
        StorageConfigSnapshot.validateDesired(targetState);
        JsonObject desired = subset(backup.desired, protocols);
        if (!desired.getAsJsonArray("omitted").isEmpty()) {
            throw StorageConfigArchiveV1.invalid("RESTORE_DESIRED_COVERAGE_INCOMPLETE");
        }

        JsonObject nfsBinding = protocols.contains("NFS")
                ? StorageConfigNfsBinding.plan(desired, targetState, backup.effective.getAsJsonObject("NFS"), targetNfsObservation, boot, ownedIps)
                : null;
        Set<String> required = applyMapping(desired, ownedIps, addressMapping);
        if (!addressMapping.keySet().equals(required)) {
            throw StorageConfigArchiveV1.invalid("RESTORE_ADDRESS_MAPPING_NOT_EXACT");
        }
        JsonObject diff = compare(targetState, desired);
        JsonObject result = new JsonObject();
        result.addProperty("source", StorageConfigSnapshot.string(backup.manifest, "sourceInstance"));
        result.addProperty("artifact", artifact.id);
        result.addProperty("sha256", artifact.sha);
        result.addProperty("target", target.getUuid());
        result.addProperty("vm", vm);
        result.addProperty("boot", boot);
        result.addProperty("account", target.getAccountId());
        result.addProperty("domain", target.getDomainId());
        result.addProperty("zone", target.getDataCenterId());
        result.addProperty("user", user);
        result.addProperty("revision", target.getConfigurationRevision());
        result.addProperty("expires", System.currentTimeMillis() + 300_000L);
        JsonArray scope = new JsonArray();
        protocols.stream().sorted().forEach(scope::add);
        result.add("protocols", scope);
        result.add("addressMapping", addressMapping.deepCopy());
        if (nfsBinding != null) {
            result.add("nfsBinding", nfsBinding);
        }
        if (StorageConfigFilePaths.requests(desired).size() > 0) {
            result.add("filePathProofs", StorageConfigFilePaths.requireProofs(desired, observeTargetFiles.apply(desired), boot));
        }
        result.add("diff", diff);
        result.add("desired", desired);
        return result;
    }

    static JsonArray mappingSources(JsonObject source, Set<String> protocols) {
        JsonObject desired = subset(source, protocols);
        Set<String> values = applyMapping(desired, Set.of(), null);
        JsonArray result = new JsonArray();
        values.stream().sorted().forEach(result::add);
        return result;
    }

    private static Set<String> applyMapping(JsonObject desired, Set<String> ownedIps, JsonObject addressMapping) {
        Set<String> required = new HashSet<>();
        for (String table : Set.of("listeners", "files", "blocks")) {
            for (JsonElement entry : desired.getAsJsonArray(table)) {
                JsonObject row = entry.getAsJsonObject();
                if ("listeners".equals(table)) {
                    mapListener(row, ownedIps, addressMapping, required);
                }
                JsonObject settings = row.getAsJsonObject("settings");
                mapIps(settings, "listenIps", ownedIps, addressMapping, required);
                mapIps(settings, "serviceIps", ownedIps, addressMapping, required);
                if (settings.has("listenerGroups")) {
                    for (JsonElement item : settings.getAsJsonArray("listenerGroups")) {
                        JsonObject group = item.getAsJsonObject();
                        String address = StorageConfigSnapshot.string(group, "listenIp");
                        if (!StorageConfigSnapshot.unspecifiedListenerAddress(address)) {
                            group.addProperty("listenIp", map(address, ownedIps, addressMapping, required));
                        }
                        mapIps(group, "listenIps", ownedIps, addressMapping, required);
                    }
                }
            }
        }
        return required;
    }

    static void requireApproval(JsonObject plan, String digest, String currentVm, String boot,
            StorageServiceInstanceVO target, long user, boolean acceptAclRemoval, boolean acceptNfsServiceWide,
            JsonObject currentNfsObservation, Set<String> ownedIps, Function<JsonObject, JsonObject> observeTargetFiles) {
        if (digest == null || !digest.equals(StorageConfigArchiveV1.digest(plan.toString().getBytes(StandardCharsets.UTF_8)))
                || !target.getUuid().equals(StorageConfigSnapshot.string(plan, "target"))
                || !currentVm.equals(StorageConfigSnapshot.string(plan, "vm"))
                || !boot.equals(StorageConfigSnapshot.string(plan, "boot"))
                || target.getAccountId() != plan.get("account").getAsLong()
                || target.getDomainId() != plan.get("domain").getAsLong()
                || target.getDataCenterId() != plan.get("zone").getAsLong()
                || target.getConfigurationRevision() != plan.get("revision").getAsLong()
                || user != plan.get("user").getAsLong()
                || System.currentTimeMillis() >= plan.get("expires").getAsLong()) {
            throw StorageConfigArchiveV1.invalid("RESTORE_PLAN_STALE_OR_NOT_APPROVED");
        }
        if (plan.has("nfsBinding")) {
            if (!acceptNfsServiceWide) {
                throw StorageConfigArchiveV1.invalid("NFS_SERVICE_WIDE_NOT_APPROVED");
            }
            JsonObject expected = plan.getAsJsonObject("nfsBinding");
            StorageConfigNfsBinding.verifiedTargetAddresses(currentNfsObservation, boot, ownedIps);
            if (!expected.get("interfaces").equals(currentNfsObservation.get("interfaces"))
                    || !expected.get("beforeListeners").equals(currentNfsObservation.get("listeners"))) {
                throw StorageConfigArchiveV1.invalid("NFS_RESTORE_NETWORK_CHANGED");
            }
        }
        if (plan.getAsJsonObject("diff").getAsJsonArray("aclRemovals").size() > 0 && !acceptAclRemoval) {
            throw StorageConfigArchiveV1.invalid("RESTORE_ACL_REMOVAL_NOT_APPROVED");
        }
        JsonObject desired = plan.getAsJsonObject("desired");
        if (StorageConfigFilePaths.requests(desired).size() > 0) {
            JsonArray measured = StorageConfigFilePaths.requireProofs(desired, observeTargetFiles.apply(desired), boot);
            if (!measured.equals(plan.get("filePathProofs"))) {
                throw StorageConfigArchiveV1.invalid("RESTORE_FILE_PATH_IDENTITY_CHANGED");
            }
        }
    }

    private static JsonObject subset(JsonObject source, Set<String> protocols) {
        JsonObject output = new JsonObject();
        Set<String> ids = new HashSet<>();
        Set<String> volumes = new HashSet<>();
        Set<String> directories = new HashSet<>();
        for (String table : Set.of("listeners", "files", "blocks")) {
            JsonArray rows = new JsonArray();
            for (JsonElement entry : source.getAsJsonArray(table)) {
                JsonObject row = entry.getAsJsonObject();
                if (protocols.contains(StorageConfigSnapshot.string(row, "protocol"))) {
                    rows.add(row.deepCopy());
                    ids.add(StorageConfigSnapshot.string(row, "uuid"));
                    if (row.has("volume")) {
                        volumes.add(StorageConfigSnapshot.string(row, "volume"));
                    }
                    JsonObject settings = row.getAsJsonObject("settings");
                    if (settings.has("directoryPolicyUuid")) {
                        directories.add(StorageConfigSnapshot.string(settings, "directoryPolicyUuid"));
                    }
                }
            }
            output.add(table, rows);
        }
        for (String table : new String[] {"directories", "rules", "volumes", "omitted"}) {
            JsonArray rows = new JsonArray();
            for (JsonElement entry : source.getAsJsonArray(table)) {
                JsonObject row = entry.getAsJsonObject();
                String id = StorageConfigSnapshot.string(row, "uuid");
                String parent = StorageConfigSnapshot.string(row, "resource");
                if (("directories".equals(table) && directories.contains(id)) || ("rules".equals(table) && ids.contains(parent))
                        || ("volumes".equals(table) && volumes.contains(id)) || ("omitted".equals(table) && ids.contains(parent))) {
                    rows.add(row.deepCopy());
                    ids.add(id);
                    if (row.has("volume")) {
                        volumes.add(StorageConfigSnapshot.string(row, "volume"));
                    }
                }
            }
            output.add(table, rows);
        }
        return output;
    }

    static JsonObject compare(JsonObject current, JsonObject desired) {
        JsonObject result = new JsonObject();
        JsonArray updates = new JsonArray();
        JsonArray additions = new JsonArray();
        JsonArray aclRemovals = new JsonArray();
        JsonArray slots = new JsonArray();
        Map<String, String> parentMap = new LinkedHashMap<>();
        Map<String, JsonObject> rules = new LinkedHashMap<>();
        for (String table : new String[] {"listeners", "directories", "files", "blocks"}) {
            Map<String, JsonObject> existing = naturalKeys(current.getAsJsonArray(table), table);
            for (Map.Entry<String, JsonObject> entry : naturalKeys(desired.getAsJsonArray(table), table).entrySet()) {
                JsonObject row = entry.getValue();
                JsonObject before = existing.get(entry.getKey());
                String id = StorageConfigSnapshot.string(row, "uuid");
                if (before == null) {
                    additions.add(change(table, entry.getKey(), null, row));
                } else {
                    parentMap.put(id, StorageConfigSnapshot.string(before, "uuid"));
                    if (!withoutUuid(before).equals(withoutUuid(row))) {
                        updates.add(change(table, entry.getKey(), before, row));
                    }
                }
            }
        }
        for (JsonElement item : current.getAsJsonArray("rules")) {
            JsonObject rule = item.getAsJsonObject();
            if (parentMap.containsValue(StorageConfigSnapshot.string(rule, "resource"))) {
                String key = ruleKey(rule, StorageConfigSnapshot.string(rule, "resource"));
                if (rules.put(key, rule) != null) {
                    throw StorageConfigArchiveV1.invalid("RESTORE_DUPLICATE_ACL");
                }
            }
        }
        Set<String> claimed = new HashSet<>();
        for (JsonElement item : desired.getAsJsonArray("rules")) {
            JsonObject rule = item.getAsJsonObject();
            String resource = StorageConfigSnapshot.string(rule, "resource");
            String targetParent = parentMap.getOrDefault(resource, resource);
            String key = ruleKey(rule, targetParent);
            if (!claimed.add(key)) {
                throw StorageConfigArchiveV1.invalid("RESTORE_DUPLICATE_ACL");
            }
            JsonObject before = rules.remove(key);
            if (before == null) {
                additions.add(change("rules", key, null, rule));
            } else {
                JsonObject mapped = withoutUuid(rule);
                mapped.addProperty("resource", targetParent);
                if (!withoutUuid(before).equals(mapped)) {
                    updates.add(change("rules", key, before, rule));
                }
            }
            if (rule.getAsJsonArray("credentialSlots").size() > 0) {
                JsonObject entry = new JsonObject();
                entry.add("resource", rule.get("uuid"));
                entry.add("slots", rule.get("credentialSlots"));
                entry.addProperty("existingRule", before != null);
                slots.add(entry);
            }
        }
        rules.forEach((key, value) -> aclRemovals.add(change("rules", key, value, null)));
        result.add("additions", additions);
        result.add("updates", updates);
        result.add("aclRemovals", aclRemovals);
        result.add("credentialSlots", slots);
        return result;
    }

    private static JsonObject change(String type, String key, JsonObject before, JsonObject after) {
        JsonObject row = new JsonObject();
        row.addProperty("type", type);
        row.addProperty("key", key);
        if (before != null) {
            row.add("before", before.deepCopy());
        }
        if (after != null) {
            row.add("after", after.deepCopy());
        }
        return row;
    }

    private static Map<String, JsonObject> naturalKeys(JsonArray input, String type) {
        Map<String, JsonObject> map = new LinkedHashMap<>();
        for (JsonElement item : input) {
            JsonObject row = item.getAsJsonObject();
            String protocol = StorageConfigSnapshot.string(row, "protocol");
            String key;
            switch (type) {
                case "listeners":
                    key = protocol + "|" + StorageConfigSnapshot.string(row, "listenIp") + "|" + row.get("port");
                    break;
                case "directories":
                    key = StorageConfigSnapshot.string(row, "volume") + "|" + StorageConfigSnapshot.string(row, "canonicalPath");
                    break;
                case "files":
                    String name = StorageConfigSnapshot.string(row, "name");
                    key = protocol + "|" + ("SMB".equals(protocol) ? name.toLowerCase(java.util.Locale.ROOT) : name);
                    break;
                case "blocks":
                    key = protocol + "|" + StorageConfigSnapshot.string(row, "targetName") + "|" + StorageConfigSnapshot.string(row, "lunOrNamespace");
                    break;
                default:
                    throw new IllegalArgumentException(type);
            }
            if (map.put(key, row) != null) {
                throw StorageConfigArchiveV1.invalid("RESTORE_DUPLICATE_RESOURCE");
            }
        }
        return map;
    }

    private static JsonObject withoutUuid(JsonObject row) {
        JsonObject result = row.deepCopy();
        result.remove("uuid");
        return result;
    }

    private static String ruleKey(JsonObject row, String parent) {
        return parent + "|" + StorageConfigSnapshot.string(row, "principalType") + "|" + StorageConfigSnapshot.string(row, "principal");
    }

    private static void mapIps(JsonObject row, String key, Set<String> owned, JsonObject mapping, Set<String> required) {
        if (!row.has(key)) {
            return;
        }
        JsonArray result = new JsonArray();
        Set<String> unique = new HashSet<>();
        for (JsonElement address : row.getAsJsonArray(key)) {
            String ip = map(address.getAsString(), owned, mapping, required);
            if (!unique.add(ip)) {
                throw StorageConfigArchiveV1.invalid("RESTORE_ADDRESS_COLLISION");
            }
            result.add(ip);
        }
        row.add(key, result);
    }

    private static void mapListener(JsonObject row, Set<String> owned, JsonObject mapping, Set<String> required) {
        String source = StorageConfigSnapshot.string(row, "listenIp");
        if (StorageConfigSnapshot.unspecifiedListenerAddress(source)) {
            if (!"NFS".equals(StorageConfigSnapshot.string(row, "protocol")) && row.get("enabled").getAsBoolean()) {
                throw StorageConfigArchiveV1.invalid("RESTORE_EXPLICIT_LISTENER_REQUIRED");
            }
            return;
        }
        row.addProperty("listenIp", map(source, owned, mapping, required));
    }

    private static String map(String source, Set<String> owned, JsonObject mapping, Set<String> required) {
        required.add(source);
        if (mapping == null) {
            return source;
        }
        String target = StorageConfigSnapshot.string(mapping, source);
        if (StorageConfigSnapshot.unspecifiedListenerAddress(target) || !owned.contains(target)
                || !(NetUtils.isValidIp4(target) || NetUtils.isValidIp6(target))) {
            throw StorageConfigArchiveV1.invalid("RESTORE_ADDRESS_MAPPING_NOT_OWNED");
        }
        return target;
    }
}
