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

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.junit.Before;
import org.junit.Test;

import com.cloud.utils.exception.CloudRuntimeException;

public class SharedNetworkSubnetSchemaUpgradeTest {
    private final Connection connection = mock(Connection.class);
    private final PreparedStatement inspect = mock(PreparedStatement.class);
    private final Statement alter = mock(Statement.class);
    private final Map<String, Integer> widths = new LinkedHashMap<>();
    private final List<String> changes = new ArrayList<>();
    private String column;
    private String type = "varchar";
    private boolean present = true;
    private boolean nullWidth;
    private boolean staleDefinition;
    private boolean failSecondAlter;

    @Before
    public void setup() throws Exception {
        widths.put("cidr", 18);
        widths.put("gateway", 15);
        widths.put("ip6_cidr", 50);
        widths.put("ip6_gateway", 50);
        when(connection.prepareStatement(anyString())).thenReturn(inspect);
        org.mockito.Mockito.doAnswer(a -> { column = a.getArgument(1); return null; }).when(inspect).setString(org.mockito.ArgumentMatchers.eq(2), anyString());
        when(inspect.executeQuery()).thenAnswer(a -> {
            ResultSet result = mock(ResultSet.class);
            when(result.next()).thenReturn(present);
            when(result.getString(1)).thenReturn(type);
            when(result.getLong(2)).thenReturn((long) widths.get(column));
            when(result.wasNull()).thenReturn(nullWidth);
            return result;
        });
        when(connection.createStatement()).thenReturn(alter);
        when(alter.executeQuery(anyString())).thenAnswer(a -> {
            ResultSet table = mock(ResultSet.class);
            when(table.next()).thenReturn(true);
            StringBuilder ddl = new StringBuilder("CREATE TABLE `networks` (\n");
            widths.forEach((name, width) -> ddl.append("  `").append(name).append("` varchar(")
                    .append(staleDefinition ? width + 1 : width)
                    .append(") CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL DEFAULT '' COMMENT 'existing, comment',\n"));
            when(table.getString(2)).thenReturn(ddl.append(") ENGINE=InnoDB").toString());
            return table;
        });
        when(alter.executeUpdate(anyString())).thenAnswer(a -> {
            if (failSecondAlter && changes.size() == 1) {
                failSecondAlter = false;
                throw new SQLException("interrupted migration");
            }
            String sql = a.getArgument(0);
            Matcher match = Pattern.compile("MODIFY COLUMN `([^`]+)` varchar\\((\\d+)\\)").matcher(sql);
            assertTrue(match.find());
            widths.put(match.group(1), Integer.parseInt(match.group(2)));
            changes.add(sql);
            return 0;
        });
    }

    @Test
    public void legacyColumnsWidenWithoutChangingAttributesAndSecondRunDoesNothing() throws Exception {
        SharedNetworkSubnetSchemaUpgrade.migrate(connection);
        assertEquals(Arrays.asList(255, 255, 1024, 1024), new ArrayList<>(widths.values()));
        assertEquals(4, changes.size());
        for (String sql : changes) {
            assertTrue(sql.endsWith("CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL DEFAULT '' COMMENT 'existing, comment'"));
        }
        SharedNetworkSubnetSchemaUpgrade.migrate(connection);
        assertEquals(4, changes.size());
    }

    @Test
    public void interruptedDdlResumesWithoutRepeatingCompletedColumns() {
        failSecondAlter = true;
        expectFailure();
        assertEquals(1, changes.size());
        SharedNetworkSubnetSchemaUpgrade.migrate(connection);
        assertEquals(4, changes.size());
    }

    @Test
    public void largerColumnsIncludingTextAreNeverNarrowed() throws Exception {
        widths.replaceAll((name, width) -> 65535);
        type = "text";
        SharedNetworkSubnetSchemaUpgrade.migrate(connection);
        verify(connection, never()).createStatement();
    }

    @Test
    public void onlyRemainingNarrowColumnsChange() {
        widths.put("cidr", 4096);
        widths.put("ip6_cidr", 1024);
        SharedNetworkSubnetSchemaUpgrade.migrate(connection);
        assertEquals(2, changes.size());
        assertEquals(Integer.valueOf(4096), widths.get("cidr"));
    }

    @Test
    public void missingColumnFailsWithoutInventingAColumn() {
        present = false;
        expectFailure();
        assertTrue(changes.isEmpty());
    }

    @Test
    public void nonCharacterColumnFailsWithoutChangingType() {
        nullWidth = true;
        expectFailure();
        assertTrue(changes.isEmpty());
    }

    @Test
    public void unsupportedNarrowTypeFailsWithoutChangingType() {
        type = "char";
        expectFailure();
        assertTrue(changes.isEmpty());
    }

    @Test
    public void definitionChangedAfterInspectionFailsBeforeDdl() {
        staleDefinition = true;
        expectFailure();
        assertTrue(changes.isEmpty());
    }

    @Test(expected = IllegalArgumentException.class)
    public void rejectsUnsafeSchemaIdentifier() {
        SharedNetworkSubnetSchemaUpgrade.migrate(connection, "cloud`;DROP TABLE networks");
    }

    private void expectFailure() {
        try {
            SharedNetworkSubnetSchemaUpgrade.migrate(connection);
            fail("Expected schema repair to fail safely");
        } catch (CloudRuntimeException expected) {
            assertEquals("Unable to prepare Shared network subnet column capacity", expected.getMessage());
        }
    }
}
