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

import org.apache.cloudstack.api.response.SuccessResponse;
import org.junit.Assert;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.mockito.Mockito;
import org.mockito.junit.MockitoJUnitRunner;
import org.springframework.test.util.ReflectionTestUtils;

@RunWith(MockitoJUnitRunner.class)
public class DeleteASNRangeCmdTest {

    BGPService bgpService = Mockito.spy(BGPService.class);

    @Test
    public void testDeleteASNRangeCmd() {
        Long id = 200L;

        DeleteASNRangeCmd cmd = new DeleteASNRangeCmd();
        ReflectionTestUtils.setField(cmd, "id", id);
        ReflectionTestUtils.setField(cmd,"bgpService", bgpService);

        Assert.assertEquals(id, cmd.getId());

        Mockito.when(bgpService.deleteASRange(id)).thenReturn(true);
        try {
            cmd.execute();
        } catch (Exception ignored) {
        }

        Object response = cmd.getResponseObject();
        Assert.assertTrue(response instanceof SuccessResponse);

    }

    @Test
    public void allocatedRangeIsAParameterError() {
        DeleteASNRangeCmd cmd = new DeleteASNRangeCmd();
        ReflectionTestUtils.setField(cmd, "bgpService", bgpService);
        Mockito.when(bgpService.deleteASRange(Mockito.anyLong())).thenThrow(new com.cloud.exception.InvalidParameterValueException("allocated"));
        ReflectionTestUtils.setField(cmd, "id", 200L);
        org.apache.cloudstack.api.ServerApiException failure = Assert.assertThrows(org.apache.cloudstack.api.ServerApiException.class, cmd::execute);
        Assert.assertEquals(org.apache.cloudstack.api.ApiErrorCode.PARAM_ERROR, failure.getErrorCode());
        Assert.assertEquals("allocated", failure.getDescription());
    }

    @Test
    public void internalFailureDoesNotExposeDatabaseDetails() {
        DeleteASNRangeCmd cmd = new DeleteASNRangeCmd();
        ReflectionTestUtils.setField(cmd, "id", 200L); ReflectionTestUtils.setField(cmd, "bgpService", bgpService);
        Mockito.when(bgpService.deleteASRange(200L)).thenThrow(new IllegalStateException("SQL credential details"));
        org.apache.cloudstack.api.ServerApiException failure = Assert.assertThrows(org.apache.cloudstack.api.ServerApiException.class, cmd::execute);
        Assert.assertFalse(failure.getDescription().contains("SQL")); Assert.assertTrue(failure.getDescription().contains("Diagnostic ID:"));
    }

    @Test
    public void authorizationRemainsAdminOnly() {
        Assert.assertArrayEquals(new org.apache.cloudstack.acl.RoleType[] {org.apache.cloudstack.acl.RoleType.Admin},
                DeleteASNRangeCmd.class.getAnnotation(org.apache.cloudstack.api.APICommand.class).authorized());
    }
}
