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
package com.cloud.hypervisor.kvm.resource.wrapper;

import java.util.concurrent.atomic.AtomicInteger;

import com.cloud.hypervisor.kvm.resource.LibvirtComputingResource;
import com.cloud.utils.Pair;
import com.cloud.utils.script.Script;
import org.apache.cloudstack.backup.AblestackCommvaultTakeBackupCommand;
import org.apache.cloudstack.backup.AblestackDeleteBackupCommand;
import org.apache.cloudstack.backup.AblestackNetBackupTakeBackupCommand;
import org.apache.cloudstack.backup.AblestackVeeamTakeBackupCommand;
import org.junit.Test;
import org.mockito.Mockito;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;

public class LibvirtAblestackBackupTimeoutTest {
    @Test
    public void stagingWorkersReceiveDataTimeoutInsteadOfResponseOverride() {
        var resource = Mockito.mock(LibvirtComputingResource.class);
        AtomicInteger built = new AtomicInteger();
        try (var workers = Mockito.mockStatic(LibvirtAblestackVolumeBackupHelper.class, invocation -> {
            assertEquals(43200, invocation.<Integer>getArgument(9).intValue());
            built.incrementAndGet();
            return new String[] {"worker"};
        })) {
            var commvault = new AblestackCommvaultTakeBackupCommand("vm", "backup");
            commvault.setVolumeStagingManifest("{}");
            commvault.setTimeout(43200);
            commvault.setWait(30);
            new LibvirtAblestackCommvaultBackupHelper(resource).buildDetachedBackupScriptCommand(commvault);

            var netbackup = new AblestackNetBackupTakeBackupCommand("vm", "backup");
            netbackup.setVolumeStagingManifest("{}");
            netbackup.setTimeout(43200);
            netbackup.setWait(30);
            new LibvirtAblestackNetBackupHelper(resource).buildDetachedBackupScriptCommand(netbackup);

            var veeam = new AblestackVeeamTakeBackupCommand("vm", "backup");
            veeam.setVolumeStagingManifest("{}");
            veeam.setTimeout(43200);
            veeam.setWait(30);
            new LibvirtAblestackVeeamHelper(resource).buildDetachedBackupScriptCommand(veeam);
        }
        assertEquals(3, built.get());
    }

    @Test
    public void dataDeletionKeepsItsExecutionBudgetAndReportsTimeoutAsUnconfirmedFailure() {
        var resource = Mockito.mock(LibvirtComputingResource.class);
        var command = new AblestackDeleteBackupCommand("backup", "NFS", "nas:/backup", "", false);
        command.setTimeout(43200);
        command.setWait(30);
        try (var scripts = Mockito.mockStatic(Script.class)) {
            scripts.when(() -> Script.executePipedCommands(anyList(), eq(43200000L)))
                    .thenReturn(new Pair<>(0, "Deleted"));
            var wrapper = new LibvirtAblestackDeleteBackupCommandWrapper();
            assertTrue(wrapper.execute(command, resource).getResult());

            scripts.when(() -> Script.executePipedCommands(anyList(), eq(43200000L)))
                    .thenReturn(new Pair<>(-1, "timeout"));
            var timedOut = wrapper.execute(command, resource);
            assertFalse(timedOut.getResult());
            assertEquals("timeout", timedOut.getDetails());
        }
    }
}
