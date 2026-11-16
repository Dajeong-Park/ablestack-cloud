// Licensed to the Apache Software Foundation (ASF) under one or more
// contributor license agreements. See the NOTICE file distributed with this
// work for additional information regarding copyright ownership. The ASF
// licenses this file to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance with the License.
// You may obtain a copy at http://www.apache.org/licenses/LICENSE-2.0 .
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
// WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
// License for the specific language governing permissions and limitations.
package com.cloud.vm;

import static org.junit.Assert.assertSame;
import static org.junit.Assert.assertThrows;
import static org.junit.Assert.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Date;

import org.apache.cloudstack.context.CallContext;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.MockitoJUnitRunner;

import com.cloud.exception.InvalidParameterValueException;
import com.cloud.network.as.AutoScaleManager;
import com.cloud.user.AccountManager;
import com.cloud.user.AccountVO;
import com.cloud.user.UserVO;
import com.cloud.vm.dao.UserVmDao;
import com.cloud.vm.snapshot.VMSnapshotManager;

@RunWith(MockitoJUnitRunner.class)
public class UserVmExpungeProtectionTest {
    @Mock private UserVmDao vmDao;
    @Mock private AccountManager accountManager;
    @Mock private AutoScaleManager autoScaleManager;
    @Mock private VMSnapshotManager snapshotManager;
    @Mock private UserVmVO vm;
    @Mock private AccountVO caller;
    @Mock private UserVO user;
    @Spy @InjectMocks private UserVmManagerImpl manager = new UserVmManagerImpl();

    @Before
    public void setUp() {
        CallContext.register(user, caller);
    }

    @After
    public void tearDown() {
        CallContext.unregister();
    }

    @Test
    public void protectedVmRejectsExpungeBeforeAnyCleanup() throws Exception {
        when(vmDao.findById(17L)).thenReturn(vm);
        when(vm.isDeleteProtection()).thenReturn(true);
        when(vm.getUuid()).thenReturn("protected-vnf");
        InvalidParameterValueException error = assertThrows(InvalidParameterValueException.class, () -> manager.expungeVm(17L));
        assertTrue(error.getMessage().contains("delete protection"));
        verify(snapshotManager, never()).deleteVMSnapshotsFromDB(17L, false);
        verify(manager, never()).expunge(any());
    }

    @Test
    public void explicitUnprotectedVmKeepsExistingExpungeAndSnapshotCleanup() throws Exception {
        when(vmDao.findById(17L)).thenReturn(vm);
        when(vm.getState()).thenReturn(VirtualMachine.State.Destroyed);
        when(accountManager.isAdmin(0L)).thenReturn(true);
        doReturn(true).when(manager).expunge(vm);
        when(vmDao.findByIdIncludingRemoved(17L)).thenReturn(vm);
        assertSame(vm, manager.expungeVm(17L));
        verify(snapshotManager).deleteVMSnapshotsFromDB(17L, false);
        verify(manager).expunge(vm);
    }

    @Test
    public void removedVmRemainsIdempotentWithoutRepeatingCleanup() throws Exception {
        when(vmDao.findById(17L)).thenReturn(vm);
        when(vm.getRemoved()).thenReturn(new Date());
        assertSame(vm, manager.expungeVm(17L));
        verify(manager, never()).expunge(any());
    }
}
