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

    @Before
    public void setup() {
        caller = Mockito.mock(Account.class);
        Mockito.when(caller.getDomainId()).thenReturn(2L);
        CallContext.register(Mockito.mock(User.class), caller);
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
        Mockito.when(networks.findById(30L)).thenReturn(tier);
        Mockito.when(numbers.searchAndCountByZoneOrRangeOrAllocated(1L, 10L, 4200000000L, null, 40L, true, 3L, 2L,
                "4200000000", caller, 0L, cmd.getPageSizeVal())).thenReturn(new Pair<>(Collections.emptyList(), 0));
        Assert.assertEquals(Integer.valueOf(0), service.listASNumbers(cmd).second());
        Mockito.verify(numbers).searchAndCountByZoneOrRangeOrAllocated(1L, 10L, 4200000000L, null, 40L, true, 3L, 2L,
                "4200000000", caller, 0L, cmd.getPageSizeVal());
    }
}
