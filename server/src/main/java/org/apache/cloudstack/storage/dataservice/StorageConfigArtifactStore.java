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
package org.apache.cloudstack.storage.dataservice;

import com.cloud.utils.db.Transaction;
import com.cloud.utils.db.TransactionCallback;
import com.cloud.utils.db.TransactionLegacy;
import com.cloud.utils.exception.CloudRuntimeException;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Types;
import java.util.Arrays;
import java.util.Base64;
import java.util.UUID;
import java.util.function.Consumer;

/** Durable archive transport. Every read and write is authorized against the stored owner. */
final class StorageConfigArtifactStore {
    private static final long UPLOAD_TTL = 30 * 60_000L;
    private static final String TABLE = "storage_service_config_artifact";
    private static final String COLUMNS =
            "uuid,kind,state,source_uuid,target_uuid,account_id,domain_id,zone_id,revision,created_by,created_ms,expires_ms,sha256,byte_count,metadata";
    private final Consumer<Artifact> authorize;

    StorageConfigArtifactStore(Consumer<Artifact> authorize) {
        this.authorize = authorize;
    }

    static final class Artifact {
        final String id, kind, state, source, target, sha;
        final long account, domain, zone, revision, creator, created, expires;
        final int length;
        final JsonObject metadata;
        final byte[] body;

        Artifact(ResultSet row, boolean readBody) throws SQLException {
            id = row.getString("uuid");
            kind = row.getString("kind");
            state = row.getString("state");
            source = row.getString("source_uuid");
            target = row.getString("target_uuid");
            account = row.getLong("account_id");
            domain = row.getLong("domain_id");
            zone = row.getLong("zone_id");
            revision = row.getLong("revision");
            creator = row.getLong("created_by");
            created = row.getLong("created_ms");
            expires = row.getLong("expires_ms");
            sha = row.getString("sha256");
            length = row.getInt("byte_count");
            metadata = StorageServiceConfigurationCoordinator.parsed(row.getString("metadata"));
            body = readBody ? row.getBytes("payload") : null;
        }

        JsonObject response() {
            JsonObject result = new JsonObject();
            result.addProperty("id", id);
            result.addProperty("kind", kind);
            result.addProperty("state", state);
            result.addProperty("source", source);
            result.addProperty("target", target);
            result.addProperty("revision", revision);
            result.addProperty("created", created);
            result.addProperty("expires", expires);
            result.addProperty("sha256", sha);
            result.addProperty("bytes", length);
            result.add("metadata", metadata);
            return result;
        }
    }

    Artifact find(String id, boolean body) {
        return find(id, body, false);
    }

    private Artifact find(String id, boolean body, boolean lock) {
        try (PreparedStatement query = statement("SELECT " + COLUMNS + (body ? ",payload" : "")
                + " FROM " + TABLE + " WHERE uuid=?" + (lock ? " FOR UPDATE" : ""))) {
            query.setString(1, uuid(id));
            try (ResultSet rows = query.executeQuery()) {
                if (!rows.next()) {
                    throw StorageConfigArchiveV1.invalid("ARTIFACT_NOT_FOUND");
                }
                Artifact artifact = new Artifact(rows, body);
                authorize.accept(artifact);
                if (artifact.expires != 0 && artifact.expires <= System.currentTimeMillis()) {
                    throw StorageConfigArchiveV1.invalid("ARTIFACT_EXPIRED");
                }
                return artifact;
            }
        } catch (SQLException error) {
            throw sqlFailure(error);
        }
    }

    JsonArray list(String source, int page) {
        try (PreparedStatement query = statement("SELECT " + COLUMNS + " FROM " + TABLE
                + " WHERE source_uuid=? AND kind IN ('BACKUP','LKG') ORDER BY created_ms DESC,id DESC LIMIT 25 OFFSET ?")) {
            query.setString(1, uuid(source));
            if (page < 1 || page > 10000) {
                throw StorageConfigArchiveV1.invalid("ARTIFACT_PAGE");
            }
            query.setInt(2, (page - 1) * 25);
            JsonArray result = new JsonArray();
            try (ResultSet rows = query.executeQuery()) {
                while (rows.next()) {
                    Artifact artifact = new Artifact(rows, false);
                    authorize.accept(artifact);
                    result.add(artifact.response());
                }
            }
            return result;
        } catch (SQLException error) {
            throw sqlFailure(error);
        }
    }

    Artifact backup(StorageServiceInstanceVO source, long creator, byte[] archive, JsonObject metadata, boolean verified) {
        return insert(verified ? "LKG" : "BACKUP", verified ? "ACTIVE" : "READY", source.getUuid(), null,
                source, creator, source.getConfigurationRevision(), 0, StorageConfigArchiveV1.digest(archive),
                archive.length, metadata, archive, verified ? source.getId() : null);
    }

    Artifact plan(StorageServiceInstanceVO target, long creator, String source, JsonObject plan) {
        byte[] bytes = plan.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8);
        if (bytes.length > StorageConfigArchiveV1.MAX_BYTES) {
            throw StorageConfigArchiveV1.invalid("RESTORE_PLAN_SIZE");
        }
        return insert("RESTORE_PLAN", "READY", source, target.getUuid(), target, creator,
                target.getConfigurationRevision(), System.currentTimeMillis() + 300_000L,
                StorageConfigArchiveV1.digest(bytes), bytes.length, new JsonObject(), bytes, null);
    }

    Artifact begin(StorageServiceInstanceVO target, long creator, int length, String digest) {
        if (length < 22 || length > StorageConfigArchiveV1.MAX_BYTES || !isSha(digest)) {
            throw StorageConfigArchiveV1.invalid("INVALID_UPLOAD_SIZE_OR_DIGEST");
        }
        // Per-target reservation and bounded retention must be serialized with concurrent upload starts.
        return Transaction.execute((TransactionCallback<Artifact>) status -> {
            try {
                try (PreparedStatement lock = statement("SELECT id FROM storage_service_instance WHERE id=? AND removed IS NULL FOR UPDATE")) {
                    lock.setLong(1, target.getId());
                    try (ResultSet rows = lock.executeQuery()) {
                        if (!rows.next()) {
                            throw StorageConfigArchiveV1.invalid("RESTORE_TARGET_NOT_FOUND");
                        }
                    }
                }
                // Closing the JDBC cursor does not release the transaction's row lock.
                cleanupTemporary(target.getUuid());
            } catch (SQLException error) {
                throw sqlFailure(error);
            }
            return insert("UPLOAD", "UPLOADING", null, target.getUuid(), target, creator, target.getConfigurationRevision(),
                    System.currentTimeMillis() + UPLOAD_TTL, digest, length, new JsonObject(), new byte[0], null);
        });
    }

    private void cleanupTemporary(String target) throws SQLException {
        try (PreparedStatement delete = statement("DELETE FROM " + TABLE + " WHERE target_uuid=? AND expires_ms IS NOT NULL AND expires_ms<=?")) {
            delete.setString(1, target);
            delete.setLong(2, System.currentTimeMillis());
            delete.executeUpdate();
        }
        try (PreparedStatement count = statement("SELECT COUNT(*) FROM " + TABLE + " WHERE target_uuid=? AND kind='UPLOAD'")) {
            count.setString(1, target);
            try (ResultSet rows = count.executeQuery()) {
                if (rows.next() && rows.getLong(1) >= 8) {
                    throw StorageConfigArchiveV1.invalid("UPLOAD_LIMIT");
                }
            }
        }
    }

    Artifact append(String id, String target, long user, int index, String encoded, String digest,
            Consumer<StorageConfigArchiveV1.Bundle> validate) {
        if (index < 0 || index >= 32 || encoded == null || encoded.length() > 4 * ((StorageConfigArchiveV1.CHUNK + 2) / 3)
                || !isSha(digest)) {
            throw StorageConfigArchiveV1.invalid("INVALID_UPLOAD_CHUNK");
        }
        byte[] chunk;
        try {
            chunk = Base64.getDecoder().decode(encoded);
        } catch (IllegalArgumentException error) {
            throw StorageConfigArchiveV1.invalid("INVALID_UPLOAD_ENCODING");
        }
        if (!digest.equals(StorageConfigArchiveV1.digest(chunk))) {
            throw StorageConfigArchiveV1.invalid("CHUNK_DIGEST_MISMATCH");
        }
        return Transaction.execute((TransactionCallback<Artifact>) status -> {
            Artifact upload = find(id, true, true);
            if (!"UPLOAD".equals(upload.kind) || !target.equals(upload.target) || upload.creator != user
                    || !Arrays.asList("UPLOADING", "VALIDATED").contains(upload.state)) {
                throw StorageConfigArchiveV1.invalid("UPLOAD_NOT_FOUND");
            }
            int offset = index * StorageConfigArchiveV1.CHUNK;
            int length = Math.min(StorageConfigArchiveV1.CHUNK, upload.length - offset);
            if (length <= 0 || chunk.length != length || offset > upload.body.length) {
                throw StorageConfigArchiveV1.invalid("CHUNK_SIZE_OR_ORDER");
            }
            if (offset < upload.body.length) {
                if (offset + length <= upload.body.length
                        && Arrays.equals(chunk, Arrays.copyOfRange(upload.body, offset, offset + length))) {
                    return upload;
                }
                throw StorageConfigArchiveV1.invalid("CHUNK_CONFLICT");
            }
            byte[] payload = Arrays.copyOf(upload.body, offset + length);
            System.arraycopy(chunk, 0, payload, offset, length);
            String state = "UPLOADING";
            JsonObject metadata = new JsonObject();
            if (payload.length == upload.length) {
                if (!upload.sha.equals(StorageConfigArchiveV1.digest(payload))) {
                    throw StorageConfigArchiveV1.invalid("ARCHIVE_DIGEST_MISMATCH");
                }
                StorageConfigArchiveV1.Bundle bundle = StorageConfigArchiveV1.read(payload);
                validate.accept(bundle);
                metadata = bundle.manifest;
                state = "VALIDATED";
            }
            try (PreparedStatement update = statement("UPDATE " + TABLE + " SET payload=?,state=?,metadata=? WHERE uuid=?")) {
                update.setBytes(1, payload);
                update.setString(2, state);
                update.setString(3, metadata.toString());
                update.setString(4, id);
                update.executeUpdate();
            } catch (SQLException error) {
                throw sqlFailure(error);
            }
            return find(id, false);
        });
    }

    String download(Artifact artifact, int index) {
        if (!Arrays.asList("BACKUP", "LKG").contains(artifact.kind) || artifact.body == null
                || artifact.body.length != artifact.length || !artifact.sha.equals(StorageConfigArchiveV1.digest(artifact.body))
                || index < 0 || index >= 32 || index * StorageConfigArchiveV1.CHUNK >= artifact.length) {
            throw StorageConfigArchiveV1.invalid("INVALID_DOWNLOAD_CHUNK");
        }
        int start = index * StorageConfigArchiveV1.CHUNK;
        return Base64.getEncoder().encodeToString(Arrays.copyOfRange(artifact.body, start,
                Math.min(start + StorageConfigArchiveV1.CHUNK, artifact.length)));
    }

    private Artifact insert(String kind, String state, String source, String target, StorageServiceInstanceVO scope,
            long creator, long revision, long expiry, String sha, int length, JsonObject metadata, byte[] body, Long active) {
        String id = UUID.randomUUID().toString();
        try (PreparedStatement insert = statement("INSERT INTO " + TABLE + " (" + COLUMNS
                + ",payload,active_lkg_instance_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")) {
            insert.setString(1, id);
            insert.setString(2, kind);
            insert.setString(3, state);
            insert.setString(4, source);
            insert.setString(5, target);
            insert.setLong(6, scope.getAccountId());
            insert.setLong(7, scope.getDomainId());
            insert.setLong(8, scope.getDataCenterId());
            insert.setLong(9, revision);
            insert.setLong(10, creator);
            insert.setLong(11, System.currentTimeMillis());
            if (expiry == 0) {
                insert.setNull(12, Types.BIGINT);
            } else {
                insert.setLong(12, expiry);
            }
            insert.setString(13, sha);
            insert.setInt(14, length);
            insert.setString(15, metadata.toString());
            insert.setBytes(16, body);
            if (active == null) {
                insert.setNull(17, Types.BIGINT);
            } else {
                insert.setLong(17, active);
            }
            insert.executeUpdate();
        } catch (SQLException error) {
            throw sqlFailure(error);
        }
        return find(id, false);
    }

    boolean retireLastGood(long instance, long revision) {
        try (PreparedStatement query = statement("SELECT revision FROM " + TABLE + " WHERE active_lkg_instance_id=? FOR UPDATE")) {
            query.setLong(1, instance);
            try (ResultSet rows = query.executeQuery()) {
                if (!rows.next()) {
                    return true;
                }
                if (rows.getLong(1) >= revision) {
                    return false;
                }
            }
        } catch (SQLException error) {
            throw sqlFailure(error);
        }
        try (PreparedStatement update = statement("UPDATE " + TABLE
                + " SET state='SUPERSEDED',active_lkg_instance_id=NULL WHERE active_lkg_instance_id=?")) {
            update.setLong(1, instance);
            update.executeUpdate();
            return true;
        } catch (SQLException error) {
            throw sqlFailure(error);
        }
    }

    private static PreparedStatement statement(String sql) throws SQLException {
        return TransactionLegacy.currentTxn().prepareStatement(sql);
    }

    static String uuid(String id) {
        try {
            if (id != null && id.length() == 36 && UUID.fromString(id).toString().equals(id)) {
                return id;
            }
        } catch (IllegalArgumentException ignored) {
            // Return the same error for every invalid identifier.
        }
        throw StorageConfigArchiveV1.invalid("INVALID_ARTIFACT_ID");
    }

    private static boolean isSha(String digest) {
        return digest != null && digest.matches("[0-9a-f]{64}");
    }

    private static CloudRuntimeException sqlFailure(SQLException error) {
        return new CloudRuntimeException("Configuration artifact persistence failed", error);
    }
}
