// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements. See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership. The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License. You may obtain a copy of the License at
// http://www.apache.org/licenses/LICENSE-2.0
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied. See the License for the
// specific language governing permissions and limitations
// under the License.
package com.cloud.api;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.Collections;
import com.cloud.api.query.dao.UserVmJoinDao;
import com.cloud.network.dao.NetworkVO;
import com.cloud.utils.db.EntityManager;
import com.cloud.vm.Nic;
import com.cloud.vm.NicDetailVO;
import com.cloud.vm.VMInstanceVO;
import com.cloud.vm.dao.NicDetailsDao;
import com.cloud.vm.dao.NicExtraDhcpOptionDao;
import com.google.gson.Gson;
import com.google.gson.JsonObject;
import org.junit.Before;
import org.junit.Test;
import org.springframework.test.util.ReflectionTestUtils;

public class NicStateResponseTest {
    private ApiResponseHelper helper;
    private Nic nic;
    private NicDetailsDao details;

    @Before
    public void setup() {
        helper = new ApiResponseHelper();
        nic = mock(Nic.class);
        when(nic.getId()).thenReturn(100L);
        when(nic.getNetworkId()).thenReturn(2L);
        when(nic.getInstanceId()).thenReturn(1L);
        EntityManager entities = mock(EntityManager.class);
        when(entities.findById(NetworkVO.class, 2L)).thenReturn(mock(NetworkVO.class));
        VMInstanceVO vm = mock(VMInstanceVO.class);
        when(vm.getId()).thenReturn(1L);
        when(entities.findById(VMInstanceVO.class, 1L)).thenReturn(vm);
        ReflectionTestUtils.setField(helper, "_entityMgr", entities);
        details = mock(NicDetailsDao.class);
        ReflectionTestUtils.setField(helper, "_nicDetailsDao", details);
        NicExtraDhcpOptionDao dhcp = mock(NicExtraDhcpOptionDao.class);
        when(dhcp.listByNicId(anyLong())).thenReturn(Collections.emptyList());
        ReflectionTestUtils.setField(helper, "_nicExtraDhcpOptionDao", dhcp);
        ReflectionTestUtils.setField(helper, "userVmJoinDao", mock(UserVmJoinDao.class));
    }

    private JsonObject response() {
        return new Gson().toJsonTree(helper.createNicResponse(nic)).getAsJsonObject();
    }

    @Test
    public void allocatedNicDoesNotBecomeReservedBecauseItIsEnabled() {
        when(nic.getState()).thenReturn(Nic.State.Allocated);
        when(nic.isEnabled()).thenReturn(true);
        JsonObject r = response();
        assertEquals("Allocated", r.get("state").getAsString());
        assertEquals(true, r.get("enabled").getAsBoolean());
        assertFalse(r.has("attachmentstate"));
    }

    @Test
    public void reservedButDisabledNicRetainsBothIndependentValues() {
        when(nic.getState()).thenReturn(Nic.State.Reserved);
        when(nic.isEnabled()).thenReturn(false);
        JsonObject r = response();
        assertEquals("Reserved", r.get("state").getAsString());
        assertFalse(r.get("enabled").getAsBoolean());
    }

    @Test
    public void unknownHostOutcomeIsExplicitlyExposedForRecovery() {
        when(nic.getState()).thenReturn(Nic.State.Reserved);
        when(details.findDetail(100L, "hotplug.outcome")).thenReturn(new NicDetailVO(100L, "hotplug.outcome", "Unknown", false));
        assertEquals("Unknown", response().get("attachmentstate").getAsString());
    }

    @Test
    public void arbitraryPrivateDetailValuesAreNotExposed() {
        when(details.findDetail(100L, "hotplug.outcome")).thenReturn(new NicDetailVO(100L, "hotplug.outcome", "private-data", false));
        assertFalse(response().has("attachmentstate"));
    }
}
