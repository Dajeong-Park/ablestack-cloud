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
package com.cloud.bgp;

import com.cloud.dc.ASNumberVO;
import com.cloud.dc.dao.ASNumberDao;
import com.cloud.domain.DomainVO;
import com.cloud.domain.dao.DomainDao;
import com.cloud.network.dao.NetworkDao;
import com.cloud.network.dao.NetworkVO;
import com.cloud.user.Account;
import com.cloud.user.User;
import com.cloud.user.dao.AccountDao;
import com.cloud.utils.Pair;
import org.apache.cloudstack.api.command.user.bgp.ListASNumbersCmd;
import org.apache.cloudstack.context.CallContext;
import org.junit.After;
import org.junit.Assert;
import org.junit.Before;
import org.junit.Test;
import org.mockito.Mockito;
import org.springframework.test.util.ReflectionTestUtils;
import java.util.Collections;

public class BGPASNumberQueryTest {
    private final BGPServiceImpl service = new BGPServiceImpl();
    private final ASNumberDao numbers = Mockito.mock(ASNumberDao.class);
    private final AccountDao accounts = Mockito.mock(AccountDao.class);
    private final DomainDao domains = Mockito.mock(DomainDao.class);
    private final NetworkDao networks = Mockito.mock(NetworkDao.class);
    private final ListASNumbersCmd cmd = Mockito.spy(new ListASNumbersCmd());
    private Account caller;
    private final com.cloud.user.AccountManager access = Mockito.mock(com.cloud.user.AccountManager.class);
    private final com.cloud.dc.dao.ASNumberRangeDao ranges = Mockito.mock(com.cloud.dc.dao.ASNumberRangeDao.class);
    private final com.cloud.network.vpc.dao.VpcDao vpcs = Mockito.mock(com.cloud.network.vpc.dao.VpcDao.class);

    @Before
    public void setup() {
        caller = Mockito.mock(Account.class);
        Mockito.when(caller.getDomainId()).thenReturn(2L);
        CallContext.register(Mockito.mock(User.class), caller);
        ReflectionTestUtils.setField(service, "asnAccountManager", access);
        ReflectionTestUtils.setField(service, "asNumberRangeDao", ranges);
        ReflectionTestUtils.setField(service, "vpcDao", vpcs);
        Mockito.when(ranges.findById(10L)).thenReturn(new com.cloud.dc.ASNumberRangeVO(1L, 4200000000L, 4200000002L));
        com.cloud.network.vpc.VpcVO vpc = Mockito.mock(com.cloud.network.vpc.VpcVO.class);
        Mockito.when(vpc.getZoneId()).thenReturn(1L); Mockito.when(vpcs.findById(40L)).thenReturn(vpc);
        Mockito.when(numbers.searchAndCountByZoneOrRangeOrAllocated(Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any())).thenReturn(new Pair<>(Collections.emptyList(), 0));
        ReflectionTestUtils.setField(service, "asNumberDao", numbers);
        ReflectionTestUtils.setField(service, "accountDao", accounts);
        ReflectionTestUtils.setField(service, "domainDao", domains);
        ReflectionTestUtils.setField(service, "networkDao", networks);
        ReflectionTestUtils.setField(cmd, "asNumber", 4200000000L);
        ReflectionTestUtils.setField(cmd, "zoneId", 1L);
        Mockito.doReturn(0L).when(cmd).getStartIndex();
        Mockito.doReturn(20L).when(cmd).getPageSizeVal();
        ReflectionTestUtils.setField(cmd, "asNumberRangeId", 10L);
        ReflectionTestUtils.setField(cmd, "allocated", true);
        ReflectionTestUtils.setField(cmd, "account", "owner");
        ReflectionTestUtils.setField(cmd, "keyword", "4200000000");
        Account owner = Mockito.mock(Account.class);
        Mockito.when(owner.getId()).thenReturn(3L);
        Mockito.when(accounts.findActiveAccount("owner", 2L)).thenReturn(owner);
        DomainVO domain = Mockito.mock(DomainVO.class);
        Mockito.when(domain.getId()).thenReturn(2L);
        Mockito.when(domains.findById(2L)).thenReturn(domain);
    }

    @After
    public void cleanup() { CallContext.unregister(); }

    @Test
    public void longAndAllQueryArgumentsReachDaoAndCountIsPreserved() {
        ASNumberVO number = new ASNumberVO(4200000000L, 10, 1);
        Mockito.when(numbers.searchAndCountByZoneOrRangeOrAllocated(1L, 10L, 4200000000L, null, null, true, 3L, 2L,
                "4200000000", caller, 0L, cmd.getPageSizeVal())).thenReturn(new Pair<>(Collections.singletonList(number), 7));
        Pair<java.util.List<ASNumber>, Integer> result = service.listASNumbers(cmd);
        Assert.assertEquals(4200000000L, result.first().get(0).getAsNumber());
        Assert.assertEquals(Integer.valueOf(7), result.second());
    }

    @Test
    public void networkTierStillMapsToVpcWhileLongFilterIsRetained() {
        ReflectionTestUtils.setField(cmd, "networkId", 30L);
        NetworkVO tier = Mockito.mock(NetworkVO.class);
        Mockito.when(tier.getVpcId()).thenReturn(40L);
        Mockito.when(tier.getDataCenterId()).thenReturn(1L);
        Mockito.when(networks.findById(30L)).thenReturn(tier);
        Mockito.when(numbers.searchAndCountByZoneOrRangeOrAllocated(1L, 10L, 4200000000L, null, 40L, true, 3L, 2L,
                "4200000000", caller, 0L, cmd.getPageSizeVal())).thenReturn(new Pair<>(Collections.emptyList(), 0));
        Assert.assertEquals(Integer.valueOf(0), service.listASNumbers(cmd).second());
        Mockito.verify(numbers).searchAndCountByZoneOrRangeOrAllocated(1L, 10L, 4200000000L, null, 40L, true, 3L, 2L,
                "4200000000", caller, 0L, cmd.getPageSizeVal());
    }

    @Test
    public void domainWithoutAccountReachesDaoAndAcl() {
        ReflectionTestUtils.setField(cmd, "account", null); ReflectionTestUtils.setField(cmd, "domainId", 2L);
        service.listASNumbers(cmd);
        Mockito.verify(access).checkAccess(Mockito.eq(caller), Mockito.any(com.cloud.domain.Domain.class));
        Mockito.verify(numbers).searchAndCountByZoneOrRangeOrAllocated(1L, 10L, 4200000000L, null, null, true, null, 2L, "4200000000", caller, 0L, cmd.getPageSizeVal());
    }

    @Test
    public void inaccessibleDomainCannotReachDao() {
        Mockito.doThrow(new com.cloud.exception.PermissionDeniedException("denied")).when(access).checkAccess(Mockito.eq(caller), Mockito.any(com.cloud.domain.Domain.class));
        Assert.assertThrows(com.cloud.exception.PermissionDeniedException.class, () -> service.listASNumbers(cmd));
        Mockito.verifyNoInteractions(numbers);
    }

    @Test
    public void missingDomainAndWrongAccountDomainAreRejected() {
        ReflectionTestUtils.setField(cmd, "domainId", 99L);
        Assert.assertThrows(com.cloud.exception.InvalidParameterValueException.class, () -> service.listASNumbers(cmd));
        ReflectionTestUtils.setField(cmd, "domainId", 2L); ReflectionTestUtils.setField(cmd, "account", "other-domain-owner");
        Assert.assertThrows(com.cloud.exception.InvalidParameterValueException.class, () -> service.listASNumbers(cmd));
        Mockito.verifyNoInteractions(numbers);
    }

    @Test
    public void rangeFromAnotherZoneIsRejected() {
        Mockito.when(ranges.findById(10L)).thenReturn(new com.cloud.dc.ASNumberRangeVO(2L, 64512, 64514));
        Assert.assertThrows(com.cloud.exception.InvalidParameterValueException.class, () -> service.listASNumbers(cmd));
        Mockito.verifyNoInteractions(numbers);
    }

    @Test
    public void vpcDirectLookupIsPreserved() {
        ReflectionTestUtils.setField(cmd, "vpcId", 40L); service.listASNumbers(cmd);
        Mockito.verify(numbers).searchAndCountByZoneOrRangeOrAllocated(1L, 10L, 4200000000L, null, 40L, true, 3L, 2L, "4200000000", caller, 0L, cmd.getPageSizeVal());
    }

    @Test
    public void crossZoneVpcAndNetworkAreRejected() {
        ReflectionTestUtils.setField(cmd, "vpcId", 40L);
        Mockito.when(vpcs.findById(40L).getZoneId()).thenReturn(2L);
        Assert.assertThrows(com.cloud.exception.InvalidParameterValueException.class, () -> service.listASNumbers(cmd));
        ReflectionTestUtils.setField(cmd, "vpcId", null); ReflectionTestUtils.setField(cmd, "networkId", 30L);
        NetworkVO network = Mockito.mock(NetworkVO.class); Mockito.when(network.getDataCenterId()).thenReturn(2L); Mockito.when(networks.findById(30L)).thenReturn(network);
        Assert.assertThrows(com.cloud.exception.InvalidParameterValueException.class, () -> service.listASNumbers(cmd));
        Mockito.verifyNoInteractions(numbers);
    }

    @Test
    public void explicitVpcCannotBeSilentlyReplacedByTierVpc() {
        ReflectionTestUtils.setField(cmd, "networkId", 30L); ReflectionTestUtils.setField(cmd, "vpcId", 41L);
        NetworkVO tier = Mockito.mock(NetworkVO.class); Mockito.when(tier.getDataCenterId()).thenReturn(1L); Mockito.when(tier.getVpcId()).thenReturn(40L); Mockito.when(networks.findById(30L)).thenReturn(tier);
        Assert.assertThrows(com.cloud.exception.InvalidParameterValueException.class, () -> service.listASNumbers(cmd));
        Mockito.verifyNoInteractions(numbers);
    }
}
