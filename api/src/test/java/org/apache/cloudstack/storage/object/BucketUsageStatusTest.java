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
package org.apache.cloudstack.storage.object;
import static org.junit.Assert.assertEquals;
import java.util.Date;
import org.junit.Test;
public class BucketUsageStatusTest {
    @Test public void legacySizeDoesNotImplySuccessfulCollection() {
        assertEquals("Unknown", Bucket.usageStatus(null, null, new Date()));
        assertEquals("Unknown", Bucket.usageStatus("Fresh", null, new Date()));
    }
    @Test public void freshnessExpiresAndFutureClockIsNotFresh() {
        Date now = new Date(4000000);
        assertEquals("Fresh", Bucket.usageStatus("Fresh", new Date(400000), now));
        assertEquals("Stale", Bucket.usageStatus("Fresh", new Date(399999), now));
        assertEquals("Stale", Bucket.usageStatus("Fresh", new Date(4000001), now));
    }
    @Test public void failurePersistsIndependentlyOfLastSuccessAge() {
        assertEquals("Error", Bucket.usageStatus("Error", new Date(1), new Date(9000000)));
    }
    @Test public void responseKeepsKiBAndOrdersAttemptsWithinOneFormattedSecond() {
        var response = new org.apache.cloudstack.api.response.BucketResponse();
        response.setSize(4L); response.setUsageLastAttempt(new Date(1900));
        var json = com.google.gson.JsonParser.parseString(new com.google.gson.Gson().toJson(response)).getAsJsonObject();
        assertEquals(4L, json.get("size").getAsLong()); assertEquals(1900L, json.get("usagelastattemptms").getAsLong());
        response.setUsageLastAttemptMs(1901L);
        json = com.google.gson.JsonParser.parseString(new com.google.gson.Gson().toJson(response)).getAsJsonObject();
        assertEquals(1901L, json.get("usagelastattemptms").getAsLong());
    }

}
