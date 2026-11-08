// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements. See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership. The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License. You may obtain a copy of the License at
//
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied. See the License for the
// specific language governing permissions and limitations
// under the License.
package com.cloud.network;

import static org.junit.Assert.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.util.Arrays;
import java.util.HashSet;

import org.apache.cloudstack.api.command.user.network.ListAvailableGuestIpsCmd;
import org.apache.cloudstack.context.CallContext;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.mockito.InOrder;
import org.mockito.MockedStatic;
import org.springframework.test.util.ReflectionTestUtils;

import com.cloud.exception.InvalidParameterValueException;
import com.cloud.exception.PermissionDeniedException;
import com.cloud.network.dao.NetworkDao;
import com.cloud.network.dao.NetworkVO;
import com.cloud.user.Account;
import com.cloud.user.AccountManager;

public class NetworkAvailableGuestIpsTest {
    private NetworkServiceImpl service;
    private NetworkDao networks;
    private NetworkModel model;
    private AccountManager accounts;
    private Account caller;
    private Account projectOwner;
    private NetworkVO network;
    private ListAvailableGuestIpsCmd cmd;
    private MockedStatic<CallContext> context;

    @Before
    public void setUp() {
        service = new NetworkServiceImpl();
        service._networksDao = networks = mock(NetworkDao.class);
        service._networkModel = model = mock(NetworkModel.class);
        service._accountMgr = accounts = mock(AccountManager.class);
        caller = mock(Account.class);
        projectOwner = mock(Account.class);
        network = mock(NetworkVO.class);
        cmd = mock(ListAvailableGuestIpsCmd.class);
        when(cmd.getNetworkId()).thenReturn(10L);
        when(cmd.getProjectId()).thenReturn(null);
        when(cmd.getStartIndex()).thenReturn(null);
        when(cmd.getPageSizeVal()).thenReturn(null);
        when(networks.findById(10L)).thenReturn(network);
        when(network.getGuestType()).thenReturn(Network.GuestType.Isolated);
        when(network.getCidr()).thenReturn("10.2.0.0/24");
        when(model.getAvailableIps(network, null)).thenReturn(new HashSet<>(Arrays.asList(167903235L, 167903234L)));
        CallContext current = mock(CallContext.class);
        when(current.getCallingAccount()).thenReturn(caller);
        context = mockStatic(CallContext.class);
        context.when(CallContext::current).thenReturn(current);
    }

    @After
    public void tearDown() {
        context.close();
    }

    @Test
    public void projectLookupValidatesCallerBeforeCheckingEffectiveNetworkOwner() {
        when(cmd.getProjectId()).thenReturn(20L);
        when(accounts.finalizeOwner(caller, null, null, 20L)).thenReturn(projectOwner);
        assertEquals(2, service.listAvailableGuestIps(cmd).getResponses().size());
        InOrder order = inOrder(accounts, model);
        order.verify(accounts).finalizeOwner(caller, null, null, 20L);
        order.verify(model).checkNetworkPermissions(projectOwner, network);
        order.verify(model).getAvailableIps(network, null);
        verify(model, never()).checkNetworkPermissions(caller, network);
    }

    @Test
    public void personalLookupRetainsCallerPermissionsWithoutResolvingAnotherOwner() {
        service.listAvailableGuestIps(cmd);
        verify(model).checkNetworkPermissions(caller, network);
        verify(accounts, never()).finalizeOwner(any(), any(), any(), any());
    }

    @Test(expected = PermissionDeniedException.class)
    public void callerOutsideProjectCannotReadCandidates() {
        when(cmd.getProjectId()).thenReturn(20L);
        when(accounts.finalizeOwner(caller, null, null, 20L)).thenThrow(new PermissionDeniedException("project access denied"));
        try {
            service.listAvailableGuestIps(cmd);
        } finally {
            verifyNoInteractions(model);
        }
    }

    @Test(expected = InvalidParameterValueException.class)
    public void nonexistentProjectCannotReadCandidates() {
        when(cmd.getProjectId()).thenReturn(99L);
        when(accounts.finalizeOwner(caller, null, null, 99L)).thenThrow(new InvalidParameterValueException("project not found"));
        try {
            service.listAvailableGuestIps(cmd);
        } finally {
            verifyNoInteractions(model);
        }
    }

    @Test(expected = PermissionDeniedException.class)
    public void validProjectCannotUseUnsharedOrRevokedNetwork() {
        when(cmd.getProjectId()).thenReturn(20L);
        when(accounts.finalizeOwner(caller, null, null, 20L)).thenReturn(projectOwner);
        doThrow(new PermissionDeniedException("network use denied")).when(model).checkNetworkPermissions(projectOwner, network);
        try {
            service.listAvailableGuestIps(cmd);
        } finally {
            verify(model, never()).getAvailableIps(any(), any());
        }
    }

    @Test(expected = InvalidParameterValueException.class)
    public void allProjectsSentinelCannotSelectAnEffectiveOwner() {
        when(cmd.getProjectId()).thenReturn(-1L);
        try {
            service.listAvailableGuestIps(cmd);
        } finally {
            verifyNoInteractions(accounts, model);
        }
    }

    @Test(expected = InvalidParameterValueException.class)
    public void invalidNetworkIsRejectedBeforeOwnerResolution() {
        when(networks.findById(anyLong())).thenReturn(null);
        service.listAvailableGuestIps(cmd);
    }

    @Test(expected = InvalidParameterValueException.class)
    public void sharedNetworkStillHasNoGuestCandidateEndpoint() {
        when(network.getGuestType()).thenReturn(Network.GuestType.Shared);
        service.listAvailableGuestIps(cmd);
    }

    @Test
    public void commandRetainsExplicitProjectParameter() {
        ListAvailableGuestIpsCmd actual = new ListAvailableGuestIpsCmd();
        ReflectionTestUtils.setField(actual, "projectId", 20L);
        assertEquals(Long.valueOf(20L), actual.getProjectId());
    }
}
