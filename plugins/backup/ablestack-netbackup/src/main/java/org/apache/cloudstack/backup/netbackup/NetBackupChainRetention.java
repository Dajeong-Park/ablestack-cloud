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
package org.apache.cloudstack.backup.netbackup;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;

import org.apache.cloudstack.backup.Backup;
import org.apache.cloudstack.backup.BackupDetailVO;
import org.apache.cloudstack.backup.BackupVO;
import org.apache.cloudstack.backup.ThirdPartyBackupManifest;
import org.apache.cloudstack.backup.dao.BackupDao;
import org.apache.cloudstack.backup.dao.BackupDetailsDao;
import org.apache.commons.lang3.StringUtils;

import com.cloud.utils.exception.CloudRuntimeException;
import com.cloud.utils.db.GlobalLock;
import com.google.gson.Gson;

/** Protect exact image copies; the operator's shared policy and unrelated images are never changed. */
public final class NetBackupChainRetention {
    private final AblestackNetBackupClient client;
    private final BackupDao backups;
    private final BackupDetailsDao details;

    public static final class Pending {
        public String target;
        public String ticket;
    }

    public static final class State {
        public int version = 1;
        public String backupUuid;
        public String state;
        public String preparationUntil;
        public String protectedUntil;
        public String reason;
        public Map<String, Pending> pending = new LinkedHashMap<>();
    }

    private static final class Reference {
        private final ThirdPartyBackupManifest.Artifact artifact;
        private final boolean metadata;
        private final String policy;
        private final boolean owned;

        private Reference(Backup owner, ThirdPartyBackupManifest.Artifact artifact, boolean metadata, boolean owned) {
            this.artifact = artifact;
            this.metadata = metadata;
            this.owned = owned;
            policy = "USER_BACKUP".equals(owner.getDetail("netbackup.transfer.mode")) ? owner.getDetail("netbackup.policy.name") : null;
            if ("USER_BACKUP".equals(owner.getDetail("netbackup.transfer.mode")) && StringUtils.isBlank(policy)) {
                throw new CloudRuntimeException("NetBackup retention source policy is missing");
            }
        }
    }

    public NetBackupChainRetention(AblestackNetBackupClient client, BackupDao backups, BackupDetailsDao details) {
        this.client = client;
        this.backups = backups;
        this.details = details;
    }

    /** Completed absolute expirations need no repeated writes; new children always verify their entire chain. */
    public static boolean needsReconciliation(Backup backup) {
        String json = backup.getDetail(ThirdPartyBackupManifest.RETENTION_PROTECTION_KEY);
        if (StringUtils.isBlank(json)) { return true; }
        try {
            State state = new Gson().fromJson(json, State.class);
            return state == null || state.version != 1 || !backup.getUuid().equals(state.backupUuid)
                    || !"COMPLETED".equals(state.state) || state.pending == null || !state.pending.isEmpty();
        } catch (RuntimeException e) { return true; }
    }

    /**
     * A fixed preparation horizon protects ancestors while a long backup is running.
     * Completion and existing-backup reconciliation use actual child copy expirations, never a sliding 'now + retention'.
     */
    public void protect(Backup backup, int preparationSeconds, boolean finalizing) {
        GlobalLock lock = GlobalLock.getInternLock("backup.netbackup.retention." + backup.getVmId());
        boolean acquired = false;
        try {
            acquired = lock.lock(1);
            if (!acquired) { throw new CloudRuntimeException("NetBackup retention protection is being reconciled; retry shortly"); }
            if (backup instanceof BackupVO) { backups.loadDetails((BackupVO) backup); }
            if (org.apache.cloudstack.backup.BackupDeletionService.isPending(backup)
                    || StringUtils.isNotBlank(backup.getDetail(ThirdPartyBackupManifest.DELETE_PROGRESS_KEY))) {
                throw new CloudRuntimeException("NetBackup retention cannot change a backup pending deletion");
            }
            protectLocked(backup, preparationSeconds, finalizing);
        } finally {
            if (acquired) { lock.unlock(); }
            lock.releaseRef();
        }
    }

    private void protectLocked(Backup backup, int preparationSeconds, boolean finalizing) {
        State state = readState(backup);
        try {
            ThirdPartyBackupManifest manifest = ThirdPartyBackupManifest.fromJson(backup.getDetail(ThirdPartyBackupManifest.DETAIL_KEY));
            if (!"ablestack-netbackup".equals(manifest.getProvider()) || !backup.getUuid().equals(manifest.getBackupUuid())) {
                throw new CloudRuntimeException("NetBackup retention manifest belongs to another backup");
            }
            if (finalizing) { manifest.validate(true); }
            Map<String, Reference> references = references(backup, manifest, finalizing);
            if (references.isEmpty()) { return; }
            Map<String, AblestackNetBackupClient.ImageRetention> images = new LinkedHashMap<>();
            // Complete the inventory and ownership checks before writing any expiration date.
            for (Reference reference : references.values()) {
                images.put(reference.artifact.externalId, read(reference));
            }
            Instant target = verifyOtherPendingRequests(backup, images);
            if (preparationSeconds > 0) {
                if (state.preparationUntil == null) {
                    // The Host timeout applies per export/transfer, not to the whole VM.
                    // Include every volume pair, metadata, preparation and gate allowance.
                    long phases = Math.addExact(Math.multiplyExact(2L, manifest.getVolumes().size()), 3L);
                    long window = Math.multiplyExact(phases, Math.max(300L, preparationSeconds));
                    state.preparationUntil = AblestackNetBackupClient.retentionTarget(Instant.now().plusSeconds(window)).toString();
                }
                Instant preparation = AblestackNetBackupClient.retentionTarget(Instant.parse(state.preparationUntil));
                state.preparationUntil = preparation.toString();
                if (target == null || preparation.isAfter(target)) { target = preparation; }
            }
            for (Reference reference : references.values()) {
                for (Map.Entry<Integer, Instant> copy : images.get(reference.artifact.externalId).copies.entrySet()) {
                    if (reference.owned && (target == null || copy.getValue().isAfter(target))) { target = copy.getValue(); }
                    Pending pending = state.pending.get(reference.artifact.externalId + ":" + copy.getKey());
                    if (isLegacyPrecisionMismatch(pending, copy.getValue())) {
                        Instant corrected = AblestackNetBackupClient.retentionTarget(Instant.parse(pending.target));
                        if (target == null || corrected.isAfter(target)) { target = corrected; }
                    }
                }
            }
            if (target == null || !target.isAfter(Instant.now())) {
                throw new CloudRuntimeException("NetBackup dependent backup expiration cannot be determined");
            }
            target = AblestackNetBackupClient.retentionTarget(target);
            state.protectedUntil = target.toString();
            // Ancestors are inserted first, before a newly completed child's payload is acknowledged.
            for (Reference reference : references.values()) {
                for (Map.Entry<Integer, Instant> copy : images.get(reference.artifact.externalId).copies.entrySet()) {
                    String key = reference.artifact.externalId + ":" + copy.getKey();
                    Pending pending = state.pending.get(key);
                    if (pending != null && (!copy.getValue().isBefore(Instant.parse(pending.target))
                            || isLegacyPrecisionMismatch(pending, copy.getValue()))) {
                        state.pending.remove(key);
                        pending = null;
                    }
                    if (pending != null) {
                        throw new CloudRuntimeException("NetBackup retention approval or acceptance is pending for " + key
                                + ", ticket=" + StringUtils.defaultIfBlank(pending.ticket, "UNCONFIRMED"));
                    }
                    if (!copy.getValue().isBefore(target)) { continue; }
                    extend(backup, state, reference, copy.getKey(), target, key);
                }
            }
            // A 204 response alone is not proof. Re-read every required copy before completion/Host cleanup.
            for (Reference reference : references.values()) {
                for (Instant expiration : read(reference).copies.values()) {
                    if (expiration.isBefore(target)) {
                        throw new CloudRuntimeException("NetBackup retention extension is not reflected in the catalog: " + reference.artifact.externalId);
                    }
                }
            }
            state.state = "COMPLETED";
            state.reason = null;
            save(backup, state);
        } catch (RuntimeException e) {
            state.state = "WAITING";
            state.reason = "NETBACKUP_RETENTION_UNCONFIRMED: " + e.getMessage();
            save(backup, state);
            throw new CloudRuntimeException(state.reason, e);
        }
    }

    private Instant verifyOtherPendingRequests(Backup backup, Map<String, AblestackNetBackupClient.ImageRetention> images) {
        // Another recovery point may reference the same Full. Do not submit a
        // later request while its earlier approval/response remains unconfirmed.
        Map<Long, Backup> siblings = new LinkedHashMap<>();
        for (Backup other : backups.listByVmId(backup.getZoneId(), backup.getVmId())) {
            if (other.getId() != backup.getId()) { siblings.put(other.getId(), other); }
        }
        Instant required = null;
        if (siblings.isEmpty()) { return null; }
        for (BackupDetailVO receipt : details.listDetailsForResourceIdsAndKey(new java.util.ArrayList<>(siblings.keySet()),
                ThirdPartyBackupManifest.RETENTION_PROTECTION_KEY)) {
            Backup other = siblings.get(receipt.getResourceId());
            if (other == null) { throw new CloudRuntimeException("NetBackup pending retention owner is invalid"); }
            State previous = readState(other, receipt.getValue());
            for (Map.Entry<String, Pending> entry : previous.pending.entrySet()) {
                int separator = entry.getKey().lastIndexOf(':');
                if (separator <= 0) { throw new CloudRuntimeException("NetBackup pending retention copy identity is invalid"); }
                AblestackNetBackupClient.ImageRetention image = images.get(entry.getKey().substring(0, separator));
                if (image == null) { continue; }
                Instant expiration = image.copies.get(Integer.parseInt(entry.getKey().substring(separator + 1)));
                if (expiration == null || expiration.isBefore(Instant.parse(entry.getValue().target))) {
                    if (isLegacyPrecisionMismatch(entry.getValue(), expiration)) {
                        Instant corrected = AblestackNetBackupClient.retentionTarget(Instant.parse(entry.getValue().target));
                        if (required == null || corrected.isAfter(required)) { required = corrected; }
                        continue;
                    }
                    throw new CloudRuntimeException("NetBackup retention request from backup " + other.getUuid()
                            + " is still unconfirmed for " + entry.getKey() + ", ticket="
                            + StringUtils.defaultIfBlank(entry.getValue().ticket, "UNCONFIRMED"));
                }
            }
        }
        return required;
    }

    private boolean isLegacyPrecisionMismatch(Pending pending, Instant observed) {
        if (pending == null || observed == null || StringUtils.isNotBlank(pending.ticket)) { return false; }
        Instant requested = Instant.parse(pending.target);
        // An exact match at catalog precision proves the old fractional update
        // took effect. Replace it with a whole-second extension and verify that
        // stricter bound before acknowledging the payload. Real MPA tickets or
        // an earlier expiration still block retries after an ambiguous response.
        return requested.getNano() != 0 && observed.equals(requested.truncatedTo(ChronoUnit.SECONDS));
    }

    private void extend(Backup backup, State state, Reference reference, int copy, Instant target, String key) {
        Pending pending = new Pending();
        pending.target = target.toString();
        state.pending.put(key, pending);
        state.state = "WAITING";
        save(backup, state); // Durable intent also fences response loss/restart; do not create duplicate approval tickets.
        final AblestackNetBackupClient.ExpireImageResult result;
        try {
            result = client.extendImageRetention(reference.artifact, reference.metadata, reference.policy, copy, target);
        } catch (AblestackNetBackupClient.RetentionUpdateRejected e) {
            state.pending.remove(key); // A definite rejection can be retried after permissions/configuration are repaired.
            throw e;
        }
        if (!result.isCompleted()) {
            pending.ticket = StringUtils.defaultIfBlank(result.getMpaTicket(), "MPA_TICKET_UNAVAILABLE");
            throw new CloudRuntimeException("NetBackup retention extension is awaiting MPA approval for " + key + ", ticket=" + pending.ticket);
        }
        Instant observed = read(reference).copies.get(copy);
        if (observed == null || observed.isBefore(target)) {
            throw new CloudRuntimeException("NetBackup retention update is accepted but catalog verification is pending for " + key);
        }
        state.pending.remove(key);
        save(backup, state);
    }

    private AblestackNetBackupClient.ImageRetention read(Reference reference) {
        return client.imageRetention(reference.artifact, reference.metadata, reference.policy);
    }

    private Map<String, Reference> references(Backup backup, ThirdPartyBackupManifest manifest, boolean finalizing) {
        Map<String, Reference> references = new LinkedHashMap<>();
        Map<String, ThirdPartyBackupManifest> parents = new LinkedHashMap<>();
        for (ThirdPartyBackupManifest.Artifact required : manifest.getRequiredArtifacts()) {
            if (backup.getUuid().equals(required.backupUuid)) { continue; }
            if (!parents.containsKey(required.backupUuid)) {
                BackupVO owner = backups.findByUuid(required.backupUuid);
                if (owner == null || owner.getVmId() != backup.getVmId() || !Objects.equals(owner.getZoneId(), backup.getZoneId())
                        || owner.getAccountId() != backup.getAccountId() || owner.getStatus() != Backup.Status.BackedUp) {
                    throw new CloudRuntimeException("NetBackup retention ancestor ownership/state is unconfirmed: " + required.backupUuid);
                }
                backups.loadDetails(owner);
                ThirdPartyBackupManifest source = ThirdPartyBackupManifest.fromJson(owner.getDetail(ThirdPartyBackupManifest.DETAIL_KEY));
                source.validate(true);
                if (!"ablestack-netbackup".equals(source.getProvider()) || !owner.getUuid().equals(source.getBackupUuid())) {
                    throw new CloudRuntimeException("NetBackup retention ancestor manifest identity differs");
                }
                parents.put(owner.getUuid(), source);
                addOwned(references, owner, source, false, true);
            }
            ThirdPartyBackupManifest source = parents.get(required.backupUuid);
            boolean matches = source.getCurrentArtifacts().stream().anyMatch(artifact -> Objects.equals(required.externalId, artifact.externalId)
                    && Objects.equals(required.path, artifact.path) && Objects.equals(required.sha256, artifact.sha256));
            if (!matches) { throw new CloudRuntimeException("NetBackup retention ancestor image differs from its owner"); }
        }
        addOwned(references, backup, manifest, true, finalizing);
        return references;
    }

    private void addOwned(Map<String, Reference> references, Backup owner, ThirdPartyBackupManifest manifest, boolean owned, boolean required) {
        for (ThirdPartyBackupManifest.Artifact artifact : manifest.getOwnedArtifacts()) {
            if (!artifact.completed || StringUtils.isBlank(artifact.externalId)) {
                if (required) { throw new CloudRuntimeException("NetBackup retention image completion is unconfirmed"); }
                continue;
            }
            Reference reference = new Reference(owner, artifact, artifact == manifest.getMetadata(), owned);
            Reference previous = references.putIfAbsent(artifact.externalId, reference);
            if (previous != null && (!Objects.equals(previous.artifact.path, artifact.path)
                    || !Objects.equals(previous.artifact.backupUuid, artifact.backupUuid))) {
                throw new CloudRuntimeException("NetBackup retention image is shared by conflicting artifacts");
            }
        }
    }

    private State readState(Backup backup) {
        return readState(backup, backup.getDetail(ThirdPartyBackupManifest.RETENTION_PROTECTION_KEY));
    }

    private State readState(Backup backup, String json) {
        State state = StringUtils.isBlank(json) ? new State() : new Gson().fromJson(json, State.class);
        if (state == null || state.version != 1 || state.pending == null
                || (state.backupUuid != null && !backup.getUuid().equals(state.backupUuid))) {
            throw new CloudRuntimeException("NetBackup retention ownership record is invalid");
        }
        state.backupUuid = backup.getUuid();
        return state;
    }

    private void save(Backup backup, State state) {
        String json = new Gson().toJson(state);
        details.addDetail(backup.getId(), ThirdPartyBackupManifest.RETENTION_PROTECTION_KEY, json, false);
        backup.getDetails().put(ThirdPartyBackupManifest.RETENTION_PROTECTION_KEY, json);
    }
}
