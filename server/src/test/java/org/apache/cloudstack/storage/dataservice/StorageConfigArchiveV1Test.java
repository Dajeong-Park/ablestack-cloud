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
import com.google.gson.JsonObject;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;
import org.junit.Assert;
import org.junit.Test;

public class StorageConfigArchiveV1Test {
    @Test
    public void validatesThreeEntryArchive() {
        JsonObject desired = new JsonObject();
        desired.addProperty("state", "READY");
        byte[] archive = StorageConfigArchiveV1.create(new JsonObject(), desired, new JsonObject());
        Assert.assertEquals(desired, StorageConfigArchiveV1.read(archive).desired);
        Assert.assertEquals(1, StorageConfigArchiveV1.read(archive).manifest.get("schemaVersion").getAsInt());
    }

    @Test
    public void rejectsTraversalAndTrailingBytes() throws Exception {
        byte[] unsafe = archive(Map.of("manifest.json", "{}", "desired.json", "{}", "../effective.json", "{}"));
        Assert.assertThrows(InvalidParameterValueException.class, () -> StorageConfigArchiveV1.read(unsafe));
        byte[] valid = StorageConfigArchiveV1.create(new JsonObject(), new JsonObject(), new JsonObject());
        Assert.assertThrows(InvalidParameterValueException.class,
                () -> StorageConfigArchiveV1.read(java.util.Arrays.copyOf(valid, valid.length + 1)));
    }

    @Test
    public void rejectsDuplicateJsonKeysEvenWithMatchingEntryDigest() throws Exception {
        String desired = "{\"mode\":\"RO\",\"mode\":\"RW\"}";
        String effective = "{}";
        String manifest = "{\"schemaVersion\":1,\"entries\":{\"desired.json\":" + metadata(desired)
                + ",\"effective.json\":" + metadata(effective) + "}}";
        byte[] archive = archive(Map.of("manifest.json", manifest, "desired.json", desired, "effective.json", effective));
        Assert.assertThrows(InvalidParameterValueException.class, () -> StorageConfigArchiveV1.read(archive));
    }

    @Test
    public void rejectsMismatchedManifestAndCompressionBomb() throws Exception {
        byte[] wrong = archive(Map.of("manifest.json", "{\"schemaVersion\":1,\"entries\":{}}",
                "desired.json", "{}", "effective.json", "{}"));
        Assert.assertThrows(InvalidParameterValueException.class, () -> StorageConfigArchiveV1.read(wrong));
        byte[] expanded = archive(Map.of("manifest.json", "{}", "desired.json", " ".repeat(1_000_000), "effective.json", "{}"));
        Assert.assertThrows(InvalidParameterValueException.class, () -> StorageConfigArchiveV1.read(expanded));
    }

    private static String metadata(String entry) {
        byte[] bytes = entry.getBytes(StandardCharsets.UTF_8);
        return "{\"bytes\":" + bytes.length + ",\"sha256\":\"" + StorageConfigArchiveV1.digest(bytes) + "\"}";
    }

    private static byte[] archive(Map<String, String> values) throws Exception {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        try (ZipOutputStream zip = new ZipOutputStream(output)) {
            for (Map.Entry<String, String> value : values.entrySet()) {
                zip.putNextEntry(new ZipEntry(value.getKey()));
                zip.write(value.getValue().getBytes(StandardCharsets.UTF_8));
                zip.closeEntry();
            }
        }
        return output.toByteArray();
    }
}
