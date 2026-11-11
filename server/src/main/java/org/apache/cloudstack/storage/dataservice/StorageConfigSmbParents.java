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

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;

import static org.apache.cloudstack.storage.dataservice.StorageConfigSnapshot.array;
import static org.apache.cloudstack.storage.dataservice.StorageConfigSnapshot.object;
import static org.apache.cloudstack.storage.dataservice.StorageConfigSnapshot.string;

/** Uses the same guest traversal contract for review and execution; never changes permissions. */
final class StorageConfigSmbParents {
    private static final Set<String> KEYS = Set.of("resourceUuid", "code", "filesystemUuid", "rootInode",
            "inode", "mountId", "bindingPending", "accountPending");
    private static final Set<String> CODES = Set.of("SMB_PARENT_TRAVERSAL_OK",
            "SMB_PARENT_TRAVERSAL_PENDING_ACL", "SMB_PARENT_TRAVERSAL_NOT_APPLICABLE");

    private StorageConfigSmbParents() { }

    static JsonArray requests(JsonObject desired) {
        Map<String, JsonObject> files = new TreeMap<>();
        for (JsonElement entry : array(desired.get("files"))) {
            JsonObject file = object(entry);
            files.put(string(file, "uuid"), file);
        }
        JsonArray output = new JsonArray();
        for (JsonElement entry : StorageConfigFilePaths.requests(desired)) {
            JsonObject path = object(entry);
            if (!"SMB".equals(string(path, "protocol"))) continue;
            JsonObject file = files.get(string(path, "resourceUuid"));
            JsonObject settings = object(file.get("settings"));
            JsonObject row = new JsonObject();
            for (String key : Set.of("resourceUuid", "volumeUuid", "relativePath", "protected"))
                row.add(key, path.get(key).deepCopy());
            row.addProperty("guestOk", settings.has("guestOk") && settings.get("guestOk").getAsBoolean());
            row.add("fileIdentity", settings.has("fileIdentity")
                    ? object(settings.get("fileIdentity")).deepCopy() : new JsonObject());
            JsonArray principals = new JsonArray();
            for (JsonElement ruleEntry : array(desired.get("rules"))) {
                JsonObject rule = object(ruleEntry);
                if (!string(file, "uuid").equals(string(rule, "resource"))
                        || Set.of("Disabled", "Destroyed", "Error").contains(string(rule, "state"))) continue;
                JsonObject principal = new JsonObject();
                principal.addProperty("principalType", string(rule, "principalType"));
                principal.addProperty("principal", string(rule, "principal"));
                principals.add(principal);
            }
            row.add("principals", principals);
            output.add(row);
        }
        return output;
    }

    static JsonArray requireProofs(JsonObject desired, JsonObject observation, String boot) {
        JsonArray requests = requests(desired);
        JsonArray output = new JsonArray();
        if (requests.size() == 0) return output;
        if (observation == null || !boot.equals(string(observation, "bootId"))
                || !observation.has("smbParents"))
            throw StorageConfigArchiveV1.invalid("RESTORE_SMB_PARENT_OBSERVATION_UNAVAILABLE");
        Map<String, JsonObject> paths = new TreeMap<>();
        for (JsonElement value : StorageConfigFilePaths.requireProofs(desired, observation, boot)) {
            JsonObject row = object(value);
            if ("SMB".equals(string(row, "protocol"))) paths.put(string(row, "resourceUuid"), row);
        }
        Map<String, JsonObject> checks = new TreeMap<>();
        for (JsonElement entry : array(observation.get("smbParents"))) {
            JsonObject row = object(entry);
            if (checks.putIfAbsent(string(row, "resourceUuid"), row) != null)
                throw StorageConfigArchiveV1.invalid("RESTORE_SMB_PARENT_OBSERVATION_UNAVAILABLE");
        }
        if (!checks.keySet().equals(paths.keySet()))
            throw StorageConfigArchiveV1.invalid("RESTORE_SMB_PARENT_OBSERVATION_UNAVAILABLE");
        for (Map.Entry<String, JsonObject> entry : paths.entrySet()) {
            JsonObject check = checks.get(entry.getKey()), path = entry.getValue();
            if (!check.keySet().equals(KEYS) || !CODES.contains(string(check, "code"))
                    || !isBoolean(check.get("bindingPending")) || !isBoolean(check.get("accountPending"))
                    || Set.of("resourceUuid", "filesystemUuid", "rootInode", "inode", "mountId").stream()
                       .anyMatch(key -> !path.get(key).equals(check.get(key))))
                throw StorageConfigArchiveV1.invalid("RESTORE_SMB_PARENT_OBSERVATION_UNAVAILABLE");
            JsonObject visible = check.deepCopy();
            visible.addProperty("name", string(path, "name"));
            output.add(visible);
        }
        return output;
    }

    private static boolean isBoolean(JsonElement value) {
        return value != null && value.isJsonPrimitive() && value.getAsJsonPrimitive().isBoolean();
    }
}
