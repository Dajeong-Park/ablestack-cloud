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
package org.apache.cloudstack.network.tungsten.service;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;

import com.cloud.dc.DataCenterVO;
import com.cloud.dc.dao.DataCenterDao;
import com.cloud.network.dao.TungstenProviderDao;
import com.cloud.network.element.TungstenProviderVO;
import org.apache.cloudstack.api.BaseResponse;
import org.apache.cloudstack.network.tungsten.api.response.TungstenFabricProviderResponse;
import org.junit.Before;
import org.junit.Test;

public class TungstenProviderListTest {
    private TungstenProviderServiceImpl service;
    private TungstenProviderDao providerDao;
    private DataCenterDao zoneDao;

    @Before
    public void setUp() {
        service = new TungstenProviderServiceImpl();
        providerDao = mock(TungstenProviderDao.class);
        zoneDao = mock(DataCenterDao.class);
        service.tungstenProviderDao = providerDao;
        service.zoneDao = zoneDao;
    }

    @Test
    public void absentProviderInRequestedZoneReturnsEmptyWithoutBuildingResponse() {
        assertTrue(service.listTungstenProvider(1L).isEmpty());
        verify(providerDao).findByZoneId(1L);
        verify(providerDao, never()).listAll();
        verifyNoInteractions(zoneDao);
    }

    @Test
    public void noProvidersWithoutZoneReturnsEmpty() {
        when(providerDao.listAll()).thenReturn(Collections.emptyList());
        assertTrue(service.listTungstenProvider(null).isEmpty());
        verifyNoInteractions(zoneDao);
    }

    @Test
    public void matchingProviderKeepsResponseFields() {
        TungstenProviderVO provider = provider(1L, "provider-one");
        when(providerDao.findByZoneId(1L)).thenReturn(provider);
        List<BaseResponse> responses = service.listTungstenProvider(1L);
        assertEquals(1, responses.size());
        TungstenFabricProviderResponse response = (TungstenFabricProviderResponse) responses.get(0);
        assertEquals(1L, response.getZoneId());
        assertEquals("zone-1", response.getZoneName());
        assertEquals("provider-one", response.getName());
        assertEquals("provider-one-uuid", response.getUuid());
        assertEquals("192.0.2.1", response.getHostname());
        assertEquals("8082", response.getPort());
    }

    @Test
    public void providerInAnotherZoneIsNotReturned() {
        // A registered provider elsewhere must not turn a Zone-filtered lookup into a global list.
        when(providerDao.listAll()).thenReturn(Arrays.asList(mock(TungstenProviderVO.class)));
        assertTrue(service.listTungstenProvider(2L).isEmpty());
        verify(providerDao, never()).listAll();
        verifyNoInteractions(zoneDao);
    }

    @Test
    public void unfilteredListKeepsAllRegisteredProviders() {
        TungstenProviderVO first = provider(1L, "provider-one");
        TungstenProviderVO second = provider(2L, "provider-two");
        when(providerDao.listAll()).thenReturn(Arrays.asList(first, second));
        List<BaseResponse> responses = service.listTungstenProvider(null);
        assertEquals(2, responses.size());
        assertEquals("provider-one", ((TungstenFabricProviderResponse) responses.get(0)).getName());
        assertEquals("provider-two", ((TungstenFabricProviderResponse) responses.get(1)).getName());
    }

    private TungstenProviderVO provider(long zoneId, String name) {
        TungstenProviderVO provider = mock(TungstenProviderVO.class);
        DataCenterVO zone = mock(DataCenterVO.class);
        when(provider.getZoneId()).thenReturn(zoneId);
        when(provider.getProviderName()).thenReturn(name);
        when(provider.getUuid()).thenReturn(name + "-uuid");
        when(provider.getHostname()).thenReturn("192.0.2.1");
        when(provider.getPort()).thenReturn("8082");
        when(zoneDao.findById(zoneId)).thenReturn(zone);
        when(zone.getName()).thenReturn("zone-" + zoneId);
        return provider;
    }
}
