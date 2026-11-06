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

import com.cloud.exception.InvalidParameterValueException;
import com.cloud.upgrade.dao.EuropaStorageConfigArtifactUpgrade;
import com.cloud.utils.db.Transaction;
import com.cloud.utils.db.TransactionCallback;
import com.cloud.utils.db.TransactionLegacy;
import com.google.gson.Gson;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import com.mysql.cj.jdbc.MysqlDataSource;
import java.lang.reflect.Field;
import java.sql.Connection;
import java.util.Arrays;
import java.util.Base64;
import java.util.Set;
import java.util.UUID;
import javax.sql.DataSource;
import org.apache.cloudstack.storage.dataservice.dao.StorageServiceInstanceDaoImpl;
import org.junit.After;
import org.junit.Assert;
import org.junit.Assume;
import org.junit.Before;
import org.junit.Test;

public class StorageConfigArtifactStoreTest {
    private Field datasource;
    private DataSource previous;
    private TransactionLegacy transaction;
    private StorageServiceInstanceDaoImpl instances;
    private StorageServiceInstanceVO instance;
    private StorageConfigArtifactStore store;

    @Before
    public void open() throws Exception {
        String url = System.getProperty("configuration.dao.test.url");
        Assume.assumeTrue("Dedicated loopback database required", url != null);
        Assert.assertTrue(url.startsWith("jdbc:mysql://127.0.0.1:13344/cloud?"));
        MysqlDataSource ds = new MysqlDataSource();
        ds.setURL(url);
        ds.setUser("root");
        try (Connection connection = ds.getConnection()) {
            EuropaStorageConfigArtifactUpgrade.migrate(connection);
            EuropaStorageConfigArtifactUpgrade.migrate(connection);
        }
        datasource = TransactionLegacy.class.getDeclaredField("s_ds");
        datasource.setAccessible(true);
        previous = (DataSource) datasource.get(null);
        datasource.set(null, ds);
        transaction = TransactionLegacy.open(TransactionLegacy.CLOUD_DB);
        instances = new StorageServiceInstanceDaoImpl();
        instance = instances.persist(new StorageServiceInstanceVO("archive-test-" + UUID.randomUUID(), null,
                1, 2, 13, 1L, "SYSTEM_VM"));
        store = new StorageConfigArtifactStore(artifact -> {
            if (artifact.account != 2 || artifact.domain != 1) {
                throw new InvalidParameterValueException("WRONG_OWNER");
            }
        });
    }

    @After
    public void close() throws Exception {
        try {
            if (instance != null && transaction != null) {
                try (java.sql.PreparedStatement delete = transaction.prepareAutoCloseStatement(
                        "DELETE FROM storage_service_config_artifact WHERE source_uuid=? OR target_uuid=?")) {
                    delete.setString(1, instance.getUuid());
                    delete.setString(2, instance.getUuid());
                    delete.executeUpdate();
                }
                instances.expunge(instance.getId());
            }
        } finally {
            if (transaction != null) {
                transaction.close();
            }
            if (datasource != null) {
                datasource.set(null, previous);
            }
        }
    }

    @Test
    public void durableUploadAndBackupRetainExactBytesAcrossReads() {
        byte[] archive = StorageConfigArchiveV1.create(new JsonObject(), new JsonObject(), new JsonObject());
        String sha = StorageConfigArchiveV1.digest(archive);
        StorageConfigArtifactStore.Artifact upload = store.begin(instance, 1, archive.length, sha);
        String chunk = Base64.getEncoder().encodeToString(archive);
        Assert.assertThrows(InvalidParameterValueException.class,
                () -> store.append(upload.id, instance.getUuid(), 2, 0, chunk, sha, bundle -> { }));
        Assert.assertThrows(InvalidParameterValueException.class,
                () -> store.append(upload.id, instance.getUuid(), 1, 1, chunk, sha, bundle -> { }));
        Assert.assertEquals("VALIDATED", store.append(upload.id, instance.getUuid(), 1, 0, chunk, sha, bundle -> { }).state);
        Assert.assertEquals("VALIDATED", store.append(upload.id, instance.getUuid(), 1, 0, chunk, sha, bundle -> { }).state);
        Assert.assertArrayEquals(archive, store.find(upload.id, true).body);
        StorageConfigArtifactStore.Artifact backup = store.backup(instance, 1, archive, new JsonObject(), false);
        Assert.assertEquals(chunk, store.download(store.find(backup.id, true), 0));
        StorageConfigArtifactStore denied = new StorageConfigArtifactStore(artifact -> {
            throw new InvalidParameterValueException("WRONG_OWNER");
        });
        Assert.assertThrows(InvalidParameterValueException.class, () -> denied.find(backup.id, true));
        instances.remove(instance.getId());
        Assert.assertArrayEquals(archive, store.find(backup.id, true).body);
    }

    @Test
    public void rejectedFinalChunkDoesNotAdvanceAndCanBeCorrected() {
        byte[] archive = StorageConfigArchiveV1.create(new JsonObject(), new JsonObject(), new JsonObject());
        StorageConfigArtifactStore.Artifact upload = store.begin(instance, 1, archive.length, StorageConfigArchiveV1.digest(archive));
        byte[] corrupt = Arrays.copyOf(archive, archive.length);
        corrupt[0] ^= 1;
        Assert.assertThrows(InvalidParameterValueException.class, () -> store.append(upload.id, instance.getUuid(),
                1, 0, Base64.getEncoder().encodeToString(corrupt), StorageConfigArchiveV1.digest(corrupt), bundle -> { }));
        Assert.assertEquals("UPLOADING", store.find(upload.id, false).state);
        Assert.assertEquals(0, store.find(upload.id, true).body.length);
    }

    @Test
    public void expiredReservationIsRemovedBeforeCheckingUploadLimit() throws Exception {
        byte[] archive = StorageConfigArchiveV1.create(new JsonObject(), new JsonObject(), new JsonObject());
        String sha = StorageConfigArchiveV1.digest(archive);
        StorageConfigArtifactStore.Artifact first = store.begin(instance, 1, archive.length, sha);
        for (int index = 1; index < 8; index++) {
            store.begin(instance, 1, archive.length, sha);
        }
        InvalidParameterValueException atLimit = Assert.assertThrows(InvalidParameterValueException.class,
                () -> store.begin(instance, 1, archive.length, sha));
        Assert.assertEquals("UPLOAD_LIMIT", atLimit.getMessage());
        try (java.sql.PreparedStatement expire = transaction.prepareStatement(
                "UPDATE storage_service_config_artifact SET expires_ms=1 WHERE uuid=?")) {
            expire.setString(1, first.id);
            Assert.assertEquals(1, expire.executeUpdate());
        }
        Assert.assertEquals("UPLOADING", store.begin(instance, 1, archive.length, sha).state);
        InvalidParameterValueException gone = Assert.assertThrows(InvalidParameterValueException.class,
                () -> store.find(first.id, false));
        Assert.assertEquals("ARTIFACT_NOT_FOUND", gone.getMessage());
    }

    @Test
    public void plansObservedDefaultNfsAndRequiresSeparateScopeApproval() {
        String selectedIp = "192.0.2.21";
        StorageServiceProtocolVO nfs = new StorageServiceProtocolVO(instance.getId(), StorageServiceInstance.Protocol.NFS, true, null, 2049);
        nfs.setState(StorageServiceInstance.ResourceState.Ready);
        nfs.setConfigJson(new StorageServiceManagerImpl().buildProtocolConfigJson(StorageServiceInstance.Protocol.NFS, null, "V4_ONLY", 2049, null));
        JsonObject tables = new JsonObject();
        JsonArray listeners = new JsonArray();
        listeners.add(new Gson().toJsonTree(nfs));
        tables.add("StorageServiceProtocolVO", listeners);
        JsonArray files = new JsonArray();
        JsonObject file = new JsonObject();
        file.addProperty("id", 21);
        file.addProperty("uuid", "3f2cc36e-1141-40e4-b866-823696023dd1");
        file.addProperty("protocol", "NFS");
        file.addProperty("name", "example");
        file.addProperty("path", "/export/example");
        file.addProperty("filesystem", "xfs");
        file.addProperty("volumeId", 30);
        file.addProperty("state", "Ready");
        file.addProperty("configJson", "{\"relativeSharePath\":\"example\",\"listenerGroupPorts\":[2049]}");
        files.add(file);
        tables.add("StorageFileShareVO", files);
        JsonObject volume = new JsonObject();
        volume.addProperty("uuid", "65e8e795-3246-4622-87ce-6b4f22281b83");
        volume.addProperty("bytes", 2147483648L);
        volume.addProperty("provisioning", "SPARSE");
        volume.addProperty("filesystemUuid", "b1da7037-326d-455c-aecd-017ea58f1757");
        JsonObject desired = StorageConfigSnapshot.project(tables, id -> volume);
        JsonObject listener = desired.getAsJsonArray("listeners").get(0).getAsJsonObject();
        Assert.assertEquals(StorageConfigSnapshot.DEFAULT_NFS_WILDCARD, listener.get("bindingMode").getAsString());
        Assert.assertEquals("Ready", listener.getAsJsonObject("settings").getAsJsonArray("listenerGroups")
                .get(0).getAsJsonObject().get("state").getAsString());

        JsonObject invalidState = desired.deepCopy();
        invalidState.getAsJsonArray("listeners").get(0).getAsJsonObject().getAsJsonObject("settings")
                .getAsJsonArray("listenerGroups").get(0).getAsJsonObject().addProperty("state", "Injected");
        Assert.assertThrows(InvalidParameterValueException.class, () -> StorageConfigSnapshot.validateDesired(invalidState));

        String vm = UUID.randomUUID().toString();
        String boot = UUID.randomUUID().toString();
        JsonObject targetNetwork = targetNetwork(boot, selectedIp);
        JsonObject sourceBinding = nfsBinding();
        StorageConfigArtifactStore.Artifact archive = nfsArchive(desired, sourceBinding);
        JsonObject plan = reviewNfs(archive, vm, boot, selectedIp, targetNetwork);
        JsonObject planned = plan.getAsJsonObject("desired").getAsJsonArray("listeners").get(0).getAsJsonObject();
        Assert.assertFalse(planned.has("listenIp"));
        Assert.assertEquals(0, plan.getAsJsonObject("nfsBinding").getAsJsonArray("beforeListeners").size());
        Assert.assertEquals("SERVICE_WIDE", plan.getAsJsonObject("nfsBinding").getAsJsonArray("listeners")
                .get(0).getAsJsonObject().get("mode").getAsString());
        String digest = StorageConfigArchiveV1.digest(plan.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8));
        InvalidParameterValueException noConsent = Assert.assertThrows(InvalidParameterValueException.class, () ->
                StorageConfigRestorePlanner.requireApproval(plan, digest, vm, boot, instance, 1, false, false, targetNetwork, Set.of(selectedIp), value -> fileProof(value, boot)));
        Assert.assertEquals("NFS_SERVICE_WIDE_NOT_APPROVED", noConsent.getMessage());
        StorageConfigRestorePlanner.requireApproval(plan, digest, vm, boot, instance, 1, false, true, targetNetwork, Set.of(selectedIp), value -> fileProof(value, boot));
        Assert.assertThrows(InvalidParameterValueException.class, () -> StorageConfigRestorePlanner.requireApproval(
                plan, digest, vm, boot, instance, 1, false, true, targetNetwork(boot, "192.0.2.22"), Set.of("192.0.2.22"), value -> fileProof(value, boot)));

        StorageConfigArtifactStore.Artifact old = nfsArchive(desired, null);
        InvalidParameterValueException unknown = Assert.assertThrows(InvalidParameterValueException.class,
                () -> reviewNfs(old, vm, boot, selectedIp, targetNetwork));
        Assert.assertEquals("NFS_SOURCE_BINDING_UNCONFIRMED", unknown.getMessage());

        sourceBinding.addProperty("mode", "DEDICATED");
        sourceBinding.add("bindAddresses", sourceBinding.get("addresses").deepCopy());
        StorageConfigArtifactStore.Artifact dedicated = nfsArchive(desired, sourceBinding);
        InvalidParameterValueException unsupported = Assert.assertThrows(InvalidParameterValueException.class,
                () -> reviewNfs(dedicated, vm, boot, selectedIp, targetNetwork));
        Assert.assertEquals("NFS_DEDICATED_RESTORE_UNSUPPORTED", unsupported.getMessage());
    }

    @Test
    public void realNfsAclMetadataDoesNotBlockArchiveReviewOrOverrideExportPort() {
        JsonObject tables = new JsonObject();
        StorageServiceProtocolVO nfs = new StorageServiceProtocolVO(instance.getId(), StorageServiceInstance.Protocol.NFS, true, null, 2050);
        nfs.setState(StorageServiceInstance.ResourceState.Ready);
        nfs.setConfigJson(new StorageServiceManagerImpl().buildProtocolConfigJson(StorageServiceInstance.Protocol.NFS, null, "V4_ONLY", 2050, null));
        JsonArray listeners = new JsonArray();
        listeners.add(new Gson().toJsonTree(nfs));
        tables.add("StorageServiceProtocolVO", listeners);
        JsonObject file = com.google.gson.JsonParser.parseString("{\"id\":21,\"uuid\":\"3f2cc36e-1141-40e4-b866-823696023dd1\","
                + "\"protocol\":\"NFS\",\"name\":\"data\",\"path\":\"/export/data\",\"filesystem\":\"xfs\",\"volumeId\":30,\"state\":\"Ready\"}").getAsJsonObject();
        file.addProperty("configJson", "{\"relativeSharePath\":\"data\",\"listenerGroupPorts\":[2050],\"rootSquash\":true}");
        JsonArray files = new JsonArray();
        files.add(file);
        tables.add("StorageFileShareVO", files);

        // Captured from 13 via listStorageNfsAcls. Resource IDs and CIDRs use test values.
        String explicit = "{\"rootSquash\":false,\"sync\":true,\"secure\":false,\"protocolMode\":\"V4_ONLY\","
                + "\"endpointMode\":\"LISTENER_GROUP\",\"listenerGroupPorts\":[2049],\"allSquash\":false,\"anonUid\":65534,\"anonGid\":65534}";
        String inherited = new StorageServiceManagerImpl().inheritedNfsPolicy(explicit);
        JsonArray rules = new JsonArray();
        rules.add(acl(1, "192.0.2.0/25", explicit, "READ_WRITE"));
        rules.add(acl(2, "192.0.2.128/25", inherited, "READ_ONLY"));
        tables.add("StorageAccessRuleVO", rules);
        JsonObject volume = com.google.gson.JsonParser.parseString("{\"uuid\":\"65e8e795-3246-4622-87ce-6b4f22281b83\","
                + "\"bytes\":2147483648,\"provisioning\":\"SPARSE\",\"filesystemUuid\":\"b1da7037-326d-455c-aecd-017ea58f1757\"}").getAsJsonObject();
        JsonObject desired = StorageConfigSnapshot.project(tables, id -> volume);
        Assert.assertEquals(0, desired.getAsJsonArray("omitted").size());

        JsonObject binding = nfsBinding();
        binding.addProperty("port", 2050);
        String boot = UUID.randomUUID().toString();
        String vm = UUID.randomUUID().toString();
        String address = "192.0.2.21";
        JsonObject network = targetNetwork(boot, address);
        JsonObject review = reviewNfs(nfsArchive(desired, binding), vm, boot, address, network);
        JsonObject reviewed = review.getAsJsonObject("desired");
        JsonArray acls = reviewed.getAsJsonArray("rules");
        JsonObject explicitAcl = acls.get(0).getAsJsonObject();
        JsonObject inheritedAcl = acls.get(1).getAsJsonObject();
        Assert.assertEquals("READ_WRITE", explicitAcl.get("permission").getAsString());
        Assert.assertEquals("READ_ONLY", inheritedAcl.get("permission").getAsString());
        Assert.assertEquals("192.0.2.0/25", explicitAcl.get("principal").getAsString());
        JsonObject overrides = explicitAcl.getAsJsonObject("settings");
        Assert.assertEquals(Set.of("rootSquash", "sync", "secure", "allSquash", "anonUid", "anonGid"), overrides.keySet());
        Assert.assertFalse(overrides.get("rootSquash").getAsBoolean());
        Assert.assertEquals(65534, overrides.get("anonUid").getAsInt());
        Assert.assertEquals(Set.of("sync", "secure"), inheritedAcl.getAsJsonObject("settings").keySet());
        Assert.assertEquals(2050, reviewed.getAsJsonArray("files").get(0).getAsJsonObject()
                .getAsJsonObject("settings").getAsJsonArray("listenerGroupPorts").get(0).getAsInt());
        Assert.assertEquals(2050, review.getAsJsonObject("nfsBinding").getAsJsonArray("listeners").get(0)
                .getAsJsonObject().get("port").getAsInt());

        rules.get(0).getAsJsonObject().addProperty("configJson", explicit.replace("[2049]", "[0]"));
        JsonObject rejected = StorageConfigSnapshot.project(tables, id -> volume);
        InvalidParameterValueException error = Assert.assertThrows(InvalidParameterValueException.class, () ->
                reviewNfs(nfsArchive(rejected, binding), vm, boot, address, network));
        Assert.assertEquals("RESTORE_DESIRED_COVERAGE_INCOMPLETE", error.getMessage());
    }

    private static JsonObject acl(int id, String principal, String configuration, String permission) {
        JsonObject rule = new JsonObject();
        rule.addProperty("id", id);
        rule.addProperty("uuid", UUID.randomUUID().toString());
        rule.addProperty("resourceId", 21);
        rule.addProperty("resourceType", "FILE_SHARE");
        rule.addProperty("principalType", "CIDR");
        rule.addProperty("principal", principal);
        rule.addProperty("state", "Ready");
        rule.addProperty("permission", permission);
        rule.addProperty("configJson", configuration);
        return rule;
    }

    private static JsonObject nfsBinding() {
        return com.google.gson.JsonParser.parseString("{\"port\":2049,\"mode\":\"SERVICE_WIDE\",\"protocolMode\":\"V4_ONLY\","
                + "\"families\":[\"IPv4\",\"IPv6\"],\"bindAddresses\":[\"::\"],\"addresses\":[\"192.0.2.20\"]}").getAsJsonObject();
    }

    private static JsonObject targetNetwork(String boot, String address) {
        JsonObject result = com.google.gson.JsonParser.parseString("{\"interfaces\":[{\"interface\":\"eth0\","
                + "\"mac\":\"02:00:00:00:00:01\",\"prefix\":24}],\"listeners\":[]}").getAsJsonObject();
        result.getAsJsonArray("interfaces").get(0).getAsJsonObject().addProperty("address", address);
        result.addProperty("bootId", boot);
        return result;
    }

    private StorageConfigArtifactStore.Artifact nfsArchive(JsonObject desired, JsonObject binding) {
        JsonObject metadata = new JsonObject();
        metadata.addProperty("sourceInstance", instance.getUuid());
        metadata.addProperty("sourceSharedFs", UUID.randomUUID().toString());
        metadata.addProperty("revision", 0);
        metadata.addProperty("createdAt", System.currentTimeMillis());
        JsonObject coverage = new JsonObject();
        JsonObject effective = new JsonObject();
        for (String protocol : Set.of("NFS", "SMB", "ISCSI", "NVME_OF")) {
            String state = protocol.equals("NFS") ? "OBSERVED" : "NOT_CONFIGURED";
            coverage.addProperty(protocol, state);
            JsonObject observation = new JsonObject();
            observation.addProperty("state", state);
            if (protocol.equals("NFS") && binding != null) {
                observation.addProperty("bootId", UUID.randomUUID().toString());
                observation.addProperty("observedAt", "2026-11-06T04:30:00Z");
                JsonArray bindings = new JsonArray();
                bindings.add(binding);
                observation.add("bindings", bindings);
            }
            effective.add(protocol, observation);
        }
        metadata.add("coverage", coverage);
        byte[] bytes = StorageConfigArchiveV1.create(metadata, desired, effective);
        return store.find(store.backup(instance, 1, bytes, metadata, false).id, true);
    }

    private JsonObject reviewNfs(StorageConfigArtifactStore.Artifact archive, String vm, String boot, String owned, JsonObject observed) {
        JsonObject targetState = StorageConfigSnapshot.project(new JsonObject(), id -> null);
        JsonArray targetListeners = targetState.getAsJsonArray("listeners");
        JsonObject defaultListener = new JsonObject();
        defaultListener.addProperty("uuid", UUID.randomUUID().toString());
        defaultListener.addProperty("protocol", "NFS");
        defaultListener.addProperty("enabled", true);
        defaultListener.addProperty("state", "Ready");
        defaultListener.addProperty("port", 2049);
        defaultListener.add("settings", new JsonObject());
        targetListeners.add(defaultListener);
        return StorageConfigRestorePlanner.review(archive, instance, vm, boot, 1, targetState, Set.of(owned),
                new JsonObject(), Set.of("NFS"), observed, desired -> fileProof(desired, boot));
    }

    private static JsonObject fileProof(JsonObject desired, String boot) {
        JsonObject observation = new JsonObject();
        observation.addProperty("bootId", boot);
        JsonObject volume = desired.getAsJsonArray("volumes").get(0).getAsJsonObject().deepCopy();
        volume.addProperty("state", "OBSERVED");
        volume.addProperty("fsRoot", "/");
        volume.addProperty("mountSource", "/dev/vdb");
        JsonArray volumes = new JsonArray();
        volumes.add(volume);
        observation.add("volumes", volumes);
        JsonArray paths = StorageConfigFilePaths.requests(desired);
        JsonObject path = paths.get(0).getAsJsonObject();
        path.add("filesystemUuid", volume.get("filesystemUuid"));
        path.addProperty("mountSource", "/dev/vdb");
        path.addProperty("mountId", 28);
        path.addProperty("inode", 500);
        path.addProperty("rootInode", 128);
        observation.add("paths", paths);
        return observation;
    }

    @Test
    public void lastKnownGoodSlotMovesAtomicallyAndDoesNotMoveBack() {
        byte[] archive = StorageConfigArchiveV1.create(new JsonObject(), new JsonObject(), new JsonObject());
        StorageConfigArtifactStore.Artifact first = Transaction.execute((TransactionCallback<StorageConfigArtifactStore.Artifact>) tx -> {
            Assert.assertTrue(store.retireLastGood(instance.getId(), 1));
            instance.setConfigurationRevision(1);
            return store.backup(instance, 1, archive, new JsonObject(), true);
        });
        Assert.assertThrows(IllegalStateException.class, () -> Transaction.execute((TransactionCallback<Boolean>) tx -> {
            Assert.assertTrue(store.retireLastGood(instance.getId(), 2));
            throw new IllegalStateException("simulated persistence failure");
        }));
        Assert.assertEquals("ACTIVE", store.find(first.id, false).state);
        StorageConfigArtifactStore.Artifact latest = Transaction.execute((TransactionCallback<StorageConfigArtifactStore.Artifact>) tx -> {
            Assert.assertTrue(store.retireLastGood(instance.getId(), 2));
            instance.setConfigurationRevision(2);
            return store.backup(instance, 1, archive, new JsonObject(), true);
        });
        Assert.assertFalse(Transaction.execute((TransactionCallback<Boolean>) tx -> store.retireLastGood(instance.getId(), 1)));
        Assert.assertEquals("ACTIVE", store.find(latest.id, false).state);
        Assert.assertEquals("SUPERSEDED", store.find(first.id, false).state);
    }
}
