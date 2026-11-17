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
package com.cloud.bgp;

import com.cloud.dc.ASNumberRangeVO;
import com.cloud.dc.ASNumberVO;
import com.cloud.dc.DataCenterVO;
import com.cloud.dc.dao.ASNumberDao;
import com.cloud.dc.dao.ASNumberRangeDao;
import com.cloud.dc.dao.DataCenterDao;
import com.cloud.exception.InvalidParameterValueException;
import com.cloud.utils.db.TransactionLegacy;
import com.cloud.utils.exception.CloudRuntimeException;
import org.apache.cloudstack.network.RoutedIpv4Manager;
import org.h2.jdbcx.JdbcDataSource;
import org.junit.After;
import org.junit.Assert;
import org.junit.Before;
import org.junit.Test;
import org.mockito.Mockito;
import org.springframework.test.util.ReflectionTestUtils;

import java.lang.reflect.Field;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

/** Real production Transaction boundaries and JDBC row locks, with minimal DAO SQL adapters. */
public class BGPASNumberRangeTransactionTest {
    private final BGPServiceImpl service = new BGPServiceImpl();
    private final JdbcDataSource source = new JdbcDataSource();
    private final AtomicBoolean failMember = new AtomicBoolean();
    private Object previousSource;
    private Field dataSourceField;

    @Before
    public void setup() throws Exception {
        source.setURL("jdbc:h2:mem:asn" + UUID.randomUUID() + ";MODE=MySQL;DB_CLOSE_DELAY=-1;LOCK_TIMEOUT=5000");
        try (Connection c = source.getConnection(); Statement s = c.createStatement()) {
            s.execute("CREATE TABLE zones (id BIGINT PRIMARY KEY)");
            s.execute("INSERT INTO zones VALUES (1), (2)");
            s.execute("CREATE TABLE ranges (id BIGINT AUTO_INCREMENT PRIMARY KEY, zone_id BIGINT, first_asn BIGINT, last_asn BIGINT)");
            s.execute("CREATE TABLE members (range_id BIGINT, asn BIGINT)");
        }
        dataSourceField = TransactionLegacy.class.getDeclaredField("s_ds");
        dataSourceField.setAccessible(true);
        previousSource = dataSourceField.get(null);
        dataSourceField.set(null, source);
        DataCenterDao zones = Mockito.mock(DataCenterDao.class);
        ASNumberRangeDao ranges = Mockito.mock(ASNumberRangeDao.class);
        ASNumberDao members = Mockito.mock(ASNumberDao.class);
        RoutedIpv4Manager routed = Mockito.mock(RoutedIpv4Manager.class);
        ReflectionTestUtils.setField(service, "dataCenterDao", zones);
        ReflectionTestUtils.setField(service, "asNumberRangeDao", ranges);
        ReflectionTestUtils.setField(service, "asNumberDao", members);
        ReflectionTestUtils.setField(service, "routedIpv4Manager", routed);
        Mockito.when(zones.findById(Mockito.anyLong())).thenReturn(Mockito.mock(DataCenterVO.class));
        Mockito.when(routed.isRoutedNetworkVpcEnabled(Mockito.anyLong())).thenReturn(true);
        Mockito.when(zones.lockRow(Mockito.anyLong(), Mockito.eq(true))).thenAnswer(call -> {
            try (PreparedStatement s = connection().prepareStatement("SELECT id FROM zones WHERE id=? FOR UPDATE")) {
                s.setLong(1, call.getArgument(0));
                try (ResultSet rs = s.executeQuery()) { return rs.next() ? Mockito.mock(DataCenterVO.class) : null; }
            }
        });
        Mockito.when(ranges.listByZoneId(Mockito.anyLong())).thenAnswer(call -> {
            List<ASNumberRangeVO> rows = new ArrayList<>();
            try (PreparedStatement s = connection().prepareStatement("SELECT * FROM ranges WHERE zone_id=?")) {
                s.setLong(1, call.getArgument(0));
                try (ResultSet rs = s.executeQuery()) {
                    while (rs.next()) {
                        ASNumberRangeVO row = new ASNumberRangeVO(rs.getLong("zone_id"), rs.getLong("first_asn"), rs.getLong("last_asn"));
                        ReflectionTestUtils.setField(row, "id", rs.getLong("id"));
                        rows.add(row);
                    }
                }
            }
            return rows;
        });
        Mockito.when(ranges.persist(Mockito.any(ASNumberRangeVO.class))).thenAnswer(call -> {
            ASNumberRangeVO row = call.getArgument(0);
            try (PreparedStatement s = connection().prepareStatement("INSERT INTO ranges(zone_id,first_asn,last_asn) VALUES (?,?,?)", Statement.RETURN_GENERATED_KEYS)) {
                s.setLong(1, row.getDataCenterId()); s.setLong(2, row.getStartASNumber()); s.setLong(3, row.getEndASNumber()); s.executeUpdate();
                try (ResultSet rs = s.getGeneratedKeys()) { rs.next(); ReflectionTestUtils.setField(row, "id", rs.getLong(1)); }
            }
            return row;
        });
        Mockito.when(members.persist(Mockito.any(ASNumberVO.class))).thenAnswer(call -> {
            ASNumberVO row = call.getArgument(0);
            if (failMember.get() && row.getAsNumber() == 64513) throw new IllegalStateException("Injected second member failure");
            try (PreparedStatement s = connection().prepareStatement("INSERT INTO members(range_id,asn) VALUES (?,?)")) {
                s.setLong(1, row.getAsNumberRangeId()); s.setLong(2, row.getAsNumber()); s.executeUpdate();
            }
            return row;
        });
    }

    private Connection connection() throws Exception { return TransactionLegacy.currentTxn().getConnection(); }

    @After
    public void cleanup() throws Exception {
        if (dataSourceField != null) dataSourceField.set(null, previousSource);
        try (Connection c = source.getConnection(); Statement s = c.createStatement()) { s.execute("SHUTDOWN"); }
    }

    private long count(String table) throws Exception {
        try (Connection c = source.getConnection(); Statement s = c.createStatement(); ResultSet rs = s.executeQuery("SELECT COUNT(*) FROM " + table)) {
            rs.next(); return rs.getLong(1);
        }
    }

    @Test
    public void failedMemberRollsBackRangeAndEarlierMembers() throws Exception {
        failMember.set(true);
        Assert.assertThrows(CloudRuntimeException.class, () -> service.createASNumberRange(1L, 64512, 64514));
        Assert.assertEquals(0, count("ranges")); Assert.assertEquals(0, count("members"));
        failMember.set(false);
        service.createASNumberRange(1L, 64512, 64514);
        Assert.assertEquals(1, count("ranges")); Assert.assertEquals(3, count("members"));
    }

    @Test
    public void thousandMembersCommitAndThousandAndOneIsRejected() throws Exception {
        service.createASNumberRange(1L, 100000, 100999);
        Assert.assertEquals(1000, count("members"));
        Assert.assertThrows(InvalidParameterValueException.class, () -> service.createASNumberRange(1L, 200000, 201000));
        Assert.assertEquals(1, count("ranges")); Assert.assertEquals(1000, count("members"));
    }

    @Test
    public void concurrentOverlapsSerializeOnZoneRow() throws Exception {
        ExecutorService threads = Executors.newFixedThreadPool(2);
        CountDownLatch ready = new CountDownLatch(2); CountDownLatch start = new CountDownLatch(1);
        List<Future<Boolean>> attempts = new ArrayList<>();
        try {
            for (int i = 0; i < 2; i++) {
                final int offset = i;
                attempts.add(threads.submit(() -> {
                    ready.countDown(); Assert.assertTrue(start.await(5, TimeUnit.SECONDS));
                    try { service.createASNumberRange(1L, 64512 + offset, 64514 + offset); return true; }
                    catch (InvalidParameterValueException expected) { return false; }
                }));
            }
            Assert.assertTrue(ready.await(5, TimeUnit.SECONDS)); start.countDown();
            int successes = 0;
            for (Future<Boolean> attempt : attempts) if (attempt.get(10, TimeUnit.SECONDS)) successes++;
            Assert.assertEquals(1, successes); Assert.assertEquals(1, count("ranges")); Assert.assertEquals(3, count("members"));
        } finally { start.countDown(); threads.shutdownNow(); Assert.assertTrue(threads.awaitTermination(10, TimeUnit.SECONDS)); }
    }

    @Test
    public void sameNumbersInDifferentZonesRemainIndependent() throws Exception {
        service.createASNumberRange(1L, 4200000000L, 4200000002L);
        service.createASNumberRange(2L, 4200000000L, 4200000002L);
        Assert.assertEquals(2, count("ranges")); Assert.assertEquals(6, count("members"));
    }
}
