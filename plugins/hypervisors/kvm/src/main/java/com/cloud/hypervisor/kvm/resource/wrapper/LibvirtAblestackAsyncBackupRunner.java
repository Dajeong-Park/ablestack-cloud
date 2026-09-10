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

import com.cloud.agent.api.Command;
import com.cloud.utils.Pair;

import org.apache.cloudstack.backup.AblestackBackupFrameworkUtils;
import org.apache.cloudstack.backup.BackupAnswer;
import org.apache.logging.log4j.Logger;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.nio.file.attribute.PosixFilePermissions;
import java.time.Instant;
import java.util.Arrays;
import java.util.Properties;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Supplier;

final class LibvirtAblestackAsyncBackupRunner {
    static final String STATE_STARTED = "STARTED";
    static final String STATE_RUNNING = "RUNNING";
    static final String STATE_COMPLETED = "COMPLETED";
    static final String STATE_FAILED = "FAILED";
    static final String STATE_INTERRUPTED = "INTERRUPTED";
    private static final Path JOB_ROOT = Path.of(AblestackBackupFrameworkUtils.ASYNC_BACKUP_JOB_ROOT);
    private static final String EXIT_CODE_FILE = "exit-code";
    private static final String LOG_FILE = "job.log";
    private static final String SCRIPT_FILE = "run.sh";
    private static final Set<String> ACTIVE_JOBS = ConcurrentHashMap.newKeySet();

    private LibvirtAblestackAsyncBackupRunner() {
    }

    static BackupAnswer start(final Command command, final Logger logger, final String trace, final String provider, final String jobId,
            final String vmName, final String backupPath, final String backupType, final Supplier<Pair<Integer, String>> task) {
        final String effectiveJobId = safeValue(jobId);
        writeJobState(logger, effectiveJobId, provider, vmName, backupPath, backupType, STATE_STARTED, null);
        Thread worker = new Thread(() -> {
            ACTIVE_JOBS.add(effectiveJobId);
            writeJobState(logger, effectiveJobId, provider, vmName, backupPath, backupType, STATE_RUNNING, null);
            try {
                Pair<Integer, String> asyncResult = task.get();
                if (asyncResult.first() == 0) {
                    writeJobState(logger, effectiveJobId, provider, vmName, backupPath, backupType, STATE_COMPLETED, asyncResult.second());
                    logger.info("{} phase=[AGENT_ASYNC_DONE], provider=[{}], jobId=[{}], vm=[{}], backupPath=[{}], backupType=[{}], details=[{}]",
                            trace, provider, effectiveJobId, vmName, backupPath, backupType, asyncResult.second());
                } else {
                    writeJobState(logger, effectiveJobId, provider, vmName, backupPath, backupType, STATE_FAILED, asyncResult.second());
                    logger.warn("{} phase=[AGENT_ASYNC_FAILED], provider=[{}], jobId=[{}], vm=[{}], backupPath=[{}], backupType=[{}], resultCode=[{}], reason=[{}]",
                            trace, provider, effectiveJobId, vmName, backupPath, backupType, asyncResult.first(), asyncResult.second());
                }
            } catch (RuntimeException e) {
                writeJobState(logger, effectiveJobId, provider, vmName, backupPath, backupType, STATE_FAILED, e.getMessage());
                logger.warn("{} phase=[AGENT_ASYNC_FAILED], provider=[{}], jobId=[{}], vm=[{}], backupPath=[{}], backupType=[{}], reason=[{}]",
                        trace, provider, effectiveJobId, vmName, backupPath, backupType, e.getMessage(), e);
            } finally {
                ACTIVE_JOBS.remove(effectiveJobId);
            }
        }, String.format("ablestack-%s-backup-%s", safeValue(provider).toLowerCase(), safeValue(vmName)));
        worker.setDaemon(true);
        worker.start();
        logger.info("{} phase=[AGENT_STARTED], provider=[{}], jobId=[{}], vm=[{}], backupPath=[{}], backupType=[{}]",
                trace, provider, effectiveJobId, vmName, backupPath, backupType);
        return new BackupAnswer(command, true, "started");
    }

    static BackupAnswer startDetached(final Command command, final Logger logger, final String trace, final String provider, final String jobId,
            final String vmName, final String backupPath, final String backupType, final String[] scriptCommand) {
        final String effectiveJobId = safeValue(jobId);
        if (effectiveJobId.isBlank()) {
            return new BackupAnswer(command, false, "backup job id is required for detached execution");
        }
        if (scriptCommand == null || scriptCommand.length == 0) {
            return new BackupAnswer(command, false, "backup script command is required for detached execution");
        }

        final String unitName = getSystemdUnitName(effectiveJobId);
        try {
            Files.createDirectories(getJobDirectory(effectiveJobId));
            writeDetachedScript(effectiveJobId, provider, vmName, backupPath, backupType, scriptCommand);
            writeJobState(logger, effectiveJobId, provider, vmName, backupPath, backupType, STATE_STARTED,
                    "Detached backup job prepared");
            Properties properties = readJob(effectiveJobId, logger);
            if (properties != null) {
                properties.setProperty("unitName", unitName);
                properties.setProperty("launcher", "systemd-run");
                properties.setProperty("script", getDetachedScriptPath(effectiveJobId).toString());
                properties.setProperty("log", getJobDirectory(effectiveJobId).resolve(LOG_FILE).toString());
                storeJobProperties(logger, effectiveJobId, properties);
            }

            Pair<Integer, String> launchResult = launchDetached(effectiveJobId, unitName);
            if (launchResult.first() != 0) {
                writeJobState(logger, effectiveJobId, provider, vmName, backupPath, backupType, STATE_FAILED, launchResult.second());
                logger.warn("{} phase=[AGENT_DETACHED_START_FAILED], provider=[{}], jobId=[{}], vm=[{}], backupPath=[{}], "
                                + "backupType=[{}], unit=[{}], reason=[{}]",
                        trace, provider, effectiveJobId, vmName, backupPath, backupType, unitName, launchResult.second());
                return new BackupAnswer(command, false, launchResult.second());
            }

            writeJobState(logger, effectiveJobId, provider, vmName, backupPath, backupType, STATE_RUNNING,
                    "Detached backup job started by systemd-run");
            logger.info("{} phase=[AGENT_DETACHED_STARTED], provider=[{}], jobId=[{}], vm=[{}], backupPath=[{}], "
                            + "backupType=[{}], unit=[{}], command=[{}]",
                    trace, provider, effectiveJobId, vmName, backupPath, backupType, unitName, formatCommand(scriptCommand));
            return new BackupAnswer(command, true, "started");
        } catch (IOException e) {
            writeJobState(logger, effectiveJobId, provider, vmName, backupPath, backupType, STATE_FAILED, e.getMessage());
            logger.warn("{} phase=[AGENT_DETACHED_START_FAILED], provider=[{}], jobId=[{}], vm=[{}], backupPath=[{}], "
                            + "backupType=[{}], unit=[{}], reason=[{}]",
                    trace, provider, effectiveJobId, vmName, backupPath, backupType, unitName, e.getMessage(), e);
            return new BackupAnswer(command, false, e.getMessage());
        }
    }

    static String getJobState(final String jobId, final Logger logger) {
        Properties properties = readJob(jobId, logger);
        if (properties == null) {
            return "UNKNOWN";
        }
        String state = properties.getProperty("state", "UNKNOWN");
        if ((STATE_STARTED.equals(state) || STATE_RUNNING.equals(state)) && !ACTIVE_JOBS.contains(jobId)) {
            String detachedState = resolveDetachedState(jobId, properties, logger);
            if (!STATE_INTERRUPTED.equals(detachedState)) {
                return detachedState;
            }
            writeJobState(logger, jobId, properties.getProperty("provider"), properties.getProperty("vmName"),
                    properties.getProperty("backupPath"), properties.getProperty("backupType"), STATE_INTERRUPTED,
                    "Agent restarted or async worker is no longer active");
            logger.warn("ABLESTACK backup job [{}] was marked [{}]. provider=[{}], vm=[{}], backupPath=[{}], previousState=[{}]",
                    jobId, STATE_INTERRUPTED, properties.getProperty("provider"), properties.getProperty("vmName"),
                    properties.getProperty("backupPath"), state);
            return STATE_INTERRUPTED;
        }
        logger.info("ABLESTACK backup job state queried. jobId=[{}], provider=[{}], vm=[{}], backupPath=[{}], state=[{}]",
                jobId, properties.getProperty("provider"), properties.getProperty("vmName"), properties.getProperty("backupPath"), state);
        return state;
    }

    private static String resolveDetachedState(final String jobId, final Properties properties, final Logger logger) {
        final Path exitCodePath = getJobDirectory(jobId).resolve(EXIT_CODE_FILE);
        if (Files.exists(exitCodePath)) {
            try {
                final String exitCode = Files.readString(exitCodePath).trim();
                final String resolvedState = "0".equals(exitCode) ? STATE_COMPLETED : STATE_FAILED;
                writeJobState(logger, jobId, properties.getProperty("provider"), properties.getProperty("vmName"),
                        properties.getProperty("backupPath"), properties.getProperty("backupType"), resolvedState,
                        "Detached backup job exited with code " + exitCode);
                logger.info("ABLESTACK detached backup job [{}] resolved from exit code [{}] to state [{}].",
                        jobId, exitCode, resolvedState);
                return resolvedState;
            } catch (IOException e) {
                logger.warn("Failed to read ABLESTACK detached backup exit code for job [{}]", jobId, e);
            }
        }

        final String unitName = properties.getProperty("unitName");
        if (safeValue(unitName).isBlank()) {
            return STATE_INTERRUPTED;
        }
        if (isSystemdUnitActive(unitName, logger)) {
            logger.info("ABLESTACK detached backup job [{}] is still running. unit=[{}], log=[{}]",
                    jobId, unitName, getJobDirectory(jobId).resolve(LOG_FILE));
            return STATE_RUNNING;
        }
        return STATE_INTERRUPTED;
    }

    private static void writeJobState(final Logger logger, final String jobId, final String provider, final String vmName,
            final String backupPath, final String backupType, final String state, final String details) {
        if (jobId == null || jobId.isBlank()) {
            return;
        }
        try {
            Files.createDirectories(JOB_ROOT);
            Properties properties = readJob(jobId, logger);
            if (properties == null) {
                properties = new Properties();
            }
            properties.setProperty("jobId", jobId);
            properties.setProperty("provider", safeValue(provider));
            properties.setProperty("vmName", safeValue(vmName));
            properties.setProperty("backupPath", safeValue(backupPath));
            properties.setProperty("backupType", safeValue(backupType));
            properties.setProperty("state", state);
            properties.setProperty("updated", String.valueOf(System.currentTimeMillis()));
            if (details != null) {
                properties.setProperty("details", details);
            }
            try (OutputStream outputStream = Files.newOutputStream(getJobPath(jobId), StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING)) {
                properties.store(outputStream, "ABLESTACK backup job");
            }
        } catch (IOException e) {
            logger.warn("Failed to write ABLESTACK backup job state for job [{}]", jobId, e);
        }
    }

    private static void storeJobProperties(final Logger logger, final String jobId, final Properties properties) {
        try (OutputStream outputStream = Files.newOutputStream(getJobPath(jobId), StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING)) {
            properties.store(outputStream, "ABLESTACK backup job");
        } catch (IOException e) {
            logger.warn("Failed to store ABLESTACK backup job properties for job [{}]", jobId, e);
        }
    }

    private static Properties readJob(final String jobId, final Logger logger) {
        if (jobId == null || jobId.isBlank() || !Files.exists(getJobPath(jobId))) {
            return null;
        }
        try (InputStream inputStream = Files.newInputStream(getJobPath(jobId))) {
            Properties properties = new Properties();
            properties.load(inputStream);
            return properties;
        } catch (IOException e) {
            logger.warn("Failed to read ABLESTACK backup job state for job [{}]", jobId, e);
            return null;
        }
    }

    private static Path getJobPath(final String jobId) {
        return JOB_ROOT.resolve(jobId.replaceAll("[^A-Za-z0-9_.-]", "_") + ".properties");
    }

    private static Path getJobDirectory(final String jobId) {
        return JOB_ROOT.resolve(jobId.replaceAll("[^A-Za-z0-9_.-]", "_"));
    }

    private static Path getDetachedScriptPath(final String jobId) {
        return getJobDirectory(jobId).resolve(SCRIPT_FILE);
    }

    private static void writeDetachedScript(final String jobId, final String provider, final String vmName, final String backupPath,
            final String backupType, final String[] scriptCommand) throws IOException {
        final Path jobDirectory = getJobDirectory(jobId);
        final Path scriptPath = getDetachedScriptPath(jobId);
        final Path logPath = jobDirectory.resolve(LOG_FILE);
        final Path exitCodePath = jobDirectory.resolve(EXIT_CODE_FILE);
        Files.deleteIfExists(exitCodePath);
        String script = "#!/bin/bash\n"
                + "set +e\n"
                + "echo \"ABLESTACK backup job started at " + Instant.now() + "\" >> " + shellQuote(logPath.toString()) + "\n"
                + "echo \"jobId=" + safeForLog(jobId) + " provider=" + safeForLog(provider) + " vm=" + safeForLog(vmName)
                + " backupPath=" + safeForLog(backupPath) + " backupType=" + safeForLog(backupType) + "\" >> "
                + shellQuote(logPath.toString()) + "\n"
                + "echo \"command=" + safeForLog(formatCommand(scriptCommand)) + "\" >> " + shellQuote(logPath.toString()) + "\n"
                + formatCommand(scriptCommand) + " >> " + shellQuote(logPath.toString()) + " 2>&1\n"
                + "rc=$?\n"
                + "echo \"$rc\" > " + shellQuote(exitCodePath.toString()) + "\n"
                + "echo \"ABLESTACK backup job exited with code $rc at $(date --iso-8601=seconds)\" >> " + shellQuote(logPath.toString()) + "\n"
                + "exit $rc\n";
        Files.writeString(scriptPath, script, StandardCharsets.UTF_8, StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);
        Files.setPosixFilePermissions(scriptPath, PosixFilePermissions.fromString("rwx------"));
    }

    private static Pair<Integer, String> launchDetached(final String jobId, final String unitName) {
        final Path scriptPath = getDetachedScriptPath(jobId);
        return executeAndCapture("systemd-run", "--unit", unitName, "--collect", "--quiet", "/bin/bash", scriptPath.toString());
    }

    private static boolean isSystemdUnitActive(final String unitName, final Logger logger) {
        Pair<Integer, String> result = executeAndCapture("systemctl", "is-active", "--quiet", unitName);
        if (result.first() == 0) {
            return true;
        }
        logger.debug("ABLESTACK detached backup unit [{}] is not active: {}", unitName, result.second());
        return false;
    }

    private static Pair<Integer, String> executeAndCapture(final String... command) {
        try {
            Process process = new ProcessBuilder(command).redirectErrorStream(true).start();
            byte[] output = process.getInputStream().readAllBytes();
            int exitCode = process.waitFor();
            return new Pair<>(exitCode, new String(output, StandardCharsets.UTF_8).trim());
        } catch (IOException e) {
            return new Pair<>(-1, e.getMessage());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return new Pair<>(-1, e.getMessage());
        }
    }

    private static String getSystemdUnitName(final String jobId) {
        return "ablestack-backup-" + jobId.replaceAll("[^A-Za-z0-9_.-]", "_");
    }

    private static String formatCommand(final String[] command) {
        return Arrays.stream(command).map(LibvirtAblestackAsyncBackupRunner::shellQuote).reduce((left, right) -> left + " " + right).orElse("");
    }

    private static String shellQuote(final String value) {
        return "'" + safeValue(value).replace("'", "'\"'\"'") + "'";
    }

    private static String safeValue(final String value) {
        return value == null ? "" : value;
    }

    private static String safeForLog(final String value) {
        return safeValue(value).replace("\\", "\\\\").replace("\"", "\\\"");
    }
}
