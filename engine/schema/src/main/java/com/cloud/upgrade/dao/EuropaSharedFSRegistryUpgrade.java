// Licensed under the Apache License, Version 2.0. See NOTICE.
package com.cloud.upgrade.dao;

import java.sql.Connection;
import java.sql.SQLException;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

/** Independent registry checkpoints, also usable by aligned legacy management packages. */
public final class EuropaSharedFSRegistryUpgrade {
    private static final Logger LOGGER = LogManager.getLogger(EuropaSharedFSRegistryUpgrade.class);
    private EuropaSharedFSRegistryUpgrade() {
    }

    public static void migrate(Connection connection) throws SQLException {
        if (!EuropaSchemaUpgrade.hasState(connection, EuropaStorageDirectoryPolicyUpgrade.KEY, "Complete")) {
            EuropaSchemaUpgrade.begin(connection, EuropaStorageDirectoryPolicyUpgrade.KEY);
            EuropaStorageDirectoryPolicyUpgrade.migrate(connection);
            EuropaSchemaUpgrade.complete(connection, EuropaStorageDirectoryPolicyUpgrade.KEY);
            LOGGER.info("SharedFS registry migration completed: {}", EuropaStorageDirectoryPolicyUpgrade.KEY);
        }
        if (!EuropaSchemaUpgrade.hasState(connection, EuropaStorageRuntimeCatalogUpgrade.KEY, "Complete")) {
            EuropaSchemaUpgrade.begin(connection, EuropaStorageRuntimeCatalogUpgrade.KEY);
            EuropaStorageRuntimeCatalogUpgrade.migrate(connection);
            EuropaSchemaUpgrade.complete(connection, EuropaStorageRuntimeCatalogUpgrade.KEY);
            LOGGER.info("SharedFS registry migration completed: {}", EuropaStorageRuntimeCatalogUpgrade.KEY);
        }
    }
}
