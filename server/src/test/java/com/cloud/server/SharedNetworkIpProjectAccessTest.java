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
package com.cloud.server;

import static org.junit.Assert.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.ArgumentMatchers.same;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Collections;
import java.util.List;

import org.apache.cloudstack.acl.ControlledEntity.ACLType;
import org.apache.cloudstack.acl.SecurityChecker.AccessType;
import org.apache.cloudstack.api.command.user.address.ListPublicIpAddressesCmd;
import org.apache.cloudstack.context.CallContext;
import org.apache.cloudstack.framework.config.ConfigKey;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.mockito.InOrder;
import org.mockito.MockedStatic;
import org.springframework.test.util.ReflectionTestUtils;

import com.cloud.exception.InvalidParameterValueException;
import com.cloud.exception.PermissionDeniedException;
import com.cloud.dc.dao.VlanDao;
import com.cloud.dc.VlanVO;
import com.cloud.network.IpAddressManagerImpl;
import com.cloud.network.Network.GuestType;
import com.cloud.network.dao.IPAddressDao;
import com.cloud.network.dao.IPAddressVO;
import com.cloud.network.dao.NetworkAccountDao;
import com.cloud.network.dao.NetworkAccountVO;
import com.cloud.network.dao.NetworkDao;
import com.cloud.network.dao.NetworkVO;
import com.cloud.user.Account;
import com.cloud.user.AccountManager;
import com.cloud.user.AccountVO;
import com.cloud.user.User;
import com.cloud.user.dao.AccountDao;
import com.cloud.utils.db.SearchBuilder;
import com.cloud.utils.db.SearchCriteria;

public class SharedNetworkIpProjectAccessTest {
    private ManagementServerImpl manager;
    private AccountManager accounts;
    private Account caller;
    private AccountVO owner;
    private Account project;
    private IPAddressDao addresses;
    private NetworkDao networks;
    private NetworkVO network;
    private ListPublicIpAddressesCmd cmd;
    private SearchBuilder<IPAddressVO> builder;
    private SearchCriteria<IPAddressVO> criteria;
    private MockedStatic<IpAddressManagerImpl> ipManagerStatic;

    @Before
    @SuppressWarnings("unchecked")
    public void setUp() {
        manager = new ManagementServerImpl();
        accounts = mock(AccountManager.class);
        caller = mock(Account.class);
        owner = mock(AccountVO.class);
        project = mock(Account.class);
        addresses = mock(IPAddressDao.class);
        networks = mock(NetworkDao.class);
        network = mock(NetworkVO.class);
        cmd = mock(ListPublicIpAddressesCmd.class);
        NetworkAccountDao mappings = mock(NetworkAccountDao.class);
        NetworkAccountVO mapping = mock(NetworkAccountVO.class);
        AccountDao accountDao = mock(AccountDao.class);
        ReflectionTestUtils.setField(manager, "_accountMgr", accounts);
        ReflectionTestUtils.setField(manager, "_accountDao", accountDao);
        ReflectionTestUtils.setField(manager, "_networkAccountDao", mappings);
        ReflectionTestUtils.setField(manager, "_publicIpAddressDao", addresses);
        ReflectionTestUtils.setField(manager, "networkDao", networks);
        VlanDao vlans = mock(VlanDao.class);
        SearchBuilder<VlanVO> vlanBuilder = mock(SearchBuilder.class);
        when(vlanBuilder.entity()).thenReturn(mock(VlanVO.class));
        when(vlans.createSearchBuilder()).thenReturn(vlanBuilder);
        ReflectionTestUtils.setField(manager, "_vlanDao", vlans);
        ConfigKey<Boolean> strict = mock(ConfigKey.class);
        when(strict.value()).thenReturn(false);
        ipManagerStatic = org.mockito.Mockito.mockStatic(IpAddressManagerImpl.class);
        ipManagerStatic.when(IpAddressManagerImpl::getSystemvmpublicipreservationmodestrictness).thenReturn(strict);
        CallContext.register(mock(User.class), caller);
        when(caller.getType()).thenReturn(Account.Type.NORMAL);
        when(project.getType()).thenReturn(Account.Type.PROJECT);
        when(network.getGuestType()).thenReturn(GuestType.Shared);
        when(network.getAclType()).thenReturn(ACLType.Account);
        when(network.getId()).thenReturn(30L);
        when(networks.findById(30L)).thenReturn(network);
        when(mappings.getAccountNetworkMapByNetworkId(30L)).thenReturn(mapping);
        when(mapping.getAccountId()).thenReturn(90L);
        when(accountDao.findById(90L)).thenReturn(owner);
        when(cmd.getNetworkId()).thenReturn(30L);
        when(cmd.getId()).thenReturn(null);
        when(cmd.getAssociatedNetworkId()).thenReturn(null);
        when(cmd.getVpcId()).thenReturn(null);
        when(cmd.getZoneId()).thenReturn(null);
        when(cmd.getVlanId()).thenReturn(null);
        when(cmd.getPhysicalNetworkId()).thenReturn(null);
        when(cmd.getDomainId()).thenReturn(null);
        when(cmd.isForVirtualNetwork()).thenReturn(false);
        when(cmd.isAllocatedOnly()).thenReturn(true);
        when(cmd.getProjectId()).thenReturn(20L);
        when(accounts.finalizeOwner(caller, null, null, 20L)).thenReturn(project);
        doThrow(new PermissionDeniedException("not the network owner")).when(accounts).checkAccess(same(caller), isNull(), eq(false), same(owner));
        builder = mock(SearchBuilder.class, org.mockito.Answers.RETURNS_DEEP_STUBS);
        when(builder.entity()).thenReturn(mock(IPAddressVO.class));
        criteria = mock(SearchCriteria.class);
        when(addresses.createSearchBuilder()).thenReturn(builder);
        when(builder.create()).thenReturn(criteria);
        when(addresses.search(same(criteria), any())).thenReturn(Collections.emptyList());
    }

    @After
    public void tearDown() {
        ipManagerStatic.close();
        CallContext.unregister();
    }

    @Test
    public void projectMembershipPrecedesNetworkUseAndQueryKeepsCallerAcl() {
        doAnswer(invocation -> {
            List<Long> permitted = invocation.getArgument(4);
            permitted.add(101L);
            return null;
        }).when(accounts).buildACLSearchParameters(same(caller), isNull(), isNull(), eq(20L), any(), any(), anyBoolean(), eq(false));
        assertEquals(Integer.valueOf(0), manager.searchForIPAddresses(cmd).second());
        InOrder order = inOrder(accounts, addresses);
        order.verify(accounts).checkAccess(same(caller), isNull(), eq(false), same(owner));
        order.verify(accounts).finalizeOwner(caller, null, null, 20L);
        order.verify(accounts).checkAccess(project, AccessType.UseEntry, false, network);
        order.verify(accounts).buildACLSearchParameters(same(caller), isNull(), isNull(), eq(20L), eq(Collections.singletonList(101L)), any(), anyBoolean(), eq(false));
        order.verify(accounts).buildACLSearchBuilder(same(builder), isNull(), anyBoolean(), eq(Collections.singletonList(101L)), isNull());
        order.verify(accounts).buildACLSearchCriteria(same(criteria), isNull(), anyBoolean(), eq(Collections.singletonList(101L)), isNull());
        order.verify(addresses).search(same(criteria), any());
        verify(criteria).setParameters("sourceNetworkId", 30L);
        verify(accounts, never()).checkAccess(caller, AccessType.UseEntry, false, network);
    }

    @Test(expected = PermissionDeniedException.class)
    public void nonMemberCannotUseAProjectNetworkGrant() {
        when(accounts.finalizeOwner(caller, null, null, 20L)).thenThrow(new PermissionDeniedException("not a member"));
        try {
            manager.searchForIPAddresses(cmd);
        } finally {
            verify(accounts, never()).checkAccess(project, AccessType.UseEntry, false, network);
            verify(addresses, never()).search(any(), any());
        }
    }

    @Test(expected = PermissionDeniedException.class)
    public void validProjectWithoutNetworkGrantIsDenied() {
        doThrow(new PermissionDeniedException("unshared network")).when(accounts).checkAccess(project, AccessType.UseEntry, false, network);
        try {
            manager.searchForIPAddresses(cmd);
        } finally {
            verify(addresses, never()).search(any(), any());
        }
    }

    @Test(expected = InvalidParameterValueException.class)
    public void missingProjectIsDeniedBeforeAddressSearch() {
        when(accounts.finalizeOwner(caller, null, null, 20L)).thenThrow(new InvalidParameterValueException("project missing"));
        manager.searchForIPAddresses(cmd);
    }

    @Test(expected = PermissionDeniedException.class)
    public void personalContextDoesNotInheritMembershipGrants() {
        when(cmd.getProjectId()).thenReturn(null);
        doThrow(new PermissionDeniedException("no personal grant")).when(accounts).checkAccess(caller, AccessType.UseEntry, false, network);
        try {
            manager.searchForIPAddresses(cmd);
        } finally {
            verify(accounts, never()).finalizeOwner(any(), any(), any(), any());
            verify(addresses, never()).search(any(), any());
        }
    }

    @Test(expected = InvalidParameterValueException.class)
    public void allProjectsSentinelCannotBecomeOneNetworkPrincipal() {
        when(cmd.getProjectId()).thenReturn(-1L);
        manager.searchForIPAddresses(cmd);
    }

    @Test(expected = InvalidParameterValueException.class)
    public void zeroProjectCannotBecomeOneNetworkPrincipal() {
        when(cmd.getProjectId()).thenReturn(0L);
        manager.searchForIPAddresses(cmd);
    }

    @Test
    public void ownerAndAdministratorAccessDoesNotChangePrincipal() {
        org.mockito.Mockito.doNothing().when(accounts).checkAccess(same(caller), isNull(), eq(false), same(owner));
        manager.searchForIPAddresses(cmd);
        verify(accounts, never()).finalizeOwner(any(), any(), any(), any());
        verify(accounts, never()).checkAccess(any(), eq(AccessType.UseEntry), anyBoolean(), any(NetworkVO.class));
    }

    @Test
    public void addressIdLookupUsesItsActualSharedNetwork() {
        when(cmd.getNetworkId()).thenReturn(null);
        when(cmd.getId()).thenReturn(7L);
        IPAddressVO ip = mock(IPAddressVO.class);
        when(ip.getSourceNetworkId()).thenReturn(30L);
        when(addresses.findById(7L)).thenReturn(ip);
        manager.searchForIPAddresses(cmd);
        verify(accounts).checkAccess(project, AccessType.UseEntry, false, network);
    }

    @Test(expected = InvalidParameterValueException.class)
    public void isolatedNetworkCannotEnterSharedAddressLookup() {
        when(network.getGuestType()).thenReturn(GuestType.Isolated);
        try {
            manager.searchForIPAddresses(cmd);
        } finally {
            verify(accounts, never()).finalizeOwner(any(), any(), any(), any());
        }
    }
}
