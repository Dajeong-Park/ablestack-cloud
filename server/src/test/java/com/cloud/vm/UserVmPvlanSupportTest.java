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
package com.cloud.vm;

import java.util.Collections;
import org.junit.Before;
import org.junit.Test;
import org.mockito.Mockito;
import org.springframework.test.util.ReflectionTestUtils;
import com.cloud.exception.InvalidParameterValueException;
import com.cloud.host.HostVO;
import com.cloud.host.Status;
import com.cloud.host.dao.HostDao;
import com.cloud.hypervisor.Hypervisor.HypervisorType;
import com.cloud.network.NetworkModel;
import com.cloud.network.Networks;
import com.cloud.network.dao.NetworkVO;
import com.cloud.resource.ResourceState;

public class UserVmPvlanSupportTest {
    private UserVmManagerImpl manager = new UserVmManagerImpl();
    private HostDao hosts = Mockito.mock(HostDao.class);
    private NetworkModel model = Mockito.mock(NetworkModel.class);
    private NetworkVO network = Mockito.mock(NetworkVO.class);
    private HostVO host = Mockito.mock(HostVO.class);

    @Before
    public void setup() {
        ReflectionTestUtils.setField(manager, "_hostDao", hosts);
        ReflectionTestUtils.setField(manager, "_networkModel", model);
        Mockito.when(network.getDataCenterId()).thenReturn(1L);
        Mockito.when(network.getBroadcastDomainType()).thenReturn(Networks.BroadcastDomainType.Pvlan);
        Mockito.when(model.getNetworkTag(HypervisorType.KVM, network)).thenReturn("qa-pvlan1599");
        Mockito.when(hosts.findById(7L)).thenReturn(host);
        Mockito.when(hosts.listByDataCenterIdAndHypervisorType(1L, HypervisorType.KVM)).thenReturn(Collections.singletonList(host));
        Mockito.when(host.getStatus()).thenReturn(Status.Up);
        Mockito.when(host.getResourceState()).thenReturn(ResourceState.Enabled);
        Mockito.when(host.getDetail("pvlan.guard.version")).thenReturn("1");
    }

    @Test(expected = InvalidParameterValueException.class)
    public void stoppedVmCannotAllocateAnUnsupportedPvlanNic() {
        manager.validatePvlanNetworkSupport(network, HypervisorType.KVM, null);
    }

    @Test(expected = InvalidParameterValueException.class)
    public void vmHostMustSupportTheExactPhysicalBridge() {
        Mockito.when(host.getDetail("pvlan.supported.bridges")).thenReturn("other");
        manager.validatePvlanNetworkSupport(network, HypervisorType.KVM, 7L);
    }

    @Test(expected = InvalidParameterValueException.class)
    public void missingTargetHostCannotAuthorizePvlan() {
        manager.validatePvlanNetworkSupport(network, HypervisorType.KVM, 9L);
    }

    @Test
    public void supportedHostAllowsPvlan() {
        Mockito.when(host.getDetail("pvlan.supported.bridges")).thenReturn("qa-pvlan1599");
        manager.validatePvlanNetworkSupport(network, HypervisorType.KVM, 7L);
    }

    @Test
    public void nativeVlanAndOtherHypervisorsKeepTheirExistingContract() {
        manager.validatePvlanNetworkSupport(network, HypervisorType.VMware, 7L);
        Mockito.when(network.getBroadcastDomainType()).thenReturn(Networks.BroadcastDomainType.Vlan);
        manager.validatePvlanNetworkSupport(network, HypervisorType.KVM, 7L);
        Mockito.verifyNoInteractions(hosts, model);
    }
}
