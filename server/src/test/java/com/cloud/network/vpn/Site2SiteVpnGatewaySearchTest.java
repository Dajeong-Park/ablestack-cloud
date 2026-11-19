/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
package com.cloud.network.vpn;

import com.cloud.network.dao.IPAddressDaoImpl;
import com.cloud.network.dao.Site2SiteVpnGatewayDaoImpl;
import com.cloud.network.dao.Site2SiteVpnGatewayVO;
import com.cloud.network.vpc.dao.VpcDaoImpl;
import com.cloud.utils.Pair;
import com.cloud.utils.db.Filter;
import com.cloud.utils.db.SearchBuilder;
import com.cloud.utils.db.SearchCriteria;
import com.cloud.utils.db.TransactionLegacy;
import org.h2.jdbcx.JdbcDataSource;
import org.junit.After;
import org.junit.Assert;
import org.junit.Before;
import org.junit.Test;

import java.lang.reflect.Field;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.Statement;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

/** Exercises the production GenericDao SQL, parameter binding, count and paging on an isolated database. */
public class Site2SiteVpnGatewaySearchTest {
    static class Gateways extends Site2SiteVpnGatewayDaoImpl { }
    static class Vpcs extends VpcDaoImpl { }
    private final JdbcDataSource source = new JdbcDataSource();
    private Gateways gateways;
    private IPAddressDaoImpl addresses;
    private Vpcs vpcs;
    private Field sourceField;
    private Object previousSource;
    private TransactionLegacy transaction;

    @Before
    public void open() throws Exception {
        source.setURL("jdbc:h2:mem:s2s" + UUID.randomUUID() + ";MODE=MySQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1");
        sourceField = TransactionLegacy.class.getDeclaredField("s_ds");
        sourceField.setAccessible(true);
        previousSource = sourceField.get(null);
        sourceField.set(null, source);
        transaction = TransactionLegacy.open(TransactionLegacy.CLOUD_DB);
        gateways = new Gateways();
        addresses = new IPAddressDaoImpl();
        vpcs = new Vpcs();
        try (Connection c = source.getConnection(); Statement s = c.createStatement()) {
            s.execute("CREATE TABLE s2s_vpn_gateway (id BIGINT PRIMARY KEY, uuid VARCHAR_IGNORECASE(255), addr_id BIGINT, "
                    + "vpc_id BIGINT, domain_id BIGINT, account_id BIGINT, removed TIMESTAMP, display BOOLEAN)");
            s.execute("CREATE TABLE user_ip_address (id BIGINT PRIMARY KEY, public_ip_address VARCHAR(40))");
            s.execute("CREATE TABLE vpc (id BIGINT PRIMARY KEY, name VARCHAR_IGNORECASE(255))");
        }
        insert(1, "AAA-GATEWAY", "192.0.2.10", "서울_Mix%Site", 1, 10, true, false);
        insert(2, "BBB-GATEWAY", "192.0.2.11", "SeoulXMixZSite", 1, 10, true, false);
        insert(3, "FOREIGN-GATEWAY", "198.51.100.10", "서울_Mix%Site", 2, 20, true, false);
        insert(4, "ORPHAN-GATEWAY", null, null, 1, 10, true, false);
        insert(5, "REMOVED-GATEWAY", "192.0.2.12", "서울_Mix%Site", 1, 10, true, true);
        insert(6, "OTHER-DOMAIN", "192.0.2.13", "서울_Mix%Site", 1, 11, true, false);
        insert(7, "HIDDEN-GATEWAY", "192.0.2.14", "서울_Mix%Site", 1, 10, false, false);
        insert(8, "ESCAPE-GATEWAY", "192.0.2.15", "quote'\\%_한글", 1, 10, true, false);
    }

    @After
    public void close() throws Exception {
        if (transaction != null) transaction.close();
        if (sourceField != null) sourceField.set(null, previousSource);
    }

    private void insert(long id, String uuid, String ip, String name, long account, long domain, boolean display, boolean removed) throws Exception {
        try (Connection c = source.getConnection()) {
            if (ip != null) {
                try (PreparedStatement p = c.prepareStatement("INSERT INTO user_ip_address VALUES (?,?)")) {
                    p.setLong(1, id); p.setString(2, ip); p.executeUpdate();
                }
            }
            if (name != null) {
                try (PreparedStatement p = c.prepareStatement("INSERT INTO vpc VALUES (?,?)")) {
                    p.setLong(1, id); p.setString(2, name); p.executeUpdate();
                }
            }
            try (PreparedStatement p = c.prepareStatement("INSERT INTO s2s_vpn_gateway VALUES (?,?,?,?,?,?,?,?)")) {
                p.setLong(1, id); p.setString(2, uuid); p.setLong(3, id); p.setLong(4, id);
                p.setLong(5, domain); p.setLong(6, account);
                p.setTimestamp(7, removed ? new java.sql.Timestamp(System.currentTimeMillis()) : null);
                p.setBoolean(8, display); p.executeUpdate();
            }
        }
    }

    private Pair<List<Site2SiteVpnGatewayVO>, Integer> query(String keyword, Long id, Long vpc, long start, long size) {
        SearchBuilder<Site2SiteVpnGatewayVO> builder = gateways.createSearchBuilder();
        builder.and("owner", builder.entity().getAccountId(), SearchCriteria.Op.EQ);
        builder.and("domain", builder.entity().getDomainId(), SearchCriteria.Op.EQ);
        builder.and("display", builder.entity().isDisplay(), SearchCriteria.Op.EQ);
        SearchCriteria<Site2SiteVpnGatewayVO> group = Site2SiteVpnGatewaySearch.keyword(builder, gateways, addresses, vpcs, keyword);
        SearchCriteria<Site2SiteVpnGatewayVO> sc = builder.create();
        sc.setParameters("owner", 1L); sc.setParameters("domain", 10L); sc.setParameters("display", true);
        if (id != null) sc.addAnd("id", SearchCriteria.Op.EQ, id);
        if (vpc != null) sc.addAnd("vpcId", SearchCriteria.Op.EQ, vpc);
        if (group != null) sc.addAnd("id", SearchCriteria.Op.SC, group);
        return gateways.searchAndCount(sc, new Filter(Site2SiteVpnGatewayVO.class, "id", false, start, size));
    }

    private void ids(String keyword, Long... expected) {
        Pair<List<Site2SiteVpnGatewayVO>, Integer> result = query(keyword, null, null, 0, 100);
        Assert.assertEquals(List.of(expected), result.first().stream().map(Site2SiteVpnGatewayVO::getId).collect(Collectors.toList()));
        Assert.assertEquals(expected.length, result.second().intValue());
    }

    @Test public void matchesIpUuidUnicodeAndCaseWithoutCrossingOwnerScope() {
        ids("192.0.2.10", 1L); ids("aaa-gateway", 1L); ids("  서울_mix%site  ", 1L);
        ids("FOREIGN-GATEWAY"); ids("OTHER-DOMAIN"); ids("HIDDEN-GATEWAY"); ids("REMOVED-GATEWAY");
    }
    @Test public void treatsPercentUnderscoreBackslashAndQuotesAsLiteralData() {
        ids("%", 8L, 1L); ids("_", 8L, 1L); ids("\\%_한글", 8L); ids("' OR 1=1 --");
    }
    @Test public void keepsUuidSearchForMissingReferencesAndEmptySearchSemantics() {
        ids("orphan", 4L); ids("missing"); ids("   ", 8L, 4L, 2L, 1L); ids(null, 8L, 4L, 2L, 1L);
    }
    @Test public void combinesExactFiltersWithKeywordAndUsesSameCountForEachPage() {
        Assert.assertEquals(0, query("aaa", 2L, null, 0, 10).second().intValue());
        Assert.assertEquals(0, query("aaa", null, 2L, 0, 10).second().intValue());
        Pair<List<Site2SiteVpnGatewayVO>, Integer> first = query("192.0.2.1", null, null, 0, 1);
        Pair<List<Site2SiteVpnGatewayVO>, Integer> second = query("192.0.2.1", null, null, 1, 1);
        Assert.assertEquals(3, first.second().intValue()); Assert.assertEquals(first.second(), second.second());
        Assert.assertEquals(8L, first.first().get(0).getId()); Assert.assertEquals(2L, second.first().get(0).getId());
    }
}
