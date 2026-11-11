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
import java.sql.SQLException;
import java.sql.Statement;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import com.cloud.utils.exception.CloudRuntimeException;

/** Repairs installations that completed an upgrade with legacy single-subnet column widths. */
public final class SharedNetworkSubnetSchemaUpgrade {
    public static final String PHASE = "europa-4.23-shared-subnet-columns-v1";

    private SharedNetworkSubnetSchemaUpgrade() {
    }

    public static void migrate(Connection connection) {
        migrate(connection, "cloud");
    }

    static void migrate(Connection connection, String schema) {
        if (schema == null || !schema.matches("[a-zA-Z0-9_]+")) {
            throw new IllegalArgumentException("Invalid network schema name");
        }
        Map<String, Integer> requiredWidths = new LinkedHashMap<>();
        requiredWidths.put("cidr", 255);
        requiredWidths.put("gateway", 255);
        requiredWidths.put("ip6_cidr", 1024);
        requiredWidths.put("ip6_gateway", 1024);
        try (PreparedStatement inspect = connection.prepareStatement("SELECT DATA_TYPE, CHARACTER_MAXIMUM_LENGTH "
                + "FROM information_schema.columns WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'networks' AND COLUMN_NAME = ?")) {
            for (Map.Entry<String, Integer> column : requiredWidths.entrySet()) {
                inspect.setString(1, schema);
                inspect.setString(2, column.getKey());
                try (ResultSet metadata = inspect.executeQuery()) {
                    if (!metadata.next()) {
                        throw new SQLException("Missing network subnet column");
                    }
                    String type = metadata.getString(1);
                    long width = metadata.getLong(2);
                    if (metadata.wasNull()) {
                        throw new SQLException("Network subnet column has no character capacity");
                    }
                    // Never shrink a wider varchar or text column in a customized installation.
                    if (width >= column.getValue()) {
                        continue;
                    }
                    if (!"varchar".equalsIgnoreCase(type)) {
                        throw new SQLException("Unsupported narrow network subnet column type");
                    }
                    widenColumn(connection, schema, column.getKey(), width, column.getValue());
                }
            }
        } catch (SQLException e) {
            throw new CloudRuntimeException("Unable to prepare Shared network subnet column capacity", e);
        }
    }

    private static void widenColumn(Connection connection, String schema, String column, long oldWidth, int newWidth) throws SQLException {
        try (Statement statement = connection.createStatement()) {
            String createTable;
            try (ResultSet table = statement.executeQuery("SHOW CREATE TABLE `" + schema + "`.`networks`")) {
                if (!table.next()) {
                    throw new SQLException("Missing network table definition");
                }
                createTable = table.getString(2);
            }
            // Reuse the server's DDL so nullability, defaults, comments and collation remain intact.
            Pattern definition = Pattern.compile("(?im)^\\h*(`" + column + "`\\h+varchar\\()(\\d+)(\\)[^\\r\\n]*)(?:\\r?$)");
            Matcher match = definition.matcher(createTable);
            if (!match.find() || Long.parseLong(match.group(2)) != oldWidth) {
                throw new SQLException("Network subnet column definition changed during inspection");
            }
            String widened = match.group(1) + newWidth + match.group(3).replaceFirst(",\\h*$", "");
            statement.executeUpdate("ALTER TABLE `" + schema + "`.`networks` MODIFY COLUMN " + widened);
        }
    }
}
