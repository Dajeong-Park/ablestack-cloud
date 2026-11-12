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
package com.cloud.hypervisor.kvm.resource;

import java.net.URI;
import org.junit.Assert;
import org.junit.Test;
import org.mockito.Mockito;
import com.cloud.agent.api.Answer;
import com.cloud.agent.api.PvlanSetupCommand;
import com.cloud.agent.api.to.NicTO;
import com.cloud.exception.InternalErrorException;
import com.cloud.hypervisor.kvm.resource.wrapper.LibvirtPvlanSetupCommandWrapper;
import com.cloud.network.Networks;

public class LibvirtGuardedPvlanTest {
    private static final String BRIDGE = "qa-pvlan1599";
    private static final String MAC = "02:15:99:00:00:11";

    @Test
    public void physicalNetworkLabelAndPolicyFailureArePreserved() throws Exception {
        LibvirtComputingResource resource = Mockito.mock(LibvirtComputingResource.class);
        Mockito.when(resource.getVifDriver(Networks.TrafficType.Guest, BRIDGE)).thenReturn(Mockito.mock(OvsVifDriver.class));
        Mockito.when(resource.executeGuardedPvlan("add", BRIDGE, "2860", "2870", "I", MAC)).thenReturn("bundle rejected");
        PvlanSetupCommand command = PvlanSetupCommand.createVmSetup("add", new URI("pvlan://2860-i2870"), BRIDGE, MAC);
        Answer answer = new LibvirtPvlanSetupCommandWrapper().execute(command, resource);
        Assert.assertFalse(answer.getResult());
        Assert.assertEquals("bundle rejected", answer.getDetails());
        Mockito.verify(resource, Mockito.never()).getGuestBridgeName();
    }

    @Test
    public void nativeSetupFailsButOldMiswiredNicCanBeRemoved() throws Exception {
        LibvirtComputingResource resource = Mockito.mock(LibvirtComputingResource.class);
        Mockito.when(resource.getVifDriver(Networks.TrafficType.Guest, BRIDGE)).thenReturn(Mockito.mock(BridgeVifDriver.class));
        LibvirtPvlanSetupCommandWrapper wrapper = new LibvirtPvlanSetupCommandWrapper();
        Assert.assertFalse(wrapper.execute(PvlanSetupCommand.createVmSetup("add", new URI("pvlan://2860-i2870"), BRIDGE, MAC), resource).getResult());
        Assert.assertTrue(wrapper.execute(PvlanSetupCommand.createVmSetup("delete", new URI("pvlan://2860-i2870"), BRIDGE, MAC), resource).getResult());
        Mockito.verify(resource, Mockito.never()).executeGuardedPvlan(Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any());
    }

    @Test
    public void dhcpRouterUsesPromiscuousPolicyWithoutOverwritingFailure() throws Exception {
        LibvirtComputingResource resource = Mockito.mock(LibvirtComputingResource.class);
        Mockito.when(resource.getVifDriver(Networks.TrafficType.Guest, BRIDGE)).thenReturn(Mockito.mock(OvsVifDriver.class));
        Mockito.when(resource.executeGuardedPvlan("add", BRIDGE, "2860", "2860", "P", MAC)).thenReturn("policy failed");
        PvlanSetupCommand command = PvlanSetupCommand.createDhcpSetup("add", new URI("pvlan://2860-i2870"), BRIDGE, "r-1-VM", MAC, "10.0.0.1");
        Assert.assertFalse(new LibvirtPvlanSetupCommandWrapper().execute(command, resource).getResult());
    }

    @Test(expected = InternalErrorException.class)
    public void ovsDoesNotCreateInterfaceWhenPolicyPreflightFails() throws Exception {
        LibvirtComputingResource resource = Mockito.mock(LibvirtComputingResource.class);
        Mockito.when(resource.executeGuardedPvlan("prepare", BRIDGE, null, null, null, null)).thenReturn("unmanaged NORMAL flow");
        OvsVifDriver driver = new OvsVifDriver();
        org.springframework.test.util.ReflectionTestUtils.setField(driver, "_libvirtComputingResource", resource);
        NicTO nic = new NicTO(); nic.setBroadcastType(Networks.BroadcastDomainType.Pvlan);
        nic.setBroadcastUri(new URI("pvlan://2860-i2870")); nic.setName(BRIDGE);
        driver.plug(nic, "Other PV", "virtio", null);
    }
}
