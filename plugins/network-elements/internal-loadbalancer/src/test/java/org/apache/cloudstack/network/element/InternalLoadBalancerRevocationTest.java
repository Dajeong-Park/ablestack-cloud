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

package org.apache.cloudstack.network.element;

import static org.junit.Assert.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Collections;
import java.util.List;

import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.MockitoJUnitRunner;

import org.apache.cloudstack.lb.dao.ApplicationLoadBalancerRuleDao;
import org.apache.cloudstack.network.lb.InternalLoadBalancerVMManager;

import com.cloud.dc.DataCenter;
import com.cloud.network.Network;
import com.cloud.network.lb.LoadBalancingRule;
import com.cloud.network.lb.LoadBalancingRule.LbDestination;
import com.cloud.network.router.VirtualRouter;
import com.cloud.network.rules.FirewallRule;
import com.cloud.user.AccountManager;
import com.cloud.utils.db.EntityManager;
import com.cloud.utils.exception.CloudRuntimeException;
import com.cloud.utils.net.Ip;
import com.cloud.vm.VirtualMachine;

@RunWith(MockitoJUnitRunner.class)
public class InternalLoadBalancerRevocationTest {
    @InjectMocks private InternalLoadBalancerElement element;
    @Mock private InternalLoadBalancerVMManager manager;
    @Mock private ApplicationLoadBalancerRuleDao rulesDao;
    @Mock private AccountManager accounts;
    @Mock private EntityManager entities;
    @Mock private Network network;
    private final Ip sourceIp = new Ip("10.248.31.39");

    @Before
    public void setUp() {
        when(network.getId()).thenReturn(42L);
        // Temporary network shutdown leaves the persisted rule active.
        when(rulesDao.countBySourceIpAndNotRevoked(sourceIp, 42L)).thenReturn(1L);
    }

    private LoadBalancingRule rule(FirewallRule.State state) {
        LoadBalancingRule rule = mock(LoadBalancingRule.class);
        when(rule.getSourceIp()).thenReturn(sourceIp);
        when(rule.getState()).thenReturn(state);
        when(rule.getDestinations()).thenReturn(List.of(mock(LbDestination.class)));
        return rule;
    }

    @Test
    public void rollbackDoesNotRestartOrApplyToNonRunningVm() throws Exception {
        for (VirtualMachine.State state : List.of(VirtualMachine.State.Starting, VirtualMachine.State.Stopped,
                VirtualMachine.State.Stopping, VirtualMachine.State.Destroyed, VirtualMachine.State.Error)) {
            reset(manager);
            VirtualRouter vm = mock(VirtualRouter.class);
            when(vm.getState()).thenReturn(state);
            doReturn(List.of(vm)).when(manager).findInternalLbVms(42L, sourceIp);
            assertTrue(element.applyLBRules(network, List.of(rule(FirewallRule.State.Revoke))));
            verify(manager, never()).deployInternalLbVm(any(), any(), any(), any(), any());
            verify(manager, never()).applyLoadBalancingRules(any(), any(), any());
        }
    }

    @Test
    public void revocationWithNoVmDoesNotCreateOne() throws Exception {
        doReturn(Collections.emptyList()).when(manager).findInternalLbVms(42L, sourceIp);
        assertTrue(element.applyLBRules(network, List.of(rule(FirewallRule.State.Revoke))));
        verify(manager, never()).deployInternalLbVm(any(), any(), any(), any(), any());
    }

    @Test
    public void runningVmReceivesRevocationsWithoutStart() throws Exception {
        VirtualRouter vm = mock(VirtualRouter.class);
        when(vm.getState()).thenReturn(VirtualMachine.State.Running);
        doReturn(List.of(vm)).when(manager).findInternalLbVms(42L, sourceIp);
        List<LoadBalancingRule> rules = List.of(rule(FirewallRule.State.Revoke));
        when(manager.applyLoadBalancingRules(network, rules, List.of(vm))).thenReturn(true);
        assertTrue(element.applyLBRules(network, rules));
        verify(manager).applyLoadBalancingRules(network, rules, List.of(vm));
        verify(manager, never()).deployInternalLbVm(any(), any(), any(), any(), any());
    }

    @Test(expected = CloudRuntimeException.class)
    public void runningVmRevocationFailureIsNotReportedAsSuccess() throws Exception {
        VirtualRouter vm = mock(VirtualRouter.class);
        when(vm.getState()).thenReturn(VirtualMachine.State.Running);
        doReturn(List.of(vm)).when(manager).findInternalLbVms(42L, sourceIp);
        element.applyLBRules(network, List.of(rule(FirewallRule.State.Revoke)));
    }

    private void assertListenerStarts(List<LoadBalancingRule> rules) throws Exception {
        VirtualRouter vm = mock(VirtualRouter.class);
        when(entities.findById(eq(DataCenter.class), any(Long.class))).thenReturn(mock(DataCenter.class));
        doReturn(List.of(vm)).when(manager).deployInternalLbVm(eq(network), eq(sourceIp), any(), any(), any());
        when(manager.applyLoadBalancingRules(network, rules, List.of(vm))).thenReturn(true);
        assertTrue(element.applyLBRules(network, rules));
        verify(manager).deployInternalLbVm(eq(network), eq(sourceIp), any(), any(), any());
        verify(manager).applyLoadBalancingRules(network, rules, List.of(vm));
    }

    @Test
    public void activeRuleStillStartsAndProgramsVm() throws Exception {
        assertListenerStarts(List.of(rule(FirewallRule.State.Active)));
    }

    @Test
    public void mixedActiveAndRevokeRulesStillStartAndProgramVm() throws Exception {
        assertListenerStarts(List.of(rule(FirewallRule.State.Revoke), rule(FirewallRule.State.Active)));
    }
}
