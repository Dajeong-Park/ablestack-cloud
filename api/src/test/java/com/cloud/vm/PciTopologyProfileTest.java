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
package com.cloud.vm;

import java.util.HashMap;
import java.util.Map;
import org.junit.Test;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertThrows;

public class PciTopologyProfileTest {
    @Test public void roundTripCopiesOnlyOwnedKeysWithoutMutatingInput() {
        Map<String, String> source = new HashMap<>(Map.of("UEFI", "LEGACY", "rootDiskController", "scsi"));
        Map<String, String> stored = PciTopologyProfile.WINDOWS_Q35_16.withDetails(source);
        assertNull(PciTopologyProfile.fromDetails(source));
        assertEquals(PciTopologyProfile.WINDOWS_Q35_16, PciTopologyProfile.fromDetails(stored));
        assertEquals("scsi", stored.get("rootDiskController"));
        assertEquals(2, source.size());
    }

    @Test public void unknownAndPartialVersionsCannotSilentlyChooseAnotherAbi() {
        for (Map<String, String> invalid : java.util.List.of(
                Map.of(PciTopologyProfile.VERSION_KEY, "1"),
                Map.of(PciTopologyProfile.PROFILE_KEY, "foreign", PciTopologyProfile.VERSION_KEY, "1"),
                Map.of(PciTopologyProfile.PROFILE_KEY, PciTopologyProfile.LEGACY_AUTO.id()),
                Map.of(PciTopologyProfile.PROFILE_KEY, PciTopologyProfile.LEGACY_AUTO.id(), PciTopologyProfile.VERSION_KEY, "2"))) {
            assertThrows(IllegalArgumentException.class, () -> PciTopologyProfile.fromDetails(invalid));
        }
    }
}
