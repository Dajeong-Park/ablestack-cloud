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
package com.cloud.upgrade.dao;

import com.cloud.utils.exception.CloudRuntimeException;
import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Statement;

/** Independent, additive migration for portable SharedFS configuration artifacts. */
public final class EuropaStorageConfigArtifactUpgrade {
    public static final String KEY = "europa-storage-config-artifact-v1";

    private EuropaStorageConfigArtifactUpgrade() { }

    public static void migrate(Connection connection) {
        try (Statement statement = connection.createStatement()) {
            statement.execute("CREATE TABLE IF NOT EXISTS cloud.storage_service_config_artifact ("
                    + "id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,"
                    + "uuid CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,"
                    + "kind VARCHAR(16) NOT NULL,state VARCHAR(16) NOT NULL,"
                    + "source_uuid CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,"
                    + "target_uuid CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,"
                    + "account_id BIGINT UNSIGNED NOT NULL,domain_id BIGINT UNSIGNED NOT NULL,"
                    + "zone_id BIGINT UNSIGNED NOT NULL,revision BIGINT UNSIGNED NOT NULL,"
                    + "created_by BIGINT UNSIGNED NOT NULL,created_ms BIGINT UNSIGNED NOT NULL,expires_ms BIGINT UNSIGNED NULL,"
                    + "sha256 CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,byte_count INT UNSIGNED NOT NULL,"
                    + "metadata MEDIUMTEXT NOT NULL,payload MEDIUMBLOB NOT NULL,active_lkg_instance_id BIGINT UNSIGNED NULL,"
                    + "UNIQUE KEY uk_ss_config_artifact_uuid(uuid),"
                    + "UNIQUE KEY uk_ss_config_artifact_lkg(active_lkg_instance_id),"
                    + "KEY idx_ss_config_artifact_source(source_uuid,created_ms),"
                    + "KEY idx_ss_config_artifact_target(target_uuid,expires_ms)"
                    + ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
        } catch (SQLException error) {
            throw new CloudRuntimeException("Unable to migrate SharedFS configuration artifacts", error);
        }
    }
}
