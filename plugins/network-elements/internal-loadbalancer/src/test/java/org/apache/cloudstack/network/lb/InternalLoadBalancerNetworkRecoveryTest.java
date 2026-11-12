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
package org.apache.cloudstack.network.lb;

import static org.junit.Assert.assertSame;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;

import org.junit.Test;
import org.junit.runner.RunWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.MockitoJUnitRunner;

import org.apache.cloudstack.engine.orchestration.service.NetworkOrchestrationService;
import org.apache.cloudstack.framework.jobs.dao.VmWorkJobDao;
import org.apache.cloudstack.framework.jobs.impl.VmWorkJobVO;

import com.cloud.exception.ConcurrentOperationException;
import com.cloud.exception.ResourceUnavailableException;
import com.cloud.network.Network;
import com.cloud.network.dao.NetworkDao;
import com.cloud.network.dao.NetworkVO;
import com.cloud.user.AccountManager;
import com.cloud.utils.exception.CloudRuntimeException;
import com.cloud.utils.net.Ip;
import com.cloud.vm.DomainRouterVO;
import com.cloud.vm.VirtualMachine;
import com.cloud.vm.dao.DomainRouterDao;

@RunWith(MockitoJUnitRunner.class)
public class InternalLoadBalancerNetworkRecoveryTest {
    @Spy @InjectMocks private InternalLoadBalancerVMManagerImpl manager;
    @Mock private NetworkDao networks;
    @Mock private DomainRouterDao routers;
    @Mock private NetworkOrchestrationService networkService;
    @Mock private AccountManager accounts;
    @Mock private VmWorkJobDao workJobs;

    private NetworkVO network(Network.State state) {
        NetworkVO network = mock(NetworkVO.class);
        when(network.getState()).thenReturn(state);
        org.mockito.Mockito.lenient().when(network.getId()).thenReturn(633L);
        return network;
    }

    @Test
    public void allocatedNetworkDoesNotRunCleanup() throws Exception {
        NetworkVO allocated = network(Network.State.Allocated);
        assertSame(allocated, manager.recoverFailedNetworkStartup(allocated));
        verify(networkService, never()).shutdownNetwork(anyLong(), any(), anyBoolean());
    }

    @Test
    public void stoppedControllerUsesNormalShutdownAndReload() throws Exception {
        NetworkVO failed = network(Network.State.Shutdown);
        DomainRouterVO vm = mock(DomainRouterVO.class);
        when(vm.getState()).thenReturn(VirtualMachine.State.Stopped);
        when(routers.listByNetworkAndRole(633L, com.cloud.network.router.VirtualRouter.Role.INTERNAL_LB_VM)).thenReturn(List.of(vm));
        when(networkService.shutdownNetwork(eq(633L), any(), eq(false))).thenReturn(true);
        NetworkVO allocated = network(Network.State.Allocated);
        when(networks.findById(633L)).thenReturn(allocated);
        assertSame(allocated, manager.recoverFailedNetworkStartup(failed));
        verify(networkService).shutdownNetwork(eq(633L), any(), eq(false));
    }

    @Test(expected = ConcurrentOperationException.class)
    public void activeUserNicBlocksCleanup() throws Exception {
        NetworkVO failed = network(Network.State.Shutdown);
        when(networks.getActiveNicsIn(633L)).thenReturn(1);
        try {
            manager.recoverFailedNetworkStartup(failed);
        } finally {
            verify(networkService, never()).shutdownNetwork(anyLong(), any(), anyBoolean());
        }
    }

    @Test
    public void runningOrPendingControllerBlocksCleanup() throws Exception {
        for (VirtualMachine.State state : List.of(VirtualMachine.State.Running, VirtualMachine.State.Starting, VirtualMachine.State.Stopping)) {
            NetworkVO failed = network(Network.State.Shutdown);
            DomainRouterVO vm = mock(DomainRouterVO.class);
            when(vm.getState()).thenReturn(state);
            when(routers.listByNetworkAndRole(633L, com.cloud.network.router.VirtualRouter.Role.INTERNAL_LB_VM)).thenReturn(List.of(vm));
            try {
                manager.recoverFailedNetworkStartup(failed);
                org.junit.Assert.fail("Controller in " + state + " must prevent cleanup");
            } catch (ConcurrentOperationException expected) {
                verify(networkService, never()).shutdownNetwork(anyLong(), any(), anyBoolean());
            }
        }
    }

    @Test(expected = ConcurrentOperationException.class)
    public void stoppedControllerWithPendingWorkStillBlocksCleanup() throws Exception {
        DomainRouterVO vm = mock(DomainRouterVO.class);
        when(vm.getState()).thenReturn(VirtualMachine.State.Stopped);
        when(vm.getId()).thenReturn(1008L);
        when(routers.listByNetworkAndRole(633L, com.cloud.network.router.VirtualRouter.Role.INTERNAL_LB_VM)).thenReturn(List.of(vm));
        when(workJobs.findPendingWorkJob(VirtualMachine.Type.Instance, 1008L)).thenReturn(mock(VmWorkJobVO.class));
        try {
            manager.recoverFailedNetworkStartup(network(Network.State.Shutdown));
        } finally {
            verify(networkService, never()).shutdownNetwork(anyLong(), any(), anyBoolean());
        }
    }

    @Test(expected = ResourceUnavailableException.class)
    public void failedShutdownIsNotReportedAsRecovered() throws Exception {
        manager.recoverFailedNetworkStartup(network(Network.State.Shutdown));
    }

    @Test(expected = ResourceUnavailableException.class)
    public void successWithoutAllocatedStateIsNotReportedAsRecovered() throws Exception {
        when(networkService.shutdownNetwork(eq(633L), any(), eq(false))).thenReturn(true);
        NetworkVO stillShutdown = network(Network.State.Shutdown);
        when(networks.findById(633L)).thenReturn(stillShutdown);
        manager.recoverFailedNetworkStartup(network(Network.State.Shutdown));
    }

    @Test
    public void failedStartCleansUpAfterUnwindAndKeepsOriginalFailure() throws Exception {
        NetworkVO allocated = network(Network.State.Allocated);
        List<DomainRouterVO> vms = List.of(mock(DomainRouterVO.class));
        doReturn(vms).when(manager).findOrDeployInternalLbVm(eq(allocated), any(), any(), any(), any());
        CloudRuntimeException original = new CloudRuntimeException("original deployment failure");
        doThrow(original).when(manager).startInternalLbVms(any(), eq(vms));
        NetworkVO failed = network(Network.State.Shutdown);
        when(networks.findById(633L)).thenReturn(failed, allocated);
        when(networkService.shutdownNetwork(eq(633L), any(), eq(false))).thenReturn(true);
        try {
            manager.deployInternalLbVm(allocated, new Ip("10.248.31.39"), null, null, null);
            org.junit.Assert.fail("Expected original failure");
        } catch (CloudRuntimeException failure) {
            assertSame(original, failure);
            verify(networkService).shutdownNetwork(eq(633L), any(), eq(false));
        }
    }
}
