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
package com.cloud.dc.dao;

import com.cloud.dc.ASNumberVO;
import com.cloud.exception.InvalidParameterValueException;
import com.cloud.user.Account;
import com.cloud.utils.Pair;
import com.cloud.utils.db.TransactionLegacy;
import org.h2.jdbcx.JdbcDataSource;
import org.junit.After;
import org.junit.Assert;
import org.junit.Before;
import org.junit.Test;
import org.mockito.Mockito;

import java.lang.reflect.Field;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.Statement;
import java.util.List;
import java.util.UUID;

/** Real GenericDao SQL generation, JDBC binding, hydration, count and caller scope on an isolated H2 table. */
public class ASNumberDaoQueryTest {
    private final JdbcDataSource source = new JdbcDataSource();
    private ASNumberDaoImpl dao;
    private TransactionLegacy transaction;
    private Field dataSourceField;
    private Object previousSource;

    @Before
    public void open() throws Exception {
        source.setURL("jdbc:h2:mem:asnquery" + UUID.randomUUID() + ";MODE=MySQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1");
        try (Connection c = source.getConnection(); Statement s = c.createStatement()) {
            s.execute("CREATE TABLE as_number (id BIGINT AUTO_INCREMENT PRIMARY KEY, uuid VARCHAR(40), account_id BIGINT, domain_id BIGINT, "
                    + "as_number BIGINT, as_number_range_id BIGINT, data_center_id BIGINT, allocated TIMESTAMP, is_allocated BOOLEAN, "
                    + "network_id BIGINT, vpc_id BIGINT, removed TIMESTAMP, created TIMESTAMP DEFAULT CURRENT_TIMESTAMP)");
        }
        dataSourceField = TransactionLegacy.class.getDeclaredField("s_ds");
        dataSourceField.setAccessible(true);
        previousSource = dataSourceField.get(null);
        dataSourceField.set(null, source);
        transaction = TransactionLegacy.open(TransactionLegacy.CLOUD_DB);
        dao = new ASNumberDaoImpl();
        for (long number : new long[] {0, 23456, 64512, 65535, 2147483647L, 2147483648L, 4200000000L, 4294967294L, 4294967295L}) {
            insert(number, 1, 10, null, null, false, null, null, false);
        }
        insert(4200000000L, 2, 20, null, null, false, null, null, false);
        insert(4200000000L, 1, 11, 2L, 2L, true, 30L, null, false);
        insert(4200000000L, 1, 12, 3L, 3L, true, null, 40L, false);
        insert(4200000000L, 1, 10, null, null, false, null, null, true);
        // Existing out-of-domain data remains discoverable with keyword/range, never exact lookup.
        insert(42000000000L, 1, 10, null, null, false, null, null, false);
    }

    @After
    public void close() throws Exception {
        if (transaction != null) transaction.close();
        if (dataSourceField != null) dataSourceField.set(null, previousSource);
        try (Connection c = source.getConnection(); Statement s = c.createStatement()) {
            s.execute("SHUTDOWN");
        }
    }

    private void insert(long number, long zone, long range, Long account, Long domain, boolean allocated, Long network, Long vpc, boolean removed) throws Exception {
        try (Connection c = source.getConnection(); PreparedStatement s = c.prepareStatement(
                "INSERT INTO as_number (uuid,as_number,data_center_id,as_number_range_id,account_id,domain_id,is_allocated,network_id,vpc_id,removed) VALUES (?,?,?,?,?,?,?,?,?,?)")) {
            Object[] values = {UUID.randomUUID().toString(), number, zone, range, account, domain, allocated, network, vpc,
                    removed ? new java.sql.Timestamp(System.currentTimeMillis()) : null};
            for (int i = 0; i < values.length; i++) s.setObject(i + 1, values[i]);
            s.executeUpdate();
        }
    }

    private Account caller(Account.Type type, long account, long domain) {
        Account caller = Mockito.mock(Account.class);
        Mockito.when(caller.getType()).thenReturn(type);
        Mockito.lenient().when(caller.getAccountId()).thenReturn(account);
        Mockito.lenient().when(caller.getDomainId()).thenReturn(domain);
        return caller;
    }

    private Pair<List<ASNumberVO>, Integer> query(Long zone, Long range, Long number, Long network, Long vpc, Boolean allocated,
                                                Long account, Long domain, String keyword, Account caller, long offset, long size) {
        return dao.searchAndCountByZoneOrRangeOrAllocated(zone, range, number, network, vpc, allocated, account, domain, keyword, caller, offset, size);
    }

    @Test
    public void exactLookupHydratesEveryBoundaryWithoutIntegerNarrowing() {
        Account admin = caller(Account.Type.ADMIN, 1, 1);
        for (long number : new long[] {0, 23456, 64512, 65535, 2147483647L, 2147483648L, 4200000000L, 4294967294L, 4294967295L}) {
            Pair<List<ASNumberVO>, Integer> exact = query(1L, 10L, number, null, null, false, null, null, null, admin, 0, 20);
            Assert.assertEquals(Integer.valueOf(1), exact.second());
            Assert.assertEquals(number, exact.first().get(0).getAsNumber());
            Pair<List<ASNumberVO>, Integer> keyword = query(1L, 10L, null, null, null, false, null, null, Long.toString(number), admin, 0, 20);
            Assert.assertTrue(keyword.first().stream().anyMatch(row -> row.getId() == exact.first().get(0).getId()));
        }
        Assert.assertEquals(Integer.valueOf(0), query(1L, null, 4200000001L, null, null, null, null, null, null, admin, 0, 20).second());
    }

    @Test
    public void exactUsesEqualityAndCountIsIndependentOfPageSize() {
        Account admin = caller(Account.Type.ADMIN, 1, 1);
        Pair<List<ASNumberVO>, Integer> first = query(null, null, 4200000000L, null, null, null, null, null, null, admin, 0, 1);
        Pair<List<ASNumberVO>, Integer> second = query(null, null, 4200000000L, null, null, null, null, null, null, admin, 1, 1);
        Assert.assertEquals(Integer.valueOf(4), first.second());
        Assert.assertEquals(first.second(), second.second());
        Assert.assertEquals(1, first.first().size());
        Assert.assertNotEquals(first.first().get(0).getId(), second.first().get(0).getId());
        Assert.assertEquals(Integer.valueOf(2), query(1L, 10L, null, null, null, null, null, null, "4200000000", admin, 0, 20).second());
        Assert.assertThrows(InvalidParameterValueException.class,
                () -> query(null, null, 42000000000L, null, null, null, null, null, null, admin, 0, 20));
    }

    @Test
    public void exactCombinesWithEveryFilterUsingAnd() {
        Account admin = caller(Account.Type.ADMIN, 1, 1);
        Assert.assertEquals(Integer.valueOf(1), query(1L, 11L, 4200000000L, 30L, null, true, 2L, 2L, "420000", admin, 0, 20).second());
        Assert.assertEquals(Integer.valueOf(1), query(1L, 12L, 4200000000L, null, 40L, true, 3L, 3L, null, admin, 0, 20).second());
        Assert.assertEquals(Integer.valueOf(0), query(2L, 11L, 4200000000L, null, null, true, 2L, 2L, null, admin, 0, 20).second());
        Assert.assertEquals(Integer.valueOf(0), query(1L, 10L, 4200000000L, null, null, true, null, null, null, admin, 0, 20).second());
        Assert.assertEquals(Integer.valueOf(0), query(1L, 11L, 4200000000L, 31L, null, true, 2L, 2L, null, admin, 0, 20).second());
        Assert.assertEquals(Integer.valueOf(0), query(1L, 12L, 4200000000L, null, 41L, true, 3L, 3L, null, admin, 0, 20).second());
        Assert.assertEquals(Integer.valueOf(0), query(1L, 11L, 4200000000L, null, null, true, 3L, 2L, null, admin, 0, 20).second());
        Assert.assertEquals(Integer.valueOf(0), query(1L, 11L, 4200000000L, null, null, true, 2L, 3L, null, admin, 0, 20).second());
        Assert.assertEquals(Integer.valueOf(0), query(1L, 11L, 4200000000L, null, null, true, 2L, 2L, "64512", admin, 0, 20).second());
    }

    @Test
    public void callerScopeStillIncludesFreeRowsAndOnlyPermittedAllocations() {
        for (Account.Type type : new Account.Type[] {Account.Type.NORMAL, Account.Type.PROJECT, Account.Type.DOMAIN_ADMIN, Account.Type.RESOURCE_DOMAIN_ADMIN}) {
            Account owner = caller(type, 2, 2);
            Assert.assertEquals(Integer.valueOf(3), query(null, null, 4200000000L, null, null, null, null, null, null, owner, 0, 20).second());
            Assert.assertEquals(Integer.valueOf(0), query(null, null, 4200000000L, null, null, true, 3L, 3L, null, owner, 0, 20).second());
        }
        Assert.assertEquals(Integer.valueOf(4), query(null, null, 4200000000L, null, null, null, null, null, null, caller(Account.Type.ADMIN, 1, 1), 0, 20).second());
    }

    @Test
    public void allocatedGuardUsesCurrentRowsAndHoldsMemberLocksUntilCommit() throws Exception {
        transaction.start();
        List<ASNumberVO> rows = dao.listAllocatedByASRange(11L);
        Assert.assertEquals(1, rows.size());
        Assert.assertEquals(Long.valueOf(30), rows.get(0).getNetworkId());
        try (Connection other = source.getConnection(); Statement sql = other.createStatement()) {
            sql.execute("SET LOCK_TIMEOUT 100");
            Assert.assertThrows(java.sql.SQLException.class, () -> sql.executeUpdate("UPDATE as_number SET network_id=31 WHERE as_number_range_id=11"));
            transaction.commit();
            Assert.assertEquals(1, sql.executeUpdate("UPDATE as_number SET network_id=31 WHERE as_number_range_id=11"));
        } finally { transaction.rollback(); }
    }
}
