// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements. See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership. The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License. You may obtain a copy of the License at
//
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied. See the License for the
// specific language governing permissions and limitations
// under the License.
package org.apache.cloudstack.api.command.user.config;

import com.google.gson.Gson;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import org.apache.cloudstack.acl.RoleType;
import org.apache.cloudstack.api.APICommand;
import org.apache.cloudstack.api.command.user.kms.hsm.CreateHSMProfileCmd;
import org.apache.cloudstack.api.response.CapabilitiesResponse;
import org.apache.cloudstack.framework.kms.KMSProvider;
import org.apache.cloudstack.kms.KMSManager;
import org.junit.Test;

import java.lang.reflect.Field;
import java.util.Arrays;
import java.util.Collections;
import java.util.Locale;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.doReturn;

public class CapabilitiesKMSProvidersTest {
    private ListCapabilitiesCmd command(KMSManager manager) throws Exception {
        ListCapabilitiesCmd cmd = new ListCapabilitiesCmd();
        Field field = ListCapabilitiesCmd.class.getDeclaredField("kmsManager");
        field.setAccessible(true);
        field.set(cmd, manager);
        return cmd;
    }

    private KMSProvider provider(String name) {
        KMSProvider provider = mock(KMSProvider.class);
        when(provider.getProviderName()).thenReturn(name);
        return provider;
    }

    @Test
    public void advertisesOnlyLoadedNormalizedDistinctIdentifiers() throws Exception {
        KMSManager manager = mock(KMSManager.class);
        doReturn(Arrays.asList(provider(" PKCS11 "), provider("database"),
                provider("DATABASE"), null, provider(""), provider("../invalid"))).when(manager).listKMSProviders();
        CapabilitiesResponse response = new CapabilitiesResponse();
        response.setKmsProviders(command(manager).loadedKmsProviders());
        JsonArray json = new Gson().toJsonTree(response).getAsJsonObject().getAsJsonArray("kmsproviders");
        assertEquals(2, json.size());
        assertEquals("database", json.get(0).getAsJsonObject().get("protocol").getAsString());
        assertEquals("PKCS#11", json.get(1).getAsJsonObject().get("displayname").getAsString());
        assertEquals(2, json.get(1).getAsJsonObject().entrySet().size());
        assertFalse(json.toString().contains("details"));
        assertFalse(json.toString().contains("pin"));
        assertFalse(json.toString().contains("kmip"));
    }

    @Test
    public void loadedCustomProviderUsesLocaleIndependentIdentifier() throws Exception {
        KMSManager manager = mock(KMSManager.class);
        doReturn(Collections.singletonList(provider("KMIP"))).when(manager).listKMSProviders();
        Locale before = Locale.getDefault();
        try {
            Locale.setDefault(new Locale("tr"));
            CapabilitiesResponse response = new CapabilitiesResponse();
            response.setKmsProviders(command(manager).loadedKmsProviders());
            JsonObject json = new Gson().toJsonTree(response).getAsJsonObject();
            assertEquals("kmip", json.getAsJsonArray("kmsproviders").get(0).getAsJsonObject().get("protocol").getAsString());
        } finally {
            Locale.setDefault(before);
        }
    }

    @Test
    public void absentOrFailedDiscoveryDoesNotBreakCoreCapabilities() throws Exception {
        assertTrue(command(null).loadedKmsProviders().isEmpty());
        KMSManager manager = mock(KMSManager.class);
        when(manager.listKMSProviders()).thenThrow(new IllegalStateException("provider unavailable"));
        assertTrue(command(manager).loadedKmsProviders().isEmpty());
        assertFalse(new Gson().toJsonTree(new CapabilitiesResponse()).getAsJsonObject().has("kmsproviders"));
    }

    @Test
    public void legacyProtocolDefaultAndAdminSensitiveContractArePreserved() {
        assertEquals("pkcs11", new CreateHSMProfileCmd().getProtocol());
        APICommand metadata = CreateHSMProfileCmd.class.getAnnotation(APICommand.class);
        assertEquals(1, metadata.authorized().length);
        assertEquals(RoleType.Admin, metadata.authorized()[0]);
        assertTrue(metadata.requestHasSensitiveInfo());
        assertTrue(metadata.responseHasSensitiveInfo());
    }
}
