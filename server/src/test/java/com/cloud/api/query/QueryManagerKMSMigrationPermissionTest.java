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

package com.cloud.api.query;

import com.cloud.exception.PermissionDeniedException;
import com.cloud.user.Account;
import com.cloud.user.AccountManager;
import com.cloud.user.User;
import org.apache.cloudstack.api.ApiConstants;
import org.apache.cloudstack.api.command.user.volume.ListVolumesCmd;
import org.apache.cloudstack.context.CallContext;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Collections;

import static org.junit.Assert.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

public class QueryManagerKMSMigrationPermissionTest {
    private QueryManagerImpl query;
    private AccountManager accounts;
    private ListVolumesCmd cmd;
    private User user;

    @Before
    public void setUp() {
        query = new QueryManagerImpl();
        accounts = mock(AccountManager.class);
        cmd = mock(ListVolumesCmd.class);
        user = mock(User.class);
        ReflectionTestUtils.setField(query, "accountMgr", accounts);
        CallContext.register(user, mock(Account.class));
    }

    @After
    public void tearDown() {
        CallContext.unregister();
    }

    @Test
    public void normalVolumeQueryDoesNotRequireMigrationPermission() {
        when(cmd.getKmsMigrationKeyId()).thenReturn(null);
        query.checkVolumeMigrationPermission(cmd);
        verify(accounts, never()).checkApiAccessForUser(any(), any(), any());
    }

    @Test
    public void candidateQueryChecksCurrentUserAndRestrictedApiKey() {
        when(cmd.getKmsMigrationKeyId()).thenReturn(5L);
        when(cmd.getFullUrlParams()).thenReturn(Collections.singletonMap(ApiConstants.API_KEY, "fixture-public-identifier"));
        query.checkVolumeMigrationPermission(cmd);
        verify(accounts).checkApiAccessForUser(user, "migrateVolumesToKMS", "fixture-public-identifier");
    }

    @Test
    public void deniedMigrationApiIsNotBypassedThroughListVolumes() {
        when(cmd.getKmsMigrationKeyId()).thenReturn(5L);
        doThrow(new PermissionDeniedException("fixture permission denial")).when(accounts)
                .checkApiAccessForUser(eq(user), eq("migrateVolumesToKMS"), any());
        assertThrows(PermissionDeniedException.class, () -> query.checkVolumeMigrationPermission(cmd));
    }
}
