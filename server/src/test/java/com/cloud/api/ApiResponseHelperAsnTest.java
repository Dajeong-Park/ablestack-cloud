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
package com.cloud.api;

import com.cloud.dc.ASNumberVO;
import com.cloud.dc.dao.ASNumberRangeDao;
import org.apache.cloudstack.api.response.ASNumberResponse;
import org.junit.Assert;
import org.junit.Test;
import org.mockito.MockedStatic;
import org.mockito.Mockito;
import org.springframework.test.util.ReflectionTestUtils;

public class ApiResponseHelperAsnTest {
    @Test
    public void removedReferencesRenderAsAbsentInsteadOfFailingTheWholeList() {
        ApiResponseHelper helper = new ApiResponseHelper();
        ReflectionTestUtils.setField(helper, "asNumberRangeDao", Mockito.mock(ASNumberRangeDao.class));
        ASNumberVO row = new ASNumberVO(4200000000L, 10L, 1L); row.setAllocated(true); row.setAccountId(2L); row.setDomainId(1L); row.setNetworkId(30L);
        try (MockedStatic<ApiDBUtils> ignored = Mockito.mockStatic(ApiDBUtils.class)) {
            ASNumberResponse response = helper.createASNumberResponse(row);
            Assert.assertEquals(Long.valueOf(4200000000L), response.getAsNumber());
            Assert.assertNull(response.getAssociatedNetworkId()); Assert.assertNull(response.getAccountId()); Assert.assertNull(response.getZoneId());
            row.setNetworkId(null); row.setVpcId(40L); Assert.assertNull(helper.createASNumberResponse(row).getVpcId());
        }
    }
}
