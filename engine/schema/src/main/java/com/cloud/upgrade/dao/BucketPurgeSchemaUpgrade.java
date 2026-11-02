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
import com.cloud.utils.exception.CloudRuntimeException;

public final class BucketPurgeSchemaUpgrade {
    private BucketPurgeSchemaUpgrade() { }
    public static void migrate(Connection connection) {
        try (PreparedStatement check = connection.prepareStatement("SELECT COUNT(*) FROM information_schema.columns WHERE table_schema='cloud' AND table_name='bucket_quota_operation' AND column_name='purge_progress'")) {
            try (ResultSet result = check.executeQuery()) {
                result.next();
                if (result.getInt(1) == 0) try (Statement alter = connection.createStatement()) {
                    alter.executeUpdate("ALTER TABLE cloud.bucket_quota_operation ADD COLUMN purge_progress MEDIUMTEXT DEFAULT NULL");
                }
            }
        } catch (SQLException error) { throw new CloudRuntimeException("Unable to prepare bucket purge schema"); }
    }
}
