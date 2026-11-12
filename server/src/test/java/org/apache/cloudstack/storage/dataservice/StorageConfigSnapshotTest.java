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
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import org.junit.Assert;
import org.junit.Test;

public class StorageConfigSnapshotTest {
    private static final String SHARE = "70bb01dd-2fac-4d1f-b8d9-114299352199";
    private static final String RULE = "95687075-d764-4af5-827e-54ebf9f7ae0b";
    private static final String DATA = "509ea496-5fcb-4992-aa20-0591c1ab83ca";

    @Test
    public void projectsCredentialSlotWithoutPersistingPasswordsOrInternalIds() {
        JsonObject tables = new JsonObject();
        JsonArray files = new JsonArray();
        JsonObject share = json("{\"id\":20,\"instanceId\":123,\"name\":\"finance\",\"path\":\"/finance\","
                + "\"protocol\":\"SMB\",\"state\":\"Ready\",\"volumeId\":30,\"filesystem\":\"xfs\"}");
        share.addProperty("uuid", SHARE);
        share.addProperty("configJson", "{\"readOnly\":true,\"relativeSharePath\":\"finance\",\"lastInspection\":{\"device\":\"/dev/vdb\"}}");
        files.add(share);
        tables.add("StorageFileShareVO", files);
        JsonArray rules = new JsonArray();
        JsonObject rule = json("{\"id\":40,\"resourceId\":20,\"resourceType\":\"FILE_SHARE\",\"principal\":\"account-a\","
                + "\"principalType\":\"LOCAL_USER\",\"permission\":\"READ_ONLY\",\"state\":\"Ready\"}");
        rule.addProperty("uuid", RULE);
        rule.addProperty("secretRef", "internal-secret-reference");
        rule.addProperty("configJson", "{\"localAccount\":true,\"passwordSupplied\":true,\"password\":\"test-secret\"}");
        rules.add(rule);
        tables.add("StorageAccessRuleVO", rules);
        JsonObject volume = json("{\"bytes\":10737418240,\"provisioning\":\"SPARSE\"}");
        volume.addProperty("uuid", DATA);
        JsonObject desired = StorageConfigSnapshot.project(tables, id -> volume);
        JsonObject access = desired.getAsJsonArray("rules").get(0).getAsJsonObject();
        Assert.assertEquals(SHARE, access.get("resource").getAsString());
        Assert.assertEquals("SMB_LOCAL", access.getAsJsonArray("credentialSlots").get(0).getAsString());
        Assert.assertEquals(DATA, desired.getAsJsonArray("files").get(0).getAsJsonObject().get("volume").getAsString());
        Assert.assertFalse(desired.toString().contains("resourceId"));
        Assert.assertFalse(desired.toString().contains("test-secret"));
        Assert.assertFalse(desired.toString().contains("internal-secret-reference"));
        Assert.assertFalse(desired.toString().contains("/dev/vdb"));
        access.getAsJsonObject("settings").addProperty("password", "injected");
        Assert.assertThrows(InvalidParameterValueException.class, () -> StorageConfigSnapshot.validateDesired(desired));
    }

    @Test
    public void rejectsThinVolumeInPortableSnapshot() {
        JsonObject desired = StorageConfigSnapshot.project(new JsonObject(), id -> null);
        JsonObject volume = json("{\"bytes\":10737418240,\"provisioning\":\"THIN\"}");
        volume.addProperty("uuid", DATA);
        desired.getAsJsonArray("volumes").add(volume);
        Assert.assertThrows(InvalidParameterValueException.class, () -> StorageConfigSnapshot.validateDesired(desired));
    }

    @Test
    public void preservesProtectedRelativePathWithoutImportingSourceIdentity() {
        JsonObject source = projectFile(true, "/srv/ablestack-storage/volumes/" + DATA + "/actual/child");
        JsonObject settings = source.getAsJsonArray("files").get(0).getAsJsonObject().getAsJsonObject("settings");
        Assert.assertEquals("actual/child", settings.get("relativeSharePath").getAsString());
        Assert.assertEquals(1, settings.get("pathBindingVersion").getAsInt());
        Assert.assertFalse(settings.has("pathIdentity"));
        Assert.assertFalse(settings.has("volumeMountPath"));
        Assert.assertFalse(settings.has("backingPath"));
        Assert.assertEquals(0, source.getAsJsonArray("omitted").size());
        settings.add("pathIdentity", new JsonObject());
        Assert.assertThrows(InvalidParameterValueException.class, () -> StorageConfigSnapshot.validateDesired(source));
    }

    @Test
    public void derivesLegacyPathFromVolumeBoundaryAndNeverFromAlias() {
        String root = "/srv/ablestack-storage/volumes/" + DATA;
        JsonObject valid = projectFile(false, root + "/actual/child");
        Assert.assertEquals("actual/child", valid.getAsJsonArray("files").get(0).getAsJsonObject()
                .getAsJsonObject("settings").get("relativeSharePath").getAsString());
        JsonObject unverified = projectFile(false, root + "-different/actual/child");
        Assert.assertEquals("FILE_PATH_UNCONFIRMED", unverified.getAsJsonArray("omitted").get(0).getAsJsonObject()
                .get("reason").getAsString());
        Assert.assertFalse(unverified.getAsJsonArray("files").get(0).getAsJsonObject().getAsJsonObject("settings").has("relativeSharePath"));
    }

    @Test
    public void requiresTargetProofOnObservedFilesystemAndMount() {
        JsonObject source = projectFile(true, "/srv/ablestack-storage/volumes/" + DATA + "/actual/child");
        String fs = "891a1515-6f50-413c-bf31-3c7c03a719ac";
        String boot = "3f2cc36e-1141-40e4-b866-823696023dd1";
        JsonObject volume = source.getAsJsonArray("volumes").get(0).getAsJsonObject();
        volume.addProperty("filesystemUuid", fs);
        JsonObject observation = new JsonObject();
        observation.addProperty("bootId", boot);
        JsonArray observedVolumes = new JsonArray();
        JsonObject observedVolume = volume.deepCopy();
        observedVolume.addProperty("fsRoot", "/");
        observedVolume.addProperty("state", "OBSERVED");
        observedVolume.addProperty("mountSource", "/dev/vdb1");
        observedVolumes.add(observedVolume);
        observation.add("volumes", observedVolumes);
        JsonArray paths = StorageConfigFilePaths.requests(source);
        JsonObject path = paths.get(0).getAsJsonObject();
        path.addProperty("filesystemUuid", fs);
        path.addProperty("mountSource", "/dev/vdb1");
        path.addProperty("mountId", 7);
        path.addProperty("inode", 500);
        path.addProperty("rootInode", 128);
        observation.add("paths", paths);
        Assert.assertEquals(paths, StorageConfigFilePaths.requireProofs(source, observation, boot));
        path.addProperty("mountSource", "/dev/vdc1");
        Assert.assertThrows(InvalidParameterValueException.class, () -> StorageConfigFilePaths.requireProofs(source, observation, boot));
        path.addProperty("mountSource", "/dev/vdb1");
        path.addProperty("filesystemUuid", "81d88fa5-0816-4931-95de-72e9ef109a84");
        Assert.assertThrows(InvalidParameterValueException.class, () -> StorageConfigFilePaths.requireProofs(source, observation, boot));
    }

    private static JsonObject projectFile(boolean protectedPath, String backing) {
        JsonObject share = new JsonObject();
        share.addProperty("id", 21);
        share.addProperty("uuid", SHARE);
        share.addProperty("protocol", "NFS");
        share.addProperty("name", "finance");
        share.addProperty("path", "/export/finance");
        share.addProperty("filesystem", "xfs");
        share.addProperty("volumeId", 30);
        share.addProperty("state", "Ready");
        JsonObject config = new JsonObject();
        config.addProperty("backingPath", backing);
        config.addProperty("volumeMountPath", "/srv/ablestack-storage/volumes/" + DATA);
        if (protectedPath) {
            config.addProperty("relativeSharePath", "actual/child");
            config.addProperty("pathBindingVersion", 1);
            config.add("pathIdentity", json("{\"inode\":99,\"volumeRootInode\":1}"));
        }
        share.addProperty("configJson", config.toString());
        JsonArray files = new JsonArray();
        files.add(share);
        JsonObject tables = new JsonObject();
        tables.add("StorageFileShareVO", files);
        JsonObject volume = json("{\"bytes\":10737418240,\"provisioning\":\"SPARSE\"}");
        volume.addProperty("uuid", DATA);
        return StorageConfigSnapshot.project(tables, id -> volume);
    }

    private static JsonObject json(String value) {
        return JsonParser.parseString(value).getAsJsonObject();
    }
}
