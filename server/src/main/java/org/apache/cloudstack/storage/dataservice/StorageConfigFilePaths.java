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

/** Validates new target evidence without importing a source inode or absolute path. */
final class StorageConfigFilePaths {
    private static final Set<String> REQUEST = Set.of("resourceUuid", "volumeUuid", "relativePath", "protocol", "protected", "name");
    private static final Set<String> PROOF = Set.of("resourceUuid", "volumeUuid", "relativePath", "protocol", "protected", "name",
            "filesystemUuid", "rootInode", "inode", "mountId", "mountSource");

    private StorageConfigFilePaths() {
    }

    static JsonArray requests(JsonObject desired) {
        Map<String, JsonObject> paths = new TreeMap<>();
        for (JsonElement entry : array(desired.get("files"))) {
            JsonObject file = object(entry);
            if (Set.of("Disabled", "Destroyed", "Error").contains(string(file, "state"))) {
                continue;
            }
            JsonObject settings = object(file.get("settings"));
            String resource = string(file, "uuid");
            String volume = string(file, "volume");
            if (!StorageConfigSnapshot.isUuid(resource) || !StorageConfigSnapshot.isUuid(volume) || !settings.has("relativeSharePath")) {
                throw StorageConfigArchiveV1.invalid("RESTORE_FILE_PATH_UNCONFIRMED");
            }
            String relative = string(settings, "relativeSharePath");
            if (!relative.isEmpty()) {
                StorageFileSharePaths.normalize(relative);
            }
            JsonObject request = new JsonObject();
            request.addProperty("resourceUuid", resource);
            request.addProperty("volumeUuid", volume);
            request.addProperty("protocol", string(file, "protocol"));
            request.addProperty("name", string(file, "name"));
            request.addProperty("relativePath", relative);
            request.addProperty("protected", StorageFileSharePaths.bound(settings));
            if (paths.putIfAbsent(resource, request) != null) {
                throw StorageConfigArchiveV1.invalid("RESTORE_FILE_PATH_UNCONFIRMED");
            }
        }
        JsonArray result = new JsonArray();
        paths.values().forEach(result::add);
        return result;
    }

    static JsonArray requireProofs(JsonObject desired, JsonObject observed, String boot) {
        JsonArray requests = requests(desired);
        if (requests.size() == 0) {
            return requests;
        }
        if (observed == null || !boot.equals(string(observed, "bootId")) || !observed.has("paths")) {
            throw StorageConfigArchiveV1.invalid("RESTORE_FILE_PATH_OBSERVATION_UNAVAILABLE");
        }
        Map<String, JsonObject> volumes = index(array(desired.get("volumes")), "uuid");
        Map<String, JsonObject> targetVolumes = index(array(observed.get("volumes")), "uuid");
        Map<String, JsonObject> paths = index(array(observed.get("paths")), "resourceUuid");
        if (paths.size() != requests.size()) {
            throw StorageConfigArchiveV1.invalid("RESTORE_FILE_PATH_OBSERVATION_UNAVAILABLE");
        }
        JsonArray result = new JsonArray();
        for (JsonElement entry : requests) {
            JsonObject request = object(entry);
            JsonObject path = paths.get(string(request, "resourceUuid"));
            String volume = string(request, "volumeUuid");
            JsonObject source = volumes.get(volume);
            JsonObject target = targetVolumes.get(volume);
            if (path == null || !path.keySet().equals(PROOF)
                    || REQUEST.stream().anyMatch(key -> !request.get(key).equals(path.get(key)))
                    || source == null || target == null || !"OBSERVED".equals(string(target, "state"))
                    || !"/".equals(string(target, "fsRoot"))
                    || !StorageConfigSnapshot.isUuid(string(path, "filesystemUuid"))
                    || !string(path, "filesystemUuid").equals(string(source, "filesystemUuid"))
                    || !string(path, "filesystemUuid").equals(string(target, "filesystemUuid"))
                    || !string(path, "mountSource").startsWith("/dev/")
                    || !string(path, "mountSource").equals(string(target, "mountSource"))
                    || !positive(path.get("rootInode")) || !positive(path.get("inode")) || !positive(path.get("mountId"))) {
                throw StorageConfigArchiveV1.invalid("RESTORE_FILE_PATH_IDENTITY_CHANGED");
            }
            result.add(path.deepCopy());
        }
        return result;
    }

    private static Map<String, JsonObject> index(JsonArray values, String key) {
        Map<String, JsonObject> result = new TreeMap<>();
        for (JsonElement value : values) {
            JsonObject row = object(value);
            if (result.putIfAbsent(string(row, key), row) != null) {
                throw StorageConfigArchiveV1.invalid("RESTORE_FILE_PATH_OBSERVATION_INVALID");
            }
        }
        return result;
    }

    private static boolean positive(JsonElement value) {
        return StorageConfigSnapshot.isInteger(value) && value.getAsLong() > 0;
    }
}
