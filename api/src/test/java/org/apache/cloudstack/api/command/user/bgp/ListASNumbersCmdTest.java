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

package org.apache.cloudstack.api.command.user.bgp;

import com.cloud.bgp.ASNumber;
import com.cloud.bgp.BGPService;
import com.cloud.exception.InvalidParameterValueException;
import org.apache.cloudstack.api.ApiConstants;
import org.apache.cloudstack.api.ApiErrorCode;
import org.apache.cloudstack.api.BaseCmd;
import org.apache.cloudstack.api.Parameter;
import org.apache.cloudstack.api.ServerApiException;
import java.util.Collections;
import java.util.Map;

import com.cloud.utils.Pair;
import org.apache.cloudstack.api.ResponseGenerator;
import org.apache.cloudstack.api.response.ASNumberResponse;
import org.apache.cloudstack.api.response.ListResponse;
import org.junit.Assert;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.mockito.Mockito;
import org.mockito.junit.MockitoJUnitRunner;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.ArrayList;
import java.util.List;

@RunWith(MockitoJUnitRunner.class)
public class ListASNumbersCmdTest {

    BGPService bgpService = Mockito.spy(BGPService.class);
    ResponseGenerator _responseGenerator = Mockito.spy(ResponseGenerator.class);

    @Test
    public void testListASNumbersCmdTest() throws Exception {
        Long zoneId = 1L;
        Long asNumberRangeId = 2L;
        Long asNumber = 4200000000L;
        Long networkId = 11L;
        Long vpcId = 12L;
        String account = "account";
        Long domainId = 13L;

        ListASNumbersCmd cmd = new ListASNumbersCmd();
        ReflectionTestUtils.setField(cmd, "zoneId", zoneId);
        ReflectionTestUtils.setField(cmd, "asNumberRangeId", asNumberRangeId);
        ReflectionTestUtils.setField(cmd, "asNumber", asNumber);
        ReflectionTestUtils.setField(cmd, "networkId", networkId);
        ReflectionTestUtils.setField(cmd, "vpcId", vpcId);
        ReflectionTestUtils.setField(cmd, "account", account);
        ReflectionTestUtils.setField(cmd, "domainId", domainId);
        ReflectionTestUtils.setField(cmd, "allocated", Boolean.TRUE);

        ReflectionTestUtils.setField(cmd,"bgpService", bgpService);
        ReflectionTestUtils.setField(cmd,"_responseGenerator", _responseGenerator);

        Assert.assertEquals(zoneId, cmd.getZoneId());
        Assert.assertEquals(asNumberRangeId, cmd.getAsNumberRangeId());
        Assert.assertEquals(asNumber, cmd.getAsNumber());
        Assert.assertEquals(networkId, cmd.getNetworkId());
        Assert.assertEquals(vpcId, cmd.getVpcId());
        Assert.assertEquals(account, cmd.getAccount());
        Assert.assertEquals(domainId, cmd.getDomainId());
        Assert.assertTrue(cmd.getAllocated());

        List<ASNumber> asNumbers = new ArrayList<>();
        ASNumber asn = Mockito.mock(ASNumber.class);
        asNumbers.add(asn);
        Pair<List<ASNumber>, Integer> pair = new Pair<>(asNumbers, 1);

        ASNumberResponse asNumberResponse = Mockito.mock(ASNumberResponse.class);
        Mockito.when(_responseGenerator.createASNumberResponse(asn)).thenReturn(asNumberResponse);

        Mockito.when(bgpService.listASNumbers(cmd)).thenReturn(pair);
        cmd.execute();

        Object response = cmd.getResponseObject();
        Assert.assertTrue(response instanceof ListResponse);
        ListResponse listResponse = (ListResponse) response;
        Assert.assertEquals(1L, (long) listResponse.getCount());
        Assert.assertTrue(listResponse.getResponses().get(0) instanceof ASNumberResponse);
        ASNumberResponse firstResponse = (ASNumberResponse) listResponse.getResponses().get(0);
        Assert.assertEquals(asNumberResponse, firstResponse);
    }
    @Test
    public void metadataAndGetterPreserveUnsigned32BitNumbers() throws Exception {
        Assert.assertEquals(Long.class, ListASNumbersCmd.class.getDeclaredField("asNumber").getType());
        Parameter parameter = ListASNumbersCmd.class.getDeclaredField("asNumber").getAnnotation(Parameter.class);
        Assert.assertEquals(BaseCmd.CommandType.LONG, parameter.type());
        ListASNumbersCmd cmd = new ListASNumbersCmd();
        Assert.assertNull(cmd.getAsNumber());
        for (long number : new long[] {0, 23456, 64512, 65535, 2147483647L, 2147483648L, 4200000000L, 4294967294L, 4294967295L}) {
            ReflectionTestUtils.setField(cmd, "asNumber", number);
            cmd.validateSpecificParameters(Collections.singletonMap(ApiConstants.AS_NUMBER, Long.toString(number)));
            Assert.assertEquals(Long.valueOf(number), cmd.getAsNumber());
        }
    }

    @Test
    public void invalidRawInputAndMissingPaginationPairAreParameterErrors() {
        ListASNumbersCmd cmd = new ListASNumbersCmd();
        for (String raw : new String[] {"", " ", "-1", "+1", "1.5", "1e3", "1.10", "1,000", "abc", "\uff11", "4294967296", "9223372036854775808"}) {
            Assert.assertThrows(InvalidParameterValueException.class,
                    () -> cmd.validateSpecificParameters(Collections.singletonMap(ApiConstants.AS_NUMBER, raw)));
        }
        cmd.validateSpecificParameters(Collections.emptyMap());
        cmd.validateSpecificParameters(Map.of(ApiConstants.PAGE, "1", ApiConstants.PAGE_SIZE, "20"));
        ServerApiException error = Assert.assertThrows(ServerApiException.class,
                () -> cmd.validateSpecificParameters(Collections.singletonMap(ApiConstants.PAGE_SIZE, "20")));
        Assert.assertEquals(ApiErrorCode.PARAM_ERROR, error.getErrorCode());
    }

    @Test
    public void invalidTypedValueNeverInvokesTheService() {
        ListASNumbersCmd cmd = new ListASNumbersCmd();
        ReflectionTestUtils.setField(cmd, "bgpService", bgpService);
        for (long number : new long[] {-1, 4294967296L, Long.MAX_VALUE}) {
            ReflectionTestUtils.setField(cmd, "asNumber", number);
            ServerApiException error = Assert.assertThrows(ServerApiException.class, cmd::execute);
            Assert.assertEquals(ApiErrorCode.PARAM_ERROR, error.getErrorCode());
        }
        Mockito.verifyNoInteractions(bgpService);
    }

    @Test
    public void serviceParameterRejectionIsNotReclassifiedAsInternalFailure() {
        ListASNumbersCmd cmd = new ListASNumbersCmd();
        ReflectionTestUtils.setField(cmd, "bgpService", bgpService);
        Mockito.when(bgpService.listASNumbers(cmd)).thenThrow(new InvalidParameterValueException("Invalid query"));
        ServerApiException error = Assert.assertThrows(ServerApiException.class, cmd::execute);
        Assert.assertEquals(ApiErrorCode.PARAM_ERROR, error.getErrorCode());
    }

    @Test
    public void inaccessibleScopeHasAnAuthorizationResponseWithoutInternalDetails() {
        ListASNumbersCmd cmd = new ListASNumbersCmd(); ReflectionTestUtils.setField(cmd, "bgpService", bgpService);
        Mockito.when(bgpService.listASNumbers(cmd)).thenThrow(new com.cloud.exception.PermissionDeniedException("private domain details"));
        ServerApiException error = Assert.assertThrows(ServerApiException.class, cmd::execute);
        Assert.assertEquals(ApiErrorCode.UNAUTHORIZED, error.getErrorCode());
        Assert.assertFalse(error.getDescription().contains("private domain"));
    }
}
