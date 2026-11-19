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
import com.cloud.network.dao.NetworkDao;
import com.cloud.network.dao.NetworkVO;
import com.cloud.network.vpc.VpcVO;
import com.cloud.network.vpc.VpcOfferingVO;
import com.cloud.network.vpc.dao.VpcDao;
import com.cloud.network.vpc.dao.VpcOfferingDao;
import com.cloud.offerings.NetworkOfferingVO;
import com.cloud.offerings.dao.NetworkOfferingDao;
import com.cloud.utils.db.GenericDao;
import com.cloud.utils.db.SearchCriteria;
import org.junit.Assert;
import org.junit.Test;
import org.mockito.Mockito;
import org.springframework.test.util.ReflectionTestUtils;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;

public class BGPASNumberReleasePolicyTest {
    private final BGPServiceImpl service = new BGPServiceImpl();
    private final NetworkDao networks = Mockito.mock(NetworkDao.class);
    private final NetworkOfferingDao offerings = Mockito.mock(NetworkOfferingDao.class);
    private final VpcDao vpcs = Mockito.mock(VpcDao.class);
    private final VpcOfferingDao vpcOfferings = Mockito.mock(VpcOfferingDao.class);

    private void inject() {
        ReflectionTestUtils.setField(service, "networkDao", networks); ReflectionTestUtils.setField(service, "networkOfferingDao", offerings);
        ReflectionTestUtils.setField(service, "vpcDao", vpcs); ReflectionTestUtils.setField(service, "vpcOfferingDao", vpcOfferings);
    }
    @SuppressWarnings("unchecked")
    private <T> void rows(GenericDao<T, Long> dao, List<T> result) {
        SearchCriteria<T> criteria = Mockito.mock(SearchCriteria.class);
        Mockito.when(dao.createSearchCriteria()).thenReturn(criteria); Mockito.when(dao.search(criteria, null)).thenReturn(result);
    }
    private ASNumberVO row(long id, boolean allocated, Long network, Long vpc) {
        ASNumberVO row = new ASNumberVO(4200000000L + id, 10L, 1L); ReflectionTestUtils.setField(row, "id", id);
        row.setAllocated(allocated); row.setNetworkId(network); row.setVpcId(vpc); return row;
    }
    @Test
    public void freePageNeedsNoResourceLookups() {
        inject(); Assert.assertEquals("notallocated", service.getASNumberReleaseReasons(Collections.singletonList(row(1, false, null, null))).get(1L));
        Mockito.verifyNoInteractions(networks, offerings, vpcs, vpcOfferings);
    }
    @Test
    public void referencesAreBatchedOncePerPageAndUseSharedPolicy() {
        inject(); NetworkVO network = Mockito.mock(NetworkVO.class); Mockito.when(network.getId()).thenReturn(30L); Mockito.when(network.getDataCenterId()).thenReturn(1L); Mockito.when(network.getNetworkOfferingId()).thenReturn(5L);
        VpcVO vpc = Mockito.mock(VpcVO.class); Mockito.when(vpc.getId()).thenReturn(40L); Mockito.when(vpc.getZoneId()).thenReturn(1L); Mockito.when(vpc.getVpcOfferingId()).thenReturn(6L);
        NetworkOfferingVO offering = Mockito.mock(NetworkOfferingVO.class); Mockito.when(offering.getId()).thenReturn(5L); Mockito.when(offering.isSpecifyAsNumber()).thenReturn(false);
        VpcOfferingVO vpcOffering = Mockito.mock(VpcOfferingVO.class); Mockito.when(vpcOffering.getId()).thenReturn(6L); Mockito.when(vpcOffering.isSpecifyAsNumber()).thenReturn(true);
        rows(networks, Collections.singletonList(network)); rows(offerings, Collections.singletonList(offering)); rows(vpcs, Collections.singletonList(vpc)); rows(vpcOfferings, Collections.singletonList(vpcOffering));
        List<ASNumber> page = new ArrayList<>(); for (long id = 1; id <= 40; id++) page.add(row(id, true, id <= 20 ? 30L : null, id <= 20 ? null : 40L));
        Map<Long, String> result = service.getASNumberReleaseReasons(page);
        Assert.assertEquals(40, result.size()); Assert.assertEquals("eligible", result.get(1L)); Assert.assertEquals("requiredbyoffering", result.get(40L));
        Mockito.verify(networks, Mockito.times(1)).search(Mockito.any(), Mockito.isNull()); Mockito.verify(offerings, Mockito.times(1)).search(Mockito.any(), Mockito.isNull());
        Mockito.verify(vpcs, Mockito.times(1)).search(Mockito.any(), Mockito.isNull()); Mockito.verify(vpcOfferings, Mockito.times(1)).search(Mockito.any(), Mockito.isNull());
        Mockito.verify(networks, Mockito.never()).findById(Mockito.anyLong());
    }
    @Test
    public void missingForeignAndUnavailableReferencesNeverEnableRelease() {
        inject(); rows(networks, Collections.emptyList());
        Assert.assertEquals("missingreference", service.getASNumberReleaseReasons(Collections.singletonList(row(1, true, 30L, null))).get(1L));
        Mockito.when(networks.search(Mockito.any(), Mockito.isNull())).thenThrow(new IllegalStateException("unavailable"));
        Assert.assertEquals("unknown", service.getASNumberReleaseReasons(Collections.singletonList(row(1, true, 30L, null))).get(1L));
    }
}
