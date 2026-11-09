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
// specific language govening permissions and limitations
// under the License.

package com.cloud.upgrade.dao;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;

import com.cloud.utils.exception.CloudRuntimeException;

public final class EuropaSharedFSComputeUpgrade {
    public static final String KEY = "europa-sharedfs-compute-v1";

    private EuropaSharedFSComputeUpgrade() {
    }

    public static void migrate(Connection connection) {
        try {
            try (Statement statement = connection.createStatement()) {
                statement.execute(
                        "CREATE TABLE IF NOT EXISTS cloud.sharedfs_compute_operation ( "+
                          "id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, "+
                          "uuid CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL, "+
                          "sharedfs_id BIGINT UNSIGNED NOT NULL, "+
                          "instance_id BIGINT UNSIGNED NOT NULL, "+
                          "vm_id BIGINT UNSIGNED NOT NULL, "+
                          "host_id BIGINT UNSIGNED NOT NULL, "+
                          "account_id BIGINT UNSIGNED NOT NULL, "+
                          "request_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL, "+
                          "plan_fingerprint CHAR(64) NOT NULL, "+
                          "state VARCHAR(32) NOT NULL, "+
                          "plan_json MEDIUMTEXT NOT NULL, "+
                          "observed_json MEDIUMTEXT NULL, "+
                          "first_failure VARCHAR(128) NULL, "+
                          "cpu_delta BIGINT UNSIGNED NOT NULL, "+
                          "core_delta BIGINT UNSIGNED NOT NULL, "+
                          "memory_delta BIGINT UNSIGNED NOT NULL, "+
                          "job_id BIGINT UNSIGNED NULL, "+
                          "created DATETIME NOT NULL, "+
                          "updated DATETIME NOT NULL, "+
                          "UNIQUE KEY uk_sharedfs_compute_uuid (uuid), "+
                          "UNIQUE KEY uk_sharedfs_compute_request (sharedfs_id, request_id), "+
                          "KEY idx_sharedfs_compute_host_state (host_id, state) "+
                          ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
            }
            boolean addReservationOwner;
            try (PreparedStatement statement = connection.prepareStatement(
                    "SELECT COUNT(*) FROM information_schema.columns WHERE table_schema='cloud'"
                            + " AND table_name='resource_reservation' AND column_name='sharedfs_compute_operation_uuid'");
                 ResultSet columns = statement.executeQuery()) {
                addReservationOwner = columns.next() && columns.getInt(1) == 0;
            }
            if (addReservationOwner) {
                try (Statement statement = connection.createStatement()) {
                    statement.execute("ALTER TABLE cloud.resource_reservation ADD COLUMN sharedfs_compute_operation_uuid"
                            + " CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,"
                            + " ADD KEY idx_reservation_sharedfs_compute (sharedfs_compute_operation_uuid)");
                }
            }
        } catch (SQLException error) {
            throw new CloudRuntimeException("Unable to migrate SharedFS compute operations", error);
        }
    }
}
