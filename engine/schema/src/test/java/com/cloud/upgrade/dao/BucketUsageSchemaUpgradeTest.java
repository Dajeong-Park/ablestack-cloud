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
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.fail;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.clearInvocations;
import static org.mockito.Mockito.anyString;
import static org.mockito.Mockito.startsWith;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Statement;
import java.sql.SQLException;
import org.junit.Test;
public class BucketUsageSchemaUpgradeTest {
    @Test public void migrationIsAdditiveAndReentrant() throws Exception {
        Connection connection = mock(Connection.class); PreparedStatement check = mock(PreparedStatement.class);
        ResultSet result = mock(ResultSet.class); Statement alter = mock(Statement.class);
        when(connection.prepareStatement(anyString())).thenReturn(check); when(check.executeQuery()).thenReturn(result);
        when(result.getInt(1)).thenReturn(0); when(connection.createStatement()).thenReturn(alter);
        BucketUsageSchemaUpgrade.migrate(connection);
        verify(alter, times(4)).executeUpdate(startsWith("ALTER TABLE cloud.bucket ADD COLUMN usage_"));
        when(result.getInt(1)).thenReturn(1); clearInvocations(alter);
        BucketUsageSchemaUpgrade.migrate(connection); verifyNoInteractions(alter);
    }
    @Test public void schemaFailureDoesNotExposeDriverDetails() throws Exception {
        Connection connection = mock(Connection.class); when(connection.prepareStatement(anyString())).thenThrow(new SQLException("PRIVATE_ENDPOINT_DETAIL"));
        try { BucketUsageSchemaUpgrade.migrate(connection); fail(); }
        catch (com.cloud.utils.exception.CloudRuntimeException expected) { assertFalse(expected.getMessage().contains("PRIVATE")); }
    }
}
