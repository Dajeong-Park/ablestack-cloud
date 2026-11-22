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

import java.lang.reflect.Field;
import java.sql.Connection;
import java.sql.Statement;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

import org.apache.cloudstack.api.command.user.vpn.ListVpnCustomerGatewaysCmd;
import org.apache.cloudstack.api.command.user.vpn.ListVpnConnectionsCmd;
import org.apache.cloudstack.context.CallContext;
import org.h2.jdbcx.JdbcDataSource;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;

import com.cloud.exception.InvalidParameterValueException;
import com.cloud.network.Site2SiteCustomerGateway;
import com.cloud.network.Site2SiteVpnConnection;
import com.cloud.network.dao.IPAddressDaoImpl;
import com.cloud.network.dao.Site2SiteCustomerGatewayDaoImpl;
import com.cloud.network.dao.Site2SiteVpnConnectionDaoImpl;
import com.cloud.network.dao.Site2SiteVpnGatewayDaoImpl;
import com.cloud.user.Account;
import com.cloud.user.AccountManager;
import com.cloud.user.AccountVO;
import com.cloud.user.UserVO;
import com.cloud.utils.Pair;
import com.cloud.utils.db.SearchCriteria;
import com.cloud.utils.db.TransactionLegacy;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.ArgumentMatchers.nullable;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

public class Site2SiteVpnConnectionSearchTest {
    static class Gateways extends Site2SiteVpnGatewayDaoImpl {
    }

    static class CustomerGateways extends Site2SiteCustomerGatewayDaoImpl {
    }

    private final Site2SiteVpnManagerImpl manager = new Site2SiteVpnManagerImpl();
    private Field dataSourceField;
    private Object previousSource;
    private TransactionLegacy transaction;
    private AccountVO account;

    @Before
    public void openDatabase() throws Exception {
        JdbcDataSource source = new JdbcDataSource();
        source.setURL("jdbc:h2:mem:conn" + UUID.randomUUID() + ";MODE=MySQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1");
        dataSourceField = TransactionLegacy.class.getDeclaredField("s_ds");
        dataSourceField.setAccessible(true);
        previousSource = dataSourceField.get(null);
        dataSourceField.set(null, source);
        transaction = TransactionLegacy.open(TransactionLegacy.CLOUD_DB);
        try (Connection connection = source.getConnection(); Statement sql = connection.createStatement()) {
            sql.execute("CREATE TABLE s2s_vpn_connection (id BIGINT PRIMARY KEY, uuid VARCHAR_IGNORECASE(255), vpn_gateway_id BIGINT, "
                    + "customer_gateway_id BIGINT, state VARCHAR(32), domain_id BIGINT, account_id BIGINT, created TIMESTAMP, "
                    + "removed TIMESTAMP, passive BOOLEAN, display BOOLEAN)");
            sql.execute("CREATE TABLE s2s_vpn_gateway (id BIGINT PRIMARY KEY, addr_id BIGINT, vpc_id BIGINT)");
            sql.execute("CREATE TABLE s2s_customer_gateway (id BIGINT PRIMARY KEY, gateway_ip VARCHAR_IGNORECASE(255), "
                    + "uuid VARCHAR_IGNORECASE(255), name VARCHAR_IGNORECASE(255), domain_id BIGINT, account_id BIGINT, removed TIMESTAMP, "
                    + "guest_cidr_list VARCHAR(255), ipsec_psk VARCHAR(255), ike_policy VARCHAR(255), esp_policy VARCHAR(255), "
                    + "ike_lifetime BIGINT DEFAULT 86400, esp_lifetime BIGINT DEFAULT 3600, dpd BOOLEAN DEFAULT FALSE, "
                    + "force_encap BOOLEAN DEFAULT FALSE, split_connections BOOLEAN DEFAULT FALSE, ike_version VARCHAR(10))");
            sql.execute("CREATE TABLE user_ip_address (id BIGINT PRIMARY KEY, public_ip_address VARCHAR(40))");
            sql.execute("INSERT INTO s2s_vpn_gateway VALUES (1, 1, 50), (2, 2, 60)");
            sql.execute("INSERT INTO user_ip_address VALUES (1, '192.0.2.10'), (2, '198.51.100.10')");
            sql.execute("INSERT INTO s2s_customer_gateway (id, gateway_ip, uuid, name, domain_id, account_id, removed) VALUES "
                    + "(1, 'peer-a.example', 'cgw-one', 'fixture-alpha', 10, 100, NULL),"
                    + "(2, 'peer_b.example', 'cgw-two', 'fixture-beta', 10, 100, NULL),"
                    + "(3, 'peer-c.example', 'cgw-prior', 'fixture-removed', 10, 100, CURRENT_TIMESTAMP),"
                    + "(4, 'peer-d.example', 'cgw-other', 'fixture-other', 10, 200, NULL)");
            sql.execute("INSERT INTO s2s_vpn_connection VALUES "
                    + "(1, 'one', 1, 1, 'Connected', 10, 100, NULL, NULL, FALSE, TRUE),"
                    + "(2, 'two', 2, 2, 'Connected', 10, 100, NULL, NULL, FALSE, TRUE),"
                    + "(3, 'three', 1, 1, 'Connected', 10, 200, NULL, NULL, FALSE, TRUE),"
                    + "(4, 'four', 1, 1, 'Connected', 10, 100, NULL, CURRENT_TIMESTAMP, FALSE, TRUE),"
                    + "(5, 'five', 1, 1, 'Disconnected', 10, 100, NULL, NULL, FALSE, FALSE),"
                    + "(6, 'orphan', 20, 20, 'Disconnected', 10, 100, NULL, NULL, FALSE, TRUE)");
        }
        account = new AccountVO("test", 10L, "ROOT", Account.Type.NORMAL, UUID.randomUUID().toString());
        account.setId(100L);
        CallContext.register(new UserVO(100L, "tester", "test-only", "Test", "User", "test@example.invalid", "UTC",
                UUID.randomUUID().toString(), com.cloud.user.User.Source.UNKNOWN), account);
        manager._vpnConnectionDao = new Site2SiteVpnConnectionDaoImpl();
        manager._vpnGatewayDao = new Gateways();
        manager._customerGatewayDao = new CustomerGateways();
        manager._ipAddressDao = new IPAddressDaoImpl();
        manager._accountMgr = mock(AccountManager.class);
        doAnswer(call -> {
            SearchCriteria<?> criteria = call.getArgument(0);
            criteria.addAnd("accountId", SearchCriteria.Op.EQ, 100L);
            return null;
        }).when(manager._accountMgr).buildACLSearchCriteria(any(), nullable(Long.class), anyBoolean(), anyList(), any());
    }

    @After
    public void restoreDatabase() throws Exception {
        CallContext.unregister();
        if (transaction != null) {
            transaction.close();
        }
        if (dataSourceField != null) {
            dataSourceField.set(null, previousSource);
        }
    }

    private ListVpnConnectionsCmd command(String keyword, Long id, Long vpc, long start, long size) {
        ListVpnConnectionsCmd cmd = mock(ListVpnConnectionsCmd.class);
        when(cmd.getKeyword()).thenReturn(keyword);
        when(cmd.getId()).thenReturn(id);
        when(cmd.getDomainId()).thenReturn(null);
        when(cmd.getProjectId()).thenReturn(null);
        when(cmd.getVpcId()).thenReturn(vpc);
        when(cmd.getDisplay()).thenReturn(true);
        when(cmd.listAll()).thenReturn(true);
        when(cmd.getStartIndex()).thenReturn(start);
        when(cmd.getPageSizeVal()).thenReturn(size);
        return cmd;
    }

    private void matches(ListVpnConnectionsCmd cmd, int count, String... ids) {
        Pair<List<? extends Site2SiteVpnConnection>, Integer> found = manager.searchForVpnConnections(cmd);
        assertEquals(List.of(ids), found.first().stream().map(Site2SiteVpnConnection::getUuid).collect(Collectors.toList()));
        assertEquals(Integer.valueOf(count), found.second());
    }

    private void customerMatches(String keyword, Long id, long start, long size, int count, String... uuids) {
        ListVpnCustomerGatewaysCmd cmd = mock(ListVpnCustomerGatewaysCmd.class);
        when(cmd.getKeyword()).thenReturn(keyword);
        when(cmd.getId()).thenReturn(id);
        when(cmd.listAll()).thenReturn(true);
        when(cmd.getStartIndex()).thenReturn(start);
        when(cmd.getPageSizeVal()).thenReturn(size);
        Pair<List<? extends Site2SiteCustomerGateway>, Integer> found = manager.searchForCustomerGateways(cmd);
        assertEquals(List.of(uuids), found.first().stream().map(Site2SiteCustomerGateway::getUuid).collect(Collectors.toList()));
        assertEquals(Integer.valueOf(count), found.second());
    }

    @Test
    public void customerKeywordsPreserveRemovalAndOwnershipForListsAndCounts() {
        customerMatches("fixture", null, 0, 1, 2, "cgw-two");
        customerMatches("fixture", null, 1, 1, 2, "cgw-one");
        customerMatches(" cgw-one ", null, 0, 20, 1, "cgw-one");
        customerMatches("fixture-removed", null, 0, 20, 0);
        customerMatches("cgw-prior", null, 0, 20, 0);
        customerMatches("fixture-other", null, 0, 20, 0);
        customerMatches("cgw-other", null, 0, 20, 0);
        customerMatches("fixture", 1L, 0, 20, 1, "cgw-one");
        customerMatches("fixture-beta", 1L, 0, 20, 0);
    }

    @Test
    public void matchesEitherEndpointOrUuidWithinTheScope() {
        matches(command(" 192.0.2. ", null, null, 0, 20), 1, "one");
        matches(command("peer-a", null, null, 0, 20), 1, "one");
        matches(command("ORPH", null, null, 0, 20), 1, "orphan");
        matches(command("unknown", null, null, 0, 20), 0);
        matches(command("%", null, null, 0, 20), 0);
        matches(command("_", null, null, 0, 20), 1, "two");
    }

    @Test
    public void combinesExactFiltersAndCountsBeforePaging() {
        matches(command("peer", 1L, 50L, 0, 20), 1, "one");
        matches(command("peer", 1L, 60L, 0, 20), 0);
        matches(command("peer", null, null, 0, 1), 2, "two");
        matches(command("peer", null, null, 1, 1), 2, "one");
        matches(command("   ", null, 60L, 0, 20), 1, "two");
    }

    @Test
    public void includesHiddenRowsWithinAclAndAppliesDisplayBeforeCountingAndPaging() {
        ListVpnConnectionsCmd first = command("peer-a", null, 50L, 0, 1);
        when(first.getDisplay()).thenReturn(null);
        matches(first, 2, "five");
        ListVpnConnectionsCmd second = command("peer-a", null, 50L, 1, 1);
        when(second.getDisplay()).thenReturn(null);
        matches(second, 2, "one");
        ListVpnConnectionsCmd hidden = command("peer-a", null, 50L, 0, 20);
        when(hidden.getDisplay()).thenReturn(false);
        matches(hidden, 1, "five");
        matches(command("peer-a", null, 50L, 0, 20), 1, "one");
        ListVpnConnectionsCmd hiddenById = command(null, 5L, null, 0, 20);
        when(hiddenById.getDisplay()).thenReturn(null);
        matches(hiddenById, 1, "five");
    }

    @Test
    public void preservesLegacyIdLookupAndAllowsExplicitProjectExclusion() {
        ListVpnConnectionsCmd cmd = command(null, 1L, null, 0, 20);
        matches(cmd, 1, "one");
        verify(manager._accountMgr).buildACLSearchParameters(eq(account), eq(1L), isNull(), isNull(), anyList(), any(), eq(true), eq(false));

        when(cmd.isExcludeProjectResources()).thenReturn(true);
        matches(cmd, 1, "one");
        verify(manager._accountMgr).buildACLSearchParameters(eq(account), isNull(), isNull(), isNull(), anyList(), any(), eq(true), eq(false));

        when(cmd.getProjectId()).thenReturn(20L);
        assertThrows(InvalidParameterValueException.class, () -> manager.searchForVpnConnections(cmd));
    }
}
