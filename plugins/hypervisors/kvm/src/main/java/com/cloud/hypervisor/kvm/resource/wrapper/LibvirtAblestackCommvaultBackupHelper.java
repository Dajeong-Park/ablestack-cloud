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

import com.cloud.hypervisor.kvm.resource.LibvirtConnection;
import com.cloud.hypervisor.kvm.resource.LibvirtComputingResource;
import com.cloud.hypervisor.kvm.storage.KVMPhysicalDisk;
import com.cloud.hypervisor.kvm.storage.KVMStoragePool;
import com.cloud.hypervisor.kvm.storage.KVMStoragePoolManager;
import com.cloud.storage.Storage;
import com.cloud.utils.Pair;
import com.cloud.utils.script.Script;
import org.apache.cloudstack.backup.AblestackCommvaultTakeBackupCommand;
import org.apache.cloudstack.storage.to.PrimaryDataStoreTO;
import org.libvirt.Connect;
import org.libvirt.Domain;
import org.libvirt.DomainInfo.DomainState;
import org.libvirt.LibvirtException;
import org.apache.logging.log4j.Logger;
import org.apache.logging.log4j.LogManager;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;

class LibvirtAblestackCommvaultBackupHelper {
    protected Logger LOGGER = LogManager.getLogger(LibvirtAblestackCommvaultBackupHelper.class);
    static final Integer EXIT_CLEANUP_FAILED = 20;
    private static final int BACKUP_JOB_POLL_INTERVAL_MS = 10000;

    enum BackupExecutionMode {
        RUNNING("backup-running"),
        STOPPED("backup-stopped"),
        RBD("backup-rbd");

        private final String scriptOperation;

        BackupExecutionMode(String scriptOperation) {
            this.scriptOperation = scriptOperation;
        }

        String getScriptOperation() {
            return scriptOperation;
        }
    }

    private final LibvirtComputingResource resource;

    LibvirtAblestackCommvaultBackupHelper(LibvirtComputingResource resource) {
        this.resource = resource;
    }

    Pair<Integer, String> executeBackup(AblestackCommvaultTakeBackupCommand command) {
        List<String> diskPaths = resolveDiskPaths(command.getVolumePools(), command.getVolumePaths());
        BackupExecutionMode executionMode = determineExecutionMode(command.getVmName(), command.getVolumePools());
        LOGGER.debug("Commvault backup execution mode=[{}], vm=[{}], backupType=[{}], diskPaths=[{}]",
                executionMode, command.getVmName(), command.getBackupType(), diskPaths);
        if (BackupExecutionMode.STOPPED.equals(executionMode)) {
            return executeStoppedVmBackup(command, diskPaths);
        }

        List<String[]> commands = new ArrayList<>();
        String[] scriptCommand = buildBackupScriptCommand(command, diskPaths, executionMode);
        LOGGER.debug("Executing Commvault backup script command=[{}]", String.join(" ", scriptCommand));
        commands.add(scriptCommand);
        return Script.executePipedCommands(commands, resource.getCmdsTimeout());
    }

    List<String> resolveDiskPaths(List<PrimaryDataStoreTO> volumePools, List<String> volumePaths) {
        List<String> diskPaths = new ArrayList<>();
        if (volumePaths == null) {
            return diskPaths;
        }

        KVMStoragePoolManager storagePoolMgr = resource.getStoragePoolMgr();
        for (int idx = 0; idx < volumePaths.size(); idx++) {
            PrimaryDataStoreTO volumePool = volumePools.get(idx);
            String volumePath = volumePaths.get(idx);
            if (volumePool.getPoolType() != Storage.StoragePoolType.RBD) {
                diskPaths.add(volumePath);
                continue;
            }

            KVMStoragePool volumeStoragePool = storagePoolMgr.getStoragePool(volumePool.getPoolType(), volumePool.getUuid());
            diskPaths.add(KVMPhysicalDisk.RBDStringBuilder(volumeStoragePool, volumePath));
        }
        return diskPaths;
    }

    private String[] buildBackupScriptCommand(AblestackCommvaultTakeBackupCommand command, List<String> diskPaths, BackupExecutionMode executionMode) {
        return new String[] {
                resource.getAbleCvtBackupPath(),
                "-o", executionMode.getScriptOperation(),
                "-v", command.getVmName(),
                "-p", command.getBackupPath(),
                "-b", Objects.nonNull(command.getBackupType()) ? command.getBackupType() : "",
                "-c", Objects.nonNull(command.getCheckpointName()) ? command.getCheckpointName() : "",
                "-r", Objects.nonNull(command.getParentBackupPath()) ? command.getParentBackupPath() : "",
                "-i", Objects.nonNull(command.getParentCheckpointName()) ? command.getParentCheckpointName() : "",
                "-j", Objects.nonNull(command.getParentCheckpointPath()) ? command.getParentCheckpointPath() : "",
                "-f", command.getBackupFiles() == null || command.getBackupFiles().isEmpty() ? "" : String.join(",", command.getBackupFiles()),
                "-q", command.getQuiesce() != null && command.getQuiesce() ? "true" : "false",
                "-d", diskPaths.isEmpty() ? "" : String.join(",", diskPaths)
        };
    }

    private BackupExecutionMode determineExecutionMode(String vmName, List<PrimaryDataStoreTO> volumePools) {
        if (volumePools != null && volumePools.stream().anyMatch(pool -> pool != null && pool.getPoolType() == Storage.StoragePoolType.RBD)) {
            return BackupExecutionMode.RBD;
        }
        return isVmRunning(vmName) ? BackupExecutionMode.RUNNING : BackupExecutionMode.STOPPED;
    }

    private boolean isVmRunning(String vmName) {
        try {
            Connect conn = LibvirtConnection.getConnectionByVmName(vmName);
            Domain domain = resource.getDomain(conn, vmName);
            return domain != null && DomainState.VIR_DOMAIN_RUNNING.equals(domain.getInfo().state);
        } catch (LibvirtException e) {
            return false;
        }
    }

    private Pair<Integer, String> executeStoppedVmBackup(AblestackCommvaultTakeBackupCommand command, List<String> diskPaths) {
        String dummyVmName = String.format("DUMMY-VM-%s", command.getCheckpointName().replace('.', '-'));
        Path dest = Path.of(command.getBackupPath());
        Connect conn = null;
        try {
            LOGGER.info("Starting stopped VM Commvault backup for vm=[{}], dummyVm=[{}], backupType=[{}]",
                    command.getVmName(), dummyVmName, command.getBackupType());
            validateStoppedBackupDiskPaths(diskPaths);
            if (isIncremental(command)) {
                resource.validateLibvirtAndQemuVersionForIncrementalSnapshots();
            }
            Files.createDirectories(dest.resolve("checkpoints"));

            conn = LibvirtConnection.getConnection();
            String dummyVmXml = buildDummyVmXml(dummyVmName, diskPaths);
            resource.startVM(conn, dummyVmName, dummyVmXml, Domain.CreateFlags.PAUSED);

            if (isIncremental(command) && command.getParentCheckpointPath() != null && !command.getParentCheckpointPath().isEmpty()) {
                redefineCheckpointIfNeeded(dummyVmName, Path.of(command.getParentCheckpointPath()));
            }

            List<String> diskLabels = getDiskLabels(conn, dummyVmName);
            Path backupXml = writeBackupXml(dest, command, diskLabels);
            Path checkpointXml = writeCheckpointXml(dest, command, diskLabels);

            String backupBeginCommand = String.format("virsh -c qemu:///system backup-begin --domain %s --backupxml %s --checkpointxml %s",
                    shellQuote(dummyVmName), shellQuote(backupXml.toString()), shellQuote(checkpointXml.toString()));
            LOGGER.debug("Starting stopped VM Commvault backup-begin command=[{}]", backupBeginCommand);
            if (Script.runSimpleBashScriptForExitValue(backupBeginCommand, resource.getCmdsTimeout(), false) != 0) {
                LOGGER.error("Failed to start backup for stopped VM Commvault dummy domain [{}]", dummyVmName);
                return new Pair<>(1, "Failed to start backup for dummy VM " + dummyVmName);
            }

            try {
                waitForBackup(dummyVmName);
            } catch (IOException e) {
                cancelBackupJob(dummyVmName);
                throw e;
            }

            if (isIncremental(command) && command.getParentBackupPath() != null && !command.getParentBackupPath().isEmpty()) {
                rebaseIncrementalChain(dest, command, diskPaths);
            }

            dumpCheckpointXml(dummyVmName, command.getCheckpointName(), dest);
            Files.deleteIfExists(backupXml);
            Files.deleteIfExists(checkpointXml);
            Script.runSimpleBashScriptForExitValue("sync", resource.getCmdsTimeout(), false);
            LOGGER.info("Completed stopped VM Commvault backup for vm=[{}], dummyVm=[{}]", command.getVmName(), dummyVmName);
            return new Pair<>(0, "success");
        } catch (Exception e) {
            LOGGER.error("Stopped VM Commvault backup failed for vm=[{}], dummyVm=[{}] due to: {}",
                    command.getVmName(), dummyVmName, e.getMessage(), e);
            return new Pair<>(1, e.getMessage());
        } finally {
            cleanupDummyVm(dummyVmName);
        }
    }

    private String buildDummyVmXml(String vmName, List<String> diskPaths) {
        String arch = resource.getGuestCpuArch() != null ? resource.getGuestCpuArch() : "x86_64";
        String machine = resource.isGuestAarch64() ? LibvirtComputingResource.VIRT : LibvirtComputingResource.PC;
        String emulator = resource.getHypervisorPath();
        StringBuilder xml = new StringBuilder();
        xml.append("<domain type='qemu'>")
                .append("<name>").append(vmName).append("</name>")
                .append("<memory unit='MiB'>256</memory>")
                .append("<currentMemory unit='MiB'>256</currentMemory>")
                .append("<vcpu placement='static'>1</vcpu>")
                .append("<os><type arch='").append(arch).append("' machine='").append(machine).append("'>hvm</type><boot dev='hd'/></os>")
                .append("<devices><emulator>").append(emulator).append("</emulator>");
        for (int i = 0; i < diskPaths.size(); i++) {
            char letter = (char) ('a' + i);
            String diskPath = diskPaths.get(i);
            xml.append("<disk type='file' device='disk'>")
                    .append("<driver name='qemu' type='qcow2'/>")
                    .append("<source file='").append(diskPath).append("'/>")
                    .append("<target dev='vd").append(letter).append("' bus='virtio'/></disk>");
        }
        xml.append("<console type='pty'/><graphics type='vnc' port='-1'/></devices></domain>");
        return xml.toString();
    }

    private void validateStoppedBackupDiskPaths(List<String> diskPaths) {
        if (diskPaths.stream().anyMatch(path -> path != null && path.startsWith("rbd:"))) {
            throw new IllegalArgumentException("Stopped VM dummy backup flow supports only file-backed disks. RBD backups must use the dedicated RBD backup path.");
        }
    }

    private void redefineCheckpointIfNeeded(String vmName, Path checkpointPath) throws IOException {
        if (!Files.exists(checkpointPath)) {
            return;
        }
        String checkpointName = checkpointPath.getFileName().toString().replace(".xml", "");
        int infoExit = Script.runSimpleBashScriptForExitValue(String.format(
                "virsh -c qemu:///system checkpoint-info --domain %s --checkpointname %s > /dev/null 2>&1",
                shellQuote(vmName), shellQuote(checkpointName)));
        if (infoExit == 0) {
            return;
        }
        int redefineExit = Script.runSimpleBashScriptForExitValue(String.format(
                "virsh -c qemu:///system checkpoint-create --domain %s --xmlfile %s --redefine > /dev/null 2>&1",
                shellQuote(vmName), shellQuote(checkpointPath.toString())));
        if (redefineExit != 0) {
            throw new IOException("Failed to redefine checkpoint " + checkpointName + " on domain " + vmName);
        }
    }

    private List<String> getDiskLabels(Connect conn, String vmName) {
        return resource.getDisks(conn, vmName).stream()
                .map(d -> d.getDiskLabel())
                .filter(Objects::nonNull)
                .collect(Collectors.toList());
    }

    private Path writeBackupXml(Path dest, AblestackCommvaultTakeBackupCommand command, List<String> diskLabels) throws IOException {
        StringBuilder xml = new StringBuilder("<domainbackup mode='push'><disks>");
        for (int i = 0; i < diskLabels.size(); i++) {
            String backupFile = getBackupFileByIndex(command, i, String.format("volume-%d.qcow2", i));
            xml.append("<disk name='").append(diskLabels.get(i)).append("' backup='yes' type='file' backupmode='full'>")
                    .append("<driver type='qcow2'/><target file='").append(dest.resolve(backupFile)).append("'/>");
            if (isIncremental(command) && command.getParentCheckpointName() != null && !command.getParentCheckpointName().isEmpty()) {
                xml.append("<incremental>").append(command.getParentCheckpointName()).append("</incremental>");
            }
            xml.append("</disk>");
        }
        xml.append("</disks></domainbackup>");
        Path backupXml = dest.resolve("backup.xml");
        Files.writeString(backupXml, xml.toString(), StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);
        return backupXml;
    }

    private Path writeCheckpointXml(Path dest, AblestackCommvaultTakeBackupCommand command, List<String> diskLabels) throws IOException {
        StringBuilder xml = new StringBuilder("<domaincheckpoint><name>").append(command.getCheckpointName()).append("</name><disks>");
        for (String diskLabel : diskLabels) {
            xml.append("<disk name='").append(diskLabel).append("' checkpoint='bitmap'/>");
        }
        xml.append("</disks></domaincheckpoint>");
        Path checkpointXml = dest.resolve("checkpoint.xml");
        Files.writeString(checkpointXml, xml.toString(), StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);
        return checkpointXml;
    }

    private void waitForBackup(String vmName) throws IOException {
        int timeout = resource.getCmdsTimeout();
        while (timeout > 0) {
            String result = checkBackupJob(vmName);
            if (result != null && result.contains("Completed") && result.contains("Backup")) {
                return;
            }
            if (result != null && result.contains("Failed")) {
                throw new IOException("Virsh backup job failed for dummy VM " + vmName);
            }
            timeout -= BACKUP_JOB_POLL_INTERVAL_MS;
            try {
                Thread.sleep(BACKUP_JOB_POLL_INTERVAL_MS);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new IOException(e);
            }
        }
        throw new IOException("Timed out waiting for backup job of dummy VM " + vmName);
    }

    private void cancelBackupJob(String vmName) {
        Script.runSimpleBashScriptForExitValue(String.format("virsh -c qemu:///system domjobabort --domain %s > /dev/null 2>&1", shellQuote(vmName)));
    }

    private String checkBackupJob(String vmName) {
        return Script.runSimpleBashScriptWithFullResult(
                String.format("virsh -c qemu:///system domjobinfo %s --completed --keep-completed", shellQuote(vmName)), 10);
    }

    private void rebaseIncrementalChain(Path dest, AblestackCommvaultTakeBackupCommand command, List<String> diskPaths) throws IOException {
        for (int i = 0; i < diskPaths.size(); i++) {
            String backupFile = getBackupFileByIndex(command, i, String.format("volume-%d.qcow2", i));
            int exit = Script.runSimpleBashScriptForExitValue(String.format(
                    "qemu-img rebase -u -F qcow2 -b %s %s",
                    shellQuote(Path.of(command.getParentBackupPath(), backupFile).toString()),
                    shellQuote(dest.resolve(backupFile).toString())), resource.getCmdsTimeout(), false);
            if (exit != 0) {
                throw new IOException("qemu-img rebase failed for " + backupFile);
            }
        }
    }

    private void dumpCheckpointXml(String vmName, String checkpointName, Path dest) {
        Path checkpointDest = dest.resolve("checkpoints").resolve(checkpointName + ".xml");
        Script.runSimpleBashScriptForExitValue(String.format(
                "virsh -c qemu:///system checkpoint-dumpxml --domain %s --checkpointname %s --no-domain > %s 2>/dev/null",
                shellQuote(vmName), shellQuote(checkpointName), shellQuote(checkpointDest.toString())));
    }

    private void cleanupDummyVm(String dummyVmName) {
        Script.runSimpleBashScriptForExitValue(String.format("virsh -c qemu:///system destroy %s > /dev/null 2>&1 || true", shellQuote(dummyVmName)));
        Script.runSimpleBashScriptForExitValue(String.format(
                "virsh -c qemu:///system undefine %s --nvram > /dev/null 2>&1 || virsh -c qemu:///system undefine %s > /dev/null 2>&1 || true",
                shellQuote(dummyVmName), shellQuote(dummyVmName)));
    }

    private boolean isIncremental(AblestackCommvaultTakeBackupCommand command) {
        return "INCREMENTAL".equalsIgnoreCase(command.getBackupType());
    }

    private String getBackupFileByIndex(AblestackCommvaultTakeBackupCommand command, int index, String fallback) {
        List<String> backupFiles = command.getBackupFiles();
        if (backupFiles == null || index >= backupFiles.size()) {
            return fallback;
        }
        return backupFiles.get(index);
    }

    private String shellQuote(String value) {
        return "'" + value.replace("'", "'\"'\"'") + "'";
    }
}
