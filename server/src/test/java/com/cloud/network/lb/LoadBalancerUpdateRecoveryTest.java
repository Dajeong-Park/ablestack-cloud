// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements. See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership. The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License. You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied. See the License for the
// specific language governing permissions and limitations
// under the License.
package com.cloud.network.lb;

import java.util.Collections;
import java.util.UUID;

import org.apache.cloudstack.api.ApiConstants;
import org.apache.cloudstack.api.command.user.loadbalancer.UpdateLoadBalancerRuleCmd;
import org.apache.cloudstack.context.CallContext;
import org.apache.cloudstack.engine.orchestration.service.NetworkOrchestrationService;
import org.apache.cloudstack.resourcedetail.FirewallRuleDetailVO;
import org.apache.cloudstack.resourcedetail.dao.FirewallRuleDetailsDao;
import org.junit.After;
import org.junit.Assert;
import org.junit.Before;
import org.junit.Test;
import org.mockito.Mockito;
import org.springframework.test.util.ReflectionTestUtils;

import com.cloud.exception.ResourceUnavailableException;
import com.cloud.network.Network;
import com.cloud.network.dao.LoadBalancerCertMapDao;
import com.cloud.network.dao.LoadBalancerCertMapVO;
import com.cloud.network.dao.LoadBalancerDao;
import com.cloud.network.dao.LoadBalancerVO;
import com.cloud.network.dao.NetworkDao;
import com.cloud.network.dao.NetworkVO;
import com.cloud.network.rules.FirewallRule;
import com.cloud.offerings.dao.NetworkOfferingServiceMapDao;
import com.cloud.user.Account;
import com.cloud.user.AccountManager;
import com.cloud.user.AccountVO;
import com.cloud.user.User;
import com.cloud.user.UserVO;
import com.cloud.utils.exception.CloudRuntimeException;

public class LoadBalancerUpdateRecoveryTest {
    private LoadBalancingRulesManagerImpl manager;
    private LoadBalancerVO rule;
    private LoadBalancerDao dao;
    private LoadBalancerCertMapDao certificates;
    private FirewallRuleDetailsDao details;
    private UpdateLoadBalancerRuleCmd command;

    @Before
    public void setUp() throws Exception {
        manager = Mockito.spy(new LoadBalancingRulesManagerImpl());
        manager._accountMgr = Mockito.mock(AccountManager.class);
        dao = Mockito.mock(LoadBalancerDao.class);
        manager._lbDao = dao;
        certificates = Mockito.mock(LoadBalancerCertMapDao.class);
        manager._lbCertMapDao = certificates;
        details = Mockito.mock(FirewallRuleDetailsDao.class);
        manager._firewallRuleDetailsDao = details;
        manager._networkDao = Mockito.mock(NetworkDao.class);
        manager._networkMgr = Mockito.mock(NetworkOrchestrationService.class);
        manager._networkOfferingServiceDao = Mockito.mock(NetworkOfferingServiceMapDao.class);
        NetworkVO network = Mockito.mock(NetworkVO.class);
        Mockito.when(manager._networkDao.findById(4L)).thenReturn(network);
        Mockito.when(manager._networkMgr.getProvidersForServiceInNetwork(network, Network.Service.Lb))
                .thenReturn(Collections.singletonList(Network.Provider.VirtualRouter));
        rule = new LoadBalancerVO(null, "original", null, 1L, 443, 8443, "roundrobin", 4L, 2L, 1L, null, null);
        ReflectionTestUtils.setField(rule, "id", 7L);
        rule.setState(FirewallRule.State.Active);
        Mockito.when(dao.findById(7L)).thenReturn(rule);
        Mockito.when(dao.update(7L, rule)).thenReturn(true);
        LoadBalancingRule providerRule = Mockito.mock(LoadBalancingRule.class);
        Mockito.doReturn(providerRule).when(manager).getLoadBalancerRuleToApply(rule);
        Mockito.doReturn(true).when(manager).validateLbRule(providerRule);
        Mockito.doAnswer(invocation -> { rule.setState(FirewallRule.State.Active); return true; })
                .when(manager).applyLoadBalancerConfig(7L);
        command = new UpdateLoadBalancerRuleCmd();
        ReflectionTestUtils.setField(command, "id", 7L);
        AccountVO account = new AccountVO("qa", 1L, "network", Account.Type.NORMAL, "uuid");
        UserVO user = new UserVO(2L, "qa", "password", "QA", "Network", "qa@example.invalid", "UTC", UUID.randomUUID().toString(), User.Source.UNKNOWN);
        CallContext.register(user, account);
    }

    @After
    public void tearDown() {
        CallContext.unregister();
    }

    @Test
    public void legacyNullProtocolAlgorithmUpdateBecomesTcpAndActive() {
        ReflectionTestUtils.setField(command, "algorithm", "leastconn");
        Assert.assertSame(rule, manager.updateLoadBalancerRule(command));
        Assert.assertEquals("tcp", rule.getLbProtocol());
        Assert.assertEquals("leastconn", rule.getAlgorithm());
        Assert.assertEquals(FirewallRule.State.Active, rule.getState());
        Mockito.verify(certificates, Mockito.never()).remove(Mockito.anyLong());
    }

    @Test
    public void legacyNullProtocolNameOnlyUpdateIsNormalized() throws Exception {
        ReflectionTestUtils.setField(command, "loadBalancerName", "renamed");
        manager.updateLoadBalancerRule(command);
        Assert.assertEquals("renamed", rule.getName());
        Assert.assertEquals("tcp", rule.getLbProtocol());
        Mockito.verify(manager).applyLoadBalancerConfig(7L);
    }

    @Test
    public void unchangedActiveRuleDoesNotReapplyOrRemoveCertificate() throws Exception {
        rule.setLbProtocol("tcp");
        ReflectionTestUtils.setField(command, "loadBalancerName", "renamed");
        manager.updateLoadBalancerRule(command);
        Mockito.verify(manager, Mockito.never()).applyLoadBalancerConfig(7L);
        Mockito.verify(certificates, Mockito.never()).remove(Mockito.anyLong());
    }

    @Test
    public void sameValueRetryOfPendingRuleReapplies() throws Exception {
        rule.setLbProtocol("tcp");
        rule.setState(FirewallRule.State.Add);
        manager.updateLoadBalancerRule(command);
        Mockito.verify(manager).applyLoadBalancerConfig(7L);
        Assert.assertEquals(FirewallRule.State.Active, rule.getState());
    }

    @Test
    public void noBackendProviderStateRemainsPendingAndIsReturnedFresh() throws Exception {
        Mockito.doAnswer(invocation -> { rule.setState(FirewallRule.State.Add); return true; })
                .when(manager).applyLoadBalancerConfig(7L);
        Assert.assertEquals(FirewallRule.State.Add, manager.updateLoadBalancerRule(command).getState());
        Assert.assertEquals("tcp", rule.getLbProtocol());
    }

    private void assertFailedUpdateRestored() {
        String uuid = rule.getUuid();
        ReflectionTestUtils.setField(command, "algorithm", "leastconn");
        ReflectionTestUtils.setField(command, "loadBalancerName", "changed");
        ReflectionTestUtils.setField(command, "description", "changed description");
        ReflectionTestUtils.setField(command, "display", false);
        ReflectionTestUtils.setField(command, "cidrList", Collections.singletonList("192.0.2.0/24"));
        Assert.assertThrows(CloudRuntimeException.class, () -> manager.updateLoadBalancerRule(command));
        Assert.assertEquals("original", rule.getName());
        Assert.assertNull(rule.getDescription());
        Assert.assertEquals("roundrobin", rule.getAlgorithm());
        Assert.assertNull(rule.getLbProtocol());
        Assert.assertNull(rule.getCidrList());
        Assert.assertTrue(rule.isDisplay());
        Assert.assertEquals(uuid, rule.getUuid());
        Assert.assertEquals(FirewallRule.State.Active, rule.getState());
        Mockito.verify(certificates, Mockito.never()).remove(Mockito.anyLong());
    }

    @Test
    public void providerFalseRestoresNullFieldsAndCanRetry() throws Exception {
        Mockito.doReturn(false).when(manager).applyLoadBalancerConfig(7L);
        assertFailedUpdateRestored();
        Mockito.doAnswer(invocation -> { rule.setState(FirewallRule.State.Active); return true; })
                .when(manager).applyLoadBalancerConfig(7L);
        manager.updateLoadBalancerRule(command);
        Assert.assertEquals("changed", rule.getName());
        Assert.assertEquals("tcp", rule.getLbProtocol());
        Assert.assertEquals(FirewallRule.State.Active, rule.getState());
    }

    @Test
    public void providerUnavailableRestoresPreviousState() throws Exception {
        Mockito.doThrow(new ResourceUnavailableException("test provider unavailable", Network.class, 4L))
                .when(manager).applyLoadBalancerConfig(7L);
        assertFailedUpdateRestored();
    }

    @Test
    public void providerRuntimeFailureRestoresPreviousState() throws Exception {
        Mockito.doThrow(new CloudRuntimeException("test provider runtime failure")).when(manager).applyLoadBalancerConfig(7L);
        assertFailedUpdateRestored();
    }

    @Test
    public void failedSslExitPreservesCertificateAndBackendSsl() throws Exception {
        rule.setLbProtocol("ssl");
        FirewallRuleDetailVO detail = Mockito.mock(FirewallRuleDetailVO.class);
        Mockito.when(detail.getValue()).thenReturn("true");
        Mockito.when(details.findDetail(7L, ApiConstants.BACKEND_SSL)).thenReturn(detail);
        ReflectionTestUtils.setField(command, "lbProtocol", "tcp");
        Mockito.doReturn(false).when(manager).applyLoadBalancerConfig(7L);
        Assert.assertThrows(CloudRuntimeException.class, () -> manager.updateLoadBalancerRule(command));
        Assert.assertEquals("ssl", rule.getLbProtocol());
        Mockito.verify(details).addDetail(7L, ApiConstants.BACKEND_SSL, "true", false);
        Mockito.verify(certificates, Mockito.never()).remove(Mockito.anyLong());
    }

    @Test
    public void successfulSslExitRemovesCertificateOnlyAfterApply() throws Exception {
        rule.setLbProtocol("ssl");
        LoadBalancerCertMapVO cert = Mockito.mock(LoadBalancerCertMapVO.class);
        Mockito.when(cert.getId()).thenReturn(9L);
        Mockito.when(certificates.findByLbRuleId(7L)).thenReturn(cert);
        ReflectionTestUtils.setField(command, "lbProtocol", "tcp");
        manager.updateLoadBalancerRule(command);
        org.mockito.InOrder order = Mockito.inOrder(manager, certificates);
        order.verify(manager).applyLoadBalancerConfig(7L);
        order.verify(certificates).remove(9L);
    }
}
