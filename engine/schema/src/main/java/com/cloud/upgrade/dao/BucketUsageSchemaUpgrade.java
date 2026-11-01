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

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Statement;
import java.sql.SQLException;
import com.cloud.utils.exception.CloudRuntimeException;

/** Additive telemetry only: never marks existing usage as successfully collected. */
public final class BucketUsageSchemaUpgrade {
    private BucketUsageSchemaUpgrade() { }
    public static void migrate(Connection connection) {
        for (String[] column : new String[][] {
            {"usage_last_updated", "DATETIME(3) DEFAULT NULL"},
            {"usage_last_attempt", "DATETIME(3) DEFAULT NULL"},
            {"usage_status", "VARCHAR(16) DEFAULT NULL"},
            {"usage_source", "VARCHAR(32) DEFAULT NULL"}}) {
            try (PreparedStatement check = connection.prepareStatement("SELECT COUNT(*) FROM information_schema.columns "
                    + "WHERE table_schema='cloud' AND table_name='bucket' AND column_name=?")) {
                check.setString(1, column[0]);
                try (ResultSet result = check.executeQuery()) {
                    result.next();
                    if (result.getInt(1) == 0) try (Statement alter = connection.createStatement()) {
                        alter.executeUpdate("ALTER TABLE cloud.bucket ADD COLUMN " + column[0] + " " + column[1]);
                    }
                }
            } catch (SQLException error) { throw new CloudRuntimeException("Unable to prepare bucket usage schema"); }
        }
    }
}
