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

package org.apache.cloudstack.network.lb;

import static org.junit.Assert.assertNotSame;
import static org.junit.Assert.assertThrows;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Collections;

import org.apache.cloudstack.lb.ApplicationLoadBalancerRuleVO;
import org.apache.cloudstack.lb.dao.ApplicationLoadBalancerRuleDao;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.MockitoJUnitRunner;

import com.cloud.exception.NetworkRuleConflictException;
import com.cloud.network.rules.FirewallRule.State;
import com.cloud.utils.net.Ip;

@RunWith(MockitoJUnitRunner.class)
public class InternalLoadBalancerRuleConflictTest {
    private static final Ip VIP = new Ip("10.210.31.188");
    @Mock private ApplicationLoadBalancerRuleDao dao;
    @InjectMocks private ApplicationLoadBalancerManagerImpl manager;

    @SuppressWarnings("removal")
    private ApplicationLoadBalancerRuleVO rule(long id, Long networkId, int start, int end) {
        ApplicationLoadBalancerRuleVO rule = mock(ApplicationLoadBalancerRuleVO.class);
        lenient().when(rule.getId()).thenReturn(id);
        lenient().when(rule.getNetworkId()).thenReturn(networkId == null ? null : new Long(networkId));
        lenient().when(rule.getSourceIp()).thenReturn(VIP);
        lenient().when(rule.getSourceIpNetworkId()).thenReturn(634L);
        lenient().when(rule.getSourcePortStart()).thenReturn(start);
        lenient().when(rule.getSourcePortEnd()).thenReturn(end);
        lenient().when(rule.getState()).thenReturn(State.Add);
        return rule;
    }

    private void existing(ApplicationLoadBalancerRuleVO rule) {
        when(dao.listBySourceIpAndNotRevoked(VIP, 634L)).thenReturn(Collections.singletonList(rule));
    }

    @Test
    public void distinctBoxedNetworkIdsWithEqualValuesAllowDifferentPorts() throws Exception {
        ApplicationLoadBalancerRuleVO current = rule(101L, 634L, 19016, 19016);
        ApplicationLoadBalancerRuleVO next = rule(102L, 634L, 19017, 19017);
        assertNotSame(current.getNetworkId(), next.getNetworkId());
        existing(current);
        manager.detectInternalLbRulesConflict(next);
        verify(dao).listBySourceIpAndNotRevoked(VIP, 634L);
    }

    @Test
    public void differentBackendNetworkStillConflicts() {
        existing(rule(101L, 634L, 19016, 19016));
        assertThrows(NetworkRuleConflictException.class,
                () -> manager.detectInternalLbRulesConflict(rule(102L, 635L, 19017, 19017)));
    }

    @Test
    public void missingNetworkDoesNotMatchAnExistingNetwork() {
        existing(rule(101L, 634L, 19016, 19016));
        assertThrows(NetworkRuleConflictException.class,
                () -> manager.detectInternalLbRulesConflict(rule(102L, null, 19017, 19017)));
    }

    @Test
    public void bothMissingNetworkIdsAreComparedNullSafely() throws Exception {
        existing(rule(101L, null, 19016, 19016));
        manager.detectInternalLbRulesConflict(rule(102L, null, 19017, 19017));
    }

    @Test
    public void identicalPortStillConflicts() {
        existing(rule(101L, 634L, 19016, 19016));
        assertThrows(NetworkRuleConflictException.class,
                () -> manager.detectInternalLbRulesConflict(rule(102L, 634L, 19016, 19016)));
    }

    @Test
    public void overlapAtStartStillConflicts() {
        existing(rule(101L, 634L, 19016, 19020));
        assertThrows(NetworkRuleConflictException.class,
                () -> manager.detectInternalLbRulesConflict(rule(102L, 634L, 19015, 19016)));
    }

    @Test
    public void overlapAtEndStillConflicts() {
        existing(rule(101L, 634L, 19016, 19020));
        assertThrows(NetworkRuleConflictException.class,
                () -> manager.detectInternalLbRulesConflict(rule(102L, 634L, 19020, 19021)));
    }

    @Test
    public void containedPortStillConflicts() {
        existing(rule(101L, 634L, 19016, 19020));
        assertThrows(NetworkRuleConflictException.class,
                () -> manager.detectInternalLbRulesConflict(rule(102L, 634L, 19018, 19018)));
    }

    @Test
    public void encompassingRangeStillConflicts() {
        existing(rule(101L, 634L, 19016, 19020));
        assertThrows(NetworkRuleConflictException.class,
                () -> manager.detectInternalLbRulesConflict(rule(102L, 634L, 19015, 19021)));
    }

    @Test
    public void adjacentRangesRemainAllowed() throws Exception {
        existing(rule(101L, 634L, 19016, 19020));
        manager.detectInternalLbRulesConflict(rule(102L, 634L, 19021, 19023));
    }

    @Test
    public void ownRuleIsSkipped() throws Exception {
        existing(rule(101L, 634L, 19016, 19016));
        manager.detectInternalLbRulesConflict(rule(101L, 634L, 19016, 19016));
    }

    @Test
    public void sourceIpNetworkScopeIsPassedToTheDao() throws Exception {
        ApplicationLoadBalancerRuleVO next = rule(102L, 635L, 19016, 19016);
        when(next.getSourceIpNetworkId()).thenReturn(635L);
        when(dao.listBySourceIpAndNotRevoked(VIP, 635L)).thenReturn(Collections.emptyList());
        manager.detectInternalLbRulesConflict(next);
        verify(dao).listBySourceIpAndNotRevoked(VIP, 635L);
    }
}
