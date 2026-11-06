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
import com.google.gson.JsonElement;
import com.google.gson.JsonNull;
import com.google.gson.JsonObject;
import com.google.gson.JsonPrimitive;
import com.google.gson.stream.JsonReader;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.StringReader;
import java.math.BigDecimal;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.zip.CRC32;
import java.util.zip.DataFormatException;
import java.util.zip.Inflater;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;
import org.apache.commons.codec.digest.DigestUtils;

/** Configuration interchange only: no extraction, runtime files or database snapshots. */
final class StorageConfigArchiveV1 {
    static final int CHUNK = 64 * 1024;
    static final int MAX_BYTES = 32 * CHUNK;
    static final int MAX_EXPANDED = 8 * 1024 * 1024;
    private static final int MAX_ENTRY = MAX_EXPANDED / 2;
    private static final String MANIFEST = "manifest.json";
    private static final String DESIRED = "desired.json";
    private static final String EFFECTIVE = "effective.json";
    private static final Set<String> NAMES = Set.of(MANIFEST, DESIRED, EFFECTIVE);

    private StorageConfigArchiveV1() { }

    static String digest(byte[] bytes) {
        return DigestUtils.sha256Hex(bytes);
    }

    static final class Bundle {
        final JsonObject manifest;
        final JsonObject desired;
        final JsonObject effective;

        Bundle(JsonObject manifest, JsonObject desired, JsonObject effective) {
            this.manifest = manifest;
            this.desired = desired;
            this.effective = effective;
        }
    }

    static byte[] create(JsonObject metadata, JsonObject desired, JsonObject effective) {
        Map<String, byte[]> entries = new LinkedHashMap<>();
        entries.put(DESIRED, bytes(desired));
        entries.put(EFFECTIVE, bytes(effective));
        JsonObject manifest = metadata.deepCopy();
        manifest.addProperty("schemaVersion", 1);
        JsonObject index = new JsonObject();
        entries.forEach((name, content) -> {
            JsonObject identity = new JsonObject();
            identity.addProperty("bytes", content.length);
            identity.addProperty("sha256", digest(content));
            index.add(name, identity);
        });
        manifest.add("entries", index);
        entries.put(MANIFEST, bytes(manifest));
        try {
            ByteArrayOutputStream result = new ByteArrayOutputStream();
            try (ZipOutputStream zip = new ZipOutputStream(result, StandardCharsets.UTF_8)) {
                // Default compression can exceed our own ratio bound on valid, repetitive config.
                zip.setLevel(1);
                for (Map.Entry<String, byte[]> entry : entries.entrySet()) {
                    ZipEntry header = new ZipEntry(entry.getKey());
                    zip.putNextEntry(header);
                    zip.write(entry.getValue());
                    zip.closeEntry();
                }
            }
            byte[] archive = result.toByteArray();
            read(archive);
            return archive;
        } catch (IOException error) {
            throw invalid("ARCHIVE_WRITE_FAILED");
        }
    }

    static Bundle read(byte[] archive) {
        if (archive == null || archive.length < 22 || archive.length > MAX_BYTES) {
            throw invalid("ARCHIVE_SIZE");
        }
        Map<String, byte[]> entries = readEntries(archive);
        JsonObject manifest = object(entries.get(MANIFEST));
        JsonElement version = manifest.get("schemaVersion");
        if (version == null || !version.isJsonPrimitive() || !version.getAsJsonPrimitive().isNumber()
                || !"1".equals(version.getAsString()) || !manifest.has("entries") || !manifest.get("entries").isJsonObject()) {
            throw invalid("UNSUPPORTED_ARCHIVE_SCHEMA");
        }
        JsonObject index = manifest.getAsJsonObject("entries");
        if (!index.keySet().equals(Set.of(DESIRED, EFFECTIVE))) {
            throw invalid("MANIFEST_ENTRY_SET");
        }
        for (String name : index.keySet()) {
            byte[] content = entries.get(name);
            if (!index.get(name).isJsonObject()) {
                throw invalid("INVALID_ENTRY_IDENTITY");
            }
            JsonObject identity = index.getAsJsonObject(name);
            if (!identity.keySet().equals(Set.of("bytes", "sha256"))
                    || !new JsonPrimitive(content.length).equals(identity.get("bytes"))
                    || !new JsonPrimitive(digest(content)).equals(identity.get("sha256"))) {
                throw invalid("ENTRY_DIGEST_MISMATCH");
            }
        }
        return new Bundle(manifest, object(entries.get(DESIRED)), object(entries.get(EFFECTIVE)));
    }

    private static Map<String, byte[]> readEntries(byte[] archive) {
        ByteBuffer zip = ByteBuffer.wrap(archive).order(ByteOrder.LITTLE_ENDIAN);
        int end = archive.length - 22;
        if (zip.getInt(end) != 0x06054b50 || zip.getInt(end + 4) != 0
                || zip.getShort(end + 8) != 3 || zip.getShort(end + 10) != 3 || zip.getShort(end + 20) != 0) {
            throw invalid("INVALID_ZIP_DIRECTORY");
        }
        long size = unsigned(zip, end + 12);
        long offset = unsigned(zip, end + 16);
        if (offset <= 0 || size < 3 * 46 || offset + size != end) {
            throw invalid("INVALID_ZIP_DIRECTORY");
        }
        Map<Integer, DirectoryEntry> physical = new java.util.TreeMap<>();
        int pos = (int) offset;
        int expanded = 0;
        for (int i = 0; i < 3; i++) {
            if (pos + 46 > end || zip.getInt(pos) != 0x02014b50 || zip.getShort(pos + 34) != 0) {
                throw invalid("INVALID_ZIP_DIRECTORY");
            }
            int flags = Short.toUnsignedInt(zip.getShort(pos + 8));
            int method = Short.toUnsignedInt(zip.getShort(pos + 10));
            int nameSize = Short.toUnsignedInt(zip.getShort(pos + 28));
            int extraSize = Short.toUnsignedInt(zip.getShort(pos + 30));
            int commentSize = Short.toUnsignedInt(zip.getShort(pos + 32));
            long length = unsigned(zip, pos + 24);
            long compressed = unsigned(zip, pos + 20);
            long local = unsigned(zip, pos + 42);
            int mode = (zip.getInt(pos + 38) >>> 16) & 0170000;
            int next = pos + 46 + nameSize + extraSize + commentSize;
            if (next > end || nameSize == 0 || nameSize > 32 || extraSize != 0 || commentSize != 0
                    || (flags & ~0x080e) != 0 || method != ZipEntry.STORED && method != ZipEntry.DEFLATED
                    || (method == ZipEntry.STORED && (length != compressed || (flags & 0x0e) != 0))
                    || mode != 0 && mode != 0100000 || (zip.getInt(pos + 38) & 0x10) != 0
                    || compressed <= 0 || compressed > offset || local >= offset
                    || length <= 0 || length > MAX_ENTRY || length > compressed * 100
                    || expanded + length > MAX_EXPANDED) {
                throw invalid("UNSAFE_ZIP_ENTRY");
            }
            String name = new String(archive, pos + 46, nameSize, StandardCharsets.US_ASCII);
            if (!NAMES.contains(name) || physical.put((int) local,
                    new DirectoryEntry(name, flags, method, (int) length, (int) compressed, unsigned(zip, pos + 16))) != null) {
                throw invalid("UNSAFE_ZIP_ENTRY");
            }
            expanded += (int) length;
            pos = next;
        }
        if (pos != end) {
            throw invalid("INVALID_ZIP_DIRECTORY");
        }
        Map<String, byte[]> result = new LinkedHashMap<>();
        int next = 0;
        for (Map.Entry<Integer, DirectoryEntry> entry : physical.entrySet()) {
            DirectoryEntry value = entry.getValue();
            int local = entry.getKey();
            int data = local + 30 + value.name.length();
            int dataEnd = data + value.compressed;
            if (local != next || dataEnd > offset || result.containsKey(value.name)
                    || zip.getInt(local) != 0x04034b50 || zip.getShort(local + 6) != value.flags
                    || zip.getShort(local + 8) != value.method || zip.getShort(local + 26) != value.name.length()
                    || zip.getShort(local + 28) != 0
                    || !value.name.equals(new String(archive, local + 30, value.name.length(), StandardCharsets.US_ASCII))) {
                throw invalid("ZIP_LOCAL_HEADER_MISMATCH");
            }
            next = dataEnd;
            if ((value.flags & 8) != 0) {
                if (dataEnd + 16 > offset || zip.getInt(dataEnd) != 0x08074b50
                        || !value.matches(zip, dataEnd + 4)) {
                    throw invalid("ZIP_DESCRIPTOR_MISMATCH");
                }
                next += 16;
            } else if (!value.matches(zip, local + 14)) {
                throw invalid("ZIP_LOCAL_HEADER_MISMATCH");
            }
            byte[] content = value.method == ZipEntry.STORED
                    ? java.util.Arrays.copyOfRange(archive, data, dataEnd) : inflate(archive, data, value);
            CRC32 crc = new CRC32();
            crc.update(content);
            if (crc.getValue() != value.crc) {
                throw invalid("ZIP_CONTENT_MISMATCH");
            }
            result.put(value.name, content);
        }
        if (next != offset || !result.keySet().equals(NAMES)) {
            throw invalid("ARCHIVE_ENTRY_SET");
        }
        return result;
    }

    private static byte[] inflate(byte[] archive, int offset, DirectoryEntry entry) {
        Inflater inflater = new Inflater(true);
        try {
            inflater.setInput(archive, offset, entry.compressed);
            byte[] output = new byte[entry.length + 1];
            int total = 0;
            while (!inflater.finished() && total < output.length) {
                int count = inflater.inflate(output, total, output.length - total);
                if (count == 0 && !inflater.finished()) {
                    throw invalid("INVALID_ZIP_DEFLATE");
                }
                total += count;
            }
            if (!inflater.finished() || total != entry.length || inflater.getRemaining() != 0) {
                throw invalid("ZIP_CONTENT_MISMATCH");
            }
            return java.util.Arrays.copyOf(output, total);
        } catch (DataFormatException error) {
            throw invalid("INVALID_ZIP_DEFLATE");
        } finally {
            inflater.end();
        }
    }

    private static long unsigned(ByteBuffer buffer, int offset) {
        return Integer.toUnsignedLong(buffer.getInt(offset));
    }

    private static final class DirectoryEntry {
        final String name;
        final int flags, method, length, compressed;
        final long crc;

        DirectoryEntry(String name, int flags, int method, int length, int compressed, long crc) {
            this.name = name;
            this.flags = flags;
            this.method = method;
            this.length = length;
            this.compressed = compressed;
            this.crc = crc;
        }

        boolean matches(ByteBuffer buffer, int offset) {
            return unsigned(buffer, offset) == crc && unsigned(buffer, offset + 4) == compressed
                    && unsigned(buffer, offset + 8) == length;
        }
    }

    private static byte[] bytes(JsonObject value) {
        return value.toString().getBytes(StandardCharsets.UTF_8);
    }

    static JsonObject addressMapping(String value) {
        return value == null || value.isBlank() ? new JsonObject() : object(value.getBytes(StandardCharsets.UTF_8));
    }

    static JsonObject restoreSecrets(String value) {
        return value == null || value.isBlank() ? new JsonObject() : object(value.getBytes(StandardCharsets.UTF_8), true);
    }

    private static JsonObject object(byte[] bytes) {
        return object(bytes, false);
    }

    private static JsonObject object(byte[] bytes, boolean ephemeralCredentials) {
        try {
            String source = StandardCharsets.UTF_8.newDecoder().decode(ByteBuffer.wrap(bytes)).toString();
            try (JsonReader reader = new JsonReader(new StringReader(source))) {
                JsonElement value = readValue(reader, 0, new int[] {0}, ephemeralCredentials);
                if (!value.isJsonObject() || reader.peek() != com.google.gson.stream.JsonToken.END_DOCUMENT) {
                    throw invalid("INVALID_ARCHIVE_JSON");
                }
                return value.getAsJsonObject();
            }
        } catch (IOException | IllegalStateException | NumberFormatException error) {
            throw invalid("INVALID_ARCHIVE_JSON");
        }
    }

    private static JsonElement readValue(JsonReader reader, int depth, int[] count, boolean ephemeralCredentials) throws IOException {
        if (depth > 32 || ++count[0] > 100_000) {
            throw invalid("ARCHIVE_JSON_COMPLEXITY");
        }
        switch (reader.peek()) {
            case BEGIN_OBJECT:
                JsonObject object = new JsonObject();
                reader.beginObject();
                while (reader.hasNext()) {
                    String key = reader.nextName();
                    if (object.has(key) || object.size() >= 128 || key.length() > 128) {
                        throw invalid("ARCHIVE_JSON_KEYS");
                    }
                    object.add(key, readValue(reader, depth + 1, count, ephemeralCredentials));
                }
                reader.endObject();
                return object;
            case BEGIN_ARRAY:
                JsonArray array = new JsonArray();
                reader.beginArray();
                while (reader.hasNext()) {
                    if (array.size() >= 10_000) {
                        throw invalid("ARCHIVE_JSON_COMPLEXITY");
                    }
                    array.add(readValue(reader, depth + 1, count, ephemeralCredentials));
                }
                reader.endArray();
                return array;
            case STRING:
                String value = reader.nextString();
                if (value.length() > 4096 || !ephemeralCredentials && (value.startsWith("DHHC-1:") || value.contains("PRIVATE KEY-----"))) {
                    throw invalid("INVALID_ARCHIVE_STRING");
                }
                return new JsonPrimitive(value);
            case NUMBER:
                String number = reader.nextString();
                if (number.length() > 64) {
                    throw invalid("INVALID_ARCHIVE_NUMBER");
                }
                BigDecimal numeric = new BigDecimal(number);
                if (Math.abs((long) numeric.scale()) > 32) {
                    throw invalid("INVALID_ARCHIVE_NUMBER");
                }
                return new JsonPrimitive(numeric);
            case BOOLEAN:
                return new JsonPrimitive(reader.nextBoolean());
            case NULL:
                reader.nextNull();
                return JsonNull.INSTANCE;
            default:
                throw invalid("INVALID_ARCHIVE_JSON");
        }
    }

    static InvalidParameterValueException invalid(String code) {
        return new InvalidParameterValueException(code);
    }
}
