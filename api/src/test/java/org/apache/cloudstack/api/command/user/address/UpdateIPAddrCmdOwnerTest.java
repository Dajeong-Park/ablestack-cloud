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
package org.apache.cloudstack.api.command.user.address;

import static org.junit.Assert.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.lang.reflect.Field;

import org.apache.cloudstack.api.ResponseGenerator;
import org.apache.cloudstack.api.ResponseObject.ResponseView;
import org.apache.cloudstack.api.response.IPAddressResponse;
import org.apache.cloudstack.context.CallContext;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;

import com.cloud.exception.InvalidParameterValueException;
import com.cloud.exception.PermissionDeniedException;
import com.cloud.network.IpAddress;
import com.cloud.network.NetworkService;
import com.cloud.user.Account;
import com.cloud.user.User;
import com.cloud.utils.db.EntityManager;

public class UpdateIPAddrCmdOwnerTest {
    private UpdateIPAddrCmd cmd;
    private IpAddress ip;
    private EntityManager entities;
    private Account caller;

    @Before
    public void setup() throws Exception {
        cmd = new UpdateIPAddrCmd();
        entities = mock(EntityManager.class);
        cmd._entityMgr = entities;
        ip = mock(IpAddress.class);
        set("id", 8L);
        when(entities.findById(IpAddress.class, 8L)).thenReturn(ip);
        when(ip.getState()).thenReturn(IpAddress.State.Free);
        owner(null);
        caller = mock(Account.class);
        when(caller.getId()).thenReturn(2L);
        when(caller.getType()).thenReturn(Account.Type.ADMIN);
        CallContext.register(mock(User.class), caller);
    }

    @After
    public void cleanup() {
        CallContext.unregister();
    }

    private void set(String name, Object value) throws Exception {
        Field field = UpdateIPAddrCmd.class.getDeclaredField(name);
        field.setAccessible(true);
        field.set(cmd, value);
    }

    private void owner(Long accountId) {
        when(ip.getAllocatedToAccountId()).thenReturn(accountId);
        when(ip.getAccountId()).thenReturn(accountId == null ? -1L : accountId);
    }

    @Test
    public void freeAddressUsesSystemOwnerInsteadOfTheNegativeSentinelOrCaller() {
        assertEquals(Account.ACCOUNT_ID_SYSTEM, cmd.getEntityOwnerId());
        verify(ip, never()).getAccountId();
    }

    @Test(expected = PermissionDeniedException.class)
    public void userCannotScheduleAnUnownedAddressUpdate() {
        when(caller.getType()).thenReturn(Account.Type.NORMAL);
        cmd.getEntityOwnerId();
    }

    @Test(expected = PermissionDeniedException.class)
    public void domainAdminCannotScheduleAnUnownedAddressUpdate() {
        when(caller.getType()).thenReturn(Account.Type.DOMAIN_ADMIN);
        cmd.getEntityOwnerId();
    }

    @Test(expected = PermissionDeniedException.class)
    public void readOnlyAdminCannotScheduleAnUnownedAddressUpdate() {
        when(caller.getType()).thenReturn(Account.Type.READ_ONLY_ADMIN);
        cmd.getEntityOwnerId();
    }

    @Test(expected = InvalidParameterValueException.class)
    public void missingAddressFailsBeforeScheduling() {
        when(entities.findById(IpAddress.class, 8L)).thenReturn(null);
        cmd.getEntityOwnerId();
    }

    @Test(expected = InvalidParameterValueException.class)
    public void zeroAllocatedOwnerIsRejected() {
        owner(0L);
        cmd.getEntityOwnerId();
    }

    @Test(expected = InvalidParameterValueException.class)
    public void negativeAllocatedOwnerIsRejected() {
        owner(-1L);
        cmd.getEntityOwnerId();
    }

    @Test
    public void allocatedAddressRetainsItsActualOwner() {
        when(ip.getState()).thenReturn(IpAddress.State.Allocated);
        owner(44L);
        assertEquals(44L, cmd.getEntityOwnerId());
    }

    @Test
    public void reservedAddressRetainsItsActualOwner() {
        when(ip.getState()).thenReturn(IpAddress.State.Reserved);
        owner(45L);
        assertEquals(45L, cmd.getEntityOwnerId());
    }

    @Test
    public void projectAddressRetainsItsProjectAccountOwner() {
        owner(46L);
        when(caller.getType()).thenReturn(Account.Type.PROJECT);
        assertEquals(46L, cmd.getEntityOwnerId());
    }

    @Test
    public void ownerIsResolvedAgainAfterTheAddressChangesOwner() {
        owner(44L);
        assertEquals(44L, cmd.getEntityOwnerId());
        owner(45L);
        assertEquals(45L, cmd.getEntityOwnerId());
    }

    @Test
    public void releaseDoesNotLeaveThePreviousOwnerCached() {
        owner(44L);
        assertEquals(44L, cmd.getEntityOwnerId());
        owner(null);
        assertEquals(Account.ACCOUNT_ID_SYSTEM, cmd.getEntityOwnerId());
    }

    @Test
    public void hiddenOwnerParameterCannotOverrideTheActualOwner() throws Exception {
        set("ownerId", 777L);
        owner(44L);
        assertEquals(44L, cmd.getEntityOwnerId());
    }

    @Test(expected = PermissionDeniedException.class)
    public void hiddenOwnerParameterCannotBypassTheUnownedPermissionCheck() throws Exception {
        set("ownerId", 777L);
        when(caller.getType()).thenReturn(Account.Type.NORMAL);
        cmd.getEntityOwnerId();
    }

    @Test
    public void executePreservesTheExistingDisplayAndResponseContract() throws Exception {
        set("display", Boolean.FALSE);
        cmd._networkService = mock(NetworkService.class);
        cmd._responseGenerator = mock(ResponseGenerator.class);
        when(cmd._networkService.updateIP(8L, null, Boolean.FALSE)).thenReturn(ip);
        IPAddressResponse response = new IPAddressResponse();
        when(cmd._responseGenerator.createIPAddressResponse(ResponseView.Restricted, ip)).thenReturn(response);
        cmd.execute();
        verify(cmd._networkService).updateIP(8L, null, Boolean.FALSE);
        assertEquals(response, cmd.getResponseObject());
    }
}
