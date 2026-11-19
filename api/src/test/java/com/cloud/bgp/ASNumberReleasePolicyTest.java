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

import org.junit.Assert;
import org.junit.Test;
import org.mockito.Mockito;

public class ASNumberReleasePolicyTest {
    @Test
    public void availableUnknownMissingAndRequiredConditionsAreDistinct() {
        ASNumber row = Mockito.mock(ASNumber.class);
        Mockito.when(row.getNetworkId()).thenReturn(null);
        Mockito.when(row.getVpcId()).thenReturn(null);
        Assert.assertEquals("unknown", ASNumberReleasePolicy.reason(null, false, null));
        Assert.assertEquals("notallocated", ASNumberReleasePolicy.reason(row, false, null));
        Mockito.when(row.isAllocated()).thenReturn(true);
        Assert.assertEquals("missingreference", ASNumberReleasePolicy.reason(row, false, false));
        Mockito.when(row.getNetworkId()).thenReturn(10L);
        Assert.assertEquals("unknown", ASNumberReleasePolicy.reason(row, true, null));
        Assert.assertEquals("requiredbyoffering", ASNumberReleasePolicy.reason(row, true, true));
        Assert.assertEquals("eligible", ASNumberReleasePolicy.reason(row, true, false));
        Mockito.when(row.getVpcId()).thenReturn(20L);
        Assert.assertEquals("unknown", ASNumberReleasePolicy.reason(row, true, false));
    }
}
