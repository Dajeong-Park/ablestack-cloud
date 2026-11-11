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

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertThrows;

import com.cloud.utils.exception.CloudRuntimeException;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import org.junit.Test;

public class SharedFSComputeReceiptTest {
    private static final String OPERATION = "b17d08d3-0000-4000-8000-a3bb4895bed2";
    private static final long ADDRESS = 5_368_709_120L;
    private static final long SIZE = 4_294_967_296L;

    @Test
    public void hostSuccessIsNotGuestSuccess() {
        JsonObject beforeHost = host(4194304);
        JsonObject afterHost = host(8388608);
        JsonObject dimm = json("{\"hotplugged\":true,\"node\":0,\"size\":" + SIZE + ",\"addr\":" + ADDRESS + "}");
        afterHost.getAsJsonObject("dimms").add("ua-sharedfs-" + OPERATION, dimm);
        JsonObject request = SharedFSComputeCoordinator.verifyHostEffect(beforeHost, afterHost, OPERATION, 2, 8388608);

        JsonObject beforeGuest = guest(4007648);
        JsonObject guestPartial = guest(5056224);
        JsonObject guestVerified = guest(8201952);
        for (int block = 40; block < 72; block++) {
            String id = Integer.toString(block);
            guestPartial.getAsJsonObject("blocks").addProperty(id, block < 48 ? "online" : "offline");
            guestVerified.getAsJsonObject("blocks").addProperty(id, "online");
        }
        CloudRuntimeException failure = assertThrows(CloudRuntimeException.class,
                () -> SharedFSComputeCoordinator.verifyGuestEffect(beforeGuest, guestPartial, request, 2));
        assertEquals("COMPUTE_GUEST_PARTIAL", failure.getMessage());
        SharedFSComputeCoordinator.verifyGuestEffect(beforeGuest, guestVerified, request, 2);
    }

    @Test
    public void identicalSizeDoesNotAcceptAnotherOperationsDimm() {
        JsonObject after = host(8388608);
        after.getAsJsonObject("dimms").add("dimm0", json("{\"hotplugged\":true,\"node\":0,\"size\":" + SIZE + ",\"addr\":" + ADDRESS + "}"));
        CloudRuntimeException failure = assertThrows(CloudRuntimeException.class,
                () -> SharedFSComputeCoordinator.verifyHostEffect(host(4194304), after, OPERATION, 2, 8388608));
        assertEquals("COMPUTE_DIMM_IDENTITY_UNVERIFIED", failure.getMessage());
    }

    private static JsonObject host(long memory) {
        return json("{\"domainId\":4,\"diskFingerprint\":\"root-and-data\",\"maxCpus\":8,\"maxMemoryKiB\":16777216,\"slots\":16,"
                + "\"cpus\":{\"0\":{},\"1\":{}},\"dimms\":{},\"memoryKiB\":" + memory + "}");
    }

    private static JsonObject guest(long memory) {
        return json("{\"cpus\":{\"0\":{\"online\":true},\"1\":{\"online\":true}},\"blocks\":{\"0\":\"online\"},\"memoryKiB\":" + memory + "}");
    }

    private static JsonObject json(String value) {
        return JsonParser.parseString(value).getAsJsonObject();
    }
}
