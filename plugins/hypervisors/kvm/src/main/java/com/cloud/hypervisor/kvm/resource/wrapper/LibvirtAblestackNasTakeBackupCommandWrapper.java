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
import org.apache.cloudstack.backup.AblestackNasTakeBackupCommand;

import java.util.List;

@ResourceWrapper(handles = AblestackNasTakeBackupCommand.class)
public class LibvirtAblestackNasTakeBackupCommandWrapper extends CommandWrapper<AblestackNasTakeBackupCommand, Answer, LibvirtComputingResource> {
    private static final String BACKUP_TRACE = "[ABLESTACK_NAS_BACKUP_TRACE]";

    @Override
    public Answer execute(AblestackNasTakeBackupCommand command, LibvirtComputingResource libvirtComputingResource) {
        logger.info("{} phase=[AGENT_ENTER], vm=[{}], backupPath=[{}], backupType=[{}]",
                BACKUP_TRACE, command.getVmName(), command.getBackupPath(), command.getBackupType());
        logger.info("LibvirtTakeBackupCommandWrapper entering execute for vm=[{}], backupPath=[{}], backupType=[{}]",
                command.getVmName(), command.getBackupPath(), command.getBackupType());
        LibvirtAblestackNasBackupHelper backupHelper = new LibvirtAblestackNasBackupHelper(libvirtComputingResource);
        List<String> diskPaths = backupHelper.resolveDiskPaths(command.getVolumePools(), command.getVolumePaths());
        logger.info("LibvirtTakeBackupCommandWrapper invoking helper for vm=[{}], diskPaths=[{}]",
                command.getVmName(), diskPaths);
        if (!command.isWaitForCompletion()) {
            String[] detachedCommand = backupHelper.buildDetachedBackupScriptCommand(command);
            if (detachedCommand != null) {
                return LibvirtAblestackAsyncBackupRunner.startDetached(command, logger, BACKUP_TRACE, "NAS", command.getBackupJobId(),
                        command.getVmName(), command.getBackupPath(), command.getBackupType(), detachedCommand);
            }
            logger.info("{} phase=[AGENT_DETACHED_FALLBACK], provider=[NAS], jobId=[{}], vm=[{}], backupPath=[{}], backupType=[{}]",
                    BACKUP_TRACE, command.getBackupJobId(), command.getVmName(), command.getBackupPath(), command.getBackupType());
            return LibvirtAblestackAsyncBackupRunner.start(command, logger, BACKUP_TRACE, "NAS", command.getBackupJobId(),
                    command.getVmName(), command.getBackupPath(), command.getBackupType(),
                    () -> backupHelper.executeBackup(command));
        }
        Pair<Integer, String> result = backupHelper.executeBackup(command);
        if (result.first() == 0) {
            logger.info("{} phase=[AGENT_DONE], vm=[{}], backupPath=[{}], backupType=[{}]",
                    BACKUP_TRACE, command.getVmName(), command.getBackupPath(), command.getBackupType());
        } else {
            logger.warn("{} phase=[AGENT_FAILED], vm=[{}], backupPath=[{}], backupType=[{}], resultCode=[{}], reason=[{}]",
                    BACKUP_TRACE, command.getVmName(), command.getBackupPath(), command.getBackupType(), result.first(), result.second());
        }
        logger.info("LibvirtTakeBackupCommandWrapper helper returned for vm=[{}], resultCode=[{}], details=[{}]",
                command.getVmName(), result.first(), result.second());

        if (result.first() != 0) {
            logger.debug("Failed to take VM backup: " + result.second());
            BackupAnswer answer = new BackupAnswer(command, false, result.second().trim());
            if (result.first() == LibvirtAblestackNasBackupHelper.EXIT_CLEANUP_FAILED) {
                logger.debug("Backup cleanup failed");
                answer.setNeedsCleanup(true);
            }
            return answer;
        }

        BackupAnswer answer = new BackupAnswer(command, true, result.second().trim());
        try {
            answer.setSize(backupHelper.parseBackupSize(result.second(), diskPaths));
        } catch (RuntimeException e) {
            logger.warn("Failed to parse NAS backup size for vm=[{}], details=[{}]",
                    command.getVmName(), result.second(), e);
        }
        return answer;
    }
}
