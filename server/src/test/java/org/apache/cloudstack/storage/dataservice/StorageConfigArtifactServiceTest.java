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
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import org.junit.Assert;
import org.junit.Test;

public class StorageConfigArtifactServiceTest {
    private static final String SMB_ID = "d9233b73-72ad-40a4-aa16-5b6799e6aa55";
    private static final String WILDCARD_ID = "2be55cb2-b49e-46e8-aed1-b6c5a5a0f5cd";
    private static final String SMB_ADDRESS = "192.0.2.10";

    @Test
    public void observesReadySmbListenerUsingClusterInventoryContract() {
        JsonObject desired = desired(endpoint(SMB_ID, SMB_ADDRESS, 445, true));
        JsonObject result = observe(desired, inventory(), true);

        Assert.assertEquals("OBSERVED", state(result));
        JsonObject resource = result.getAsJsonArray("resources").get(0).getAsJsonObject();
        Assert.assertEquals(SMB_ID, resource.get("resource").getAsString());
        Assert.assertEquals(SMB_ADDRESS, resource.get("address").getAsString());
        Assert.assertEquals(445, resource.get("port").getAsInt());
        Assert.assertEquals("READY", state(resource));
        Assert.assertEquals(4, resource.size());
        Assert.assertEquals("UNAVAILABLE", state(observe(desired, inventory(), false)));
    }

    @Test
    public void rejectsMismatchedPendingAndIncompleteSmbInventory() {
        JsonObject desired = desired(endpoint(SMB_ID, SMB_ADDRESS, 445, true));
        for (String field : new String[] {"id", "listenIp", "port", "state"}) {
            JsonObject inventory = inventory();
            listeners(inventory).get(0).getAsJsonObject().remove(field);
            assertUnavailable(desired, inventory);
        }
        JsonObject inventory = inventory();
        JsonObject listener = listeners(inventory).get(0).getAsJsonObject();
        listener.addProperty("id", WILDCARD_ID);
        assertUnavailable(desired, inventory);
        listener.addProperty("id", SMB_ID);
        listener.addProperty("listenIp", "192.0.2.11");
        assertUnavailable(desired, inventory);
        listener.addProperty("listenIp", SMB_ADDRESS);
        listener.addProperty("port", 1445);
        assertUnavailable(desired, inventory);
        listener.addProperty("port", 445);
        listener.addProperty("state", "UNKNOWN");
        assertUnavailable(desired, inventory);
        listener.addProperty("state", "READY");
        inventory.getAsJsonObject("smbRuntime").addProperty("pending", true);
        assertUnavailable(desired, inventory);
        inventory.getAsJsonObject("smbRuntime").addProperty("pending", false);
        listeners(inventory).add(listener.deepCopy());
        assertUnavailable(desired, inventory);
        listeners(inventory).remove(0);
        listeners(inventory).remove(0);
        assertUnavailable(desired, inventory);
    }

    @Test
    public void requiresAnExpectedReadyWildcardOnTheSamePortForCoveredSmbListener() {
        JsonObject wildcard = endpoint(WILDCARD_ID, null, null, true);
        JsonObject desired = desired(endpoint(SMB_ID, SMB_ADDRESS, 445, true), wildcard);
        JsonObject inventory = inventory();
        JsonObject covered = listeners(inventory).get(0).getAsJsonObject();
        covered.addProperty("state", "COVERED");
        covered.addProperty("coveredBy", WILDCARD_ID);
        assertUnavailable(desired, inventory);

        JsonObject provider = new JsonObject();
        provider.addProperty("id", WILDCARD_ID);
        provider.addProperty("listenIp", "0.0.0.0");
        provider.addProperty("port", 445);
        provider.addProperty("state", "READY");
        listeners(inventory).add(provider);
        Assert.assertEquals("OBSERVED", state(observe(desired, inventory, true)));

        provider.addProperty("port", 1445);
        wildcard.addProperty("port", 1445);
        assertUnavailable(desired, inventory);
        provider.addProperty("port", 445);
        wildcard.addProperty("port", 445);
        provider.addProperty("state", "UNKNOWN");
        assertUnavailable(desired, inventory);
    }

    @Test
    public void ignoresDisabledSmbRowsAndPreservesOtherProtocolContracts() {
        JsonObject disabled = endpoint(SMB_ID, SMB_ADDRESS, 445, false);
        Assert.assertEquals("NOT_CONFIGURED", state(observe(desired(disabled), inventory(), true)));
        JsonObject nfs = endpoint(SMB_ID, SMB_ADDRESS, 2049, true);
        nfs.addProperty("protocol", "NFS");
        JsonObject inventory = JsonParser.parseString("{\"nfsGaneshaRuntime\":{\"listening\":true}}").getAsJsonObject();
        Assert.assertEquals("UNAVAILABLE", state(StorageConfigArtifactService.protocolObservation(desired(nfs), inventory, "NFS", true)));
    }

    private static void assertUnavailable(JsonObject desired, JsonObject inventory) {
        JsonObject result = observe(desired, inventory, true);
        Assert.assertEquals("UNAVAILABLE", state(result));
        Assert.assertFalse(result.has("resources"));
    }

    private static JsonObject observe(JsonObject desired, JsonObject inventory, boolean bootVerified) {
        return StorageConfigArtifactService.protocolObservation(desired, inventory, "SMB", bootVerified);
    }

    private static String state(JsonObject observation) {
        return observation.get("state").getAsString();
    }

    private static JsonArray listeners(JsonObject inventory) {
        return inventory.getAsJsonObject("smbRuntime").getAsJsonArray("listeners");
    }

    private static JsonObject inventory() {
        // Cluster 13 inventory v1. Listener ID, IP and PID are replaced with test values.
        return JsonParser.parseString("{\"smbRuntime\":{\"configured\":true,\"pending\":false,\"version\":1,"
                + "\"observedEpoch\":1793937585.55,\"ownedAliases\":[],\"listeners\":[{\"id\":\"" + SMB_ID
                + "\",\"listenIp\":\"" + SMB_ADDRESS + "\",\"pid\":1234,\"port\":445,\"state\":\"READY\"}]}}").getAsJsonObject();
    }

    private static JsonObject desired(JsonObject... endpoints) {
        JsonArray rows = new JsonArray();
        for (JsonObject endpoint : endpoints) {
            rows.add(endpoint);
        }
        JsonObject desired = new JsonObject();
        desired.add("listeners", rows);
        return desired;
    }

    private static JsonObject endpoint(String id, String address, Integer port, boolean enabled) {
        JsonObject row = new JsonObject();
        row.addProperty("protocol", "SMB");
        row.addProperty("uuid", id);
        row.addProperty("enabled", enabled);
        if (address != null) {
            row.addProperty("listenIp", address);
        }
        if (port != null) {
            row.addProperty("port", port);
        }
        return row;
    }
}
