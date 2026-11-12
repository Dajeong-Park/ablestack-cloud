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
package com.cloud.network.router;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;
import static org.mockito.Mockito.when;

import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.MockitoJUnitRunner;

import com.cloud.dc.DataCenter;
import com.cloud.dc.DataCenterVO;
import com.cloud.dc.dao.DataCenterDao;
import com.cloud.network.Network;
import com.cloud.network.NetworkModel;
import com.cloud.network.dao.NetworkDao;
import com.cloud.network.dao.NetworkVO;
import com.cloud.offerings.NetworkOfferingVO;
import com.cloud.offerings.dao.NetworkOfferingDao;
import com.cloud.utils.exception.CloudRuntimeException;
import com.cloud.vm.DomainRouterVO;
import com.cloud.vm.NicProfile;

@RunWith(MockitoJUnitRunner.class)
public class SharedSubnetRouterBootTest {
    @InjectMocks private VirtualNetworkApplianceManagerImpl manager;
    @Mock private NetworkDao networkDao;
    @Mock private NetworkModel networkModel;
    @Mock private DataCenterDao dcDao;
    @Mock private NetworkOfferingDao offeringDao;
    @Mock private NetworkVO network;
    @Mock private DataCenterVO dc;
    @Mock private NetworkOfferingVO offering;
    @Mock private DomainRouterVO router;
    private final NicProfile nic = new NicProfile();

    @Before
    public void setup() {
        nic.setNetworkId(1L);
        nic.setIPv4Address("10.247.31.51");
        when(networkDao.findById(1L)).thenReturn(network);
        when(network.getDataCenterId()).thenReturn(2L);
        when(network.getNetworkOfferingId()).thenReturn(3L);
        when(dcDao.findById(2L)).thenReturn(dc);
        when(offeringDao.findById(3L)).thenReturn(offering);
        when(dc.getNetworkType()).thenReturn(DataCenter.NetworkType.Advanced);
    }

    @Test
    public void sharedCsvBuildsBootArgumentsForPrimaryNic() {
        when(network.getGuestType()).thenReturn(Network.GuestType.Shared);
        when(networkModel.getValidNetworkCidr(network)).thenReturn("10.247.31.0/24,10.249.31.0/24");
        String args = manager.createGuestBootLoadArgs(nic, router).toString();
        assertTrue(args.contains("cidrsize=24"));
        assertTrue(args.contains("dhcprange=10.247.31."));
        assertFalse(args.contains(","));
        when(network.getCidr()).thenReturn("10.247.31.0/24,10.249.31.0/24");
        assertTrue(new CommandSetupHelper().getGuestDhcpRange(nic, network, dc).startsWith("10.247.31."));
    }

    @Test
    public void sharedNicInSecondSubnetUsesMatchingCidrRatherThanFirst() {
        when(network.getGuestType()).thenReturn(Network.GuestType.Shared);
        when(networkModel.getValidNetworkCidr(network)).thenReturn("10.247.31.0/24, 10.249.31.0/25");
        nic.setIPv4Address("10.249.31.103");
        String args = manager.createGuestBootLoadArgs(nic, router).toString();
        assertTrue(args.contains("cidrsize=25"));
        assertTrue(args.contains("dhcprange=10.249.31."));
        when(network.getCidr()).thenReturn("10.247.31.0/24, 10.249.31.0/25");
        assertTrue(new CommandSetupHelper().getGuestDhcpRange(nic, network, dc).startsWith("10.249.31."));
    }

    @Test
    public void isolatedIpReservationRetainsEffectiveNetworkCidr() {
        when(network.getGuestType()).thenReturn(Network.GuestType.Isolated);
        when(networkModel.getValidNetworkCidr(network)).thenReturn("10.247.31.128/25");
        String args = manager.createGuestBootLoadArgs(nic, router).toString();
        assertTrue(args.contains("cidrsize=25"));
        assertTrue(args.contains("dhcprange=10.247.31.129"));
    }

    @Test
    public void noIpv4CidrDoesNotInventAnIpv4DhcpRange() {
        String args = manager.createGuestBootLoadArgs(nic, router).toString();
        assertFalse(args.contains("dhcprange="));
        assertEquals("", args);
    }

    @Test(expected = CloudRuntimeException.class)
    public void mismatchedSharedNicFailsBeforeEmittingInvalidBootArguments() {
        when(network.getGuestType()).thenReturn(Network.GuestType.Shared);
        when(networkModel.getValidNetworkCidr(network)).thenReturn("10.245.31.0/24,10.249.31.0/24");
        manager.createGuestBootLoadArgs(nic, router);
    }
}
