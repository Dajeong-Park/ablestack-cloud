// Licensed under the Apache License, Version 2.0. See NOTICE.
package com.cloud.upgrade;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;

import com.cloud.upgrade.dao.EuropaSchemaUpgrade;
import com.cloud.upgrade.dao.EuropaStorageDirectoryPolicyUpgrade;
import com.cloud.upgrade.dao.EuropaStorageRuntimeCatalogUpgrade;
import org.junit.After;
import org.junit.Assume;
import org.junit.Before;
import org.junit.Test;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

/** Production checkpoint runner and SQL against an explicitly isolated loopback MariaDB. */
public class SharedFSRegistryUpgradeNativeTest {
    private Connection connection;

    @Before
    public void previousEuropa() throws Exception {
        String url = System.getProperty("sharedfs.migration.test.url");
        Assume.assumeTrue("Dedicated loopback migration database required", url != null);
        assertTrue("Only the reserved disposable test port is allowed",
                url.startsWith("jdbc:mysql://127.0.0.1:13348/cloud?"));
        connection = DriverManager.getConnection(url, "root", "");
        try (Statement sql = connection.createStatement()) {
            for (String table : new String[]{"storage_directory_policy", "storage_service_runtime_bundle_validation",
                    "storage_service_runtime_bundle_event", "storage_service_runtime_bundle",
                    "storage_service_runtime_upgrade", "ablestack_schema_migration"}) {
                sql.execute("DROP TABLE IF EXISTS cloud." + table);
            }
            sql.execute("CREATE TABLE cloud.storage_service_runtime_bundle "
                    + "(id BIGINT UNSIGNED PRIMARY KEY, state VARCHAR(32) NOT NULL)");
            sql.execute("CREATE TABLE cloud.storage_service_runtime_upgrade (id BIGINT UNSIGNED PRIMARY KEY)");
            sql.execute("INSERT INTO cloud.storage_service_runtime_bundle VALUES (1,'AVAILABLE'),(2,'DISABLED'),(3,'PUBLISHED')");
        }
        EuropaSchemaUpgrade.initialize(connection);
        for (String key : new String[]{EuropaSchemaUpgrade.S4, EuropaSchemaUpgrade.S5B,
                EuropaSchemaUpgrade.LEGACY_HOOKS, "europa-4.23-after-Diplo"}) {
            EuropaSchemaUpgrade.begin(connection, key);
            EuropaSchemaUpgrade.complete(connection, key);
        }
    }

    @After
    public void close() throws Exception {
        if (connection != null) {
            connection.close();
        }
    }

    private void upgrade() throws Exception {
        new DatabaseUpgradeChecker().upgradeSharedFSRegistrySchemas(connection);
        assertTrue(EuropaSchemaUpgrade.hasState(connection, EuropaStorageDirectoryPolicyUpgrade.KEY, "Complete"));
        assertTrue(EuropaSchemaUpgrade.hasState(connection, EuropaStorageRuntimeCatalogUpgrade.KEY, "Complete"));
        assertTrue(EuropaSchemaUpgrade.hasState(connection, EuropaSchemaUpgrade.S4, "Complete"));
        assertTrue(EuropaSchemaUpgrade.hasState(connection, EuropaSchemaUpgrade.LEGACY_HOOKS, "Complete"));
    }

    private String scalar(String query) throws Exception {
        try (Statement sql = connection.createStatement(); ResultSet rows = sql.executeQuery(query)) {
            assertTrue(rows.next());
            return rows.getString(1);
        }
    }

    @Test
    public void completedOldEuropaReceivesBothRegistriesAndSupportsReads() throws Exception {
        upgrade();
        assertEquals("DRAFT", scalar("SELECT state FROM cloud.storage_service_runtime_bundle WHERE id=1"));
        assertEquals("SUSPENDED", scalar("SELECT state FROM cloud.storage_service_runtime_bundle WHERE id=2"));
        assertEquals("PUBLISHED", scalar("SELECT state FROM cloud.storage_service_runtime_bundle WHERE id=3"));
        assertEquals("UNKNOWN", scalar("SELECT validation_status FROM cloud.storage_service_runtime_bundle WHERE id=1"));
        assertEquals("0", scalar("SELECT state_revision FROM cloud.storage_service_runtime_bundle WHERE id=1"));
        for (String table : new String[]{"storage_directory_policy", "storage_service_runtime_bundle_validation",
                "storage_service_runtime_bundle_event"}) {
            assertEquals("0", scalar("SELECT COUNT(*) FROM cloud." + table));
        }
        assertEquals("0", scalar("SELECT COUNT(catalog_policy_json) FROM cloud.storage_service_runtime_upgrade"));
        assertEquals("0", scalar("SELECT COUNT(current_validation_id) FROM cloud.storage_service_runtime_bundle"));
    }

    @Test
    public void secondStartupPreservesPublishedStateRevisionAndDirectoryMetadata() throws Exception {
        upgrade();
        try (Statement sql = connection.createStatement()) {
            sql.execute("UPDATE cloud.storage_service_runtime_bundle SET state='PUBLISHED', state_revision=7,"
                    + " validation_status='VERIFIED' WHERE id=1");
            sql.execute("INSERT INTO cloud.storage_directory_policy "
                    + "(uuid,instance_id,volume_id,canonical_path,canonical_hash,owner_uid,owner_gid,mode,revision,metadata_json,created) "
                    + "VALUES ('kept',1,2,'/data/kept',REPEAT('a',64),7001,7002,'0770',4,'{\"kept\":true}',NOW())");
        }
        upgrade();
        assertEquals("PUBLISHED:7:VERIFIED", scalar("SELECT CONCAT(state,':',state_revision,':',validation_status)"
                + " FROM cloud.storage_service_runtime_bundle WHERE id=1"));
        assertEquals("7001:7002:0770:4", scalar("SELECT CONCAT(owner_uid,':',owner_gid,':',mode,':',revision)"
                + " FROM cloud.storage_directory_policy WHERE uuid='kept'"));
    }

    @Test
    public void pendingPartialDdlResumesAndCompletedCheckpointSkipsRerun() throws Exception {
        EuropaStorageDirectoryPolicyUpgrade.migrate(connection);
        try (Statement sql = connection.createStatement()) {
            sql.execute("ALTER TABLE cloud.storage_service_runtime_bundle ADD COLUMN state_revision BIGINT UNSIGNED NOT NULL DEFAULT 0");
        }
        EuropaSchemaUpgrade.begin(connection, EuropaStorageDirectoryPolicyUpgrade.KEY);
        EuropaSchemaUpgrade.begin(connection, EuropaStorageRuntimeCatalogUpgrade.KEY);
        upgrade();
        assertEquals("DRAFT", scalar("SELECT state FROM cloud.storage_service_runtime_bundle WHERE id=1"));
        assertEquals("1", scalar("SELECT COUNT(*) FROM information_schema.columns WHERE table_schema='cloud'"
                + " AND table_name='storage_service_runtime_bundle' AND column_name='state_revision'"));
        // A completed checkpoint must not run the state conversion again.
        try (Statement sql = connection.createStatement()) {
            sql.execute("UPDATE cloud.storage_service_runtime_bundle SET state='AVAILABLE' WHERE id=1");
        }
        upgrade();
        assertEquals("AVAILABLE", scalar("SELECT state FROM cloud.storage_service_runtime_bundle WHERE id=1"));
    }
}

