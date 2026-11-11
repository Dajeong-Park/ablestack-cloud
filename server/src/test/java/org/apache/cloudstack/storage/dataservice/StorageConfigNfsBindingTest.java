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

import com.cloud.exception.InvalidParameterValueException;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import java.util.Map;
import java.util.Set;
import org.junit.Test;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertThrows;

public class StorageConfigNfsBindingTest {
    private static final String BOOT = "af680382-6f3c-4d9b-8c34-e1d4229f7465";
    private static final String IP = "192.0.2.21";

    @Test
    public void configuredButUnusedPortsDoNotRequireSockets() {
        JsonObject fresh = desired("V4_ONLY");
        JsonObject source = desired("V4_ONLY");
        export(source, "data", "Ready", 2050);
        JsonObject plan = StorageConfigNfsBinding.plan(source, fresh, sourceBinding(2050, "V4_ONLY"),
                target(), BOOT, Set.of(IP));
        assertEquals(0, plan.getAsJsonArray("beforeListeners").size());
        assertEquals(2050, plan.getAsJsonArray("listeners").get(0).getAsJsonObject().get("port").getAsInt());
    }

    @Test
    public void refusesBothMissingActiveAndUnexpectedUnusedSockets() {
        JsonObject source = desired("V4_ONLY");
        export(source, "data", "Ready", 2050);
        JsonObject current = desired("V4_ONLY");
        export(current, "other", "Updating", 2049);
        JsonObject observed = target();
        assertBindingMismatch(source, current, observed);
        observed.getAsJsonArray("listeners").add(binding(2049, "V4_ONLY"));
        observed.getAsJsonArray("listeners").add(binding(2050, "V4_ONLY"));
        assertBindingMismatch(source, current, observed);
        assertBindingMismatch(source, desired("V4_ONLY"), observed);
        observed.getAsJsonArray("listeners").remove(1);
        JsonObject plan = StorageConfigNfsBinding.plan(source, current, sourceBinding(2050, "V4_ONLY"),
                observed, BOOT, Set.of(IP));
        assertEquals(2, plan.getAsJsonArray("listeners").size());
    }

    @Test
    public void removesSocketExpectationWhenItsLastExportMoves() {
        JsonObject source = desired("V4_ONLY");
        export(source, "data", "Ready", 2050);
        JsonObject current = desired("V4_ONLY");
        export(current, "data", "Ready", 2049);
        JsonObject observed = target();
        observed.getAsJsonArray("listeners").add(binding(2049, "V4_ONLY"));
        JsonObject plan = StorageConfigNfsBinding.plan(source, current, sourceBinding(2050, "V4_ONLY"),
                observed, BOOT, Set.of(IP));
        assertEquals(1, plan.getAsJsonArray("listeners").size());
        assertEquals(2050, plan.getAsJsonArray("listeners").get(0).getAsJsonObject().get("port").getAsInt());
        assertEquals(2049, plan.getAsJsonArray("changes").get(1).getAsJsonObject()
                .getAsJsonObject("before").get("port").getAsInt());
    }

    @Test
    public void keepsDualModeOn2049AndIgnoresInactiveShares() {
        JsonObject dual = desired("V3V4_DUAL");
        assertEquals(Map.of(), StorageConfigNfsBinding.activePorts(dual));
        export(dual, "data", "Ready", 2050);
        assertEquals(Map.of(2049, "V3V4_DUAL"), StorageConfigNfsBinding.activePorts(dual));
        JsonObject v4 = desired("V4_ONLY");
        export(v4, "unused", "Disabled", 2050);
        export(v4, "notready", "Allocated", 2050);
        export(v4, "default", "Ready");
        assertEquals(Map.of(2049, "V4_ONLY"), StorageConfigNfsBinding.activePorts(v4));
    }

    private static void assertBindingMismatch(JsonObject source, JsonObject current, JsonObject observation) {
        InvalidParameterValueException error = assertThrows(InvalidParameterValueException.class, () ->
                StorageConfigNfsBinding.plan(source, current, sourceBinding(2050, "V4_ONLY"), observation, BOOT, Set.of(IP)));
        assertEquals("NFS_BINDING_PORTS_UNCONFIRMED", error.getMessage());
    }

    private static JsonObject desired(String mode) {
        JsonObject value = new JsonObject();
        JsonArray listeners = new JsonArray();
        for (int port : mode.equals("V3V4_DUAL") ? new int[]{2049} : new int[]{2049, 2050}) {
            JsonObject listener = new JsonObject();
            listener.addProperty("protocol", "NFS");
            listener.addProperty("enabled", true);
            listener.addProperty("port", port);
            JsonObject settings = new JsonObject();
            settings.addProperty("protocolMode", mode);
            listener.add("settings", settings);
            listeners.add(listener);
        }
        value.add("listeners", listeners);
        value.add("files", new JsonArray());
        return value;
    }

    private static void export(JsonObject value, String name, String state, int... ports) {
        JsonObject share = new JsonObject();
        share.addProperty("name", name);
        share.addProperty("protocol", "NFS");
        share.addProperty("path", "/export/" + name);
        share.addProperty("state", state);
        JsonObject settings = new JsonObject();
        JsonArray groups = new JsonArray();
        for (int port : ports) {
            groups.add(port);
        }
        settings.add("listenerGroupPorts", groups);
        share.add("settings", settings);
        value.getAsJsonArray("files").add(share);
    }

    private static JsonObject binding(int port, String mode) {
        JsonObject value = JsonParser.parseString("{\"mode\":\"SERVICE_WIDE\",\"families\":[\"IPv4\",\"IPv6\"],"
                + "\"bindAddresses\":[\"::\"],\"addresses\":[\"192.0.2.21\"]}").getAsJsonObject();
        value.addProperty("port", port);
        value.addProperty("protocolMode", mode);
        return value;
    }

    private static JsonObject sourceBinding(int port, String mode) {
        JsonObject value = new JsonObject();
        value.addProperty("state", "OBSERVED");
        value.addProperty("bootId", BOOT);
        value.addProperty("observedAt", "2026-11-06T05:00:00Z");
        JsonArray bindings = new JsonArray();
        bindings.add(binding(port, mode));
        value.add("bindings", bindings);
        return value;
    }

    private static JsonObject target() {
        JsonObject value = JsonParser.parseString("{\"interfaces\":[{\"interface\":\"eth0\",\"address\":\"192.0.2.21\","
                + "\"mac\":\"02:00:00:00:00:01\",\"prefix\":24}],\"listeners\":[]}").getAsJsonObject();
        value.addProperty("bootId", BOOT);
        return value;
    }
}
