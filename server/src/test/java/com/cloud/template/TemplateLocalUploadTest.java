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
//

package com.cloud.template;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.Arrays;
import java.util.Collections;
import java.util.concurrent.atomic.AtomicReference;

import org.apache.cloudstack.api.command.user.template.GetUploadParamsForTemplateCmd;
import org.apache.cloudstack.api.command.user.template.RegisterTemplateCmd;
import org.apache.cloudstack.context.CallContext;
import org.apache.cloudstack.engine.subsystem.api.storage.DataStore;
import org.apache.cloudstack.engine.subsystem.api.storage.DataStoreManager;
import org.apache.cloudstack.engine.subsystem.api.storage.ZoneScope;
import org.apache.cloudstack.storage.datastore.db.ImageStoreDao;
import org.junit.After;
import org.junit.Test;
import org.mockito.Answers;
import org.mockito.invocation.InvocationOnMock;

import com.cloud.dc.DataCenter;
import com.cloud.dc.DataCenterVO;
import com.cloud.dc.dao.DataCenterDao;
import com.cloud.exception.InvalidParameterValueException;
import com.cloud.org.Grouping;
import com.cloud.utils.exception.CloudRuntimeException;
import com.cloud.storage.Storage.TemplateType;
import com.cloud.storage.TemplateProfile;
import com.cloud.user.Account;
import com.cloud.user.AccountManager;
import com.cloud.user.User;

public class TemplateLocalUploadTest {
    private final TemplateManagerImpl manager = new TemplateManagerImpl();

    @After
    public void tearDown() {
        CallContext.unregister();
    }

    private GetUploadParamsForTemplateCmd upload(String type) {
        GetUploadParamsForTemplateCmd cmd = mock(GetUploadParamsForTemplateCmd.class);
        when(cmd.getTemplateType()).thenReturn(type);
        return cmd;
    }

    @Test
    public void adminCanUploadSystemTemplateToAllZones() {
        assertEquals(TemplateType.SYSTEM, manager.validateTemplateType(upload("SYSTEM"), true, true));
    }

    @Test(expected = InvalidParameterValueException.class)
    public void systemTemplateRequiresAllZones() {
        manager.validateTemplateType(upload("SYSTEM"), true, false);
    }

    @Test
    public void omittedTypeDefaultsToUser() {
        assertEquals(TemplateType.USER, manager.validateTemplateType(upload(null), false, false));
    }

    @Test
    public void routingFlagStillWorks() {
        GetUploadParamsForTemplateCmd cmd = upload(null);
        when(cmd.isRoutingType()).thenReturn(true);
        assertEquals(TemplateType.ROUTING, manager.validateTemplateType(cmd, true, false));
    }

    @Test(expected = InvalidParameterValueException.class)
    public void userCannotUploadSystemTemplate() {
        manager.validateTemplateType(upload("SYSTEM"), false, true);
    }

    @Test(expected = InvalidParameterValueException.class)
    public void userCannotUploadRoutingTemplateUsingLegacyFlag() {
        GetUploadParamsForTemplateCmd cmd = upload(null);
        when(cmd.isRoutingType()).thenReturn(true);
        manager.validateTemplateType(cmd, false, false);
    }

    @Test(expected = InvalidParameterValueException.class)
    public void invalidTypeIsRejected() {
        manager.validateTemplateType(upload("INVALID"), true, false);
    }

    @Test(expected = InvalidParameterValueException.class)
    public void conflictingRoutingFlagIsRejected() {
        GetUploadParamsForTemplateCmd cmd = upload("SYSTEM");
        when(cmd.isRoutingType()).thenReturn(true);
        manager.validateTemplateType(cmd, true, false);
    }

    @Test(expected = InvalidParameterValueException.class)
    public void urlRegistrationStillRequiresCrossZoneSystemTemplate() {
        RegisterTemplateCmd cmd = mock(RegisterTemplateCmd.class);
        when(cmd.getTemplateType()).thenReturn("SYSTEM");
        manager.validateTemplateType(cmd, true, false);
    }

    @Test
    public void selectedTypeAndZoneReachProfileWithoutSwappingUploadOptions() throws Exception {
        Account caller = mock(Account.class);
        when(caller.getAccountId()).thenReturn(2L);
        CallContext.register(mock(User.class), caller);

        AtomicReference<InvocationOnMock> prepared = new AtomicReference<>();
        TemplateProfile profile = mock(TemplateProfile.class);
        TemplateAdapterBase adapter = mock(TemplateAdapterBase.class, invocation -> {
            if (invocation.getMethod().getName().equals("prepare") && invocation.getArguments().length == 28) {
                prepared.set(invocation);
                return profile;
            }
            return Answers.CALLS_REAL_METHODS.answer(invocation);
        });
        adapter._accountMgr = mock(AccountManager.class);
        when(adapter._accountMgr.isAdmin(2L)).thenReturn(true);
        when(adapter._accountMgr.getAccount(2L)).thenReturn(caller);
        adapter._imgStoreDao = mock(ImageStoreDao.class);
        adapter.templateMgr = manager;

        GetUploadParamsForTemplateCmd cmd = upload("USER");
        when(cmd.getEntityOwnerId()).thenReturn(2L);
        when(cmd.getZoneId()).thenReturn(7L);
        when(cmd.getOsTypeId()).thenReturn(1L);
        when(cmd.getHypervisor()).thenReturn("KVM");
        when(cmd.isKvdoEnable()).thenReturn(true);
        assertEquals(profile, adapter.prepare(cmd));
        assertEquals(TemplateType.USER, prepared.get().getArgument(24));
        assertEquals(Collections.singletonList(7L), prepared.get().getArgument(14));
        assertTrue(prepared.get().getArgument(26));
        assertFalse(prepared.get().getArgument(27));

        when(cmd.isKvdoEnable()).thenReturn(null);
        when(cmd.isDeployAsIs()).thenReturn(true);
        adapter.prepare(cmd);
        assertFalse(prepared.get().getArgument(26));
        assertTrue(prepared.get().getArgument(27));

        when(cmd.getZoneId()).thenReturn(-1L);
        when(cmd.getTemplateType()).thenReturn("SYSTEM");
        adapter.prepare(cmd);
        assertEquals(TemplateType.SYSTEM, prepared.get().getArgument(24));
        assertNull(prepared.get().getArgument(14));
    }

    @Test
    public void crossZoneUploadSkipsDisabledEdgeAndStorageLessZones() {
        HypervisorTemplateAdapter adapter = new HypervisorTemplateAdapter();
        adapter._dcDao = mock(DataCenterDao.class);
        adapter.storeMgr = mock(DataStoreManager.class);
        DataCenterVO disabled = mock(DataCenterVO.class);
        when(disabled.getAllocationState()).thenReturn(Grouping.AllocationState.Disabled);
        DataCenterVO edge = mock(DataCenterVO.class);
        when(edge.getType()).thenReturn(DataCenter.Type.Edge);
        DataCenterVO empty = mock(DataCenterVO.class);
        when(empty.getId()).thenReturn(3L);
        DataCenterVO available = mock(DataCenterVO.class);
        when(available.getId()).thenReturn(4L);
        when(adapter._dcDao.listAll()).thenReturn(Arrays.asList(disabled, edge, empty, available));
        when(adapter.storeMgr.getImageStoresByScopeExcludingReadOnly(org.mockito.Mockito.any())).thenAnswer(invocation -> {
            ZoneScope scope = invocation.getArgument(0);
            return scope.getScopeId() == 4L ? Collections.singletonList(mock(DataStore.class)) : Collections.emptyList();
        });
        TemplateProfile profile = mock(TemplateProfile.class);
        when(profile.getZoneIdList()).thenReturn(null);
        assertEquals(Long.valueOf(4L), adapter.getPostUploadZoneId(profile));
    }

    @Test(expected = CloudRuntimeException.class)
    public void crossZoneUploadRejectsWhenNoZoneIsAvailable() {
        HypervisorTemplateAdapter adapter = new HypervisorTemplateAdapter();
        adapter._dcDao = mock(DataCenterDao.class);
        when(adapter._dcDao.listAll()).thenReturn(Collections.emptyList());
        TemplateProfile profile = mock(TemplateProfile.class);
        when(profile.getZoneIdList()).thenReturn(null);
        adapter.getPostUploadZoneId(profile);
    }

    @Test
    public void explicitUploadZoneIsPreserved() {
        TemplateProfile profile = mock(TemplateProfile.class);
        when(profile.getZoneIdList()).thenReturn(Collections.singletonList(7L));
        assertEquals(Long.valueOf(7L), new HypervisorTemplateAdapter().getPostUploadZoneId(profile));
    }

    @Test(expected = CloudRuntimeException.class)
    public void multipleExplicitUploadZonesAreRejected() {
        TemplateProfile profile = mock(TemplateProfile.class);
        when(profile.getZoneIdList()).thenReturn(Arrays.asList(1L, 2L));
        new HypervisorTemplateAdapter().getPostUploadZoneId(profile);
    }
}
