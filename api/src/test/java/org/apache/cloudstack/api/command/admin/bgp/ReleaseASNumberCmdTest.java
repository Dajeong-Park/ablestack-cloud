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

import com.cloud.bgp.BGPService;
import com.cloud.exception.InvalidParameterValueException;
import com.cloud.exception.PermissionDeniedException;
import com.cloud.utils.Pair;
import org.apache.cloudstack.api.APICommand;
import org.apache.cloudstack.api.ApiErrorCode;
import org.apache.cloudstack.api.ServerApiException;
import org.apache.cloudstack.api.response.SuccessResponse;
import org.apache.cloudstack.acl.RoleType;
import org.junit.Assert;
import org.junit.Test;
import org.mockito.Mockito;
import org.springframework.test.util.ReflectionTestUtils;

public class ReleaseASNumberCmdTest {
    private final BGPService service = Mockito.mock(BGPService.class);
    private ReleaseASNumberCmd command() {
        ReleaseASNumberCmd cmd = new ReleaseASNumberCmd();
        ReflectionTestUtils.setField(cmd, "zoneId", 1L);
        ReflectionTestUtils.setField(cmd, "asNumber", 4200000000L);
        ReflectionTestUtils.setField(cmd, "bgpService", service);
        return cmd;
    }
    @Test
    public void synchronousReleasePreservesLongTargetAndAdminAuthorization() throws Exception {
        ReleaseASNumberCmd cmd = command();
        Mockito.when(service.releaseASNumber(1L, 4200000000L, false)).thenReturn(new Pair<>(true, "OK"));
        cmd.execute();
        Assert.assertTrue(cmd.getResponseObject() instanceof SuccessResponse);
        Assert.assertArrayEquals(new RoleType[] {RoleType.Admin}, ReleaseASNumberCmd.class.getAnnotation(APICommand.class).authorized());
    }
    @Test
    public void domainOrPolicyFailureIsTypedAndOutOfRangeNeverCallsService() {
        ReleaseASNumberCmd cmd = command();
        Mockito.when(service.releaseASNumber(1L, 4200000000L, false)).thenThrow(new InvalidParameterValueException("requiredbyoffering"));
        Assert.assertEquals(ApiErrorCode.PARAM_ERROR, Assert.assertThrows(ServerApiException.class, cmd::execute).getErrorCode());
        Mockito.reset(service);
        Mockito.when(service.releaseASNumber(1L, 4200000000L, false)).thenThrow(new PermissionDeniedException("private ACL"));
        ServerApiException denied = Assert.assertThrows(ServerApiException.class, cmd::execute);
        Assert.assertEquals(ApiErrorCode.UNAUTHORIZED, denied.getErrorCode());
        Assert.assertFalse(denied.getDescription().contains("private"));
        Mockito.reset(service); ReflectionTestUtils.setField(cmd, "asNumber", 4294967296L);
        Assert.assertEquals(ApiErrorCode.PARAM_ERROR, Assert.assertThrows(ServerApiException.class, cmd::execute).getErrorCode());
        Mockito.verifyNoInteractions(service);
    }
}
