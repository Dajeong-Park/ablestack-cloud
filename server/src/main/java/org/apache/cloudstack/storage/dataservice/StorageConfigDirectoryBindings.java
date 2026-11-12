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
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.UUID;

import static org.apache.cloudstack.storage.dataservice.StorageConfigSnapshot.array;
import static org.apache.cloudstack.storage.dataservice.StorageConfigSnapshot.object;
import static org.apache.cloudstack.storage.dataservice.StorageConfigSnapshot.string;

/** Plans metadata adoption using destination identity and permissions, never source inode numbers. */
final class StorageConfigDirectoryBindings {
    private static final Set<String> PROOF_FIELDS = Set.of("resourceUuid", "volumeUuid", "relativePath",
            "filesystemUuid", "rootInode", "inode", "mountId", "mountSource", "ownerUid", "ownerGid", "mode");
    private static final Set<String> REGISTERED_FIELDS = Set.of("resourceUuid", "volumeUuid", "relativePath",
            "filesystemUuid", "rootInode", "inode", "mountId", "mountSource", "ownerUid", "ownerGid", "mode",
            "registryUuid", "registryRevision");

    private StorageConfigDirectoryBindings() {
    }

    static JsonArray requests(JsonObject desired) {
        JsonArray result = new JsonArray();
        for (JsonObject saved : indexed(desired.getAsJsonArray("directories"), "uuid").values()) {
            String relative = string(saved, "canonicalPath");
            if (!".".equals(relative)) {
                StorageFileSharePaths.normalize(relative);
            }
            JsonObject request = new JsonObject();
            request.add("resourceUuid", saved.get("uuid"));
            request.add("volumeUuid", saved.get("volume"));
            request.addProperty("relativePath", ".".equals(relative) ? "" : relative);
            result.add(request);
        }
        return result;
    }

    static JsonArray proofs(JsonObject desired, JsonObject observation, String boot) {
        JsonArray requests = requests(desired);
        if (requests.size() == 0) {
            return requests;
        }
        if (observation == null || !boot.equals(string(observation, "bootId")) || !observation.has("directories")) {
            throw StorageConfigArchiveV1.invalid("RESTORE_DIRECTORY_OBSERVATION_UNAVAILABLE");
        }
        Map<String, JsonObject> wanted = indexed(desired.getAsJsonArray("directories"), "uuid");
        Map<String, JsonObject> source = indexed(desired.getAsJsonArray("volumes"), "uuid");
        Map<String, JsonObject> target = indexed(array(observation.get("volumes")), "uuid");
        Map<String, JsonObject> measured = indexed(array(observation.get("directories")), "resourceUuid");
        if (measured.size() != requests.size()) {
            throw StorageConfigArchiveV1.invalid("RESTORE_DIRECTORY_OBSERVATION_UNAVAILABLE");
        }
        JsonArray result = new JsonArray();
        for (JsonElement item : requests) {
            JsonObject request = object(item);
            String id = string(request, "resourceUuid");
            String volume = string(request, "volumeUuid");
            JsonObject current = measured.get(id);
            JsonObject saved = wanted.get(id);
            JsonObject sourceVolume = source.get(volume);
            JsonObject targetVolume = target.get(volume);
            if (current == null || sourceVolume == null || targetVolume == null
                    || !(current.keySet().equals(PROOF_FIELDS) || current.keySet().equals(REGISTERED_FIELDS))
                    || request.entrySet().stream().anyMatch(field -> !field.getValue().equals(current.get(field.getKey())))
                    || !"OBSERVED".equals(string(targetVolume, "state")) || !"/".equals(string(targetVolume, "fsRoot"))
                    || !StorageConfigSnapshot.isUuid(string(current, "filesystemUuid"))
                    || !current.get("filesystemUuid").equals(sourceVolume.get("filesystemUuid"))
                    || !current.get("filesystemUuid").equals(targetVolume.get("filesystemUuid"))
                    || !string(current, "mountSource").startsWith("/dev/")
                    || !current.get("mountSource").equals(targetVolume.get("mountSource"))
                    || !positive(current.get("inode")) || !positive(current.get("rootInode")) || !positive(current.get("mountId"))
                    || !StorageConfigSnapshot.isInteger(current.get("ownerUid")) || !StorageConfigSnapshot.isInteger(current.get("ownerGid"))
                    || !string(current, "mode").matches("[0-7]{4}")
                    || !current.get("ownerUid").equals(saved.get("ownerUid"))
                    || !current.get("ownerGid").equals(saved.get("ownerGid"))
                    || !current.get("mode").equals(saved.get("mode"))
                    || current.has("registryUuid") && (!StorageConfigSnapshot.isUuid(string(current, "registryUuid"))
                            || !positive(current.get("registryRevision")))) {
                throw StorageConfigArchiveV1.invalid("RESTORE_DIRECTORY_POLICY_CHANGED");
            }
            result.add(current.deepCopy());
        }
        return result;
    }

    static JsonArray plan(JsonObject desired, JsonObject target, JsonObject observation, String boot) {
        JsonArray result = new JsonArray();
        Map<String, JsonObject> known = new HashMap<>();
        for (JsonObject row : indexed(target.getAsJsonArray("directories"), "uuid").values()) {
            if (known.putIfAbsent(key(string(row, "volume"), string(row, "canonicalPath")), row) != null) {
                throw StorageConfigArchiveV1.invalid("RESTORE_DIRECTORY_POLICY_CHANGED");
            }
        }
        for (JsonElement item : proofs(desired, observation, boot)) {
            JsonObject proof = item.getAsJsonObject();
            String path = string(proof, "relativePath");
            JsonObject database = known.get(key(string(proof, "volumeUuid"), path.isEmpty() ? "." : path));
            String registry = string(proof, "registryUuid");
            if (database == null ? !registry.isEmpty() : !registry.equals(string(database, "uuid"))
                    || !proof.get("ownerUid").equals(database.get("ownerUid"))
                    || !proof.get("ownerGid").equals(database.get("ownerGid"))
                    || !proof.get("mode").equals(database.get("mode"))) {
                throw StorageConfigArchiveV1.invalid("RESTORE_DIRECTORY_POLICY_CHANGED");
            }
            JsonObject binding = new JsonObject();
            binding.addProperty("targetUuid", database == null ? UUID.randomUUID().toString() : registry);
            binding.addProperty("adopt", database == null);
            binding.add("proof", proof);
            result.add(binding);
        }
        return result;
    }

    private static String key(String volume, String path) {
        return volume + ":" + path;
    }

    private static Map<String, JsonObject> indexed(JsonArray rows, String field) {
        Map<String, JsonObject> result = new TreeMap<>();
        for (JsonElement entry : rows) {
            JsonObject row = object(entry);
            if (result.putIfAbsent(string(row, field), row) != null) {
                throw StorageConfigArchiveV1.invalid("RESTORE_DIRECTORY_CONTRACT");
            }
        }
        return result;
    }

    private static boolean positive(JsonElement value) {
        return StorageConfigSnapshot.isInteger(value) && value.getAsLong() > 0;
    }
}
