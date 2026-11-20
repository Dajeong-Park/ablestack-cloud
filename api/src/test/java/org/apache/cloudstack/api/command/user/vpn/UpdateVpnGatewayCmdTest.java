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
package org.apache.cloudstack.api.command.user.vpn;

import java.util.Arrays;
import java.util.Collection;

import org.apache.cloudstack.api.ApiErrorCode;
import org.apache.cloudstack.api.ResponseGenerator;
import org.apache.cloudstack.api.ServerApiException;
import org.apache.cloudstack.api.response.Site2SiteVpnGatewayResponse;
import org.junit.Assert;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.junit.runners.Parameterized;
import org.mockito.Mockito;
import org.springframework.test.util.ReflectionTestUtils;

import com.cloud.exception.InvalidParameterValueException;
import com.cloud.exception.PermissionDeniedException;
import com.cloud.network.Site2SiteVpnGateway;
import com.cloud.network.vpn.Site2SiteVpnService;
import com.cloud.utils.db.UUIDManager;

@RunWith(Parameterized.class)
public class UpdateVpnGatewayCmdTest {
    private static final long ID = 7L;
    private static final String CUSTOM_ID = "23f2bd36-0d41-4c9d-b314-e635804ce8d0";
    private final Boolean display;
    private final String customId;
    private UpdateVpnGatewayCmd command;
    private Site2SiteVpnService service;
    private ResponseGenerator generator;

    public UpdateVpnGatewayCmdTest(Boolean display, String customId) {
        this.display = display;
        this.customId = customId;
    }

    @Parameterized.Parameters(name = "display={0}, customId={1}")
    public static Collection<Object[]> parameters() {
        return Arrays.asList(new Object[][] {
            {null, null}, {Boolean.FALSE, null}, {Boolean.TRUE, null},
            {null, CUSTOM_ID}, {Boolean.FALSE, CUSTOM_ID}, {Boolean.TRUE, CUSTOM_ID}
        });
    }

    @Before
    public void setUp() {
        command = new UpdateVpnGatewayCmd();
        service = Mockito.mock(Site2SiteVpnService.class);
        generator = Mockito.mock(ResponseGenerator.class);
        command._s2sVpnService = service;
        command._responseGenerator = generator;
        ReflectionTestUtils.setField(command, "id", ID);
        ReflectionTestUtils.setField(command, "customId", customId);
        ReflectionTestUtils.setField(command, "display", display);
    }

    @Test
    public void updatedGatewayBecomesTheCommandResponse() {
        Site2SiteVpnGateway gateway = Mockito.mock(Site2SiteVpnGateway.class);
        Site2SiteVpnGatewayResponse response = new Site2SiteVpnGatewayResponse();
        response.setObjectName("vpngateway");
        response.setId(customId == null ? "18f256ac-9550-4aad-a096-f69524780d90" : customId);
        response.setAccountName("actual-owner");
        response.setProjectId("322d6bbb-c7e8-4d92-8d64-ac881f71791a");
        Mockito.when(service.updateVpnGateway(ID, customId, display)).thenReturn(gateway);
        Mockito.when(generator.createSite2SiteVpnGatewayResponse(gateway)).thenReturn(response);

        command.execute();

        Assert.assertSame("The async serializer must receive the generated gateway object", response, command.getResponseObject());
        Assert.assertEquals("updatevpngatewayresponse", response.getResponseName());
        Assert.assertEquals("vpngateway", response.getObjectName());
        Mockito.verify(service).updateVpnGateway(ID, customId, display);
        Mockito.verify(generator).createSite2SiteVpnGatewayResponse(gateway);
    }

    @Test
    public void nullServiceResultFailsInsteadOfPublishingAnEmptySuccess() {
        Mockito.when(service.updateVpnGateway(ID, customId, display)).thenReturn(null);

        try {
            command.execute();
            Assert.fail("A missing update result must fail the async operation");
        } catch (ServerApiException error) {
            Assert.assertEquals(ApiErrorCode.INTERNAL_ERROR, error.getErrorCode());
            Assert.assertTrue(error.getDescription().contains("VPN gateway"));
        }

        Assert.assertNull(command.getResponseObject());
        Mockito.verify(generator, Mockito.never()).createSite2SiteVpnGatewayResponse(Mockito.any(Site2SiteVpnGateway.class));
    }

    @Test
    public void existingServiceFailuresAreNotConvertedToSuccessOrWrapped() {
        RuntimeException[] failures = {
            new InvalidParameterValueException("gateway does not exist"),
            new PermissionDeniedException("gateway belongs to another owner"),
            new IllegalStateException("update failed")
        };
        for (RuntimeException failure : failures) {
            Mockito.doThrow(failure).when(service).updateVpnGateway(ID, customId, display);
            try {
                command.execute();
                Assert.fail("The original service failure must propagate");
            } catch (RuntimeException error) {
                Assert.assertSame(failure, error);
            }
            Assert.assertNull(command.getResponseObject());
        }
        Mockito.verify(generator, Mockito.never()).createSite2SiteVpnGatewayResponse(Mockito.any(Site2SiteVpnGateway.class));
    }

    @Test
    public void customUuidValidationStillUsesTheExistingValidator() {
        UUIDManager validator = Mockito.mock(UUIDManager.class);
        ReflectionTestUtils.setField(command, "_uuidMgr", validator);
        command.checkUuid();
        if (customId == null) {
            Mockito.verify(validator, Mockito.never()).checkUuid(Mockito.anyString(), Mockito.any());
        } else {
            Mockito.verify(validator).checkUuid(customId, Site2SiteVpnGateway.class);
            RuntimeException duplicate = new InvalidParameterValueException("duplicate custom UUID");
            Mockito.doThrow(duplicate).when(validator).checkUuid(customId, Site2SiteVpnGateway.class);
            try {
                command.checkUuid();
                Assert.fail("UUID validation failures must retain their existing meaning");
            } catch (RuntimeException error) {
                Assert.assertSame(duplicate, error);
            }
        }
    }
}
