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

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import java.lang.reflect.Field;

import org.apache.cloudstack.acl.RoleType;
import org.apache.cloudstack.api.ApiConstants;
import org.apache.cloudstack.api.BaseCmd.CommandType;
import org.apache.cloudstack.api.Parameter;
import org.apache.cloudstack.api.response.IPAddressResponse;
import org.apache.cloudstack.api.response.VpcResponse;
import org.junit.Test;

public class CreateVpnGatewayCmdMetadataTest {
    @Test
    public void vpcMetadataIdentifiesTheRequiredVpc() throws Exception {
        final Parameter parameter = parameter("vpcId");
        assertEquals(ApiConstants.VPC_ID, parameter.name());
        assertEquals(CommandType.UUID, parameter.type());
        assertEquals(VpcResponse.class, parameter.entityType()[0]);
        assertTrue(parameter.required());
        assertTrue(parameter.description().contains("VPC"));
        assertFalse(parameter.description().contains("Public IP"));
    }

    @Test
    public void optionalIpAndRootDisplayContractsRemainUnchanged() throws Exception {
        final Parameter ip = parameter("ipAddressId");
        assertEquals(ApiConstants.IP_ADDRESS_ID, ip.name());
        assertEquals(IPAddressResponse.class, ip.entityType()[0]);
        assertFalse(ip.required());
        final Parameter display = parameter("display");
        assertEquals(1, display.authorized().length);
        assertEquals(RoleType.Admin, display.authorized()[0]);
    }

    @Test
    public void explicitVpcAndIpValuesAreForwardedWithoutChangingDisplayDefault() throws Exception {
        final CreateVpnGatewayCmd command = new CreateVpnGatewayCmd();
        set(command, "vpcId", 31L);
        set(command, "ipAddressId", 32L);
        assertEquals(Long.valueOf(31L), command.getVpcId());
        assertEquals(Long.valueOf(32L), command.getIpAddressId());
        assertTrue(command.isDisplay());
    }

    private static Parameter parameter(final String name) throws Exception {
        return CreateVpnGatewayCmd.class.getDeclaredField(name).getAnnotation(Parameter.class);
    }

    private static void set(final CreateVpnGatewayCmd command, final String name, final Long value) throws Exception {
        final Field field = CreateVpnGatewayCmd.class.getDeclaredField(name);
        field.setAccessible(true);
        field.set(command, value);
    }
}
