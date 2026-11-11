//
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
//

package com.cloud.network.element;

import java.util.Arrays;
import java.util.Collections;
import org.junit.Assert;
import org.junit.Test;
import org.mockito.Mockito;
import com.cloud.exception.InvalidParameterValueException;
import com.cloud.network.Network;
import com.cloud.network.lb.LoadBalancingRule;
import com.cloud.utils.Pair;

public class VirtualRouterAppCookieTest {
    @Test
    public void invalidOptionsAreRejectedEvenBeforeRouterLookup() {
        for (String key : Arrays.asList("prefix", "mode", "length", "holdtime", "cookie-name")) {
            VirtualRouterElement element = Mockito.spy(new VirtualRouterElement());
            Mockito.doReturn(true).when(element).canHandle(Mockito.any(Network.class), Mockito.eq(Network.Service.Lb));
            LoadBalancingRule rule = Mockito.mock(LoadBalancingRule.class);
            Mockito.when(rule.getScheme()).thenReturn(com.cloud.network.rules.LoadBalancerContainer.Scheme.Public);
            Mockito.when(rule.getStickinessPolicies()).thenReturn(Collections.singletonList(
                    new LoadBalancingRule.LbStickinessPolicy("AppCookie", Collections.singletonList(new Pair<>(key, "invalid")))));
            try {
                element.validateLBRule(Mockito.mock(Network.class), rule);
                Assert.fail("Expected pre-router rejection for " + key);
            } catch (InvalidParameterValueException expected) {
                Assert.assertTrue(expected.getMessage().contains("AppCookie"));
            }
        }
    }

    @Test
    public void capabilityAdvertisesOnlySupportedAppCookieOptions() {
        com.google.gson.JsonArray methods = com.google.gson.JsonParser.parseString(VirtualRouterElement.getHAProxyStickinessCapability()).getAsJsonArray();
        for (com.google.gson.JsonElement entry : methods) {
            com.google.gson.JsonObject method = entry.getAsJsonObject();
            if ("AppCookie".equals(method.get("methodname").getAsString())) {
                java.util.List<String> names = new java.util.ArrayList<>();
                method.getAsJsonArray("paramlist").forEach(p -> names.add(p.getAsJsonObject().get("paramname").getAsString()));
                Assert.assertEquals(Arrays.asList("cookie-name", "length", "holdtime", "request-learn"), names);
                return;
            }
        }
        Assert.fail("Missing AppCookie capability");
    }
}
