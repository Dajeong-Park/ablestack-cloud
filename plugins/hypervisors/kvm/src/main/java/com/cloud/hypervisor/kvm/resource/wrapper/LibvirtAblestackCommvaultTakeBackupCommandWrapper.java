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
import org.apache.commons.lang3.StringUtils;

@ResourceWrapper(handles = AblestackCommvaultTakeBackupCommand.class)
public class LibvirtAblestackCommvaultTakeBackupCommandWrapper extends CommandWrapper<AblestackCommvaultTakeBackupCommand, Answer, LibvirtComputingResource> {
    private static final String BACKUP_TRACE = "[ABLESTACK_COMMVAULT_BACKUP_TRACE]";

    @Override
    public Answer execute(AblestackCommvaultTakeBackupCommand command, LibvirtComputingResource libvirtComputingResource) {
        logger.info("{} phase=[AGENT_ENTER], vm=[{}], backupPath=[{}], backupType=[{}]",
                BACKUP_TRACE, command.getVmName(), command.getBackupPath(), command.getBackupType());
        LibvirtAblestackCommvaultBackupHelper backupHelper = new LibvirtAblestackCommvaultBackupHelper(libvirtComputingResource);
        if (!command.isWaitForCompletion()) {
            String[] detachedCommand = backupHelper.buildDetachedBackupScriptCommand(command);
            if (detachedCommand != null) {
                return LibvirtAblestackAsyncBackupRunner.startDetached(command, logger, BACKUP_TRACE, "Commvault", command.getBackupJobId(),
                        command.getVmName(), command.getBackupPath(), command.getBackupType(), detachedCommand);
            }
            logger.info("{} phase=[AGENT_DETACHED_FALLBACK], provider=[Commvault], jobId=[{}], vm=[{}], backupPath=[{}], backupType=[{}]",
                    BACKUP_TRACE, command.getBackupJobId(), command.getVmName(), command.getBackupPath(), command.getBackupType());
            return LibvirtAblestackAsyncBackupRunner.start(command, logger, BACKUP_TRACE, "Commvault", command.getBackupJobId(),
                    command.getVmName(), command.getBackupPath(), command.getBackupType(),
                    () -> backupHelper.executeBackup(command));
        }
        Pair<Integer, String> result = backupHelper.executeBackup(command);

        if (result.first() != 0) {
            String failureDetails = StringUtils.defaultIfBlank(result.second(),
                    "Commvault backup helper returned failure without details");
            logger.warn("{} phase=[AGENT_FAILED], vm=[{}], backupPath=[{}], backupType=[{}], resultCode=[{}], reason=[{}]",
                    BACKUP_TRACE, command.getVmName(), command.getBackupPath(), command.getBackupType(), result.first(), failureDetails);
            logger.warn("Failed to take VM backup for [{}]: {}", command.getVmName(), failureDetails);
            BackupAnswer answer = new BackupAnswer(command, false, failureDetails);
            if (result.first() == LibvirtAblestackCommvaultBackupHelper.EXIT_CLEANUP_FAILED) {
                logger.debug("Backup cleanup failed");
                answer.setNeedsCleanup(true);
            }
            return answer;
        }

        logger.info("{} phase=[AGENT_DONE], vm=[{}], backupPath=[{}], backupType=[{}]",
                BACKUP_TRACE, command.getVmName(), command.getBackupPath(), command.getBackupType());
        BackupAnswer answer = new BackupAnswer(command, true, "success");
        return answer;
    }
}
