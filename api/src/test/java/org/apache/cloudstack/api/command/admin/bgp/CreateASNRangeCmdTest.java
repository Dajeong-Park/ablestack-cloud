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

package org.apache.cloudstack.api.command.admin.bgp;

import com.cloud.bgp.ASNumberRange;
import com.cloud.bgp.BGPService;
import com.cloud.exception.InvalidParameterValueException;

import org.apache.cloudstack.api.ResponseGenerator;
import org.apache.cloudstack.api.ApiErrorCode;
import org.apache.cloudstack.api.ServerApiException;
import org.apache.cloudstack.api.response.ASNRangeResponse;
import org.junit.Assert;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.mockito.Mockito;
import org.mockito.junit.MockitoJUnitRunner;
import org.springframework.test.util.ReflectionTestUtils;

@RunWith(MockitoJUnitRunner.class)
public class CreateASNRangeCmdTest {

    BGPService bgpService = Mockito.spy(BGPService.class);
    ResponseGenerator _responseGenerator = Mockito.spy(ResponseGenerator.class);

    @Test
    public void testCreateASNRangeCmd() throws Exception {
        Long zoneId = 1L;
        Long startASNumber = 4200000000L;
        Long endASNumber = 4200000002L;

        CreateASNRangeCmd cmd = new CreateASNRangeCmd();
        ReflectionTestUtils.setField(cmd, "zoneId", zoneId);
        ReflectionTestUtils.setField(cmd, "startASNumber", " 4200000000 ");
        ReflectionTestUtils.setField(cmd, "endASNumber", "4200000002");
        ReflectionTestUtils.setField(cmd,"bgpService", bgpService);
        ReflectionTestUtils.setField(cmd,"_responseGenerator", _responseGenerator);

        Assert.assertEquals(zoneId, cmd.getZoneId());
        Assert.assertEquals(startASNumber, cmd.getStartASNumber());
        Assert.assertEquals(endASNumber, cmd.getEndASNumber());
        Assert.assertEquals(1L, cmd.getEntityOwnerId());

        ASNumberRange asnRange = Mockito.mock(ASNumberRange.class);
        Mockito.when(bgpService.createASNumberRange(zoneId, startASNumber, endASNumber)).thenReturn(asnRange);

        ASNRangeResponse response = Mockito.mock(ASNRangeResponse.class);
        Mockito.when(_responseGenerator.createASNumberRangeResponse(asnRange)).thenReturn(response);

        cmd.execute();

        Assert.assertEquals(response, cmd.getResponseObject());
    }

    private CreateASNRangeCmd command() {
        CreateASNRangeCmd cmd = new CreateASNRangeCmd();
        ReflectionTestUtils.setField(cmd, "zoneId", 1L);
        ReflectionTestUtils.setField(cmd, "startASNumber", "64512");
        ReflectionTestUtils.setField(cmd, "endASNumber", "64513");
        ReflectionTestUtils.setField(cmd, "bgpService", bgpService);
        return cmd;
    }

    @Test
    public void invalidInputNeverCallsTheService() {
        CreateASNRangeCmd cmd = command();
        ReflectionTestUtils.setField(cmd, "startASNumber", "+1");
        ServerApiException error = Assert.assertThrows(ServerApiException.class, cmd::execute);
        Assert.assertEquals(ApiErrorCode.PARAM_ERROR, error.getErrorCode());
        Mockito.verifyNoInteractions(bgpService);
    }

    @Test
    public void serviceRejectionKeepsParameterErrorClassification() {
        CreateASNRangeCmd cmd = command();
        Mockito.when(bgpService.createASNumberRange(1L, 64512L, 64513L)).thenThrow(new InvalidParameterValueException("Overlap"));
        ServerApiException error = Assert.assertThrows(ServerApiException.class, cmd::execute);
        Assert.assertEquals(ApiErrorCode.PARAM_ERROR, error.getErrorCode());
        Assert.assertEquals("Overlap", error.getDescription());
    }

    @Test
    public void internalErrorReturnsOnlyDiagnosticId() {
        CreateASNRangeCmd cmd = command();
        Mockito.when(bgpService.createASNumberRange(1L, 64512L, 64513L)).thenThrow(new RuntimeException("SQL private database detail"));
        ServerApiException error = Assert.assertThrows(ServerApiException.class, cmd::execute);
        Assert.assertEquals(ApiErrorCode.INTERNAL_ERROR, error.getErrorCode());
        Assert.assertTrue(error.getDescription().contains("Diagnostic ID:"));
        Assert.assertFalse(error.getDescription().contains("SQL"));
    }
}
