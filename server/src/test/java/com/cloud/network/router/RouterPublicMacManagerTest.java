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
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Collections;
import java.util.Date;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;

import org.apache.cloudstack.network.router.deployment.RouterDeploymentDefinition;
import org.apache.cloudstack.resourcedetail.UserIpAddressDetailVO;
import org.apache.cloudstack.resourcedetail.dao.UserIpAddressDetailsDao;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.mockito.MockedStatic;
import org.springframework.test.util.ReflectionTestUtils;

import com.cloud.network.IpAddress;
import com.cloud.network.Network;
import com.cloud.network.Networks.TrafficType;
import com.cloud.network.addr.PublicIp;
import com.cloud.network.dao.IPAddressDao;
import com.cloud.network.dao.IPAddressVO;
import com.cloud.network.dao.NetworkDao;
import com.cloud.network.vpc.Vpc;
import com.cloud.network.vpc.dao.VpcDao;
import com.cloud.user.Account;
import com.cloud.utils.db.Transaction;
import com.cloud.utils.db.TransactionCallback;
import com.cloud.utils.exception.CloudRuntimeException;
import com.cloud.utils.net.Ip;
import com.cloud.vm.DomainRouterVO;
import com.cloud.vm.NicVO;
import com.cloud.vm.VirtualMachine;
import com.cloud.vm.dao.DomainRouterDao;
import com.cloud.vm.dao.NicDao;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

public class RouterPublicMacManagerTest {
    private static final String MAC = "1e:01:aa:00:00:07";
    private RouterPublicMacManager manager;
    private IPAddressVO ip;
    private DomainRouterVO router;
    private NicVO nic;
    private Network publicNetwork;
    private Network network;
    private Account owner;
    private RouterDeploymentDefinition deployment;
    private AtomicReference<UserIpAddressDetailVO> receipt;
    private MockedStatic<Transaction> transaction;

    @Before
    @SuppressWarnings({"unchecked", "rawtypes"})
    public void setUp() {
        transaction = mockStatic(Transaction.class);
        transaction.when(() -> Transaction.execute(any(TransactionCallback.class))).thenAnswer(call -> ((TransactionCallback)call.getArgument(0)).doInTransaction(null));
        manager = new RouterPublicMacManager();
        manager.ipAddresses = mock(IPAddressDao.class);
        manager.details = mock(UserIpAddressDetailsDao.class);
        manager.routers = mock(DomainRouterDao.class);
        manager.networks = mock(NetworkDao.class);
        manager.vpcs = mock(VpcDao.class);
        manager.nics = mock(NicDao.class);
        ip = new IPAddressVO(new Ip("10.10.1.100"), 1L, 7L, 50L, true);
        ReflectionTestUtils.setField(ip, "id", 7L);
        ip.setAllocatedToAccountId(4L);
        ip.setAllocatedInDomainId(5L);
        ip.setAllocatedTime(new Date(100000));
        ip.setAssociatedWithNetworkId(20L);
        ip.setSourceNetworkId(10L);
        ip.setState(IpAddress.State.Allocated);
        publicNetwork = mock(Network.class);
        when(publicNetwork.getId()).thenReturn(10L);
        when(publicNetwork.getTrafficType()).thenReturn(TrafficType.Public);
        when(publicNetwork.getDataCenterId()).thenReturn(1L);
        network = mock(Network.class);
        when(network.getId()).thenReturn(20L);
        when(network.getAccountId()).thenReturn(4L);
        when(network.getDataCenterId()).thenReturn(1L);
        when(network.getGuestType()).thenReturn(Network.GuestType.Isolated);
        when(network.getVpcId()).thenReturn(null);
        when(manager.networks.findById(10L)).thenReturn((com.cloud.network.dao.NetworkVO)null);
        com.cloud.network.dao.NetworkVO publicVo = mock(com.cloud.network.dao.NetworkVO.class);
        when(publicVo.getTrafficType()).thenReturn(TrafficType.Public);
        when(manager.networks.findById(10L)).thenReturn(publicVo);
        com.cloud.network.dao.NetworkVO networkVo = mock(com.cloud.network.dao.NetworkVO.class);
        when(networkVo.getGuestType()).thenReturn(Network.GuestType.Isolated);
        when(networkVo.getAccountId()).thenReturn(4L);
        when(networkVo.getVpcId()).thenReturn(null);
        when(manager.networks.findById(20L)).thenReturn(networkVo);
        router = mock(DomainRouterVO.class);
        when(router.getId()).thenReturn(30L);
        when(router.getAccountId()).thenReturn(4L);
        when(router.getRole()).thenReturn(VirtualRouter.Role.VIRTUAL_ROUTER);
        when(router.getState()).thenReturn(VirtualMachine.State.Running);
        when(router.getVpcId()).thenReturn(null);
        when(router.getPublicIpAddress()).thenReturn(ip.getAddress().addr());
        when(router.getPublicMacAddress()).thenReturn(MAC);
        when(manager.routers.getRouterNetworks(30L)).thenReturn(List.of(20L));
        when(manager.ipAddresses.listByAssociatedNetwork(20L, true)).thenReturn(List.of(ip));
        when(manager.ipAddresses.lockRow(7L, true)).thenReturn(ip);
        when(manager.ipAddresses.update(7L, ip)).thenReturn(true);
        nic = mock(NicVO.class);
        when(nic.getInstanceId()).thenReturn(30L);
        when(nic.getVmType()).thenReturn(VirtualMachine.Type.DomainRouter);
        when(nic.getNetworkId()).thenReturn(10L);
        when(nic.getIPv4Address()).thenReturn(ip.getAddress().addr());
        when(nic.getMacAddress()).thenReturn(MAC);
        when(manager.nics.listByVmId(30L)).thenReturn(List.of(nic));
        PublicIp sourceNat = mock(PublicIp.class);
        when(sourceNat.ip()).thenReturn(ip);
        owner = mock(Account.class);
        when(owner.getId()).thenReturn(4L);
        deployment = mock(RouterDeploymentDefinition.class);
        when(deployment.getSourceNatIP()).thenReturn(sourceNat);
        when(deployment.getOwner()).thenReturn(owner);
        when(deployment.getGuestNetwork()).thenReturn(network);
        when(deployment.getVpc()).thenReturn(null);
        receipt = new AtomicReference<>();
        when(manager.details.findDetail(7L, RouterPublicMacManager.DETAIL)).thenAnswer(call -> receipt.get());
        doAnswer(call -> {
            receipt.set(new UserIpAddressDetailVO(7L, RouterPublicMacManager.DETAIL, call.getArgument(2), false));
            return null;
        }).when(manager.details).addDetail(eq(7L), eq(RouterPublicMacManager.DETAIL), anyString(), eq(false));
    }

    @After public void tearDown() { transaction.close(); }

    @Test public void captureSurvivesNicRemovalAndRepeatedReimplementation() {
        manager.preserve(router);
        assertNotNull(receipt.get());
        when(manager.nics.listByVmId(30L)).thenReturn(Collections.emptyList());
        for (int i = 0; i < 4; i++) {
            assertEquals(MAC, manager.findRetainedMac(publicNetwork, deployment));
        }
    }

    @Test public void sameTimestampIpReuseDoesNotInheritOldMac() {
        manager.preserve(router);
        Date sameTimestamp = ip.getAllocatedTime();
        ip.setAllocatedTime(sameTimestamp);
        assertNull(manager.findRetainedMac(publicNetwork, deployment));
    }

    @Test public void releasedAddressCannotRestoreMac() {
        manager.preserve(router);
        ip.setAllocatedTime(null);
        ip.setState(IpAddress.State.Free);
        assertNull(manager.findRetainedMac(publicNetwork, deployment));
    }

    @Test public void anotherAccountCannotUseTheReceipt() {
        manager.preserve(router);
        when(owner.getId()).thenReturn(9L);
        assertNull(manager.findRetainedMac(publicNetwork, deployment));
    }

    @Test public void anotherNetworkCannotUseTheReceipt() {
        manager.preserve(router);
        when(network.getId()).thenReturn(21L);
        assertNull(manager.findRetainedMac(publicNetwork, deployment));
    }

    @Test public void publicNetworkAndVlanMustMatchTheAllocation() {
        manager.preserve(router);
        when(publicNetwork.getId()).thenReturn(11L);
        assertNull(manager.findRetainedMac(publicNetwork, deployment));
        when(publicNetwork.getId()).thenReturn(10L);
        ip.setVlanId(51L);
        assertNull(manager.findRetainedMac(publicNetwork, deployment));
    }

    @Test public void legacyAllocationGetsAReceiptWithoutChangingAllocationTime() {
        ip.setAllocationGeneration(null);
        Date allocated = ip.getAllocatedTime();
        manager.preserve(router);
        assertNotNull(ip.getAllocationGeneration());
        assertEquals(allocated, ip.getAllocatedTime());
        assertEquals(MAC, manager.findRetainedMac(publicNetwork, deployment));
        verify(manager.ipAddresses).update(7L, ip);
    }

    @Test public void removedOrMismatchedNicIsNeverACaptureSource() {
        when(nic.getRemoved()).thenReturn(new Date());
        manager.preserve(router);
        assertNull(receipt.get());
        when(nic.getRemoved()).thenReturn(null);
        when(nic.getMacAddress()).thenReturn("1e:01:bb:00:00:07");
        manager.preserve(router);
        assertNull(receipt.get());
    }

    @Test public void foreignRouterAndFailedCandidateCannotOverwriteReceipt() {
        when(router.getAccountId()).thenReturn(9L);
        manager.preserve(router);
        assertNull(receipt.get());
        when(router.getAccountId()).thenReturn(4L);
        when(router.getState()).thenReturn(VirtualMachine.State.Error);
        manager.preserve(router);
        assertNull(receipt.get());
    }

    @Test public void allocationRaceStopsDestructionInsteadOfCapturingAnotherReceipt() {
        IPAddressVO replacement = new IPAddressVO(new Ip("10.10.1.100"), 1L, 7L, 50L, true);
        replacement.setAllocatedToAccountId(4L);
        replacement.setAllocatedInDomainId(5L);
        replacement.setAllocatedTime(ip.getAllocatedTime());
        replacement.setState(IpAddress.State.Allocated);
        when(manager.ipAddresses.lockRow(7L, true)).thenReturn(replacement);
        assertThrows(CloudRuntimeException.class, () -> manager.preserve(router));
        assertNull(receipt.get());
    }

    @Test public void vpcPrimarySourceNatUsesVpcScope() {
        Vpc vpc = mock(Vpc.class);
        when(vpc.getId()).thenReturn(60L);
        when(vpc.getAccountId()).thenReturn(4L);
        when(vpc.getZoneId()).thenReturn(1L);
        ip.setAssociatedWithNetworkId(null);
        ip.setVpcId(60L);
        when(router.getVpcId()).thenReturn(60L);
        when(manager.vpcs.findById(60L)).thenReturn((com.cloud.network.vpc.VpcVO)null);
        com.cloud.network.vpc.VpcVO vpcVo = mock(com.cloud.network.vpc.VpcVO.class);
        when(vpcVo.getId()).thenReturn(60L);
        when(vpcVo.getAccountId()).thenReturn(4L);
        when(manager.vpcs.findById(60L)).thenReturn(vpcVo);
        when(manager.ipAddresses.listByAssociatedVpc(60L, true)).thenReturn(List.of(ip));
        when(deployment.getVpc()).thenReturn(vpc);
        manager.preserve(router);
        assertEquals(MAC, manager.findRetainedMac(publicNetwork, deployment));
        when(vpc.getId()).thenReturn(61L);
        assertNull(manager.findRetainedMac(publicNetwork, deployment));
    }

    @Test public void malformedMatchingReceiptFailsBeforeChoosingAnArbitraryMac() {
        receipt.set(new UserIpAddressDetailVO(7L, RouterPublicMacManager.DETAIL, "{", false));
        assertThrows(CloudRuntimeException.class, () -> manager.findRetainedMac(publicNetwork, deployment));
    }

    @Test public void multicastAndUnsupportedReceiptVersionsAreNotReusable() {
        manager.preserve(router);
        JsonObject value = JsonParser.parseString(receipt.get().getValue()).getAsJsonObject();
        value.addProperty("mac", "ff:ff:ff:ff:ff:ff");
        receipt.set(new UserIpAddressDetailVO(7L, RouterPublicMacManager.DETAIL, value.toString(), false));
        assertThrows(CloudRuntimeException.class, () -> manager.findRetainedMac(publicNetwork, deployment));
        value.addProperty("version", 2);
        receipt.set(new UserIpAddressDetailVO(7L, RouterPublicMacManager.DETAIL, value.toString(), false));
        assertNull(manager.findRetainedMac(publicNetwork, deployment));
    }

    @Test public void missingReceiptLeavesNewAllocationsUnchanged() {
        assertNull(manager.findRetainedMac(publicNetwork, deployment));
        verify(manager.details, never()).addDetail(anyLong(), anyString(), anyString(), anyBoolean());
    }
}
