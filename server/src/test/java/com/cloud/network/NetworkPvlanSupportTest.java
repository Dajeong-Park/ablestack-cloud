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

import java.util.Collections;
import org.junit.Before;
import org.junit.Test;
import org.mockito.Mockito;
import com.cloud.host.HostVO;
import com.cloud.host.Status;
import com.cloud.host.dao.HostDao;
import com.cloud.hypervisor.Hypervisor.HypervisorType;
import com.cloud.network.dao.PhysicalNetworkTrafficTypeDao;
import com.cloud.resource.ResourceState;
import com.cloud.exception.InvalidParameterValueException;

public class NetworkPvlanSupportTest {
    private NetworkServiceImpl service = new NetworkServiceImpl();
    private HostDao hosts = Mockito.mock(HostDao.class);
    private PhysicalNetworkTrafficTypeDao traffic = Mockito.mock(PhysicalNetworkTrafficTypeDao.class);
    private HostVO host = Mockito.mock(HostVO.class);

    @Before
    public void setup() {
        service._hostDao = hosts; service._pNTrafficTypeDao = traffic;
        Mockito.when(hosts.listByDataCenterIdAndHypervisorType(1L, HypervisorType.KVM)).thenReturn(Collections.singletonList(host));
        Mockito.when(traffic.getNetworkTag(2L, Networks.TrafficType.Guest, HypervisorType.KVM)).thenReturn("qa-pvlan1599");
        Mockito.when(host.getStatus()).thenReturn(Status.Up);
        Mockito.when(host.getResourceState()).thenReturn(ResourceState.Enabled);
    }

    @Test(expected = InvalidParameterValueException.class)
    public void oldAgentIsUnknownAndCannotAuthorizePvlan() { service.validateKvmPvlanSupport(1, 2); }

    @Test(expected = InvalidParameterValueException.class)
    public void nativeBridgeIsUnsupported() {
        Mockito.when(host.getDetail("pvlan.guard.version")).thenReturn("1");
        Mockito.when(host.getDetail("pvlan.supported.bridges")).thenReturn("");
        service.validateKvmPvlanSupport(1, 2);
    }

    @Test
    public void exactPhysicalNetworkBridgeIsSupported() {
        Mockito.when(host.getDetail("pvlan.guard.version")).thenReturn("1");
        Mockito.when(host.getDetail("pvlan.supported.bridges")).thenReturn("other,qa-pvlan1599");
        service.validateKvmPvlanSupport(1, 2);
    }

    @Test(expected = InvalidParameterValueException.class)
    public void bridgeNamePrefixIsNotSupport() {
        Mockito.when(host.getDetail("pvlan.guard.version")).thenReturn("1");
        Mockito.when(host.getDetail("pvlan.supported.bridges")).thenReturn("qa-pvlan1599-other");
        service.validateKvmPvlanSupport(1, 2);
    }

    @Test(expected = InvalidParameterValueException.class)
    public void disconnectedHostCannotAuthorizeNewNetwork() {
        Mockito.when(host.getStatus()).thenReturn(Status.Disconnected);
        service.validateKvmPvlanSupport(1, 2);
    }

    @Test
    public void mixedZoneNetworkCreationDoesNotChangeOtherHypervisorContracts() {
        Mockito.when(hosts.listDistinctHypervisorTypes(1L)).thenReturn(java.util.Arrays.asList(HypervisorType.KVM, HypervisorType.VMware));
        service.validateKvmPvlanSupport(1, 2);
        Mockito.verify(hosts, Mockito.never()).loadDetails(host);
    }
}
