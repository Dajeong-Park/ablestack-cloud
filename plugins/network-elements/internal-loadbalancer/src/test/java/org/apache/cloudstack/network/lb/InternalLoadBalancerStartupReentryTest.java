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

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertSame;
import static org.junit.Assert.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;

import org.junit.Test;
import org.junit.runner.RunWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockedStatic;
import org.mockito.Spy;
import org.mockito.junit.MockitoJUnitRunner;

import org.apache.cloudstack.framework.jobs.AsyncJobExecutionContext;
import org.apache.cloudstack.framework.jobs.impl.VmWorkJobVO;
import org.apache.cloudstack.framework.jobs.AsyncJob;
import org.apache.cloudstack.framework.jobs.dao.VmWorkJobDao;

import com.cloud.exception.ResourceUnavailableException;
import com.cloud.network.Network;
import com.cloud.network.lb.LoadBalancingRule;
import com.cloud.vm.DomainRouterVO;
import com.cloud.vm.VirtualMachine;
import com.cloud.vm.VirtualMachineManager;
import com.cloud.vm.dao.DomainRouterDao;

@RunWith(MockitoJUnitRunner.class)
public class InternalLoadBalancerStartupReentryTest {
    @Spy @InjectMocks private InternalLoadBalancerVMManagerImpl manager;
    @Mock private VirtualMachineManager vmManager;
    @Mock private DomainRouterDao vmDao;
    @Mock private VmWorkJobDao workJobDao;

    private DomainRouterVO startingVm() {
        DomainRouterVO vm = mock(DomainRouterVO.class);
        when(vm.getState()).thenReturn(VirtualMachine.State.Starting);
        org.mockito.Mockito.lenient().when(vm.getId()).thenReturn(1006L);
        return vm;
    }

    private MockedStatic<AsyncJobExecutionContext> context(long vmId, String cmd) {
        AsyncJobExecutionContext context = mock(AsyncJobExecutionContext.class);
        VmWorkJobVO job = mock(VmWorkJobVO.class);
        org.mockito.Mockito.lenient().when(job.getVmInstanceId()).thenReturn(vmId);
        org.mockito.Mockito.lenient().when(job.getCmd()).thenReturn(cmd);
        when(context.getJob()).thenReturn(job);
        MockedStatic<AsyncJobExecutionContext> scoped = mockStatic(AsyncJobExecutionContext.class);
        scoped.when(AsyncJobExecutionContext::getCurrent).thenReturn(context);
        return scoped;
    }

    @Test
    public void sameVmStartDoesNotReenterTheVmStateMachine() throws Exception {
        DomainRouterVO vm = startingVm();
        when(vmDao.findById(1006L)).thenReturn(vm);
        try (MockedStatic<AsyncJobExecutionContext> ignored = context(1006L, "com.cloud.vm.VmWorkStart")) {
            assertSame(vm, manager.startInternalLbVm(vm, null, 1L, null));
            verify(vmManager, never()).start(anyString(), any(), any(), any());
        }
    }

    @Test
    public void baseAsyncJobResolvesTheTypedVmWorkRecord() {
        DomainRouterVO vm = startingVm();
        AsyncJob base = mock(AsyncJob.class);
        when(base.getCmd()).thenReturn("com.cloud.vm.VmWorkStart");
        when(base.getId()).thenReturn(20798L);
        AsyncJobExecutionContext context = mock(AsyncJobExecutionContext.class);
        when(context.getJob()).thenReturn(base);
        VmWorkJobVO work = mock(VmWorkJobVO.class);
        when(work.getVmInstanceId()).thenReturn(1006L);
        when(workJobDao.findById(20798L)).thenReturn(work);
        try (MockedStatic<AsyncJobExecutionContext> scoped = mockStatic(AsyncJobExecutionContext.class)) {
            scoped.when(AsyncJobExecutionContext::getCurrent).thenReturn(context);
            assertTrue(manager.isCurrentVmStart(vm));
        }
    }

    @Test
    public void sameVmStopJobDoesNotBypassStartOrDeferRules() {
        DomainRouterVO vm = startingVm();
        try (MockedStatic<AsyncJobExecutionContext> ignored = context(1006L, "com.cloud.vm.VmWorkStop")) {
            assertFalse(manager.isCurrentVmStart(vm));
        }
    }

    @Test
    public void otherVmStartDoesNotBypassStartOrDeferRules() {
        DomainRouterVO vm = startingVm();
        try (MockedStatic<AsyncJobExecutionContext> ignored = context(1005L, "com.cloud.vm.VmWorkStart")) {
            assertFalse(manager.isCurrentVmStart(vm));
        }
    }

    @Test
    public void noVmWorkContextDoesNotBypassStart() {
        DomainRouterVO vm = startingVm();
        try (MockedStatic<AsyncJobExecutionContext> scoped = mockStatic(AsyncJobExecutionContext.class)) {
            assertFalse(manager.isCurrentVmStart(vm));
        }
    }

    @Test
    public void onlyOwnImplementingNetworkDefersRulesUntilFinalization() throws Exception {
        DomainRouterVO vm = startingVm();
        Network network = mock(Network.class);
        when(network.getState()).thenReturn(Network.State.Implementing);
        try (MockedStatic<AsyncJobExecutionContext> ignored = context(1006L, "com.cloud.vm.VmWorkStart")) {
            assertTrue(manager.applyLoadBalancingRules(network, List.of(mock(LoadBalancingRule.class)), List.of(vm)));
            verify(manager, never()).sendLBRules(any(), any(), anyLong());
        }
    }

    @Test(expected = ResourceUnavailableException.class)
    public void startingVmStillRejectsRulesOutsideOwnNetworkImplementation() throws Exception {
        DomainRouterVO vm = startingVm();
        Network network = mock(Network.class);
        when(network.getState()).thenReturn(Network.State.Implemented);
        // This path must keep the ordinary Starting-state failure even with a matching job.
        manager.applyLoadBalancingRules(network, List.of(mock(LoadBalancingRule.class)), List.of(vm));
    }

    @Test
    public void runningVmStillProgramsRulesImmediately() throws Exception {
        DomainRouterVO vm = mock(DomainRouterVO.class);
        when(vm.getState()).thenReturn(VirtualMachine.State.Running);
        Network network = mock(Network.class);
        when(network.getId()).thenReturn(42L);
        List<LoadBalancingRule> rules = List.of(mock(LoadBalancingRule.class));
        doReturn(true).when(manager).sendLBRules(vm, rules, 42L);
        assertTrue(manager.applyLoadBalancingRules(network, rules, List.of(vm)));
        verify(manager).sendLBRules(vm, rules, 42L);
    }
}
