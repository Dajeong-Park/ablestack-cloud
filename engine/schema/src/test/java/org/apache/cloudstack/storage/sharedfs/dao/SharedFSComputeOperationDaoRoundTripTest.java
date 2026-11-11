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

package org.apache.cloudstack.storage.sharedfs.dao;

import com.cloud.upgrade.dao.EuropaSharedFSComputeUpgrade;
import com.cloud.utils.db.TransactionLegacy;
import com.mysql.cj.jdbc.MysqlDataSource;
import org.apache.cloudstack.storage.sharedfs.SharedFSComputeOperationVO;
import org.junit.Assume;
import org.junit.Test;

import javax.sql.DataSource;
import java.lang.reflect.Field;
import java.sql.Connection;
import java.sql.Statement;
import java.time.Instant;
import java.util.Date;
import java.util.UUID;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;

public class SharedFSComputeOperationDaoRoundTripTest {
    @Test
    public void reservationTimestampsAndJsonSurviveInsertUpdateAndReload() throws Exception {
        String url = System.getProperty("configuration.dao.test.url");
        Assume.assumeTrue("Dedicated local database required", url != null);
        assertTrue(url.startsWith("jdbc:mysql://127.0.0.1:13344/cloud?"));

        MysqlDataSource datasource = new MysqlDataSource();
        datasource.setURL(url);
        datasource.setUser("root");
        try (Connection connection = datasource.getConnection(); Statement statement = connection.createStatement()) {
            statement.execute("CREATE TABLE IF NOT EXISTS resource_reservation (id BIGINT UNSIGNED NOT NULL PRIMARY KEY)");
            EuropaSharedFSComputeUpgrade.migrate(connection);
        }

        Field field = TransactionLegacy.class.getDeclaredField("s_ds");
        field.setAccessible(true);
        DataSource previous = (DataSource) field.get(null);
        field.set(null, datasource);
        try (TransactionLegacy ignored = TransactionLegacy.open(TransactionLegacy.CLOUD_DB)) {
            SharedFSComputeOperationDaoImpl dao = new SharedFSComputeOperationDaoImpl();
            SharedFSComputeOperationVO operation = new SharedFSComputeOperationVO();
            operation.setSharedFsId(11L);
            operation.setInstanceId(12L);
            operation.setVmId(13L);
            operation.setHostId(14L);
            operation.setAccountId(2L);
            operation.setRequestId(UUID.randomUUID().toString());
            operation.setPlanFingerprint("a".repeat(64));
            String plan = "{\"targetCpu\":4,\"observed\":\"" + "계획🧪".repeat(500) + "\"}";
            operation.setPlanJson(plan);
            operation.setState("RESERVED");
            operation.setCoreDelta(2L);
            Date reserved = Date.from(Instant.parse("2026-11-09T00:00:00Z"));
            operation.setUpdated(reserved);

            SharedFSComputeOperationVO stored = dao.persist(operation);
            SharedFSComputeOperationVO reloaded = dao.findByRequest(11L, operation.getRequestId());
            assertEquals(stored.getId(), reloaded.getId());
            assertNotNull(reloaded.getCreated());
            assertEquals(reserved, reloaded.getUpdated());
            assertEquals(2L, reloaded.getCoreDelta());
            assertEquals(plan, reloaded.getPlanJson());
            assertTrue(dao.listPendingByHost(14L).stream().anyMatch(row -> row.getId() == stored.getId()));

            Date committed = Date.from(Instant.parse("2026-11-09T00:01:00Z"));
            String observation = "{\"activeCpus\":4,\"receipt\":\"" + "관측🧪".repeat(500) + "\"}";
            stored.setUpdated(committed);
            stored.setState("COMMITTED");
            stored.setObservedJson(observation);
            assertTrue(dao.update(stored.getId(), stored));

            SharedFSComputeOperationVO completed = dao.findById(stored.getId());
            assertEquals(committed, completed.getUpdated());
            assertEquals(reloaded.getCreated(), completed.getCreated());
            assertEquals("COMMITTED", completed.getState());
            assertEquals(plan, completed.getPlanJson());
            assertEquals(observation, completed.getObservedJson());
            assertFalse(dao.listPendingByHost(14L).stream().anyMatch(row -> row.getId() == stored.getId()));
        } finally {
            field.set(null, previous);
        }
    }
}
