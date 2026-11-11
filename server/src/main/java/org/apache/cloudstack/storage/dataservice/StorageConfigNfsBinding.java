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
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.TreeSet;

import static org.apache.cloudstack.storage.dataservice.StorageConfigSnapshot.array;
import static org.apache.cloudstack.storage.dataservice.StorageConfigSnapshot.object;
import static org.apache.cloudstack.storage.dataservice.StorageConfigSnapshot.string;

/** Keeps observed listening scope separate from the configured client address. */
final class StorageConfigNfsBinding {
    private static final String SERVICE_WIDE = "SERVICE_WIDE";
    private static final Set<String> FAMILIES = Set.of("IPv4", "IPv6");

    private StorageConfigNfsBinding() {
    }

    static Map<Integer, JsonObject> bindings(JsonElement value) {
        Map<Integer, JsonObject> result = new TreeMap<>();
        for (JsonElement entry : array(value)) {
            JsonObject row = object(entry);
            if (!row.keySet().equals(Set.of("port", "mode", "protocolMode", "families", "bindAddresses", "addresses"))
                    || !Set.of(SERVICE_WIDE, "DEDICATED").contains(string(row, "mode"))
                    || !Set.of("V4_ONLY", "V3V4_DUAL").contains(string(row, "protocolMode"))) {
                throw StorageConfigArchiveV1.invalid("NFS_BINDING_OBSERVATION_INVALID");
            }
            Set<String> families = strings(row.get("families"));
            Set<String> bindAddresses = addresses(row.get("bindAddresses"), true);
            Set<String> clientAddresses = addresses(row.get("addresses"), false);
            boolean wildcard = SERVICE_WIDE.equals(string(row, "mode"));
            if (families.isEmpty() || !FAMILIES.containsAll(families) || bindAddresses.isEmpty()
                    || bindAddresses.stream().anyMatch(address -> unspecified(address) != wildcard || !families.contains(family(address)))
                    || clientAddresses.stream().anyMatch(address -> !families.contains(family(address)))
                    || !wildcard && !bindAddresses.containsAll(clientAddresses)
                    || result.putIfAbsent(port(row.get("port")), row) != null) {
                throw StorageConfigArchiveV1.invalid("NFS_BINDING_OBSERVATION_INVALID");
            }
        }
        return result;
    }

    static Map<Integer, String> configuredPorts(JsonObject desired) {
        Map<Integer, String> ports = new LinkedHashMap<>();
        Set<String> modes = new TreeSet<>();
        for (JsonElement entry : array(desired.get("listeners"))) {
            JsonObject listener = object(entry);
            if (!"NFS".equals(string(listener, "protocol"))) {
                continue;
            }
            JsonObject settings = object(listener.get("settings"));
            if (settings.has("protocolMode")) {
                modes.add(string(settings, "protocolMode"));
            }
            if (listener.get("enabled").getAsBoolean()) {
                ports.put(listener.has("port") ? port(listener.get("port")) : 2049, null);
            }
        }
        if (modes.size() > 1) {
            throw StorageConfigArchiveV1.invalid("NFS_PROTOCOL_MODE_CONFLICT");
        }
        String mode = modes.isEmpty() ? "V4_ONLY" : modes.iterator().next();
        if (!Set.of("V4_ONLY", "V3V4_DUAL").contains(mode)
                || "V3V4_DUAL".equals(mode) && ports.keySet().stream().anyMatch(port -> port != 2049)) {
            throw StorageConfigArchiveV1.invalid("NFS_PROTOCOL_MODE_INVALID");
        }
        ports.replaceAll((port, value) -> mode);
        return ports;
    }

    static Map<Integer, String> activePorts(JsonObject desired) {
        Map<Integer, String> configured = configuredPorts(desired);
        boolean hasNfsListener = array(desired.get("listeners")).asList().stream()
                .map(StorageConfigSnapshot::object).anyMatch(row -> "NFS".equals(string(row, "protocol")));
        Map<Integer, String> active = new TreeMap<>();
        if (hasNfsListener && configured.isEmpty()) {
            return active;
        }
        String mode = configured.isEmpty() ? "V4_ONLY" : configured.values().iterator().next();
        int fallback = configured.isEmpty() || configured.containsKey(2049) ? 2049 : configured.keySet().iterator().next();
        for (JsonElement entry : array(desired.get("files"))) {
            JsonObject file = object(entry);
            if (!"NFS".equals(string(file, "protocol"))
                    || !Set.of("Ready", "Updating").contains(string(file, "state"))
                    || string(file, "path").isBlank()) {
                continue;
            }
            if ("V3V4_DUAL".equals(mode)) {
                active.put(2049, mode);
                continue;
            }
            JsonObject settings = object(file.get("settings"));
            JsonArray ports = settings.has("listenerGroupPorts") ? array(settings.get("listenerGroupPorts")) : new JsonArray();
            if (ports.size() == 0) {
                active.put(fallback, mode);
            } else {
                for (JsonElement value : ports) {
                    active.put(port(value), mode);
                }
            }
        }
        return active;
    }

    static JsonArray observed(JsonObject desired, JsonObject observation, String boot) {
        if (!StorageConfigSnapshot.isUuid(boot) || !boot.equals(string(observation, "bootId"))) {
            throw StorageConfigArchiveV1.invalid("NFS_BINDING_OBSERVATION_UNAVAILABLE");
        }
        Map<Integer, JsonObject> live = bindings(observation.get("listeners"));
        requirePorts(activePorts(desired), live);
        return rows(live);
    }

    static JsonObject plan(JsonObject desired, JsonObject targetState, JsonObject source, JsonObject target,
            String boot, Set<String> owned) {
        if (source == null || !"OBSERVED".equals(string(source, "state"))
                || !StorageConfigSnapshot.isUuid(string(source, "bootId"))
                || string(source, "observedAt").isEmpty() || !source.has("bindings")) {
            throw StorageConfigArchiveV1.invalid("NFS_SOURCE_BINDING_UNCONFIRMED");
        }
        Map<Integer, JsonObject> sourcePorts = bindings(source.get("bindings"));
        Map<Integer, String> sourceActive = activePorts(desired);
        if (sourceActive.isEmpty()) {
            throw StorageConfigArchiveV1.invalid("NFS_SOURCE_BINDING_UNCONFIRMED");
        }
        requirePorts(sourceActive, sourcePorts);
        Set<String> targetIps = verifiedTargetAddresses(target, boot, owned);
        Map<Integer, JsonObject> targetPorts = bindings(target.get("listeners"));
        requirePorts(activePorts(targetState), targetPorts);

        Map<Integer, JsonObject> expected = new TreeMap<>();
        for (Integer port : retainedPorts(targetState, desired)) {
            expected.put(port, targetPorts.get(port));
        }
        JsonArray changes = new JsonArray();
        for (Map.Entry<Integer, JsonObject> entry : sourcePorts.entrySet()) {
            JsonObject sourcePort = entry.getValue();
            if (!SERVICE_WIDE.equals(string(sourcePort, "mode"))) {
                throw StorageConfigArchiveV1.invalid("NFS_DEDICATED_RESTORE_UNSUPPORTED");
            }
            JsonObject candidate = sourcePort.deepCopy();
            Set<String> families = strings(candidate.get("families"));
            Set<String> clientIps = new TreeSet<>();
            targetIps.stream().filter(ip -> families.contains(family(ip))).forEach(clientIps::add);
            if (clientIps.isEmpty()) {
                throw StorageConfigArchiveV1.invalid("NFS_TARGET_ADDRESS_UNCONFIRMED");
            }
            candidate.add("addresses", strings(clientIps));
            JsonObject previous = targetPorts.get(entry.getKey());
            expected.put(entry.getKey(), candidate);
            if (previous != null && (!SERVICE_WIDE.equals(string(previous, "mode"))
                    || !string(previous, "protocolMode").equals(string(candidate, "protocolMode")))) {
                throw StorageConfigArchiveV1.invalid("NFS_TARGET_BINDING_CONFLICT");
            }
            JsonObject change = new JsonObject();
            change.add("source", sourcePort.deepCopy());
            if (previous != null) {
                change.add("before", previous.deepCopy());
            }
            change.add("after", candidate.deepCopy());
            changes.add(change);
        }
        for (Map.Entry<Integer, JsonObject> entry : targetPorts.entrySet()) {
            if (!expected.containsKey(entry.getKey())) {
                JsonObject change = new JsonObject();
                change.add("before", entry.getValue().deepCopy());
                changes.add(change);
            }
        }
        if (expected.values().stream().anyMatch(row -> !SERVICE_WIDE.equals(string(row, "mode")))
                || expected.values().stream().map(row -> string(row, "protocolMode")).distinct().count() != 1) {
            throw StorageConfigArchiveV1.invalid("NFS_TARGET_BINDING_CONFLICT");
        }
        JsonObject result = new JsonObject();
        result.addProperty("bootId", boot);
        result.add("interfaces", target.getAsJsonArray("interfaces").deepCopy());
        result.add("listeners", rows(expected));
        result.add("beforeListeners", rows(targetPorts));
        Set<Integer> watched = new TreeSet<>(configuredPorts(targetState).keySet());
        watched.addAll(configuredPorts(desired).keySet());
        watched.addAll(expected.keySet());
        watched.addAll(targetPorts.keySet());
        JsonArray watchPorts = new JsonArray();
        watched.forEach(watchPorts::add);
        result.add("watchPorts", watchPorts);
        result.add("changes", changes);
        return result;
    }

    private static Set<Integer> retainedPorts(JsonObject target, JsonObject desired) {
        Set<String> replacing = new java.util.HashSet<>();
        for (JsonElement value : array(desired.get("files"))) {
            JsonObject file = object(value);
            if ("NFS".equals(string(file, "protocol"))) {
                replacing.add(string(file, "name"));
            }
        }
        JsonArray retained = new JsonArray();
        for (JsonElement value : array(target.get("files"))) {
            JsonObject file = object(value);
            if ("NFS".equals(string(file, "protocol")) && !replacing.contains(string(file, "name"))) {
                retained.add(file);
            }
        }
        JsonObject remaining = new JsonObject();
        remaining.add("files", retained);
        remaining.add("listeners", target.get("listeners"));
        return activePorts(remaining).keySet();
    }

    static Set<String> verifiedTargetAddresses(JsonObject target, String boot, Set<String> owned) {
        if (target == null || !StorageConfigSnapshot.isUuid(boot) || !boot.equals(string(target, "bootId"))) {
            throw StorageConfigArchiveV1.invalid("NFS_TARGET_NETWORK_UNCONFIRMED");
        }
        Set<String> observed = new TreeSet<>();
        for (JsonElement item : array(target.get("interfaces"))) {
            JsonObject nic = object(item);
            String address = string(nic, "address");
            String mac = string(nic, "mac");
            JsonElement prefix = nic.get("prefix");
            if (!nic.keySet().equals(Set.of("address", "interface", "mac", "prefix")) || !validAddress(address)
                    || unspecified(address) || !owned.contains(address) || !observed.add(address)
                    || !string(nic, "interface").matches("[a-zA-Z0-9_.:-]{1,15}")
                    || !mac.matches("(?i)[0-9a-f]{2}(:[0-9a-f]{2}){5}")
                    || !StorageConfigSnapshot.isInteger(prefix) || prefix.getAsLong() > (NetUtils.isValidIp4(address) ? 32 : 128)) {
                throw StorageConfigArchiveV1.invalid("NFS_TARGET_NETWORK_UNCONFIRMED");
            }
        }
        if (observed.isEmpty() || !observed.equals(owned)) {
            throw StorageConfigArchiveV1.invalid("NFS_TARGET_NETWORK_UNCONFIRMED");
        }
        return observed;
    }

    private static void requirePorts(Map<Integer, String> configured, Map<Integer, JsonObject> observed) {
        if (!configured.keySet().equals(observed.keySet()) || configured.entrySet().stream()
                .anyMatch(entry -> !entry.getValue().equals(string(observed.get(entry.getKey()), "protocolMode")))) {
            throw StorageConfigArchiveV1.invalid("NFS_BINDING_PORTS_UNCONFIRMED");
        }
    }

    private static int port(JsonElement value) {
        if (!StorageConfigSnapshot.isInteger(value) || value.getAsLong() < 1 || value.getAsLong() > 65535) {
            throw StorageConfigArchiveV1.invalid("NFS_BINDING_PORT_INVALID");
        }
        return value.getAsInt();
    }

    private static Set<String> addresses(JsonElement value, boolean allowWildcard) {
        Set<String> result = strings(value);
        if (result.stream().anyMatch(address -> !validAddress(address) || !allowWildcard && unspecified(address))) {
            throw StorageConfigArchiveV1.invalid("NFS_BINDING_ADDRESS_INVALID");
        }
        return result;
    }

    private static boolean validAddress(String address) {
        return NetUtils.isValidIp4(address) || NetUtils.isValidIp6(address);
    }

    private static String family(String address) {
        return NetUtils.isValidIp4(address) ? "IPv4" : "IPv6";
    }

    private static boolean unspecified(String address) {
        return StorageConfigSnapshot.unspecifiedListenerAddress(address);
    }

    private static Set<String> strings(JsonElement value) {
        Set<String> result = new TreeSet<>();
        for (JsonElement item : array(value)) {
            if (!item.isJsonPrimitive() || !item.getAsJsonPrimitive().isString() || !result.add(item.getAsString())) {
                throw StorageConfigArchiveV1.invalid("NFS_BINDING_OBSERVATION_INVALID");
            }
        }
        return result;
    }

    private static JsonArray strings(Set<String> values) {
        JsonArray result = new JsonArray();
        values.forEach(result::add);
        return result;
    }

    private static JsonArray rows(Map<Integer, JsonObject> values) {
        JsonArray result = new JsonArray();
        values.values().forEach(row -> result.add(row.deepCopy()));
        return result;
    }
}
