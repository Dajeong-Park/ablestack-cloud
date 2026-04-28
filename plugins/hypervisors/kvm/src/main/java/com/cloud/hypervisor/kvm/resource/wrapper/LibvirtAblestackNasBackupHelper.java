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

import com.amazonaws.util.CollectionUtils;
import com.cloud.hypervisor.kvm.resource.LibvirtConnection;
import com.cloud.hypervisor.kvm.resource.LibvirtComputingResource;
import com.cloud.hypervisor.kvm.storage.KVMPhysicalDisk;
import com.cloud.hypervisor.kvm.storage.KVMStoragePool;
import com.cloud.hypervisor.kvm.storage.KVMStoragePoolManager;
import com.cloud.storage.Storage;
import com.cloud.utils.Pair;
import com.cloud.utils.script.Script;
import org.apache.cloudstack.backup.AblestackNasTakeBackupCommand;
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
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;

class LibvirtAblestackNasBackupHelper {
    protected Logger LOGGER = LogManager.getLogger(LibvirtAblestackNasBackupHelper.class);
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

    LibvirtAblestackNasBackupHelper(LibvirtComputingResource resource) {
        this.resource = resource;
    }

    Pair<Integer, String> executeBackup(AblestackNasTakeBackupCommand command) {
        LOGGER.info("LibvirtNasBackupHelper executeBackup entered for vm=[{}], backupPath=[{}], backupType=[{}]",
                command.getVmName(), command.getBackupPath(), command.getBackupType());
        List<String> diskPaths = resolveDiskPaths(command.getVolumePools(), command.getVolumePaths());
        BackupExecutionMode executionMode = determineExecutionMode(command.getVmName(), command.getVolumePools());
        LOGGER.debug("NAS backup execution mode=[{}], vm=[{}], backupType=[{}], diskPaths=[{}]",
                executionMode, command.getVmName(), command.getBackupType(), diskPaths);
        if (BackupExecutionMode.STOPPED.equals(executionMode)) {
            return executeStoppedVmBackup(command, diskPaths);
        }
        List<String[]> commands = new ArrayList<>();
        String[] scriptCommand = buildBackupScriptCommand(command, diskPaths, executionMode);
        LOGGER.debug("Executing NAS backup script command=[{}]", String.join(" ", scriptCommand));
        commands.add(scriptCommand);
        return Script.executePipedCommands(commands, resource.getCmdsTimeout());
    }

    List<String> resolveDiskPaths(List<PrimaryDataStoreTO> volumePools, List<String> volumePaths) {
        List<String> diskPaths = new ArrayList<>();
        if (Objects.isNull(volumePaths)) {
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

    long parseBackupSize(String output, List<String> diskPaths) {
        if (CollectionUtils.isNullOrEmpty(diskPaths)) {
            List<String> outputLines = Arrays.asList(output.trim().split("\n"));
            if (!outputLines.isEmpty()) {
                return Long.parseLong(outputLines.get(outputLines.size() - 1).trim());
            }
            return 0L;
        }

        long backupSize = 0L;
        String[] outputLines = output.trim().split("\n");
        for (String line : outputLines) {
            backupSize += Long.parseLong(line.split(" ")[0].trim());
        }
        return backupSize;
    }

    private String[] buildBackupScriptCommand(AblestackNasTakeBackupCommand command, List<String> diskPaths, BackupExecutionMode executionMode) {
        return new String[] {
                resource.getAbleNasBackupPath(),
                "-o", executionMode.getScriptOperation(),
                "-v", command.getVmName(),
                "-t", command.getBackupRepoType(),
                "-s", command.getBackupRepoAddress(),
                "-m", Objects.nonNull(command.getMountOptions()) ? command.getMountOptions() : "",
                "-p", command.getBackupPath(),
                "-b", Objects.nonNull(command.getBackupType()) ? command.getBackupType() : "",
                "-c", Objects.nonNull(command.getCheckpointName()) ? command.getCheckpointName() : "",
                "-r", Objects.nonNull(command.getParentBackupPath()) ? command.getParentBackupPath() : "",
                "-i", Objects.nonNull(command.getParentCheckpointName()) ? command.getParentCheckpointName() : "",
                "-j", Objects.nonNull(command.getParentCheckpointPath()) ? command.getParentCheckpointPath() : "",
                "-q", command.getQuiesce() != null && command.getQuiesce() ? "true" : "false",
                "-f", CollectionUtils.isNullOrEmpty(command.getBackupFiles()) ? "" : String.join(",", command.getBackupFiles()),
                "-d", diskPaths.isEmpty() ? "" : String.join(",", diskPaths)
        };
    }

    private BackupExecutionMode determineExecutionMode(String vmName, List<PrimaryDataStoreTO> volumePools) {
        if (hasRbdVolumes(volumePools)) {
            return BackupExecutionMode.RBD;
        }
        return isVmRunning(vmName) ? BackupExecutionMode.RUNNING : BackupExecutionMode.STOPPED;
    }

    private boolean hasRbdVolumes(List<PrimaryDataStoreTO> volumePools) {
        if (CollectionUtils.isNullOrEmpty(volumePools)) {
            return false;
        }
        return volumePools.stream().anyMatch(pool -> pool != null && pool.getPoolType() == Storage.StoragePoolType.RBD);
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

    private Pair<Integer, String> executeStoppedVmBackup(AblestackNasTakeBackupCommand command, List<String> diskPaths) {
        Path mountPoint = null;
        String dummyVmName = String.format("DUMMY-VM-%s", command.getCheckpointName().replace('.', '-'));
        Connect conn = null;
        try {
            LOGGER.info("Starting stopped VM NAS backup for vm=[{}], dummyVm=[{}], backupType=[{}]",
                    command.getVmName(), dummyVmName, command.getBackupType());
            validateStoppedBackupDiskPaths(diskPaths);
            if (isIncremental(command)) {
                resource.validateLibvirtAndQemuVersionForIncrementalSnapshots();
            }
            mountPoint = mountRepository(command);
            Path dest = mountPoint.resolve(command.getBackupPath());
            Files.createDirectories(dest.resolve("checkpoints"));

            conn = LibvirtConnection.getConnection();
            String dummyVmXml = buildDummyVmXml(dummyVmName, diskPaths, conn);
            resource.startVM(conn, dummyVmName, dummyVmXml, Domain.CreateFlags.PAUSED);

            if (isIncremental(command) && command.getParentCheckpointPath() != null && !command.getParentCheckpointPath().isEmpty()) {
                redefineCheckpointIfNeeded(dummyVmName, mountPoint.resolve(command.getParentCheckpointPath()));
            }

            List<String> diskLabels = getDiskLabels(conn, dummyVmName);
            Path backupXml = writeBackupXml(dest, command, diskLabels);
            Path checkpointXml = writeCheckpointXml(dest, command, diskLabels);

            String backupBeginCommand = String.format("virsh -c qemu:///system backup-begin --domain %s --backupxml %s --checkpointxml %s",
                    shellQuote(dummyVmName), shellQuote(backupXml.toString()), shellQuote(checkpointXml.toString()));
            LOGGER.debug("Starting stopped VM NAS backup-begin command=[{}]", backupBeginCommand);
            if (Script.runSimpleBashScriptForExitValue(backupBeginCommand, resource.getCmdsTimeout(), false) != 0) {
                LOGGER.error("Failed to start backup for stopped VM dummy domain [{}]", dummyVmName);
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
            backupDomainInformation(dummyVmName, dest, command, diskPaths);

            Files.deleteIfExists(backupXml);
            Files.deleteIfExists(checkpointXml);
            runCommand(String.format("sync"));
            String output = listTopLevelFileSizes(dest);
            LOGGER.info("Completed stopped VM NAS backup for vm=[{}], dummyVm=[{}]", command.getVmName(), dummyVmName);
            return new Pair<>(0, output);
        } catch (Exception e) {
            LOGGER.error("Stopped VM NAS backup failed for vm=[{}], dummyVm=[{}] due to: {}",
                    command.getVmName(), dummyVmName, e.getMessage(), e);
            return new Pair<>(1, e.getMessage());
        } finally {
            cleanupDummyVm(dummyVmName);
            unmountRepository(mountPoint);
        }
    }

    private Path mountRepository(AblestackNasTakeBackupCommand command) throws IOException {
        Path mountPoint = Files.createTempDirectory("csbackup.");
        StringBuilder mount = new StringBuilder()
                .append("mount -t ").append(shellQuote(command.getBackupRepoType()))
                .append(" ").append(shellQuote(command.getBackupRepoAddress()))
                .append(" ").append(shellQuote(mountPoint.toString()));
        if (command.getMountOptions() != null && !command.getMountOptions().isEmpty()) {
            mount.append(" -o ").append(shellQuote(command.getMountOptions()));
        }
        if (Script.runSimpleBashScriptForExitValue(mount.toString(), resource.getCmdsTimeout(), false) != 0) {
            throw new IOException("Failed to mount backup repository");
        }
        return mountPoint;
    }

    private void unmountRepository(Path mountPoint) {
        if (mountPoint == null) {
            return;
        }
        Script.runSimpleBashScriptForExitValue(String.format("umount %s", shellQuote(mountPoint.toString())));
        try {
            Files.deleteIfExists(mountPoint);
        } catch (IOException ignored) {
        }
    }

    private String buildDummyVmXml(String vmName, List<String> diskPaths, Connect conn) throws LibvirtException {
        String arch = resource.getGuestCpuArch() != null ? resource.getGuestCpuArch() : "x86_64";
        String machine = resource.isGuestAarch64() ? LibvirtComputingResource.VIRT : LibvirtComputingResource.PC;
        String emulator = resource.getHypervisorPath();
        StringBuilder xml = new StringBuilder();
        xml.append("<domain type='qemu'>")
                .append("<name>").append(vmName).append("</name>")
                .append("<memory unit='MiB'>128</memory>")
                .append("<vcpu>1</vcpu>")
                .append("<os><type arch='").append(arch).append("' machine='").append(machine).append("'>hvm</type></os>")
                .append("<devices><emulator>").append(emulator).append("</emulator>");
        for (int i = 0; i < diskPaths.size(); i++) {
            char letter = (char) ('a' + i);
            xml.append("<disk type='file' device='disk'>")
                    .append("<source file='").append(diskPaths.get(i)).append("'/>")
                    .append("<target dev='vd").append(letter).append("' bus='virtio'/>")
                    .append("</disk>");
        }
        xml.append("</devices></domain>");
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
                .map(disk -> disk.getDiskLabel())
                .filter(Objects::nonNull)
                .collect(Collectors.toList());
    }

    private Path writeBackupXml(Path dest, AblestackNasTakeBackupCommand command, List<String> diskLabels) throws IOException {
        StringBuilder xml = new StringBuilder("<domainbackup mode='push'>");
        if (isIncremental(command) && command.getParentCheckpointName() != null && !command.getParentCheckpointName().isEmpty()) {
            xml.append("<incremental>").append(command.getParentCheckpointName()).append("</incremental>");
        }
        xml.append("<disks>");
        for (int i = 0; i < diskLabels.size(); i++) {
            String backupFile = getBackupFileByIndex(command, i, String.format("disk-%d.qcow2", i));
            xml.append("<disk name='").append(diskLabels.get(i)).append("' backup='yes' type='file'>")
                    .append("<target file='").append(dest.resolve(backupFile)).append("' />")
                    .append("<driver type='qcow2'/></disk>");
        }
        xml.append("</disks></domainbackup>");
        Path backupXml = dest.resolve("backup.xml");
        Files.writeString(backupXml, xml.toString(), StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);
        return backupXml;
    }

    private Path writeCheckpointXml(Path dest, AblestackNasTakeBackupCommand command, List<String> diskLabels) throws IOException {
        StringBuilder xml = new StringBuilder("<domaincheckpoint><name>")
                .append(command.getCheckpointName())
                .append("</name><disks>");
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

    private void rebaseIncrementalChain(Path dest, AblestackNasTakeBackupCommand command, List<String> diskPaths) throws IOException {
        for (int i = 0; i < diskPaths.size(); i++) {
            String backupFile = getBackupFileByIndex(command, i, String.format("disk-%d.qcow2", i));
            Path output = dest.resolve(backupFile);
            String parent = "../" + Path.of(command.getParentBackupPath()).getFileName() + "/" + backupFile;
            int exit = Script.runSimpleBashScriptForExitValue(String.format(
                    "qemu-img rebase -u -F qcow2 -b %s %s",
                    shellQuote(parent), shellQuote(output.toString())), resource.getCmdsTimeout(), false);
            if (exit != 0) {
                throw new IOException("qemu-img rebase failed for " + output + " with parent " + parent);
            }
        }
    }

    private void dumpCheckpointXml(String vmName, String checkpointName, Path dest) {
        Path checkpointDest = dest.resolve("checkpoints").resolve(checkpointName + ".xml");
        Script.runSimpleBashScriptForExitValue(String.format(
                "virsh -c qemu:///system checkpoint-dumpxml --domain %s --checkpointname %s --no-domain > %s 2>/dev/null",
                shellQuote(vmName), shellQuote(checkpointName), shellQuote(checkpointDest.toString())));
    }

    private void backupDomainInformation(String vmName, Path dest, AblestackNasTakeBackupCommand command, List<String> diskPaths) {
        runCommand(String.format("virsh -c qemu:///system dumpxml %s > %s 2>/dev/null || true",
                shellQuote(vmName), shellQuote(dest.resolve("domain-config.xml").toString())));
        runCommand(String.format("virsh -c qemu:///system dominfo %s > %s 2>/dev/null || true",
                shellQuote(vmName), shellQuote(dest.resolve("dominfo.xml").toString())));
        runCommand(String.format("virsh -c qemu:///system domiflist %s > %s 2>/dev/null || true",
                shellQuote(vmName), shellQuote(dest.resolve("domiflist.xml").toString())));
        runCommand(String.format("virsh -c qemu:///system domblklist %s > %s 2>/dev/null || true",
                shellQuote(vmName), shellQuote(dest.resolve("domblklist.xml").toString())));
        Path checkpointMeta = dest.resolve("checkpoints").resolve(command.getCheckpointName() + ".meta");
        String metadata = "checkpoint_name=" + command.getCheckpointName() + "\n" +
                "backup_type=" + command.getBackupType() + "\n" +
                "vm_name=" + vmName + "\n" +
                "disk_paths=" + String.join(",", diskPaths) + "\n" +
                "backup_files=" + String.join(",", Objects.requireNonNullElse(command.getBackupFiles(), List.of())) + "\n";
        try {
            Files.writeString(checkpointMeta, metadata, StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);
        } catch (IOException ignored) {
        }
    }

    private String listTopLevelFileSizes(Path dest) throws IOException {
        try (var stream = Files.list(dest)) {
            return stream.filter(Files::isRegularFile)
                    .sorted(Comparator.comparing(path -> path.getFileName().toString()))
                    .map(path -> {
                        try {
                            return String.valueOf(Files.size(path));
                        } catch (IOException e) {
                            return "0";
                        }
                    })
                    .collect(Collectors.joining("\n"));
        }
    }

    private void cleanupDummyVm(String dummyVmName) {
        runCommand(String.format("virsh -c qemu:///system destroy %s > /dev/null 2>&1 || true", shellQuote(dummyVmName)));
        runCommand(String.format("virsh -c qemu:///system undefine %s --nvram > /dev/null 2>&1 || virsh -c qemu:///system undefine %s > /dev/null 2>&1 || true",
                shellQuote(dummyVmName), shellQuote(dummyVmName)));
    }

    private void runCommand(String command) {
        Script.runSimpleBashScriptForExitValue(command, resource.getCmdsTimeout(), false);
    }

    private boolean isIncremental(AblestackNasTakeBackupCommand command) {
        return "INCREMENTAL".equalsIgnoreCase(command.getBackupType());
    }

    private String getBackupFileByIndex(AblestackNasTakeBackupCommand command, int index, String fallback) {
        List<String> backupFiles = command.getBackupFiles();
        if (CollectionUtils.isNullOrEmpty(backupFiles) || index >= backupFiles.size()) {
            return fallback;
        }
        return backupFiles.get(index);
    }

    private String shellQuote(String value) {
        return "'" + value.replace("'", "'\"'\"'") + "'";
    }
}
