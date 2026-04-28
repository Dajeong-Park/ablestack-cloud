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
import com.cloud.utils.script.Script;
import org.apache.cloudstack.backup.BackupAnswer;
import org.apache.cloudstack.backup.AblestackDeleteBackupCommand;
import org.apache.commons.lang3.StringUtils;

import java.util.ArrayList;
import java.util.List;

@ResourceWrapper(handles = AblestackDeleteBackupCommand.class)
public class LibvirtAblestackDeleteBackupCommandWrapper extends CommandWrapper<AblestackDeleteBackupCommand, Answer, LibvirtComputingResource> {
    @Override
    public Answer execute(AblestackDeleteBackupCommand command, LibvirtComputingResource libvirtComputingResource) {
        final String backupPath = command.getBackupPath();
        final String backupRepoType = command.getBackupRepoType();
        final String backupRepoAddress = command.getBackupRepoAddress();
        final String mountOptions = command.getMountOptions();
        final String backupProvider = command.getBackupProvider();
        final String checkpointName = command.getCheckpointName();
        final String diskPaths = command.getDiskPaths();
        final boolean forced = command.isForced();

        List<String[]> commands = new ArrayList<>();
        if ("ablestack-commvault".equalsIgnoreCase(backupProvider)) {
            List<String> deleteCommand = new ArrayList<>();
            deleteCommand.add(libvirtComputingResource.getAbleCvtBackupPath());
            deleteCommand.add("-o");
            deleteCommand.add("delete");
            deleteCommand.add("-p");
            deleteCommand.add(backupPath);
            deleteCommand.add("-x");
            deleteCommand.add(Boolean.toString(forced));
            if (StringUtils.isNotBlank(checkpointName)) {
                deleteCommand.add("-c");
                deleteCommand.add(checkpointName);
            }
            if (StringUtils.isNotBlank(diskPaths)) {
                deleteCommand.add("-d");
                deleteCommand.add(diskPaths);
            }
            commands.add(deleteCommand.toArray(new String[0]));
        } else {
            List<String> deleteCommand = new ArrayList<>();
            deleteCommand.add(libvirtComputingResource.getAbleNasBackupPath());
            deleteCommand.add("-o");
            deleteCommand.add("delete");
            deleteCommand.add("-t");
            deleteCommand.add(backupRepoType);
            deleteCommand.add("-s");
            deleteCommand.add(backupRepoAddress);
            deleteCommand.add("-m");
            deleteCommand.add(mountOptions);
            deleteCommand.add("-p");
            deleteCommand.add(backupPath);
            deleteCommand.add("-x");
            deleteCommand.add(Boolean.toString(forced));
            if (StringUtils.isNotBlank(checkpointName)) {
                deleteCommand.add("-c");
                deleteCommand.add(checkpointName);
            }
            if (StringUtils.isNotBlank(diskPaths)) {
                deleteCommand.add("-d");
                deleteCommand.add(diskPaths);
            }
            commands.add(deleteCommand.toArray(new String[0]));
        }

        Pair<Integer, String> result = Script.executePipedCommands(commands, libvirtComputingResource.getCmdsTimeout());

        logger.debug(String.format("Backup delete result: %s , exit code: %s", result.second(), result.first()));

        if (result.first() != 0) {
            logger.debug(String.format("Failed to delete VM backup: %s", result.second()));
            return new BackupAnswer(command, false, result.second());
        }
        return new BackupAnswer(command, true, null);
    }
}
