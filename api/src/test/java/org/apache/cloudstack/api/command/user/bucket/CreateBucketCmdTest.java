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
package org.apache.cloudstack.api.command.user.bucket;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.fail;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.lang.reflect.Field;

import org.apache.cloudstack.context.CallContext;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;

import com.cloud.exception.InvalidParameterValueException;
import com.cloud.exception.PermissionDeniedException;
import com.cloud.user.Account;
import com.cloud.user.AccountService;
import com.cloud.user.User;

public class CreateBucketCmdTest {
    private CreateBucketCmd cmd;
    private AccountService accounts;

    @Before
    public void setup() {
        cmd = new CreateBucketCmd();
        accounts = mock(AccountService.class);
        cmd._accountService = accounts;
    }

    @After
    public void cleanup() {
        CallContext.unregister();
    }

    private void set(String name, Object value) throws Exception {
        Field field = CreateBucketCmd.class.getDeclaredField(name);
        field.setAccessible(true);
        field.set(cmd, value);
    }

    private void rejected() {
        try {
            cmd.getEntityOwnerId();
            fail("Ambiguous or incomplete owner accepted");
        } catch (InvalidParameterValueException expected) {
            verifyNoInteractions(accounts);
        }
    }

    @Test
    public void accountRequiresDomain() throws Exception {
        set("accountName", "owner");
        rejected();
    }

    @Test
    public void domainRequiresAccount() throws Exception {
        set("domainId", 3L);
        rejected();
    }

    @Test
    public void projectRejectsAccountEvenWithDomain() throws Exception {
        set("projectId", 9L);
        set("accountName", "owner");
        set("domainId", 3L);
        rejected();
    }

    @Test
    public void projectRejectsDomainAlone() throws Exception {
        set("projectId", 9L);
        set("domainId", 3L);
        rejected();
    }

    @Test
    public void accountAndDomainResolveOnlyAnEnabledAccount() throws Exception {
        set("accountName", "owner");
        set("domainId", 3L);
        when(accounts.finalizeAccountId("owner", 3L, null, true)).thenReturn(7L);
        assertEquals(7L, cmd.getEntityOwnerId());
        verify(accounts).finalizeAccountId("owner", 3L, null, true);
    }

    @Test
    public void projectResolvesOnlyAnActiveProject() throws Exception {
        set("projectId", 9L);
        when(accounts.finalizeAccountId(null, null, 9L, true)).thenReturn(10L);
        assertEquals(10L, cmd.getEntityOwnerId());
    }

    @Test
    public void omittedOwnerKeepsTheCallingAccount() {
        Account caller = mock(Account.class);
        when(caller.getId()).thenReturn(2L);
        CallContext.register(mock(User.class), caller);
        when(accounts.finalizeAccountId(null, null, null, true)).thenReturn(null);
        assertEquals(2L, cmd.getEntityOwnerId());
        verify(accounts).finalizeAccountId(null, null, null, true);
    }

    @Test(expected = PermissionDeniedException.class)
    public void disabledAccountDoesNotFallBackToTheCaller() throws Exception {
        set("accountName", "disabled");
        set("domainId", 3L);
        when(accounts.finalizeAccountId("disabled", 3L, null, true)).thenThrow(new PermissionDeniedException("disabled"));
        cmd.getEntityOwnerId();
    }

    @Test(expected = PermissionDeniedException.class)
    public void inactiveProjectDoesNotFallBackToTheCaller() throws Exception {
        set("projectId", 9L);
        when(accounts.finalizeAccountId(null, null, 9L, true)).thenThrow(new PermissionDeniedException("inactive"));
        cmd.getEntityOwnerId();
    }
}
