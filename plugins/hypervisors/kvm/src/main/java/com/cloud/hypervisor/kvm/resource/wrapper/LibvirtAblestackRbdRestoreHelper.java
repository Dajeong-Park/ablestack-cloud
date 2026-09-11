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

package com.cloud.hypervisor.kvm.resource.wrapper;

import com.cloud.hypervisor.kvm.storage.KVMPhysicalDisk;
import com.cloud.hypervisor.kvm.storage.KVMStoragePool;
import com.cloud.utils.exception.CloudRuntimeException;
import com.cloud.utils.script.Script;
import org.apache.cloudstack.utils.qemu.QemuImg;
import org.apache.cloudstack.utils.qemu.QemuImgException;
import org.apache.cloudstack.utils.qemu.QemuImgFile;
import org.apache.commons.lang3.RandomStringUtils;
import org.apache.commons.lang3.StringUtils;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.libvirt.LibvirtException;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.Map;

final class LibvirtAblestackRbdRestoreHelper {
    private static final Logger LOGGER = LogManager.getLogger(LibvirtAblestackRbdRestoreHelper.class);
    private static final String COMMAND_EXIT_MARKER = "__CS_COMMAND_EXIT__=";
    private static final long RESTORE_PRIMARY_SPACE_BUFFER_BYTES = 10L * 1024L * 1024L * 1024L;
    private static final String RBD_RESTORE_TEMP_SUFFIX = "-csrestore-";
    private static final String RBD_RESTORE_ORIGINAL_SUFFIX = "-csrestore-original-";

    private LibvirtAblestackRbdRestoreHelper() {
    }

    static boolean restoreRbdBackup(final String tracePrefix, final KVMStoragePool storagePool, final String volumePath,
            final List<String> backupPaths, final int timeoutSeconds, final boolean createTargetVolume) {
        if (backupPaths == null || backupPaths.isEmpty()) {
            return false;
        }

        validateRbdStorageSpace(tracePrefix, storagePool, backupPaths, timeoutSeconds);

        final String temporaryVolumePath = buildTemporaryRbdImageName(volumePath);
        boolean temporaryImageCreated = false;
        try {
            if (!restoreRbdBackupToImage(tracePrefix, storagePool, temporaryVolumePath, backupPaths, timeoutSeconds, true)) {
                LOGGER.error("{} phase=[RBD_TEMP_RESTORE_FAILED], targetVolume=[{}], temporaryVolume=[{}]",
                        tracePrefix, volumePath, temporaryVolumePath);
                return false;
            }
            temporaryImageCreated = true;
            return promoteTemporaryRbdImage(tracePrefix, storagePool, volumePath, temporaryVolumePath, timeoutSeconds, createTargetVolume);
        } finally {
            if (temporaryImageCreated && rbdImageExists(storagePool, temporaryVolumePath, timeoutSeconds)) {
                LOGGER.warn("{} phase=[RBD_TEMP_CLEANUP], temporaryVolume=[{}]", tracePrefix, temporaryVolumePath);
                deleteRbdImageIfPresent(tracePrefix, storagePool, temporaryVolumePath, timeoutSeconds);
            }
        }
    }

    private static boolean restoreRbdBackupToImage(final String tracePrefix, final KVMStoragePool storagePool, final String volumePath,
            final List<String> backupPaths, final int timeoutSeconds, final boolean createTargetVolume) {
        if (backupPaths.stream().anyMatch(path -> path.endsWith(".rbdiff"))) {
            return restoreIncrementalRbdBackupChain(tracePrefix, storagePool, volumePath, backupPaths, timeoutSeconds, createTargetVolume);
        }

        final String backupPath = LibvirtAblestackFileRestoreHelper.getRestorableFileBackupPath(backupPaths);
        if (getBackupFileFormat(backupPath) == QemuImg.PhysicalDiskFormat.RAW) {
            return importRawBackupToRbd(storagePool, volumePath, backupPath, timeoutSeconds, createTargetVolume);
        }

        QemuImg qemu;
        try {
            qemu = new QemuImg(timeoutSeconds * 1000, true, false);
            if (!createTargetVolume) {
                final KVMPhysicalDisk rbdDisk = storagePool.getPhysicalDisk(volumePath);
                LOGGER.debug("Restoring RBD volume: {}", rbdDisk);
                qemu.setSkipTargetVolumeCreation(true);
            }
        } catch (final LibvirtException ex) {
            throw new CloudRuntimeException("Failed to create qemu-img command to restore RBD volume with backup", ex);
        }

        QemuImgFile srcBackupFile = null;
        QemuImgFile destVolumeFile = null;
        try {
            srcBackupFile = new QemuImgFile(backupPath, getBackupFileFormat(backupPath));
            destVolumeFile = new QemuImgFile(KVMPhysicalDisk.RBDStringBuilder(storagePool, volumePath), QemuImg.PhysicalDiskFormat.RAW);
            LOGGER.debug("{} phase=[RBD_CONVERT_BEGIN], source=[{}], targetVolume=[{}]", tracePrefix, backupPath, volumePath);
            qemu.convert(srcBackupFile, destVolumeFile);
            LOGGER.debug("{} phase=[RBD_CONVERT_DONE], source=[{}], targetVolume=[{}]", tracePrefix, backupPath, volumePath);
            return true;
        } catch (final QemuImgException | LibvirtException e) {
            final String srcFilename = srcBackupFile != null ? srcBackupFile.getFileName() : null;
            final String destFilename = destVolumeFile != null ? destVolumeFile.getFileName() : null;
            LOGGER.error("Failed to convert backup {} to volume {}, the error was: {}", srcFilename, destFilename, e.getMessage());
            return false;
        }
    }

    private static boolean restoreIncrementalRbdBackupChain(final String tracePrefix, final KVMStoragePool storagePool, final String volumePath,
            final List<String> backupPaths, final int timeoutSeconds, final boolean createTargetVolume) {
        if (backupPaths.isEmpty() || !backupPaths.get(0).endsWith(".raw")) {
            throw new CloudRuntimeException("Incremental RBD backup chain is missing the base full backup");
        }
        if (!restoreRbdBackupToImage(tracePrefix, storagePool, volumePath, List.of(backupPaths.get(0)), timeoutSeconds, createTargetVolume)) {
            return false;
        }

        final List<String> restoreSnapshots = new ArrayList<>();
        try {
            final Map<String, String> baseMetadata = readRbdBackupMetadata(backupPaths.get(0));
            final String baseCheckpoint = baseMetadata.get("checkpoint_name");
            if (StringUtils.isNotBlank(baseCheckpoint)) {
                if (!ensureRbdSnapshotExists(storagePool, volumePath, baseCheckpoint, timeoutSeconds)) {
                    return false;
                }
                restoreSnapshots.add(baseCheckpoint);
            }

            for (int index = 1; index < backupPaths.size(); index++) {
                final String backupPath = backupPaths.get(index);
                if (!backupPath.endsWith(".rbdiff")) {
                    continue;
                }
                final Map<String, String> metadata = readRbdBackupMetadata(backupPath);
                final String parentCheckpoint = metadata.get("parent_checkpoint_name");
                final String checkpoint = metadata.get("checkpoint_name");
                if (StringUtils.isBlank(parentCheckpoint) || StringUtils.isBlank(checkpoint)) {
                    throw new CloudRuntimeException(String.format("RBD incremental backup metadata is incomplete for %s", backupPath));
                }
                if (!rbdSnapshotExists(storagePool, volumePath, parentCheckpoint, timeoutSeconds)) {
                    throw new CloudRuntimeException(String.format("Required parent snapshot %s is missing on volume %s", parentCheckpoint, volumePath));
                }
                final CommandExecutionResult importDiffResult = executeBashCommandWithResult(
                        buildRbdCommand(storagePool, "import-diff", backupPath, volumePath), timeoutSeconds, "Import RBD diff to temporary volume");
                if (importDiffResult.exitCode != 0) {
                    LOGGER.error("Failed to import RBD diff {} into volume {}. Exit code: {}, output: {}", backupPath, volumePath,
                            importDiffResult.exitCode, importDiffResult.output);
                    return false;
                }
                if (!ensureRbdSnapshotExists(storagePool, volumePath, checkpoint, timeoutSeconds)) {
                    return false;
                }
                restoreSnapshots.add(checkpoint);
            }
            return true;
        } finally {
            cleanupRbdRestoreSnapshots(storagePool, volumePath, restoreSnapshots, timeoutSeconds);
        }
    }

    private static boolean importRawBackupToRbd(final KVMStoragePool storagePool, final String volumePath, final String backupPath,
            final int timeoutSeconds, final boolean createTargetVolume) {
        if (!createTargetVolume && !deleteRbdImageIfPresent(storagePool, volumePath, timeoutSeconds)) {
            LOGGER.error("Failed to delete existing RBD volume {} before raw import", volumePath);
            return false;
        }

        final CommandExecutionResult importResult = executeBashCommandWithResult(
                buildRbdCommand(storagePool, "import", backupPath, volumePath), timeoutSeconds, "Import raw backup to RBD");
        if (importResult.exitCode != 0) {
            LOGGER.error("Failed to import raw backup {} into volume {}. Exit code: {}, output: {}", backupPath, volumePath,
                    importResult.exitCode, importResult.output);
            return false;
        }
        return true;
    }

    private static boolean promoteTemporaryRbdImage(final String tracePrefix, final KVMStoragePool storagePool, final String targetVolumePath,
            final String temporaryVolumePath, final int timeoutSeconds, final boolean createTargetVolume) {
        final String originalVolumePath = buildOriginalRbdImageName(targetVolumePath);
        boolean originalMovedAside = false;
        try {
            if (rbdImageExists(storagePool, targetVolumePath, timeoutSeconds)) {
                if (createTargetVolume) {
                    LOGGER.warn("{} phase=[RBD_TARGET_EXISTS_FOR_NEW_RESTORE], targetVolume=[{}], temporaryVolume=[{}]",
                            tracePrefix, targetVolumePath, temporaryVolumePath);
                    return false;
                }
                if (!renameRbdImage(storagePool, targetVolumePath, originalVolumePath, timeoutSeconds)) {
                    LOGGER.error("{} phase=[RBD_ORIGINAL_RENAME_FAILED], targetVolume=[{}], originalVolume=[{}]",
                            tracePrefix, targetVolumePath, originalVolumePath);
                    return false;
                }
                originalMovedAside = true;
            } else if (!createTargetVolume) {
                LOGGER.warn("{} phase=[RBD_ORIGINAL_MISSING_BEFORE_PROMOTE], targetVolume=[{}]", tracePrefix, targetVolumePath);
            }

            if (!renameRbdImage(storagePool, temporaryVolumePath, targetVolumePath, timeoutSeconds)) {
                LOGGER.error("{} phase=[RBD_TEMP_PROMOTE_FAILED], targetVolume=[{}], temporaryVolume=[{}]",
                        tracePrefix, targetVolumePath, temporaryVolumePath);
                if (originalMovedAside) {
                    rollbackOriginalRbdImage(tracePrefix, storagePool, targetVolumePath, originalVolumePath, timeoutSeconds);
                }
                return false;
            }

            if (originalMovedAside && !deleteRbdImageIfPresent(tracePrefix, storagePool, originalVolumePath, timeoutSeconds)) {
                LOGGER.warn("{} phase=[RBD_ORIGINAL_CLEANUP_FAILED], originalVolume=[{}]", tracePrefix, originalVolumePath);
            }
            LOGGER.info("{} phase=[RBD_TEMP_PROMOTED], targetVolume=[{}], temporaryVolume=[{}], originalVolume=[{}]",
                    tracePrefix, targetVolumePath, temporaryVolumePath, originalMovedAside ? originalVolumePath : null);
            return true;
        } catch (final CloudRuntimeException e) {
            if (originalMovedAside) {
                rollbackOriginalRbdImage(tracePrefix, storagePool, targetVolumePath, originalVolumePath, timeoutSeconds);
            }
            throw e;
        }
    }

    private static void rollbackOriginalRbdImage(final String tracePrefix, final KVMStoragePool storagePool, final String targetVolumePath,
            final String originalVolumePath, final int timeoutSeconds) {
        if (!rbdImageExists(storagePool, originalVolumePath, timeoutSeconds)) {
            LOGGER.error("{} phase=[RBD_ORIGINAL_ROLLBACK_SKIPPED], targetVolume=[{}], originalVolume=[{}]",
                    tracePrefix, targetVolumePath, originalVolumePath);
            return;
        }
        if (rbdImageExists(storagePool, targetVolumePath, timeoutSeconds)) {
            deleteRbdImageIfPresent(tracePrefix, storagePool, targetVolumePath, timeoutSeconds);
        }
        if (!renameRbdImage(storagePool, originalVolumePath, targetVolumePath, timeoutSeconds)) {
            LOGGER.error("{} phase=[RBD_ORIGINAL_ROLLBACK_FAILED], targetVolume=[{}], originalVolume=[{}]",
                    tracePrefix, targetVolumePath, originalVolumePath);
        }
    }

    private static void validateRbdStorageSpace(final String tracePrefix, final KVMStoragePool storagePool, final List<String> backupPaths,
            final int timeoutSeconds) {
        final long requiredBytes = estimateRequiredBytesForRbdRestore(backupPaths);
        final long bufferBytes = Math.max(RESTORE_PRIMARY_SPACE_BUFFER_BYTES, requiredBytes / 5L);
        final long minimumAvailableBytes = requiredBytes + bufferBytes;
        final Long availableBytes = getCephPoolAvailableBytes(storagePool, timeoutSeconds);
        if (availableBytes == null) {
            LOGGER.warn("{} phase=[RBD_SPACE_CHECK_SKIPPED], pool=[{}], requiredBytes=[{}], bufferBytes=[{}]",
                    tracePrefix, storagePool.getSourceDir(), requiredBytes, bufferBytes);
            return;
        }
        LOGGER.info("{} phase=[RBD_SPACE_CHECK], pool=[{}], requiredBytes=[{}], bufferBytes=[{}], minimumAvailableBytes=[{}], availableBytes=[{}]",
                tracePrefix, storagePool.getSourceDir(), requiredBytes, bufferBytes, minimumAvailableBytes, availableBytes);
        if (availableBytes < minimumAvailableBytes) {
            throw new CloudRuntimeException(String.format(
                    "Insufficient Ceph RBD pool space for restore on pool [%s]. Required at least [%d] bytes including buffer, but only [%d] bytes are available.",
                    storagePool.getSourceDir(), minimumAvailableBytes, availableBytes));
        }
    }

    private static long estimateRequiredBytesForRbdRestore(final List<String> backupPaths) {
        final String sizeSource = backupPaths.stream().anyMatch(path -> path.endsWith(".rbdiff")) && backupPaths.get(0).endsWith(".raw")
                ? backupPaths.get(0) : LibvirtAblestackFileRestoreHelper.getRestorableFileBackupPath(backupPaths);
        try {
            final QemuImg qemu = new QemuImg(0);
            final Map<String, String> info = qemu.info(new QemuImgFile(sizeSource, getBackupFileFormat(sizeSource)));
            final String virtualSize = info.get(QemuImg.VIRTUAL_SIZE);
            if (StringUtils.isNotBlank(virtualSize)) {
                return Long.parseLong(virtualSize);
            }
        } catch (final NumberFormatException | QemuImgException | LibvirtException e) {
            LOGGER.warn("Failed to parse virtual size for RBD restore backup [{}]. Falling back to file size.", sizeSource, e);
        }
        try {
            return Files.size(Paths.get(sizeSource));
        } catch (final IOException e) {
            throw new CloudRuntimeException(String.format("Failed to estimate RBD restore size for backup [%s]: %s", sizeSource, e.getMessage()), e);
        }
    }

    private static Long getCephPoolAvailableBytes(final KVMStoragePool storagePool, final int timeoutSeconds) {
        final String pool = storagePool.getSourceDir();
        final String python = "import json,sys; "
                + "pool=sys.argv[1]; data=json.load(sys.stdin); "
                + "pools=data.get('pools', []); "
                + "matches=[p for p in pools if p.get('name') == pool]; "
                + "stats=(matches[0].get('stats', {}) if matches else (data.get('stats', {}) if not pool else {})); "
                + "value=stats.get('max_avail') or stats.get('available') or stats.get('total_avail_bytes'); "
                + "print(value if value is not None else '')";
        final String command = buildCephCommand(storagePool, "df", "detail", "--format", "json")
                + " | python3 -c " + quote(python) + " " + quote(pool);
        final CommandExecutionResult result = executeBashCommandWithResult(command, timeoutSeconds, "Query Ceph pool available bytes");
        if (result.exitCode != 0 || StringUtils.isBlank(result.output)) {
            return null;
        }
        final String lastLine = Arrays.stream(result.output.split("\n"))
                .map(String::trim)
                .filter(StringUtils::isNotBlank)
                .reduce((first, second) -> second)
                .orElse("");
        try {
            return Long.parseLong(lastLine);
        } catch (final NumberFormatException e) {
            LOGGER.warn("Failed to parse Ceph pool available bytes from output [{}]", result.output, e);
            return null;
        }
    }

    private static QemuImg.PhysicalDiskFormat getBackupFileFormat(final String backupPath) {
        if (backupPath.endsWith(".raw")) {
            return QemuImg.PhysicalDiskFormat.RAW;
        }
        return QemuImg.PhysicalDiskFormat.QCOW2;
    }

    private static Map<String, String> readRbdBackupMetadata(final String backupPath) {
        final java.nio.file.Path metadataPath = Paths.get(backupPath).getParent().resolve("rbd-backup.meta");
        if (!Files.exists(metadataPath)) {
            throw new CloudRuntimeException(String.format("RBD backup metadata file not found: %s", metadataPath));
        }
        try {
            return Files.readAllLines(metadataPath).stream()
                    .map(String::trim)
                    .filter(line -> !line.isEmpty() && line.contains("="))
                    .map(line -> line.split("=", 2))
                    .collect(java.util.stream.Collectors.toMap(parts -> parts[0], parts -> parts[1], (left, right) -> right));
        } catch (final IOException e) {
            throw new CloudRuntimeException(String.format("Failed to read RBD backup metadata: %s", metadataPath), e);
        }
    }

    private static boolean ensureRbdSnapshotExists(final KVMStoragePool storagePool, final String volumePath, final String snapshotName,
            final int timeoutSeconds) {
        if (rbdSnapshotExists(storagePool, volumePath, snapshotName, timeoutSeconds)) {
            return true;
        }
        final CommandExecutionResult result = executeBashCommandWithResult(
                buildRbdCommand(storagePool, "snap", "create", volumePath + "@" + snapshotName), timeoutSeconds, "Create RBD snapshot");
        if (result.exitCode != 0) {
            LOGGER.error("Failed to create RBD snapshot {} on volume {}. Exit code: {}, output: {}", snapshotName, volumePath, result.exitCode, result.output);
            return false;
        }
        return true;
    }

    private static boolean rbdSnapshotExists(final KVMStoragePool storagePool, final String volumePath, final String snapshotName,
            final int timeoutSeconds) {
        final String existsCommand = buildRbdCommand(storagePool, "snap", "ls", volumePath)
                + " | awk 'NR>1 {print $2}' | grep -Fx " + quote(snapshotName);
        return Script.runSimpleBashScriptForExitValue(existsCommand, timeoutSeconds * 1000, false) == 0;
    }

    private static void cleanupRbdRestoreSnapshots(final KVMStoragePool storagePool, final String volumePath, final List<String> snapshotNames,
            final int timeoutSeconds) {
        for (int index = snapshotNames.size() - 1; index >= 0; index--) {
            final String snapshotName = snapshotNames.get(index);
            Script.runSimpleBashScriptForExitValue(buildRbdCommand(storagePool, "snap", "rm", volumePath + "@" + snapshotName),
                    timeoutSeconds * 1000, false);
        }
    }

    private static boolean renameRbdImage(final KVMStoragePool storagePool, final String sourceImage, final String targetImage,
            final int timeoutSeconds) {
        return executeBashCommandWithResult(buildRbdCommand(storagePool, "rename", sourceImage, targetImage), timeoutSeconds, "Rename RBD image").exitCode == 0;
    }

    private static boolean rbdImageExists(final KVMStoragePool storagePool, final String volumePath, final int timeoutSeconds) {
        return Script.runSimpleBashScriptForExitValue(buildRbdCommand(storagePool, "info", volumePath), timeoutSeconds * 1000, false) == 0;
    }

    private static boolean deleteRbdImageIfPresent(final KVMStoragePool storagePool, final String volumePath, final int timeoutSeconds) {
        return deleteRbdImageIfPresent(null, storagePool, volumePath, timeoutSeconds);
    }

    private static boolean deleteRbdImageIfPresent(final String tracePrefix, final KVMStoragePool storagePool, final String volumePath, final int timeoutSeconds) {
        if (!rbdImageExists(storagePool, volumePath, timeoutSeconds)) {
            return true;
        }
        if (rbdImageHasSnapshots(storagePool, volumePath, timeoutSeconds) && !purgeRbdImageSnapshots(tracePrefix, storagePool, volumePath, timeoutSeconds)) {
            return false;
        }
        CommandExecutionResult result = executeBashCommandWithResult(buildRbdCommand(storagePool, "rm", volumePath), timeoutSeconds, "Remove RBD image");
        if (result.exitCode == 0) {
            return true;
        }
        if (StringUtils.isNotBlank(tracePrefix)) {
            LOGGER.warn("{} phase=[RBD_IMAGE_DELETE_RETRY_WITH_SNAPSHOT_PURGE], image=[{}], exitCode=[{}], output=[{}]",
                    tracePrefix, volumePath, result.exitCode, result.output);
        }
        if (!purgeRbdImageSnapshots(tracePrefix, storagePool, volumePath, timeoutSeconds)) {
            return false;
        }
        result = executeBashCommandWithResult(buildRbdCommand(storagePool, "rm", volumePath), timeoutSeconds, "Remove RBD image after snapshot purge");
        if (result.exitCode != 0 && StringUtils.isNotBlank(tracePrefix)) {
            LOGGER.warn("{} phase=[RBD_IMAGE_DELETE_AFTER_PURGE_FAILED], image=[{}], exitCode=[{}], output=[{}]",
                    tracePrefix, volumePath, result.exitCode, result.output);
        }
        return result.exitCode == 0;
    }

    private static boolean rbdImageHasSnapshots(final KVMStoragePool storagePool, final String volumePath, final int timeoutSeconds) {
        final String command = buildRbdCommand(storagePool, "snap", "ls", volumePath) + " | awk 'NR>1 {found=1} END {exit found ? 0 : 1}'";
        return Script.runSimpleBashScriptForExitValue(command, timeoutSeconds * 1000, false) == 0;
    }

    private static boolean purgeRbdImageSnapshots(final String tracePrefix, final KVMStoragePool storagePool, final String volumePath,
            final int timeoutSeconds) {
        if (StringUtils.isNotBlank(tracePrefix)) {
            LOGGER.info("{} phase=[RBD_IMAGE_SNAPSHOT_PURGE], image=[{}]", tracePrefix, volumePath);
        }
        final CommandExecutionResult purgeResult = executeBashCommandWithResult(buildRbdCommand(storagePool, "snap", "purge", volumePath),
                timeoutSeconds, "Purge RBD image snapshots before remove");
        if (purgeResult.exitCode != 0) {
            if (StringUtils.isNotBlank(tracePrefix)) {
                LOGGER.warn("{} phase=[RBD_IMAGE_SNAPSHOT_PURGE_FAILED], image=[{}], exitCode=[{}], output=[{}]",
                        tracePrefix, volumePath, purgeResult.exitCode, purgeResult.output);
            }
            return false;
        }
        return true;
    }

    private static String buildTemporaryRbdImageName(final String volumePath) {
        return String.format("%s%s%s", volumePath, RBD_RESTORE_TEMP_SUFFIX, RandomStringUtils.randomAlphanumeric(8).toLowerCase(Locale.ROOT));
    }

    private static String buildOriginalRbdImageName(final String volumePath) {
        return String.format("%s%s%s", volumePath, RBD_RESTORE_ORIGINAL_SUFFIX, System.currentTimeMillis());
    }

    private static String buildRbdCommand(final KVMStoragePool storagePool, final String action, final String... args) {
        return buildCephToolCommand("rbd", storagePool, action, args);
    }

    private static String buildCephCommand(final KVMStoragePool storagePool, final String action, final String... args) {
        return buildCephToolCommand("ceph", storagePool, action, args);
    }

    private static String buildCephToolCommand(final String tool, final KVMStoragePool storagePool, final String action, final String... args) {
        final StringBuilder command = new StringBuilder(tool);
        if (StringUtils.isNotBlank(storagePool.getSourceHost())) {
            command.append(" -m ").append(quote(formatRbdMonHosts(storagePool.getSourceHost(), storagePool.getSourcePort())));
        }
        if (StringUtils.isNotBlank(storagePool.getAuthUserName())) {
            command.append(" --id ").append(quote(storagePool.getAuthUserName()));
        }
        if (StringUtils.isNotBlank(storagePool.getAuthSecret())) {
            command.append(" --key ").append(quote(storagePool.getAuthSecret()));
        }
        command.append(" ").append(action);
        for (final String arg : args) {
            command.append(" ").append(quote(arg));
        }
        return command.toString();
    }

    private static String formatRbdMonHosts(final String hosts, final int port) {
        final String[] hostValues = hosts.split(",");
        final List<String> formattedHosts = new ArrayList<>();
        for (final String host : hostValues) {
            final String normalizedHost = host.replace("[", "").replace("]", "").trim();
            if (StringUtils.isBlank(normalizedHost)) {
                continue;
            }
            formattedHosts.add(port > 0 ? normalizedHost + ":" + port : normalizedHost);
        }
        return String.join(",", formattedHosts);
    }

    private static CommandExecutionResult executeBashCommandWithResult(final String command, final int timeoutSeconds, final String description) {
        LOGGER.debug("{} command: {}", description, command);
        final String wrappedCommand = String.format("set -o pipefail; { %s; } 2>&1; rc=$?; echo \"%s${rc}\"", command, COMMAND_EXIT_MARKER);
        final String output = Script.runSimpleBashScriptWithFullResult(wrappedCommand, timeoutSeconds * 1000);
        if (StringUtils.isBlank(output)) {
            return new CommandExecutionResult(-1, "");
        }
        final int markerIndex = output.lastIndexOf(COMMAND_EXIT_MARKER);
        if (markerIndex < 0) {
            LOGGER.warn("{} command output did not include an exit marker. Output: {}", description, output);
            return new CommandExecutionResult(-1, output.trim());
        }
        final String commandOutput = output.substring(0, markerIndex).trim();
        final String exitCodeString = output.substring(markerIndex + COMMAND_EXIT_MARKER.length()).trim();
        int exitCode;
        try {
            exitCode = Integer.parseInt(exitCodeString);
        } catch (final NumberFormatException e) {
            LOGGER.warn("{} command exit marker was not a valid integer. Output: {}", description, output, e);
            exitCode = -1;
        }
        return new CommandExecutionResult(exitCode, commandOutput);
    }

    private static String quote(final String value) {
        return "'" + value.replace("'", "'\"'\"'") + "'";
    }

    private static final class CommandExecutionResult {
        private final int exitCode;
        private final String output;

        private CommandExecutionResult(final int exitCode, final String output) {
            this.exitCode = exitCode;
            this.output = output;
        }
    }
}
