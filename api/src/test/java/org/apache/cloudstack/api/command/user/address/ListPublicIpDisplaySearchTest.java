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
package org.apache.cloudstack.api.command.user.address;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;
import java.lang.reflect.Field;
import java.util.Arrays;
import org.junit.Test;
import org.apache.cloudstack.api.Parameter;
import org.apache.cloudstack.acl.RoleType;
import com.cloud.exception.InvalidParameterValueException;

public class ListPublicIpDisplaySearchTest {
    private ListPublicIpAddressesCmd command(Boolean display, Boolean all) throws Exception {
        ListPublicIpAddressesCmd cmd = new ListPublicIpAddressesCmd();
        for (String name : new String[]{"display", "displayAll"}) {
            Field field = ListPublicIpAddressesCmd.class.getDeclaredField(name);
            field.setAccessible(true);
            field.set(cmd, "display".equals(name) ? display : all);
        }
        return cmd;
    }
    @Test public void defaultAndFalseKeepExistingBehavior() throws Exception {
        assertEquals(Boolean.TRUE, command(null, null).getDisplay());
        assertEquals(Boolean.TRUE, command(null, false).getDisplay());
        assertEquals(Boolean.FALSE, command(false, null).getDisplay());
        assertEquals(Boolean.TRUE, command(true, null).getDisplay());
    }
    @Test public void explicitAllRemovesOnlyTheDisplayPredicate() throws Exception {
        assertNull(command(null, true).getDisplay());
    }
    @Test(expected = InvalidParameterValueException.class) public void conflictingTrueFailsClosed() throws Exception {
        command(true, true).getDisplay();
    }
    @Test(expected = InvalidParameterValueException.class) public void conflictingFalseFailsClosed() throws Exception {
        command(false, true).getDisplay();
    }
    @Test public void allIsRootAdminOnlyInApiMetadata() throws Exception {
        Parameter parameter = ListPublicIpAddressesCmd.class.getDeclaredField("displayAll").getAnnotation(Parameter.class);
        assertEquals("displayall", parameter.name());
        assertEquals(Arrays.asList(RoleType.Admin), Arrays.asList(parameter.authorized()));
    }
}
