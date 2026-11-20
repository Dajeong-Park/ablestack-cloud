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

package org.apache.cloudstack.kms;

import com.cloud.exception.PermissionDeniedException;
import com.cloud.storage.dao.VolumeDao;
import com.cloud.user.Account;
import com.cloud.user.AccountManager;
import com.cloud.user.User;
import org.apache.cloudstack.api.ApiConstants;
import org.apache.cloudstack.api.command.user.kms.ListKMSKeysCmd;
import org.apache.cloudstack.api.command.user.kms.hsm.ListHSMProfilesCmd;
import org.apache.cloudstack.api.response.HSMProfileResponse;
import org.apache.cloudstack.api.response.KMSKeyResponse;
import org.apache.cloudstack.context.CallContext;
import org.apache.cloudstack.kms.dao.KMSKeyDao;
import org.apache.cloudstack.kms.dao.KMSWrappedKeyDao;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockedStatic;
import org.mockito.junit.MockitoJUnitRunner;

import java.util.Map;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@RunWith(MockitoJUnitRunner.class)
public class KMSManagerImplUsageTest {
    @InjectMocks
    private KMSManagerImpl manager;
    @Mock
    private VolumeDao volumeDao;
    @Mock
    private KMSKeyDao keys;
    @Mock
    private KMSWrappedKeyDao wrapped;
    @Mock
    private AccountManager accounts;
    @Mock
    private Account caller;
    @Mock
    private CallContext context;
    @Mock
    private User user;
    @Mock
    private KMSKey key;
    @Mock
    private HSMProfile profile;
    @Mock
    private ListKMSKeysCmd listKeys;
    @Mock
    private ListHSMProfilesCmd listProfiles;

    @Test
    public void keyOwnerCanSeeWrappedReferencesEvenWithZeroLiveVolumes() {
        when(caller.getId()).thenReturn(7L);
        when(key.getAccountId()).thenReturn(7L);
        when(key.getId()).thenReturn(10L);
        when(wrapped.countByKmsKeyId(10L)).thenReturn(3L);

        try (MockedStatic<CallContext> current = mockStatic(CallContext.class)) {
            current.when(CallContext::current).thenReturn(context);
            KMSKeyResponse response = new KMSKeyResponse();
            manager.populateKeyUsage(response, key, caller, listKeys);
            assertEquals(Map.of("volumecount", 0L, "wrappedkeycount", 3L), response.getUsage());
        }
    }

    @Test
    public void delegatedKeyReadAndRestrictedProfilesOmitUsage() {
        when(caller.getId()).thenReturn(7L);
        when(key.getAccountId()).thenReturn(8L);
        KMSKeyResponse keyResponse = new KMSKeyResponse();
        manager.populateKeyUsage(keyResponse, key, caller, listKeys);
        HSMProfileResponse profileResponse = new HSMProfileResponse();
        manager.populateProfileUsage(profileResponse, profile, false, listProfiles);

        assertNull(keyResponse.getUsage());
        assertNull(profileResponse.getUsage());
        verifyNoInteractions(volumeDao, wrapped, keys);
    }

    @Test
    public void profileReportsVersionReferencesIndependentlyOfCurrentKeys() {
        when(profile.getId()).thenReturn(15L);
        when(wrapped.countByHsmProfileId(15L)).thenReturn(5L);

        try (MockedStatic<CallContext> current = mockStatic(CallContext.class)) {
            current.when(CallContext::current).thenReturn(context);
            HSMProfileResponse response = new HSMProfileResponse();
            manager.populateProfileUsage(response, profile, true, listProfiles);
            assertEquals(Map.of("kmskeycount", 0L, "versionwrappedkeycount", 5L), response.getUsage());
        }
    }

    @Test
    public void signedCallerDeniedRelatedApiDoesNotReceiveUsage() {
        when(listProfiles.getFullUrlParams()).thenReturn(Map.of(ApiConstants.API_KEY, "test-key-id"));
        when(context.getCallingUser()).thenReturn(user);
        doThrow(new PermissionDeniedException("denied")).when(accounts).checkApiAccessForUser(user, "listKMSKeys", "test-key-id");

        try (MockedStatic<CallContext> current = mockStatic(CallContext.class)) {
            current.when(CallContext::current).thenReturn(context);
            HSMProfileResponse response = new HSMProfileResponse();
            manager.populateProfileUsage(response, profile, true, listProfiles);
            assertNull(response.getUsage());
            verifyNoInteractions(keys, wrapped);
        }
    }
}
