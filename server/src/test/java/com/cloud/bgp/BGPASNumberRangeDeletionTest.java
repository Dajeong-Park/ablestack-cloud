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
import com.cloud.network.dao.NetworkVO;
import com.cloud.network.dao.NetworkDao;
import com.cloud.offering.NetworkOffering;
import com.cloud.offerings.NetworkOfferingVO;
import com.cloud.offerings.dao.NetworkOfferingDao;
import com.cloud.utils.db.TransactionLegacy;
import com.cloud.utils.exception.CloudRuntimeException;
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

/** Production transactions and JDBC row locks, without any ISP/network provisioning. */
public class BGPASNumberRangeDeletionTest {
    private final BGPServiceImpl service = new BGPServiceImpl();
    private final JdbcDataSource source = new JdbcDataSource();
    private final AtomicBoolean failRangeRemoval = new AtomicBoolean();
    private final AtomicBoolean failAllocation = new AtomicBoolean();
    private final AtomicBoolean pause = new AtomicBoolean();
    private final CountDownLatch locked = new CountDownLatch(1);
    private final CountDownLatch proceed = new CountDownLatch(1);
    private Object previousSource;
    private Field sourceField;

    @Before
    public void setup() throws Exception {
        source.setURL("jdbc:h2:mem:delete" + UUID.randomUUID() + ";MODE=MySQL;DB_CLOSE_DELAY=-1;LOCK_TIMEOUT=5000");
        try (Connection c = source.getConnection(); Statement s = c.createStatement()) {
            s.execute("CREATE TABLE zones(id BIGINT PRIMARY KEY)");
            s.execute("INSERT INTO zones VALUES(1)");
            s.execute("CREATE TABLE ranges(id BIGINT PRIMARY KEY, zone_id BIGINT, first_asn BIGINT, last_asn BIGINT)");
            s.execute("INSERT INTO ranges VALUES(10,1,64512,64513)");
            s.execute("CREATE TABLE members(id BIGINT PRIMARY KEY, range_id BIGINT, asn BIGINT, allocated BOOLEAN, network_id BIGINT, account_id BIGINT, domain_id BIGINT)");
            s.execute("INSERT INTO members VALUES(11,10,64512,FALSE,NULL,NULL,NULL),(12,10,64513,FALSE,NULL,NULL,NULL)");
            s.execute("CREATE TABLE linked_resources(id BIGINT PRIMARY KEY, name VARCHAR(80))");
            s.execute("INSERT INTO linked_resources VALUES(90,'existing-network'),(91,'existing-vpc')");
        }
        try (Connection c = source.getConnection(); Statement sql = c.createStatement()) { sql.execute("ALTER TABLE members ADD COLUMN zone_id BIGINT DEFAULT 1"); sql.execute("ALTER TABLE members ADD COLUMN vpc_id BIGINT"); }
        sourceField = TransactionLegacy.class.getDeclaredField("s_ds"); sourceField.setAccessible(true);
        previousSource = sourceField.get(null); sourceField.set(null, source);
        DataCenterDao zones = Mockito.mock(DataCenterDao.class);
        ASNumberRangeDao ranges = Mockito.mock(ASNumberRangeDao.class);
        ASNumberDao members = Mockito.mock(ASNumberDao.class);
        NetworkDao networks = Mockito.mock(NetworkDao.class);
        NetworkOfferingDao offerings = Mockito.mock(NetworkOfferingDao.class);
        ReflectionTestUtils.setField(service, "dataCenterDao", zones);
        ReflectionTestUtils.setField(service, "asNumberRangeDao", ranges);
        ReflectionTestUtils.setField(service, "asNumberDao", members);
        ReflectionTestUtils.setField(service, "networkDao", networks);
        ReflectionTestUtils.setField(service, "networkOfferingDao", offerings);
        NetworkVO network = Mockito.mock(NetworkVO.class);
        Mockito.when(network.getAccountId()).thenReturn(2L); Mockito.when(network.getDomainId()).thenReturn(1L);
        Mockito.when(network.getNetworkOfferingId()).thenReturn(5L);
        Mockito.when(networks.findById(Mockito.anyLong())).thenReturn(network);
        NetworkOfferingVO offering = Mockito.mock(NetworkOfferingVO.class);
        Mockito.when(offering.getRoutingMode()).thenReturn(NetworkOffering.RoutingMode.Dynamic);
        Mockito.when(offering.isSpecifyAsNumber()).thenReturn(true);
        Mockito.when(offerings.findById(5L)).thenReturn(offering);
        Mockito.when(zones.lockRow(1L, true)).thenAnswer(call -> {
            try (PreparedStatement s = connection().prepareStatement("SELECT id FROM zones WHERE id=1 FOR UPDATE"); ResultSet rs = s.executeQuery()) {
                Assert.assertTrue(rs.next());
            }
            if (pause.compareAndSet(true, false)) { locked.countDown(); Assert.assertTrue(proceed.await(5, TimeUnit.SECONDS)); }
            return Mockito.mock(DataCenterVO.class);
        });
        Mockito.when(ranges.findById(10L)).thenAnswer(call -> range(false));
        Mockito.when(ranges.lockRow(10L, true)).thenAnswer(call -> range(true));
        Mockito.when(members.listByZoneAndAsNumber(Mockito.anyLong(), Mockito.anyLong())).thenAnswer(call -> memberRows("zone_id=" + call.getArgument(0) + " AND asn=" + call.getArgument(1), false));
        Mockito.when(members.findByAsNumber(Mockito.anyLong())).thenAnswer(call -> {
            List<ASNumberVO> result = memberRows("asn=" + call.getArgument(0), false);
            return result.isEmpty() ? null : result.get(0);
        });
        Mockito.when(members.lockRow(Mockito.anyLong(), Mockito.eq(true))).thenAnswer(call -> {
            List<ASNumberVO> result = memberRows("id=" + call.getArgument(0), true);
            return result.isEmpty() ? null : result.get(0);
        });
        Mockito.when(members.listAllocatedByASRange(10L)).thenAnswer(call -> memberRows("range_id=10 AND allocated=TRUE", true));
        Mockito.when(members.update(Mockito.anyLong(), Mockito.any(ASNumberVO.class))).thenAnswer(call -> {
            ASNumberVO row = call.getArgument(1);
            try (PreparedStatement s = connection().prepareStatement("UPDATE members SET allocated=?,network_id=?,account_id=?,domain_id=?,vpc_id=? WHERE id=?")) {
                s.setBoolean(1, row.isAllocated()); s.setObject(2, row.getNetworkId()); s.setObject(3, row.getAccountId()); s.setObject(4, row.getDomainId()); s.setObject(5, row.getVpcId()); s.setLong(6, row.getId());
                s.executeUpdate();
            }
            return !failAllocation.get();
        });
        Mockito.when(members.removeASRangeNumbers(10L)).thenAnswer(call -> {
            try (Statement s = connection().createStatement()) { return s.executeUpdate("DELETE FROM members WHERE range_id=10"); }
        });
        Mockito.when(ranges.remove(10L)).thenAnswer(call -> {
            if (failRangeRemoval.get()) return false;
            try (Statement s = connection().createStatement()) { return s.executeUpdate("DELETE FROM ranges WHERE id=10") == 1; }
        });
    }

    private Connection connection() throws Exception { return TransactionLegacy.currentTxn().getConnection(); }

    private ASNumberRangeVO range(boolean lock) throws Exception {
        Connection c = lock ? connection() : source.getConnection();
        try (Statement s = c.createStatement(); ResultSet rs = s.executeQuery("SELECT * FROM ranges WHERE id=10" + (lock ? " FOR UPDATE" : ""))) {
            if (!rs.next()) return null;
            ASNumberRangeVO row = new ASNumberRangeVO(rs.getLong("zone_id"), rs.getLong("first_asn"), rs.getLong("last_asn"));
            ReflectionTestUtils.setField(row, "id", 10L); return row;
        } finally { if (!lock) c.close(); }
    }

    private List<ASNumberVO> memberRows(String where, boolean lock) throws Exception {
        List<ASNumberVO> rows = new ArrayList<>();
        try (Statement s = connection().createStatement(); ResultSet rs = s.executeQuery("SELECT * FROM members WHERE " + where + (lock ? " FOR UPDATE" : ""))) {
            while (rs.next()) {
                ASNumberVO row = new ASNumberVO(rs.getLong("asn"), rs.getLong("range_id"), rs.getLong("zone_id"));
                ReflectionTestUtils.setField(row, "id", rs.getLong("id")); row.setAllocated(rs.getBoolean("allocated"));
                row.setVpcId((Long)rs.getObject("vpc_id")); row.setNetworkId((Long)rs.getObject("network_id")); row.setAccountId((Long)rs.getObject("account_id")); row.setDomainId((Long)rs.getObject("domain_id")); rows.add(row);
            }
        }
        return rows;
    }

    private long scalar(String sql) throws Exception {
        try (Connection c = source.getConnection(); Statement s = c.createStatement(); ResultSet rs = s.executeQuery(sql)) { rs.next(); return rs.getLong(1); }
    }

    private void retained() throws Exception {
        Assert.assertEquals(1, scalar("SELECT COUNT(*) FROM ranges"));
        Assert.assertEquals(2, scalar("SELECT COUNT(*) FROM members"));
        Assert.assertEquals(2, scalar("SELECT COUNT(*) FROM linked_resources WHERE name IN ('existing-network','existing-vpc')"));
    }

    @After
    public void cleanup() throws Exception {
        org.apache.cloudstack.context.CallContext.unregister();
        proceed.countDown(); if (sourceField != null) sourceField.set(null, previousSource);
        try (Connection c = source.getConnection(); Statement s = c.createStatement()) { s.execute("SHUTDOWN"); }
    }

    @Test
    public void freeRangeAndAllMembersAreDeletedAtomically() throws Exception {
        Assert.assertTrue(service.deleteASRange(10L));
        Assert.assertEquals(0, scalar("SELECT COUNT(*) FROM ranges")); Assert.assertEquals(0, scalar("SELECT COUNT(*) FROM members"));
        Assert.assertEquals(2, scalar("SELECT COUNT(*) FROM linked_resources"));
        Assert.assertThrows(InvalidParameterValueException.class, () -> service.deleteASRange(10L));
    }

    @Test
    public void allocatedMemberProtectsWholeRangeAndOwnerLinks() throws Exception {
        Assert.assertTrue(service.allocateASNumber(1L, 64512L, 90L, null));
        Assert.assertThrows(InvalidParameterValueException.class, () -> service.deleteASRange(10L)); retained();
        Assert.assertEquals(1, scalar("SELECT COUNT(*) FROM members WHERE allocated=TRUE AND network_id=90 AND account_id=2 AND domain_id=1"));
    }

    @Test
    public void failedRangeRemovalRollsBackPreviouslyRemovedMembers() throws Exception {
        failRangeRemoval.set(true);
        Assert.assertThrows(CloudRuntimeException.class, () -> service.deleteASRange(10L)); retained();
    }

    @Test
    public void failedAllocationRollsBackOwnerAndAllocationChanges() throws Exception {
        failAllocation.set(true);
        Assert.assertThrows(CloudRuntimeException.class, () -> service.allocateASNumber(1L, 64512L, 90L, null)); retained();
        Assert.assertEquals(0, scalar("SELECT COUNT(*) FROM members WHERE allocated=TRUE OR network_id IS NOT NULL"));
    }

    @Test
    public void allocatedExplicitNumberCannotBeStolen() throws Exception {
        Assert.assertTrue(service.allocateASNumber(1L, 64512L, 90L, null));
        Assert.assertThrows(CloudRuntimeException.class, () -> service.allocateASNumber(1L, 64512L, 91L, null)); retained();
        Assert.assertEquals(1, scalar("SELECT COUNT(*) FROM members WHERE allocated=TRUE AND network_id=90"));
    }

    private void race(boolean allocationFirst) throws Exception {
        pause.set(true); ExecutorService threads = Executors.newFixedThreadPool(2);
        try {
            Future<Boolean> first = threads.submit(() -> allocationFirst ? service.allocateASNumber(1L, 64512L, 90L, null) : service.deleteASRange(10L));
            Assert.assertTrue(locked.await(5, TimeUnit.SECONDS));
            CountDownLatch started = new CountDownLatch(1);
            Future<Boolean> second = threads.submit(() -> {
                started.countDown();
                try { return allocationFirst ? service.deleteASRange(10L) : service.allocateASNumber(1L, 64512L, 90L, null); }
                catch (CloudRuntimeException e) { return false; }
            });
            Assert.assertTrue(started.await(5, TimeUnit.SECONDS)); proceed.countDown();
            Assert.assertTrue(first.get(10, TimeUnit.SECONDS)); Assert.assertFalse(second.get(10, TimeUnit.SECONDS));
            if (allocationFirst) retained();
            else { Assert.assertEquals(0, scalar("SELECT COUNT(*) FROM ranges")); Assert.assertEquals(0, scalar("SELECT COUNT(*) FROM members")); }
            Assert.assertEquals(2, scalar("SELECT COUNT(*) FROM linked_resources"));
        } finally { proceed.countDown(); threads.shutdownNow(); Assert.assertTrue(threads.awaitTermination(10, TimeUnit.SECONDS)); }
    }

    @Test
    public void allocationWinsAndDeletionRejects() throws Exception { race(true); }

    @Test
    public void deletionWinsAndAllocationCannotCreateAnOrphan() throws Exception { race(false); }

    private void releaseCaller(com.cloud.user.Account.Type type) {
        org.apache.cloudstack.context.CallContext.unregister();
        com.cloud.user.Account caller = Mockito.mock(com.cloud.user.Account.class);
        Mockito.when(caller.getId()).thenReturn(1L); Mockito.when(caller.getType()).thenReturn(type);
        org.apache.cloudstack.context.CallContext.register(Mockito.mock(com.cloud.user.User.class), caller);
    }

    private void releaseNetwork(boolean required) {
        NetworkDao networks = (NetworkDao) ReflectionTestUtils.getField(service, "networkDao");
        NetworkOfferingDao offerings = (NetworkOfferingDao) ReflectionTestUtils.getField(service, "networkOfferingDao");
        NetworkVO network = networks.findById(90L); NetworkOfferingVO offering = offerings.findById(5L);
        Mockito.when(network.getDataCenterId()).thenReturn(1L);
        Mockito.when(networks.lockRow(90L, true)).thenReturn(network);
        Mockito.when(offerings.lockRow(5L, true)).thenReturn(offering);
        Mockito.when(offering.isSpecifyAsNumber()).thenReturn(required);
    }

    @Test
    public void releaseAvailableAsnIsIdempotentAndNeverTouchesAnotherZone() throws Exception {
        releaseCaller(com.cloud.user.Account.Type.ADMIN);
        try (Connection c = source.getConnection(); Statement sql = c.createStatement()) {
            sql.execute("INSERT INTO members(id,range_id,asn,allocated,zone_id,network_id) VALUES(21,20,64512,TRUE,2,91)");
        }
        Assert.assertTrue(service.releaseASNumber(1, 64512, false).first());
        Assert.assertTrue(service.releaseASNumber(1, 64512, false).first());
        Assert.assertEquals(1, scalar("SELECT COUNT(*) FROM members WHERE zone_id=2 AND allocated=TRUE AND network_id=91"));
        ASNumberDao members = (ASNumberDao) ReflectionTestUtils.getField(service, "asNumberDao");
        Mockito.verify(members, Mockito.never()).findByAsNumber(Mockito.anyLong());
    }

    @Test
    public void releaseUsesLatestOfferingAndClearsAllOwnerLinks() throws Exception {
        Assert.assertTrue(service.allocateASNumber(1L, 64512L, 90L, null));
        releaseCaller(com.cloud.user.Account.Type.ADMIN); releaseNetwork(true);
        Assert.assertThrows(InvalidParameterValueException.class, () -> service.releaseASNumber(1, 64512, false));
        Assert.assertEquals(1, scalar("SELECT COUNT(*) FROM members WHERE allocated=TRUE AND network_id=90"));
        releaseNetwork(false);
        Assert.assertTrue(service.releaseASNumber(1, 64512, false).first());
        Assert.assertEquals(0, scalar("SELECT COUNT(*) FROM members WHERE allocated=TRUE OR network_id IS NOT NULL OR account_id IS NOT NULL OR domain_id IS NOT NULL OR vpc_id IS NOT NULL"));
        retained();
    }

    @Test
    public void missingReferenceAndDuplicateTargetFailClosed() throws Exception {
        releaseCaller(com.cloud.user.Account.Type.ADMIN);
        try (Connection c = source.getConnection(); Statement sql = c.createStatement()) { sql.execute("UPDATE members SET allocated=TRUE,network_id=999 WHERE id=11"); }
        Assert.assertThrows(InvalidParameterValueException.class, () -> service.releaseASNumber(1, 64512, false));
        try (Connection c = source.getConnection(); Statement sql = c.createStatement()) { sql.execute("INSERT INTO members(id,range_id,asn,allocated) VALUES(13,10,64512,FALSE)"); }
        Assert.assertThrows(InvalidParameterValueException.class, () -> service.releaseASNumber(1, 64512, false));
        Assert.assertEquals(1, scalar("SELECT COUNT(*) FROM members WHERE network_id=999 AND allocated=TRUE"));
    }

    @Test
    public void vpcRequiresTheSamePolicyAndReleaseCanBeRejectedOrAllowed() throws Exception {
        releaseCaller(com.cloud.user.Account.Type.ADMIN);
        try (Connection c = source.getConnection(); Statement sql = c.createStatement()) { sql.execute("UPDATE members SET allocated=TRUE,vpc_id=91,account_id=2,domain_id=1 WHERE id=11"); }
        com.cloud.network.vpc.dao.VpcDao vpcs = Mockito.mock(com.cloud.network.vpc.dao.VpcDao.class);
        com.cloud.network.vpc.dao.VpcOfferingDao offerings = Mockito.mock(com.cloud.network.vpc.dao.VpcOfferingDao.class);
        com.cloud.network.vpc.VpcVO vpc = Mockito.mock(com.cloud.network.vpc.VpcVO.class);
        com.cloud.network.vpc.VpcOfferingVO offering = Mockito.mock(com.cloud.network.vpc.VpcOfferingVO.class);
        Mockito.when(vpc.getZoneId()).thenReturn(1L); Mockito.when(vpc.getVpcOfferingId()).thenReturn(5L);
        Mockito.when(vpcs.lockRow(91L, true)).thenReturn(vpc); Mockito.when(offerings.lockRow(5L, true)).thenReturn(offering);
        ReflectionTestUtils.setField(service, "vpcDao", vpcs); ReflectionTestUtils.setField(service, "vpcOfferingDao", offerings);
        Mockito.when(offering.isSpecifyAsNumber()).thenReturn(true);
        Assert.assertThrows(InvalidParameterValueException.class, () -> service.releaseASNumber(1, 64512, false));
        Mockito.when(offering.isSpecifyAsNumber()).thenReturn(false);
        Assert.assertTrue(service.releaseASNumber(1, 64512, false).first());
        Assert.assertEquals(0, scalar("SELECT COUNT(*) FROM members WHERE vpc_id IS NOT NULL OR allocated=TRUE"));
    }

    @Test
    public void nonAdminAndChangedLockedRowCannotRelease() throws Exception {
        releaseCaller(com.cloud.user.Account.Type.NORMAL);
        Assert.assertThrows(com.cloud.exception.PermissionDeniedException.class, () -> service.releaseASNumber(1, 64512, false));
        releaseCaller(com.cloud.user.Account.Type.ADMIN);
        ASNumberDao members = (ASNumberDao) ReflectionTestUtils.getField(service, "asNumberDao");
        ASNumberVO wrong = new ASNumberVO(64512L, 10L, 2L);
        ReflectionTestUtils.setField(wrong, "id", 11L); Mockito.when(members.lockRow(11L, true)).thenReturn(wrong);
        Assert.assertThrows(InvalidParameterValueException.class, () -> service.releaseASNumber(1, 64512, false));
        retained();
    }

    @Test
    public void failedReleaseRollsBackTheAllocationAndOwner() throws Exception {
        Assert.assertTrue(service.allocateASNumber(1L, 64512L, 90L, null));
        releaseCaller(com.cloud.user.Account.Type.ADMIN); releaseNetwork(false); failAllocation.set(true);
        Assert.assertThrows(CloudRuntimeException.class, () -> service.releaseASNumber(1, 64512, false));
        Assert.assertEquals(1, scalar("SELECT COUNT(*) FROM members WHERE allocated=TRUE AND network_id=90 AND account_id=2 AND domain_id=1"));
    }

    @Test
    public void releaseThenDeleteSerializesUnderTheZoneLock() throws Exception {
        Assert.assertTrue(service.allocateASNumber(1L, 64512L, 90L, null)); releaseNetwork(false);
        pause.set(true); ExecutorService threads = Executors.newFixedThreadPool(2);
        try {
            Future<Boolean> release = threads.submit(() -> { releaseCaller(com.cloud.user.Account.Type.ADMIN); try { return service.releaseASNumber(1, 64512, false).first(); } finally { org.apache.cloudstack.context.CallContext.unregister(); } });
            Assert.assertTrue(locked.await(5, TimeUnit.SECONDS));
            Future<Boolean> delete = threads.submit(() -> service.deleteASRange(10));
            proceed.countDown(); Assert.assertTrue(release.get(10, TimeUnit.SECONDS)); Assert.assertTrue(delete.get(10, TimeUnit.SECONDS));
            Assert.assertEquals(0, scalar("SELECT COUNT(*) FROM members")); Assert.assertEquals(2, scalar("SELECT COUNT(*) FROM linked_resources"));
        } finally { proceed.countDown(); threads.shutdownNow(); Assert.assertTrue(threads.awaitTermination(10, TimeUnit.SECONDS)); }
    }

    @Test
    public void releaseWaitsForAllocationAndRejectsItsRequiredOffering() throws Exception {
        releaseNetwork(true); pause.set(true); ExecutorService threads = Executors.newFixedThreadPool(2);
        try {
            Future<Boolean> allocation = threads.submit(() -> service.allocateASNumber(1L, 64512L, 90L, null));
            Assert.assertTrue(locked.await(5, TimeUnit.SECONDS));
            Future<Boolean> release = threads.submit(() -> { releaseCaller(com.cloud.user.Account.Type.ADMIN); try { return service.releaseASNumber(1, 64512, false).first(); } catch (InvalidParameterValueException expected) { return false; } finally { org.apache.cloudstack.context.CallContext.unregister(); } });
            proceed.countDown(); Assert.assertTrue(allocation.get(10, TimeUnit.SECONDS)); Assert.assertFalse(release.get(10, TimeUnit.SECONDS));
            Assert.assertEquals(1, scalar("SELECT COUNT(*) FROM members WHERE allocated=TRUE AND network_id=90"));
        } finally { proceed.countDown(); threads.shutdownNow(); Assert.assertTrue(threads.awaitTermination(10, TimeUnit.SECONDS)); }
    }
}
