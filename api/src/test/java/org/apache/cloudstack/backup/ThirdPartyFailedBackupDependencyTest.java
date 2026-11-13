// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements. See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership. The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License. You may obtain a copy of the License at
//
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied. See the License for the
// specific language governing permissions and limitations
// under the License.
package org.apache.cloudstack.backup;

import java.util.HashMap;
import java.util.Map;
import org.junit.Test;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

public class ThirdPartyFailedBackupDependencyTest {
    @Test public void closedFailureHistoryDoesNotOwnParentButUnconfirmedReadersRemainProtected() {
        Map<String, String> details = new HashMap<>();
        details.put(ThirdPartyBackupManifest.CLEANUP_STATE_KEY, "COMPLETED");
        details.put(ThirdPartyBackupManifest.JOB_CLEANUP_STATE_KEY, "COMPLETED");
        details.put(ThirdPartyBackupManifest.RETENTION_PROTECTION_KEY,
                "{\"version\":2,\"backupUuid\":\"failed-point\",\"readersClosed\":true,\"leaseActive\":false,\"state\":\"WAITING\"}");
        Backup backup = mock(Backup.class);
        when(backup.getStatus()).thenReturn(Backup.Status.Failed);
        when(backup.getUuid()).thenReturn("failed-point");
        when(backup.getDetails()).thenReturn(details);
        when(backup.getDetail(anyString())).thenAnswer(call -> details.get(call.getArgument(0)));
        assertTrue(ThirdPartyBackupVolumeService.closedFailedNetBackupDependency(backup));
        for (String key : new String[] {ThirdPartyBackupManifest.CLEANUP_STATE_KEY,
                ThirdPartyBackupManifest.JOB_CLEANUP_STATE_KEY, ThirdPartyBackupManifest.SOURCE_CLEANUP_STATE_KEY,
                ThirdPartyBackupRestore.CLEANUP_STATE_KEY}) {
            String previous = details.put(key, "WAITING");
            if (key.equals(ThirdPartyBackupRestore.CLEANUP_STATE_KEY)) {
                details.put(ThirdPartyBackupRestore.PLAN_KEY, "{}");
            }
            assertFalse(ThirdPartyBackupVolumeService.closedFailedNetBackupDependency(backup));
            details.remove(ThirdPartyBackupRestore.PLAN_KEY);
            if (previous == null) details.remove(key); else details.put(key, previous);
        }
        details.put(ThirdPartyBackupAdmission.BACKUP_KEY,
                "{\"jobId\":\"failed-point\",\"state\":\"ADMITTED\"}");
        assertFalse(ThirdPartyBackupVolumeService.closedFailedNetBackupDependency(backup));
        details.remove(ThirdPartyBackupAdmission.BACKUP_KEY);
        details.put(ThirdPartyBackupManifest.RETENTION_PROTECTION_KEY, "{\"readersClosed\":true}");
        assertFalse(ThirdPartyBackupVolumeService.closedFailedNetBackupDependency(backup));
    }
}
