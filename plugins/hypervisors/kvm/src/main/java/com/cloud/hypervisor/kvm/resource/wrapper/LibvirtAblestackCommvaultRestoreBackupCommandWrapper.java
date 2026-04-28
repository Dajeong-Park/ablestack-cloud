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
import com.cloud.hypervisor.kvm.storage.KVMPhysicalDisk;
import com.cloud.hypervisor.kvm.storage.KVMStoragePool;
import com.cloud.hypervisor.kvm.storage.KVMStoragePoolManager;
import com.cloud.resource.CommandWrapper;
import com.cloud.resource.ResourceWrapper;
import com.cloud.storage.Storage;
import com.cloud.utils.Pair;
import com.cloud.utils.exception.CloudRuntimeException;
import com.cloud.utils.script.Script;
import com.cloud.vm.VirtualMachine;
import org.apache.cloudstack.backup.AblestackBackupFrameworkUtils;
import org.apache.cloudstack.backup.BackupAnswer;
import org.apache.cloudstack.backup.AblestackCommvaultRestoreBackupCommand;
import org.apache.cloudstack.backup.BackupRestorePlan;
import org.apache.cloudstack.backup.BackupRestoreStage;
import org.apache.cloudstack.backup.BackupVolumeChainState;
import org.apache.cloudstack.storage.to.PrimaryDataStoreTO;
import org.apache.cloudstack.utils.qemu.QemuImg;
import org.apache.cloudstack.utils.qemu.QemuImgException;
import org.apache.cloudstack.utils.qemu.QemuImgFile;
import org.apache.commons.io.FileUtils;
import org.apache.commons.lang3.StringUtils;
import org.libvirt.LibvirtException;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;

@ResourceWrapper(handles = AblestackCommvaultRestoreBackupCommand.class)
public class LibvirtAblestackCommvaultRestoreBackupCommandWrapper extends CommandWrapper<AblestackCommvaultRestoreBackupCommand, Answer, LibvirtComputingResource> {
    private static final String FILE_PATH_PLACEHOLDER = "%s/%s";
    private static final String ATTACH_QCOW2_DISK_COMMAND = " virsh attach-disk %s %s %s --driver qemu --subdriver qcow2 --cache none";
    private static final String ATTACH_RBD_DISK_XML_COMMAND = " virsh attach-device %s /dev/stdin <<EOF%sEOF";
    private static final String CURRRENT_DEVICE = "virsh domblklist --domain %s | tail -n 3 | head -n 1 | awk '{print $1}'";
    private static final String MKDIR_P = "mkdir -p %s";
    private static final String RSYNC_DIR_FROM_REMOTE = "rsync -az -e \"ssh -o StrictHostKeyChecking=no\" %s:%s/ %s/";
    private static final String COMMAND_EXIT_MARKER = "__CS_COMMAND_EXIT__=";

    @Override
    public Answer execute(AblestackCommvaultRestoreBackupCommand command, LibvirtComputingResource serverResource) {
        String vmName = command.getVmName();
        String backupPath = command.getBackupPath();
        Boolean vmExists = command.isVmExists();
        String diskType = command.getDiskType();
        List<String> backedVolumeUUIDs = command.getBackupVolumesUUIDs();
        List<String> backupFiles = command.getBackupFiles();
        List<String> backupFileChains = command.getBackupFileChains();
        List<BackupVolumeChainState> volumeChainStates = command.getVolumeChainStates();
        List<PrimaryDataStoreTO> restoreVolumePools = command.getRestoreVolumePools();
        List<String> restoreVolumePaths = command.getRestoreVolumePaths();
        String restoreVolumeUuid = command.getRestoreVolumeUUID();
        int timeout = command.getTimeout();
        String cacheMode = command.getCacheMode();
        String hostName = command.getHostName();
        List<String> backupSourceHosts = command.getBackupSourceHosts();
        BackupRestorePlan restorePlan = command.getRestorePlan();
        KVMStoragePoolManager storagePoolMgr = serverResource.getStoragePoolMgr();

        String newVolumeId = null;
        try {
            validateChainStatePlan(volumeChainStates, restorePlan);
            if (AblestackBackupFrameworkUtils.hasRestoreStage(restorePlan, BackupRestoreStage.PREPARE_SOURCE) && hostName != null) {
                fetchBackupFile(hostName, backupPath);
            }
            if (AblestackBackupFrameworkUtils.hasRestoreStage(restorePlan, BackupRestoreStage.PREPARE_SOURCE) && backupSourceHosts != null && !backupSourceHosts.isEmpty()) {
                LinkedHashSet<String> sourceHosts = new LinkedHashSet<>(backupSourceHosts);
                for (String sourceHost : sourceHosts) {
                    if (StringUtils.isBlank(sourceHost) || Objects.equals(sourceHost, hostName)) {
                        continue;
                    }
                    fetchBackupFile(sourceHost, backupPath);
                }
            }
            if (Objects.isNull(vmExists)) {
                PrimaryDataStoreTO volumePool = restoreVolumePools.get(0);
                String volumePath = restoreVolumePaths.get(0);
                int lastIndex = volumePath.lastIndexOf("/");
                newVolumeId = volumePath.substring(lastIndex + 1);
                restoreVolume(storagePoolMgr, backupPath, volumePool, volumePath, diskType, restoreVolumeUuid, backupFiles, backupFileChains, volumeChainStates,
                        new Pair<>(vmName, command.getVmState()), timeout, cacheMode, restorePlan);
            } else if (Boolean.TRUE.equals(vmExists)) {
                restoreVolumesOfExistingVM(storagePoolMgr, restoreVolumePools, restoreVolumePaths, backedVolumeUUIDs, backupPath, backupFiles, backupFileChains,
                        volumeChainStates, timeout, restorePlan);
            } else {
                restoreVolumesOfDestroyedVMs(storagePoolMgr, restoreVolumePools, restoreVolumePaths, vmName, backupPath, backupFiles, backupFileChains,
                        volumeChainStates, timeout, restorePlan);
            }
        } catch (CloudRuntimeException e) {
            String errorMessage = e.getMessage() != null ? e.getMessage() : "";
            return new BackupAnswer(command, false, errorMessage);
        }

        return new BackupAnswer(command, true, newVolumeId);
    }

    private void restoreVolumesOfExistingVM(KVMStoragePoolManager storagePoolMgr, List<PrimaryDataStoreTO> restoreVolumePools, List<String> restoreVolumePaths, List<String> backedVolumesUUIDs,
                                            String backupPath, List<String> backupFiles, List<String> backupFileChains,
                                            List<BackupVolumeChainState> volumeChainStates, int timeout, BackupRestorePlan restorePlan) {
        String diskType = "root";
        try {
            for (int idx = 0; idx < restoreVolumePaths.size(); idx++) {
                PrimaryDataStoreTO restoreVolumePool = restoreVolumePools.get(idx);
                String restoreVolumePath = restoreVolumePaths.get(idx);
                String backupVolumeUuid = backedVolumesUUIDs.get(idx);
                List<String> localBackupPaths = getLocalBackupPaths(backupPath, backupFiles, backupFileChains, volumeChainStates, idx, getLegacyBackupFileName(diskType, backupVolumeUuid));
                validateResolvedChainPaths(localBackupPaths, restoreVolumePath);
                diskType = "datadisk";
                if (!replaceVolumeWithBackup(storagePoolMgr, restoreVolumePool, restoreVolumePath, localBackupPaths, timeout, backupPath, idx)) {
                    throw new CloudRuntimeException(String.format("Unable to restore contents from the backup volume [%s].", backupVolumeUuid));
                }
            }
        } finally {
            cleanupBackupDirectory(backupPath, restorePlan);
        }
    }

    private void restoreVolumesOfDestroyedVMs(KVMStoragePoolManager storagePoolMgr, List<PrimaryDataStoreTO> volumePools, List<String> volumePaths, String vmName, String backupPath,
                                              List<String> backupFiles, List<String> backupFileChains,
                                              List<BackupVolumeChainState> volumeChainStates, int timeout, BackupRestorePlan restorePlan) {
        String diskType = "root";
        try {
            for (int i = 0; i < volumePaths.size(); i++) {
                PrimaryDataStoreTO volumePool = volumePools.get(i);
                String volumePath = volumePaths.get(i);
                String volumeUuid = volumePath.substring(volumePath.lastIndexOf(File.separator) + 1);
                List<String> localBackupPaths = getLocalBackupPaths(backupPath, backupFiles, backupFileChains, volumeChainStates, i, getLegacyBackupFileName(diskType, volumeUuid));
                validateResolvedChainPaths(localBackupPaths, volumePath);
                diskType = "datadisk";
                if (!replaceVolumeWithBackup(storagePoolMgr, volumePool, volumePath, localBackupPaths, timeout, backupPath, i)) {
                    throw new CloudRuntimeException(String.format("Unable to restore contents from the backup volume [%s].", volumeUuid));
                }
            }
        } finally {
            cleanupBackupDirectory(backupPath, restorePlan);
        }
    }

    private void restoreVolume(KVMStoragePoolManager storagePoolMgr, String backupPath, PrimaryDataStoreTO volumePool, String volumePath, String diskType, String volumeUUID,
                               List<String> backupFiles, List<String> backupFileChains, List<BackupVolumeChainState> volumeChainStates,
                               Pair<String, VirtualMachine.State> vmNameAndState, int timeout, String cacheMode, BackupRestorePlan restorePlan) {
        try {
            List<String> localBackupPaths = getLocalBackupPaths(backupPath, backupFiles, backupFileChains, volumeChainStates, 0, getLegacyBackupFileName(diskType, volumeUUID));
            validateResolvedChainPaths(localBackupPaths, volumePath);
            if (!replaceVolumeWithBackup(storagePoolMgr, volumePool, volumePath, localBackupPaths, timeout, backupPath, 0, true)) {
                throw new CloudRuntimeException(String.format("Unable to restore contents from the backup volume [%s].", volumeUUID));
            }
            if (AblestackBackupFrameworkUtils.hasRestoreStage(restorePlan, BackupRestoreStage.ATTACH_VOLUME)
                    && VirtualMachine.State.Running.equals(vmNameAndState.second())) {
                if (!attachVolumeToVm(storagePoolMgr, vmNameAndState.first(), volumePool, volumePath, cacheMode)) {
                    throw new CloudRuntimeException(String.format("Failed to attach volume to VM: %s", vmNameAndState.first()));
                }
            }
        } finally {
            cleanupBackupDirectory(backupPath, restorePlan);
        }
    }

    private void validateChainStatePlan(List<BackupVolumeChainState> volumeChainStates, BackupRestorePlan restorePlan) {
        if (AblestackBackupFrameworkUtils.hasRestoreStage(restorePlan, BackupRestoreStage.VALIDATE_CHAIN) && volumeChainStates != null && !volumeChainStates.isEmpty()) {
            try {
                AblestackBackupFrameworkUtils.validateVolumeChainStates(volumeChainStates);
            } catch (IllegalArgumentException e) {
                throw new CloudRuntimeException(e.getMessage(), e);
            }
        }
    }

    private void validateResolvedChainPaths(List<String> resolvedPaths, String volumePath) {
        if (resolvedPaths == null || resolvedPaths.isEmpty()) {
            throw new CloudRuntimeException(String.format("No resolved backup chain paths found for volume [%s]", volumePath));
        }
    }

    private void cleanupBackupDirectory(String backupPath, BackupRestorePlan restorePlan) {
        if (AblestackBackupFrameworkUtils.hasRestoreStage(restorePlan, BackupRestoreStage.CLEANUP_SOURCE)) {
            deleteBackupDirectory(backupPath);
        }
    }

    private void deleteBackupDirectory(String backupDirectory) {
        try {
            FileUtils.deleteDirectory(new File(backupDirectory));
        } catch (IOException e) {
            logger.error(String.format("Failed to delete backup directory: %s", backupDirectory), e);
            throw new CloudRuntimeException("Failed to delete the backup directory");
        }
    }

    private List<String> getLocalBackupPaths(String backupPath, List<String> backupFiles, List<String> backupFileChains,
                                             List<BackupVolumeChainState> volumeChainStates, int index, String legacyBackupFileName) {
        LinkedHashSet<String> localPaths = new LinkedHashSet<>();
        boolean resolvedFromVolumeChainStates = false;
        if (volumeChainStates != null && volumeChainStates.size() > index) {
            for (String chainPath : volumeChainStates.get(index).getChainFiles()) {
                if (StringUtils.isBlank(chainPath)) {
                    continue;
                }
                localPaths.add(resolveBackupPath(backupPath, chainPath));
                resolvedFromVolumeChainStates = true;
            }
        }
        if (!resolvedFromVolumeChainStates && backupFileChains != null && backupFileChains.size() > index && StringUtils.isNotBlank(backupFileChains.get(index))) {
            for (String chainPath : backupFileChains.get(index).split(";")) {
                if (StringUtils.isBlank(chainPath)) {
                    continue;
                }
                localPaths.add(resolveBackupPath(backupPath, chainPath));
            }
        }
        if (localPaths.isEmpty() && backupFiles != null && backupFiles.size() > index && StringUtils.isNotBlank(backupFiles.get(index))) {
            localPaths.add(resolveBackupPath(backupPath, backupFiles.get(index)));
        }
        if (localPaths.isEmpty()) {
            localPaths.add(String.format(FILE_PATH_PLACEHOLDER, backupPath, legacyBackupFileName));
        }
        return new ArrayList<>(localPaths);
    }

    private String resolveBackupPath(String backupPath, String chainPath) {
        if (chainPath.startsWith("/")) {
            return chainPath;
        }
        if (chainPath.contains("/")) {
            return String.format(FILE_PATH_PLACEHOLDER, backupPath, chainPath);
        }
        return String.format(FILE_PATH_PLACEHOLDER, backupPath, chainPath);
    }

    private String getLegacyBackupFileName(String diskType, String volumeUuid) {
        return String.format("%s.%s.qcow2", diskType.toLowerCase(Locale.ROOT), volumeUuid);
    }

    private boolean replaceVolumeWithBackup(KVMStoragePoolManager storagePoolMgr, PrimaryDataStoreTO volumePool, String volumePath, List<String> backupPaths, int timeout,
                                            String backupRootPath, int backupIndex) {
        return replaceVolumeWithBackup(storagePoolMgr, volumePool, volumePath, backupPaths, timeout, backupRootPath, backupIndex, false);
    }

    private boolean replaceVolumeWithBackup(KVMStoragePoolManager storagePoolMgr, PrimaryDataStoreTO volumePool, String volumePath, List<String> backupPaths, int timeout,
                                            String backupRootPath, int backupIndex, boolean createTargetVolume) {
        if (backupPaths == null || backupPaths.isEmpty()) {
            return false;
        }
        if (volumePool.getPoolType() != Storage.StoragePoolType.RBD) {
            if (backupPaths.stream().anyMatch(path -> path.endsWith(".rbdiff"))) {
                return restoreIncrementalRbdBackupChainToFileVolume(volumePath, backupPaths, timeout, backupRootPath, backupIndex);
            }
            return replaceFileVolumeWithBackup(volumePath, getLastExistingBackupPath(backupPaths), timeout);
        }

        return replaceRbdVolumeWithBackup(storagePoolMgr, volumePool, volumePath, backupPaths, timeout, createTargetVolume);
    }

    private boolean restoreIncrementalRbdBackupChainToFileVolume(String volumePath, List<String> backupPaths, int timeout, String backupRootPath, int backupIndex) {
        if (StringUtils.isBlank(backupRootPath)) {
            throw new CloudRuntimeException("Unable to locate backup root path for incremental RBD restore");
        }
        RbdImageSpec sourceImage = getRbdImageSpecFromMetadata(backupRootPath, backupIndex);
        String tempImage = sourceImage.buildTempImageSpec();
        try {
            if (!importBackupChainToTemporaryRbd(backupPaths, timeout, sourceImage, tempImage)) {
                return false;
            }
            return convertTemporaryRbdToFileVolume(volumePath, timeout, sourceImage, tempImage);
        } finally {
            removeTemporaryRbdImage(sourceImage, tempImage, timeout);
        }
    }

    private String getFirstExistingBackupPath(List<String> backupPaths) {
        for (String backupPath : backupPaths) {
            if (StringUtils.isNotBlank(backupPath) && Files.exists(Paths.get(backupPath))) {
                return backupPath;
            }
        }
        return backupPaths.get(0);
    }

    private String getLastExistingBackupPath(List<String> backupPaths) {
        for (int i = backupPaths.size() - 1; i >= 0; i--) {
            String backupPath = backupPaths.get(i);
            if (StringUtils.isNotBlank(backupPath) && Files.exists(Paths.get(backupPath))) {
                return backupPath;
            }
        }
        return backupPaths.get(backupPaths.size() - 1);
    }

    private boolean replaceFileVolumeWithBackup(String volumePath, String backupPath, int timeout) {
        QemuImgFile srcBackupFile = null;
        QemuImgFile destVolumeFile = null;
        try {
            QemuImg qemu = new QemuImg(timeout * 1000, true, false);
            srcBackupFile = new QemuImgFile(backupPath, getBackupFileFormat(backupPath));
            destVolumeFile = new QemuImgFile(volumePath, getFileVolumeFormat(volumePath));
            qemu.convert(srcBackupFile, destVolumeFile);
            return true;
        } catch (QemuImgException | LibvirtException e) {
            String srcFilename = srcBackupFile != null ? srcBackupFile.getFileName() : null;
            String destFilename = destVolumeFile != null ? destVolumeFile.getFileName() : null;
            logger.error("Failed to convert backup {} to volume {}, the error was: {}", srcFilename, destFilename, e.getMessage());
            return false;
        }
    }

    private boolean convertTemporaryRbdToFileVolume(String volumePath, int timeout, RbdImageSpec sourceImage, String tempImage) {
        QemuImgFile srcBackupFile = null;
        QemuImgFile destVolumeFile = null;
        try {
            QemuImg qemu = new QemuImg(timeout * 1000, true, false);
            srcBackupFile = new QemuImgFile(sourceImage.buildQemuUri(tempImage), QemuImg.PhysicalDiskFormat.RAW);
            destVolumeFile = new QemuImgFile(volumePath, getFileVolumeFormat(volumePath));
            qemu.convert(srcBackupFile, destVolumeFile);
            return true;
        } catch (QemuImgException | LibvirtException e) {
            String srcFilename = srcBackupFile != null ? srcBackupFile.getFileName() : tempImage;
            String destFilename = destVolumeFile != null ? destVolumeFile.getFileName() : volumePath;
            logger.error("Failed to convert temporary RBD {} to volume {}, the error was: {}", srcFilename, destFilename, e.getMessage());
            return false;
        }
    }

    private QemuImg.PhysicalDiskFormat getBackupFileFormat(String backupPath) {
        if (backupPath.endsWith(".raw")) {
            return QemuImg.PhysicalDiskFormat.RAW;
        }
        return QemuImg.PhysicalDiskFormat.QCOW2;
    }

    private QemuImg.PhysicalDiskFormat getFileVolumeFormat(String volumePath) {
        if (!Files.exists(Paths.get(volumePath))) {
            return QemuImg.PhysicalDiskFormat.QCOW2;
        }
        try {
            QemuImg qemu = new QemuImg(0);
            java.util.Map<String, String> info = qemu.info(new QemuImgFile(volumePath));
            String format = info.get("file_format");
            if (StringUtils.isNotBlank(format)) {
                return QemuImg.PhysicalDiskFormat.valueOf(format.toUpperCase(Locale.ROOT));
            }
        } catch (QemuImgException | LibvirtException | IllegalArgumentException e) {
            logger.warn("Failed to detect file volume format for path {}. Falling back to qcow2.", volumePath, e);
        }
        return QemuImg.PhysicalDiskFormat.QCOW2;
    }

    private boolean replaceRbdVolumeWithBackup(KVMStoragePoolManager storagePoolMgr, PrimaryDataStoreTO volumePool, String volumePath, List<String> backupPaths, int timeout, boolean createTargetVolume) {
        if (backupPaths.stream().anyMatch(path -> path.endsWith(".rbdiff"))) {
            return restoreIncrementalRbdBackupChain(storagePoolMgr, volumePool, volumePath, backupPaths, timeout, createTargetVolume);
        }

        String backupPath = getFirstExistingBackupPath(backupPaths);
        KVMStoragePool volumeStoragePool = storagePoolMgr.getStoragePool(volumePool.getPoolType(), volumePool.getUuid());
        String normalizedVolumePath = normalizeRbdVolumePath(volumePath, volumeStoragePool);
        if (getBackupFileFormat(backupPath) == QemuImg.PhysicalDiskFormat.RAW) {
            return importRawBackupToRbd(volumeStoragePool, normalizedVolumePath, backupPath, timeout, createTargetVolume);
        }

        QemuImg qemu;
        try {
            qemu = new QemuImg(timeout * 1000, true, false);
            if (!createTargetVolume) {
                KVMPhysicalDisk rdbDisk = volumeStoragePool.getPhysicalDisk(normalizedVolumePath);
                logger.debug("Restoring RBD volume: {}", rdbDisk.toString());
                qemu.setSkipTargetVolumeCreation(true);
            }
        } catch (LibvirtException ex) {
            throw new CloudRuntimeException("Failed to create qemu-img command to restore RBD volume with backup", ex);
        }

        QemuImgFile srcBackupFile = null;
        QemuImgFile destVolumeFile = null;
        try {
            srcBackupFile = new QemuImgFile(backupPath, getBackupFileFormat(backupPath));
            String rbdDestVolumeFile = KVMPhysicalDisk.RBDStringBuilder(volumeStoragePool, normalizedVolumePath);
            destVolumeFile = new QemuImgFile(rbdDestVolumeFile, QemuImg.PhysicalDiskFormat.RAW);

            logger.debug("Starting convert backup  {} to RBD volume  {}", backupPath, normalizedVolumePath);
            qemu.convert(srcBackupFile, destVolumeFile);
            logger.debug("Successfully converted backup {} to RBD volume  {}", backupPath, normalizedVolumePath);
        } catch (QemuImgException | LibvirtException e) {
            String srcFilename = srcBackupFile != null ? srcBackupFile.getFileName() : null;
            String destFilename = destVolumeFile != null ? destVolumeFile.getFileName() : null;
            logger.error("Failed to convert backup {} to volume {}, the error was: {}", srcFilename, destFilename, e.getMessage());
            return false;
        }

        return true;
    }

    private boolean importRawBackupToRbd(KVMStoragePool volumeStoragePool, String volumePath, String backupPath, int timeout, boolean createTargetVolume) {
        if (!createTargetVolume && !deleteExistingRbdVolumeIfPresent(volumeStoragePool, volumePath)) {
            logger.error("Failed to delete existing RBD volume {} before raw import", volumePath);
            return false;
        }

        String importCommand = buildRbdImportCommand(volumeStoragePool, backupPath, volumePath);
        CommandExecutionResult importResult = executeBashCommandWithResult(importCommand, timeout, "Import raw backup to RBD");
        if (importResult.exitCode != 0) {
            logger.error("Failed to import raw backup {} into volume {}. Exit code: {}, output: {}", backupPath, volumePath, importResult.exitCode, importResult.output);
            return false;
        }
        return true;
    }

    private boolean deleteExistingRbdVolumeIfPresent(KVMStoragePool volumeStoragePool, String volumePath) {
        try {
            return volumeStoragePool.deletePhysicalDisk(volumePath, Storage.ImageFormat.RAW);
        } catch (CloudRuntimeException e) {
            if (isMissingRbdImageError(e)) {
                logger.info("Skipping deletion for missing RBD volume {} before restore", volumePath);
                return true;
            }
            throw e;
        }
    }

    private boolean isMissingRbdImageError(CloudRuntimeException e) {
        String message = e.getMessage();
        return StringUtils.containsIgnoreCase(message, "Failed to open image")
                && StringUtils.containsIgnoreCase(message, "No such file or directory");
    }

    private boolean restoreIncrementalRbdBackupChain(KVMStoragePoolManager storagePoolMgr, PrimaryDataStoreTO volumePool, String volumePath, List<String> backupPaths,
                                                     int timeout, boolean createTargetVolume) {
        if (backupPaths.isEmpty() || !backupPaths.get(0).endsWith(".raw")) {
            throw new CloudRuntimeException("Incremental RBD backup chain is missing the base full backup");
        }

        String normalizedVolumePath = normalizeRbdVolumePath(volumePath, storagePoolMgr.getStoragePool(volumePool.getPoolType(), volumePool.getUuid()));
        if (!replaceRbdVolumeWithBackup(storagePoolMgr, volumePool, normalizedVolumePath, List.of(backupPaths.get(0)), timeout, createTargetVolume)) {
            return false;
        }

        KVMStoragePool volumeStoragePool = storagePoolMgr.getStoragePool(volumePool.getPoolType(), volumePool.getUuid());
        List<String> restoreSnapshots = new ArrayList<>();
        try {
            Map<String, String> baseMetadata = readRbdBackupMetadata(backupPaths.get(0));
            String baseCheckpoint = baseMetadata.get("checkpoint_name");
            if (StringUtils.isNotBlank(baseCheckpoint)) {
                if (!ensureRbdSnapshotExists(volumeStoragePool, normalizedVolumePath, baseCheckpoint, timeout)) {
                    return false;
                }
                restoreSnapshots.add(baseCheckpoint);
            }

            for (int index = 1; index < backupPaths.size(); index++) {
                String backupPath = backupPaths.get(index);
                if (!backupPath.endsWith(".rbdiff")) {
                    continue;
                }
                Map<String, String> metadata = readRbdBackupMetadata(backupPath);
                String parentCheckpoint = metadata.get("parent_checkpoint_name");
                String checkpoint = metadata.get("checkpoint_name");
                if (StringUtils.isBlank(parentCheckpoint) || StringUtils.isBlank(checkpoint)) {
                    throw new CloudRuntimeException(String.format("RBD incremental backup metadata is incomplete for %s", backupPath));
                }
                if (!rbdSnapshotExists(volumeStoragePool, normalizedVolumePath, parentCheckpoint, timeout)) {
                    throw new CloudRuntimeException(String.format("Required parent snapshot %s is missing on volume %s", parentCheckpoint, normalizedVolumePath));
                }
                String importDiffCommand = buildRbdImportDiffCommand(volumeStoragePool, backupPath, normalizedVolumePath);
                CommandExecutionResult importDiffResult = executeBashCommandWithResult(importDiffCommand, timeout, "Import RBD diff to target volume");
                if (importDiffResult.exitCode != 0) {
                    logger.error("Failed to import RBD diff {} into volume {}. Exit code: {}, output: {}", backupPath, normalizedVolumePath,
                            importDiffResult.exitCode, importDiffResult.output);
                    return false;
                }
                if (!ensureRbdSnapshotExists(volumeStoragePool, normalizedVolumePath, checkpoint, timeout)) {
                    return false;
                }
                restoreSnapshots.add(checkpoint);
            }
            return true;
        } finally {
            cleanupRbdRestoreSnapshots(volumeStoragePool, normalizedVolumePath, restoreSnapshots, timeout);
        }
    }

    private String normalizeRbdVolumePath(String volumePath, KVMStoragePool storagePool) {
        if (StringUtils.isBlank(volumePath)) {
            return volumePath;
        }
        String normalized = volumePath;
        String poolPath = storagePool.getSourceDir();
        if (StringUtils.isNotBlank(poolPath)) {
            String poolPrefix = poolPath + "/";
            if (normalized.startsWith(poolPrefix)) {
                normalized = normalized.substring(poolPrefix.length());
            }
        }
        if (normalized.startsWith("/")) {
            normalized = normalized.substring(normalized.lastIndexOf('/') + 1);
        }
        return normalized;
    }

    private String buildRbdImportDiffCommand(KVMStoragePool storagePool, String backupPath, String volumePath) {
        StringBuilder command = new StringBuilder("rbd");
        if (StringUtils.isNotBlank(storagePool.getSourceHost())) {
            command.append(" -m ").append(formatRbdMonHosts(storagePool.getSourceHost(), storagePool.getSourcePort()));
        }
        if (StringUtils.isNotBlank(storagePool.getAuthUserName())) {
            command.append(" --id ").append(storagePool.getAuthUserName());
        }
        if (StringUtils.isNotBlank(storagePool.getAuthSecret())) {
            command.append(" --key ").append(storagePool.getAuthSecret());
        }
        command.append(" import-diff ").append(backupPath).append(" ").append(volumePath);
        return command.toString();
    }

    private String buildRbdImportCommand(KVMStoragePool storagePool, String backupPath, String volumePath) {
        StringBuilder command = new StringBuilder("rbd");
        if (StringUtils.isNotBlank(storagePool.getSourceHost())) {
            command.append(" -m ").append(formatRbdMonHosts(storagePool.getSourceHost(), storagePool.getSourcePort()));
        }
        if (StringUtils.isNotBlank(storagePool.getAuthUserName())) {
            command.append(" --id ").append(storagePool.getAuthUserName());
        }
        if (StringUtils.isNotBlank(storagePool.getAuthSecret())) {
            command.append(" --key ").append(storagePool.getAuthSecret());
        }
        command.append(" import ").append(backupPath).append(" ").append(volumePath);
        return command.toString();
    }

    private String formatRbdMonHosts(String hosts, int port) {
        String[] hostValues = hosts.split(",");
        List<String> formattedHosts = new ArrayList<>();
        for (String host : hostValues) {
            String normalizedHost = host.replace("[", "").replace("]", "").trim();
            if (StringUtils.isBlank(normalizedHost)) {
                continue;
            }
            formattedHosts.add(port > 0 ? normalizedHost + ":" + port : normalizedHost);
        }
        return String.join(",", formattedHosts);
    }

    private boolean importBackupChainToTemporaryRbd(List<String> backupPaths, int timeout, RbdImageSpec sourceImage, String tempImage) {
        if (backupPaths.isEmpty() || !backupPaths.get(0).endsWith(".raw")) {
            throw new CloudRuntimeException("Incremental RBD backup chain is missing the base full backup");
        }
        String importCommand = sourceImage.buildRbdCommand("import", quote(backupPaths.get(0)), quote(tempImage));
        CommandExecutionResult importResult = executeBashCommandWithResult(importCommand, timeout, "Import raw backup to temporary RBD");
        if (importResult.exitCode != 0) {
            logger.error("Failed to import base RBD backup {} into temporary image {}. Exit code: {}, output: {}", backupPaths.get(0), tempImage,
                    importResult.exitCode, importResult.output);
            return false;
        }
        List<String> restoreSnapshots = new ArrayList<>();
        try {
            Map<String, String> baseMetadata = readRbdBackupMetadata(backupPaths.get(0));
            String baseCheckpoint = baseMetadata.get("checkpoint_name");
            if (StringUtils.isNotBlank(baseCheckpoint)) {
                if (!ensureRbdSnapshotExists(sourceImage, tempImage, baseCheckpoint, timeout)) {
                    return false;
                }
                restoreSnapshots.add(baseCheckpoint);
            }
            for (int index = 1; index < backupPaths.size(); index++) {
                String backupPath = backupPaths.get(index);
                if (!backupPath.endsWith(".rbdiff")) {
                    continue;
                }
                Map<String, String> metadata = readRbdBackupMetadata(backupPath);
                String parentCheckpoint = metadata.get("parent_checkpoint_name");
                String checkpoint = metadata.get("checkpoint_name");
                if (StringUtils.isBlank(parentCheckpoint) || StringUtils.isBlank(checkpoint)) {
                    throw new CloudRuntimeException(String.format("RBD incremental backup metadata is incomplete for %s", backupPath));
                }
                if (!rbdSnapshotExists(sourceImage, tempImage, parentCheckpoint, timeout)) {
                    throw new CloudRuntimeException(String.format("Required parent snapshot %s is missing on temporary image %s", parentCheckpoint, tempImage));
                }
                String importDiffCommand = sourceImage.buildRbdCommand("import-diff", quote(backupPath), quote(tempImage));
                CommandExecutionResult importDiffResult = executeBashCommandWithResult(importDiffCommand, timeout, "Import RBD diff to temporary image");
                if (importDiffResult.exitCode != 0) {
                    logger.error("Failed to import RBD diff {} into temporary image {}. Exit code: {}, output: {}", backupPath, tempImage,
                            importDiffResult.exitCode, importDiffResult.output);
                    return false;
                }
                if (!ensureRbdSnapshotExists(sourceImage, tempImage, checkpoint, timeout)) {
                    return false;
                }
                restoreSnapshots.add(checkpoint);
            }
            return true;
        } finally {
            cleanupRbdRestoreSnapshots(sourceImage, tempImage, restoreSnapshots, timeout);
        }
    }

    private Map<String, String> readRbdBackupMetadata(String backupPath) {
        java.nio.file.Path metadataPath = Paths.get(backupPath).getParent().resolve("rbd-backup.meta");
        if (!Files.exists(metadataPath)) {
            throw new CloudRuntimeException(String.format("RBD backup metadata file not found: %s", metadataPath));
        }
        try {
            return Files.readAllLines(metadataPath).stream()
                    .map(String::trim)
                    .filter(line -> !line.isEmpty() && line.contains("="))
                    .map(line -> line.split("=", 2))
                    .collect(java.util.stream.Collectors.toMap(parts -> parts[0], parts -> parts[1], (left, right) -> right));
        } catch (IOException e) {
            throw new CloudRuntimeException(String.format("Failed to read RBD backup metadata: %s", metadataPath), e);
        }
    }

    private boolean ensureRbdSnapshotExists(KVMStoragePool storagePool, String volumePath, String snapshotName, int timeout) {
        if (rbdSnapshotExists(storagePool, volumePath, snapshotName, timeout)) {
            return true;
        }
        String createSnapshotCommand = buildRbdSnapshotCommand(storagePool, "snap create", volumePath + "@" + snapshotName);
        CommandExecutionResult createSnapshotResult = executeBashCommandWithResult(createSnapshotCommand, timeout, "Create RBD snapshot on target volume");
        if (createSnapshotResult.exitCode != 0) {
            logger.error("Failed to create RBD snapshot {} on volume {}. Exit code: {}, output: {}", snapshotName, volumePath,
                    createSnapshotResult.exitCode, createSnapshotResult.output);
            return false;
        }
        return true;
    }

    private boolean ensureRbdSnapshotExists(RbdImageSpec imageSpec, String image, String snapshotName, int timeout) {
        if (rbdSnapshotExists(imageSpec, image, snapshotName, timeout)) {
            return true;
        }
        String createSnapshotCommand = imageSpec.buildRbdCommand("snap", "create", quote(image + "@" + snapshotName));
        CommandExecutionResult createSnapshotResult = executeBashCommandWithResult(createSnapshotCommand, timeout, "Create RBD snapshot on temporary image");
        if (createSnapshotResult.exitCode != 0) {
            logger.error("Failed to create RBD snapshot {} on image {}. Exit code: {}, output: {}", snapshotName, image,
                    createSnapshotResult.exitCode, createSnapshotResult.output);
            return false;
        }
        return true;
    }

    private CommandExecutionResult executeBashCommandWithResult(String command, int timeoutInSeconds, String description) {
        logger.debug("{} command: {}", description, command);
        String wrappedCommand = String.format("set -o pipefail; { %s; } 2>&1; rc=$?; echo \"%s${rc}\"", command, COMMAND_EXIT_MARKER);
        String output = Script.runSimpleBashScriptWithFullResult(wrappedCommand, timeoutInSeconds);
        if (StringUtils.isBlank(output)) {
            return new CommandExecutionResult(-1, "");
        }
        int markerIndex = output.lastIndexOf(COMMAND_EXIT_MARKER);
        if (markerIndex < 0) {
            logger.warn("{} command output did not include an exit marker. Output: {}", description, output);
            return new CommandExecutionResult(-1, output.trim());
        }
        String commandOutput = output.substring(0, markerIndex).trim();
        String exitCodeString = output.substring(markerIndex + COMMAND_EXIT_MARKER.length()).trim();
        int exitCode;
        try {
            exitCode = Integer.parseInt(exitCodeString);
        } catch (NumberFormatException e) {
            logger.warn("{} command exit marker was not a valid integer. Output: {}", description, output, e);
            exitCode = -1;
        }
        if (exitCode == 0) {
            logger.debug("{} command completed successfully. Output: {}", description, commandOutput);
        } else {
            logger.error("{} command failed with exit code {}. Output: {}", description, exitCode, commandOutput);
        }
        return new CommandExecutionResult(exitCode, commandOutput);
    }

    private static final class CommandExecutionResult {
        private final int exitCode;
        private final String output;

        private CommandExecutionResult(int exitCode, String output) {
            this.exitCode = exitCode;
            this.output = output;
        }
    }

    private boolean rbdSnapshotExists(KVMStoragePool storagePool, String volumePath, String snapshotName, int timeout) {
        String existsCommand = buildRbdSnapshotCommand(storagePool, "snap ls", volumePath) + " | awk 'NR>1 {print $2}' | grep -Fx " + quote(snapshotName);
        return Script.runSimpleBashScriptForExitValue(existsCommand, timeout * 1000, false) == 0;
    }

    private boolean rbdSnapshotExists(RbdImageSpec imageSpec, String image, String snapshotName, int timeout) {
        String existsCommand = imageSpec.buildRbdCommand("snap", "ls", quote(image)) + " | awk 'NR>1 {print $2}' | grep -Fx " + quote(snapshotName);
        return Script.runSimpleBashScriptForExitValue(existsCommand, timeout * 1000, false) == 0;
    }

    private void cleanupRbdRestoreSnapshots(KVMStoragePool storagePool, String volumePath, List<String> snapshotNames, int timeout) {
        for (int index = snapshotNames.size() - 1; index >= 0; index--) {
            String snapshotName = snapshotNames.get(index);
            String removeSnapshotCommand = buildRbdSnapshotCommand(storagePool, "snap rm", volumePath + "@" + snapshotName);
            Script.runSimpleBashScriptForExitValue(removeSnapshotCommand, timeout * 1000, false);
        }
    }

    private void cleanupRbdRestoreSnapshots(RbdImageSpec imageSpec, String image, List<String> snapshotNames, int timeout) {
        for (int index = snapshotNames.size() - 1; index >= 0; index--) {
            String snapshotName = snapshotNames.get(index);
            String removeSnapshotCommand = imageSpec.buildRbdCommand("snap", "rm", quote(image + "@" + snapshotName));
            Script.runSimpleBashScriptForExitValue(removeSnapshotCommand, timeout * 1000, false);
        }
    }

    private String buildRbdSnapshotCommand(KVMStoragePool storagePool, String action, String target) {
        StringBuilder command = new StringBuilder("rbd");
        if (StringUtils.isNotBlank(storagePool.getSourceHost())) {
            command.append(" -m ").append(formatRbdMonHosts(storagePool.getSourceHost(), storagePool.getSourcePort()));
        }
        if (StringUtils.isNotBlank(storagePool.getAuthUserName())) {
            command.append(" --id ").append(storagePool.getAuthUserName());
        }
        if (StringUtils.isNotBlank(storagePool.getAuthSecret())) {
            command.append(" --key ").append(storagePool.getAuthSecret());
        }
        command.append(" ").append(action).append(" ").append(target);
        return command.toString();
    }

    private void removeTemporaryRbdImage(RbdImageSpec sourceImage, String tempImage, int timeout) {
        String removeCommand = sourceImage.buildRbdCommand("rm", quote(tempImage));
        Script.runSimpleBashScriptForExitValue(removeCommand, timeout * 1000, false);
    }

    private RbdImageSpec getRbdImageSpecFromMetadata(String backupRootPath, int backupIndex) {
        java.nio.file.Path metadataPath = Paths.get(backupRootPath, "rbd-backup.meta");
        if (!Files.exists(metadataPath)) {
            throw new CloudRuntimeException(String.format("RBD backup metadata file not found: %s", metadataPath));
        }
        try {
            java.util.Map<String, String> metadata = Files.readAllLines(metadataPath).stream()
                    .map(String::trim)
                    .filter(line -> !line.isEmpty() && line.contains("="))
                    .map(line -> line.split("=", 2))
                    .collect(java.util.stream.Collectors.toMap(parts -> parts[0], parts -> parts[1], (left, right) -> right));
            String diskPaths = metadata.get("disk_paths");
            if (StringUtils.isBlank(diskPaths)) {
                throw new CloudRuntimeException("RBD backup metadata does not contain disk_paths");
            }
            List<String> values = Arrays.asList(diskPaths.split(","));
            if (backupIndex >= values.size()) {
                throw new CloudRuntimeException(String.format("RBD backup metadata does not contain disk path for index %d", backupIndex));
            }
            return RbdImageSpec.fromUri(values.get(backupIndex));
        } catch (IOException e) {
            throw new CloudRuntimeException(String.format("Failed to read RBD backup metadata: %s", metadataPath), e);
        }
    }

    private String quote(String value) {
        return "'" + value.replace("'", "'\"'\"'") + "'";
    }

    private boolean attachVolumeToVm(KVMStoragePoolManager storagePoolMgr, String vmName, PrimaryDataStoreTO volumePool, String volumePath, String cacheMode) {
        String deviceToAttachDiskTo = getDeviceToAttachDisk(vmName);
        int exitValue;
        if (volumePool.getPoolType() != Storage.StoragePoolType.RBD) {
            exitValue = Script.runSimpleBashScriptForExitValue(String.format(ATTACH_QCOW2_DISK_COMMAND, vmName, volumePath, deviceToAttachDiskTo));
        } else {
            String xmlForRbdDisk = getXmlForRbdDisk(storagePoolMgr, volumePool, volumePath, deviceToAttachDiskTo, cacheMode);
            logger.debug("RBD disk xml to attach: {}", xmlForRbdDisk);
            exitValue = Script.runSimpleBashScriptForExitValue(String.format(ATTACH_RBD_DISK_XML_COMMAND, vmName, xmlForRbdDisk));
        }
        return exitValue == 0;
    }

    private String getDeviceToAttachDisk(String vmName) {
        String currentDevice = Script.runSimpleBashScript(String.format(CURRRENT_DEVICE, vmName));
        char lastChar = currentDevice.charAt(currentDevice.length() - 1);
        char incrementedChar = (char) (lastChar + 1);
        return currentDevice.substring(0, currentDevice.length() - 1) + incrementedChar;
    }

    private String getXmlForRbdDisk(KVMStoragePoolManager storagePoolMgr, PrimaryDataStoreTO volumePool, String volumePath, String deviceToAttachDiskTo, String cacheMode) {
        StringBuilder diskBuilder = new StringBuilder();
        diskBuilder.append("\n<disk ");
        diskBuilder.append(" device='disk'");
        diskBuilder.append(" type='network'");
        diskBuilder.append(">\n");

        diskBuilder.append("<driver name='qemu' type='raw'");
        if (StringUtils.isBlank(cacheMode)) {
            cacheMode = "none";
        }
        diskBuilder.append(" cache='").append(cacheMode).append("'/> \n");

        diskBuilder.append("<source ");
        diskBuilder.append(" protocol='rbd'");
        diskBuilder.append(" name='" + volumePath + "'");
        diskBuilder.append(">\n");
        for (String sourceHost : volumePool.getHost().split(",")) {
            diskBuilder.append("<host name='");
            diskBuilder.append(sourceHost.replace("[", "").replace("]", ""));
            if (volumePool.getPort() != 0) {
                diskBuilder.append("' port='");
                diskBuilder.append(volumePool.getPort());
            }
            diskBuilder.append("'/>\n");
        }
        diskBuilder.append("</source>\n");
        String authUserName = null;
        final KVMStoragePool primaryPool = storagePoolMgr.getStoragePool(volumePool.getPoolType(), volumePool.getUuid());
        if (primaryPool != null) {
            authUserName = primaryPool.getAuthUserName();
        }
        if (StringUtils.isNotBlank(authUserName)) {
            diskBuilder.append("<auth username='" + authUserName + "'>\n");
            diskBuilder.append("<secret type='ceph' uuid='" + volumePool.getUuid() + "'/>\n");
            diskBuilder.append("</auth>\n");
        }
        diskBuilder.append("<target dev='" + deviceToAttachDiskTo + "'");
        diskBuilder.append(" bus='virtio'");
        diskBuilder.append("/>\n");
        diskBuilder.append("</disk>\n");
        return diskBuilder.toString();
    }

    private void fetchBackupFile(String hostName, String backupPath) {
        int mkdirExit = Script.runSimpleBashScriptForExitValue(String.format(MKDIR_P, backupPath));
        if (mkdirExit != 0) {
            throw new CloudRuntimeException(String.format("Failed to create local backup directory: %s", backupPath));
        }

        String cmd = String.format(RSYNC_DIR_FROM_REMOTE, hostName, backupPath, backupPath);
        logger.debug("Fetching commvault backup directory from remote host. cmd={}", cmd);

        int exit = Script.runSimpleBashScriptForExitValue(cmd);
        if (exit != 0) {
            throw new CloudRuntimeException(String.format(
                    "Failed to fetch backup directory from remote host [%s]. remotePath=[%s], localPath=[%s]",
                    hostName, backupPath, backupPath));
        }
    }

    private static final class RbdImageSpec {
        private final String image;
        private final String monHost;
        private final String user;
        private final String key;

        private RbdImageSpec(String image, String monHost, String user, String key) {
            this.image = image;
            this.monHost = monHost;
            this.user = user;
            this.key = key;
        }

        private static RbdImageSpec fromUri(String uri) {
            String image = null;
            String monHost = null;
            String user = null;
            String key = null;
            if (uri.startsWith("rbd:")) {
                String payload = uri.substring("rbd:".length());
                image = payload.contains(":") ? payload.substring(0, payload.indexOf(':')) : payload;
                monHost = extract(uri, ":mon_host=([^:]*)");
                if (monHost != null) {
                    monHost = monHost.replace("\\;", ",").replace("\\:", ":");
                }
                user = extract(uri, ":id=([^:]*)");
                key = extract(uri, ":key=([^:]*)");
            } else if (uri.startsWith("rbd/")) {
                image = uri;
            }
            if (StringUtils.isBlank(image)) {
                throw new CloudRuntimeException(String.format("Unable to parse RBD disk path: %s", uri));
            }
            return new RbdImageSpec(image, monHost, user, key);
        }

        private static String extract(String value, String regex) {
            java.util.regex.Matcher matcher = java.util.regex.Pattern.compile(regex).matcher(value);
            return matcher.find() ? matcher.group(1) : null;
        }

        private String buildTempImageSpec() {
            return String.format("%s-csrestore-%s", image, org.apache.commons.lang3.RandomStringUtils.randomAlphanumeric(8).toLowerCase(Locale.ROOT));
        }

        private String buildRbdCommand(String action, String source, String target) {
            StringBuilder command = new StringBuilder("rbd");
            if (StringUtils.isNotBlank(monHost)) {
                command.append(" -m ").append(quoteArg(monHost));
            }
            if (StringUtils.isNotBlank(user)) {
                command.append(" --id ").append(quoteArg(user));
            }
            if (StringUtils.isNotBlank(key)) {
                command.append(" --key ").append(quoteArg(key));
            }
            command.append(" ").append(action);
            if (StringUtils.isNotBlank(source)) {
                command.append(" ").append(source);
            }
            if (StringUtils.isNotBlank(target)) {
                command.append(" ").append(target);
            }
            return command.toString();
        }

        private String buildRbdCommand(String action, String target) {
            return buildRbdCommand(action, null, target);
        }

        private String buildQemuUri(String imageSpec) {
            StringBuilder uri = new StringBuilder("rbd:").append(imageSpec);
            if (StringUtils.isNotBlank(monHost)) {
                uri.append(":mon_host=").append(monHost.replace(",", "\\;"));
            }
            if (StringUtils.isNotBlank(user)) {
                uri.append(":id=").append(user);
            }
            if (StringUtils.isNotBlank(key)) {
                uri.append(":key=").append(key);
            }
            return uri.toString();
        }

        private String quoteArg(String value) {
            return "'" + value.replace("'", "'\"'\"'") + "'";
        }
    }
}
