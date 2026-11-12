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
package org.apache.cloudstack.engine.orchestration;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertSame;
import static org.junit.Assert.fail;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.cloud.deploy.DeployDestination;
import com.cloud.exception.InsufficientVirtualNetworkCapacityException;
import com.cloud.exception.ResourceUnavailableException;
import com.cloud.host.dao.HostDao;
import com.cloud.network.Network;
import com.cloud.network.dao.NetworkVO;
import com.cloud.network.guru.NetworkGuru;
import com.cloud.utils.Pair;
import com.cloud.utils.db.EntityManager;
import com.cloud.vm.NicProfile;
import com.cloud.vm.NicVO;
import com.cloud.vm.ReservationContext;
import org.apache.cloudstack.engine.cloud.entity.api.db.VMNetworkMapVO;
import com.cloud.vm.VirtualMachine;
import com.cloud.vm.VirtualMachineProfile;
import com.cloud.vm.dao.NicDao;
import org.apache.cloudstack.engine.cloud.entity.api.db.dao.VMNetworkMapDao;
import org.junit.Before;
import org.junit.Test;
import org.springframework.test.util.ReflectionTestUtils;

public class NicPreparationRollbackTest {
    private NetworkOrchestrator manager;
    private NicDao nics;
    private VMNetworkMapDao maps;
    private VirtualMachine vm;
    private VirtualMachineProfile profile;
    private NetworkVO network;
    private NicProfile allocated;
    private NicVO row;
    private ReservationContext context;

    @Before
    public void setup() throws Exception {
        manager = spy(new NetworkOrchestrator());
        nics = mock(NicDao.class);
        maps = mock(VMNetworkMapDao.class);
        ReflectionTestUtils.setField(manager, "_nicDao", nics);
        ReflectionTestUtils.setField(manager, "_vmNetworkMapDao", maps);
        ReflectionTestUtils.setField(manager, "_entityMgr", mock(EntityManager.class));
        ReflectionTestUtils.setField(manager, "_hostDao", mock(HostDao.class));
        vm = mock(VirtualMachine.class);
        when(vm.getId()).thenReturn(1L);
        when(vm.getType()).thenReturn(VirtualMachine.Type.User);
        when(vm.getHostId()).thenReturn(3L);
        profile = mock(VirtualMachineProfile.class);
        when(profile.getVirtualMachine()).thenReturn(vm);
        when(profile.getType()).thenReturn(VirtualMachine.Type.User);
        network = mock(NetworkVO.class);
        when(network.getId()).thenReturn(2L);
        allocated = new NicProfile();
        allocated.setId(100L);
        allocated.setUuid("new-nic");
        allocated.setNetworkId(2L);
        row = mock(NicVO.class);
        when(row.getId()).thenReturn(100L);
        when(row.getUuid()).thenReturn("new-nic");
        when(row.getInstanceId()).thenReturn(1L);
        when(row.getNetworkId()).thenReturn(2L);
        when(nics.findById(100L)).thenReturn(row);
        context = mock(ReservationContext.class);
        doReturn(null).when(manager).getNicProfileForVm(any(), any(), any());
        doReturn(new Pair<>(allocated, 0)).when(manager).allocateNic(any(), any(), anyBoolean(), anyInt(), any());
        VMNetworkMapVO map = mock(VMNetworkMapVO.class);
        when(map.getId()).thenReturn(90L);
        when(maps.persist(any(VMNetworkMapVO.class))).thenReturn(map);
        doNothing().when(manager).removeNic(any(VirtualMachineProfile.class), any(NicVO.class));
    }

    @Test
    public void vlanCapacityFailureRemovesOnlyNewNicAndMapping() throws Exception {
        InsufficientVirtualNetworkCapacityException failure = new InsufficientVirtualNetworkCapacityException("No VLAN", Network.class, 2L);
        doThrow(failure).when(manager).implementNetwork(anyLong(), any(), any(), anyBoolean());
        try {
            manager.createNicForVm(network, new NicProfile(), context, profile, true);
            fail("capacity failure must propagate");
        } catch (InsufficientVirtualNetworkCapacityException actual) {
            assertSame(failure, actual);
        }
        verify(manager).removeNic(profile, row);
        verify(maps).remove(90L);
    }

    @Test
    public void prepareFailureAlsoReleasesNewAllocation() throws Exception {
        doReturn(new Pair<>(mock(NetworkGuru.class), network)).when(manager).implementNetwork(anyLong(), any(), any(), anyBoolean());
        doThrow(new ResourceUnavailableException("DHCP failed", Network.class, 2L)).when(manager).prepareNic(eq(profile), any(DeployDestination.class), eq(context), eq(100L), eq(network));
        try {
            manager.createNicForVm(network, new NicProfile(), context, profile, true);
            fail();
        } catch (ResourceUnavailableException expected) { }
        verify(manager).removeNic(profile, row);
        verify(maps).remove(90L);
    }

    @Test
    public void reusedRouterNicIsPreservedOnPreparationFailure() throws Exception {
        when(profile.getType()).thenReturn(VirtualMachine.Type.DomainRouter);
        doReturn(allocated).when(manager).getNicProfileForVm(any(), any(), any());
        doThrow(new RuntimeException("router network failed")).when(manager).implementNetwork(anyLong(), any(), any(), anyBoolean());
        try {
            manager.createNicForVm(network, new NicProfile(), context, profile, true);
            fail();
        } catch (RuntimeException expected) { }
        verify(manager, never()).removeNic(any(VirtualMachineProfile.class), any(NicVO.class));
        verify(maps, never()).remove(anyLong());
    }

    @Test
    public void cleanupFailureDoesNotReplaceOriginalFailure() throws Exception {
        RuntimeException failure = new RuntimeException("implement failed");
        doThrow(failure).when(manager).implementNetwork(anyLong(), any(), any(), anyBoolean());
        doThrow(new RuntimeException("cleanup failed")).when(manager).removeNic(profile, row);
        try {
            manager.createNicForVm(network, new NicProfile(), context, profile, true);
            fail();
        } catch (RuntimeException actual) {
            assertSame(failure, actual);
            assertEquals(1, actual.getSuppressed().length);
        }
        verify(maps, never()).remove(anyLong());
    }

    @Test
    public void identityChangeCannotDeleteAnotherNic() throws Exception {
        when(row.getUuid()).thenReturn("another-nic");
        doThrow(new RuntimeException("implement failed")).when(manager).implementNetwork(anyLong(), any(), any(), anyBoolean());
        try {
            manager.createNicForVm(network, new NicProfile(), context, profile, true);
            fail();
        } catch (RuntimeException expected) { assertEquals(1, expected.getSuppressed().length); }
        verify(manager, never()).removeNic(any(VirtualMachineProfile.class), any(NicVO.class));
    }

    @Test
    public void stoppedAllocationRemainsForNextStart() throws Exception {
        assertSame(allocated, manager.createNicForVm(network, new NicProfile(), context, profile, false));
        verify(manager, never()).implementNetwork(anyLong(), any(), any(), anyBoolean());
        verify(manager, never()).removeNic(any(VirtualMachineProfile.class), any(NicVO.class));
    }

    @Test
    public void missingPreparedNicRollsBackInsteadOfReturningSuccess() throws Exception {
        doReturn(new Pair<>(mock(NetworkGuru.class), network)).when(manager).implementNetwork(anyLong(), any(), any(), anyBoolean());
        doReturn(null).when(manager).prepareNic(eq(profile), any(DeployDestination.class), eq(context), eq(100L), eq(network));
        try {
            manager.createNicForVm(network, new NicProfile(), context, profile, true);
            fail();
        } catch (RuntimeException expected) {
            assertEquals("NIC preparation did not return a NIC", expected.getMessage());
        }
        verify(manager).removeNic(profile, row);
    }
}
