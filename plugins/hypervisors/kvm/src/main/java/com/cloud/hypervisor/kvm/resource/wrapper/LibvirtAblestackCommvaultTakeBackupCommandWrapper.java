//
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
//

package com.cloud.hypervisor.kvm.resource.wrapper;

import com.cloud.agent.api.Answer;
import com.cloud.hypervisor.kvm.resource.LibvirtComputingResource;
import com.cloud.resource.CommandWrapper;
import com.cloud.resource.ResourceWrapper;
import com.cloud.utils.Pair;
import org.apache.cloudstack.backup.BackupAnswer;
import org.apache.cloudstack.backup.AblestackCommvaultTakeBackupCommand;

@ResourceWrapper(handles = AblestackCommvaultTakeBackupCommand.class)
public class LibvirtAblestackCommvaultTakeBackupCommandWrapper extends CommandWrapper<AblestackCommvaultTakeBackupCommand, Answer, LibvirtComputingResource> {
    @Override
    public Answer execute(AblestackCommvaultTakeBackupCommand command, LibvirtComputingResource libvirtComputingResource) {
        LibvirtAblestackCommvaultBackupHelper backupHelper = new LibvirtAblestackCommvaultBackupHelper(libvirtComputingResource);
        Pair<Integer, String> result = backupHelper.executeBackup(command);

        if (result.first() != 0) {
            logger.debug("Failed to take VM backup");
            BackupAnswer answer = new BackupAnswer(command, false, null);
            if (result.first() == LibvirtAblestackCommvaultBackupHelper.EXIT_CLEANUP_FAILED) {
                logger.debug("Backup cleanup failed");
                answer.setNeedsCleanup(true);
            }
            return answer;
        }

        BackupAnswer answer = new BackupAnswer(command, true, "success");
        return answer;
    }
}
