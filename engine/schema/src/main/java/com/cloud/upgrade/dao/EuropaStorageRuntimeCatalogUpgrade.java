// Licensed under the Apache License, Version 2.0. See NOTICE.
package com.cloud.upgrade.dao;

import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;

import com.cloud.utils.db.ScriptRunner;
import com.cloud.utils.exception.CloudRuntimeException;

/** Independent checkpoint for existing Europa databases with completed legacy phases. */
public final class EuropaStorageRuntimeCatalogUpgrade {
    public static final String KEY = "europa-storage-runtime-catalog-v1";

    private EuropaStorageRuntimeCatalogUpgrade() {
    }

    public static void migrate(Connection connection) {
        String resource = "META-INF/db/schema-europa-4.23-s5-runtime-catalog.sql";
        try (InputStream input = EuropaStorageRuntimeCatalogUpgrade.class.getClassLoader().getResourceAsStream(resource)) {
            if (input == null) {
                throw new CloudRuntimeException("Missing SharedFS runtime catalogue migration: " + resource);
            }
            new ScriptRunner(connection, false, true).runScript(new InputStreamReader(input, StandardCharsets.UTF_8));
        } catch (Exception error) {
            throw new CloudRuntimeException("Unable to migrate SharedFS runtime catalogue", error);
        }
    }
}

